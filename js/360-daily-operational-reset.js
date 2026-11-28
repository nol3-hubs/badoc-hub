/*
  BADOC daily operational reset
  - Uploaded Parcel + Linehaul working data: resets at 12:00 AM Asia/Manila.
  - CFR1 cloud ledger: resets at 12:00 AM after Daily History is captured.
  - One device performs the shared reset; every other device clears only its
    own local working copy after it sees the verified shared completion marker.

  Safety rules:
  - Cloud read/lock/write errors fail closed; they never authorize a reset.
  - The shared completion marker is written and verified before local cleanup.
  - A device records its local marker only after its own local cleanup succeeds.
*/
(function(){
  "use strict";
  const RESET_MARKER_PATH="current/.badoc-daily-reset.json";
  const RESET_MARKER_LOCAL="badoc_daily_reset_marker_v1";
  const RESET_LOCK_TTL_MS=15*60*1000;
  const RESET_LOCK_RENEW_MS=60*1000;
  let busy=false;

  function setResetStatus(state,extra){
    try{localStorage.setItem("badoc_reset_status",JSON.stringify(Object.assign({date:dayKey(),state:state,at:Date.now()},extra||{})))}catch(e){}
  }
  function resetOwner(){
    try{return window.__badocDeviceId||(window.__badocDeviceId="d"+Math.random().toString(36).slice(2,10))}catch(e){return "d0"}
  }
  function dayKey(d=__badocTime.manilaDate()){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function localResetDate(){
    try{return localStorage.getItem(RESET_MARKER_LOCAL)||""}catch(e){return ""}
  }
  function rememberLocalReset(today){
    window.__badocDailyResetLocalDone=today;
    try{localStorage.setItem(RESET_MARKER_LOCAL,today);return true}
    catch(e){console.warn("Daily reset completed locally, but its local marker could not be saved:",e);return false}
  }

  function cloudClient(){
    const cfg=window.BADOC_SHARED_CONFIG;
    if(!cfg||!cfg.url||!cfg.key||!window.BadocCloud)throw Error("Shared cloud configuration is unavailable; daily reset was not started");
    return window.BadocCloud.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  }
  async function ensureCloudReady(){
    if(!window.BadocCloud||typeof window.BadocCloud.ready!=="function")throw Error("Shared cloud lock service is unavailable; daily reset was not started");
    await window.BadocCloud.ready();
  }
  async function getCloudResetDate(client){
    const r=await client.storage.from("exported-files").download(RESET_MARKER_PATH);
    if(r.error){
      if(String(r.error.code||"")==="404"||/not found|object not found/i.test(String(r.error.message||"")))return null;
      throw Error("Could not read shared daily reset marker: "+String(r.error.message||"cloud read failed"));
    }
    if(!r.data)throw Error("Shared daily reset marker returned no data");
    let marker;
    try{marker=JSON.parse(await r.data.text())}catch(e){throw Error("Shared daily reset marker is invalid JSON")}
    const date=String(marker?.date||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Shared daily reset marker has no valid Manila date");
    return date;
  }
  async function markCloudReset(client,today){
    const blob=new Blob([JSON.stringify({date:today,timezone:"Asia/Manila",completedAt:new Date().toISOString()})],{type:"application/json"});
    const result=await client.storage.from("exported-files").upload(RESET_MARKER_PATH,blob,{contentType:"application/json",upsert:true,cacheControl:"0"});
    if(result.error)throw Error(result.error.message||"Daily reset marker upload failed");
    const verified=await getCloudResetDate(client);
    if(verified!==today)throw Error("Shared daily reset marker verification failed");
  }

  // First Mile Pickup exports are separate from the main parcel database.
  function clearLocalPickupData(){
    const keys=[
      "badoc_first_mile_orders_csv_local_v1",
      "badoc_first_mile_tasks_csv_local_v1",
      "badoc_first_mile_orders_baseline_v1",
      "badoc_first_mile_tasks_baseline_v1"
    ];
    keys.forEach(key=>{try{localStorage.removeItem(key)}catch(e){}});
    window.__badocUpdateFirstMileLastUpdated?.();
    [
      ["firstMileOrdersStatus","Not synced yet"],
      ["firstMileOrdersResult","No export stored on this device."],
      ["firstMileTasksStatus","Not synced yet"],
      ["firstMileTasksResult","No export stored on this device."]
    ].forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value;});
    ["downloadFirstMileOrders","downloadFirstMileTasks"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});
    const search=document.getElementById("firstMileCombinedSearch");if(search)search.value="";
    const status=document.getElementById("firstMileTaskStatusFilter");if(status)status.value="all";
    const overall=document.getElementById("firstMileOverallStatus");if(overall)overall.textContent="Ready to sync. Orders will run before Tasks.";
    try{window.__badocRenderFirstMileCombined?.()}catch(e){console.warn("Pickup reset render:",e)}
    return true;
  }
  window.__badocClearLocalPickupData=clearLocalPickupData;

  async function clearLocalExemptions({syncCloud=true}={}){
    if(typeof exceptionTrackingNumbers!=="undefined")exceptionTrackingNumbers=[];
    try{
      if(typeof saveExceptionTrackingNumbers==="function")saveExceptionTrackingNumbers();
      else localStorage.setItem("badoc_exception_tracking_numbers_v1","[]");
    }catch(e){throw Error("Could not clear local exemptions: "+String(e?.message||e))}
    if(typeof renderExceptionTracking==="function")renderExceptionTracking();
    if(typeof syncExemptionsToReceivedChecking==="function")syncExemptionsToReceivedChecking();
    if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
    if(typeof updateRecordExportButton==="function")updateRecordExportButton();
    if(syncCloud){
      if(typeof cloudExceptionWrite!=="function")throw Error("Exemption cloud writer is unavailable; reset cannot be committed");
      await cloudExceptionWrite("clear","");
    }
    return true;
  }

  async function clearLocalWorkingData({syncCloudExemptions=true}={}){
    if(typeof openDB==="function"){
      const db=await openDB();
      if(window.indexedDB&&!db)throw Error("IndexedDB could not be opened; local parcel data was not cleared");
      if(db)await new Promise((resolve,reject)=>{
        let tx;
        try{tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).clear()}
        catch(e){reject(e);return}
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error("IndexedDB clear failed"));
        tx.onabort=()=>reject(tx.error||new Error("IndexedDB clear was aborted"));
      });
    }
    if(typeof batches!=="undefined")batches=[];
    if(typeof current!=="undefined")current=null;
    if(typeof linehaulTasks!=="undefined")linehaulTasks=[];
    clearLocalPickupData();
    ["batches","currentBatch","current",
     "badoc_linehaul_tasks_town_v1","badoc_linehaul_packed_rows_v1",
     "badoc_linehaul_blank_packed_rows_v1","badoc_linehaul_export_total_v1",
     "badoc_linehaul_export_unique_v1"].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
    await clearLocalExemptions({syncCloud:syncCloudExemptions});
    const lf=document.getElementById("linehaulCsvFile");if(lf)lf.value="";
    if(typeof renderLinehaul==="function")renderLinehaul();
    if(typeof renderLinehaulKpis==="function")renderLinehaulKpis();
    if(typeof render==="function")render();
    return true;
  }

  async function finishLocalDeviceReset(today,now){
    // The first device has already captured Daily History and cleared shared
    // cloud state. Recover a missing history snapshot before removing stale
    // local rows, but never issue another cloud-wide clear from this device.
    const operationalDate=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12));
    if(typeof window.__badocLoadDailyHistorySnapshot!=="function")throw Error("Daily History recovery reader is unavailable; local reset was stopped");
    const existing=await window.__badocLoadDailyHistorySnapshot(operationalDate);
    if(!existing){
      if(typeof window.__badocCaptureDailyHistory!=="function"||!Array.isArray(current?.valid)){
        throw Error("Daily History snapshot is missing and cannot be recovered; local data was preserved");
      }
      await window.__badocCaptureDailyHistory("pre-reset-recovery",operationalDate);
    }
    const verified=await window.__badocLoadDailyHistorySnapshot(operationalDate);
    if(!verified||String(verified.date||"")!==operationalDate)throw Error("Daily History recovery could not be verified; local data was preserved");

    if(typeof window.__badocLoadCfrSummary!=="function")throw Error("CFR summary recovery reader is unavailable; local reset was stopped");
    let cfrSummary=await window.__badocLoadCfrSummary(operationalDate);
    if(!cfrSummary){
      if(typeof window.__badocCaptureCfrSummary!=="function"||typeof current==="undefined"||!current||!Array.isArray(current.valid)){
        throw Error("CFR summary is missing and current parcel data is unavailable for recovery; local data was preserved");
      }
      await window.__badocCaptureCfrSummary(operationalDate);
      cfrSummary=await window.__badocLoadCfrSummary(operationalDate);
    }
    if(!cfrSummary||String(cfrSummary.date||"")!==operationalDate)throw Error("CFR summary recovery could not be verified; local data was preserved");

    // If the first reset device stopped after writing the shared reset marker
    // but before completing its fenced CFR1 reset, recover only after its lease
    // is released or expires. Never bypass an active reset owner.
    if(typeof window.BadocCloud?.recoverCfr1Reset==="function"){
      const recoveryDeadline=Date.now()+RESET_LOCK_TTL_MS+5000;
      let recovered=false;
      while(Date.now()<recoveryDeadline){
        recovered=await window.BadocCloud.recoverCfr1Reset();
        if(recovered)break;
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      if(!recovered)throw Error("CFR1 reset is still owned by another device; local reset was stopped safely");
    }

    window.__badocCfr1LedgerMemory=null;
    await clearLocalWorkingData({syncCloudExemptions:false});
    if(typeof syncExceptionsFromCloud!=="function")throw Error("Exemption cloud reader is unavailable after shared reset");
    await syncExceptionsFromCloud({silent:true});
    const persisted=rememberLocalReset(today);
    setResetStatus("already-done");
    if(persisted){try{window.location.reload()}catch(e){}}
    return true;
  }

  async function resetAtMidnight(force){
    if(busy)return;
    const now=__badocTime.manilaDate(),today=dayKey(now);
    busy=true;
    let lockClaimed=false,leaseLost=false,leaseTimer=null,renewing=false;
    const owner=resetOwner();
    const assertLease=()=>{if(leaseLost)throw Error("Daily reset lock lease was lost; stopping before the next destructive step")};
    const lockName="daily-reset-"+today;
    try{
      const localMarker=localResetDate();
      if(!force&&(localMarker===today||window.__badocDailyResetLocalDone===today)){
        setResetStatus("already-done");
        return;
      }

      await ensureCloudReady();
      const client=cloudClient();
      let cloudMarker=await getCloudResetDate(client);
      if(!force&&cloudMarker===today){
        await finishLocalDeviceReset(today,now);
        return;
      }

      // A cloud lock is mandatory. Lock read/write failures must never fall
      // through to a multi-device destructive reset.
      if(typeof window.BadocCloud.claim!=="function")throw Error("Atomic daily reset lock is unavailable");
      const won=await window.BadocCloud.claim(lockName,owner,RESET_LOCK_TTL_MS);
      if(!won){
        console.warn("12:00 AM reset: another device owns the reset lock.");
        setResetStatus("other-device");
        return;
      }
      lockClaimed=true;
      leaseTimer=setInterval(async()=>{
        if(renewing||leaseLost)return;
        renewing=true;
        try{const renewed=await window.BadocCloud.claim(lockName,owner,RESET_LOCK_TTL_MS);if(!renewed)leaseLost=true}
        catch(e){leaseLost=true;console.warn("Daily reset lock renewal failed:",e)}
        finally{renewing=false}
      },RESET_LOCK_RENEW_MS);

      // Re-read the marker after acquiring the lock. Another device may have
      // completed the reset between our first marker read and lock acquisition.
      cloudMarker=await getCloudResetDate(client);
      if(!force&&cloudMarker===today){
        await finishLocalDeviceReset(today,now);
        return;
      }

      assertLease();
      setResetStatus("running");
      if(typeof window.__badocCaptureDailyHistory!=="function")throw Error("Daily History capture is unavailable; reset was stopped before clearing data");
      const operationalDate=dayKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12));
      try{await window.__badocCaptureDailyHistory("pre-reset",operationalDate)}
      catch(e){throw Error("Daily History pre-reset capture failed: "+String(e?.message||e))}
      if(typeof window.__badocCaptureCfrSummary!=="function")throw Error("CFR summary capture is unavailable; reset was stopped before clearing data");
      try{await window.__badocCaptureCfrSummary(operationalDate)}
      catch(e){throw Error("CFR summary pre-reset capture failed: "+String(e?.message||e))}
      assertLease();

      // Clear authoritative shared uploads and linehaul first.
      assertLease();
      if(typeof window.__badocClearAllSharedData==="function"){
        await window.__badocClearAllSharedData();
      }else{
        const bucket=client.storage.from("exported-files");
        const removed=await bucket.remove([
          "current/uploaded.csv","current/linehaul.csv",
          "current/pickup-orders.json","current/pickup-tasks.json"
        ]);
        if(removed.error)throw Error(removed.error.message||"Shared parcel/linehaul clear failed");
        const state=await client.from("badoc_shared_state").select("*").eq("id",1).maybeSingle();
        if(state.error)throw Error(state.error.message||"Shared state read failed");
        const old=state.data||{};
        const resetVersion=Date.now();
        const patch={id:1,upload_exists:false,upload_version:resetVersion,linehaul_exists:false,linehaul_version:resetVersion,
          pickup_orders_exists:false,pickup_orders_version:resetVersion,
          pickup_tasks_exists:false,pickup_tasks_version:resetVersion,
          settings_version:Number(old.settings_version||0),updated_at:new Date().toISOString()};
        const up=await client.from("badoc_shared_state").upsert(patch,{onConflict:"id"});
        if(up.error)throw Error(up.error.message||"Shared state reset failed");
      }

      assertLease();
      if(!window.__badocCfr1CloudSync||typeof window.__badocCfr1CloudSync.resetCloud!=="function"){
        throw Error("CFR1 cloud reset service is unavailable");
      }
      // Keep the CFR1 writer lease held through the reset marker and local
      // cleanup. This prevents another open device from publishing its stale
      // same-day ledger in the gap immediately after the cloud ledger is deleted.
      await window.__badocCfr1CloudSync.resetCloud(async()=>{
        assertLease();
        window.__badocCfr1LedgerMemory=null;
        // Clear shared exemptions before publishing completion. Local cleanup
        // below does not perform a second shared write.
        await clearLocalExemptions({syncCloud:true});
        assertLease();
        const stillOwnsLock=await window.BadocCloud.claim(lockName,owner,RESET_LOCK_TTL_MS);
        if(!stillOwnsLock){leaseLost=true;assertLease()}
        // Commit and verify the shared marker BEFORE local cleanup. If local
        // cleanup is interrupted, peers can resume local cleanup without
        // clearing shared cloud state again.
        await markCloudReset(client,today);
        assertLease();
        await clearLocalWorkingData({syncCloudExemptions:false});
      });
      const persisted=rememberLocalReset(today);
      console.log("BADOC 12:00 AM daily upload/linehaul/exemption/CFR1 reset completed for",today);
      setResetStatus("done");
      if(persisted){try{window.location.reload()}catch(e){}}
    }catch(e){
      console.warn("BADOC 12:00 AM daily reset failed; will retry safely:",e);
      setResetStatus("failed",{reason:String(e&&e.message||e)});
    }finally{
      if(leaseTimer)clearInterval(leaseTimer);
      if(lockClaimed&&window.BadocCloud&&typeof window.BadocCloud.release==="function"){
        try{await window.BadocCloud.release(lockName,owner)}catch(e){console.warn("Daily reset lock release failed:",e)}
      }
      busy=false;
    }
  }

  window.__badocRunDailyReset=function(){return resetAtMidnight(false)};
  function tick(){
    if(window.__BADOC_GITHUB_AUTOMATION_HOLD_RESET===true)return;
    resetAtMidnight(false);
  }
  // Check on startup and every 30 seconds. Midnight is based on Manila time.
  setTimeout(tick,1500);
  __badocEvery(tick,30000);
})();
