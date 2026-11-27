(function(){
  if(window.__badocV206DailyHistory)return;
  window.__badocV206DailyHistory=true;

  const BUCKET="exported-files";
  const PREFIX="daily-history/";
  const SNAPSHOT_VERSION="v227";
  let historyClient=null;

  function cfg(){
    return window.BADOC_SHARED_CONFIG||{};
  }
  function client(){
    if(historyClient)return historyClient;
    const c=cfg();
    if(!window.BadocCloud||!c.url||!c.key)throw new Error("Cloud sync is not configured");
    historyClient=window.BadocCloud.createClient(c.url,c.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return historyClient;
  }
  function storage(){return client().storage.from(BUCKET)}
  // Return an unambiguous ISO timestamp in Philippines time (UTC+08:00).
  // Store it as text so the browser and Apps Script server timezone cannot shift it.
  function phTimestamp(date=new Date()){
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
    }).formatToParts(date);
    const p={};
    parts.forEach(part=>{if(part.type!=="literal")p[part.type]=part.value;});
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
  }
  function dayKey(d=__badocTime.manilaDate()){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function clean(v){return String(v??"").trim()}
  function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
  function pct(a,b){return b?n(a)/n(b)*100:0}
  function escH(v){return clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function statusOf(r){
    const keys=["Parcel Status To","Status To","TO Status","To Status","Status To (Current)","Status","Parcel Status","Delivery Status","Current Status"];
    for(const k of keys)if(r&&Object.prototype.hasOwnProperty.call(r,k)&&clean(r[k]))return clean(r[k]);
    const k=Object.keys(r||{}).find(x=>/status/i.test(x));
    return k?clean(r[k]):"";
  }
  function statusNorm(v){return clean(v).toUpperCase().replace(/[_-]+/g," ").replace(/\s+/g," ")}
  function statusCounts(rows){
    const out={received:0,delivered:0,delivering:0,hold:0};
    const onholdKeys=new Set(badocGetOnholdRows(rows).map(r=>badocOnholdKey(spxTN(r))).filter(Boolean));
    (rows||[]).forEach(r=>{
      const s=statusNorm(statusOf(r));
      const tn=clean(typeof spxTN==="function"?spxTN(r):r?.["SPX TN"]||r?.["SLS Tracking Number"]||"");
      const isOnhold=!!tn&&onholdKeys.has(badocOnholdKey(tn));
      if(isOnhold)out.hold++;
      else if(s==="RECEIVED"||s==="LMHUB RECEIVED")out.received++;
      else if(s==="DELIVERED")out.delivered++;
      else if(s==="DELIVERING")out.delivering++;
    });
    return out;
  }
  function selectedRider(key,index){
    try{return clean((typeof getTownNotes==="function"?getTownNotes(key):[])[index]||"")}catch(e){return ""}
  }
  function layoutSnapshot(){
    const out=[];
    [["badoc","BADOC"],["pinili","PINILI"]].forEach(([key,label])=>{
      let groups=[];
      try{groups=typeof getTownLayout==="function"?getTownLayout(key):[]}catch(e){}
      groups.forEach((group,index)=>{
        const rider=selectedRider(key,index);
        let riderRecord=null;
        try{
          const rk=r=>clean(r["Driver Name"]).toUpperCase().replace(/[\s_-]+/g,"");
          const target=rider.toUpperCase().replace(/[\s_-]+/g,"");
          riderRecord=(Array.isArray(ridersData)?ridersData:[]).find(r=>rk(r)===target)||null;
        }catch(e){}
        const vehicle=clean(riderRecord?.["Vehicle Type"]);
        const is3wc=vehicle.toUpperCase().replace(/[\s_-]+/g,"")==="3WC";
        const is2wh=vehicle.toUpperCase().replace(/[\s_-]+/g,"")==="2WH";
        const isFlex=/FLEXI|FLEX/i.test(vehicle);
        out.push({area:key.toUpperCase(),label,position:index+1,towns:(group||[]).map(clean).filter(Boolean),rider,riderId:clean(riderRecord?.["Rider ID"]||riderRecord?.["ID"]),vehicleType:vehicle,is3wc,is2wh,isFlex});
      });
    });
    return out;
  }
  function buildSnapshot(date){
    // Refresh Dashboard's live operational metrics first. Data must use the
    // same SPX TN deduplication, date, status and exception rules as Dashboard.
    try{
      if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
    }catch(error){
      console.warn("Daily History could not refresh Dashboard operational metrics:",error);
    }
    const readDashboardCount=(id,fallback)=>{
      const node=document.getElementById(id);
      const raw=clean(node&&node.textContent).replace(/,/g,"");
      if(!/^\d+(?:\.\d+)?$/.test(raw))return fallback;
      const value=Number(raw);
      return Number.isFinite(value)?value:fallback;
    };
    const rows=typeof getParcelCountRows==="function"?getParcelCountRows():[];
    const liveCfr1=window.__badocCfr1Details||{};
    const cfr1HistoryScanned=Array.isArray(liveCfr1.scanned)?liveCfr1.scanned.map(r=>({
      orderId:clean(r?.orderId||""),town:clean(r?.town||""),status:clean(r?.status||""),
      receivedTime:clean(r?.receivedTime||""),scannedTime:clean(r?.scannedTime||"")
    })):[];
    const cfr1HistoryUnscanned=Array.isArray(liveCfr1.unscanned)?liveCfr1.unscanned.map(r=>({
      orderId:clean(r?.orderId||""),town:clean(r?.town||""),status:clean(r?.status||""),
      receivedTime:clean(r?.receivedTime||""),scannedTime:""
    })):[];
    const cfr1HistoryScannedCount=Math.max(0,n(liveCfr1.scannedCount??cfr1HistoryScanned.length));
    const cfr1HistoryTotalCount=Math.max(cfr1HistoryScannedCount,n(liveCfr1.totalCount??(cfr1HistoryScanned.length+cfr1HistoryUnscanned.length)));
    const cfr1HistoryUnscannedCount=Math.max(0,cfr1HistoryTotalCount-cfr1HistoryScannedCount);
    const mis=Array.isArray(current?.mis)?current.mis:[];
    const exemptionLookupRows=[
      ...(Array.isArray(current?.valid)?current.valid:[]),
      ...(Array.isArray(current?.mis)?current.mis:[]),
      ...(Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows:[]),
      ...(typeof getParcelCountRows==="function"?getParcelCountRows({includeExemptions:true}):[])
    ];
    const exemptionRowsByTn=new Map();
    exemptionLookupRows.forEach(row=>{
      const tn=clean(typeof spxTN==="function"?spxTN(row):"");
      const key=tn.toUpperCase().replace(/[\\s\\-_.]/g,"");
      if(key)exemptionRowsByTn.set(key,row);
    });
    const exemptionDetails=(Array.isArray(exceptionTrackingNumbers)?exceptionTrackingNumbers:[]).map(value=>{
      const tracking=clean(value);
      const key=tracking.toUpperCase().replace(/[\\s\\-_.]/g,"");
      const row=exemptionRowsByTn.get(key)||null;
      return {tracking,orderId:clean(row?.["Order ID"]||row?.["Shopee Order SN"]||row?.["Order SN"]||""),
        town:clean(row?.["Town Name"]||row?.["Town"]||row?.["town"]||""),
        currentStation:clean(row?.["Current Station"]||""),status:row?statusOf(row):""};
    });
    const incomingEnabled=typeof parcelIncomingEnabled==="function"&&parcelIncomingEnabled();
    const incoming= incomingEnabled&&typeof getParcelIncomingLinehaul==="function"
      ? getParcelIncomingLinehaul()
      : {total:0,townCounts:{}};

    const areaRows={
      Badoc:rows.filter(r=>r?._area==="Badoc"),
      Pinili:rows.filter(r=>r?._area==="Pinili")
    };
    const allStatus=statusCounts(rows);
    const delivered=allStatus.delivered;
    const onHold=allStatus.hold;
    const statusDen=allStatus.received+allStatus.delivered+allStatus.delivering+allStatus.hold;
    const totalVolume=rows.length+n(incoming.total);
    const riderGroups=layoutSnapshot();

    // EOD Riders and Leaderboard share the same deduplicated actual-scanner data as the dashboard page.
    const actualScanData=typeof window.__badocGetActualScannedByRidersData==="function"
      ?window.__badocGetActualScannedByRidersData():{records:[],sourceCount:0};
    const actualParcelRecords=Array.isArray(actualScanData?.records)?actualScanData.records:[];
    const actualRecords=actualParcelRecords.filter(r=>r&&r.hasScanner);
    const normRiderName=v=>clean(v).toUpperCase().replace(/[\s_-]+/g,"");
    const layoutByRiderArea=new Map();
    riderGroups.forEach(g=>{if(clean(g.rider)){const k=normRiderName(g.rider)+"|"+clean(g.area).toUpperCase();if(!layoutByRiderArea.has(k))layoutByRiderArea.set(k,g);}});
    const actualRiderGroups=new Map(),leaderboardGroups=new Map(),uniqueActualRiders=new Map();
    actualRecords.forEach(r=>{
      const riderKey=clean(r.riderKey)||(r.actualId?"ID:"+normRiderName(r.actualId):"NAME:"+normRiderName(r.actualName));
      const name=clean(r.actualName)||(riderKey||"Unidentified");
      if(!riderKey)return;
      const rowArea=clean(r.area).toUpperCase();
      const fallbackLayout=[...layoutByRiderArea.values()].find(g=>normRiderName(g.rider)===normRiderName(name));
      const area=(rowArea==="BADOC"||rowArea==="PINILI")?rowArea:(fallbackLayout?.area||"UNASSIGNED");
      const layout=layoutByRiderArea.get(normRiderName(name)+"|"+area)||fallbackLayout||null;
      const vehicle=clean(r.vehicle||layout?.vehicleType||"UNKNOWN").toUpperCase();
      const groupKey=riderKey+"|"+area;
      if(!actualRiderGroups.has(groupKey))actualRiderGroups.set(groupKey,{key:groupKey,riderKey,name,area,vehicle,scannedCount:0,delivered:0,delivering:0,onHold:0,townBreakdown:new Map()});
      const g=actualRiderGroups.get(groupKey);g.scannedCount++;
      if(r.delivered)g.delivered++;if(r.delivering)g.delivering++;if(r.onhold)g.onHold++;
      if(g.vehicle==="UNKNOWN"&&vehicle!=="UNKNOWN")g.vehicle=vehicle;
      const town=clean(r.town);
      if(town){const townKey=normRiderName(town);if(!g.townBreakdown.has(townKey))g.townBreakdown.set(townKey,{town,count:0,delivered:0,delivering:0,onHold:0});
        const t=g.townBreakdown.get(townKey);t.count++;if(r.delivered)t.delivered++;if(r.delivering)t.delivering++;if(r.onhold)t.onHold++;}
      if(!uniqueActualRiders.has(riderKey))uniqueActualRiders.set(riderKey,{name,vehicle});
      else if(uniqueActualRiders.get(riderKey).vehicle==="UNKNOWN"&&vehicle!=="UNKNOWN")uniqueActualRiders.get(riderKey).vehicle=vehicle;
      if(!leaderboardGroups.has(riderKey))leaderboardGroups.set(riderKey,{riderKey,name,vehicle,scanned:0,delivered:0,delivering:0,onHold:0});
      const leader=leaderboardGroups.get(riderKey);leader.scanned++;
      if(r.delivered)leader.delivered++;if(r.delivering)leader.delivering++;if(r.onhold)leader.onHold++;
      if(leader.vehicle==="UNKNOWN"&&vehicle!=="UNKNOWN")leader.vehicle=vehicle;
    });
    const actualRiderPerformance=[...actualRiderGroups.values()].map(g=>{
      const layout=layoutByRiderArea.get(normRiderName(g.name)+"|"+g.area)||null;
      const townDetails=[...g.townBreakdown.values()].sort((a,b)=>b.count-a.count||a.town.localeCompare(b.town)).map(t=>({
        town:t.town,delivered:t.delivered,delivering:t.delivering,onHold:t.onHold,total:t.count,
        successRate:pct(t.delivered,t.count)
      }));
      const label=g.area==="BADOC"?"BADOC":g.area==="PINILI"?"PINILI":(layout?.label||"UNASSIGNED");
      return {area:g.area,label,position:Number(layout?.position)||0,rider:g.name,riderId:clean(layout?.riderId),vehicleType:g.vehicle,
        towns:townDetails.map(t=>t.town),townDetails,delivered:g.delivered,delivering:g.delivering,onHold:g.onHold,
        total:g.scannedCount,scanned:g.scannedCount,successRate:pct(g.delivered,g.scannedCount)};
    }).sort((a,b)=>a.area.localeCompare(b.area)||a.position-b.position||a.rider.localeCompare(b.rider));
    let three=0,two=0,flex=0;
    uniqueActualRiders.forEach(r=>{const v=clean(r.vehicle).toUpperCase().replace(/[\s_-]+/g,"");
      if(v==="3WH"||v==="3WC"||v==="3W")three++;else if(v==="2WH"||v==="2W")two++;else if(v==="FLEXI"||v==="FLEX")flex++;});
    const eodLeaderboard=[...leaderboardGroups.values()].sort((a,b)=>b.scanned-a.scanned||a.name.localeCompare(b.name))
      .map((r,index)=>({rank:index+1,service:r.vehicle,name:r.name,scanned:r.scanned,delivered:r.delivered,delivering:r.delivering,
        onHold:r.onHold,successRate:pct(r.delivered,r.scanned)}));
    const historyDispatched=totalVolume;
    const historyDelivered=allStatus.delivered;
    const historyOnhold=allStatus.hold;
    const historyRedelivery=readDashboardCount("opRedelivery",0);
    const historyRts=readDashboardCount("opRts",0);

    const groupDetails=actualRiderPerformance;

    return {
      version:SNAPSHOT_VERSION,
      date,
      capturedAt:phTimestamp(),
      captureReason:"pre-reset",
      source:{
        topTotals:"Planning Board source: current Parcel Count rows + enabled incoming linehaul for total volume",
        parcelCount:"Current Parcel Count dataset (merged uploaded parcel CSVs), deduplicated by SPX TN",
        linehaul:incomingEnabled?"Current Linehaul Task dataset":"Not included (incoming linehaul disabled)",
        riders:"Actual Scanned by Riders: unique Parcel Count TNs with recognized actual Driver/Rider ID or name",
        townCounts:"Current Town Counts layout and parcel statuses",
        onHold:"Uploaded Parcel Count On-Hold status + latest SPX Forward/Return exports, deduplicated by SPX TN",
        riderPositions:"Current Town Counts rider selections/positions",
        misrouted:"Current Parcel Count misrouted rows",
        exemptions:"Current exception/exemption tracking list",
        cfr1:"Current CFR1 ledger and scanned/unscanned details, including source Received Time and first Scanned Time"
      },
      metrics:{
        totalVolume:historyDispatched,
        delivered:historyDelivered,
        onHold:historyOnhold,
        redelivery:historyRedelivery,
        rts:historyRts,
        successRate:pct(historyDelivered,historyDelivered+historyOnhold+allStatus.delivering+allStatus.received),
        threeWcRiders:three,
        twoWhRiders:two,
        flexiRiders:flex,
        totalRiders:uniqueActualRiders.size,
        misrouted:mis.length,
        exemptions:Array.isArray(exceptionTrackingNumbers)?exceptionTrackingNumbers.length:0,
        cfr1Total:cfr1HistoryTotalCount,
        cfr1Scanned:cfr1HistoryScannedCount,
        cfr1Unscanned:cfr1HistoryUnscannedCount
      },
      cfr1:{
        totalCount:cfr1HistoryTotalCount,
        scannedCount:cfr1HistoryScannedCount,
        unscannedCount:cfr1HistoryUnscannedCount,
        scanned:cfr1HistoryScanned,
        unscanned:cfr1HistoryUnscanned
      },
      eodLeaderboard,
      misroutedDetails:mis.map(r=>({
        tracking:clean(r?.["SLS Tracking Number"]||r?.["SLS Tracking"]||r?.["SPX TN"]||r?.["Tracking Number"]||r?.["Order ID"]||""),
        orderId:clean(r?.["Order ID"]||""),
        town:clean(r?.["Town Name"]||r?.["Town"]||""),
        currentStation:clean(r?.["Current Station"]||""),
        status:statusOf(r)
      })),
      exemptionDetails,
      // Show the coverage behind rider percentages: rows without an actual
      // Driver/Rider ID or name cannot be assigned to an individual rider.
      riderAttribution:{
        eligibleParcels:actualParcelRecords.length,
        attributedParcels:actualRecords.length,
        unattributedParcels:Math.max(0,actualParcelRecords.length-actualRecords.length)
      },
      riderPerformance:groupDetails,
      townPerformance:Object.entries(areaRows).flatMap(([area,areaList])=>{
        const byTown=new Map();
        areaList.forEach(r=>{
          const town=clean(r?.["Town Name"]||r?.["Town"]||"");
          if(!town)return;
          if(!byTown.has(town))byTown.set(town,[]);
          byTown.get(town).push(r);
        });
        return [...byTown.entries()].map(([town,townRows])=>{
          const ts=statusCounts(townRows);
          const den=ts.received+ts.delivered+ts.delivering+ts.hold;
          return {area,town,delivered:ts.delivered,onHold:ts.hold,delivering:ts.delivering,received:ts.received,total:townRows.length,successRate:pct(ts.delivered,den)};
        });
      }),
      townCounts:{
        Badoc:areaRows.Badoc.map(r=>clean(r["Town Name"])).filter(Boolean).reduce((m,t)=>(m[t]=(m[t]||0)+1,m),{}),
        Pinili:areaRows.Pinili.map(r=>clean(r["Town Name"])).filter(Boolean).reduce((m,t)=>(m[t]=(m[t]||0)+1,m),{})
      },
      rawState:{
        linehaulIncluded:incomingEnabled,
        incomingTotal:n(incoming.total),
        incomingTownCounts:incoming.townCounts||{}
      }
    };
  }

  // ───────── Firebase storage for Daily History ─────────
  // /badoc/blobs/exported-files/daily-history/<date>.json  full snapshot (gzip)
  // /badoc/rows/daily_history_index/<date>                 small metrics row for lists/trends
  // /badoc/blobs/exported-files/cfr-summary/<date>.json    CFR daily summary
  const INDEX_TABLE="daily_history_index";
  const CFR_PREFIX="cfr-summary/";
  const isDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(clean(d));
  function indexRow(s){
    const m=s.metrics||{};
    return {id:s.date,date:s.date,capturedAt:s.capturedAt||"",reason:s.captureReason||"",
      totalVolume:n(m.totalVolume),delivered:n(m.delivered),onHold:n(m.onHold),redelivery:n(m.redelivery),rts:n(m.rts),
      successRate:n(m.successRate),totalRiders:n(m.totalRiders),cfr1Total:n(m.cfr1Total),cfr1Scanned:n(m.cfr1Scanned),
      misrouted:n(m.misrouted),exemptions:n(m.exemptions)};
  }
  async function listIndex(){
    const r=await client().from(INDEX_TABLE).select("*");
    if(r.error)throw new Error(r.error.message||"Daily History index failed");
    const rows=(r.data||[]).filter(x=>x&&isDate(x.date)).sort((a,b)=>a.date<b.date?1:-1);
    window.__badocDailyHistoryIndex=rows;
    return rows;
  }
  async function saveSnapshot(snapshot,markFinal=false){
    if(!snapshot||!isDate(snapshot.date))throw new Error("Daily History snapshot is missing its date.");
    if(!snapshot.metrics||typeof snapshot.metrics!=="object")throw new Error("Daily History snapshot has no metrics object.");
    const blob=new Blob([JSON.stringify(snapshot)],{type:"application/json"});
    const up=await storage().upload(PREFIX+snapshot.date+".json",blob,{contentType:"application/json",upsert:true});
    if(up.error)throw new Error(up.error.message||"Daily History cloud save failed");
    let indexError=null;
    for(let attempt=0;attempt<3;attempt++){
      const ix=await client().from(INDEX_TABLE).upsert(indexRow(snapshot),{onConflict:"id"});
      if(!ix.error){indexError=null;break;}
      indexError=ix.error;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
    }
    if(indexError)throw new Error("Daily History snapshot file saved, but its index could not be verified: "+String(indexError.message||indexError));
    const verified=await loadSnapshot(snapshot.date);
    if(!verified||verified.date!==snapshot.date||!verified.metrics)throw new Error("Daily History read-back verification failed for "+snapshot.date);
    if(markFinal){try{localStorage.setItem("badoc_daily_history_last_saved_v210",snapshot.date)}catch(e){}}
    return true;
  }
  async function listSnapshots(){
    let dates=[];
    try{dates=(await listIndex()).map(r=>r.date)}catch(e){console.warn("Daily History index:",e)}
    try{
      const r=await storage().list(PREFIX,{limit:1000});
      (r.data||[]).map(x=>clean(x.name)).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).forEach(x=>dates.push(x.slice(0,-5)));
    }catch(e){}
    return [...new Set(dates.filter(isDate))].sort().reverse();
  }
  async function loadSnapshot(date){
    if(!date)return null;
    const r=await storage().download(PREFIX+date+".json");
    if(r.error){
      if(/not found|404|object not found/i.test(r.error.message||""))return null;
      throw new Error(r.error.message||"Daily History download failed");
    }
    return JSON.parse(await r.data.text());
  }
  // Public read-only bridge for the separate 12 AM reset IIFE. The function
  // lives inside this module, so reset recovery must not call loadSnapshot by
  // its private name from another script scope.
  window.__badocLoadDailyHistorySnapshot=loadSnapshot;

    // ───────── Daily History UI (v7) ─────────
  const ui={tab:"riders",area:"all",q:"",below:false,sort:"pos",cfr:"unscanned",open:new Set()};
  const snapCache=new Map();
  let curDate=null,lastHtml="",loadSeq=0;
  const srClass=p=>{p=n(p);return p<=0?"":p>=95?"good":p>=90?"warn":"low"};
  const fmt=v=>n(v).toLocaleString();
  const fmt1=v=>n(v).toFixed(1);
  const prettyDate=d=>{
    if(!isDate(d))return clean(d);
    const t=new Date(d+"T00:00:00");
    return t.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
  };
  const shortDate=d=>isDate(d)?new Date(d+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}):clean(d);
  const timeOf=iso=>{const m=/T(\d{2}:\d{2})/.exec(clean(iso));return m?m[1]:""};

  function prevRow(date){
    const rows=Array.isArray(window.__badocDailyHistoryIndex)?window.__badocDailyHistoryIndex:[];
    return rows.find(r=>r.date<date)||null;
  }
  function delta(cur,prev,lowerIsBetter){
    if(prev==null||!Number.isFinite(Number(prev)))return "";
    const d=n(cur)-n(prev);
    if(Math.abs(d)<0.05)return '<em class="dh2-d">no change</em>';
    const up=d>0,good=lowerIsBetter?!up:up;
    return `<em class="dh2-d ${good?"is-good":"is-bad"}">${up?"▲":"▼"} ${Math.abs(d).toLocaleString(undefined,{maximumFractionDigits:1})}</em>`;
  }
  function card(label,value,sub,cls,attrs){
    return `<div class="dh2-card ${cls||""}" ${attrs||""}><span class="dh2-card-l">${escH(label)}</span><strong>${escH(value)}</strong>${sub||""}</div>`;
  }

  // ── trend charts (inline SVG) ──
  function trendPoints(s){
    const rows=(Array.isArray(window.__badocDailyHistoryIndex)?window.__badocDailyHistoryIndex:[]).filter(r=>r.date!==s.date);
    const m=s.metrics||{};
    rows.push({date:s.date,totalVolume:n(m.totalVolume),successRate:n(m.successRate),delivered:n(m.delivered)});
    return rows.sort((a,b)=>a.date<b.date?-1:1).slice(-14);
  }
  function chart(points,key,title,kind,selDate,suffix){
    if(points.length<2)return `<div class="dh2-chart"><div class="dh2-chart-t">${escH(title)}</div><div class="dh2-chart-empty">Capture a few days to see the trend.</div></div>`;
    const W=300,H=96,pad=6,vals=points.map(p=>n(p[key]));
    let lo=kind==="line"?Math.max(0,Math.min(...vals)-5):0,hi=Math.max(...vals,1);
    if(kind==="line"){hi=Math.min(100,Math.max(hi+2,lo+10));}
    const step=(W-pad*2)/points.length,y=v=>H-pad-((v-lo)/(hi-lo||1))*(H-pad*2-10);
    let g="";
    if(kind==="bars"){
      g=points.map((p,i)=>{const h=Math.max(2,H-pad-y(n(p[key]))),x=pad+i*step+step*.15,sel=p.date===selDate;
        return `<g class="dh2-pt${sel?" is-sel":""}" data-dh-date="${escH(p.date)}"><rect x="${x.toFixed(1)}" y="${(H-pad-h).toFixed(1)}" width="${(step*.7).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/><rect class="dh2-hit" x="${(pad+i*step).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}"/><title>${escH(shortDate(p.date))}: ${escH(fmt(p[key])+(suffix||""))}</title></g>`}).join("");
    }else{
      const xy=points.map((p,i)=>[pad+i*step+step/2,y(n(p[key]))]);
      g=`<polyline class="dh2-line" points="${xy.map(a=>a[0].toFixed(1)+","+a[1].toFixed(1)).join(" ")}"/>`+
        points.map((p,i)=>`<g class="dh2-pt${p.date===selDate?" is-sel":""}" data-dh-date="${escH(p.date)}"><circle cx="${xy[i][0].toFixed(1)}" cy="${xy[i][1].toFixed(1)}" r="${p.date===selDate?4.5:3}"/><rect class="dh2-hit" x="${(pad+i*step).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}"/><title>${escH(shortDate(p.date))}: ${escH(fmt1(p[key])+(suffix||""))}</title></g>`).join("");
    }
    const last=points[points.length-1];
    return `<div class="dh2-chart"><div class="dh2-chart-t"><span>${escH(title)}</span><b>${escH(kind==="line"?fmt1(last[key]):fmt(last[key]))}${escH(suffix||"")}</b></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escH(title)}">${g}</svg>
      <div class="dh2-chart-x"><span>${escH(shortDate(points[0].date))}</span><span>${escH(shortDate(last.date))}</span></div></div>`;
  }

  // ── tabs ──
  function matchQ(...parts){const q=ui.q.trim().toLowerCase();return !q||parts.join(" ").toLowerCase().includes(q)}
  function toolbar(withRiderControls){
    return `<div class="dh2-tools"><input type="search" class="dh2-search" data-dh-q placeholder="${withRiderControls?"Search rider or town…":"Search town…"}" value="${escH(ui.q)}" autocomplete="off">
      <select data-dh-area aria-label="Area"><option value="all"${ui.area==="all"?" selected":""}>All areas</option><option value="BADOC"${ui.area==="BADOC"?" selected":""}>Badoc</option><option value="PINILI"${ui.area==="PINILI"?" selected":""}>Pinili</option></select>
      ${withRiderControls?`<select data-dh-sort aria-label="Sort"><option value="pos"${ui.sort==="pos"?" selected":""}>Layout order</option><option value="low"${ui.sort==="low"?" selected":""}>Lowest success first</option><option value="high"${ui.sort==="high"?" selected":""}>Highest success first</option></select>`:""}
      <button type="button" class="dh2-pill${ui.below?" is-on":""}" data-dh-below>Below 90%</button></div>`;
  }
  function statRow(o){
    return `<div class="dh2-stats"><span><b>${fmt(o.delivered)}</b>Delivered</span><span><b>${fmt(o.onHold)}</b>On hold</span><span><b>${fmt(o.total)}</b>Total</span></div>`;
  }
  function tabRiders(s){
    let g=(Array.isArray(s.riderPerformance)?s.riderPerformance:[]).filter(x=>ui.area==="all"||clean(x.area).toUpperCase()===ui.area);
    g=g.filter(x=>matchQ(x.rider,(x.towns||[]).join(" ")));
    if(ui.below)g=g.filter(x=>clean(x.rider)&&n(x.successRate)<90);
    if(ui.sort==="low")g=g.slice().sort((a,b)=>(clean(a.rider)?0:1)-(clean(b.rider)?0:1)||n(a.successRate)-n(b.successRate));
    if(ui.sort==="high")g=g.slice().sort((a,b)=>n(b.successRate)-n(a.successRate));
    const cards=g.map(x=>{
      const key=clean(x.area)+"|"+x.position,sr=n(x.successRate),name=clean(x.rider),cls=name?srClass(sr):"";
      const towns=Array.isArray(x.townDetails)?x.townDetails:[];
      return `<article class="dh2-rider sr-${cls||"none"}" data-rider-name="${escH(name)}">
        <header><div><strong>${name?escH(name):'<i>No rider assigned</i>'}</strong><small>${escH(clean(x.label||x.area))}${n(x.position)>0?" · Group "+n(x.position):""}${x.vehicleType?" · "+escH(x.vehicleType):""}</small></div><div class="dh2-sr">${name?fmt1(sr)+"%":"—"}</div></header>
        <div class="dh2-bar"><i style="width:${Math.min(100,Math.max(0,sr)).toFixed(1)}%"></i></div>
        ${statRow(x)}
        <div class="dh2-chips-sm">${(x.towns||[]).map(t=>`<span>${escH(t)}</span>`).join("")}</div>
        ${towns.length?`<details data-dh-open="${escH(key)}"${ui.open.has(key)?" open":""}><summary>Town breakdown</summary><div class="dh2-mini">${towns.map(t=>`<div><span>${escH(t.town)}</span><span>${fmt(t.delivered)}/${fmt(t.total)}</span><b class="sr-${srClass(t.successRate)||"none"}">${fmt1(t.successRate)}%</b></div>`).join("")}</div></details>`:""}
      </article>`}).join("");
    const a=s.riderAttribution&&typeof s.riderAttribution==="object"?s.riderAttribution:null;
    const attributionNote=a?`<div class="dh2-note">Source: ${fmt(a.eligibleParcels)} unique eligible Parcel Count parcels; ${fmt(a.attributedParcels)} have an actual Driver/Rider ID or name and are included in rider rates; ${fmt(a.unattributedParcels)} without an identifiable actual rider are excluded. Success rate = Delivered ÷ attributed parcels. Planned Assigned Rider is not used.</div>`:"";
    return toolbar(true)+attributionNote+(cards?`<div class="dh2-grid">${cards}</div>`:'<div class="dh2-empty">No riders match these filters.</div>');
  }
  function tabTowns(s){
    let t=(Array.isArray(s.townPerformance)?s.townPerformance:[]).filter(x=>x&&clean(x.town)&&(ui.area==="all"||clean(x.area).toUpperCase()===ui.area));
    t=t.filter(x=>matchQ(x.town));
    if(ui.below)t=t.filter(x=>n(x.successRate)<90);
    t=t.slice().sort((a,b)=>n(a.successRate)-n(b.successRate)||String(a.town).localeCompare(String(b.town)));
    const rows=t.map(x=>`<tr><td><div class="dh2-town-cell"><strong>${escH(x.town)}</strong><small class="dh2-area-label">${escH(x.area)}</small></div></td><td>${fmt(x.delivered)}</td><td>${fmt(x.onHold)}</td><td>${fmt(x.total)}</td><td><div class="dh2-rate"><i class="sr-${srClass(x.successRate)||"none"}" style="--w:${Math.min(100,n(x.successRate)).toFixed(1)}%"></i><b>${fmt1(x.successRate)}%</b></div></td></tr>`).join("");
    return toolbar(false)+(rows?`<div class="dh2-tablewrap"><table class="dh2-table"><thead><tr><th>Town</th><th>Delivered</th><th>On hold</th><th>Total</th><th>Success</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="dh2-empty">No towns match these filters.</div>');
  }
  function tabCfr1(s){
    const c=s.cfr1&&typeof s.cfr1==="object"?s.cfr1:null,m=s.metrics||{};
    if(!c)return '<div class="dh2-empty">This snapshot was captured before CFR1 history existed, so CFR1 details are not available.</div>';
    const sc=Array.isArray(c.scanned)?c.scanned:[],un=Array.isArray(c.unscanned)?c.unscanned:[];
    const total=n(c.totalCount??m.cfr1Total),scn=n(c.scannedCount??m.cfr1Scanned??sc.length),unc=n(c.unscannedCount??Math.max(0,total-scn));
    const list=ui.cfr==="scanned"?sc:un,LIM=500,showScan=ui.cfr==="scanned";
    const rows=list.slice(0,LIM).map(r=>`<tr><td>${escH(r.orderId||"—")}</td><td>${escH(r.town||"—")}</td><td>${escH(r.status||"—")}</td><td>${escH(r.receivedTime||"—")}</td>${showScan?`<td>${escH(r.scannedTime||"—")}</td>`:""}</tr>`).join("");
    return `<div class="dh2-cards dh2-cards-3">${card("CFR1 total",fmt(total))}${card("Scanned",fmt(scn),"","is-good")}${card("Unscanned",fmt(unc),"",unc?"is-bad":"")}</div>
      <div class="dh2-tools"><div class="dh2-seg"><button type="button" data-dh-cfr="unscanned" class="${ui.cfr==="unscanned"?"is-on":""}" aria-pressed="${ui.cfr==="unscanned"?"true":"false"}">Unscanned (${fmt(un.length)})</button><button type="button" data-dh-cfr="scanned" class="${ui.cfr==="scanned"?"is-on":""}" aria-pressed="${ui.cfr==="scanned"?"true":"false"}">Scanned (${fmt(sc.length)})</button></div>
      <button type="button" class="dh2-pill" data-action="daily-history-copy-cfr1-ids">Copy Order IDs</button></div>
      ${rows?`<div class="dh2-tablewrap dh2-tall"><table class="dh2-table"><thead><tr><th>Order ID</th><th>Town</th><th>Status</th><th>Received</th>${showScan?"<th>Scanned</th>":""}</tr></thead><tbody>${rows}</tbody></table></div>${list.length>LIM?`<div class="dh2-note">Showing first ${LIM} of ${fmt(list.length)}. Use Copy Order IDs for the full list.</div>`:""}`:`<div class="dh2-empty">No ${ui.cfr} CFR1 parcels saved for this date.</div>`}`;
  }
  function tabBoard(s){
    const l=Array.isArray(s.eodLeaderboard)?s.eodLeaderboard:[];
    if(!l.length)return '<div class="dh2-empty">No riders with recognized actual scans for this date.</div>';
    return '<div class="dh2-tablewrap"><table class="dh2-table"><thead><tr><th>#</th><th>Rider</th><th>Vehicle</th><th>Scanned</th><th>Delivered</th><th>On hold</th><th>Success</th></tr></thead><tbody>'+l.map(r=>
      '<tr><td>'+escH(r.rank)+'</td><td><strong>'+escH(r.name)+'</strong></td><td>'+escH(r.service||"—")+'</td>'+
      '<td>'+fmt(r.scanned)+'</td><td>'+fmt(r.delivered)+'</td><td>'+fmt(r.onHold)+'</td><td>'+fmt1(r.successRate)+'%</td></tr>').join("")+
      '</tbody></table></div>';
  }
  function tabExceptions(s){
    const mis=Array.isArray(s.misroutedDetails)?s.misroutedDetails:[];
    const rawEx=Array.isArray(s.exemptionDetails)?s.exemptionDetails:[];
    const ex=rawEx.map(r=>typeof r==="string"?({tracking:r,orderId:"",town:"",currentStation:"",status:""}):(r||{}));
    const parcelTable=rows=>rows.length?'<div class="dh2-tablewrap"><table class="dh2-table dh2-exception-table"><thead><tr><th>Tracking</th><th>Order ID</th><th>Town</th><th>Current station</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>
      '<tr><td>'+escH(r.tracking||"—")+'</td><td>'+escH(r.orderId||"—")+'</td><td>'+escH(r.town||"—")+'</td><td>'+escH(r.currentStation||"—")+'</td><td>'+escH(r.status||"—")+'</td></tr>').join("")+
      '</tbody></table></div>':'<div class="dh2-empty">No matching parcels.</div>';
    return '<h4 class="dh2-h">Exemptions <span>'+fmt(ex.length)+'</span></h4>'+
      (ex.length?parcelTable(ex):'<div class="dh2-empty">No exemptions.</div>')+
      '<h4 class="dh2-h">Misrouted parcels <span>'+fmt(mis.length)+'</span></h4>'+
      (mis.length?parcelTable(mis):'<div class="dh2-empty">No misrouted parcels.</div>');
  }
      function buildHtml(s,date,live){
    const m=s.metrics||{},prev=prevRow(date),groups=Array.isArray(s.riderPerformance)?s.riderPerformance:[],towns=Array.isArray(s.townPerformance)?s.townPerformance:[];
    const riderBelow=groups.filter(g=>clean(g.rider)&&n(g.successRate)<90).length,townBelow=towns.filter(t=>clean(t.town)&&n(t.successRate)<90).length;
    const sr=n(m.successRate);
    const cfr=n(m.cfr1Total);
    const cards=[
      card("Total volume",fmt(m.totalVolume),delta(m.totalVolume,prev&&prev.totalVolume)),
      card("Delivered",fmt(m.delivered),delta(m.delivered,prev&&prev.delivered),"is-good"),
      card("On hold",fmt(m.onHold),delta(m.onHold,prev&&prev.onHold,true),"is-warn"),
      card("Success rate",fmt1(sr)+"%",delta(sr,prev&&prev.successRate),"sr-"+(srClass(sr)||"none")),
      card("Redeliver",fmt(m.redelivery),delta(m.redelivery,prev&&prev.redelivery,true)),
      card("RTS",fmt(m.rts),delta(m.rts,prev&&prev.rts,true))
    ].join("");
    const fleet=`<div class="dh2-fleet"><span><b>${fmt(m.threeWcRiders)}</b>3WC</span><span><b>${fmt(m.twoWhRiders)}</b>2WH</span><span><b>${fmt(m.flexiRiders)}</b>Flexi</span><span><b>${fmt(m.totalRiders)}</b>Total riders</span><span><b>${fmt(cfr)}</b>CFR1</span>
      <button type="button" class="dh2-alert${riderBelow?"":" is-disabled"}" data-action="daily-history-below90">${fmt(riderBelow)} riders below 90%</button>
      <button type="button" class="dh2-alert${townBelow?"":" is-disabled"}" data-action="daily-history-below90-towns">${fmt(townBelow)} towns below 90%</button></div>`;
    const pts=trendPoints(s);
    const charts=`<div class="dh2-charts">${chart(pts,"totalVolume","Volume · last "+pts.length+" days","bars",date)}${chart(pts,"successRate","Success rate","line",date,"%")}</div>`;
    const tabs=[["riders","Riders",n(m.totalRiders)],["towns","Towns",towns.length],["cfr1","CFR1",null],["board","Leaderboard",Array.isArray(s.eodLeaderboard)?s.eodLeaderboard.length:0],["exceptions","Exemptions",n(m.misrouted)+n(m.exemptions)]];
    const bar=`<nav class="dh2-tabs" role="tablist">${tabs.map(t=>`<button type="button" role="tab" data-dh-tab="${t[0]}" class="${ui.tab===t[0]?"is-on":""}" aria-selected="${ui.tab===t[0]}">${t[1]}${t[2]?`<em>${fmt(t[2])}</em>`:""}</button>`).join("")}</nav>`;
    const body={riders:tabRiders,towns:tabTowns,cfr1:tabCfr1,board:tabBoard,exceptions:tabExceptions}[ui.tab](s);
    const meta=live?`<div class="dh2-meta is-live"><i></i>Live view of today — not saved until you tap Capture Now.</div>`:`<div class="dh2-meta">Saved snapshot${s.capturedAt?" · captured "+escH(prettyDate(String(s.capturedAt).slice(0,10)))+" "+escH(timeOf(s.capturedAt)):""}${s.captureReason?" · "+escH(s.captureReason):""}</div>`;
    return `${meta}<div class="dh2-cards">${cards}</div>${fleet}${charts}${bar}<div class="dh2-tab-body" id="dh2TabBody">${body}</div>`;
  }

  function renderSnapshot(s,dateArg){
    const host=document.getElementById("dailyHistoryDashboard");
    if(!host)return;
    if(!s){
      window.__badocDailyHistoryCurrentSnapshot=null;
      host.innerHTML='<div class="dh2-empty dh2-empty-big"><strong>No snapshot for this date</strong><span>Days are saved when you tap Capture Now (or automatically at the 12 AM reset).</span></div>';
      lastHtml="";return;
    }
    window.__badocDailyHistoryCurrentSnapshot=s;
    const date=dateArg||s.date,live=date===todayDate()&&!s.__saved;
    const html=buildHtml(s,date,live);
    if(html===lastHtml)return;
    const ae=document.activeElement,keepQ=ae&&ae.matches&&ae.matches("[data-dh-q]"),pos=keepQ?[ae.selectionStart,ae.selectionEnd]:null;
    const scrollers=[...host.querySelectorAll(".dh2-tablewrap")].map(e=>[e.scrollTop,e.scrollLeft]);
    host.innerHTML=html;lastHtml=html;
    host.querySelectorAll(".dh2-tablewrap").forEach((e,i)=>{if(scrollers[i]){e.scrollTop=scrollers[i][0];e.scrollLeft=scrollers[i][1]}});
    if(keepQ){const q=host.querySelector("[data-dh-q]");if(q){q.focus();try{q.setSelectionRange(pos[0],pos[1])}catch(e){}}}
  }
  function renderLoading(){
    const host=document.getElementById("dailyHistoryDashboard");
    if(host){host.innerHTML='<div class="dh2-skel"><i></i><i></i><i></i><i></i></div>';lastHtml=""}
  }

  // ── dates / controller ──
  function todayDate(){return dayKey()}
  function knownDates(){
    const d=Array.isArray(window.__badocDailyHistoryDates)?window.__badocDailyHistoryDates:[];
    return [...new Set([todayDate(),...d.filter(isDate)])].sort().reverse();
  }
  function setInput(date){
    const input=document.getElementById("dailyHistoryDate");
    if(input){input.max=todayDate();if(input.value!==date)input.value=date}
    const dates=knownDates(),i=dates.indexOf(date);
    const prev=document.getElementById("dh2Prev"),next=document.getElementById("dh2Next");
    if(prev)prev.disabled=!(i>=0&&i<dates.length-1);
    if(next)next.disabled=!(i>0);
    const chips=document.getElementById("dh2Chips");
    if(chips){
      chips.innerHTML=dates.slice(0,12).map(d=>`<button type="button" data-dh-date="${d}" class="${d===date?"is-on":""}">${d===todayDate()?"Today":shortDate(d)}</button>`).join("");
      const on=chips.querySelector(".is-on");if(on&&on.scrollIntoView)try{on.scrollIntoView({block:"nearest",inline:"center"})}catch(e){}
    }
    const label=document.getElementById("dh2DateLabel");if(label)label.textContent=prettyDate(date);
    const badge=document.getElementById("dh2Mode");
    if(badge){const live=date===todayDate();badge.textContent=live?"LIVE":"SAVED";badge.className="dh2-badge "+(live?"is-live":"is-saved")}
  }
  async function refreshDates(){
    try{
      const dates=await listSnapshots();
      window.__badocDailyHistoryDates=[...new Set([todayDate(),...dates])].sort().reverse();
    }catch(e){
      console.warn("Daily History cloud list:",e);
      window.__badocDailyHistoryDates=[todayDate()];
    }
    setInput(curDate||todayDate());
    return window.__badocDailyHistoryDates;
  }
  function showDailyHistoryError(e){
    const host=document.getElementById("dailyHistoryDashboard");
    if(host){host.innerHTML='<div class="dh2-empty dh2-empty-big"><strong>Could not load this date</strong><span>'+escH(e&&e.message?e.message:"Unknown error")+'</span></div>';lastHtml=""}
  }
  async function show(date,force){
    date=isDate(date)?date:todayDate();
    const changed=date!==curDate;curDate=date;setInput(date);
    const seq=++loadSeq;
    try{
      if(date===todayDate()){renderSnapshot(buildSnapshot(date),date);return}
      let s=!force&&snapCache.get(date);
      if(!s){
        if(changed)renderLoading();
        s=await loadSnapshot(date);
        if(seq!==loadSeq)return;
        if(s){s.__saved=true;snapCache.set(date,s)}
      }
      renderSnapshot(s,date);
    }catch(e){console.warn("Daily History load:",e);if(seq===loadSeq)showDailyHistoryError(e)}
  }
  async function refreshSelected(){await show(curDate||todayDate(),true)}

  let dailyHistoryRefreshInFlight=null;
  window.__badocRefreshDailyHistory=async function(){
    if(dailyHistoryRefreshInFlight)return dailyHistoryRefreshInFlight;
    dailyHistoryRefreshInFlight=(async()=>{
      snapCache.clear();
      await refreshDates();
      await show(curDate||todayDate(),true);
    })();
    try{return await dailyHistoryRefreshInFlight}
    finally{dailyHistoryRefreshInFlight=null}
  };
  window.renderDailyHistory=function(date){return show(date||curDate||todayDate())};
  window.addEventListener("badoc:parcel-data-updated",function(){
    const page=document.getElementById("dailyHistory");
    if(page?.classList.contains("active")&&(curDate||todayDate())===todayDate()){
      snapCache.delete(todayDate());lastHtml="";renderSnapshot(buildSnapshot(todayDate()),todayDate());
    }
  });

  // v40: preflight preview for manual Capture Now. Existing date records are updated in place (upsert), not stacked.
  window.__badocPreviewDailyCapture=async function(date=dayKey()){
    const snapshot=buildSnapshot(date);
    const existing=await loadSnapshot(date);
    const m=snapshot.metrics||{};
    return {
      date,
      existing:!!existing,
      capturedAt:snapshot.capturedAt||"",
      totalVolume:Number(m.totalVolume)||0,
      delivered:Number(m.delivered)||0,
      onHold:Number(m.onHold)||0,
      cfr1Total:Number(m.cfr1Total)||0,
      cfr1Scanned:Number(m.cfr1Scanned)||0,
      cfr1Unscanned:Number(m.cfr1Unscanned)||0
    };
  };

  window.__badocCaptureDailyHistory=async function(reason="pre-reset",date=dayKey()){
    try{
      const snapshot=buildSnapshot(date);
      snapshot.captureReason=reason;
      await saveSnapshot(snapshot,reason==="pre-reset");
      await refreshDates();
      const input=document.getElementById("dailyHistoryDate");
      if(input)input.value=date;
      renderSnapshot(snapshot);
      console.log("BADOC Daily History captured in cloud:",date);
      return snapshot;
    }catch(e){
      console.warn("BADOC Daily History capture failed:",e);
      throw e;
    }
  };

  // CFR Daily Summary: separate daily row written by the same Capture button.
  // The time buckets are based on Current Station Received Time; one TN can only
  // appear in one bucket. Qualifying CAGAYAN DC -> BADOC HUB transported parcels
  // are included in As of 4AM under the existing CFR1 transported rule.
  // Parse SPX wall-clock timestamps as Manila time regardless of the device
  // timezone. Explicitly zoned ISO values are instants and are converted to
  // Asia/Manila before assigning their operational date/time bucket.
  function cfrSummaryManilaParts(value){
    const raw=String(value??"").trim();
    if(!raw)return null;
    const pad=v=>String(v).padStart(2,"0");
    const validDate=(year,month,day)=>{const d=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));return d.getUTCFullYear()===Number(year)&&d.getUTCMonth()+1===Number(month)&&d.getUTCDate()===Number(day)};
    let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
    if(m){
      const hour=Number(m[4]||0),minute=Number(m[5]||0),second=Number(m[6]||0);
      if(!validDate(m[1],m[2],m[3])||hour>23||minute>59||second>59)return null;
      return {dateKey:m[1]+"-"+pad(m[2])+"-"+pad(m[3]),minutes:hour*60+minute+second/60};
    }
    m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if(m){
      let year=Number(m[3]);if(year<100)year+=2000;
      let hour=Number(m[4]||0),minute=Number(m[5]||0),second=Number(m[6]||0);
      const ap=String(m[7]||"").toUpperCase();
      if(ap==="AM"&&hour===12)hour=0;else if(ap==="PM"&&hour<12)hour+=12;
      if(!validDate(year,m[1],m[2])||hour>23||minute>59||second>59)return null;
      return {dateKey:String(year)+"-"+pad(m[1])+"-"+pad(m[2]),minutes:hour*60+minute+second/60};
    }
    // A date-only string is a Manila calendar date, not a UTC instant.
    m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m&&validDate(m[1],m[2],m[3]))return {dateKey:m[1]+"-"+m[2]+"-"+m[3],minutes:0};
    const parsed=new Date(raw);
    if(Number.isNaN(parsed.getTime()))return null;
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(parsed);
    const p={};parts.forEach(x=>{if(x.type!=="literal")p[x.type]=x.value;});
    if(!p.year||!p.month||!p.day||!p.hour)return null;
    return {dateKey:p.year+"-"+p.month+"-"+p.day,minutes:Number(p.hour)*60+Number(p.minute||0)+Number(p.second||0)/60};
  }
  function cfrSummaryParseReceivedTime(row){
    const raw=row?.["Current Station Received Time"] ?? row?.["Current Station Received time"] ??
      row?.["Current station received time"] ?? row?.["Received Time"] ?? row?.["Received time"] ?? "";
    return cfrSummaryManilaParts(raw);
  }
  function cfrSummaryTN(row){
    try{return clean(typeof spxTN==="function"?spxTN(row):row?.["SPX TN"]||row?.["SLS Tracking Number"]||row?.["Tracking Number"]||"");}catch(e){return clean(row?.["SPX TN"]||row?.["SLS Tracking Number"]||row?.["Tracking Number"]||"");}
  }
  function cfrSummaryTNKey(value){
    try{return typeof window.__badocOnholdKey==="function"?String(window.__badocOnholdKey(value)||""):clean(value).toUpperCase().replace(/[\s\-_.]/g,"");}catch(e){return clean(value).toUpperCase().replace(/[\s\-_.]/g,"");}
  }
  function cfrSummaryNorm(value){return clean(value).toUpperCase().replace(/[_-]+/g," ").replace(/\s+/g," ").trim();}
  function cfrSummaryStatus(row){return cfrSummaryNorm(statusOf(row));}
  function cfrSummaryMeta(row){
    try{if(typeof window.__badocRowMeta==="function")return window.__badocRowMeta(row)||{};}catch(e){}
    return {station:row?.["Current Station"]||"",destination:row?.["Destination Station"]||"",status:statusOf(row)};
  }
  function cfrSummaryNumber(value){const v=parseFloat(String(value??"").replace(/,/g,"").replace(/%/g,""));return Number.isFinite(v)?v:0;}
  function buildCfrDailySummary(date){
    const targetDate=String(date||dayKey()).trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))throw new Error("CFR summary date must use YYYY-MM-DD.");
    const todayRows=typeof getParcelCountRows==="function"?getParcelCountRows():[];
    const allParcelRows=[
      ...(Array.isArray(current?.valid)?current.valid:[]),
      ...(Array.isArray(current?.mis)?current.mis:[])
    ];
    const specialTransported=new Map();
    allParcelRows.forEach(row=>{
      if(typeof isExceptionRow==="function"&&isExceptionRow(row))return;
      const meta=cfrSummaryMeta(row);
      const st=cfrSummaryStatus(row);
      if(!st.includes("TRANSPORTED"))return;
      if(cfrSummaryNorm(meta.station||row?.["Current Station"])!=="CAGAYAN DC")return;
      if(cfrSummaryNorm(meta.destination||row?.["Destination Station"])!=="BADOC HUB")return;
      const tn=cfrSummaryTN(row),key=cfrSummaryTNKey(tn);
      if(key&&!specialTransported.has(key))specialTransported.set(key,row);
    });
    // Exact same Today\'s Volume denominator and linehaul toggle as the dashboard.
    const TV_LINEHAUL_KEY=typeof PARCEL_INCOMING_KEY!=="undefined"?PARCEL_INCOMING_KEY:"badoc_parcel_incoming_linehaul_v1";
    let linehaulEnabled=false;try{linehaulEnabled=localStorage.getItem(TV_LINEHAUL_KEY)==="1";}catch(e){}
    const incoming=linehaulEnabled&&typeof getParcelIncomingLinehaul==="function"?getParcelIncomingLinehaul():{total:0};
    const todayVolume=todayRows.length+(Number(incoming?.total)||0);

    let asOf4am=0,from4to11=0,from11to3=0;
    const bucketSeen=new Set();
    const specialKeys=new Set(specialTransported.keys());
    todayRows.forEach(row=>{
      const tn=cfrSummaryTN(row),key=cfrSummaryTNKey(tn);
      if(key&&specialKeys.has(key))return; // the transported TN belongs only in As of 4AM
      if(!key)return;
      if(bucketSeen.has(key))return;
      const received=cfrSummaryParseReceivedTime(row);
      if(!received||received.dateKey!==targetDate)return;
      const minutes=received.minutes;
      if(minutes<4*60){asOf4am++;bucketSeen.add(key);}
      else if(minutes<11*60){from4to11++;bucketSeen.add(key);}
      else if(minutes<=15*60){from11to3++;bucketSeen.add(key);}
    });
    specialTransported.forEach((row,key)=>{
      if(bucketSeen.has(key))return;
      asOf4am++;bucketSeen.add(key);
    });

    // Status-based CFR uses the same unique Today's Volume rows and the
    // dashboard's optional incoming-linehaul volume. No KPI card totals are added.
    const onholdTnKeys=window.__badocOnholdTnKeys instanceof Set?window.__badocOnholdTnKeys:new Set();
    const clearedStatuses=new Set(["ASSIGNING","LMHUB ASSIGNING","ASSIGNED","LMHUB ASSIGNED","DELIVERING","DELIVERED","ONHOLD","ON HOLD","LMHUB ONHOLD","LMHUB ON HOLD"]);
    const statusSeen=new Set();let clearedParcels=0;
    todayRows.forEach(row=>{
      const tn=cfrSummaryTN(row),key=cfrSummaryTNKey(tn);
      const status=cfrSummaryStatus(row);
      // A row without a TN cannot be de-duplicated; treat it as an individual
      // parcel row so the cleared numerator still follows Today's Volume rows.
      if(!key){if(clearedStatuses.has(status))clearedParcels++;return;}
      if(statusSeen.has(key))return;
      statusSeen.add(key);
      const isHold=liveHold.has(key)||liveHold.has(tn)||liveHold.has(clean(tn));
      if(clearedStatuses.has(status)||isHold)clearedParcels++;
    });
    const unclearedParcels=Math.max(0,todayVolume-clearedParcels);
    const cfrRate=todayVolume?clearedParcels/todayVolume*100:0;
    // Redelivery is counted directly from the currently loaded Forward Order
    // parcel rows: OnHold Time must be yesterday (relative to the summary date)
    // and status must be LMHub_Received. Count each tracking number only once.
    const yesterdayDate=(()=>{
      const parts=targetDate.split("-").map(Number);
      const d=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]-1));
      return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,"0"),String(d.getUTCDate()).padStart(2,"0")].join("-");
    })();
    const cfrSummaryDateOnly=value=>{
      const raw=String(value??"").trim();
      if(!raw)return "";
      const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(iso)return iso[1]+"-"+iso[2]+"-"+iso[3];
      const parsed=cfrSummaryManilaParts(raw);
      return parsed?.dateKey||"";
    };
    const redeliverySeen=new Set();
    let redelivery=0;
    allParcelRows.forEach(row=>{
      // Exclude exception tracking numbers before calculating Redelivery too.
      if(typeof isExceptionRow==="function"&&isExceptionRow(row))return;
      const tn=cfrSummaryTN(row),key=cfrSummaryTNKey(tn);
      if(!key||redeliverySeen.has(key))return;
      const status=cfrSummaryStatus(row);
      if(status!=="LMHUB RECEIVED")return;
      const onHoldTime=row?.["OnHold Time"]??row?.["On Hold Time"]??row?.["Onhold Time"]??row?.["On hold time"]??"";
      if(cfrSummaryDateOnly(onHoldTime)!==yesterdayDate)return;
      redeliverySeen.add(key);
      redelivery++;
    });
    // No official Backlog field is exposed by the loaded EOD dashboard. Keep
    // the agreed CFR-derived backlog: volume not currently in a cleared status.
    const backlogs=unclearedParcels;
    // For today's capture, AS OF 4AM must reflect the actual eligible CFR1
    // parcel membership shown by the CFR1 card, not a separate received-time bucket.
    // The CFR1 ledger already enforces Rule A and the transported-before-4AM Rule B.
    // Historical dates retain the existing time-bucket calculation because the
    // live CFR1 ledger only represents the current day's membership.
    const liveCfr1Total=Number(window.__badocCfr1Details?.totalCount);
    const cfr1AsOf4am=(targetDate===dayKey() && Number.isFinite(liveCfr1Total))
      ? liveCfr1Total
      : asOf4am;
    return {
      date:targetDate,
      asOf4am:cfr1AsOf4am,
      from4to11:from4to11,
      from11to3:from11to3,
      redelivery:redelivery,
      backlogs:backlogs,
      cfrRate:cfrRate,
      totalVolume:todayVolume,
      linehaulIncluded:linehaulEnabled,
      incomingLinehaul:Number(incoming?.total)||0,
      clearedParcels:clearedParcels,
      unclearedParcels:unclearedParcels,
      capturedAt:phTimestamp()
    };
  }
  window.__badocBuildCfrDailySummary=buildCfrDailySummary;
  window.__badocLoadCfrSummary=async function(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||"")))return null;
    const r=await storage().download(CFR_PREFIX+date+".json");
    if(r.error){
      if(/not found|404|object not found/i.test(r.error.message||""))return null;
      throw new Error(r.error.message||"CFR summary download failed");
    }
    return JSON.parse(await r.data.text());
  };
  window.__badocCaptureCfrSummary=async function(date=dayKey()){
    const summary=buildCfrDailySummary(date);
    if(!summary||!isDate(summary.date))throw new Error("CFR summary has an invalid operational date.");
    const blob=new Blob([JSON.stringify(summary)],{type:"application/json"});
    const r=await storage().upload(CFR_PREFIX+summary.date+".json",blob,{contentType:"application/json",upsert:true});
    if(r.error)throw new Error(r.error.message||"CFR summary cloud save failed");
    const verify=await window.__badocLoadCfrSummary(summary.date);
    if(!verify||verify.date!==summary.date)throw new Error("CFR summary read-back verification failed for "+summary.date);
    console.log("BADOC CFR Daily Summary saved:",summary.date);
    return summary;
  };

  
    function closeBadocDetailPopup(){
    const x=document.getElementById("badocDetailOverlay"); if(x)x.remove();
  }
  function showBadocDetailPopup(type){
    const s=window.__badocDailyHistoryCurrentSnapshot||{};
    const rows=type==="misrouted"?(Array.isArray(s.misroutedDetails)?s.misroutedDetails:[]):(Array.isArray(s.exemptionDetails)?s.exemptionDetails:[]);
    closeBadocDetailPopup();
    const overlay=document.createElement("div"); overlay.id="badocDetailOverlay"; overlay.className="badoc-detail-overlay";
    const title=type==="misrouted"?"Misrouted Parcels":"Exemptions";
    let body="";
    if(type==="misrouted") body=rows.length?`<table class="badoc-detail-table"><thead><tr><th>Tracking</th><th>Order ID</th><th>Town</th><th>Current Station</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escH(r.tracking)}</td><td>${escH(r.orderId)}</td><td>${escH(r.town)}</td><td>${escH(r.currentStation)}</td><td>${escH(r.status)}</td></tr>`).join("")}</tbody></table>`:`<div class="badoc-detail-empty">No misrouted parcels.</div>`;
    else {const items=rows.map(r=>typeof r==="string"?({tracking:r}):(r||{}));body=items.length?`<table class="badoc-detail-table"><thead><tr><th>Tracking</th><th>Order ID</th><th>Town</th><th>Current Station</th><th>Status</th></tr></thead><tbody>${items.map(r=>`<tr><td>${escH(r.tracking||"—")}</td><td>${escH(r.orderId||"—")}</td><td>${escH(r.town||"—")}</td><td>${escH(r.currentStation||"—")}</td><td>${escH(r.status||"—")}</td></tr>`).join("")}</tbody></table>`:`<div class="badoc-detail-empty">No exemptions.</div>`;}
    overlay.innerHTML=`<div class="badoc-detail-modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="badoc-detail-head"><h3>${title}</h3><button type="button" class="badoc-detail-close" aria-label="Close">×</button></div><div class="badoc-detail-body"><div class="badoc-detail-count">${rows.length.toLocaleString()} item${rows.length===1?"":"s"}</div>${body}</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".badoc-detail-close").onclick=closeBadocDetailPopup;
    overlay.addEventListener("click",e=>{if(e.target===overlay)closeBadocDetailPopup()});
    document.addEventListener("keydown",function escClose(e){if(e.key==="Escape"){closeBadocDetailPopup();document.removeEventListener("keydown",escClose)}});
  }

  function goToDailyHistoryRider(riderName){
    const name=String(riderName||"").trim();
    if(!name)return;
    ui.tab="riders";ui.q="";ui.below=false;ui.area="all";
    const s=window.__badocDailyHistoryCurrentSnapshot;
    if(s)renderSnapshot(s,curDate||todayDate());
    const card=[...document.querySelectorAll("#dailyHistory .dh2-rider[data-rider-name]")].find(el=>String(el.getAttribute("data-rider-name")||"").trim().toLowerCase()===name.toLowerCase());
    if(card){
      card.scrollIntoView({behavior:"smooth",block:"center"});
      card.classList.add("daily-history-below90-target");
      setTimeout(()=>card.classList.remove("daily-history-below90-target"),1800);
    }
  }

    function showBelow90TownsPopup(){
    const s=window.__badocDailyHistoryCurrentSnapshot||{};
    const towns=Array.isArray(s.townPerformance)?s.townPerformance:[];
    const below=towns.filter(t=>String(t.town||"").trim() && n(t.successRate)<90).sort((a,b)=>n(a.successRate)-n(b.successRate));
    const old=document.getElementById("badocBelow90TownOverlay"); if(old)old.remove();
    const overlay=document.createElement("div"); overlay.id="badocBelow90TownOverlay"; overlay.className="badoc-detail-overlay";
    const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]));
    const body=below.length?`<div class="daily-history-below90-list">${below.map(t=>`<div class="daily-history-below90-row"><div><strong>${esc(t.town)}</strong><span class="daily-history-town-area">${esc(t.area||"")}</span></div><strong class="daily-history-rider-name--low">${n(t.successRate).toFixed(1)}%</strong></div>`).join("")}</div>`:`<div class="badoc-detail-empty">No towns below 90% success rate.</div>`;
    overlay.innerHTML=`<div class="badoc-detail-modal" role="dialog" aria-modal="true" aria-label="Towns below 90 percent success rate"><div class="badoc-detail-head"><h3>Towns Below 90% Success Rate</h3><button type="button" class="badoc-detail-close" aria-label="Close">×</button></div><div class="badoc-detail-body"><div class="badoc-detail-count">${below.length} town${below.length===1?"":"s"}</div>${body}</div></div>`;
    document.body.appendChild(overlay);
    const close=()=>{overlay.classList.remove("open");overlay.setAttribute("aria-hidden","true");setTimeout(()=>overlay.remove(),120)};
    overlay.querySelector(".badoc-detail-close").onclick=close; overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    overlay.classList.add("open"); overlay.setAttribute("aria-hidden","false");
  }

  function showBelow90RidersPopupLive(){
    const s=window.__badocDailyHistoryCurrentSnapshot||{};
    const groups=Array.isArray(s.riderPerformance)?s.riderPerformance:[];
    const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
    const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
    const rateClass=v=>{const p=num(v);if(p<=0)return "";if(p>=95)return "daily-history-rider-name--good";if(p>=90)return "daily-history-rider-name--warn";return "daily-history-rider-name--low"};
    const below=groups.filter(g=>String(g.rider||"").trim() && num(g.successRate)<90);
    const old=document.getElementById("badocBelow90Overlay"); if(old)old.remove();
    const overlay=document.createElement("div");
    overlay.id="badocBelow90Overlay";
    overlay.className="badoc-detail-overlay";
    const body=below.length?`<div class="daily-history-below90-list">${below.map(g=>{
      const rider=esc(String(g.rider||"").trim());
      const area=esc(String(g.area||g.label||"").trim());
      const sr=num(g.successRate).toFixed(1);
      const vehicle=esc(String(g.vehicleType||"—"));
      const towns=Array.isArray(g.townDetails)?g.townDetails.map(t=>esc(t.town||"")).filter(Boolean):[];
      return `<div class="daily-history-below90-row"><button type="button" class="daily-history-below90-rider-link" data-below90-rider="${rider}">${rider}</button><strong class="${rateClass(g.successRate)}">${sr}%</strong></div>`;
    }).join("")}</div>`:`<div class="badoc-detail-empty">No riders below 90% success rate.</div>`;
    overlay.innerHTML=`<div class="badoc-detail-modal" role="dialog" aria-modal="true" aria-label="Riders below 90 percent success rate"><div class="badoc-detail-head"><h3>Riders Below 90% Success Rate</h3><button type="button" class="badoc-detail-close" aria-label="Close">×</button></div><div class="badoc-detail-body"><div class="badoc-detail-count">${below.length} rider${below.length===1?"":"s"}</div>${body}</div></div>`;
    document.body.appendChild(overlay);
    const close=()=>{overlay.classList.remove("open");overlay.setAttribute("aria-hidden","true");setTimeout(()=>overlay.remove(),120)};
    overlay.querySelector(".badoc-detail-close").onclick=close;
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");
  }

  document.addEventListener("click",e=>{
    const copyCfr1Button=e.target?.closest?.('[data-action="daily-history-copy-cfr1-ids"]');
    if(copyCfr1Button){
      e.preventDefault();
      e.stopPropagation();
      if(copyCfr1Button.disabled)return;
      const snap=window.__badocDailyHistoryCurrentSnapshot;
      const savedCfr1=snap&&snap.cfr1&&typeof snap.cfr1==="object"?snap.cfr1:{};
      const seen=new Set();
      const ids=[];
      [...(Array.isArray(savedCfr1.scanned)?savedCfr1.scanned:[]),...(Array.isArray(savedCfr1.unscanned)?savedCfr1.unscanned:[])].forEach(row=>{
        const id=String(row&&row.orderId!==undefined?row.orderId:"").trim();
        if(id && id!=="—" && !seen.has(id)){seen.add(id);ids.push(id);}
      });
      if(!ids.length){
        const original=copyCfr1Button.dataset.originalLabel||copyCfr1Button.textContent;
        copyCfr1Button.dataset.originalLabel=original;
        copyCfr1Button.textContent="No Order IDs";
        setTimeout(()=>{if(copyCfr1Button.isConnected)copyCfr1Button.textContent=original;},1800);
        return;
      }
      const copyText=ids.join("\n");
      const fallbackCopy=()=>{
        const ta=document.createElement("textarea");
        ta.value=copyText;
        ta.setAttribute("readonly","");
        ta.style.position="fixed";
        ta.style.left="-9999px";
        ta.style.top="0";
        ta.style.opacity="0";
        document.body.appendChild(ta);
        ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);
        let ok=false;
        try{ok=document.execCommand("copy");}catch(err){}
        ta.remove();
        if(!ok)throw new Error("Clipboard access was blocked by the browser.");
      };
      const original=copyCfr1Button.dataset.originalLabel||copyCfr1Button.textContent;
      copyCfr1Button.dataset.originalLabel=original;
      (async()=>{
        try{
          if(navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){
            try{await navigator.clipboard.writeText(copyText);}
            catch(err){fallbackCopy();}
          }else fallbackCopy();
          copyCfr1Button.textContent="Copied "+ids.length.toLocaleString()+" IDs";
        }catch(err){
          copyCfr1Button.textContent="Copy Failed";
          console.warn("CFR1 Order ID copy failed:",err);
        }
        setTimeout(()=>{if(copyCfr1Button.isConnected)copyCfr1Button.textContent=original;},2200);
      })();
      return;
    }
    const riderLink=e.target?.closest?.("[data-below90-rider]");
    if(riderLink){
      e.preventDefault();
      const name=riderLink.getAttribute("data-below90-rider")||"";
      const overlay=document.getElementById("badocBelow90Overlay");
      if(overlay)overlay.remove();
      goToDailyHistoryRider(name);
      return;
    }
    const detail=e.target?.closest?.('[data-action="daily-history-misrouted"],[data-action="daily-history-exemptions"]');
    if(detail){showBadocDetailPopup(detail.dataset.action.endsWith("misrouted")?"misrouted":"exemptions");return;}
    const townCard=e.target?.closest?.('[data-action="daily-history-below90-towns"]');
    if(townCard && !townCard.classList.contains("is-disabled")){showBelow90TownsPopup();return;}
    const card=e.target?.closest?.('[data-action="daily-history-below90"]');
    if(!card || card.classList.contains("is-disabled"))return;
    showBelow90RidersPopupLive();
  });
  document.addEventListener("keydown",e=>{
    const detail=e.target?.closest?.('[data-action="daily-history-misrouted"],[data-action="daily-history-exemptions"]');
    if(detail && (e.key==="Enter"||e.key===" ")){e.preventDefault();showBadocDetailPopup(detail.dataset.action.endsWith("misrouted")?"misrouted":"exemptions");return;}
    const townCard=e.target?.closest?.('[data-action="daily-history-below90-towns"]');
    if(townCard && (e.key==="Enter"||e.key===" ") && !townCard.classList.contains("is-disabled")){e.preventDefault();showBelow90TownsPopup();return;}
    if((e.key!=="Enter"&&e.key!==" ")||!e.target?.matches?.('[data-action="daily-history-below90"]'))return;
    e.preventDefault();
    e.target.click();
  });

  // Patch the existing 12:00 AM reset so the snapshot is saved FIRST.
  // If the app was closed at 12:00 AM, this still captures the shared/local
  // state when the reset routine runs after the app is opened.
  const patchReset=()=>{
    if(window.__badocV206ResetPatched)return true;
    const script=document.getElementById("badoc-daily-operational-reset");
    if(!script)return false;
    // The original reset is enclosed in an IIFE, so use a capture-phase hook
    // on the reset marker upload instead of relying on an inaccessible function.
    if(window.__badocV206StorageHook)return true;
    window.__badocV206StorageHook=true;
    return true;
  };
  patchReset();

  // Intercept the reset marker upload: this occurs only after shared data has
  // been cleared in v205, so it cannot be used as the pre-reset hook. Instead,
  // install a beforeunload-safe timer that captures once the midnight window opens.
  // The actual v206 reset patch below is injected by replacing the original
  // clear call when the script text is loaded.
  const originalText=scriptText();
  function scriptText(){
    try{return document.getElementById("badoc-daily-operational-reset")?.textContent||""}catch(e){return ""}
  }

  // ───────── events ─────────
  function onChange(){const s=window.__badocDailyHistoryCurrentSnapshot;if(s)renderSnapshot(s,curDate||todayDate())}
  // Capture CFR1 button presses before global click handlers can intercept them.
  document.addEventListener("click",e=>{
    const button=e.target&&e.target.closest?e.target.closest("#dailyHistory [data-dh-cfr]"):null;
    if(!button)return;
    e.preventDefault();e.stopPropagation();
    ui.cfr=button.getAttribute("data-dh-cfr")==="scanned"?"scanned":"unscanned";
    lastHtml="";
    const snapshot=window.__badocDailyHistoryCurrentSnapshot;
    if(snapshot)renderSnapshot(snapshot,curDate||todayDate());
  },true);
  document.addEventListener("click",e=>{
    const root=e.target&&e.target.closest?e.target.closest("#dailyHistory"):null;
    if(!root)return;
    const t=e.target;
    const dateBtn=t.closest("[data-dh-date]");if(dateBtn&&!dateBtn.matches("input")){show(dateBtn.getAttribute("data-dh-date"));return}
    const tab=t.closest("[data-dh-tab]");if(tab){ui.tab=tab.getAttribute("data-dh-tab");onChange();return}
    const cfr=t.closest("[data-dh-cfr]");if(cfr){ui.cfr=cfr.getAttribute("data-dh-cfr");onChange();return}
    if(t.closest("[data-dh-below]")){ui.below=!ui.below;onChange();return}
    if(t.closest("#dh2Prev")||t.closest("#dh2Next")){
      const dates=knownDates(),i=dates.indexOf(curDate||todayDate()),j=t.closest("#dh2Prev")?i+1:i-1;
      if(dates[j])show(dates[j]);return;
    }
  });
  document.addEventListener("input",e=>{
    if(e.target&&e.target.matches&&e.target.matches("#dailyHistory [data-dh-q]")){ui.q=e.target.value;onChange()}
    else if(e.target&&e.target.id==="dailyHistoryDate"){const d=String(e.target.value||"").trim();if(isDate(d))show(d)}
  });
  document.addEventListener("change",e=>{
    const t=e.target;if(!t||!t.matches)return;
    if(t.matches("#dailyHistory [data-dh-area]")){ui.area=t.value;onChange()}
    else if(t.matches("#dailyHistory [data-dh-sort]")){ui.sort=t.value;onChange()}
    else if(t.id==="dailyHistoryDate"){const d=String(t.value||"").trim();if(isDate(d))show(d)}
  });
  document.addEventListener("toggle",e=>{
    const d=e.target;if(!d||!d.matches||!d.matches("details[data-dh-open]"))return;
    const k=d.getAttribute("data-dh-open");if(d.open)ui.open.add(k);else ui.open.delete(k);
  },true);

  // v40.1: branded in-page Capture Now dialog.
  function showCaptureDialog(config={}){
    return new Promise(resolve=>{
      const overlay=document.createElement("div");
      overlay.style.cssText="position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,18,32,.62);backdrop-filter:blur(5px)";
      const panel=document.createElement("div");
      panel.style.cssText="width:min(560px,100%);max-height:82vh;overflow:auto;background:var(--card,#fff);color:var(--text,#172033);border:1px solid var(--line,#dbe2ea);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:22px;font:inherit";
      const head=document.createElement("div");head.style.cssText="display:flex;gap:12px;align-items:center;margin-bottom:16px";
      const mark=document.createElement("div");mark.textContent=config.tone==="error"?"!":config.tone==="success"?"✓":"↥";mark.style.cssText="width:42px;height:42px;flex:0 0 42px;border-radius:13px;display:grid;place-items:center;background:"+(config.tone==="error"?"#fee2e2":config.tone==="success"?"#dcfce7":"#dbeafe")+";color:"+(config.tone==="error"?"#b91c1c":config.tone==="success"?"#15803d":"#1d4ed8")+";font-size:22px;font-weight:800";
      const titles=document.createElement("div");const title=document.createElement("div");title.textContent=config.title||"Capture Now";title.style.cssText="font-size:19px;font-weight:800";
      const sub=document.createElement("div");sub.textContent=config.subtitle||"Review the information below.";sub.style.cssText="font-size:13px;opacity:.72;margin-top:4px";
      titles.append(title,sub);head.append(mark,titles);panel.append(head);
      if(config.rows){const list=document.createElement("div");list.style.cssText="display:grid;gap:8px;margin:14px 0";config.rows.forEach(row=>{const item=document.createElement("div");item.style.cssText="display:flex;justify-content:space-between;gap:14px;padding:11px 12px;border:1px solid var(--line,#e2e8f0);border-radius:11px;background:var(--soft,#f8fafc)";const l=document.createElement("span");l.textContent=row.label;l.style.cssText="font-size:13px;opacity:.72";const v=document.createElement("strong");v.textContent=row.value;v.style.cssText="font-size:13px;text-align:right;max-width:65%;overflow-wrap:anywhere";item.append(l,v);list.append(item)});panel.append(list)}
      if(config.message){const msg=document.createElement("div");msg.textContent=config.message;msg.style.cssText="white-space:pre-line;font-size:13px;line-height:1.55;margin:14px 0;padding:13px;border-radius:12px;background:var(--soft,#f8fafc);border:1px solid var(--line,#e2e8f0)";panel.append(msg)}
      const footer=document.createElement("div");footer.style.cssText="display:flex;justify-content:flex-end;gap:10px;margin-top:20px";
      const finish=value=>{overlay.remove();document.removeEventListener("keydown",onKey);resolve(value)};
      const onKey=e=>{if(e.key==="Escape"&&config.confirm)finish(false)};document.addEventListener("keydown",onKey);
      if(config.confirm){const cancel=document.createElement("button");cancel.textContent=config.cancelLabel||"Cancel";cancel.style.cssText="border:1px solid var(--line,#cbd5e1);background:transparent;color:inherit;border-radius:11px;padding:11px 17px;font:inherit;font-weight:700;cursor:pointer";cancel.onclick=()=>finish(false);footer.append(cancel)}
      const ok=document.createElement("button");ok.textContent=config.confirm?(config.confirmLabel||"Confirm Capture"):"Close";ok.style.cssText="border:0;background:#185abd;color:white;border-radius:11px;padding:11px 19px;font:inherit;font-weight:750;cursor:pointer";ok.onclick=()=>finish(true);footer.append(ok);
      panel.append(footer);overlay.append(panel);overlay.addEventListener("click",e=>{if(e.target===overlay&&config.confirm)finish(false)});document.body.append(overlay);ok.focus();
    });
  }

  // ───────── page wiring ─────────
  function init(){
    const page=document.getElementById("dailyHistory");
    if(!page||page.__dh2)return;page.__dh2=true;
    const input=document.getElementById("dailyHistoryDate");if(input)input.max=todayDate();
    const refreshBtn=document.getElementById("dailyHistoryRefreshBtn");
    refreshBtn&&refreshBtn.addEventListener("click",async()=>{
      if(refreshBtn.disabled)return;
      const old=refreshBtn.textContent;refreshBtn.disabled=true;refreshBtn.textContent="↻ Refreshing…";
      try{await window.__badocRefreshDailyHistory()}finally{refreshBtn.disabled=false;refreshBtn.textContent=old}
    });
    const captureBtn=document.getElementById("dailyHistoryCaptureBtn");
    captureBtn&&captureBtn.addEventListener("click",async()=>{
      if(captureBtn.disabled||window.__badocCaptureInFlight)return;
      window.__badocCaptureInFlight=true;
      const old=captureBtn.textContent;
      captureBtn.disabled=true;
      captureBtn.textContent="Preparing preview…";
      const d=todayDate();
      try{
        const preview=await window.__badocPreviewDailyCapture(d);
        const approved=await showCaptureDialog({
          title:"Review Capture Now",subtitle:"Check today\'s figures before saving anything.",
          confirm:true,confirmLabel:"Confirm Capture",cancelLabel:"Cancel",
          rows:[
            {label:"Date",value:preview.date},
            {label:"Daily History",value:preview.existing?"Existing record will be UPDATED":"New daily record will be CREATED"},
            {label:"Total Volume",value:preview.totalVolume.toLocaleString()},
            {label:"Delivered",value:preview.delivered.toLocaleString()},
            {label:"On Hold",value:preview.onHold.toLocaleString()},
            {label:"CFR1 Total",value:preview.cfr1Total.toLocaleString()},
            {label:"CFR1 Scanned",value:preview.cfr1Scanned.toLocaleString()},
            {label:"CFR1 Unscanned",value:preview.cfr1Unscanned.toLocaleString()}
          ],
          message:"This saves the EOD snapshot and CFR daily summary to shared cloud storage. No Google Sheets source or export is required."
        });
        if(!approved){captureBtn.textContent=old;captureBtn.title="Capture cancelled. No save was started.";return;}
        captureBtn.textContent="Saving EOD snapshot + CFR summary…";
        const outcomes=await Promise.allSettled([
          window.__badocCaptureDailyHistory("manual",d),
          window.__badocCaptureCfrSummary(d)
        ]);
        const [snap,cfr]=outcomes,ok=o=>o.status==="fulfilled";
        const line=(label,o,f)=>label+": "+(ok(o)?(f?f(o.value):"SAVED"):"FAILED — "+String(o.reason&&o.reason.message||o.reason||"Unknown error"));
        const detail=[
          "Capture result for "+d,
          line("EOD cloud snapshot",snap,v=>"SAVED · "+(v.capturedAt||"timestamp recorded")),
          line("CFR daily summary cloud file",cfr,v=>"SAVED · "+(v.capturedAt||"timestamp recorded"))
        ].join("\n");
        if(ok(snap)&&ok(cfr)){
          captureBtn.textContent="✓ EOD Captured";captureBtn.title=detail;
          await showCaptureDialog({title:"Capture Confirmed",subtitle:"Both cloud save steps completed.",tone:"success",message:detail});
        }else{
          captureBtn.textContent=(ok(snap)||ok(cfr))?"⚠ PARTIAL — CHECK DETAILS":"✕ CAPTURE FAILED";captureBtn.title=detail;
          await showCaptureDialog({title:"Capture Needs Attention",subtitle:"At least one cloud save step failed.",tone:"error",message:detail+"\n\nCheck cloud connectivity before retrying."});
        }
        snapCache.delete(d);
      }catch(e){
        console.warn("Capture Now preflight failed:",e);captureBtn.textContent="✕ Not Captured";
        await showCaptureDialog({title:"Capture Not Completed",subtitle:"The capture could not be started or completed.",tone:"error",message:String(e&&e.message||e)});
      }finally{
        window.__badocCaptureInFlight=false;
        setTimeout(()=>{captureBtn.textContent=old;captureBtn.disabled=false;captureBtn.title="Review today\'s operational data, then save the EOD snapshot and CFR summary to cloud storage.";},6000);
      }
    });
    // refresh whenever the page is opened, and every 20s while viewing today
    page.__wasActive=page.classList.contains("active");
    const obs=new MutationObserver(()=>{
      if(page.classList.contains("active")){
        if(!page.__wasActive){page.__wasActive=true;window.__badocRefreshDailyHistory()}
      }else page.__wasActive=false;
    });
    obs.observe(page,{attributes:true,attributeFilter:["class"]});
    __badocEvery(()=>{if(page.classList.contains("active")&&(curDate||todayDate())===todayDate())show(todayDate())},20000);
    // Only load snapshots at startup if Data is already the visible page.
    if(page.classList.contains("active"))window.__badocRefreshDailyHistory();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
