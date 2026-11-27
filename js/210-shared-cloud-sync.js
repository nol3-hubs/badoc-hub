/*
 BADOC SHARED SYNC v7
 Authoritative state is a a shared state row, not file metadata.
 Storage contains the actual files; the DB row contains the current state.
 Realtime fires immediately; 5-second polling is a fallback.
*/
(function(){
  const cfg=window.BADOC_SHARED_CONFIG||{};
  const bucket="exported-files";
  const TABLE="badoc_shared_state";
  const P={upload:"current/uploaded.csv",linehaul:"current/linehaul.csv",linehaulArrivalFlags:"current/linehaul-arrival-flags.json",volumeSnapshot:"current/daily-volume-snapshot.json",onholdExports:"current/onhold-today-exports.json",settings:"current/town-settings.json",riders:"current/riders-data.json",layout:"current/town-layout.json",riderSelections:"current/rider-selections.json",notes:"current/town-group-notes.json"};
  let client=null,channel=null,pollTimer=null,pulling=false,started=false;
  const queuedPullKinds=new Set();
  const pendingCloudWrites=new Set();
  // Local uploads remain protected from cloud pulls until the authoritative
  // DB state confirms them. This prevents a temporary DB/sync failure from
  // making freshly uploaded data disappear.
  let uploadLocalDirty=false;
  let uploadPendingVersion=0;
  let linehaulLocalDirty=false;
  let linehaulPendingVersion=0;
  try{
    uploadLocalDirty=localStorage.getItem("badoc_upload_dirty_v1")==="1";
    uploadPendingVersion=Number(localStorage.getItem("badoc_upload_pending_version_v1")||0);
    linehaulLocalDirty=localStorage.getItem("badoc_linehaul_dirty_v1")==="1";
    linehaulPendingVersion=Number(localStorage.getItem("badoc_linehaul_pending_version_v1")||0);
  }catch{}
  const deviceId=crypto?.randomUUID?.()||("d-"+Date.now()+"-"+Math.random().toString(36).slice(2));

  function status(t){
    const e=document.getElementById("sharedStatus"),s=e?.querySelector(".top-sync-text");
    // Pickup upload success is shown in the Pickup import panel. Do not hide or
    // rewrite the persistent connection indicator when an upload completes.
    if(String(t||"")==="Pickup Orders and Tasks synced to shared cloud")return;
    if(e){e.hidden=false;e.removeAttribute("aria-hidden");e.className="top-sync-status connected";}
    if(s)s.textContent=t;
    // Keep a compact, user-visible record of the last successful cloud sync.
    if(/all devices synced|upload synced|linehaul synced|last upload undone|cleared on all devices/i.test(String(t||""))){
      try{localStorage.setItem("badoc_last_sync_at",String(Date.now()))}catch{}
    }
  }
  function supa(){
    if(client)return client;
    if(!window.BadocCloud||!cfg.url||!cfg.key)throw Error("Cloud configuration missing");
    client=window.BadocCloud.createClient(cfg.url,cfg.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }
  function storage(){return supa().storage.from(bucket)}
  async function acquireSharedFileWriterLease(){
    const claim=window.BadocCloud?.claim;
    if(typeof claim!=="function")throw Error("Shared parcel writer lock is unavailable; cloud write was stopped to prevent lost uploads.");
    for(let attempt=0;attempt<60;attempt++){
      if(await claim("badoc-shared-file-writer-v1",deviceId,120000))return true;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw Error("Another device is updating shared Parcel Count. Retry after its write finishes.");
  }
  async function releaseSharedFileWriterLease(){
    try{await window.BadocCloud?.release?.("badoc-shared-file-writer-v1",deviceId)}catch(error){console.warn("Parcel writer lock release:",error)}
  }

  async function put(path,data,type){
    const r=await storage().upload(path,data,{contentType:type||"application/octet-stream",upsert:true,cacheControl:"0"});
    if(r.error)throw Error(r.error.message||"Storage upload failed");
  }
  async function remove(path){
    const r=await storage().remove([path]);
    if(r.error&&!/not found|404|object not found/i.test(r.error.message||""))
      throw Error(r.error.message||"Storage delete failed");
  }
  async function get(path){
    const r=await storage().download(path);
    if(r.error){
      if(/not found|404|object not found/i.test(r.error.message||""))return null;
      throw Error(r.error.message||"Storage download failed");
    }
    return r.data;
  }

  async function state(){
    const c=supa();
    const r=await c.from(TABLE).select("*").eq("id",1).maybeSingle();
    if(r.error)throw Error(r.error.message||"Shared state read failed");
    return r.data||null;
  }
  async function setState(patch){
    const c=supa();
    // Update only the fields that changed. The previous implementation read
    // the whole state row and then upserted a complete snapshot. Two devices
    // doing different sync operations at nearly the same time could therefore
    // overwrite each other's upload_version/upload_exists values with stale data.
    // A partial UPDATE makes each sync operation independent and prevents a
    // Linehaul/Settings/Layout/Notes update from rolling back Parcel Count sync.
    const clean={...(patch||{}),updated_at:new Date().toISOString(),updated_by:deviceId};
    let r=await c.from(TABLE).update(clean).eq("id",1).select().maybeSingle();
    if(r.error)throw Error(r.error.message||"Shared state update failed");
    if(r.data)return r.data;
    // First-run compatibility if the authoritative row does not exist yet.
    const row={
      id:1,
      upload_exists:false,upload_version:0,
      linehaul_exists:false,linehaul_version:0,
      settings_version:0,layout_version:0,notes_version:0,
      ...clean
    };
    r=await c.from(TABLE).insert(row).select().single();
    if(r.error)throw Error(r.error.message||"Shared state create failed");
    return r.data;
  }

  async function announce(kind,action){
    try{
      if(!channel)await ensureRealtime();
      if(channel)await channel.send({
        type:"broadcast",event:"badoc-sync",
        payload:{deviceId,kind,action,at:Date.now()}
      });
    }catch(e){console.warn("Broadcast:",e)}
  }

  async function ensureRealtime(){
    const c=supa();
    if(channel)return;
    channel=c.channel("badoc-shared-state-v7");
    channel.on("broadcast",{event:"badoc-sync"},({payload})=>{
      if(payload?.deviceId===deviceId)return;
      pull(payload?.kind).catch(e=>console.warn("Realtime pull:",e));
    });
    // Also listen to Postgres changes on the authoritative state row.
    channel.on("postgres_changes",
      {event:"UPDATE",schema:"public",table:TABLE,filter:"id=eq.1"},
      payload=>{
        if(payload?.new?.updated_by===deviceId)return;
        pull().catch(e=>console.warn("DB realtime pull:",e));
      }
    );
    channel.subscribe(s=>{
      if(s==="SUBSCRIBED")status("Cloud sync connected");
      else if(s==="CHANNEL_ERROR"||s==="TIMED_OUT")status("Sync reconnecting…");
    });
  }

  async function clearLocalUpload(){
    if(typeof batches!=="undefined")batches=[];
    if(typeof current!=="undefined")current=null;
    uploadLocalDirty=false;uploadPendingVersion=0;
    try{localStorage.removeItem("badoc_upload_dirty_v1");localStorage.removeItem("badoc_upload_pending_version_v1")}catch{}
    if(typeof saveBatches==="function")await saveBatches();
    ["batches","currentBatch","current"].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
    if(typeof render==="function")render();
  }
  async function clearLocalLinehaul(){
    if(typeof linehaulTasks!=="undefined")linehaulTasks=[];
    linehaulLocalDirty=false;linehaulPendingVersion=0;
    try{localStorage.removeItem("badoc_linehaul_dirty_v1");localStorage.removeItem("badoc_linehaul_pending_version_v1")}catch{}
    if(typeof saveLinehaul==="function")saveLinehaul();
    [
      typeof LH_KEY!=="undefined"?LH_KEY:"badoc_linehaul_tasks_town_v1",
      typeof LH_PACKED_KEY!=="undefined"?LH_PACKED_KEY:"badoc_linehaul_packed_rows_v1",
      typeof LH_BLANK_PACKED_KEY!=="undefined"?LH_BLANK_PACKED_KEY:"badoc_linehaul_blank_packed_rows_v1",
      typeof LH_EXPORT_TOTAL_KEY!=="undefined"?LH_EXPORT_TOTAL_KEY:"badoc_linehaul_export_total_v1",
      typeof LH_EXPORT_UNIQUE_KEY!=="undefined"?LH_EXPORT_UNIQUE_KEY:"badoc_linehaul_export_unique_v1"
    ].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
    const f=document.getElementById("linehaulCsvFile");if(f)f.value="";
    if(typeof renderLinehaul==="function")renderLinehaul();
    if(typeof renderLinehaulKpis==="function")renderLinehaulKpis();
    if(typeof window.updateOperationProgress==="function") window.updateOperationProgress();
  }

  async function applyUpload(){
    const b=await get(P.upload);
    if(!b)return;
    if(typeof parseCSV!=="function"||typeof classify!=="function"||typeof saveBatches!=="function")return;
    const raw=await b.text();let rows=[],savedAt=0;
    try{const parsed=JSON.parse(raw);if(parsed?.schemaVersion===1&&Array.isArray(parsed.rows)){rows=parsed.rows;savedAt=Number(parsed.savedAt||0)}else rows=parseCSV(raw)}catch(_){rows=parseCSV(raw)}
    if(window.__badocSyncAllInProgress)return;
    const fallbackTime=savedAt||Date.now();
    rows=rows.map(row=>({...row,_badoc_sourceUploadedAt:Number(row?._badoc_sourceUploadedAt||fallbackTime)}));
    const z=classify(rows);
    const batch={name:"cloud-processed-parcels",time:fallbackTime,rows,valid:z.valid,mis:z.mis,duplicates:0};
    batches=[batch,...(Array.isArray(batches)?batches:[]).filter(x=>x&&x.name!=="cloud-uploaded.csv"&&x.name!=="cloud-processed-parcels")];
    current=batch;await saveBatches();
    if(typeof render==="function")render();
    if(!raw.trim().startsWith("{"))await uploadShared("upload",new Blob([JSON.stringify({schemaVersion:1,recordType:"parcel-records",rows,recordCount:rows.length,savedAt:fallbackTime})],{type:"application/json"}));
  }
  async function applyLinehaul(){
    const b=await get(P.linehaul);
    if(!b)return;
    if(typeof parseLinehaulCSV!=="function")return;
    let sharedArrivalFlags={};
    try{
      const flagsBlob=await get(P.linehaulArrivalFlags);
      if(flagsBlob){
        const parsedFlags=JSON.parse(await flagsBlob.text());
        if(parsedFlags&&typeof parsedFlags==="object"&&!Array.isArray(parsedFlags))sharedArrivalFlags=parsedFlags;
      }
    }catch(err){console.warn("Linehaul arrival flags load:",err)}
    const previousTasks=new Map((Array.isArray(linehaulTasks)?linehaulTasks:[]).map(x=>[x.blank?"__BLANK_LINEHAUL__":String(x.id||"").trim(),x]));
    const imported=parseLinehaulCSV(await b.text());
    if(window.__badocSyncAllInProgress)return;
    if(!imported.length)return;
    const parcelRowsForShared=Array.isArray(current?.rows)?current.rows:[];
    const parcelOrderIndexForShared=typeof buildLinehaulParcelOrderIndex==="function"
      ?buildLinehaulParcelOrderIndex(parcelRowsForShared):null;
    imported.forEach(task=>{
      const id=String(task?.id||"").trim();
      const key=task.blank?"__BLANK_LINEHAUL__":id;
      const previous=previousTasks.get(key);
      if(id&&Object.prototype.hasOwnProperty.call(sharedArrivalFlags,id))task.arrivingInTime=sharedArrivalFlags[id]===true;
      else if(previous&&typeof previous.arrivingInTime==="boolean")task.arrivingInTime=previous.arrivingInTime;
      else task.arrivingInTime=false;
      if(task.blank){task.townBreakdown={};task.matchedCount=0;return}
      const tb=typeof linehaulTownBreakdown==="function"?linehaulTownBreakdown(task,parcelRowsForShared,parcelOrderIndexForShared):{};
      task.townBreakdown=tb;
      task.matchedCount=Object.values(tb).reduce((s,g)=>s+(g.items||[]).length,0);
      Object.entries(tb).forEach(([town,g])=>(g.items||[]).forEach(item=>{
        item.x.town=town;item.x.status=item.x.status||task.status;
      }));
    });
    // Clear first: the shared newer file replaces the older task list on this device.
    linehaulTasks=[...new Map(imported.map(x=>[x.blank?"__BLANK_LINEHAUL__":x.id,x])).values()];
    if(typeof saveLinehaul==="function")saveLinehaul();
    if(typeof renderLinehaul==="function")renderLinehaul();
    if(typeof renderLinehaulKpis==="function")renderLinehaulKpis();
    if(typeof render==="function")render();
    if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
  }
  async function applySettings(){
    const b=await get(P.settings);
    if(b){
      try{
        const parsed=JSON.parse(await b.text());
        towns=Array.isArray(parsed)?parsed:(parsed?.towns||towns);
        const requiredTownsAdded=ensureRequiredBadocTowns();
        try{localStorage.setItem("pr_towns",JSON.stringify(towns))}catch{}
        // Publish the merged town list once so the new Badoc town is present on every device.
        if(requiredTownsAdded&&typeof saveTownSettings==="function")saveTownSettings();
      }catch(e){console.warn("Settings parse:",e)}
    }
    // Riders Data is stored separately from town settings.
    try{
      const rb=await get(P.riders);
      if(rb){
        const rr=JSON.parse(await rb.text());
        if(Array.isArray(rr)&&typeof ridersData!=="undefined"){
          ridersData=rr;
          if(typeof initRidersData==="function")initRidersData();
          if(typeof renderRiders==="function")renderRiders();
        }
      }
    }catch(e){console.warn("Riders data parse:",e)}
    if(typeof render==="function")render();
  }
  async function applyLayout(cloudVersion=0){
    // Preserve a local move only while it is genuinely newer than the cloud copy.
    // A stale dirty flag from a previous failed build must not block syncing forever.
    try{
      if(localStorage.getItem("badoc_town_layout_dirty_v2")==="1"){
        const localMoveAt=Number(localStorage.getItem("badoc_town_layout_dirty_at_v2")||0);
        if(!cloudVersion || localMoveAt>=Number(cloudVersion)){
          console.info("Town layout cloud pull skipped: local layout is newer or awaiting upload.");
          return;
        }
        localStorage.removeItem("badoc_town_layout_dirty_v2");
        localStorage.removeItem("badoc_town_layout_dirty_at_v2");
      }
    }catch{}
    const b=await get(P.layout);
    if(!b)return;
    try{
      const x=JSON.parse(await b.text());
      try{localStorage.setItem(TOWN_LAYOUT_KEY,JSON.stringify(x||{}))}catch{}
      if(typeof render==="function")render();
    }catch(e){console.warn("Town layout parse:",e)}
  }
  async function applyNotes(){
    const b=await get(P.notes);
    if(!b)return;
    try{
      const x=JSON.parse(await b.text());
      try{localStorage.setItem(TOWN_NOTES_KEY,JSON.stringify(x||{}))}catch{}
      if(document.querySelector(".town-rider-picker.open")){window.__badocPendingRiderRender=true;return;}
      if(typeof render==="function")render();
      window.__badocRenderDashboardRiderSummary?.();
    }catch(e){console.warn("Town notes parse:",e)}
  }
  async function applyVolumeSnapshot(){
    const b=await get(P.volumeSnapshot);
    if(!b){
      window.__badocVolumeSnapshot=null;
      try{localStorage.removeItem("badoc_daily_volume_snapshot_v1")}catch{}
      return;
    }
    const x=JSON.parse(await b.text());
    if(!x||x.schemaVersion!==1||!Array.isArray(x.rows)||!x.cycleKey)throw Error("Shared daily volume snapshot has an invalid format.");
    window.__badocVolumeSnapshot=x;
    try{localStorage.setItem("badoc_daily_volume_snapshot_v1",JSON.stringify(x))}catch(e){console.warn("Local volume snapshot cache:",e)}
  }
  async function applyOnholdExports(sharedState){
    const version=Number(sharedState?.onhold_version||0);
    if(sharedState?.onhold_exists!==true){
      // A missing legacy field is not a remote delete. Only clear when a newer
      // explicit cloud state says the shared Assigned Today snapshot was removed.
      if(sharedState?.onhold_exists===false&&version>0){
        await badocClearOnholdExportRows();
        try{if(typeof render==="function")render()}catch(e){}
        try{if(typeof renderRecords==="function")renderRecords()}catch(e){}
      }
      return 0;
    }
    await window.__badocOnholdExportsReady;
    const b=await get(P.onholdExports);
    if(!b)throw Error("Shared Assigned Today state exists, but its cloud export file is missing.");
    const record=JSON.parse(await b.text());
    if(!record||record.schemaVersion!==1||record.recordType!=="onhold-today-exports"||!Array.isArray(record.rows))
      throw Error("Shared Assigned Today export has an invalid format.");
    if(window.__badocSyncAllInProgress)return 0;
    const rows=badocSaveOnholdExportRows(record.rows);
    try{await badocPersistOnholdExportRows(rows)}catch(error){console.warn("Assigned Today local cache save failed; cloud copy remains available:",error)}
    const live=badocGetOnholdRows(typeof getParcelCountRows==="function"?getParcelCountRows():[],false);
    window.__badocOnholdTnKeys=new Set(live.map(row=>badocOnholdKey(spxTN(row))).filter(Boolean));
    try{if(typeof render==="function")render()}catch(e){console.warn("Assigned Today cloud render:",e)}
    try{window.updateOperationProgress?.()}catch(e){}
    try{if(typeof renderRecords==="function")renderRecords()}catch(e){}
    return rows.length;
  }
  async function applyRiderSelections(){
    const b=await get(P.riderSelections);
    if(!b)return false;
    try{
      const x=JSON.parse(await b.text());
      const version=Number(x?.version||0);
      const notes=x?.notes&&typeof x.notes==="object"?x.notes:{};
      const localVersion=Number(localStorage.getItem("badoc_rider_selection_version_v1")||0);
      if(version && version<localVersion)return false;
      try{localStorage.setItem(TOWN_NOTES_KEY,JSON.stringify(notes));localStorage.setItem("badoc_rider_selection_version_v1",String(version||Date.now()))}catch{}
      if(document.querySelector(".town-rider-picker.open")){window.__badocPendingRiderRender=true;return true;}
      if(typeof render==="function")render();
      window.__badocRenderDashboardRiderSummary?.();
      return true;
    }catch(e){console.warn("Rider selections parse:",e);return false}
  }

  let seen={upload:0,linehaul:0,volumeSnapshot:-1,onholdExports:-1,settings:0,layout:0,notes:0};
  async function pull(kind){
    if(pulling){ if(kind)queuedPullKinds.add(kind); else queuedPullKinds.add("__all__"); return; }
    pulling=true;
    try{
      const s=await state();
      if(!s){window.__badocVolumeSnapshotCloudReady=true;status("Shared state not set");return}
      if(kind==="upload"){
        if(!window.__badocSyncAllInProgress&&!pendingCloudWrites.has("upload")&&!uploadLocalDirty){
          if(!s.upload_exists)await clearLocalUpload();else await applyUpload();
          seen.upload=Number(s.upload_version||0);
        }
      }else if(kind==="linehaul"){
        // Do not let a background pull erase a freshly uploaded Linehaul file
        // while its cloud state is still being published.
        if(!window.__badocSyncAllInProgress&&!pendingCloudWrites.has("linehaul")&&!linehaulLocalDirty){
          if(!s.linehaul_exists)await clearLocalLinehaul();else await applyLinehaul();
          seen.linehaul=Number(s.linehaul_version||0);
        }
      }else if(kind==="volumeSnapshot"){
        await applyVolumeSnapshot();
        seen.upload=Number(s.upload_version||0);
        seen.volumeSnapshot=Number(s.upload_version||0);
      }else if(kind==="onholdExports"){
        if(!window.__badocSyncAllInProgress){
          await applyOnholdExports(s);
          seen.onholdExports=Number(s.onhold_version||0);
        }
      }else if(kind==="settings"){
        if(!pendingCloudWrites.has("settings")){
          if(Number(s.settings_version||0)>seen.settings)await applySettings();
          seen.settings=Number(s.settings_version||0);
        }
      }else if(kind==="layout"){
        if(Number(s.layout_version||0)>seen.layout)await applyLayout(Number(s.layout_version||0));
        seen.layout=Number(s.layout_version||0);
      }else if(kind==="notes"){
        if(Number(s.notes_version||0)>seen.notes)await applyNotes();
        seen.notes=Number(s.notes_version||0);
      }else if(kind==="riderSelections"){
        if(Number(s.notes_version||0)>seen.notes)await applyRiderSelections();
        seen.notes=Math.max(seen.notes,Number(s.notes_version||0));
      }else{
        if(!window.__badocSyncAllInProgress&&!pendingCloudWrites.has("upload")&&!uploadLocalDirty){
          if(!s.upload_exists)await clearLocalUpload();else if(Number(s.upload_version||0)>seen.upload)await applyUpload();
        }
        if(!window.__badocSyncAllInProgress&&!pendingCloudWrites.has("linehaul")&&!linehaulLocalDirty){
          if(!s.linehaul_exists)await clearLocalLinehaul();else if(Number(s.linehaul_version||0)>seen.linehaul)await applyLinehaul();
        }
        if(Number(s.upload_version||0)>seen.volumeSnapshot){
          await applyVolumeSnapshot();
          seen.volumeSnapshot=Number(s.upload_version||0);
        }
        if(!window.__badocSyncAllInProgress){
          const cloudOnholdVersion=Number(s.onhold_version||0);
          if(cloudOnholdVersion>0&&cloudOnholdVersion>seen.onholdExports){
            await applyOnholdExports(s);
            seen.onholdExports=cloudOnholdVersion;
          }else if(!s.onhold_exists&&cloudOnholdVersion===0&&seen.onholdExports<0){
            // One-time migration: this browser may have an Assigned Today snapshot
            // saved locally by the previous IndexedDB-only build. Publish it only
            // when the shared cloud has never held an Assigned Today version.
            await window.__badocOnholdExportsReady;
            const localRows=Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows:[];
            if(localRows.length&&typeof window.__badocCloudSaveOnholdToday==="function"){
              const migrated=await window.__badocCloudSaveOnholdToday(localRows,{migratedFromLocalCache:true});
              seen.onholdExports=Number(migrated?.version||cloudOnholdVersion);
            }else{
              seen.onholdExports=cloudOnholdVersion;
            }
          }
        }
        if(!pendingCloudWrites.has("settings")&&Number(s.settings_version||0)>seen.settings)await applySettings();
        if(!pendingCloudWrites.has("settings"))seen.settings=Number(s.settings_version||0);
        if(Number(s.layout_version||0)>seen.layout)await applyLayout(Number(s.layout_version||0));
        if(Number(s.notes_version||0)>seen.notes){
          await applyNotes();
          await applyRiderSelections();
        }
        seen={
          ...seen,
          ...(window.__badocSyncAllInProgress?{}:{
            upload:Number(s.upload_version||0),
            linehaul:Number(s.linehaul_version||0),
            onholdExports:Number(s.onhold_version||0)
          }),
          volumeSnapshot:Number(s.upload_version||0),
          settings:Number(s.settings_version||0),
          layout:Number(s.layout_version||0),
          notes:Number(s.notes_version||0)
        };
      }
      window.__badocVolumeSnapshotCloudReady=true;
      status("All devices synced");
      if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
    }catch(e){console.warn("Shared pull:",e);status("Sync retrying…")}
    finally{pulling=false}
  }

  // Publish Assigned Today to the same shared file store/state channel used by
  // other dashboard devices. IndexedDB remains a local cache, not the sync layer.
  window.__badocCloudSaveOnholdToday=async function(rowsInput,meta={}){
    const deadline=Date.now()+20000;
    while(!started&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
    if(!started)throw Error("Shared cloud sync is not ready.");
    const rows=badocSaveOnholdExportRows(Array.isArray(rowsInput)?rowsInput:[]);
    if(!Array.isArray(rowsInput))throw Error("Assigned Today export rows are invalid.");
    // Keep a local recovery copy, but cloud persistence is the success condition.
    try{await badocPersistOnholdExportRows(rows)}catch(error){console.warn("Assigned Today local backup failed; continuing with cloud save:",error)}
    const currentState=await state();
    const version=Math.max(Date.now(),Number(currentState?.onhold_version||0)+1);
    const payload={
      schemaVersion:1,
      recordType:"onhold-today-exports",
      rows,
      rowCount:rows.length,
      todayDate:String(meta?.todayDate||""),
      forwardRowCount:Number(meta?.forwardRowCount||0),
      returnRowCount:Number(meta?.returnRowCount||0),
      savedAt:Date.now(),
      savedBy:deviceId
    };
    pendingCloudWrites.add("onholdExports");
    try{
      await put(P.onholdExports,new Blob([JSON.stringify(payload)],{type:"application/json"}),"application/json");
      await setState({onhold_exists:true,onhold_version:version});
      seen.onholdExports=version;
      window.__badocOnholdExportRows=rows;
      const live=badocGetOnholdRows(typeof getParcelCountRows==="function"?getParcelCountRows():[],false);
      window.__badocOnholdTnKeys=new Set(live.map(row=>badocOnholdKey(spxTN(row))).filter(Boolean));
      await announce("onholdExports","save");
      status("Assigned Today synced to shared cloud");
      return {rowCount:rows.length,version,savedAt:payload.savedAt};
    }catch(error){
      status("Assigned Today cloud sync failed — local copy kept");
      throw Error("Assigned Today is saved on this device, but the shared cloud write failed: "+String(error?.message||error));
    }finally{
      pendingCloudWrites.delete("onholdExports");
    }
  };
  window.__badocCloudClearOnholdToday=async function(){
    const deadline=Date.now()+15000;
    while(!started&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
    if(!started)throw Error("Shared cloud sync is not ready.");
    const currentState=await state();
    const version=Math.max(Date.now(),Number(currentState?.onhold_version||0)+1);
    await remove(P.onholdExports);
    await setState({onhold_exists:false,onhold_version:version});
    seen.onholdExports=version;
    await announce("onholdExports","clear");
    await badocClearOnholdExportRows();
    return true;
  };

  // Expose a safe bridge for non-file imports (e.g. SPX automatic sync) so
  // freshly imported Linehaul data is published to the shared cloud state
  // before the background pull can replace it with an older snapshot.
  window.__badocCloudUploadLinehaulText = async function(text,fileName="inbound_to_from_spx.csv"){
    const deadline=Date.now()+15000;
    while(!started && Date.now()<deadline){
      await new Promise(r=>setTimeout(r,100));
    }
    if(!started) throw Error("Shared cloud sync is not ready.");
    const blob=new Blob([String(text||"")],{type:"text/csv"});
    return uploadShared("linehaul",blob);
  };

  // Parcel CSV uploads share one cloud object. Serialize writes to prevent two
  // simultaneous SPX exports from reading the same old snapshot and overwriting
  // one another. During Sync All, buffer both exports and publish them in a
  // deterministic order: inbound first, delivery-status export second (newest
  // status wins when a tracking number appears in both files).
  let parcelCloudWriteQueue=Promise.resolve();
  let syncAllParcelCloudBuffer=null;
  function queueParcelCloudWrite(text,fileName){
    const rows=typeof parseCSV==="function"?parseCSV(String(text||"")):[];
    if(!rows.length)throw Error("No processed parcel records were available for cloud sync.");
    const uploadedAt=Date.now(),batchId=`cloud-${uploadedAt.toString(36)}`;
    const stampedRows=rows.map(row=>({...row,_badoc_sourceUploadedAt:Number(row?._badoc_sourceUploadedAt||uploadedAt),_badoc_sourceBatchId:String(row?._badoc_sourceBatchId||batchId)}));
    const blob=new Blob([JSON.stringify({schemaVersion:1,recordType:"parcel-records",rows:stampedRows,recordCount:stampedRows.length,savedAt:uploadedAt})],{type:"application/json"});
    const task=()=>uploadShared("upload",blob);
    const next=parcelCloudWriteQueue.catch(()=>{}).then(task);
    parcelCloudWriteQueue=next.catch(()=>{});
    return next;
  }
  window.__badocBeginSyncAllParcelCloudBuffer=function(){
    syncAllParcelCloudBuffer=[];
    return true;
  };
  window.__badocFlushSyncAllParcelCloudBuffer=async function(){
    const pending=Array.isArray(syncAllParcelCloudBuffer)?syncAllParcelCloudBuffer:[];
    syncAllParcelCloudBuffer=null;
    const rank=source=>source==="spx-inbound"?0:source==="spx-delivery"?1:2;
    pending.sort((a,b)=>rank(a.source)-rank(b.source));
    for(const item of pending) await queueParcelCloudWrite(item.text,item.fileName);
    return {uploaded:pending.length,sources:pending.map(x=>x.source)};
  };
  window.__badocCloudUploadParcelText = async function(text,fileName="export_forward_order.csv",source=""){
    const deadline=Date.now()+15000;
    while(!started && Date.now()<deadline){
      await new Promise(r=>setTimeout(r,100));
    }
    if(!started) throw Error("Shared cloud sync is not ready.");
    if(Array.isArray(syncAllParcelCloudBuffer)){
      syncAllParcelCloudBuffer.push({text:String(text||""),fileName,source:String(source||"")});
      return {queued:true};
    }
    return queueParcelCloudWrite(text,fileName);
  };
  // One immutable parcel population per 3 PM Manila operating cycle.
  window.__badocCloudSaveDailyVolumeSnapshot = async function(snapshot){
    const deadline=Date.now()+20000;
    while(!started && Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
    if(!started)throw Error("Shared cloud sync is not ready.");
    if(uploadLocalDirty||pendingCloudWrites.has("upload"))throw Error("Parcel Count is still syncing; the daily snapshot will retry.");
    if(!snapshot||snapshot.schemaVersion!==1||!snapshot.cycleKey||!Array.isArray(snapshot.rows)||!snapshot.rows.length)
      throw Error("Daily volume snapshot is empty or invalid.");
    const currentState=await state();
    const existingBlob=await get(P.volumeSnapshot);
    if(existingBlob){
      try{
        const existing=JSON.parse(await existingBlob.text());
        if(existing?.cycleKey===snapshot.cycleKey){
          window.__badocVolumeSnapshot=existing;
          try{localStorage.setItem("badoc_daily_volume_snapshot_v1",JSON.stringify(existing))}catch{}
          return {created:false,snapshot:existing};
        }
      }catch(e){console.warn("Existing daily volume snapshot could not be read:",e)}
    }
    // Reuse the existing upload_version field as a shared change signal. This
    // avoids requiring a database schema migration for this app feature.
    const version=Math.max(Date.now(),Number(currentState?.upload_version||0)+1);
    const payload={...snapshot,savedAt:Date.now(),savedBy:deviceId};
    await put(P.volumeSnapshot,new Blob([JSON.stringify(payload)],{type:"application/json"}),"application/json");
    await setState({upload_version:version});
    seen.upload=version;
    seen.volumeSnapshot=version;
    window.__badocVolumeSnapshot=payload;
    try{localStorage.setItem("badoc_daily_volume_snapshot_v1",JSON.stringify(payload))}catch(e){console.warn("Local volume snapshot cache:",e)}
    await announce("volumeSnapshot","save");
    return {created:true,snapshot:payload};
  };

  // Save task-level arrival checkboxes separately from the imported CSV. Use
  // the existing linehaul_version signal so other devices refresh these flags.
  let arrivalFlagsWriteQueue=Promise.resolve();
  window.__badocCloudSaveLinehaulArrivalFlags = function(){
    const run=async()=>{
      const deadline=Date.now()+15000;
      while(!started && Date.now()<deadline){
        await new Promise(r=>setTimeout(r,100));
      }
      if(!started)throw Error("Shared cloud sync is not ready.");
      const flags={};
      (Array.isArray(linehaulTasks)?linehaulTasks:[]).forEach(task=>{
        const id=String(task?.id||"").trim();
        if(id&&!task.blank)flags[id]=task.arrivingInTime===true;
      });
      const version=Date.now()+Math.floor(Math.random()*1000);
      await put(P.linehaulArrivalFlags,new Blob([JSON.stringify(flags)],{type:"application/json"}),"application/json");
      await setState({linehaul_version:version});
      seen.linehaul=version;
      await announce("linehaul","arrival-flags");
      status("Linehaul arrival selections synced");
      return true;
    };
    arrivalFlagsWriteQueue=arrivalFlagsWriteQueue.catch(()=>{}).then(run);
    return arrivalFlagsWriteQueue;
  };

  // Manual CSV uploads and automatic SPX exports all write the same shared
  // Parcel Count object. Serialize every upload write (not just Sync All) so
  // two callers cannot merge against the same stale cloud snapshot.
  let uploadSharedParcelQueue=Promise.resolve();
  function uploadShared(kind,file){
    if(kind!=="upload")return uploadSharedNow(kind,file);
    const next=uploadSharedParcelQueue.catch(()=>{}).then(()=>uploadSharedNow(kind,file));
    uploadSharedParcelQueue=next.catch(()=>{});
    return next;
  }
  async function uploadSharedNow(kind,file){
    const path=kind==="upload"?P.upload:P.linehaul;
    const field=kind==="upload"?"upload":"linehaul";
    const version=Date.now();
    // Protect local Linehaul data from background sync while the cloud write
    // and authoritative state update are being committed.
    if(kind==="upload"){
      pendingCloudWrites.add("upload");
      uploadLocalDirty=true;
      uploadPendingVersion=version;
      try{
        localStorage.setItem("badoc_upload_dirty_v1","1");
        localStorage.setItem("badoc_upload_pending_version_v1",String(version));
      }catch{}
    }else if(kind==="linehaul"){
      pendingCloudWrites.add("linehaul");
      linehaulLocalDirty=true;
      linehaulPendingVersion=version;
      try{
        localStorage.setItem("badoc_linehaul_dirty_v1","1");
        localStorage.setItem("badoc_linehaul_pending_version_v1",String(version));
      }catch{}
    }
    let sharedWriterLease=false;
    try{
    await acquireSharedFileWriterLease();sharedWriterLease=true;

    // Upload Exported is a MULTI-UPLOAD source. Never replace the previous
    // cloud upload with the newest file. Merge the new CSV into the existing
    // cloud CSV and de-duplicate by SPX TN / SLS Tracking Number. This keeps
    // all previous uploads available to every device.
    let payload=file;
    if(kind==="upload"){
      try{
        const readRows=async blob=>{
          if(!blob)return {rows:[],savedAt:0};
          const raw=await blob.text();
          try{const parsed=JSON.parse(raw);if(parsed?.schemaVersion===1&&Array.isArray(parsed.rows))return {rows:parsed.rows,savedAt:Number(parsed.savedAt||0)};}catch(_){}
          return {rows:typeof parseCSV==="function"?parseCSV(raw):[],savedAt:0};
        };
        const old=await get(path),oldPayload=await readRows(old),newPayload=await readRows(file);
        const oldRows=oldPayload.rows,newRows=newPayload.rows;
        if(!newRows.length)throw Error("No processed parcel records found in the new upload.");
        const importedAt=Date.now();
        const stampedOld=oldRows.map(row=>({...row,_badoc_sourceUploadedAt:Number(row?._badoc_sourceUploadedAt||oldPayload.savedAt||importedAt)}));
        const stampedNew=newRows.map(row=>({...row,_badoc_sourceUploadedAt:Number(row?._badoc_sourceUploadedAt||importedAt)}));
        const combined=[...stampedOld,...stampedNew];
        const merged=typeof window.__badocMergeUniqueParcelRows==="function"
          ?window.__badocMergeUniqueParcelRows(combined):combined;
        payload=new Blob([JSON.stringify({schemaVersion:1,recordType:"parcel-records",rows:merged,recordCount:merged.length,savedAt:Math.max(oldPayload.savedAt,importedAt)})],{type:"application/json"});
        status(`Merging processed parcel records • ${merged.length.toLocaleString()} unique SPX TN`);
      }catch(err){console.warn("Processed parcel merge failed:",err);throw err;}
    }

    // Write the merged payload first. Only after success does the DB state
    // become authoritative, so receivers never pull a half-written file.
    await put(path,payload,payload.type||file.type||"text/csv");
    // Retry the authoritative state write. Without this, a temporary DB
    // failure can leave the old false state in place and a background pull
    // may incorrectly clear the local Linehaul task.
    let stateErr=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        await setState({
          [field+"_exists"]:true,
          [field+"_version"]:version
        });
        stateErr=null;
        break;
      }catch(err){
        stateErr=err;
        await new Promise(r=>setTimeout(r,350*(attempt+1)));
      }
    }
    if(stateErr)throw stateErr;
    if(kind==="upload"){
      uploadLocalDirty=false;
      uploadPendingVersion=0;
      try{
        localStorage.removeItem("badoc_upload_dirty_v1");
        localStorage.removeItem("badoc_upload_pending_version_v1");
      }catch{}
    }else if(kind==="linehaul"){
      linehaulLocalDirty=false;
      linehaulPendingVersion=0;
      try{
        localStorage.removeItem("badoc_linehaul_dirty_v1");
        localStorage.removeItem("badoc_linehaul_pending_version_v1");
      }catch{}
    }
    await announce(kind,"upload");
    seen[field]=version;
    status((kind==="upload"?"Upload":"Linehaul")+" synced");
    }catch(err){
      // Never clear locally uploaded data because cloud sync failed.
      if(kind==="upload"){
        uploadLocalDirty=true;
        uploadPendingVersion=version;
        try{
          localStorage.setItem("badoc_upload_dirty_v1","1");
          localStorage.setItem("badoc_upload_pending_version_v1",String(version));
        }catch{}
        status("Parcel Count sync error — data kept");
      }else if(kind==="linehaul"){
        linehaulLocalDirty=true;
        try{
          localStorage.setItem("badoc_linehaul_dirty_v1","1");
          localStorage.setItem("badoc_linehaul_pending_version_v1",String(version));
        }catch{}
        status("Linehaul sync error — data kept");
      }
      throw err;
    }finally{
      pendingCloudWrites.delete(kind);
      if(sharedWriterLease)await releaseSharedFileWriterLease();
    }
  }

  // Undo the last Upload Exported action in the authoritative cloud file.
  // Only the rows that were actually new in the last upload are removed.
  window.__badocClearAllSharedData=async function(){
    await clearShared("upload");
    await clearShared("linehaul");
  };

  async function clearShared(kind){
    const path=kind==="upload"?P.upload:P.linehaul;
    const field=kind==="upload"?"upload":"linehaul";
    const version=Date.now();
    let sharedWriterLease=false;
    await acquireSharedFileWriterLease();sharedWriterLease=true;
    pendingCloudWrites.add(kind);
    try{
      // A clear is a tombstone. Clear retry markers while holding the same
      // cross-device writer lease used by uploads, so no pending writer can
      // recreate the file between deletion and state publication.
      if(kind==="upload"){
        uploadLocalDirty=false;uploadPendingVersion=0;
        try{localStorage.removeItem("badoc_upload_dirty_v1");localStorage.removeItem("badoc_upload_pending_version_v1")}catch{}
      }else{
        linehaulLocalDirty=false;linehaulPendingVersion=0;
        try{localStorage.removeItem("badoc_linehaul_dirty_v1");localStorage.removeItem("badoc_linehaul_pending_version_v1")}catch{}
      }
      await remove(path);
      if(kind==="linehaul")await remove(P.linehaulArrivalFlags);
      await setState({[field+"_exists"]:false,[field+"_version"]:version});
      await announce(kind,"clear");
      status((kind==="upload"?"Upload":"Linehaul")+" cleared on all devices");
    }finally{
      pendingCloudWrites.delete(kind);
      if(sharedWriterLease)await releaseSharedFileWriterLease();
    }
  }

  // Capture phase makes sure this layer sees the user's action even when the
  // original app handler is registered elsewhere.
  document.getElementById("linehaulCsvFile")?.addEventListener("change",e=>{
    const f=e.target.files?.[0];if(!f||!started)return;
    uploadShared("linehaul",f).catch(err=>{console.error(err);status("Cloud upload failed: "+err.message)});
  },true);

  // Clear the complete Riders Data list on this device and in shared cloud storage.
  // Store an explicit empty JSON array so later cloud pulls retain the empty state.
  window.__badocClearAllRidersDataShared=async function(){
    if(!started)return false;
    pendingCloudWrites.add("settings");
    const version=Date.now();
    const empty=[];
    try{
      ridersData=empty;
      const input=document.getElementById("ridersCsvFile");if(input)input.value="";
      if(typeof initRidersData==="function")initRidersData();
      if(typeof renderRiders==="function")renderRiders();
      if(typeof render==="function")render();
      let lastErr=null;
      for(let attempt=0;attempt<3;attempt++){
        try{
          await put(P.riders,new Blob(["[]"],{type:"application/json"}),"application/json");
          await setState({settings_version:version});
          lastErr=null;
          break;
        }catch(e){lastErr=e;await new Promise(r=>setTimeout(r,600*(attempt+1)));}
      }
      if(lastErr)throw lastErr;
      seen.settings=version;
      await announce("settings","riders-clear-all");
      status("All Riders Data cleared on all devices");
      return true;
    }finally{
      pendingCloudWrites.delete("settings");
    }
  };

  // Sync Riders Data to the same shared Cloud storage. This does not affect Clear All Data.
  document.getElementById("ridersCsvFile")?.addEventListener("change",e=>{
    const f=e.target.files?.[0];if(!f||!started)return;
    (async()=>{
      try{
        const text=await f.text();
        const parsed=parseCsvText(text);
        if(!Array.isArray(parsed)||!parsed.length)throw Error("No rider rows found");
        ridersData=parsed;
        initRidersData();
        renderRiders();
        // The dashboard is fully initialized by the time a rider upload occurs.
        // Refresh town cards here, not during the initial renderRiders() call.
        if(typeof render==="function")render();
        const version=Date.now();
        await put(P.riders,new Blob([JSON.stringify(ridersData)],{type:"application/json"}),"application/json");
        await setState({settings_version:version});
        seen.settings=version;
        await announce("settings","riders");
        const hint=document.getElementById("ridersHint");
        if(hint)hint.textContent=`Loaded ${ridersData.length} riders from ${f.name}. Synced to all devices.`;
        status("Riders Data synced");
      }catch(err){
        console.error("Riders sync failed:",err);
        const hint=document.getElementById("ridersHint");
        if(hint)hint.textContent="Unable to sync the rider CSV. Local rider data was kept.";
        status("Riders sync error — data kept");
      }
    })();
  },true);

  document.getElementById("clearLinehaul")?.addEventListener("click",()=>{
    if(!started)return;
    setTimeout(()=>clearShared("linehaul").catch(err=>{console.error(err);status("Cloud clear failed: "+err.message)}),250);
  },true);

  // Town settings are synced as a shared file.
  if(typeof saveTownSettings==="function"&&!window.__badocSharedTownSyncV7){
    const original=saveTownSettings;window.__badocSharedTownSyncV7=true;
    saveTownSettings=function(){
      original.apply(this,arguments);
      if(!started)return;
      put(P.settings,new Blob([JSON.stringify(towns)],{type:"application/json"}),"application/json")
        .then(()=>setState({settings_version:Date.now()}))
        .then(s=>announce("settings","update"))
        .catch(e=>console.warn("Town settings sync:",e));
    };
  }

  // Sync the movable town layout and per-group notes to the same shared Cloud state.
  // These are separate files so the existing towns/settings format remains backward compatible.
  if(typeof saveTownLayouts==="function"&&!window.__badocSharedTownLayoutSyncV2){
    const originalLayoutSave=saveTownLayouts;
    window.__badocSharedTownLayoutSyncV2=true;
    let townLayoutSyncQueue=Promise.resolve();
    let townLayoutSyncRevision=0;
    const TOWN_LAYOUT_DIRTY_KEY="badoc_town_layout_dirty_v2";
    async function syncTownLayoutSnapshot(){
      // Wait briefly for cloud initialization if a town was moved during startup.
      const deadline=Date.now()+15000;
      while(!started&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
      if(!started)throw Error("Cloud sync is not ready; town layout remains saved locally and will retry.");
      const revision=townLayoutSyncRevision;
      const payload=JSON.stringify(loadTownLayouts()||{});
      await put(P.layout,new Blob([payload],{type:"application/json"}),"application/json");
      // Use a monotonically increasing version so device clock skew cannot make
      // a newer town layout look older to another device.
      const currentState=await state();
      const version=Math.max(Date.now(),Number(currentState?.layout_version||0)+1);
      await setState({layout_version:version});
      seen.layout=version;
      await announce("layout","update");
      if(revision===townLayoutSyncRevision){
        try{
          localStorage.removeItem(TOWN_LAYOUT_DIRTY_KEY);
          localStorage.removeItem("badoc_town_layout_dirty_at_v2");
        }catch{}
        status("Town layout synced to cloud");
      }else{
        // A newer move occurred during the upload; queue another authoritative snapshot.
        return syncTownLayoutSnapshot();
      }
      return true;
    }
    window.__badocSyncTownLayoutNow=async function(){
      townLayoutSyncQueue=townLayoutSyncQueue.catch(()=>{}).then(syncTownLayoutSnapshot);
      try{return await townLayoutSyncQueue}catch(e){
        console.error("Town layout sync failed; local layout preserved:",e);
        try{
          localStorage.setItem(TOWN_LAYOUT_DIRTY_KEY,"1");
          if(!localStorage.getItem("badoc_town_layout_dirty_at_v2"))localStorage.setItem("badoc_town_layout_dirty_at_v2",String(Date.now()));
        }catch{}
        status("Town layout sync failed: "+String(e?.message||e)+" — saved locally, retrying");
        return false;
      }
    };
    saveTownLayouts=function(layouts){
      originalLayoutSave.apply(this,arguments);
      townLayoutSyncRevision++;
      try{
        localStorage.setItem(TOWN_LAYOUT_DIRTY_KEY,"1");
        localStorage.setItem("badoc_town_layout_dirty_at_v2",String(Date.now()));
      }catch{}
      window.__badocSyncTownLayoutNow();
    };
    // Retry unsynced local town moves after the shared client starts and on later fallback polls.
    const previousStart=start;
    start=async function(){
      await previousStart.apply(this,arguments);
      try{if(localStorage.getItem(TOWN_LAYOUT_DIRTY_KEY)==="1")window.__badocSyncTownLayoutNow()}catch{}
    };
    // Keep pending town-layout edits moving to cloud after transient network or
    // startup failures. The dirty flag is cleared only after Storage upload,
    // shared-state version update, and broadcast all succeed.
    const retryPendingTownLayoutSync=()=>{
      try{
        if(started&&localStorage.getItem(TOWN_LAYOUT_DIRTY_KEY)==="1"){
          window.__badocSyncTownLayoutNow();
        }
      }catch(e){console.warn("Town layout retry scheduling failed:",e)}
    };
    __badocEvery(retryPendingTownLayoutSync,5000);
    window.addEventListener("online",retryPendingTownLayoutSync);
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible")retryPendingTownLayoutSync();
    });
  }
  if(typeof saveTownNotes==="function"&&!window.__badocSharedTownNotesSyncV2){
    const originalNotesSave=saveTownNotes;window.__badocSharedTownNotesSyncV2=true;
    window.__badocSyncTownNotesNow=async function(notes){
      if(!started)return false;
      const version=Date.now()+Math.floor(Math.random()*1000);
      const payload=JSON.stringify(notes||{});
      await put(P.riderSelections,new Blob([JSON.stringify({version,notes:notes||{}})],{type:"application/json"}),"application/json");
      try{localStorage.setItem("badoc_rider_selection_version_v1",String(version))}catch{}
      await put(P.notes,new Blob([payload],{type:"application/json"}),"application/json");
      await setState({notes_version:version});
      seen.notes=version;
      await announce("riderSelections","rider-selection");
      await announce("notes","rider-selection");
      status("Rider selection synced");
      return true;
    };
    saveTownNotes=function(notes){
      originalNotesSave.apply(this,arguments);
      if(!started)return;
      window.__badocSyncTownNotesNow(notes).catch(e=>console.warn("Town notes sync:",e));
    };
  }

  async function retryPendingUploadState(){
    if(!uploadLocalDirty)return false;
    try{
      const s=await state();
      const target=Number(uploadPendingVersion||0);
      // Legacy dirty markers may exist without their companion version key.
      // Once the cloud has a versioned authoritative state, release that stale
      // marker and let the normal pull apply either the live file or tombstone.
      if(!target&&Number(s?.upload_version||0)>0){
        uploadLocalDirty=false;
        try{localStorage.removeItem("badoc_upload_dirty_v1");localStorage.removeItem("badoc_upload_pending_version_v1")}catch{}
        return true;
      }
      if(!target)return false;
      // A newer/equal authoritative tombstone wins over an old pending upload.
      // Never turn upload_exists back on after another device cleared the file.
      if(Number(s?.upload_version||0)>=target && !s?.upload_exists){
        uploadLocalDirty=false; uploadPendingVersion=0;
        try{localStorage.removeItem("badoc_upload_dirty_v1");localStorage.removeItem("badoc_upload_pending_version_v1")}catch{}
        return false;
      }
      if(Number(s?.upload_version||0)>=target && s?.upload_exists){
        uploadLocalDirty=false;
        uploadPendingVersion=0;
        try{
          localStorage.removeItem("badoc_upload_dirty_v1");
          localStorage.removeItem("badoc_upload_pending_version_v1");
        }catch{}
        return true;
      }
      await setState({upload_exists:true,upload_version:target});
      uploadLocalDirty=false;
      uploadPendingVersion=0;
      try{
        localStorage.removeItem("badoc_upload_dirty_v1");
        localStorage.removeItem("badoc_upload_pending_version_v1");
      }catch{}
      await announce("upload","upload");
      status("Parcel Count synced");
      return true;
    }catch(e){
      status("Parcel Count sync error — data kept");
      return false;
    }
  }

  async function retryPendingLinehaulState(){
    if(!linehaulLocalDirty)return false;
    try{
      const s=await state();
      const target=Number(linehaulPendingVersion||0);
      if(!target&&Number(s?.linehaul_version||0)>0){
        linehaulLocalDirty=false;
        try{localStorage.removeItem("badoc_linehaul_dirty_v1");localStorage.removeItem("badoc_linehaul_pending_version_v1")}catch{}
        return true;
      }
      if(!target)return false;
      if(Number(s?.linehaul_version||0)>=target && s?.linehaul_exists){
        linehaulLocalDirty=false;
        linehaulPendingVersion=0;
        try{
          localStorage.removeItem("badoc_linehaul_dirty_v1");
          localStorage.removeItem("badoc_linehaul_pending_version_v1");
        }catch{}
        return true;
      }
      await setState({linehaul_exists:true,linehaul_version:target});
      linehaulLocalDirty=false;
      linehaulPendingVersion=0;
      try{
        localStorage.removeItem("badoc_linehaul_dirty_v1");
        localStorage.removeItem("badoc_linehaul_pending_version_v1");
      }catch{}
      await announce("linehaul","upload");
      status("Linehaul synced");
      return true;
    }catch(e){
      status("Linehaul sync error — data kept");
      return false;
    }
  }

  async function start(){
    if(started)return;started=true;
    try{
      supa();
      // Cloud is authoritative. Do not restore persisted uploads on startup.
      // Start empty, then populate only after the cloud state is checked.
      if(!uploadLocalDirty){batches=[];current=null;}
      // If a Linehaul upload was locally marked dirty, preserve it across a
      // temporary sync failure. Otherwise cloud state remains authoritative.
      if(!linehaulLocalDirty)linehaulTasks=[];
      render();renderLinehaul();
      ensureRealtime().catch(e=>console.warn(e));
      setTimeout(async()=>{await retryPendingUploadState();await retryPendingLinehaulState();await applyRiderSelections().catch(()=>{});await pull().catch(()=>{});},150);
      clearInterval(pollTimer);
      pollTimer=__badocEvery(async()=>{await retryPendingUploadState();await retryPendingLinehaulState();await applyRiderSelections().catch(()=>{});await pull().catch(()=>{});},30000);
    }catch(e){console.warn(e);status("Cloud sync unavailable")}
  }

  window.__badocSharedPullNow=async function(){await window.__badocSyncParcelIncomingPreference?.();await retryPendingUploadState();await retryPendingLinehaulState();await applyRiderSelections().catch(()=>{});await pull();};
  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>setTimeout(start,50),{once:true});
  else setTimeout(start,50);
})();
