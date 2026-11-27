window.updateOperationProgress=function(){
  const allRows=Array.isArray(current?.valid)?current.valid:[];
  const norm=v=>String(v??"").trim().replace(/[_-]+/g," ").replace(/\s+/g," ").toUpperCase();
  const statusTo=r=>{
    const keys=["Parcel Status To","Status To","TO Status","To Status","Status To (Current)","Status"];
    for(const k of keys) if(r&&Object.prototype.hasOwnProperty.call(r,k)&&String(r[k]??"").trim()) return String(r[k]).trim();
    const key=Object.keys(r||{}).find(k=>/parcel\s*status\s*to|status\s*to|to\s*status/i.test(k));
    return key?String(r[key]??"").trim():"";
  };
  const station=r=>badocRowMeta(r).station;
  const destination=r=>badocRowMeta(r).destination;
  const status=r=>badocRowMeta(r).status;
  const statusKey=v=>String(v??"").toUpperCase().replace(/[\s\-_\.]/g,"");
  const tnKey=v=>norm(v).replace(/[\s\-_.]/g,"");
  // The next-day volume forecast remains available throughout the day.
  const stations=["BADOC HUB","CAGAYAN DC","SOC 6"];
  // Exact 58-town allowlist: 30 Badoc + 28 Pinili.
  // Normalize punctuation/case so CSV values such as AR-ARUSIP and
  // ALAY-NANGBABAAAN (ALAY 15-B) match the configured names exactly.
  const allowedTomorrowTowns=new Set([
    "TUROD","LABUT","CARAITAN","PALTIT","LUBIGAN","BATO","AR-ARUSIP",
    "ALAY-NANGBABAAAN (ALAY 15-B)","NAGREBCAN","BALBALDEZ","SAUD",
    "PAGSANAHAN NORTE","PAGSANAHAN SUR","LA VIRGEN MILAGROSA (PAGUETPET)",
    "MORONG","SANTA CRUZ NORTE","SANTA CRUZ SUR","ALOGOOG","LACUBEN","ARING",
    "CANAAN (POB.)","GARRETA (POB.)","GABUT NORTE","GABUT SUR","NAPU",
    "MABUSAG NORTE","MABUSAG SUR","PARANG","PASUC",
    "UGUIS","CAMANGA","MADUPAYAS","LILIPUTEN","LUMBAAN-BICBICA","SACRITAN",
    "AGLIPAY","SANTO TOMAS","CABAROAN","BUANGA","PURITAC","DALAYAP","NAGTRIGOAN",
    "UPON","VALBUENA (POB.)","PAGDILAO (POB.)","SALANAP","BARBAR","BUNGRO","PUGAOAN",
    "APATUT-LUBONG","DARAT","CAPANGDANAN","GULPENG","BADIO","BULBULALA","PUZOL","TARTARABANG",
    "MAGLAOI SUR"
  ].map(norm));
  const townName=r=>String((r&&r["Town Name"])??(r&&r["Town"])??(r&&r["town"])??"").trim();
  const tomorrowTownEligible=r=>allowedTomorrowTowns.has(norm(townName(r)));
  const dayEligible=r=>destination(r)==="BADOC HUB" && stations.includes(station(r));
  const qualifyingDayRows=allRows.filter(dayEligible).filter(r=>!isExceptionRow(r));

  // Live parcel population before the first cutoff; fixed saved population afterward.
  // The cutoff is fixed at 3:00 PM Manila time and is not user-adjustable.
  const liveTodayRows=typeof getParcelCountRows==="function"
    ?getParcelCountRows()
    :allRows.filter(r=>!isExceptionRow(r));
  // Today's Volume is independent of the Exemptions list: exempted parcels
  // remain part of the day's incoming workload. Other operational metrics keep
  // using liveTodayRows with their existing exemption handling.
  const liveTodayVolumeRows=typeof getParcelCountRows==="function"
    ?getParcelCountRows({includeExemptions:true})
    :allRows;
  const backlogSourceRows=typeof getParcelCountRows==="function"
    ?getParcelCountRows({includeExemptions:true})
    :allRows;
  const TV_LINEHAUL_KEY=typeof PARCEL_INCOMING_KEY!=="undefined"
    ?PARCEL_INCOMING_KEY
    :"badoc_parcel_incoming_linehaul_v1";
  let tvLinehaulEnabled=false;
  try{tvLinehaulEnabled=localStorage.getItem(TV_LINEHAUL_KEY)==="1";}catch(e){}
  const incomingForToday=tvLinehaulEnabled && typeof getParcelIncomingLinehaul==="function"
    ?getParcelIncomingLinehaul({includeExemptions:true})
    :{total:0,rows:[]};
  const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const nowManila=__badocTime.manilaDate();
  const currentMinutes=nowManila.getHours()*60+nowManila.getMinutes();
  const snapshotDue=currentMinutes>=900;
  // Daily volume resets at 12:00 AM Manila time. The fixed 3:00 PM snapshot
  // belongs to this same calendar date; before cutoff, yesterday's snapshot
  // must never be reused as today's live volume.
  const volumeCycleKey=dateKey(nowManila);
  const savedVolumeSnapshot=window.__badocVolumeSnapshot||null;
  const activeVolumeSnapshot=savedVolumeSnapshot?.cycleKey===volumeCycleKey &&
    Array.isArray(savedVolumeSnapshot.rows) ? savedVolumeSnapshot : null;

  // Interpret pickup/received timestamps in Philippine time. Offset-less SPX
  // CSV timestamps are treated as Asia/Manila wall-clock values.
  const manilaStamp=value=>{
    const raw=String(value??"").trim();
    if(!raw)return null;
    let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);
    if(m){
      let hour=Number(m[4]),mer=String(m[7]||"").toUpperCase();
      if(mer==="AM"&&hour===12)hour=0;else if(mer==="PM"&&hour<12)hour+=12;
      return {dateKey:[m[1],String(Number(m[2])).padStart(2,"0"),String(Number(m[3])).padStart(2,"0")].join("-"),minutes:hour*60+Number(m[5])+Number(m[6]||0)/60};
    }
    m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if(m){
      let year=Number(m[3]);if(year<100)year+=2000;
      let hour=Number(m[4]),mer=String(m[7]||"").toUpperCase();
      if(mer==="AM"&&hour===12)hour=0;else if(mer==="PM"&&hour<12)hour+=12;
      return {dateKey:[String(year),String(Number(m[1])).padStart(2,"0"),String(Number(m[2])).padStart(2,"0")].join("-"),minutes:hour*60+Number(m[5])+Number(m[6]||0)/60};
    }
    // Zoned ISO / native timestamp: convert the actual instant to Manila time.
    const parsed=new Date(raw);
    if(Number.isNaN(parsed.getTime()))return null;
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
    }).formatToParts(parsed);
    const values={};parts.forEach(part=>{if(part.type!=="literal")values[part.type]=part.value;});
    if(!values.year||!values.hour)return null;
    return {dateKey:values.year+"-"+values.month+"-"+values.day,minutes:Number(values.hour)*60+Number(values.minute||0)+Number(values.second||0)/60};
  };
  const rowTimestamp=(row,kind)=>{
    const keys=Object.keys(row||{});
    const normalized=key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,"");
    const wanted=kind==="pickup"
      ?["pickuptime","firstpickuptime","firstpickupdatetime","pickupdatetime","pickuptimestamp","atpickuptime","scannedtime"]
      :["currentstationreceivedtime","stationreceivedtime","currentreceivedtime","receivedtime"];
    for(const target of wanted){
      const key=keys.find(name=>normalized(name)===target&&String(row[name]??"").trim()!=="");
      if(key)return row[key];
    }
    // Accept SPX headers that append qualifiers to the Pickup Time label.
    if(kind==="pickup"){
      const key=keys.find(name=>{
        const header=normalized(name);
        return header.includes("pickuptime")&&String(row[name]??"").trim()!=="";
      });
      if(key)return row[key];
    }
    return "";
  };
  const todayManilaKey=dateKey(nowManila);
  const postCutoffRedeliverTnKeys=new Set();

  // Dispatched is the current unique population in Delivering, Delivered,
  // and On-Hold. Rebuild it from today's active rows on every refresh so
  // stale or previous-day ledger entries cannot inflate the dashboard card.
  const dispatchedTnKeys=new Set();

  // Build the population once by SPX TN. Incoming Linehaul is included only
  // when its existing checkbox is enabled; duplicates across sources are removed.
  const baselineByTn=new Map();
  const addBaselineRow=row=>{
    if(!row)return;
    const rawTn=spxTN(row),key=tnKey(rawTn);
    if(!key||baselineByTn.has(key))return;
    const meta=badocRowMeta(row);
    baselineByTn.set(key,{
      tn:String(rawTn).trim(),
      town:String(meta.town||row?.["Town Name"]||row?.["Town"]||"").trim(),
      area:String(row?._area||"").trim(),
      initialStatus:String(meta.status||statusTo(row)||"").trim()
    });
  };
  liveTodayVolumeRows.forEach(addBaselineRow);
  if(tvLinehaulEnabled)(Array.isArray(incomingForToday.rows)?incomingForToday.rows:[]).forEach(addBaselineRow);
  const liveBaselineRows=[...baselineByTn.values()];

  // After cutoff, refresh only statuses for SPX TNs in the saved baseline.
  let todayRows=liveTodayRows;
  if(activeVolumeSnapshot){
    const latestByTn=new Map();
    const liveSources=[
      ...(Array.isArray(current?.rows)?current.rows:[]),
      ...(Array.isArray(current?.valid)?current.valid:[]),
      ...(Array.isArray(current?.mis)?current.mis:[])
    ];
    liveSources.forEach(row=>{
      const key=tnKey(spxTN(row));
      if(key)latestByTn.set(key,row);
    });
    const exportedStatuses=Array.isArray(window.__badocOnholdExportRows)
      ?window.__badocOnholdExportRows
      :(typeof badocLoadOnholdExportRows==="function"?badocLoadOnholdExportRows():[]);
    exportedStatuses.forEach(row=>{
      const key=tnKey(spxTN(row));
      if(key)latestByTn.set(key,row);
    });

    // A currently Received / LMHub_Received parcel received after 3 PM
    // today and with a Pick Up Time dated today is classified as Redeliver,
    // not Received Today. Pickup Time may be any time today for this bucket.
    latestByTn.forEach((row,key)=>{
      if(!key||isExceptionRow(row))return;
      const currentStatus=statusKey(statusTo(row));
      if(currentStatus!=="RECEIVED"&&currentStatus!=="LMHUBRECEIVED")return;
      const pickupAt=manilaStamp(rowTimestamp(row,"pickup"));
      const receivedAt=manilaStamp(rowTimestamp(row,"received"));
      if(receivedAt?.dateKey===todayManilaKey&&receivedAt.minutes>=900&&
         pickupAt?.dateKey===todayManilaKey){
        postCutoffRedeliverTnKeys.add(key);
      }
    });

    todayRows=activeVolumeSnapshot.rows.map(item=>{
      const key=tnKey(item?.tn);
      const live=key?latestByTn.get(key):null;
      const liveStatus=live?statusTo(live):"";
      return {
        ...(live||{}),
        "SPX TN":String(item?.tn||""),
        "Town Name":String(item?.town||live?.["Town Name"]||""),
        "Parcel Status To":String(liveStatus||item?.initialStatus||""),
        _area:String(item?.area||"")
      };
    }).filter(row=>!isExceptionRow(row));
  }
  // liveBaselineRows is already deduplicated by normalized SPX TN across
  // Parcel Count and optional Incoming Linehaul. The snapshot uses that same
  // unique population, so neither source overlap nor an old snapshot inflates it.
  const todayVolume=activeVolumeSnapshot
    ?activeVolumeSnapshot.rows.length
    :liveBaselineRows.length;

  // Automatically create one immutable shared snapshot when the 3 PM cutoff is reached.
  if(snapshotDue&&!activeVolumeSnapshot&&window.__badocVolumeSnapshotCloudReady===true&&
     !window.__badocVolumeSnapshotSaving&&liveBaselineRows.length&&
     typeof window.__badocCloudSaveDailyVolumeSnapshot==="function"){
    const snapshot={
      schemaVersion:1,
      cycleKey:volumeCycleKey,
      cutoff:"15:00",
      timezone:"Asia/Manila",
      capturedAt:Date.now(),
      linehaulIncluded:tvLinehaulEnabled,
      count:liveBaselineRows.length,
      rows:liveBaselineRows
    };
    window.__badocVolumeSnapshotSaving=true;
    window.__badocCloudSaveDailyVolumeSnapshot(snapshot)
      .then(result=>{
        if(result?.snapshot)window.__badocVolumeSnapshot=result.snapshot;
      })
      .catch(error=>{
        console.error("Daily volume snapshot save failed:",error);
        const statusEl=document.getElementById("volumeSnapshotStatus");
        if(statusEl)statusEl.textContent="3:00 PM snapshot not saved — shared cloud sync will retry.";
      })
      .finally(()=>{
        window.__badocVolumeSnapshotSaving=false;
        if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
      });
  }

  // Volume Forecast: keep the next-day estimate available all day, counting
  // unique SPX TNs that meet the exact forecast criteria for the 3 PM cutoff today.
  // Destination Station must be BADOC HUB. Current Station must be BADOC HUB,
  // SOC 6, or CAGAYAN DC. Town must be in the configured Badoc/Pinili list.
  // Exceptions are excluded and only the forecast statuses below qualify.
  // Linehaul Task data is not used for this forecast.
  const forecastStatuses=new Set([
    "RECEIVED",
    "LMHUBRECEIVED",
    "SOCLHTRANSPORTING",
    "SOCLHTRANSPORTED",
    "SOCLHPACKED",
    "SOCLHPACKING",
    "SOCPACKED",
    "SOCPACKING"
  ]);
  // Forecast Breakdown checkboxes control which CURRENT STATION + STATUS
  // groups are included in the forecast total.  Default = include everything.
  const FORECAST_FILTER_KEY="badoc_volume_forecast_filters_v1";
  const forecastFilterKey=(station,status)=>norm(String(station||""))+"||"+statusKey(String(status||""));
  let forecastFilterSelections={};
  try{forecastFilterSelections=JSON.parse(localStorage.getItem(FORECAST_FILTER_KEY)||"{}")||{};}catch(e){forecastFilterSelections={};}
  // Expose the filter state/functions because the breakdown modal is rendered
  // by a separate script scope.
  window.__badocForecastFilterSelections=forecastFilterSelections;
  window.__badocForecastFilterKey=forecastFilterKey;
  window.__badocForecastGroupEnabled=(station,status)=>forecastFilterSelections[forecastFilterKey(station,status)]!==false;
  window.__badocSaveForecastFilterSelections=()=>{try{localStorage.setItem(FORECAST_FILTER_KEY,JSON.stringify(forecastFilterSelections));}catch(e){}};
  const forecastGroupEnabled=(station,status)=>window.__badocForecastGroupEnabled(station,status);
  const saveForecastFilterSelections=()=>window.__badocSaveForecastFilterSelections();
  // Build the complete forecast breakdown FIRST. The checkboxes only control
  // which groups contribute to the forecast total; unchecked rows stay visible.
  // Build an always-available all-day population for Planning Board. It uses
  // the same parcel eligibility rules and shared station/status selections,
  // but is deliberately NOT restricted to the Dashboard's 3 PM–3 AM window.
  const allDayForecastRows=[];
  const allDaySeenTnKeys=new Set();
  allRows.forEach(r=>{
    if(destination(r)!=="BADOC HUB")return;
    if(!stations.includes(station(r)))return;
    if(!tomorrowTownEligible(r))return;
    if(isExceptionRow(r))return;
    if(!forecastStatuses.has(statusKey(status(r))))return;
    const tn=tnKey(spxTN(r));
    if(!tn || allDaySeenTnKeys.has(tn))return;
    allDaySeenTnKeys.add(tn);
    allDayForecastRows.push({station:station(r),status:status(r),tn,town:townName(r),record:r});
  });
  // Use the all-day eligible population for both the Dashboard card and Planning Board.
  const forecastDetailRows=allDayForecastRows.slice();
  const forecastStationStatusCounts={};
  forecastDetailRows.forEach(item=>{
    const st=item.station||"UNKNOWN";
    const ss=item.status||"UNKNOWN";
    if(!forecastStationStatusCounts[st])forecastStationStatusCounts[st]={};
    forecastStationStatusCounts[st][ss]=(forecastStationStatusCounts[st][ss]||0)+1;
  });
  const allDayStationStatusCounts={};
  allDayForecastRows.forEach(item=>{
    const st=item.station||"UNKNOWN";
    const ss=item.status||"UNKNOWN";
    if(!allDayStationStatusCounts[st])allDayStationStatusCounts[st]={};
    allDayStationStatusCounts[st][ss]=(allDayStationStatusCounts[st][ss]||0)+1;
  });
  // Selected forecast total = unique SPX TNs belonging to enabled groups.
  const forecastSelectedTnKeys=new Set();
  forecastDetailRows.forEach(item=>{
    if(forecastGroupEnabled(item.station,item.status)) forecastSelectedTnKeys.add(item.tn);
  });
  window.__badocForecastDetails={
    // Dashboard forecast fields remain populated throughout the day.
    rows:forecastDetailRows,
    counts:forecastStationStatusCounts,
    total:forecastSelectedTnKeys.size,
    allTotal:forecastDetailRows.length,
    active:true,
    // All-day fields are also consumed by Planning Board → Volume Forecast.
    allDayRows:allDayForecastRows,
    allDayCounts:allDayStationStatusCounts,
    allDayTotal:allDayForecastRows.length
  };
  const estimatedTomorrow=forecastSelectedTnKeys.size;

  const counts={TRANSPORTING:0,TRANSPORTED:0,RECEIVED:0,ASSIGNING:0,ASSIGNED:0,DELIVERING:0,DELIVERED:0,ONHOLD:0};
  // Keep the IN HUB STATUS counters on their original station/status logic,
  // but calculate the four operational cards from the SAME qualifying parcel
  // population used by Today's Volume. This prevents changing Today's Volume
  // from wiping Delivering/Delivered/Received/On-Hold back to zero.
  const snapshotTnSet=activeVolumeSnapshot
    ?new Set(activeVolumeSnapshot.rows.map(item=>tnKey(item?.tn)).filter(Boolean))
    :null;
  const qualifyingStatusRows=activeVolumeSnapshot
    ?qualifyingDayRows.filter(r=>{
      const st=norm(statusTo(r));
      if(st==="LMHUB ASSIGNING"||st==="LMHUB ASSIGNED")return snapshotTnSet.has(tnKey(spxTN(r)));
      return true;
    })
    :qualifyingDayRows;
  qualifyingStatusRows.forEach(r=>{
    const s=status(r);
    if(s==="SOC LHTRANSPORTING"||s==="SOC PACKED"||s==="SOC PACKING"||(s==="SOC LHTRANSPORTED"&&(station(r)==="CAGAYAN DC"||station(r)==="SOC 6"))) counts.TRANSPORTING++;
    else if(s==="SOC LHTRANSPORTED" && station(r)==="BADOC HUB") counts.TRANSPORTED++;
    else if(s==="LMHUB ASSIGNING") counts.ASSIGNING++;
    else if(s==="LMHUB ASSIGNED") counts.ASSIGNED++;
  });

  todayRows.forEach(r=>{
    // Read the raw status directly and normalize it here. This avoids a
    // stale/cached status representation causing RECEIVED to display 0.
    const s=norm(statusTo(r));
    const tn=tnKey(spxTN(r));
    if((s==="LMHUB RECEIVED" || s==="RECEIVED") &&
       !(activeVolumeSnapshot&&postCutoffRedeliverTnKeys.has(tn))){
      counts.RECEIVED++;
    }else if(s==="DELIVERING") counts.DELIVERING++;
    else if(s==="DELIVERED") counts.DELIVERED++;

  });

  const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=Number(v||0).toLocaleString()};
  const setProgress=(name,n)=>{    setText("op"+name,n);
  };
  // Master checkbox adds Linehaul Task ID volume to the normal Today's Volume.
  const tvMaster=document.getElementById("todayVolumeAddHubStatuses");
  if(tvMaster){
    tvMaster.checked=tvLinehaulEnabled;
    if(!tvMaster.dataset.tvBound){
      tvMaster.dataset.tvBound="1";
      tvMaster.addEventListener("change",()=>{
        try{localStorage.setItem(TV_LINEHAUL_KEY,tvMaster.checked?"1":"0")}catch(e){}
        if(typeof window.updateOperationProgress==="function") window.updateOperationProgress();
      });
    }
  }

  setText("opTodayVolume",todayVolume);
  setText("opIncomingVolume",estimatedTomorrow);
  const card=document.getElementById("incomingVolumeCard");if(card)card.style.display="";
  setProgress("Transporting",counts.TRANSPORTING);setProgress("Transported",counts.TRANSPORTED);setProgress("Received",counts.RECEIVED);setProgress("Assigning",counts.ASSIGNING);setProgress("Assigned",counts.ASSIGNED);
  setText("opDelivering",counts.DELIVERING);setText("opDelivered",counts.DELIVERED);setText("opReceivedSummary",counts.RECEIVED);

  // RTS = unique parcels whose current status begins with Return and whose
  // Pick Up Time is dated today in Philippine time. No 3:00 PM cutoff applies.
  // Use the live daily rows, not the frozen 3:00 PM volume snapshot, so later
  // same-day Return status updates remain eligible for the RTS count.
  const rtsTnKeys=new Set();
  liveTodayRows.forEach(row=>{
    if(!row||isExceptionRow(row))return;
    const key=tnKey(spxTN(row));
    if(!key||rtsTnKeys.has(key))return;
    const statusCandidates=[
      row?.["Status"],
      statusTo(row),
      row?.["Parcel Status"],
      row?.["Delivery Status"],
      row?.["Current Status"]
    ];
    const isReturn=statusCandidates.some(value=>
      String(value??"").trim()!=="" && norm(value).startsWith("RETURN")
    );
    if(!isReturn)return;
    const pickupAt=manilaStamp(rowTimestamp(row,"pickup"));
    if(pickupAt?.dateKey!==todayManilaKey)return;
    rtsTnKeys.add(key);
  });

  // Dispatched is refreshed below, after the current On-Hold total is finalized.
  const setMetricText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value===undefined||value===null||String(value).trim()===""?"—":String(value)};
  setText("opRts",rtsTnKeys.size);
  setText("opExemptions",Array.isArray(exceptionTrackingNumbers)?exceptionTrackingNumbers.length:0);
  let incomingCardTotal=0;
  try{
    const incomingCardData=tvLinehaulEnabled?incomingForToday:
      (typeof getParcelIncomingLinehaul==="function"?getParcelIncomingLinehaul():{total:0});
    incomingCardTotal=Number(incomingCardData?.total||0);
  }catch(e){console.warn("Incoming linehaul dashboard card could not refresh:",e)}
  setText("opIncomingLinehaul",incomingCardTotal);

  // CFR1 — Clear Floor Rate 1.
  // CFR1 uses a persistent daily ledger keyed by Order ID.  The ledger is
  // deliberately separate from the normal uploaded-data store so the 12:00 AM
  // operational reset cannot erase CFR1 eligibility/history.
  const CFR1_KEY="badoc_cfr1_ledger_v5_cagayan_lh_total";
  function cfr1IsExempt(r){
    if(!r)return false;
    const set=exceptionTrackingSet();
    // CFR1 records may be stored in the ledger shape, where the tracking
    // number is held in "tn" rather than an SPX export header.
    const keys=["SPX TN","SLS Tracking Number","SPX TN/Tracking Number","Tracking Number","Order ID","tn"];
    return keys.some(k=>{const v=exceptionKey(r?.[k]);return !!v && set.has(v);});
  }
  const cfr1Now=__badocTime.manilaDate();
  const cfr1DateKey=[cfr1Now.getFullYear(),String(cfr1Now.getMonth()+1).padStart(2,"0"),String(cfr1Now.getDate()).padStart(2,"0")].join("-");
  const cfr1Midnight=new Date(cfr1Now.getFullYear(),cfr1Now.getMonth(),cfr1Now.getDate(),0,0,0,0);
  const cfr1Four=new Date(cfr1Now.getFullYear(),cfr1Now.getMonth(),cfr1Now.getDate(),4,0,0,0);
  const cfr1Seven=new Date(cfr1Now.getFullYear(),cfr1Now.getMonth(),cfr1Now.getDate(),7,0,0,0);
  const cfr1ParseTime=v=>{
    const raw=String(v??"").trim();
    if(!raw)return null;
    // Parse ISO / native spreadsheet timestamps first. Do not replace the first
    // space blindly: display-formatted values such as "10/12/2026, 03:59 PM"
    // would otherwise be changed into an invalid string.
    let d=new Date(raw);
    if(Number.isNaN(d.getTime())){
      // Handle M/D/YYYY, h:mm AM/PM (including an optional comma) as local time.
      const us=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if(us){
        let y=Number(us[3]); if(y<100)y+=2000;
        let hour=Number(us[4]);
        const meridiem=String(us[7]||"").toUpperCase();
        if(meridiem==="AM"&&hour===12)hour=0;
        else if(meridiem==="PM"&&hour<12)hour+=12;
        d=new Date(y,Number(us[1])-1,Number(us[2]),hour,Number(us[5]),Number(us[6]||0),0);
      }
    }
    if(Number.isNaN(d.getTime())){
      // Handle common CSV timestamps without a timezone explicitly as local time.
      const m=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if(m){
        let y=Number(m[3]); if(y<100)y+=2000;
        d=new Date(y,Number(m[1])-1,Number(m[2]),Number(m[4]),Number(m[5]),Number(m[6]||0),0);
      }
    }
    if(Number.isNaN(d.getTime())){
      const isoLocal=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if(isoLocal){
        let hour=Number(isoLocal[4]);
        const mer=String(isoLocal[7]||"").toUpperCase();
        if(mer==="AM"&&hour===12)hour=0; else if(mer==="PM"&&hour<12)hour+=12;
        d=new Date(Number(isoLocal[1]),Number(isoLocal[2])-1,Number(isoLocal[3]),hour,Number(isoLocal[5]),Number(isoLocal[6]||0),0);
      }
    }
    return Number.isNaN(d.getTime())?null:d;
  };
  const cfr1ReceivedTime=r=>{
    if(!r || typeof r!=="object") return null;
    // CSV/header spelling varies between exports. Resolve the received-time
    // column case-insensitively and tolerate punctuation/spacing differences.
    const direct = r["Current Station Received Time"] ?? r["Current Station Received time"] ?? r["Current station received time"];
    if(direct!==undefined && direct!==null && String(direct).trim()!=="") return cfr1ParseTime(direct);
    const normHeader=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const wanted=new Set(["currentstationreceivedtime","stationreceivedtime","currentreceivedtime"]);
    const k=Object.keys(r).find(key=>wanted.has(normHeader(key)));
    if(k && r[k]!==undefined && r[k]!==null && String(r[k]).trim()!=="") return cfr1ParseTime(r[k]);
    return null;
  };
  const cfr1Key=r=>{
    const oid=exceptionKey(r?.["Order ID"]);
    if(oid)return "OID:"+oid;
    const tn=tnKey(spxTN(r));
    return tn?"TN:"+tn:"";
  };
  const cfr1Status=r=>norm(statusTo(r));
  // Pick Up Time is the source of truth for the first scanned time.
  // Pick Up Time is the source of truth for the first scanned time.
  // Accept export headers such as "Pick Up Time", "First Pick Up Time",
  // and "At Pick Up Time" because SPX exports may label the same field differently.
  const cfr1PickUpTime=r=>{
    const directKeys=["Pick Up Time","Pick up time","PICK UP TIME","First Pick Up Time","At Pick Up Time","pickUpTime","scannedTime"];
    for(const key of directKeys){const value=r?.[key];if(value!==undefined&&value!==null&&String(value).trim()!=="")return String(value).trim();}
    const dynamicKey=Object.keys(r||{}).find(key=>String(key).toLowerCase().replace(/[^a-z0-9]/g,"").includes("pickuptime")&&String(r[key]??"").trim()!=="");
    return dynamicKey?String(r[dynamicKey]).trim():"";
  };
  // SOC_LHTransported is part of the CFR1 TOTAL when it is at CAGAYAN DC;
  // it is NOT a scanned status.
  // A Pick Up Time only counts as scanned when its calendar date is TODAY
  // in Philippine time. Yesterday's (or older) pickup timestamps must remain
  // unscanned even when the SPX status still says LMHub_Received.
  // SOC_LHTransported-before-4AM Rule B always remains unscanned.
  const cfr1PickupIsToday=r=>{
    const value=cfr1PickUpTime(r);
    if(!value)return false;
    const parsed=cfr1ParseTime(value);
    if(!parsed)return false;
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(parsed);
    const p={};parts.forEach(x=>{if(x.type!=="literal")p[x.type]=x.value;});
    return p.year+"-"+p.month+"-"+p.day===cfr1DateKey;
  };
  const cfr1IsScannedStatus=r=>{
    if(r?.ruleBUnscanned===true)return false;
    const statusScanned=["DELIVERING","LMHUB DELIVERING","DELIVERED","LMHUB DELIVERED","ONHOLD","ON HOLD","LMHUB ONHOLD","LMHUB ON HOLD"].includes(cfr1Status(r));
    return statusScanned || cfr1PickupIsToday(r);
  };

  // CFR1 ledger is memory-only on this device; shared persistence is cloud-only.
  let cfr1Ledger=window.__badocCfr1LedgerMemory||null;
  // Keep an existing object-backed ledger. The previous check required
  // records to be an Array even though this code stores records as an object;
  // that recreated the ledger on every refresh and prevented the 7 AM freeze.
  const cfr1HasStoredRecords=!!(
    cfr1Ledger && cfr1Ledger.date===cfr1DateKey &&
    cfr1Ledger.records && typeof cfr1Ledger.records==="object"
  );
  if(!cfr1HasStoredRecords){
    cfr1Ledger={date:cfr1DateKey,cutoff:cfr1Four.getTime(),records:{},frozen:false,_resetGeneration:Number(window.__badocCfr1ResetGeneration||0)};
  }else if(Array.isArray(cfr1Ledger.records)){
    const o={}; cfr1Ledger.records.forEach(x=>{if(x?.key)o[x.key]=x}); cfr1Ledger.records=o;
  }
  if(!Object.prototype.hasOwnProperty.call(cfr1Ledger,"_resetGeneration")){
    cfr1Ledger._resetGeneration=Number(window.__badocCfr1ResetGeneration||0);
  }
  // Recovery guard: an older version may have persisted frozen=true with an
  // empty record set. That empty lock must not block rebuilding from batches.
  // Only clear the freeze when there are zero records; populated daily ledgers
  // retain their hard freeze exactly as before.
  if(cfr1Ledger.records && Object.keys(cfr1Ledger.records).length===0){
    cfr1Ledger.frozen=false;
    delete cfr1Ledger.frozenAt;
  }
  // Persist the 7:00 AM eligible-parcel membership snapshot. Current statuses
  // and scanned/unscanned classification continue updating after the cutoff.
  const cfr1FreezeLedger=()=>{
    Object.values(cfr1Ledger.records||{}).forEach(rec=>{
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenStatus")) rec.frozenStatus=String(rec.status||"").trim();
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenScannedTime")) rec.frozenScannedTime=String(rec.scannedTime||"").trim();
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenScanned")) rec.frozenScanned=cfr1IsScannedStatus({Status:rec.frozenStatus,scannedTime:rec.scannedTime,ruleBUnscanned:rec.ruleBUnscanned});
    });
    cfr1Ledger.frozen=true;
    cfr1Ledger.frozenAt=cfr1Seven.getTime();
  };
  // HARD DAILY COUNT FREEZE: once this date reaches 7:00 AM, persist the lock
  // in localStorage. The eligible parcel ID set stays fixed for the day, while
  // statuses and scanned/unscanned classification remain live.
  // Do not freeze an empty ledger. If today's list was missed (for example,
  // this HTML file was opened after 7 AM or local storage was reset), allow
  // CFR1 to recover eligible records from the parcel batches already available.
  // Once at least one record is recovered, the normal 7 AM hard freeze applies.
  if(cfr1Now>=cfr1Seven && cfr1Ledger.frozen!==true && Object.keys(cfr1Ledger.records).length>0){
    cfr1FreezeLedger();
  }

  // Migrate older frozen ledgers once so the modal reads a stable status snapshot.
  if(cfr1Ledger.frozen===true){
    Object.values(cfr1Ledger.records||{}).forEach(rec=>{
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenStatus")) rec.frozenStatus=String(rec.status||"").trim();
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenScannedTime")) rec.frozenScannedTime=String(rec.scannedTime||"").trim();
      if(!Object.prototype.hasOwnProperty.call(rec,"frozenScanned")) rec.frozenScanned=cfr1IsScannedStatus({Status:rec.frozenStatus,scannedTime:rec.scannedTime,ruleBUnscanned:rec.ruleBUnscanned});
    });
  }

  // Read every currently available upload.
  // Rule A: Current Station = BADOC HUB, received timestamp at or before
  // today's 4:00 AM cutoff; do not require the received date to be today.
  // Rule B: Status = SOC_LHTransported, Current Station = CAGAYAN DC,
  // Destination Station = BADOC HUB, observed in an upload timestamped by 4:00 AM.
  // These rows have no received timestamp; display "Transported before 4AM" in exports.
  // This path is UNscanned-only. No separate Rule C.
  // Rule A keeps the configured BADOC/PINILI town restriction.
  // The 7:00 AM freeze locks daily eligible parcel IDs while statuses remain live.
  // Live exceptions can still remove a parcel from CFR1.
  const cfr1AllowedTowns=new Set([
    ...(Array.isArray(towns?.badoc)?towns.badoc:[]),
    ...(Array.isArray(towns?.pinili)?towns.pinili:[])
  ].map(v=>norm(v)).filter(Boolean));

  const cfr1TownOf=r=>{
    const direct=r?.["Town Name"] ?? r?.["Town"] ?? r?.["town"];
    if(direct!==undefined && direct!==null && String(direct).trim()!=="") return norm(direct);
    const entry=Object.entries(r||{}).find(([k,v])=>/^(town name|town)$/i.test(String(k).trim())&&String(v??"").trim()!=="");
    return norm(entry?.[1]??"");
  };

  const cfr1BatchRows=(Array.isArray(batches)?batches:[]).flatMap(b=>
    Array.isArray(b?.rows)?b.rows.map((r,i)=>({r,btime:Number(r?._badoc_sourceUploadedAt||b?.time||0),ri:i,source:"uploaded-batch"})):[]
  );
  // Assigned Today Forward/Return exports are persisted outside the parcel
  // upload batches. Include their merged rows in CFR1 eligibility candidates.
  // Rule A still requires Badoc Hub, an allowed town, and Current Station
  // Received Time at/before 4:00 AM Manila time. Rule B requires a batch
  // uploaded on today's Manila date at/before 4:00 AM.
  const cfr1DashboardRows=typeof getParcelCountRows==="function"
    ?getParcelCountRows({includeExemptions:true})
    :(Array.isArray(current?.rows)?current.rows:[]);
  // Build one reverse index for town provenance instead of scanning every
  // frozen ledger record for every uploaded row (quadratic on large exports).
  const cfr1LedgerByIdentity=new Map();
  Object.values(cfr1Ledger.records||{}).forEach(record=>{
    const oid=exceptionKey(record?.orderId),tn=tnKey(record?.tn);
    if(oid)cfr1LedgerByIdentity.set("OID:"+oid,record);
    if(tn)cfr1LedgerByIdentity.set("TN:"+tn,record);
  });
  const cfr1Rows=[
    ...cfr1BatchRows,
    ...cfr1DashboardRows.map((r,i)=>({r,btime:0,ri:i,source:"dashboard-merged"}))
  ];
  const latestByKey=new Map();
  const cfr1PickupTimeByKey=new Map();
  // Existing CFR1 ledger entries may be keyed by Order ID, while newer SPX
  // delivery exports can identify the same parcel by SLS Tracking Number.
  // Index each source row under BOTH identifiers so a current status is never
  // missed simply because one export omitted the other identifier.
  const cfr1LookupKeys=r=>{
    const keys=[];
    const oid=exceptionKey(r?.["Order ID"]);
    const tn=tnKey(spxTN(r));
    if(oid)keys.push("OID:"+oid);
    if(tn)keys.push("TN:"+tn);
    return [...new Set(keys)];
  };
  cfr1Rows.forEach(x=>{
    const keys=cfr1LookupKeys(x.r); if(!keys.length)return;
    const pickup=cfr1PickUpTime(x.r);
    keys.forEach(key=>{
      const prev=latestByKey.get(key);
      if(!prev || x.btime>prev.btime || (x.btime===prev.btime && x.ri>prev.ri)) latestByKey.set(key,x);
      // Keep the newest non-empty Pick Up Time across all source uploads.
      // A newer delivery-status export may omit that field entirely.
      const prevPickup=cfr1PickupTimeByKey.get(key);
      if(pickup && (!prevPickup || x.btime>prevPickup.btime || (x.btime===prevPickup.btime && x.ri>prevPickup.ri))){
        cfr1PickupTimeByKey.set(key,{value:pickup,btime:x.btime,ri:x.ri});
      }
    });
  });
  // The dashboard's Combined uploads row set is the same merged parcel
  // population used by its live status cards. Overlay these rows as the
  // authoritative current-state source for EXISTING CFR1 members. This does
  // not add members to the frozen 7 AM ledger; it only refreshes their status
  // and retains any pickup timestamp present on the merged parcel row.
  // Use the exact merged operational population used by Dashboard and
  // Planning Board. getParcelCountRows() overlays the latest Assigned Today
  // Forward/Return statuses onto the original Parcel Count records. Reading
  // current.rows alone misses those external status updates.
  cfr1DashboardRows.forEach((r,ri)=>{
    const keys=cfr1LookupKeys(r); if(!keys.length)return;
    const live={r,btime:Number.MAX_SAFE_INTEGER,ri};
    const pickup=cfr1PickUpTime(r);
    keys.forEach(key=>{
      latestByKey.set(key,live);
      if(pickup)cfr1PickupTimeByKey.set(key,{value:pickup,btime:Number.MAX_SAFE_INTEGER,ri});
    });
  });
  // Resolve a saved CFR1 record using its original key plus both identifiers.
  // This is essential when the original record had an Order ID but a newer
  // SPX delivery export matches only by tracking number (or vice versa).
  const cfr1LatestForRecord=rec=>{
    const candidates=[
      rec?.tn?"TN:"+tnKey(rec.tn):"",
      rec?.orderId?"OID:"+exceptionKey(rec.orderId):"",
      String(rec?.key||"")
    ].filter(Boolean);
    let best=null;
    [...new Set(candidates)].forEach(candidateKey=>{
      const candidate=latestByKey.get(candidateKey);
      // On equal source recency, prefer the exact tracking-number match.
      if(candidate && (!best || candidate.btime>best.btime)) best=candidate;
    });
    return best;
  };
  const cfr1PickupForRecord=rec=>{
    const candidates=[
      String(rec?.key||""),
      rec?.orderId?"OID:"+exceptionKey(rec.orderId):"",
      rec?.tn?"TN:"+tnKey(rec.tn):""
    ].filter(Boolean);
    for(const candidateKey of [...new Set(candidates)]){
      const pickup=cfr1PickupTimeByKey.get(candidateKey)?.value;
      if(pickup)return pickup;
    }
    return "";
  };

  // Do not delete existing CFR1 members solely because their received date
  // is not today. Rule A uses the existing 4:00 AM cutoff without a same-day
  // date restriction. Rule B does not depend on a received timestamp.
  // Snapshot whether this refresh is recovering an empty post-7 AM ledger.
  // Keep this decision constant for the whole pass so finding the first parcel
  // does not accidentally stop the rest of the eligible batch from being added.
  const cfr1RecoveringEmptyLedger = cfr1Now>=cfr1Seven &&
    Object.keys(cfr1Ledger.records).length===0;
  // If a frozen ledger was shortened by an incomplete cloud merge, reconcile
  // it against the original pre-7 AM upload batches. This can restore omitted
  // members, but never admits a batch uploaded after the daily freeze.
  const cfr1RestoringFrozenLedger = cfr1Now>=cfr1Seven &&
    Object.keys(cfr1Ledger.records).length>0;

  // First pass: build eligibility before 7 AM. After 7 AM, a missing/partial
  // ledger can only be recovered from batches already present by 7:00 AM.
  // Rule A keeps its existing received-time cutoff without a same-day restriction.
  // Rule B keeps its existing SOC_LHTransported / CAGAYAN DC / BADOC HUB rule
  // and requires a same-Manila-day upload by 4:00 AM. No separate Rule C exists.
  cfr1Rows.forEach(x=>{
    const batchTime=Number(x.btime||0);
    if(cfr1Ledger.frozen===true && !cfr1RestoringFrozenLedger)return;
    if(cfr1Now>=cfr1Seven && !cfr1RecoveringEmptyLedger && !cfr1RestoringFrozenLedger)return;
    // Exemptions are display-only for CFR1; they must not remove eligible
    // parcels from the daily CFR1 membership ledger.
    const r=x.r,key=cfr1Key(r); if(!key)return;
    // A frozen ledger may be repaired from a batch that existed by 7:00 AM,
    // but a later upload must never introduce a new member, even if its row
    // carries an old received timestamp. Existing members remain refreshable.
    if(cfr1Ledger.frozen===true && !cfr1Ledger.records[key]){
      const frozenAt=Number(cfr1Ledger.frozenAt||cfr1Seven.getTime());
      if(!batchTime || batchTime>frozenAt)return;
    }
    const stationRaw=r?.["Current Station"] ?? r?.["Current station"] ?? r?.["CURRENT STATION"] ?? Object.entries(r||{}).find(([k,v])=>/^(current\s*station)$/i.test(String(k).trim())&&String(v??"").trim()!=="")?.[1] ?? "";
    const station=norm(stationRaw);
    const status=cfr1Status(r);
    // Rule B has no received timestamp. Its upload must be from the current
    // Manila calendar day and at/before 4:00 AM, even during post-7 AM recovery.
    const isRuleB=
      status==="SOC LHTRANSPORTED" &&
      station==="CAGAYAN DC" &&
      destination(r)==="BADOC HUB" &&
      batchTime>=cfr1Midnight.getTime() &&
      batchTime<=cfr1Four.getTime();
    // Preserve town provenance when a newer status-only export has an empty
    // Town Name. Match by either stable OID or TN before applying Rule A.
    const rowTN=tnKey(spxTN(r));
    const rowOID=exceptionKey(r?.["Order ID"]);
    const priorTownRecord=(rowOID&&cfr1LedgerByIdentity.get("OID:"+rowOID))||
      (rowTN&&cfr1LedgerByIdentity.get("TN:"+rowTN))||null;
    const cfr1Town=cfr1TownOf(r) || norm(priorTownRecord?.town||"");
    const townEligible=!!cfr1Town && cfr1AllowedTowns.has(cfr1Town);
    let rt=null;
    if(isRuleB){
      // Rule B is unscanned-only. Evaluate the status and station fields
      // from the uploaded file; do not require or check a received timestamp.
      rt=null;
    }else{
      // Rule A: BADOC HUB station and received timestamp <= today's 4 AM.
      // Keep the original cutoff behavior; do not require the date to be today.
      if(station!=="BADOC HUB" || !townEligible)return;
      rt=cfr1ReceivedTime(r);
      // Rule A is timestamp-based, not upload-time-based. A late cloud pull
      // may materialize the source batch after 7 AM; the parcel is still
      // eligible when its Current Station Received Time is at/before 4 AM.
      if(!rt || rt>cfr1Four)return;
    }
    let prev=cfr1Ledger.records[key];
    // Tracking-number-only identities may later gain an OID. Migrate the
    // existing record instead of creating a second CFR1 member.
    if(!prev && rowOID && rowTN){
      const legacyKey="TN:"+rowTN;
      const legacy=cfr1Ledger.records[legacyKey];
      if(legacy){prev=legacy;delete cfr1Ledger.records[legacyKey];cfr1Ledger.records[key]={...legacy,key};}
    }
    const rtMs=rt?rt.getTime():null;
    const prevHasRt=!!(prev && prev.receivedMs!==null && prev.receivedMs!==undefined && prev.receivedMs!=="" && Number.isFinite(Number(prev.receivedMs)));
    const shouldWrite=!prev || (!prevHasRt && rtMs!==null) || (rtMs!==null && prevHasRt && rtMs<Number(prev.receivedMs));
    if(shouldWrite){
      cfr1Ledger.records[key]={
        key,
        orderId:String(r?.["Order ID"]??"").trim(),
        tn:String(spxTN(r)??"").trim(),
        town:String(r?.["Town Name"]??r?.["Town"]??"").trim() || String(prev?.town||""),
        receivedMs:rtMs,
        latestBatchTime:x.btime,
        latestRowTime:x.btime,
        status:String(statusTo(r)||r?.["Status"]||"").trim(),
        scannedTime:isRuleB?"":(cfr1PickUpTime(r)||cfr1PickupTimeByKey.get(key)?.value||""),
        noTownFilter:isRuleB,
        ruleBUnscanned:isRuleB
      };
    }
  });

  // If a post-7 AM recovery found eligible parcels, freeze the recovered list
  // now. If no eligible parcels are currently available, leave the ledger
  // unfrozen and retry on the next dashboard refresh instead of locking zero.
  if(cfr1Now>=cfr1Seven && cfr1Ledger.frozen!==true && Object.keys(cfr1Ledger.records).length>0){
    cfr1FreezeLedger();
  }

  // Second pass: the 7:00 AM freeze locks ONLY the eligible parcel ID set
  // (the daily CFR1 total membership). Statuses remain live after 7:00 AM:
  // later SPX imports must update each admitted parcel's current status and
  // its SCANNED / UNSCANNED classification without adding new parcel IDs.
  let cfr1LiveStatusRefreshMatches=0;
  const cfr1LiveStatusRefreshSamples=[];
  Object.keys(cfr1Ledger.records).forEach(key=>{
    const rec=cfr1Ledger.records[key];
    const latest=cfr1LatestForRecord(rec);
    if(latest){
      cfr1LiveStatusRefreshMatches++;
      if(cfr1LiveStatusRefreshSamples.length<12)cfr1LiveStatusRefreshSamples.push({
        orderId:String(rec.orderId||""),
        tn:String(rec.tn||""),
        status:String(statusTo(latest.r)||latest.r?.["Status"]||""),
        source:latest.btime===Number.MAX_SAFE_INTEGER?"dashboard-merged":"uploaded-batch"
      });
      const r=latest.r;
      // Keep the latest parcel data live even when it is listed in Exemptions.
      // Exemptions only add an INTERCEPT cue to unscanned details; they do not
      // suppress membership, status refreshes, or the scanned/unscanned split.
      rec.orderId=String(r?.["Order ID"]??rec.orderId??"").trim();
      rec.tn=String(spxTN(r)??rec.tn??"").trim();
      rec.town=String(r?.["Town Name"]??r?.["Town"]??rec.town??"").trim();
      rec.status=String(statusTo(r)||r?.["Status"]||r?.["Parcel Status"]||r?.["Current Status"]||"").trim();
      // Capture Pick Up Time once whenever it is present, even when SPX
      // still reports LMHub_Received. Rule B is explicitly unscanned.
      if(rec.ruleBUnscanned===true){
        rec.scannedTime="";
      }else{
        // Prefer the latest row's pickup field; fall back to the newest
        // non-empty timestamp retained from any SPX source upload for this TN.
        const pickup=cfr1PickUpTime(r)||cfr1PickupForRecord(rec);
        if(pickup)rec.scannedTime=pickup;
      }
      const latestStation=norm(r?.["Current Station"]||"");
      const latestStatus=cfr1Status(r);
      rec.noTownFilter=!!rec.noTownFilter || (
        latestStatus.includes("TRANSPORTED") &&
        latestStation==="CAGAYAN DC" &&
        destination(r)==="BADOC HUB"
      );
      rec.latestBatchTime=latest.btime;
    }
  });
  // Keep the latest CFR1 ledger in memory only. Cloud Storage is the sole
  // persistent source for this ledger; no CFR1 ledger is written to localStorage.
  window.__badocCfr1LedgerMemory=cfr1Ledger;
  // Cloud-sync the daily CFR1 ledger separately from uploaded parcel data.
  // Do not sync the reset operation by deleting parcel data.
  try{window.__badocCfr1CloudSync?.publish?.(CFR1_KEY,cfr1Ledger)}catch(e){console.warn("CFR1 cloud publish queue failed",e)}

  let cfr1Total=0,cfr1Scanned=0;
  const cfr1ScannedRows=[], cfr1UnscannedRows=[];
  Object.values(cfr1Ledger.records).forEach(rec=>{
    const key=rec.key;
    const latest=cfr1LatestForRecord(rec)?.r;
    // Exemptions never remove a parcel from CFR1. They are only marked as
    // INTERCEPT in the Unscanned details when the current parcel is unscanned.
    const isIntercept=cfr1IsExempt(latest||rec);
    const latestTown=cfr1TownOf(latest||rec);
    const specialNoTownFilter=!!rec.noTownFilter;
    if(!specialNoTownFilter && (!latestTown || !cfr1AllowedTowns.has(latestTown)))return;
    // Always show the latest synced status. The daily freeze is for count
    // membership only; it must not pin a parcel to its 7:00 AM status.
    const rawStatus=String(rec.status||"").trim();
    const scanned=cfr1IsScannedStatus({...rec,Status:rawStatus});
    cfr1Total++;
    if(scanned){
      cfr1Scanned++;
      cfr1ScannedRows.push({
        orderId:rec.orderId||rec.tn||"",
        town:rec.town||"",
        status:rawStatus,
        receivedTime:rec.ruleBUnscanned===true?"Transported before 4AM":(rec.receivedMs!==null && rec.receivedMs!==undefined && rec.receivedMs!=="" && Number.isFinite(Number(rec.receivedMs))?new Date(Number(rec.receivedMs)).toLocaleString("en-PH", {year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:true}):""),
        scannedTime:rec.scannedTime||""
      });
    }else{
      // Every parcel counted in cfr1Total must appear in exactly one tab.
      // Do not restrict the Unscanned list to only LMHUB RECEIVED/TRANSPORTED:
      // any eligible ledger record that does not meet the scanned-status rule
      // belongs in Unscanned, keeping the tab counts consistent with the KPI.
      cfr1UnscannedRows.push({
        orderId:rec.orderId||rec.tn||"",
        town:rec.town||"",
        status:isIntercept?"INTERCEPT · "+(rawStatus||"UNSCANNED"):rawStatus,
        receivedTime:rec.ruleBUnscanned===true?"Transported before 4AM":(rec.receivedMs!==null && rec.receivedMs!==undefined && rec.receivedMs!=="" && Number.isFinite(Number(rec.receivedMs))?new Date(Number(rec.receivedMs)).toLocaleString("en-PH", {year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:true}):"")
      });
    }
  });
  window.__badocCfr1Details={
    scanned:cfr1ScannedRows,
    unscanned:cfr1UnscannedRows,
    scannedCount:cfr1ScannedRows.length,
    // The same eligible ledger rows feed both tabs, so scanned + unscanned
    // must equal the displayed CFR1 total.
    totalCount:cfr1ScannedRows.length+cfr1UnscannedRows.length
  };
  // Diagnostic snapshot for support: confirms whether an existing CFR1
  // member matched a live merged parcel row and which latest status was used.
  window.__badocCfr1Debug={
    date:cfr1DateKey,
    ledgerRecords:Object.keys(cfr1Ledger.records||{}).length,
    liveStatusRefreshMatches:cfr1LiveStatusRefreshMatches,
    uploadBatchCandidateRows:cfr1BatchRows.length,
    dashboardStatusRows:cfr1DashboardRows.length,
    eligibilityCandidateRows:cfr1Rows.length,
    assignedTodaySourceRows:Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows.length:0,
    latestSamples:cfr1LiveStatusRefreshSamples,
    scannedCount:cfr1ScannedRows.length,
    unscannedCount:cfr1UnscannedRows.length
  };
  setText("opCfr1Scanned",window.__badocCfr1Details.scannedCount);
  setText("opCfr1Total",window.__badocCfr1Details.totalCount);
  // Display the CFR1 scanned share as a percentage. The existing hidden
  // scanned/total elements remain available to the alert/export integrations.
  const cfr1DisplayScanned=window.__badocCfr1Details.scannedCount;
  const cfr1DisplayTotal=window.__badocCfr1Details.totalCount;
  const cfr1DisplayPercent=cfr1DisplayTotal>0?(cfr1DisplayScanned/cfr1DisplayTotal)*100:0;
  const cfr1PercentNode=document.getElementById("opCfr1Percentage");
  const cfr1SummaryNode=document.getElementById("opCfr1Summary");
  if(cfr1PercentNode)cfr1PercentNode.textContent=cfr1DisplayPercent.toFixed(1)+"%";
  if(cfr1SummaryNode)cfr1SummaryNode.textContent=cfr1DisplayScanned.toLocaleString()+" / "+cfr1DisplayTotal.toLocaleString()+" scanned";
  // On-Hold = any populated status except Delivering / Delivered, with
  // a same-day Pick Up Time before 3:00 PM Manila time. This shared rule is
  // applied to uploaded Parcel Count rows and SPX Forward / Return exports.
  // Newer exports override older rows for the same SPX TN; duplicates count once.
  // Before 3 PM, exports may add qualifying TNs to the live population.
  // After the 3 PM snapshot, export status updates are restricted to TNs
  // already in that frozen population; new TNs cannot enter On-Hold,
  // Dispatched, or Unscanned for the current operating cycle.
  const onholdRows=badocGetOnholdRows(todayRows,!!activeVolumeSnapshot);
  // Backlogs = unique current parcels without a Pick Up Time timestamp
  // dated today in Manila. This intentionally uses the live Parcel Count +
  // Assigned Today population, not the 3 PM Today's Volume snapshot: older
  // parcels and records added after cutoff must still be eligible for Backlogs.
  // Blank and prior-day pickup timestamps both remain in Backlogs.
  // Exemptions do not remove parcels from the Backlogs population.
  const backlogTnKeys=new Set();
  backlogSourceRows.forEach(row=>{
    if(!row)return;
    const key=tnKey(spxTN(row));
    if(!key)return;
    const pickupAt=manilaStamp(rowTimestamp(row,"pickup"));
    if(pickupAt?.dateKey!==todayManilaKey)backlogTnKeys.add(key);
  });
  setText("opBacklogs",backlogTnKeys.size);
  // Dispatched is the union of the current Delivering, Delivered and On-Hold
  // tracking numbers. The Set prevents overlap or duplicate exports from
  // counting a parcel more than once, both before and after the 3 PM snapshot.
  todayRows.forEach(row=>{
    const key=tnKey(spxTN(row));
    const state=statusKey(statusTo(row));
    if(key&&["DELIVERING","DELIVERED"].includes(state))dispatchedTnKeys.add(key);
  });
  onholdRows.forEach(row=>{
    const key=tnKey(spxTN(row));
    if(key)dispatchedTnKeys.add(key);
  });
  const onholdTnKeys=new Set(onholdRows.map(r=>badocOnholdKey(spxTN(r))).filter(Boolean));
  window.__badocOnholdTnKeys=onholdTnKeys;
  const onHold=onholdTnKeys.size;
  counts.ONHOLD=onHold;
  setText("opOnHold",onHold);

  // Hub Performance uses the same unique assigned-rider total shown in
  // Dashboard → Assigned Riders, covering Badoc and Pinili without double-counting.
  try { window.__badocRenderDashboardRiderSummary?.(); }
  catch(e) { console.warn("Hub Performance rider total could not refresh:",e); }
  const assignedRiderTotal=document.getElementById("dashboardRiderTotal");
  setMetricText("opTotalRiders",assignedRiderTotal?assignedRiderTotal.textContent.trim():"—");

  // Match Daily History: delivered / (delivered + delivering + on-hold + received).
  // The status population excludes exemptions and uses the live operational counts.
  const successRateDenominator=(counts.DELIVERED||0)+onHold+(counts.DELIVERING||0)+(counts.RECEIVED||0);
  const successRate=successRateDenominator>0?((counts.DELIVERED||0)/successRateDenominator)*100:null;
  setMetricText("opSuccessRate",successRate===null?"—":successRate.toFixed(1)+"%");

  // Redeliver is sourced only from qualifying SPX parcel records.
  // The EOD-sheet aggregate is intentionally not included.
  setText("opRedelivery",postCutoffRedeliverTnKeys.size);

  // Match the current Delivering + Delivered + On-Hold populations, counting
  // unique SPX TNs only (not historical statuses or a persisted prior-day ledger).
  const dispatchedTotal=dispatchedTnKeys.size;
  setText("opDispatched",dispatchedTotal);

  // Unscanned: Today's Volume minus Delivering, Delivered and On-Hold.
  const unscanned=Math.max(0,todayVolume-(counts.DELIVERING||0)-(counts.DELIVERED||0)-onHold);
  setText("opUnscanned",unscanned);

  let dashboardDetailsCache=null;
  window.__badocBuildDashboardParcelDetails=function(){
    if(dashboardDetailsCache)return dashboardDetailsCache;
  // Build the OID/status drill-down lists from the same rows and membership
  // sets that drive the dashboard cards above. This is display-only: it does
  // not change any card's count or eligibility rule.
  const dashboardDetailField=(row,names)=>{
    const normalizeHeader=value=>String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const keys=Object.keys(row||{});
    for(const name of names){
      const wanted=normalizeHeader(name);
      const key=keys.find(candidate=>normalizeHeader(candidate)===wanted&&String(row[candidate]??"").trim()!=="");
      if(key)return String(row[key]).trim();
    }
    return "";
  };
  const dashboardRiderName=row=>{
    const riderName=dashboardDetailField(row,[
      "Rider Name","Driver Name","Assigned Rider","Assigned Rider Name",
      "Delivery Rider","Assigned Driver","Assigned Driver Name","Rider",
      "Delivery Driver Name","Delivery Rider Name"
    ]);
    if(riderName)return riderName;
    const riderId=dashboardDetailField(row,[
      "Rider ID","Driver ID","Assigned Rider ID","Delivery Rider ID","Assigned Driver ID"
    ]);
    const roster=Array.isArray(ridersData)?ridersData:[];
    if(riderId){
      const matched=roster.find(r=>String(r?.["Driver ID"]??"").trim()===riderId);
      if(matched?.["Driver Name"])return String(matched["Driver Name"]).trim();
    }
    return "";
  };
  const dashboardScannedTime=row=>{
    const pickup=rowTimestamp(row,"pickup");
    if(pickup!==undefined&&pickup!==null&&String(pickup).trim()!=="")return String(pickup).trim();
    return dashboardDetailField(row,[
      "Pick Up Time","Pickup Time","First Pick Up Time","First Pickup Time",
      "At Pick Up Time","Pickup Date Time","Pickup Datetime","Pickup Timestamp",
      "Scanned Time","ScannedTime"
    ]);
  };
  const dashboardReceivedTime=row=>dashboardDetailField(row,[
    "Current Station Received Time"
  ]);
  const dashboardDetailRow=row=>({
    orderId:String(row?.["Order ID"]??row?.["Order Id"]??"").trim(),
    tn:String(spxTN(row)||row?.["SLS Tracking Number"]||row?.["SPX TN"]||"").trim(),
    status:String(statusTo(row)||row?.["Status"]||row?.["Parcel Status"]||row?.["Delivery Status"]||row?.["Current Status"]||"").trim(),
    town:String(row?.["Town Name"]??row?.["Town"]??row?.town??"").trim(),
    scannedTime:dashboardScannedTime(row),
    receivedTime:dashboardReceivedTime(row),
    rider:dashboardRiderName(row)
  });
  const detailLookup=new Map();
  const detailSources=[
    ...(Array.isArray(current?.rows)?[current.rows]:[]),
    ...(Array.isArray(current?.valid)?[current.valid]:[]),
    ...(Array.isArray(current?.mis)?[current.mis]:[]),
    liveTodayRows,
    backlogSourceRows,
    Array.isArray(incomingForToday?.rows)?incomingForToday.rows:[],
    todayRows,
    Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows:[]
  ];
  detailSources.forEach(source=>{
    (source||[]).forEach(row=>{
      if(!row)return;
      const item=dashboardDetailRow(row);
      const key=tnKey(item.tn);
      if(!key)return;
      const previous=detailLookup.get(key)||{orderId:"",tn:"",status:"",town:"",scannedTime:"",receivedTime:"",rider:""};
      detailLookup.set(key,{
        orderId:item.orderId||previous.orderId,
        tn:item.tn||previous.tn,
        status:item.status||previous.status,
        town:item.town||previous.town,
        scannedTime:item.scannedTime||previous.scannedTime,
        receivedTime:item.receivedTime||previous.receivedTime,
        rider:item.rider||previous.rider
      });
    });
  });
  const collectDashboardDetails=(rows,predicate=()=>true)=>{
    const seen=new Set(),out=[];
    (rows||[]).forEach(row=>{
      if(!row)return;
      const key=tnKey(spxTN(row));
      if(!key||seen.has(key)||!predicate(row,key))return;
      seen.add(key);
      const fallback=dashboardDetailRow(row);
      const latest=detailLookup.get(key)||fallback;
      out.push({
        orderId:latest.orderId||fallback.orderId||"",
        status:latest.status||fallback.status||"",
        town:latest.town||fallback.town||"",
        scannedTime:latest.scannedTime||fallback.scannedTime||"",
        receivedTime:latest.receivedTime||fallback.receivedTime||"",
        rider:latest.rider||fallback.rider||""
      });
    });
    return out;
  };
  const collectDashboardKeys=keys=>{
    const out=[];
    (keys||[]).forEach(key=>{
      const normalized=tnKey(key);
      if(!normalized)return;
      const found=detailLookup.get(normalized);
      out.push(found?{...found}:{orderId:"",status:"Latest status not present in loaded rows",town:"",scannedTime:"",rider:""});
    });
    return out;
  };

  const todayVolumeSource=activeVolumeSnapshot
    ?activeVolumeSnapshot.rows.map(item=>({
      "SPX TN":String(item?.tn||""),
      "Town Name":String(item?.town||""),
      "Parcel Status To":String(item?.initialStatus||"")
    }))
    :[...liveTodayVolumeRows,...(tvLinehaulEnabled&&Array.isArray(incomingForToday?.rows)?incomingForToday.rows:[])];
  const forecastParcelRows=forecastDetailRows
    .filter(item=>forecastGroupEnabled(item.station,item.status))
    .map(item=>item.record)
    .filter(Boolean);
  const receivedDetailRows=collectDashboardDetails(todayRows,row=>{
    const state=statusKey(statusTo(row));
    const key=tnKey(spxTN(row));
    return (state==="RECEIVED"||state==="LMHUBRECEIVED") &&
      !(activeVolumeSnapshot&&postCutoffRedeliverTnKeys.has(key));
  });
  const deliveringDetailRows=collectDashboardDetails(todayRows,row=>statusKey(statusTo(row))==="DELIVERING");
  const deliveredDetailRows=collectDashboardDetails(todayRows,row=>statusKey(statusTo(row))==="DELIVERED");
  const dispatchedDetailRows=collectDashboardKeys([...dispatchedTnKeys]);
  const backlogDetailRows=collectDashboardDetails(backlogSourceRows,(row,key)=>backlogTnKeys.has(key));
  const rtsDetailRows=collectDashboardDetails(liveTodayRows,(row,key)=>rtsTnKeys.has(key));
  const redeliveryDetailRows=collectDashboardDetails(
    [...liveTodayRows,...todayRows,...(Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows:[])],
    (row,key)=>postCutoffRedeliverTnKeys.has(key)
  );
  const exceptionById=new Map();
  detailLookup.forEach(item=>{
    const id=exceptionKey(item.orderId);
    if(id)exceptionById.set(id,item);
  });
  const exemptionDetailRows=(Array.isArray(exceptionTrackingNumbers)?exceptionTrackingNumbers:[]).map(value=>{
    const raw=String(value??"").trim();
    const key=exceptionKey(raw);
    const match=detailLookup.get(tnKey(raw))||exceptionById.get(key);
    return match
      ?{orderId:match.orderId||"",status:(match.status?match.status+" · EXEMPTED":"EXEMPTED"),town:match.town||"",scannedTime:match.scannedTime||"",rider:""}
      :{orderId:"—",status:"EXEMPTED · parcel record not loaded",town:"—",scannedTime:"",rider:""};
  });
  const redeliveryCardTotal=postCutoffRedeliverTnKeys.size;
  window.__badocDashboardParcelDetails={
    todayVolume:{
      count:todayVolume,rows:collectDashboardDetails(todayVolumeSource),
      note:activeVolumeSnapshot
        ?"Uses the saved 3:00 PM Manila operating-volume population. Statuses shown are the latest statuses available in the loaded data."
        :(tvLinehaulEnabled
          ?"Includes all qualifying Parcel Count and enabled Incoming Linehaul parcels, including tracking numbers listed under Exemptions; duplicate SPX TNs are counted once."
          :"Uses all qualifying Parcel Count parcels, including tracking numbers listed under Exemptions; duplicate SPX TNs are counted once.")
    },
    dispatched:{
      count:dispatchedTotal,rows:dispatchedDetailRows,
      note:activeVolumeSnapshot
        ?"Uses the cumulative dispatched-TN ledger for this operating cycle. A parcel remains listed if its status later changes back to Received; the table shows its latest available status."
        :"Includes the current Delivering, Delivered, and On-Hold populations."
    },
    forecast:{
      count:estimatedTomorrow,rows:collectDashboardDetails(forecastParcelRows),
      note:"Shows only forecast station/status groups currently enabled in Forecast Breakdown. This is the same selected population used by the dashboard forecast total."
    },
    received:{
      count:counts.RECEIVED,rows:receivedDetailRows,
      note:"Same status and 3:00 PM snapshot handling used by the Received card. Post-cutoff Received parcels classified as Redeliver are excluded."
    },
    delivering:{count:counts.DELIVERING,rows:deliveringDetailRows,note:"Current Delivering records in the dashboard's Today's Volume population."},
    delivered:{count:counts.DELIVERED,rows:deliveredDetailRows,note:"Current Delivered records in the dashboard's Today's Volume population."},
    onhold:{
      count:onHold,rows:collectDashboardDetails(onholdRows),
      note:"Same On-Hold result used by the card: qualifying status, same-day Pick Up Time before 3:00 PM Manila time, Delivering and Delivered excluded, and newer export rows taking precedence."
    },
    backlogs:{
      count:backlogTnKeys.size,rows:backlogDetailRows,
      note:"Unique current parcel TNs without a Pick Up Time dated today in Manila. Blank and prior-day pickup timestamps remain in Backlogs."
    },
    redelivery:{
      count:redeliveryCardTotal,rows:redeliveryDetailRows,
      note:"Counts only unique SPX parcels currently Received or LMHub_Received, with Received Time today at or after 3:00 PM Manila time and Pick Up Time dated today. The table shows the itemized OID/status records available from SPX data."
    },
    rts:{
      count:rtsTnKeys.size,rows:rtsDetailRows,
      note:"Unique parcels with a current status beginning with Return and a Pick Up Time dated today in Manila."
    },
    exemptions:{
      count:Array.isArray(exceptionTrackingNumbers)?exceptionTrackingNumbers.length:0,
      rows:exemptionDetailRows,
      note:"Shows every entry in the shared exemption list. When a matching parcel row is loaded, its current OID and status are shown; otherwise the stored exemption identifier is displayed as the SPX TN."
    }
  };
    dashboardDetailsCache=window.__badocDashboardParcelDetails;
    return dashboardDetailsCache;
  };

};
__badocEvery(()=>window.updateOperationProgress?.(),30000);
