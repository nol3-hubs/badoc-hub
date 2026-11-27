(function(){
  function set(id,state,text){var e=document.getElementById(id);if(!e)return;e.classList.remove("ok","warn","bad");e.classList.add(state);var em=e.querySelector("em");if(em)em.textContent=text;}
  function lastSyncLabel(){
    try{
      var stamp=Number(localStorage.getItem("badoc_last_sync_at")||0);
      if(!stamp)return "";
      var d=new Date(stamp);
      if(isNaN(d.getTime()))return "";
      return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
    }catch(e){return "";}
  }
  function setSummary(state,text){
    var e=document.getElementById("healthSummary");if(!e)return;
    e.classList.remove("ok","warn","bad");e.classList.add(state);
    var em=e.querySelector("em");if(!em)return;
    var stamp=lastSyncLabel();
    em.textContent=(state==="ok"&&stamp)?(text+" · "+stamp):text;
  }
  function checkStorage(){
    try{
      var storage=window.__badocGetStorageHealth?window.__badocGetStorageHealth():window.__badocStorageHealth;
      if(storage&&storage.state==="memory-only"){
        set("healthStorage","bad","Session only");
        var health=document.getElementById("healthStorage");if(health)health.title=storage.message||"Parcel data may be lost when this tab closes.";
        return;
      }
      if(typeof indexedDB==="undefined"){
        set("healthStorage","bad","Unavailable");
        return;
      }

      // Prefer an already-established BADOC HUB DB connection, if exposed.
      var existing =
        (typeof db!=="undefined" && db) ||
        (typeof window.db!=="undefined" && window.db);

      if(existing && existing.objectStoreNames &&
         existing.objectStoreNames.contains("batches")){
        set("healthStorage","ok","OK");
        return;
      }

      // If the app has not exposed its connection, do not initialize one
      // from the health monitor. IndexedDB availability itself is healthy.
      set("healthStorage","ok",storage&&storage.state==="persistent"?"Saved":"Checking");
    }catch(e){
      set("healthStorage","bad","Error");
    }
  }
  function checkData(){
    try{
      var has=typeof window.render==="function" || !!localStorage;
      set("healthData",has?"ok":"warn",has?"Loaded":"Waiting");
    }catch(e){set("healthData","bad","Error")}
  }
  function checkKpi(){
    var status=(document.getElementById("kpiStatus")?.textContent||"").toLowerCase();
    if(status.includes("live"))set("healthKpi","ok","Live");
    else if(status.includes("connecting")||status.includes("loading"))set("healthKpi","warn","Loading");
    else if(status.includes("unavailable")||status.includes("error"))set("healthKpi","bad","Offline");
    else set("healthKpi","warn","Waiting");
  }
  function checkSync(){
    var e=document.querySelector("#sharedStatus .top-sync-text");
    var box=document.getElementById("healthSync");
    var t=(e?.textContent||"").toLowerCase();
    if(t.includes("all devices synced")||t.includes("synced")){
      var stamp=0;
      try{stamp=Number(localStorage.getItem("badoc_last_sync_at")||0)}catch{}
      if(box)box.title="Cloud sync is up to date";
      set("healthSync","ok","OK");
      setSummary("ok","OK");
    }else if(t.includes("retry")||t.includes("connecting")){
      if(box)box.title="Cloud sync is connecting or retrying";
      set("healthSync","warn","Syncing");
      setSummary("warn","Syncing");
    }else if(t.includes("failed")||t.includes("error")){
      if(box)box.title="Cloud sync error";
      set("healthSync","bad","Error");
      setSummary("bad","Error");
    }else{
      if(box)box.title="Waiting for cloud sync";
      set("healthSync","warn","Waiting");
      setSummary("warn","Waiting");
    }
  }
  window.toggleBadocHealth=function(e){
    if(e){e.preventDefault();e.stopPropagation();}
    var wrap=document.getElementById("appHealthIndicators");
    var btn=document.getElementById("healthSummary");
    if(!wrap||!btn)return;
    var open=!wrap.classList.contains("is-open");
    wrap.classList.toggle("is-open",open);
    btn.setAttribute("aria-expanded",open?"true":"false");
    var details=document.getElementById("healthDetails");
    if(details)details.setAttribute("aria-hidden",open?"false":"true");
  };

  function ensureLastSyncDetail(){
    var details=document.getElementById("healthDetails");
    if(!details||document.getElementById("healthLastSync"))return;
    var row=document.createElement("span");
    row.className="health-indicator health-last-sync";
    row.id="healthLastSync";
    row.innerHTML='<i></i><b>Last sync</b><em>—</em>';
    details.appendChild(row);
  }
  function updateLastSyncDetail(){
    var row=document.getElementById("healthLastSync");if(!row)return;
    var em=row.querySelector("em");if(!em)return;
    em.textContent=lastSyncLabel()||"—";
  }

  function bindSummary(){
    var wrap=document.getElementById("appHealthIndicators");
    var btn=document.getElementById("healthSummary");
    if(!wrap||!btn||btn.dataset.bound)return;
    ensureLastSyncDetail();
    updateLastSyncDetail();
    btn.dataset.bound="1";
    // Use one click handler only. Mobile browsers synthesize click from taps;
    // separate touch/pointer handlers can toggle the panel multiple times.
    btn.addEventListener("click",function(e){
      window.toggleBadocHealth(e);
    });
    document.addEventListener("click",function(e){
      if(!wrap.contains(e.target)){
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded","false");
        var details=document.getElementById("healthDetails");
        if(details)details.setAttribute("aria-hidden","true");
      }
    });
  }
  function run(){bindSummary();checkStorage();checkData();checkKpi();checkSync();updateLastSyncDetail();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
  __badocEvery(function(){checkKpi();checkSync();updateLastSyncDetail();},3000);
  __badocEvery(checkData,3000);
  __badocEvery(checkStorage,30000);
})();
