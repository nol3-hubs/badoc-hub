(function(){
  const CFR1_NOTIF_KEY = "badoc_cfr1_native_notified_v1";
  const CFR1_NOTIF_HOUR = 6;
  const CFR1_NOTIF_MINUTE = 40;

  function cfr1NativeNotificationReady(){
    return !!(window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.LocalNotifications);
  }

  async function ensureCfr1NotificationPermission(){
    if(!cfr1NativeNotificationReady()) return false;
    try{
      const p = await window.Capacitor.Plugins.LocalNotifications.checkPermissions();
      if(p.display === "granted") return true;
      const r = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
      return r.display === "granted";
    }catch(e){
      console.warn("CFR1 notification permission check failed", e);
      return false;
    }
  }

  function todayKey(){
    const d = __badocTime.manilaDate();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }

  async function getCfr1Values(){
    const scanned = Number(document.getElementById("opCfr1Scanned")?.textContent || 0);
    const total = Number(document.getElementById("opCfr1Total")?.textContent || 0);
    return {scanned:Number.isFinite(scanned)?scanned:0,total:Number.isFinite(total)?total:0};
  }

    // Browser fallback (not the Android app): the same message as an on-screen banner plus a system notification when allowed.
  function cfr1AlertText(scanned,total){
    return "CFR1 is "+((scanned/total)*100).toFixed(1)+"% ("+scanned+" / "+total+"). "+(total-scanned)+" parcels still need to be cleared before 7:00 AM.";
  }
  async function cfr1WebNotify(text){
    try{
      if(typeof Notification==="undefined"||Notification.permission!=="granted") return;
      const opts={body:text,tag:"cfr1-640",requireInteraction:true};
      let reg=null;
      try{reg=await (navigator.serviceWorker&&navigator.serviceWorker.getRegistration?navigator.serviceWorker.getRegistration():null)}catch(e){}
      if(reg&&reg.showNotification) await reg.showNotification("CFR1 ALERT",opts);
      else new Notification("CFR1 ALERT",opts);
    }catch(e){ console.warn("CFR1 browser notification failed",e); }
  }
  function cfr1WebAlert(scanned,total){
    const text=cfr1AlertText(scanned,total);
    let b=document.getElementById("cfr1AlertBanner");
    if(!b){
      b=document.createElement("div"); b.id="cfr1AlertBanner"; b.setAttribute("role","alert");
      b.innerHTML='<div class="cfr1b-text"></div><div class="cfr1b-actions"><button type="button" id="cfr1bEnable">Turn on alerts</button><button type="button" id="cfr1bClose" aria-label="Dismiss">✕</button></div>';
      document.body.appendChild(b);
      b.querySelector("#cfr1bClose").addEventListener("click",()=>b.remove());
      b.querySelector("#cfr1bEnable").addEventListener("click",async()=>{
        try{
          const r=await Notification.requestPermission();
          if(r==="granted"){ b.querySelector("#cfr1bEnable").hidden=true; cfr1WebNotify(b.__text||""); }
        }catch(e){}
      });
    }
    b.__text=text;
    const t=b.querySelector(".cfr1b-text"); t.textContent=""; const st=document.createElement("strong"); st.textContent="CFR1 ALERT"; t.appendChild(st); t.appendChild(document.createTextNode(text));
    b.querySelector("#cfr1bEnable").hidden=!(typeof Notification!=="undefined"&&Notification.permission==="default");
    cfr1WebNotify(text);
  }

  async function checkCfr1At640(forceAlarm=false){
    const now = __badocTime.manilaDate();
    const nativeApp = cfr1NativeNotificationReady();
    // Android app: exactly 6:40 (its own alarm bridge). Browser: any minute from 6:40 to 6:59, so a throttled background tab still alerts.
    const inWindow = nativeApp
      ? (now.getHours() === CFR1_NOTIF_HOUR && now.getMinutes() === CFR1_NOTIF_MINUTE)
      : (now.getHours() === CFR1_NOTIF_HOUR && now.getMinutes() >= CFR1_NOTIF_MINUTE);
    if(!forceAlarm && !inWindow) return;

    const key = todayKey();
    if(localStorage.getItem(CFR1_NOTIF_KEY) === key) return;

    const {scanned,total} = await getCfr1Values();
    if(total <= 0 || scanned >= total) {
      localStorage.setItem(CFR1_NOTIF_KEY,key);
      return;
    }

    if(!nativeApp){
      cfr1WebAlert(scanned,total);
      localStorage.setItem(CFR1_NOTIF_KEY,key);
      return;
    }
    if(!await ensureCfr1NotificationPermission()) return;

    try{
      await window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications:[{
          id:6401,
          title:"CFR1 ALERT",
          body:`CFR1 is ${((scanned/total)*100).toFixed(1)}% (${scanned} / ${total}). ${total-scanned} parcels still need to be cleared before 7:00 AM.`,
          schedule:{at:new Date(Date.now()+1000)},
          sound:"default",
          smallIcon:"ic_launcher"
        }]
      });
      localStorage.setItem(CFR1_NOTIF_KEY,key);
    }catch(e){
      console.warn("CFR1 notification scheduling failed",e);
    }
  }

  // Check frequently while the app is open. The notification is generated
  // only during the 6:40 AM minute and only when CFR1 is below 100%.
  setInterval(checkCfr1At640,1000);
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden) checkCfr1At640();
  });

  // Native Android 6:40 alarm bridge. This allows the Android alarm receiver
  // to trigger the CFR1 check even if the WebView starts a few seconds after 6:40.
  window.addEventListener("badoc-cfr1-alarm",()=>{
    checkCfr1At640(true);
  });
})();
