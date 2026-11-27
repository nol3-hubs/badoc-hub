/*
  BADOC PICKUP CLOUD SYNC
  Stores First Mile Orders, Tasks, and the Pickup Point ID/name directory in
  shared Cloud Storage. Local browser storage remains the fast working cache.
  Shared state version fields and realtime broadcasts keep devices aligned.
*/
(function(){
  "use strict";
  if(window.__badocPickupCloudModule)return;
  window.__badocPickupCloudModule=true;

  const cfg=window.BADOC_SHARED_CONFIG||{};
  const BUCKET="exported-files";
  const TABLE="badoc_shared_state";
  const PATHS={
    orders:"current/pickup-orders.json",
    tasks:"current/pickup-tasks.json",
    names:"current/pickup-point-names.json"
  };
  const FIELDS={
    orders:"pickup_orders",
    tasks:"pickup_tasks",
    names:"pickup_names"
  };
  const LOCAL_KEYS={
    orders:"badoc_first_mile_orders_csv_local_v1",
    tasks:"badoc_first_mile_tasks_csv_local_v1",
    names:"badoc_first_mile_point_names_v1"
  };
  const DIRTY_KEYS={
    orders:"badoc_pickup_orders_cloud_dirty_v1",
    tasks:"badoc_pickup_tasks_cloud_dirty_v1",
    names:"badoc_pickup_names_cloud_dirty_v1"
  };
  const BASELINE_LOCAL_KEYS={
    orders:"badoc_first_mile_orders_baseline_v1",
    tasks:"badoc_first_mile_tasks_baseline_v1"
  };
  const baselineDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const baselinePath=(kind,date)=>"current/pickup-baselines/"+date+"-"+kind+".json";
  function readLocalBaseline(kind){
    try{const value=JSON.parse(localStorage.getItem(BASELINE_LOCAL_KEYS[kind])||"null");return value&&value.date?value:null;}catch(_){return null;}
  }
  function writeLocalBaseline(kind,value){
    try{localStorage.setItem(BASELINE_LOCAL_KEYS[kind],JSON.stringify(value));}catch(e){console.warn("Pickup baseline local cache:",e);}
  }
  async function readCloudBaseline(kind,date){
    const result=await storage().download(baselinePath(kind,date));
    if(result.error){
      if(/not found|404|object not found/i.test(result.error.message||""))return null;
      throw Error(result.error.message||"Pickup baseline cloud read failed.");
    }
    return JSON.parse(await result.data.text());
  }
  // Read-only historical lookup used by Copy for Sheet to identify orders
  // already canceled in the previous Philippine calendar day's baseline.
  window.__badocPickupCloudReadBaseline=async function(kind,date){
    if(!["orders","tasks"].includes(kind)||!date)return null;
    try{
      if(!started){
        const deadline=Date.now()+12000;
        while(!started&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!started)return null;
      return await readCloudBaseline(kind,date);
    }catch(error){
      console.warn("Pickup historical baseline read failed:",error);
      return null;
    }
  };
  async function saveCloudBaselineFirst(kind,record){
    const existing=await readCloudBaseline(kind,record.date);
    let next=record;
    let changed=false;
    if(existing){
      const merged={...(existing.byId||{})};
      Object.entries(record.byId||{}).forEach(([key,value])=>{
        if(!Object.prototype.hasOwnProperty.call(merged,key)){merged[key]=value;changed=true;}
      });
      if(!changed){writeLocalBaseline(kind,existing);return existing;}
      next={...existing,byId:merged,trackedCount:Object.keys(merged).length,updatedAt:Date.now()};
    }
    const blob=new Blob([JSON.stringify(next)],{type:"application/json"});
    const result=await storage().upload(baselinePath(kind,record.date),blob,{
      contentType:"application/json",upsert:!!existing,cacheControl:"0"
    });
    if(result.error){
      const winner=await readCloudBaseline(kind,record.date);
      if(winner){
        const missing=Object.entries(next.byId||{}).filter(([key])=>!winner.byId?.[key]);
        if(!missing.length){writeLocalBaseline(kind,winner);return winner;}
      }
      throw Error(result.error.message||"Pickup baseline cloud upload failed.");
    }
    writeLocalBaseline(kind,next);
    await announce("baseline-"+kind);
    return next;
  }
  async function syncPickupBaselines(){
    if(!started)return;
    const date=baselineDate();
    for(const kind of ["orders","tasks"]){
      const remote=await readCloudBaseline(kind,date);
      const local=readLocalBaseline(kind);
      if(remote){
        if(local&&local.date===date){
          const merged={...remote,byId:{...(remote.byId||{})}};
          let added=false;
          Object.entries(local.byId||{}).forEach(([key,value])=>{
            if(!Object.prototype.hasOwnProperty.call(merged.byId,key)){merged.byId[key]=value;added=true;}
          });
          if(added)await saveCloudBaselineFirst(kind,{...merged,trackedCount:Object.keys(merged.byId).length});
          else writeLocalBaseline(kind,remote);
        }else writeLocalBaseline(kind,remote);
        continue;
      }
      if(local&&local.date===date)await saveCloudBaselineFirst(kind,local);
    }
    window.__badocUpdatePickupBaselineStatus?.();
    window.__badocRenderFirstMileCombined?.();
  }
  let client=null,channel=null,started=false,pulling=false,refreshQueued=false;
  let pollTimer=null;
  const pending=new Set();
  const seen={orders:0,tasks:0,names:0};
  let retryQueue=Promise.resolve();

  function cloudClient(){
    if(client)return client;
    if(!window.BadocCloud||!cfg.url||!cfg.key)throw Error("Shared cloud configuration is unavailable.");
    client=window.BadocCloud.createClient(cfg.url,cfg.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }
  function storage(){return cloudClient().storage.from(BUCKET);}
  function status(message,tone){
    const el=document.getElementById("firstMileCloudSyncStatus");
    if(el){
      el.textContent=message;
      el.dataset.state=tone||"info";
    }
  }
  function ensureStatusElement(){
    let el=document.getElementById("firstMileCloudSyncStatus");
    if(el)return el;
    const meta=document.getElementById("firstMileCombinedMeta");
    if(!meta||!meta.parentNode)return null;
    el=document.createElement("div");
    el.id="firstMileCloudSyncStatus";
    el.style.cssText="margin-top:5px;font-size:11px;line-height:1.4;color:var(--muted,#94a3b8)";
    meta.insertAdjacentElement("afterend",el);
    return el;
  }
  function localRecord(kind){
    try{
      const raw=localStorage.getItem(LOCAL_KEYS[kind]);if(!raw)return null;
      const value=JSON.parse(raw);
      if(kind==="names")return value&&typeof value==="object"&&!Array.isArray(value)?value:null;
      return value&&typeof value.csvText==="string"&&value.csvText?value:null;
    }catch(e){return null;}
  }
  function pickupRowsToCsv(rows){
    const list=Array.isArray(rows)?rows:[];if(!list.length)return "";
    const headers=[...new Set(list.flatMap(row=>Object.keys(row||{})))];
    const cell=value=>{const t=String(value??"");return /[",\r\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t};
    return [headers.map(cell).join(","),...list.map(row=>headers.map(h=>cell(row?.[h])).join(","))].join("\r\n");
  }
  function pickupProcessedRecord(kind,record){
    if(kind==="names")return record&&typeof record==="object"&&!Array.isArray(record)?record:{};
    if(record?.schemaVersion===1&&Array.isArray(record.rows))return record;
    const rows=typeof parseCsvText==="function"?parseCsvText(String(record?.csvText||"")):[];
    if(!rows.length)throw Error("No processed Pickup "+kind+" records were found.");
    return {schemaVersion:1,recordType:"pickup-"+kind,rows,rowCount:rows.length,savedAt:Number(record?.savedAt||Date.now()),taskId:String(record?.taskId||"")};
  }
  function pickupLocalRecordFromCloud(kind,record){
    if(kind==="names")return record;
    if(record&&typeof record.csvText==="string")return record;
    if(!record||record.schemaVersion!==1||!Array.isArray(record.rows))throw Error("Shared Pickup "+kind+" data is not a processed-record snapshot.");
    return {csvText:pickupRowsToCsv(record.rows),fileName:"shared_pickup_"+kind+".csv",taskId:record.taskId||"",savedAt:Number(record.savedAt||Date.now()),rowCount:Number(record.rowCount||record.rows.length)};
  }
  async function readState(){
    const r=await cloudClient().from(TABLE).select("*").eq("id",1).maybeSingle();
    if(r.error)throw Error(r.error.message||"Pickup shared state read failed.");
    return r.data||null;
  }
  async function writeState(patch){
    const c=cloudClient();
    const clean={...(patch||{}),updated_at:new Date().toISOString(),updated_by:"pickup-cloud"};
    let r=await c.from(TABLE).update(clean).eq("id",1).select().maybeSingle();
    if(r.error)throw Error(r.error.message||"Pickup shared state update failed.");
    if(r.data)return r.data;
    const existing=await readState();
    const base={
      id:1,upload_exists:false,upload_version:0,linehaul_exists:false,linehaul_version:0,
      settings_version:0,layout_version:0,notes_version:0
    };
    r=await c.from(TABLE).upsert({...base,...(existing||{}),...clean},{onConflict:"id"}).select().single();
    if(r.error)throw Error(r.error.message||"Pickup shared state create failed.");
    return r.data;
  }
  async function announce(action){
    try{
      if(!channel)await ensureRealtime();
      if(channel)await channel.send({
        type:"broadcast",event:"badoc-pickup-sync",
        payload:{action,at:Date.now()}
      });
    }catch(e){console.warn("Pickup cloud broadcast:",e)}
  }
  async function ensureRealtime(){
    if(channel)return;
    const c=cloudClient();
    channel=c.channel("badoc-pickup-cloud-v1");
    channel.on("broadcast",{event:"badoc-pickup-sync"},()=>refresh().catch(e=>console.warn("Pickup cloud realtime pull:",e)));
    channel.on("postgres_changes",{event:"UPDATE",schema:"public",table:TABLE,filter:"id=eq.1"},()=>refresh().catch(e=>console.warn("Pickup cloud state pull:",e)));
    channel.subscribe(state=>{
      if(state==="SUBSCRIBED")status("Pickup cloud connected · syncing shared Orders and Tasks","ok");
      else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT")status("Pickup cloud reconnecting · local data is safe","pending");
    });
  }
  function updateLocalRecord(kind,record){
    try{
      if(kind==="names"){
        if(typeof window.__badocApplyPickupPointNameMap==="function")window.__badocApplyPickupPointNameMap(record||{});
        else localStorage.setItem(LOCAL_KEYS.names,JSON.stringify(record||{}));
        return;
      }
      localStorage.setItem(LOCAL_KEYS[kind],JSON.stringify(record));
      window.__badocUpdateFirstMileLastUpdated?.();
      const orders=kind==="orders";
      const prefix=orders?"firstMileOrders":"firstMileTasks";
      const rows=Number(record?.rowCount||0);
      const savedAt=Number(record?.savedAt||Date.now());
      const taskId=record?.taskId||"—";
      const statusEl=document.getElementById(prefix+"Status");
      const resultEl=document.getElementById(prefix+"Result");
      const downloadEl=document.getElementById(orders?"downloadFirstMileOrders":"downloadFirstMileTasks");
      if(statusEl)statusEl.textContent="Cloud synced · "+rows.toLocaleString()+" rows · "+new Date(savedAt).toLocaleString("en-PH");
      if(resultEl)resultEl.textContent=rows.toLocaleString()+" rows · Shared across devices · SPX task "+taskId;
      if(downloadEl)downloadEl.disabled=false;
      try{window.__badocRenderFirstMileCombined?.();}catch(e){}
    }catch(e){console.warn("Pickup local cache update:",e)}
  }
  function clearLocalKind(kind){
    try{localStorage.removeItem(LOCAL_KEYS[kind])}catch(e){}
    if(kind!=="names")window.__badocUpdateFirstMileLastUpdated?.();
    if(kind==="names"){
      if(typeof window.__badocApplyPickupPointNameMap==="function")window.__badocApplyPickupPointNameMap({});
      else try{localStorage.removeItem(LOCAL_KEYS.names)}catch(e){}
    }else{
      const prefix=kind==="orders"?"firstMileOrders":"firstMileTasks";
      const statusEl=document.getElementById(prefix+"Status");
      const resultEl=document.getElementById(prefix+"Result");
      const downloadEl=document.getElementById(kind==="orders"?"downloadFirstMileOrders":"downloadFirstMileTasks");
      if(statusEl)statusEl.textContent="Not synced yet";
      if(resultEl)resultEl.textContent="No export stored on this device.";
      if(downloadEl)downloadEl.disabled=true;
      try{window.__badocRenderFirstMileCombined?.();}catch(e){}
    }
  }
  const uploadQueues={orders:Promise.resolve(),tasks:Promise.resolve(),names:Promise.resolve()};
  function upload(kind,record){
    if(!uploadQueues[kind])uploadQueues[kind]=Promise.resolve();
    const run=()=>uploadNow(kind,record);
    const next=uploadQueues[kind].catch(()=>{}).then(run);
    uploadQueues[kind]=next.catch(()=>{});
    return next;
  }
  async function uploadNow(kind,record){
    const field=FIELDS[kind],path=PATHS[kind],version=Date.now();
    if(!started)throw Error("Pickup cloud is still connecting.");
    pending.add(kind);
    try{
      // Queued sync/retry calls may run after a newer export has arrived.
      // Always publish the newest local snapshot, not a stale queued argument.
      const local=localRecord(kind)||record;
      if(!local)throw Error("No locally saved Pickup "+kind+" data to upload.");
      const payload=pickupProcessedRecord(kind,local);
      const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
      const up=await storage().upload(path,blob,{contentType:"application/json",upsert:true,cacheControl:"0"});
      if(up.error)throw Error(up.error.message||"Pickup cloud file upload failed.");
      const cloudState=await writeState({[field+"_exists"]:true,[field+"_version"]:version});
      if(kind!=="names"){
        window.__badocFirstMileCloudVersions=window.__badocFirstMileCloudVersions||{orders:0,tasks:0};
        window.__badocFirstMileCloudVersions[kind]=version;
        window.__badocUpdateFirstMileLastUpdated?.();
      }
      seen[kind]=version;
      try{localStorage.removeItem(DIRTY_KEYS[kind])}catch(e){}
      await announce("upload-"+kind);
      if(kind!=="names")updateLocalRecord(kind,local);
      status("Pickup Orders and Tasks synced to shared cloud","ok");
      return true;
    }catch(e){
      try{localStorage.setItem(DIRTY_KEYS[kind],"1")}catch(_){}
      status("Pickup cloud upload pending · local data kept; retrying","pending");
      console.warn("Pickup "+kind+" cloud upload failed:",e);
      return false;
    }finally{pending.delete(kind)}
  }
  async function download(kind){
    const r=await storage().download(PATHS[kind]);
    if(r.error){
      if(/not found|404|object not found/i.test(r.error.message||""))return null;
      throw Error(r.error.message||"Pickup cloud download failed.");
    }
    return JSON.parse(await r.data.text());
  }
  function sameCloudKindState(a,b,kind){
    const field=FIELDS[kind];
    return (a?.[field+"_exists"]===true)===(b?.[field+"_exists"]===true) &&
      Number(a?.[field+"_version"]||0)===Number(b?.[field+"_version"]||0);
  }
  async function applyCloud(kind,state){
    const field=FIELDS[kind];
    // Never apply a state snapshot captured before the latest upload completed.
    // Re-read the authoritative row immediately before touching local storage.
    if(pending.has(kind)||localStorage.getItem(DIRTY_KEYS[kind])==="1")return;
    const fresh=await readState();
    if(!fresh||!hasCloudField(fresh,kind))return;
    if(pending.has(kind)||localStorage.getItem(DIRTY_KEYS[kind])==="1")return;
    if(!sameCloudKindState(state,fresh,kind)){
      // The state changed while this refresh was in flight. A later refresh
      // will use the newest version; do not apply the old snapshot.
      refreshQueued=true;
      return;
    }
    const version=Number(fresh[field+"_version"]||0);
    if(fresh[field+"_exists"]!==true){
      clearLocalKind(kind);
      seen[kind]=version;
      return;
    }
    const record=await download(kind);
    // Downloads may take seconds. Re-check both the cloud version and local
    // dirty marker before applying so an older download cannot erase a newer
    // SPX export that arrived while the download was in progress.
    const afterDownload=await readState();
    if(!afterDownload||!sameCloudKindState(fresh,afterDownload,kind))return;
    if(pending.has(kind)||localStorage.getItem(DIRTY_KEYS[kind])==="1")return;
    if(!record)throw Error("Shared Pickup "+kind+" file is missing from cloud storage.");
    if(kind==="names"){
      if(record&&typeof record==="object"&&!Array.isArray(record)){
        updateLocalRecord(kind,record);
        seen[kind]=version;
      }
      return;
    }
    const localSnapshot=pickupLocalRecordFromCloud(kind,record);
    updateLocalRecord(kind,localSnapshot);
    if(kind!=="names"&&typeof record?.csvText==="string"){
      const migrated=await upload(kind,localSnapshot);
      if(migrated){
        const migratedState=await readState();
        seen[kind]=Number(migratedState?.[field+"_version"]||version);
        return;
      }
    }
    seen[kind]=version;
  }
  function hasCloudField(state,kind){
    const field=FIELDS[kind];
    return Object.prototype.hasOwnProperty.call(state,field+"_exists")||
      Object.prototype.hasOwnProperty.call(state,field+"_version");
  }
  async function seedLocalIfNeeded(state,kind){
    if(hasCloudField(state,kind))return false;
    const local=localRecord(kind);
    if(!local)return false;
    try{localStorage.setItem(DIRTY_KEYS[kind],"1")}catch(e){}
    return await upload(kind,local);
  }
  async function refresh(){
    if(pulling){refreshQueued=true;return;}
    pulling=true;
    try{
      const state=await readState();
      if(!state)return; // Connection state is owned by the realtime subscription indicator.
      window.__badocFirstMileCloudVersions=window.__badocFirstMileCloudVersions||{orders:0,tasks:0};
      window.__badocFirstMileCloudVersions.orders=Number(state.pickup_orders_version||0);
      window.__badocFirstMileCloudVersions.tasks=Number(state.pickup_tasks_version||0);
      window.__badocUpdateFirstMileLastUpdated?.();
      for(const kind of ["orders","tasks","names"]){
        if(!hasCloudField(state,kind)){
          await seedLocalIfNeeded(state,kind);
          continue;
        }
        const version=Number(state[FIELDS[kind]+"_version"]||0);
        const dirty=localStorage.getItem(DIRTY_KEYS[kind])==="1";
        if(dirty||pending.has(kind))continue;
        if(version!==seen[kind])await applyCloud(kind,state);
      }
      // Keep successful background pulls silent. The realtime subscription owns
      // the connection indicator; upload results remain in their dedicated UI.
    }catch(e){
      status("Pickup cloud reconnecting · "+String(e?.message||e),"pending");
      console.warn("Pickup cloud refresh failed:",e);
    }finally{
      pulling=false;
      if(refreshQueued){
        refreshQueued=false;
        Promise.resolve().then(()=>refresh());
      }
    }
  }
  async function retryDirty(){
    for(const kind of ["orders","tasks","names"]){
      if(localStorage.getItem(DIRTY_KEYS[kind])!=="1"||pending.has(kind))continue;
      const record=localRecord(kind);
      if(record)await upload(kind,record);
    }
  }
  async function clearShared(options={}){
    if(!started)throw Error("Pickup cloud is not ready; cannot clear shared Pickup data.");
    const kinds=options.includePickupNames?["orders","tasks","names"]:["orders","tasks"];
    const patch={};
    const version=Date.now();
    for(const kind of kinds){
      pending.add(kind);
      const removed=await storage().remove([PATHS[kind]]);
      if(removed.error)throw Error(removed.error.message||"Pickup cloud delete failed.");
      patch[FIELDS[kind]+"_exists"]=false;
      patch[FIELDS[kind]+"_version"]=version+({orders:0,tasks:1,names:2}[kind]);
      try{localStorage.removeItem(DIRTY_KEYS[kind])}catch(e){}
    }
    await writeState(patch);
    kinds.forEach(kind=>{seen[kind]=Number(patch[FIELDS[kind]+"_version"]||version);clearLocalKind(kind)});
    await announce("clear");
    status("Pickup exports cleared from shared cloud","ok");
    return true;
  }

  window.__badocPickupCloudSaveBaseline=async function(kind,record){
    if(!["orders","tasks"].includes(kind)||!record?.date)return {ok:false,record:null};
    writeLocalBaseline(kind,record);
    try{
      if(!started){
        const deadline=Date.now()+12000;
        while(!started&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!started)return {ok:false,record};
      const saved=await saveCloudBaselineFirst(kind,record);
      return {ok:true,record:saved};
    }catch(error){
      console.warn("Pickup baseline cloud save pending:",error);
      status("First-sync baseline saved locally · cloud copy pending","pending");
      return {ok:false,record};
    }
  };

  window.__badocPickupCloudSave=async function(kind,record){
    if(!["orders","tasks"].includes(kind))return {ok:false,message:"Unknown Pickup dataset."};
    try{
      localStorage.setItem(DIRTY_KEYS[kind],"1");
      if(!started){
        const deadline=Date.now()+15000;
        while(!started&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!started)throw Error("Pickup cloud did not finish connecting.");
      const ok=await upload(kind,record);
      return {ok,message:ok?"Synced to shared cloud":"Saved locally; cloud retry is pending."};
    }catch(e){
      try{localStorage.setItem(DIRTY_KEYS[kind],"1")}catch(_){}
      status("Pickup saved locally · cloud upload will retry","pending");
      return {ok:false,message:String(e?.message||e)};
    }
  };
  window.__badocPickupCloudSavePointNames=async function(map){
    try{
      const snapshot=map&&typeof map==="object"&&!Array.isArray(map)?map:{};
      localStorage.setItem(LOCAL_KEYS.names,JSON.stringify(snapshot));
      localStorage.setItem(DIRTY_KEYS.names,"1");
      if(!started)return false;
      return await upload("names",snapshot);
    }catch(e){
      try{localStorage.setItem(DIRTY_KEYS.names,"1")}catch(_){}
      console.warn("Pickup point-name cloud save failed:",e);
      return false;
    }
  };
  window.__badocClearSharedPickupData=clearShared;

  // Wrap the existing dashboard-wide clear. The regular 12:00 AM reset clears
  // Pickup Orders/Tasks on every device but retains the reference name directory.
  // Settings > Clear all data opts into clearing that directory too.
  const oldClearAll=window.__badocClearAllSharedData;
  if(typeof oldClearAll==="function"&&!window.__badocPickupClearWrapped){
    window.__badocPickupClearWrapped=true;
    window.__badocClearAllSharedData=async function(options={}){
      await oldClearAll.apply(this,arguments);
      await clearShared({includePickupNames:options?.includePickupNames===true});
      return true;
    };
  }

  async function start(){
    if(started)return;
    try{
      cloudClient();
      started=true;
      ensureStatusElement();
      status("Pickup cloud connecting…","pending");
      await ensureRealtime();
      await syncPickupBaselines();
      await refresh();
      await retryDirty();
      if(pollTimer)clearInterval(pollTimer);
      pollTimer=__badocEvery(async()=>{await retryDirty();await refresh()},30000);
      window.addEventListener("online",()=>{retryDirty();refresh()});
      document.addEventListener("visibilitychange",()=>{if(!document.hidden){retryDirty();refresh()}});
    }catch(e){
      status("Pickup cloud unavailable · saved locally; reconnect to retry","pending");
      console.warn("Pickup cloud startup:",e);
    }
  }
  window.__badocPickupCloudRefresh=refresh;
  window.__badocPickupCloudStart=start;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,100),{once:true});
  else setTimeout(start,100);
})();
