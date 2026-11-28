/* SYNC HEALTH panel — one place to see what is working, what is stale, and what failed. */
(function(){
  "use strict";
  if(window.__badocHealthUI)return;
  var $=function(id){return document.getElementById(id)};
  var H=window.__badocHealth||{issues:[],fetches:{}};
  var OKKEY="badoc_health_ok_v1";
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function ago(ms){
    if(!ms)return "never";
    var s=Math.max(0,Math.round((Date.now()-ms)/1000));
    if(s<45)return "just now"; if(s<3300)return Math.round(s/60)+" min ago";
    if(s<86400)return Math.round(s/3600)+" h ago"; return Math.round(s/86400)+" d ago";
  }
  function okMap(){try{return JSON.parse(localStorage.getItem(OKKEY)||"{}")}catch(e){return {}}}
  function stamp(id){var m=okMap();m[id]=Date.now();try{localStorage.setItem(OKKEY,JSON.stringify(m))}catch(e){}}

  // remember the last success of each status line the app already shows
  var WATCH=[
    ["parcelInboundSpxSyncStatus","SPX · Received / Transported","spx"],
    ["parcelDeliverySpxSyncStatus","SPX · Delivering / On-Hold","spx"],
    ["linehaulSpxSyncStatus","SPX · Incoming linehaul","spx"],
    ["pickupStatus","Google Sheet · Pickup","sheet"],
    ["performanceStatus","Google Sheet · Performance","sheet"],
    ["consolidatedStatus","Google Sheet · Consolidated","sheet"],
    ["eodStatus","Google Sheet · EOD data","sheet"],
    ["kpiStatus","Google Sheet · KPI","sheet"]
  ];
  var BAD=/unavailable|could not|couldn.t|failed|error|not reached|not connected|timed out/i;
  function stateOf(el,strict){
    if(!el)return {s:"idle",t:"Not opened yet"};
    var t=(el.textContent||"").replace(/\s+/g," ").trim();
    if(!t)return {s:"idle",t:"Not run yet"};
    if(el.classList.contains("is-error")||(!strict&&BAD.test(t))||(strict&&/failed|error|not logged in|timed out/i.test(t)&&!/last synced/i.test(t)))return {s:"fail",t:t};
    if(el.classList.contains("is-success"))return {s:"ok",t:t};
    if(strict||/not yet|loading|checking|waiting/i.test(t))return {s:"idle",t:t};
    if(/live|updated|synced|loaded|complete|done|ok\b/i.test(t))return {s:"ok",t:t};
    return {s:"idle",t:t};
  }
  function watchStatuses(){
    WATCH.forEach(function(w){
      var el=$(w[0]); if(!el||el.__hw)return; el.__hw=1;
      var check=function(){if(stateOf(el,w[2]==="spx").s==="ok")stamp(w[0])};
      new MutationObserver(check).observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]}); check();
    });
  }

  function row(state,title,detail,when){
    return '<li class="sh-'+state+'"><i></i><div><strong>'+esc(title)+'</strong><small>'+esc(detail)+'</small></div><span>'+esc(when||"")+'</span></li>';
  }
  async function build(){
    var rows=[],ok=okMap(),now=Date.now();
    // Local parcel storage is independent of cloud availability.
    var localStorageHealth=window.__badocGetStorageHealth?window.__badocGetStorageHealth():window.__badocStorageHealth||{};
    var localState=localStorageHealth.state==="persistent"?"ok":localStorageHealth.state==="memory-only"?"fail":"idle";
    rows.push(["Local data",row(localState,"Parcel Count storage",localStorageHealth.message||"Checking IndexedDB",ago(localStorageHealth.updatedAt||0))]);
    // cloud
    var ch=window.BadocCloud&&window.BadocCloud.health?window.BadocCloud.health():null;
    if(!ch)rows.push(["Cloud",row("fail","Cloud database","Not loaded (Firebase library missing?)","")]);
    else{
      var st=ch.connected===true?"ok":(ch.connected===false?"fail":"idle");
      var recentErr=ch.lastErrorAt&&now-ch.lastErrorAt<10*60*1000;
      rows.push(["Cloud",row(recentErr&&st==="ok"?"warn":st,"Cloud database",ch.connected===true?(recentErr?"Connected · last error: "+ch.lastError:"Connected"):(ch.connected===false?"Offline — changes will not sync":"Connecting…"),ago(ch.lastOkAt))]);
      var off=Math.round((ch.offset||0)/1000),big=Math.abs(off)>60;
      var t=window.__badocTime?window.__badocTime.manilaDate():new Date();
      rows.push(["Cloud",row(big?"warn":"ok","Clock (Manila time)",(big?"This device's clock is "+Math.abs(off)+" s "+(off>0?"behind":"ahead")+" — using the server clock. ":"In step with the server. ")+"Now "+String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0")+" Manila","")]);
    }
    var sh=document.querySelector("#sharedStatus .top-sync-text");
    rows.push(["Cloud",row(/ok|synced|connected/i.test(sh&&sh.textContent||"")?"ok":"idle","Shared data (this device)",(sh&&sh.textContent||"—"),"")]);
    var exSync=window.__badocExemptionSyncState||{};
    var exState=exSync.state==="ok"?"ok":exSync.state==="fail"?"fail":exSync.state==="warn"?"warn":"idle";
    rows.push(["Cloud",row(exState,"Exemption sync",exSync.message||"Waiting for cloud sync",exSync.lastOkAt?ago(exSync.lastOkAt):"")]);
    // SPX
    var bridge=false; try{bridge=!!(window.__badocSpxBridgeReady&&window.__badocSpxBridgeReady())}catch(e){}
    rows.push(["SPX imports",row(bridge?"ok":"idle","SPX Bridge extension",bridge?"Connected":"Not connected on this device (open from the approved site and reload the extension)","")]);
    WATCH.filter(function(w){return w[2]==="spx"}).forEach(function(w){var s=stateOf($(w[0]),true);rows.push(["SPX imports",row(s.s,w[1],s.t,ok[w[0]]?"last OK "+ago(ok[w[0]]):"")])});
    // Sheets
    WATCH.filter(function(w){return w[2]==="sheet"}).forEach(function(w){var s=stateOf($(w[0]));rows.push(["Google Sheets",row(s.s,w[1],s.t,ok[w[0]]?"last OK "+ago(ok[w[0]]):"")])});
    var f=H.fetches||{},keys=Object.keys(f);
    if(keys.length){var bad=keys.filter(function(k){return !f[k].ok});rows.push(["Google Sheets",row(bad.length?"warn":"ok","Sheet requests this session",keys.length+" feed(s) · "+(bad.length?bad.length+" failing":"all answered"),"")])}
    // Daily History + reset
    try{
      var c=window.BadocCloud.createClient(),r=await c.from("daily_history_index").select("*");
      var dates=(r.data||[]).map(function(x){return x.date}).filter(Boolean).sort(); var last=dates[dates.length-1]||"";
      var yday=(function(){var m=window.__badocTime.manilaDate();m.setDate(m.getDate()-1);return m.getFullYear()+"-"+String(m.getMonth()+1).padStart(2,"0")+"-"+String(m.getDate()).padStart(2,"0")})();
      var hour=window.__badocTime.manilaDate().getHours();
      var behind=last&&last<yday&&hour>=1;
      rows.push(["Daily records",row(!last?"idle":(behind?"warn":"ok"),"Daily History",last?("Newest saved day: "+last+(behind?" — yesterday ("+yday+") has not been saved yet":"")):"No days saved yet","")]);
    }catch(e){rows.push(["Daily records",row("idle","Daily History","Could not read saved days","")])}    try{
      var rs=JSON.parse(localStorage.getItem("badoc_reset_status")||"null");
      if(rs){var rst=rs.state==="done"||rs.state==="already-done"?"ok":(rs.state==="failed"?"fail":"idle");
        rows.push(["Daily records",row(rst,"12 AM reset (this device)",rs.date+" · "+rs.state+(rs.reason?" — "+rs.reason:""),ago(rs.at))])}
    }catch(e){}
    // Recent warnings are available on demand, but stay collapsed so raw
    // diagnostic messages do not spill into the normal page view.
    const ignoredExpected=/Another device is updating the CFR1 ledger|12:00 AM reset: another device owns the reset lock|CFR1 publish skipped: this device still has the previous daily ledger/i;
    const recentIssues=(H.issues||[]).filter(function(i){return !ignoredExpected.test(String(i.msg||""))});
    var issues=recentIssues.slice(0,12).map(function(i){return '<li class="sh-'+(i.kind==="error"?"fail":"warn")+'"><i></i><div><strong>'+esc(i.msg)+'</strong>'+(i.n>1?'<small>×'+i.n+'</small>':'')+'</div><span>'+esc(ago(i.at))+'</span></li>'}).join("");
    var groups={};rows.forEach(function(r){(groups[r[0]]=groups[r[0]]||[]).push(r[1])});
    var out=Object.keys(groups).map(function(g){return '<h4>'+esc(g)+'</h4><ul class="sh-list">'+groups[g].join("")+'</ul>'}).join("");
    out+='<h4>Local recovery</h4><p class="sh-none">Export a local Parcel Count backup before clearing browser data or changing devices.</p><p><button type="button" id="shExportParcelBackup">Export Parcel Count backup</button></p>';
    out+='<details class="sh-recent-errors"><summary>Recent warnings &amp; errors ('+recentIssues.length+')</summary><div class="sh-recent-errors-content"><button type="button" class="sh-clear" id="shClear">Clear warnings</button>'+(issues?'<ul class="sh-list">'+issues+'</ul>':'<p class="sh-none">Nothing reported on this device. ✓</p>')+'</div></details>';
    return out;
  }
  function ensureModal(){
    var m=$("syncHealthModal"); if(m)return m;
    m=document.createElement("div"); m.id="syncHealthModal"; m.className="sh-backdrop"; m.setAttribute("role","dialog"); m.setAttribute("aria-modal","true"); m.setAttribute("aria-label","Sync health"); m.hidden=true;
    m.innerHTML='<div class="sh-dialog"><div class="sh-head"><div><strong>Sync health</strong><small id="shSub">What is working, what is stale, what failed</small></div><div class="sh-actions"><button type="button" id="shRefresh">↻ Refresh</button><button type="button" id="shClose" aria-label="Close">✕</button></div></div><div class="sh-body" id="shBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click",function(e){
      if(e.target===m||e.target.closest("#shClose"))close();
      else if(e.target.closest("#shRefresh"))render();
      else if(e.target.closest("#shExportParcelBackup")){
        if(typeof window.__badocExportLocalParcelBackup==="function"){
          try{var result=window.__badocExportLocalParcelBackup();var sub=$("shSub");if(sub)sub.textContent="Backup exported · "+result.rows+" parcel rows across "+result.batches+" batches";}
          catch(error){var subError=$("shSub");if(subError)subError.textContent="Backup export failed: "+String(error&&error.message||error);}
        }
      }
      else if(e.target.closest("#shClear")){H.issues.length=0;render()}
    });
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!m.hidden)close()});
    return m;
  }
  async function render(){var b=$("shBody");if(!b)return;b.innerHTML='<p class="sh-none">Checking…</p>';b.innerHTML=await build()}
  function open(){var m=ensureModal();m.hidden=false;document.documentElement.classList.add("sh-open");render();var c=$("shClose");if(c)c.focus()}
  function close(){var m=$("syncHealthModal");if(m)m.hidden=true;document.documentElement.classList.remove("sh-open")}
  window.__badocHealthUI={open:open,close:close};

  document.addEventListener("click",function(e){
    if(e.target.closest("#syncHealthOpen")||e.target.closest("#sharedStatus")||e.target.closest("#healthSummary")){e.preventDefault();open()}
  });
  // dot on the sync badge when something failed in the last 10 minutes (checked only while the tab is visible)
  function dot(){
    if(document.hidden)return;
    var recent=(H.issues||[]).some(function(i){return i.kind==="error"&&Date.now()-i.at<10*60*1000});
    document.documentElement.classList.toggle("has-sync-issues",recent);
  }
  __badocEvery(dot,15000);
  function start(){watchStatuses();dot();__badocEvery(watchStatuses,10000)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
