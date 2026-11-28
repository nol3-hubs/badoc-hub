/* CFR1 daily ledger sync. The authoritative ledger and fenced lease live in
   one Firebase Realtime Database transaction node. The old Storage object is
   read-only migration input for pre-fence deployments. */
(function(){
  const KEY="badoc_cfr1_ledger_v5_cagayan_lh_total";
  const PATH="current/cfr1-ledger.json";
  let client=null, busy=false, lastCloudStamp="";
  // The writer token is deliberately per page instance, not a shared device ID.
  // Two open tabs on one workstation must not be mistaken for the same lock owner.
  const WRITE_LOCK_TTL=300000;
  const WRITE_LOCK_RENEW=30000;
  const RESET_LOCK_WAIT_MS=150000;
  const writeOwner="cfr1-tab-"+(window.crypto&&typeof window.crypto.randomUUID==="function"?window.crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,14));
  // Remember the last local ledger snapshot successfully published. CFR1 is
  // recalculated often, so skip cloud reads/writes when its data did not change.
  let lastPublishedSourceSignature="";
  function sourceSignature(ledger){
    try{
      const snapshot={...(ledger||{})};
      // The server timestamp changes on every successful upload and is not a
      // change to the local CFR1 data itself.
      delete snapshot._cloudUpdatedAt;
      return JSON.stringify(snapshot);
    }catch(_){return ""}
  }
  // A same-day CFR1 ledger is already an eligibility snapshot. Do not re-filter
  // its members by receivedMs: Rule A permits prior-date received timestamps
  // and Rule B deliberately has no received timestamp. Union membership by key
  // and retain the freeze if either copy has already frozen.
  function mergeSameDayLedgers(cloud,local){
    const cloudRecords=cloud?.records&&typeof cloud.records==="object"?cloud.records:{};
    const localRecords=local?.records&&typeof local.records==="object"?local.records:{};
    const records={...cloudRecords};
    Object.entries(localRecords).forEach(([key,localRec])=>{
      const cloudRec=records[key];
      if(!cloudRec){records[key]=localRec;return;}
      const localTime=Number(localRec?.latestBatchTime||localRec?.latestRowTime||0);
      const cloudTime=Number(cloudRec?.latestBatchTime||cloudRec?.latestRowTime||0);
      records[key]=localTime>=cloudTime?{...cloudRec,...localRec}:{...localRec,...cloudRec};
    });
    const frozen=cloud?.frozen===true||local?.frozen===true;
    const cloudFrozenAt=Number(cloud?.frozenAt||0),localFrozenAt=Number(local?.frozenAt||0);
    const frozenAt=cloudFrozenAt&&localFrozenAt?Math.min(cloudFrozenAt,localFrozenAt):(cloudFrozenAt||localFrozenAt||0);
    return {
      ...cloud,
      ...local,
      date:String(local?.date||cloud?.date||""),
      cutoff:Number(local?.cutoff||cloud?.cutoff||0),
      records,
      frozen,
      ...(frozenAt?{frozenAt}:{}),
      _cloudUpdatedAt:Number(cloud?._cloudUpdatedAt||local?._cloudUpdatedAt||0)
    };
  }
  function getClient(){
    const cfg=window.BADOC_SHARED_CONFIG||{};
    if(!window.BadocCloud||!cfg.url||!cfg.key)throw Error("Cloud sync configuration unavailable");
    if(!client)client=window.BadocCloud.createClient(cfg.url,cfg.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }
  async function withLedgerWriteLease(task,waitMs=0){
    const api=window.BadocCloud||{};
    if(typeof api.claimCfr1Lease!=="function"||typeof api.releaseCfr1Lease!=="function")
      throw Error("Fenced CFR1 cloud-write lock is unavailable; ledger write was stopped");
    const waitUntil=Date.now()+Math.max(0,Number(waitMs)||0);
    let lease=null,waiting=false;
    do{
      lease=await api.claimCfr1Lease(writeOwner,WRITE_LOCK_TTL);
      if(lease)break;
      if(Date.now()>=waitUntil)
        throw Error("Another device is updating the CFR1 ledger; the reset could not acquire the shared writer lock.");
      if(!waiting){
        waiting=true;
        const status=document.getElementById("cfr1CloudSyncStatus");
        if(status)status.textContent="Waiting for the active CFR1 writer to finish before resetting…";
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }while(!lease);
    let lost=false,renewing=false;
    let leaseUntil=Number(lease.until||0);
    const assertLease=()=>{
      const now=window.__badocTime?.nowMs?.()??Date.now();
      if(lost||(leaseUntil>0&&now>=leaseUntil)){
        lost=true;
        throw Error("CFR1 cloud-write lease expired or ownership changed; refusing to overwrite the ledger");
      }
    };
    assertLease.fence=lease.fence;
    const timer=setInterval(async()=>{
      if(renewing||lost)return;
      renewing=true;
      try{
        const renewed=await api.claimCfr1Lease(writeOwner,WRITE_LOCK_TTL);
        if(!renewed||Number(renewed.fence)!==Number(lease.fence))lost=true;
        else{
          const nextUntil=Number(renewed.until||0);
          const now=window.__badocTime?.nowMs?.()??Date.now();
          if(!nextUntil||nextUntil<=now)lost=true;
          else leaseUntil=nextUntil;
        }
      }catch(e){lost=true;console.warn("CFR1 cloud-write lease renewal failed:",e)}
      finally{renewing=false}
    },WRITE_LOCK_RENEW);
    try{
      const result=await task(assertLease);
      assertLease();
      return result;
    }finally{
      clearInterval(timer);
      // Do not release while a renewal transaction is still in flight. Otherwise
      // a late renewal could recreate the lease after release and block every tab.
      while(renewing)await new Promise(resolve=>setTimeout(resolve,25));
      try{await api.releaseCfr1Lease(writeOwner,lease.fence)}catch(e){console.warn("CFR1 cloud-write lease release failed:",e)}
    }
  }
  function isExpectedCfr1Contention(error){
    return /Another device is updating the CFR1 ledger|pre-reset CFR1 ledger|reset generation is stale|CFR1 fenced write rejected: lease expired|ownership changed/i.test(String(error?.message||error||""));
  }
  async function downloadLedger(){
    const state=await window.BadocCloud.readCfr1LedgerState();
    const generation=Number(state?.resetGeneration||0);
    window.__badocCfr1ResetGeneration=generation;
    window.__badocCfr1ResetPending=state?.resetPending===true;
    if(state?.resetPending===true)return null;
    if(state?.ledger&&typeof state.ledger==="object")return {...state.ledger,_resetGeneration:generation,_ledgerRevision:Number(state.ledgerRevision||0)};
    // A fresh page can render an empty local ledger before this async cloud
    // read finishes. It is safe to advance only an empty ledger to the current
    // generation; never re-stamp a populated pre-reset membership snapshot.
    const local=window.__badocCfr1LedgerMemory;
    if(local&&local.date===__badocTime.dayKey()&&Object.keys(local.records||{}).length===0){
      local._resetGeneration=generation;
    }
    // One-time backward-compatible import. Once the fenced node has been reset,
    // never fall back to the legacy object: it may contain a pre-reset ledger.
    if(generation===0){
      const r=await getClient().storage.from("exported-files").download(PATH);
      if(!r.error)return {...JSON.parse(await r.data.text()),_resetGeneration:0};
      if(!/not found|404|object not found/i.test(r.error.message||""))throw Error(r.error.message||"CFR1 legacy cloud download failed");
    }
    return null;
  }
  async function uploadLedger(ledger,assertLease){
    assertLease();
    const payload={...ledger,_resetGeneration:Number(ledger?._resetGeneration??window.__badocCfr1ResetGeneration??0),_cloudUpdatedAt:Date.now()};
    await window.BadocCloud.writeCfr1Ledger(writeOwner,assertLease.fence,payload);
    assertLease();
    lastCloudStamp=String(payload._cloudUpdatedAt);
    window.__badocCfr1LedgerMemory=payload;
    const status=document.getElementById("cfr1CloudSyncStatus");
    if(status)status.textContent="CFR1 cloud synced";
  }
  async function publish(key,ledger){
    if(key!==KEY||busy||window.__badocCfr1MaintenanceInProgress===true||window.__badocCfr1ResetPending===true)return;
    const sourceSig=sourceSignature(ledger);
    if(sourceSig && sourceSig===lastPublishedSourceSignature)return;
    busy=true;
    try{
      await withLedgerWriteLease(async assertLease=>{
        const cloud=await downloadLedger();
        assertLease();
        const generation=Number(window.__badocCfr1ResetGeneration||0);
        const localGeneration=Number(ledger?._resetGeneration??generation);
        if(localGeneration!==generation){
          // This is expected while another device finishes a reset. Never re-stamp
          // a populated old ledger with the new generation or restore cleared data.
          console.info("CFR1 publish skipped: this device still has the previous daily ledger; stale membership was not restored.");
          return;
        }
        const publishLedger={...ledger,_resetGeneration:generation};
        const today=String(publishLedger?.date||"");
        const cloudToday=String(cloud?.date||"");
        // Keep the current operational day. For the same day, merge by parcel
        // key so one device's live status updates do not erase other members.
        if(cloud&&cloudToday===today&&cloud.records&&publishLedger.records){
          // The daily ledger is the frozen membership record. Never re-check its
          // members against receivedMs here: prior-date Rule A rows and Rule B
          // transported rows with blank receivedMs are both valid CFR1 members.
          const merged=mergeSameDayLedgers(cloud,publishLedger);
          merged._resetGeneration=generation;
          assertLease();
          await uploadLedger(merged,assertLease);
          lastPublishedSourceSignature=sourceSig;
        }else{
          // Do not upload a blank ledger before parcel batches have loaded.
          // A later dashboard refresh will publish once the data is available.
          if(!publishLedger.records||Object.keys(publishLedger.records).length===0)return;
          assertLease();
          await uploadLedger(publishLedger,assertLease);
          lastPublishedSourceSignature=sourceSig;
        }
      });
    }catch(e){
      if(isExpectedCfr1Contention(e)){
        console.info("CFR1 cloud write deferred:",String(e?.message||e));
      }else{
        console.warn("CFR1 cloud write failed:",e);
        const status=document.getElementById("cfr1CloudSyncStatus");
        if(status)status.textContent=("CFR1 cloud write failed — "+String(e?.message||e)).slice(0,260);
      }
    }finally{busy=false}
  }
  async function poll(){
    if(busy)return false;
    busy=true;
    let loaded=false;
    try{
      const cloud=await downloadLedger();
      if(!cloud||!cloud.date){
        const status=document.getElementById("cfr1CloudSyncStatus");
        if(status)status.textContent=window.__badocCfr1ResetPending===true
          ?"CFR1 reset is in progress on another device; publishing is paused"
          :"CFR1 cloud connected — no shared ledger saved yet";
        return true;
      }
      const memory=window.__badocCfr1LedgerMemory||null;
      const cloudStamp=String(cloud._cloudUpdatedAt||"");
      if(!memory||memory.date!==cloud.date){
        window.__badocCfr1LedgerMemory=cloud;
        loaded=true;
      }else if(cloudStamp&&cloudStamp!==lastCloudStamp&&
        Number(cloud._cloudUpdatedAt||0)>Number(memory._cloudUpdatedAt||0)){
        // A cloud refresh and a local refresh can overlap. Merge both same-day
        // snapshots by membership so neither device can shrink a frozen list.
        const merged=mergeSameDayLedgers(cloud,memory);
        window.__badocCfr1LedgerMemory=merged;
        loaded=true;
        if(sourceSignature(merged)!==sourceSignature(cloud)){
          // Repair under a shared writer lease and merge against the latest
          // cloud object while holding it, so another device cannot race this write.
          await withLedgerWriteLease(async assertLease=>{
            const latest=await downloadLedger();
            if(latest&&latest.date===merged.date){
              const repaired=mergeSameDayLedgers(latest,merged);
              assertLease();
              repaired._resetGeneration=Number(window.__badocCfr1ResetGeneration||0);
              await uploadLedger(repaired,assertLease);
            }
          });
        }
      }
      if(cloudStamp)lastCloudStamp=String((window.__badocCfr1LedgerMemory||cloud)._cloudUpdatedAt||cloudStamp);
      if(loaded&&cloud.date===__badocTime.dayKey()){
        window.dispatchEvent(new CustomEvent("badoc-cfr1-cloud-ledger-updated",{detail:{date:cloud.date}}));
      }
      // A successful read must clear any old error left by an earlier failed poll.
      const status=document.getElementById("cfr1CloudSyncStatus");
      if(status)status.textContent="CFR1 cloud connected · shared ledger verified for "+cloud.date;
      return true;
    }catch(e){
      if(isExpectedCfr1Contention(e)){
        console.info("CFR1 cloud refresh deferred:",String(e?.message||e));
        const status=document.getElementById("cfr1CloudSyncStatus");
        if(status)status.textContent="CFR1 ledger is being updated on another device; this refresh will retry.";
      }else{
        console.warn("CFR1 cloud poll failed:",e);
        const status=document.getElementById("cfr1CloudSyncStatus");
        if(status)status.textContent=("CFR1 cloud read failed — "+String(e?.message||e)).slice(0,260);
      }
      return false;
    }finally{busy=false}
  }
  async function ensureLoaded(timeoutMs=12000){
    const until=Date.now()+Math.max(1000,Number(timeoutMs)||12000);
    while(busy&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
    if(busy)return false;
    return await poll();
  }
  async function resetCloud(afterDelete){
    // Wait for the local poll and any other device's writer lease. The old code
    // failed immediately on ordinary contention, so Settings could not clear.
    const waitUntil=Date.now()+RESET_LOCK_WAIT_MS;
    while(busy&&Date.now()<waitUntil)await new Promise(resolve=>setTimeout(resolve,100));
    if(busy)throw Error("CFR1 sync on this tab did not finish; close other Badoc Hub tabs and retry.");
    busy=true;
    window.__badocCfr1MaintenanceInProgress=true;
    const status=document.getElementById("cfr1CloudSyncStatus");
    try{
      const api=window.BadocCloud||{};
      // Recover an interrupted reset only when its previous writer lease is
      // absent/expired. The adapter never bypasses a live owner.
      if(typeof api.recoverCfr1Reset==="function")await api.recoverCfr1Reset();
      await withLedgerWriteLease(async assertLease=>{
        assertLease();
        const resetState=await api.resetCfr1Ledger(writeOwner,assertLease.fence,__badocTime.dayKey());
        window.__badocCfr1ResetGeneration=Number(resetState?.resetGeneration||0);
        window.__badocCfr1ResetPending=true;
        // Remove the legacy object as a migration cleanup. New versions never
        // read it after resetGeneration becomes non-zero.
        const r=await getClient().storage.from("exported-files").remove([PATH]);
        if(r.error)console.info("Legacy CFR1 object cleanup deferred; fenced RTDB reset remains authoritative:",r.error.message||r.error);
        assertLease();
        lastCloudStamp="";
        lastPublishedSourceSignature="";
        window.__badocCfr1LedgerMemory=null;
        // Keep resetPending + the writer lease through every operational-data
        // clear. Other tabs/devices cannot restore their old CFR1 membership.
        if(typeof afterDelete==="function")await afterDelete();
        assertLease();
        await api.completeCfr1Reset(writeOwner,assertLease.fence);
        window.__badocCfr1ResetPending=false;
      },RESET_LOCK_WAIT_MS);
      if(status)status.textContent="CFR1 cloud ledger reset; operational data clear completed";
      return true;
    }catch(e){
      if(status)status.textContent=("CFR1 reset/clear failed — "+String(e?.message||e)).slice(0,260);
      throw e;
    }finally{
      busy=false;
      window.__badocCfr1MaintenanceInProgress=false;
    }
  }
  window.__badocCfr1CloudSync={publish,resetCloud,ensureLoaded};
  window.addEventListener("load",()=>{poll();__badocEvery(poll,15000)});
})();
