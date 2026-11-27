/* SYNC ALL — runs existing app sync actions in sequence, including Pickup / First Mile. */
(function(){
  "use strict";
  if(window.__badocSyncAll)return;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const LAST_KEY="badoc_sync_all_last_v1";
  let running=false,cancelled=false;

  async function waitFor(fn,timeout,step){
    const t0=Date.now();
    while(Date.now()-t0<timeout){
      let value=false;
      try{value=fn()}catch(error){}
      if(value)return value;
      await sleep(step||250);
    }
    return null;
  }
  const ok=note=>({state:"ok",note:note||"Done"});
  const skip=note=>({state:"skip",note:note||"Skipped"});
  const fail=note=>({state:"fail",note:note||"Failed"});
  const bridgeHelp=()=>location.protocol==="file:"
    ? "SPX Bridge not connected. In Chrome, open chrome://extensions, open Badoc Hub Extension > Details, enable Allow access to file URLs, then reload this page."
    : "SPX Bridge not connected. Make sure the Badoc Hub Extension is installed and enabled, then reload this page.";
  const bridgeReady=()=>{try{return !!(window.__badocSpxBridgeReady&&window.__badocSpxBridgeReady())}catch(error){return false}};
  let bridgePreflightPromise=null;
  async function ensureBridgeForSyncAll(){
    if(bridgePreflightPromise)return bridgePreflightPromise;
    bridgePreflightPromise=(async()=>{
      if(bridgeReady())return true;
      const ensure=window.__badocEnsureSpxBridge;
      if(typeof ensure!=="function")return false;
      try{return !!(await ensure())}
      catch(error){console.warn("Sync All bridge handshake failed:",error);return false}
    })();
    return bridgePreflightPromise;
  }

  function spxButtonStep(btnId,statusId,timeoutMs=6*60*1000){
    return async()=>{
      if(!(await ensureBridgeForSyncAll()))return skip(bridgeHelp());
      if(cancelled)return skip("Stopped");
      const btn=$(btnId);
      if(!btn)return skip("Not available");
      if(btn.disabled||btn.dataset.busy==="1")return skip("Already running");
      btn.click();
      const started=await waitFor(()=>btn.disabled||btn.dataset.busy==="1",15000,100);
      if(!started){
        const status=statusId&&$(statusId);
        const message=((status&&status.textContent)||"").trim();
        if(status&&status.classList.contains("is-error"))return fail(message||"Failed to start");
        return fail(message||"The sync action did not start. Try its individual sync button to see the error.");
      }
      const done=await waitFor(()=>!btn.disabled&&btn.dataset.busy!=="1",timeoutMs,250);
      if(cancelled)return skip("Stopped");
      if(!done)return fail("Timed out waiting for SPX.");
      const status=statusId&&$(statusId),message=((status&&status.textContent)||"").trim();
      if(status&&status.classList.contains("is-error"))return fail(message||"Sync failed");
      return ok(message||"Done");
    };
  }

  // This existing button requests Orders first; the app automatically requests
  // Tasks only after the Orders export has been imported and saved locally.
  function firstMileButtonStep(){
    return async()=>{
      if(!(await ensureBridgeForSyncAll()))return skip(bridgeHelp());
      if(cancelled)return skip("Stopped");
      const btn=$("syncFirstMileAll");
      if(!btn)return skip("Pickup sync button is not available");
      if(btn.disabled||btn.dataset.busy==="1")return skip("Already running");
      const status=$("firstMileOverallStatus");
      btn.click();
      const started=await waitFor(()=>btn.disabled||btn.dataset.busy==="1",15000,100);
      if(!started){
        const message=((status&&status.textContent)||"").trim();
        return fail(message||"First Mile sync did not start.");
      }
      // First Mile consists of two sequential SPX exports (Orders, then Tasks).
      const done=await waitFor(()=>!btn.disabled&&btn.dataset.busy!=="1",12*60*1000,250);
      if(cancelled)return skip("Stopped");
      if(!done)return fail("Timed out waiting for First Mile Orders and Tasks.");
      const message=((status&&status.textContent)||"").trim();
      if(/sync stopped|failed|import failed|error/i.test(message))return fail(message);
      if(/sync completed/i.test(message))return ok(message);
      return fail(message||"First Mile sequence ended without a completion confirmation.");
    };
  }

  function assignedTodayStep(){
    return async()=>{
      if(!(await ensureBridgeForSyncAll()))return skip(bridgeHelp());
      if(cancelled)return skip("Stopped");
      const btn=$("syncAssignedOnholdToday");
      if(!btn)return fail("Assigned Today button is not available.");
      if(btn.disabled||btn.dataset.busy==="1")return skip("Assigned Today is already running.");
      const status=$("assignedOnholdTodayStatus");
      btn.click();
      const started=await waitFor(()=>btn.disabled||btn.dataset.busy==="1",15000,100);
      if(!started){
        const message=((status&&status.textContent)||"").trim();
        if(status&&status.classList.contains("is-error"))return fail(message||"Assigned Today failed to start.");
        return fail(message||"Assigned Today export did not start.");
      }
      const done=await waitFor(()=>!btn.disabled&&btn.dataset.busy!=="1",13*60*1000,250);
      if(cancelled)return skip("Stopped");
      if(!done)return fail("Timed out waiting for the Assigned Today Forward and Return exports.");
      const message=((status&&status.textContent)||"").trim();
      if(status&&status.classList.contains("is-error"))return fail(message||"Assigned Today sync failed.");
      if(!status||!status.classList.contains("is-success"))return fail(message||"Assigned Today ended without a successful cloud-save confirmation.");
      return ok(message||"Assigned Today synced.");
    };
  }

  const STEPS=[
    {id:"cloud",label:"Shared cloud data",run:async()=>{
      if(typeof window.__badocSharedPullNow!=="function")return skip("Cloud sync not ready");
      await Promise.race([window.__badocSharedPullNow(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Shared cloud pull timed out after 20 seconds. SPX imports will continue; cloud data can retry in the background.")),20000))]);
      await sleep(300);
      return ok("Shared settings and lists loaded; parcel, Assigned Today, and linehaul data are refreshed by the SPX steps.");
    }},
    {id:"inbound",label:"Received / Transported / Transporting",run:spxButtonStep("syncParcelInboundFromSPX","parcelInboundSpxSyncStatus")},
    {id:"assignedToday",label:"Assigned Today",run:assignedTodayStep()},
    {id:"linehaul",label:"Incoming linehaul",run:spxButtonStep("syncLinehaulFromSPX","linehaulSpxSyncStatus")},
    {id:"firstMile",label:"Pickup",run:firstMileButtonStep()}
  ];

  const ICON={wait:"○",run:"↻",ok:"✓",skip:"–",fail:"✕"};
  const STATE_LABEL={wait:"Waiting",run:"In progress",ok:"Complete",skip:"Skipped",fail:"Failed"};
  function renderSteps(states){
    const list=$("syncAllSteps"),panel=$("syncAll"),progress=$("syncAllProgress");
    if(!list||!progress)return;
    list.hidden=false;progress.hidden=false;
    const completed=states.filter(state=>["ok","skip","fail"].includes(state&&state.state)).length;
    const active=states.filter(state=>state&&state.state==="run").length;
    const failed=states.filter(state=>state&&state.state==="fail").length;
    const skipped=states.filter(state=>state&&state.state==="skip").length;
    const percent=Math.round(completed/STEPS.length*100);
    const label=$("syncAllProgressLabel"),detail=$("syncAllProgressDetail");
    const count=$("syncAllProgressCount"),track=$("syncAllProgressTrack"),fill=$("syncAllProgressFill");
    if(label)label.textContent=completed===STEPS.length?(failed?"Sync finished with errors":skipped?"Sync finished with skipped tasks":"All synchronization steps complete"):active===1?"Synchronizing SPX data":active>1?"Synchronizing "+active+" tasks in parallel":"Preparing synchronization";
    if(detail)detail.textContent=completed===STEPS.length?(failed?failed+" failed"+(skipped?" · "+skipped+" skipped":""):"All requested tasks have finished"):active?active+" active · "+(STEPS.length-completed)+" remaining":"Waiting for the SPX tasks to start";
    if(count)count.textContent=completed+" / "+STEPS.length+" complete";
    if(fill)fill.style.width=percent+"%";
    if(track)track.setAttribute("aria-valuenow",String(percent));
    if(panel)panel.dataset.syncState=completed===STEPS.length?(failed?"error":skipped?"warning":"done"):active?"running":"waiting";
    list.innerHTML=STEPS.map((step,index)=>{
      const state=states[index]||{state:"wait"};
      const safeNote=state.note?String(state.note).replace(/[&<>]/g,function(char){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[char];}):(state.state==="wait"?"Waiting to start":state.state==="run"?"Working…":STATE_LABEL[state.state]||"");
      return '<li class="syncall-step sa-'+state.state+'" data-step="'+(index+1)+'"><span class="sa-ico" aria-hidden="true">'+(ICON[state.state]||"○")+'</span><div class="sa-content"><div class="sa-heading"><strong>'+step.label+'</strong><span class="sa-state-pill">'+(STATE_LABEL[state.state]||"Waiting")+'</span></div><small>'+safeNote+'</small></div></li>';
    }).join("");
  }
  function lastText(){
    try{
      const value=JSON.parse(localStorage.getItem(LAST_KEY)||"null");
      if(!value)return "Not synced on this device yet";
      const time=new Date(value.at);
      return "Last full sync "+time.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+(value.fail?" · "+value.fail+" failed":value.skip?" · "+value.skip+" skipped":" · all done");
    }catch(error){return ""}
  }
  function setBtn(label,disabled,mode){
    const button=$("syncAllBtn");if(!button)return;
    button.textContent=label;button.disabled=!!disabled;button.dataset.mode=mode||"";
    const panel=$("syncAll");
    if(panel)panel.dataset.syncState=mode==="run"?"running":mode==="done"?"done":mode==="warn"?"warning":"idle";
  }
  async function runStep(index,states,last){
    if(cancelled){states[index]=skip("Stopped");renderSteps(states);return states[index]}
    states[index]={state:"run",note:"Working…"};renderSteps(states);
    const updateRunningText=()=>{
      if(!last)return;
      const active=STEPS.filter((step,i)=>states[i]?.state==="run").map(step=>step.label);
      last.textContent=active.length?"Syncing "+active.join(" · ")+"…":"Sync steps updating…";
    };
    updateRunningText();
    try{states[index]=await STEPS[index].run()}
    catch(error){console.warn("Sync All step failed:",STEPS[index].id,error);states[index]=fail(error&&error.message||"Failed")}
    renderSteps(states);
    updateRunningText();
    return states[index];
  }

  async function run(scheduleSlot){
    if(running){
      if(scheduleSlot)return false;
      cancelled=true;
      setBtn("Stopping…",true,"run");
      try{postBadocSpxMessage("BADOC_ABORT_SYNC")}catch(error){console.warn("Could not request SPX sync cancellation:",error)}
      return false;
    }
    running=true;cancelled=false;bridgePreflightPromise=null;
    const states=STEPS.map(()=>({state:"wait"}));
    const last=$("syncAllLast"),startedAt=Date.now();
    const modalKeys=["__badocOperationModalStart","__badocOperationModalUpdate","__badocOperationModalFinish"],saved={};
    modalKeys.forEach(key=>{saved[key]=window[key];window[key]=()=>{}});
    setBtn("■ Stop",false,"run");
    let parcelCloudBufferStarted=false;
    // Avoid cloud pulls overwriting the datasets being refreshed by the parallel SPX steps.
    window.__badocSyncAllInProgress=true;
    try{
      // Load the authoritative shared CFR1 membership before importing new SPX statuses.
      try{
        const cfr1Cloud=window.__badocCfr1CloudSync;
        if(cfr1Cloud&&typeof cfr1Cloud.ensureLoaded==="function"){
          const ready=await cfr1Cloud.ensureLoaded(12000);
          if(!ready)console.warn("Sync All: CFR1 cloud ledger could not be verified before SPX sync.");
          window.updateOperationProgress?.();
        }
      }catch(error){console.warn("Sync All: CFR1 cloud preflight failed:",error)}

      if(!cancelled&&typeof window.__badocBeginSyncAllParcelCloudBuffer==="function"){
        window.__badocBeginSyncAllParcelCloudBuffer();
        parcelCloudBufferStarted=true;
      }

      if(cancelled){
        for(let index=0;index<STEPS.length;index++)states[index]=skip("Stopped before this step");
        renderSteps(states);
      }else{
        // Steps 1, 2, 3 and 5 begin together.
        const sharedCloudPromise=runStep(0,states,last);
        const inboundPromise=runStep(1,states,last);
        const assignedTodayPromise=runStep(2,states,last);
        const firstMilePromise=runStep(4,states,last);

        // Step 4 (Incoming Linehaul) starts as soon as step 2 completes.
        await inboundPromise;
        if(!cancelled){
          if(last)last.textContent="Received / Transported finished. Starting Incoming Linehaul…";
          await runStep(3,states,last);
        }else{
          states[3]=skip("Stopped before Incoming Linehaul");
          renderSteps(states);
        }

        await Promise.all([sharedCloudPromise,assignedTodayPromise,firstMilePromise]);

        // Publish the inbound parcel export only after the other syncs are complete.
        if(parcelCloudBufferStarted&&typeof window.__badocFlushSyncAllParcelCloudBuffer==="function"){
          try{
            const flushed=await window.__badocFlushSyncAllParcelCloudBuffer();
            parcelCloudBufferStarted=false;
            if(flushed&&flushed.uploaded){
              const prior=states[0]?.note||"Shared cloud data loaded";
              states[0]={state:states[0]?.state||"ok",note:prior+"; "+flushed.uploaded+" inbound parcel export saved to shared cloud"};
              renderSteps(states);
            }
          }catch(error){
            console.warn("Sync All parcel cloud upload failed:",error);
            states[0]=fail("Inbound parcel data imported locally, but saving it to shared cloud failed: "+(error&&error.message||"Unknown error"));
            renderSteps(states);
          }
        }

        if(cancelled){
          for(let index=0;index<STEPS.length;index++){
            if(states[index].state==="wait")states[index]=skip("Stopped");
          }
          renderSteps(states);
        }
      }
    }finally{
      if(parcelCloudBufferStarted&&typeof window.__badocFlushSyncAllParcelCloudBuffer==="function"){
        try{await window.__badocFlushSyncAllParcelCloudBuffer()}catch(error){console.warn("Final parcel cloud flush failed:",error)}
      }
      window.__badocSyncAllInProgress=false;
      modalKeys.forEach(key=>{window[key]=saved[key]});
      running=false;
    }
    const nOk=states.filter(state=>state.state==="ok").length;
    const nSkip=states.filter(state=>state.state==="skip").length;
    const nFail=states.filter(state=>state.state==="fail").length;
    try{localStorage.setItem(LAST_KEY,JSON.stringify({at:Date.now(),ok:nOk,skip:nSkip,fail:nFail}))}catch(error){}
    if(last)last.textContent=cancelled?"Stopped · "+nOk+" done":"Finished in "+Math.round((Date.now()-startedAt)/1000)+"s · "+nOk+" done"+(nSkip?" · "+nSkip+" skipped":"")+(nFail?" · "+nFail+" failed":"");
    cancelled=false;
    setBtn("⟳ Sync Now",false,nFail?"warn":"done");
    setTimeout(()=>{const button=$("syncAllBtn");if(button&&!running)button.dataset.mode=""},4000);
    const success=!cancelled&&nFail===0&&nSkip===0;
    return success;
  }

  const SCHEDULE_KEY="badoc_sync_all_schedule_v1";
  const SCHEDULE=[
    {id:"planning-0355",time:"03:55",label:"3:55 AM · Planning"},
    {id:"cfr1-0359",time:"03:59",label:"3:59 AM · CFR1"},
    {id:"after-dispatch",time:"10:00",label:"10:00 AM · After Dispatch"},
    {id:"afternoon",time:"14:00",label:"2:00 PM · Additional sync"},
    {id:"eod",time:"21:00",label:"9:00 PM · EOD"},
    {id:"eod-backup",time:"21:30",label:"9:30 PM · EOD backup"}
  ];
  let scheduleProcessing=false,scheduleTimer=null;
  function manilaNow(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
    const v={};parts.forEach(p=>{v[p.type]=p.value});
    return {date:v.year+"-"+v.month+"-"+v.day,minute:Number(v.hour)*60+Number(v.minute)};
  }
  function readScheduleLog(){try{return JSON.parse(localStorage.getItem(SCHEDULE_KEY)||"{}")}catch(e){return {}}}
  function writeScheduleLog(log){try{localStorage.setItem(SCHEDULE_KEY,JSON.stringify(log))}catch(e){}}
  async function processSchedule(){
    if(scheduleProcessing||running)return;
    scheduleProcessing=true;
    try{
      const now=manilaNow(),log=readScheduleLog(),today=log[now.date]||(log[now.date]={});
      for(const slot of SCHEDULE){
        const parts=slot.time.split(":").map(Number),due=parts[0]*60+parts[1];
        if(now.minute<due||today[slot.id])continue;
        if(slot.id==="eod-backup"&&today.eod&&today.eod.success===true){
          today[slot.id]={attemptedAt:Date.now(),success:true,skipped:true,reason:"EOD already succeeded"};
          writeScheduleLog(log);continue;
        }
        if(!bridgeReady()){
          const last=$("syncAllLast");
          if(last)last.textContent="Scheduled sync due: "+slot.label+" · waiting for extension connection";
          break;
        }
        const last=$("syncAllLast");
        if(last)last.textContent="Starting scheduled sync: "+slot.label;
        const success=await run(slot.id);
        today[slot.id]={attemptedAt:Date.now(),success:!!success};
        writeScheduleLog(log);
        if(!success)break;
      }
    }finally{scheduleProcessing=false}
  }
  function startSchedule(){
    processSchedule();
    scheduleTimer=setInterval(processSchedule,30000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)processSchedule()});
  }

  function init(){
    const button=$("syncAllBtn");if(!button||button.dataset.bound)return;
    button.dataset.bound="1";
    button.addEventListener("click",()=>run());
    button.title="Sync shared cloud data, Received / Transported / Transporting, Assigned Today, Incoming linehaul, and Pickup.";
    const last=$("syncAllLast");if(last)last.textContent=lastText();
    startSchedule();
  }
  window.__badocSyncAll=run;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
