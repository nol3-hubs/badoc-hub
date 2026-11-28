(function(){
  "use strict";
  if(window.__badocSettingsCenter)return;
  window.__badocSettingsCenter=true;
  const $=id=>document.getElementById(id);
  const text=(selector,fallback="")=>document.querySelector(selector)?.textContent?.trim()||fallback;
  const formatBytes=value=>{
    const n=Number(value)||0;
    if(n<1024)return n+" B";
    if(n<1024*1024)return (n/1024).toFixed(1)+" KB";
    if(n<1024*1024*1024)return (n/(1024*1024)).toFixed(2)+" MB";
    return (n/(1024*1024*1024)).toFixed(2)+" GB";
  };
  const setState=(id,label,detail)=>{
    const value=$(id);if(value)value.textContent=label;
    const note=$(id+"Detail");if(note&&detail!==undefined)note.textContent=detail;
  };
  const timeLabel=value=>{
    const stamp=Number(value);
    if(!Number.isFinite(stamp)||stamp<=0)return "No timestamp recorded";
    return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(stamp));
  };
  function refreshConnection(){
    const cloudBox=$("sharedStatus");
    const cloudText=text("#sharedStatus .top-sync-text",cloudBox?.textContent||"Waiting for cloud status");
    const cloudLower=cloudText.toLowerCase();
    const cloudState=/failed|error|offline/.test(cloudLower)?"Attention needed":/connected|synced|\bok\b/.test(cloudLower)?"Connected":/connect|retry|syncing/.test(cloudLower)?"Connecting…":"Waiting";
    setState("settingsDashboardCloudStatus",cloudState,cloudText||"No cloud status reported");
    const pickupText=text("#firstMileCloudSyncStatus",text("#firstMileCombinedMeta","First Mile status has not been reported yet."));
    const pickupLower=pickupText.toLowerCase();
    const pickupState=/failed|unavailable|error/.test(pickupLower)?"Attention needed":/synced|shared cloud/.test(pickupLower)?"Synced":/pending|retry|connecting/.test(pickupLower)?"Pending":"Waiting";
    setState("settingsPickupCloudStatus",pickupState,pickupText);
    let bridge=false;try{bridge=!!(window.__badocSpxBridgeReady&&window.__badocSpxBridgeReady());}catch(e){}
    const extensionText=text("#badocExtensionVersionStatus",bridge?"Extension bridge connected":"No extension bridge status yet");
    setState("settingsExtensionStatus",bridge?"Connected":"Not connected",extensionText);
    let last=0;try{last=Number(localStorage.getItem("badoc_last_sync_at")||0)}catch(e){}
    const syncSummary=text("#syncAllLast","");
    setState("settingsLastSync",last?timeLabel(last):(syncSummary||"Not recorded"),last?"Saved on this device":syncSummary||"No successful sync timestamp was found");
    refreshAppInfo();
  }
  function browserLabel(){
    const ua=navigator.userAgent||"";
    if(/Firefox\//i.test(ua))return "Firefox";
    if(/Edg\//i.test(ua))return "Microsoft Edge";
    if(/Chrome\//i.test(ua))return "Chrome";
    if(/Safari\//i.test(ua))return "Safari";
    return "Other browser";
  }
  function refreshAppInfo(){
    const version=document.querySelector('meta[name="badoc-app-version"]')?.content||"Unknown";
    const firefox=/Firefox\//i.test(navigator.userAgent||"");
    const required=firefox?"Firefox 69.5.17":"Chrome 1.6.8";
    const bridgeText=text("#badocExtensionVersionStatus","");
    let detected="Not detected";try{if(window.__badocSpxBridgeReady?.())detected=bridgeText||"Connected";else if(bridgeText)detected=bridgeText;}catch(e){}
    if($("settingsDashboardVersion"))$("settingsDashboardVersion").textContent=version;
    if($("settingsRequiredExtension"))$("settingsRequiredExtension").textContent=required;
    if($("settingsDetectedExtension"))$("settingsDetectedExtension").textContent=detected;
    if($("settingsBrowser"))$("settingsBrowser").textContent=browserLabel();
  }
  async function refreshStorage(){
    const status=$("settingsStorageStatus");
    const refresh=$("settingsStorageRefresh");
    if(refresh)refresh.disabled=true;
    if(status)status.textContent="Measuring browser storage…";
    try{
      let usage=null,quota=null,persisted=null;
      if(navigator.storage?.estimate){
        const estimate=await navigator.storage.estimate();
        usage=Number.isFinite(estimate.usage)?estimate.usage:null;
        quota=Number.isFinite(estimate.quota)?estimate.quota:null;
      }
      if(navigator.storage?.persisted){
        try{persisted=await navigator.storage.persisted();}catch(e){}
      }
      setState("settingsStorageUsage",usage===null?"Not available":formatBytes(usage),usage===null?"Browser does not expose usage estimates":"Estimated origin-wide usage");
      setState("settingsStorageQuota",quota===null?"Not available":formatBytes(quota),usage!==null&&quota?Math.max(0,quota-usage)>0?formatBytes(Math.max(0,quota-usage))+" remaining":"Quota reached":"Browser quota estimate");
      setState("settingsStoragePersistence",persisted===null?"Not available":persisted?"Persistent":"Not persistent",persisted===null?"Browser permission not exposed":persisted?"Browser granted persistent storage":"Browser may evict site data under storage pressure");

      let localBytes=0,localKeys=0;
      try{
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i)||"",value=localStorage.getItem(key)||"";
          localBytes+=new Blob([key,value]).size;localKeys++;
        }
      }catch(e){}
      setState("settingsLocalStorage",formatBytes(localBytes),localKeys+" localStorage keys");

      let parcelCount=null,parcelRows=null,parcelBytes=null;
      try{
        if(window.indexedDB?.databases){
          const dbs=await window.indexedDB.databases();
          if(dbs.some(db=>db.name==="ParcelRoutingDashboardCleanStartV2")){
            const db=await new Promise((resolve,reject)=>{
              const request=indexedDB.open("ParcelRoutingDashboardCleanStartV2",1);
              request.onsuccess=()=>resolve(request.result);
              request.onerror=()=>reject(request.error||new Error("Could not open parcel database"));
            });
            if(db.objectStoreNames.contains("batches")){
              const batches=await new Promise((resolve,reject)=>{
                const request=db.transaction("batches","readonly").objectStore("batches").getAll();
                request.onsuccess=()=>resolve(request.result||[]);
                request.onerror=()=>reject(request.error);
              });
              parcelCount=batches.length;
              parcelRows=batches.reduce((sum,batch)=>sum+(Array.isArray(batch.rows)?batch.rows.length:0),0);
              parcelBytes=new Blob([JSON.stringify(batches)]).size;
            }else{parcelCount=0;parcelRows=0;parcelBytes=0;}
            db.close();
          }else{parcelCount=0;parcelRows=0;parcelBytes=0;}
        }
      }catch(e){console.warn("Badoc storage information: parcel database",e);}
      setState("settingsParcelStorage",parcelCount===null?"Not available":parcelCount.toLocaleString()+" batches",parcelRows===null?"IndexedDB size not available":parcelRows.toLocaleString()+" rows · approx. "+formatBytes(parcelBytes));

      const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch(e){return null}};
      const orders=readJson("badoc_first_mile_orders_csv_local_v1");
      const tasks=readJson("badoc_first_mile_tasks_csv_local_v1");
      const names=readJson("badoc_first_mile_point_names_v1");
      const orderRows=Number(orders?.rowCount||0);
      const taskRows=Number(tasks?.rowCount||0);
      const nameCount=names&&typeof names==="object"?Object.keys(names).length:0;
      const pickupBytes=["badoc_first_mile_orders_csv_local_v1","badoc_first_mile_tasks_csv_local_v1","badoc_first_mile_point_names_v1"].reduce((sum,key)=>{
        try{return sum+new Blob([localStorage.getItem(key)||""]).size}catch(e){return sum}
      },0);
      setState("settingsPickupStorage",formatBytes(pickupBytes),orderRows.toLocaleString()+" Order rows · "+taskRows.toLocaleString()+" Task rows · "+nameCount.toLocaleString()+" point names");
      try{
        const cfg=window.BADOC_SHARED_CONFIG||{};
        if(!window.BadocCloud||!cfg.url||!cfg.key)throw new Error("Shared cloud configuration is unavailable.");
        const client=window.BadocCloud.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        const bucket=client.storage.from("exported-files");
        const folders=[""];let cloudFiles=0,cloudBytes=0,visitedFolders=0,partialListing=false;
        while(folders.length&&visitedFolders<100){
          const folder=folders.shift();visitedFolders++;
          for(let offset=0;offset<10000;offset+=1000){
            const result=await bucket.list(folder,{limit:1000,offset});
            if(result.error)throw new Error(result.error.message||"Shared storage listing failed.");
            const entries=Array.isArray(result.data)?result.data:[];
            for(const item of entries){
              const isFolder=item&&item.id==null&&!item.metadata;
              if(isFolder){
                const name=String(item.name||"").trim();
                if(name)folders.push(folder?folder+"/"+name:name);
              }else{
                cloudFiles++;
                cloudBytes+=Number(item?.metadata?.size??item?.size??item?.metadata?.contentLength??0)||0;
              }
            }
            if(entries.length<1000)break;
            if(offset>=9000)partialListing=true;
          }
        }
        if(folders.length)partialListing=true;
        setState("settingsCloudStorage",cloudFiles.toLocaleString()+" files · "+formatBytes(cloudBytes),partialListing?"Approximate total · listing limit reached":"Approximate total in exported-files bucket");
      }catch(cloudError){
        setState("settingsCloudStorage","Unavailable",cloudError?.message||String(cloudError));
      }
      if(status)status.textContent="Storage measurement completed for this browser and shared storage where accessible.";
    }catch(error){
      if(status)status.textContent="Storage measurement could not be completed: "+(error?.message||String(error));
    }finally{
      if(refresh)refresh.disabled=false;
    }
  }
  function bind(){
    $("settingsRefreshStatus")?.addEventListener("click",refreshConnection);
    $("settingsRefreshAppInfo")?.addEventListener("click",refreshAppInfo);
    $("settingsStorageRefresh")?.addEventListener("click",refreshStorage);
    const clearWord=$("settingsClearDataWord"),clearButton=$("clearData");
    if(clearWord&&clearButton){
      const update=()=>{clearButton.disabled=clearWord.value.trim().toUpperCase()!=="CLEAR DATA";};
      clearWord.addEventListener("input",update);
      update();
    }
    // The combined Clear Data + Reset CFR1 action uses one explicit confirmation dialog.
    refreshConnection();
    refreshAppInfo();
    refreshAlertPermission();
  }
  function refreshAlertPermission(){
    const state=window.__badocAlertSettings?.getState?.();
    const el=$("settingsNotificationPermission");
    if(!state||!el)return;
    const permission=state.permission;
    el.textContent=permission==="granted"?"Browser permission: Allowed":permission==="denied"?"Browser permission: Blocked in browser settings":permission==="default"?"Browser permission: Not requested":"Browser notifications are not supported";
  }
  window.__badocRefreshSettingsStatus=refreshConnection;
  window.__badocRefreshSettingsStorage=refreshStorage;
  window.__badocRefreshSettingsAppInfo=refreshAppInfo;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
