(function(){
"use strict";
function byId(id){return document.getElementById(id)}
const ALL_DATES_VALUE="__ALL_DATES__";
let lastRenderManilaDayKey="";
function manilaTodayKey(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p={};parts.forEach(part=>{if(part.type!=="literal")p[part.type]=part.value});
  return p.year+"-"+p.month+"-"+p.day;
}
function norm(v){return String(v??"").trim().toUpperCase().replace(/\s+/g," ")}
function key(v){return norm(v).replace(/[^A-Z0-9]/g,"")}
function value(row,names){
  const keys=Object.keys(row||{});
  for(const name of names){
    const k=key(name),found=keys.find(x=>key(x)===k);
    if(found&&String(row[found]??"").trim())return String(row[found]).trim();
  }
  return "";
}
function trackingNumber(row){
  // Prefer the shared SPX normalizer, but keep the row usable when that
  // helper is unavailable or a particular export uses a different header.
  if(typeof window.spxTN==="function"){
    try{
      const normalized=String(window.spxTN(row)||"").trim();
      if(normalized)return normalized;
    }catch(_){}
  }
  return value(row,[
    "SPX TN","SLS Tracking Number","SPX Tracking Number","Tracking Number",
    "Tracking No","Tracking No.","SPX Tracking No","SPX Tracking No.",
    "Shipment Tracking Number","Waybill Number","AWB"
  ]);
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function vehicle(v){
  const k=key(v);
  if(k==="2WH"||k==="2W")return "2WH";
  if(k==="3WH"||k==="3WC"||k==="3W")return "3WH";
  if(k==="FLEXI"||k==="FLEX")return "FLEXI";
  return "UNKNOWN";
}
function activityDate(row,status){
  const names=[];
  if(status.includes("DELIVERED"))names.push("Delivered Time","Delivered Date","Delivery Time");
  else if(status.includes("DELIVERING"))names.push("Delivering Time","Delivering Date","Delivery Start Time");
  else if(status.includes("ONHOLD")||status.includes("ON HOLD"))names.push("OnHold Time","On Hold Time");
  else if(status.includes("RECEIVED"))names.push("Received Time","Current Station Received Time");
  names.push("Scan Time","Scanned Time","Scan Date","Last Scan Time","Date","Received Time","Delivering Time","Delivered Time","OnHold Time","On Hold Time");
  const raw=value(row,names);if(!raw)return "";
  let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m)return m[1]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[3]).padStart(2,"0");
  m=raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m)return m[1]+"-"+m[2]+"-"+m[3];
  let d=null;
  if(/^\d+(\.\d+)?$/.test(raw)){
    const n=Number(raw);
    if(n>100000000000)d=new Date(n);
    else if(n>1000000000)d=new Date(n*1000);
    else if(n>20000&&n<80000)d=new Date(Date.UTC(1899,11,30)+n*86400000);
  }else d=new Date(raw.includes("T")?raw:raw.replace(/\s+/,"T"));
  if(!d||Number.isNaN(d.getTime()))return "";
  try{return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}catch(_){return ""}
}
function rosterIndexes(){
  const byId=new Map(),byName=new Map();
  (typeof ridersData!=="undefined"&&Array.isArray(ridersData)?ridersData:[]).forEach(r=>{
    const id=String(r["Driver ID"]||"").trim(),name=String(r["Driver Name"]||"").trim();
    if(id)byId.set(key(id),r);if(name)byName.set(key(name),r);
  });
  return {byId,byName};
}
function assignmentMap(roster){
  const map=new Map();
  ["badoc","pinili"].forEach(area=>{
    const groups=typeof window.getTownLayout==="function"?window.getTownLayout(area):[];
    const notes=typeof window.getTownNotes==="function"?window.getTownNotes(area):[];
    const columns=[[],[]];(groups||[]).forEach((group,index)=>columns[index%2].push(group));
    let noteIndex=0;
    columns.forEach(column=>column.forEach(group=>{
      const assigned=String(notes[noteIndex++]||"").trim();
      (group||[]).forEach(town=>{const k=norm(town);if(k)map.set(k,assigned)});
    }));
  });
  return map;
}
function build(){
  const source=typeof getParcelCountRows==="function"?getParcelCountRows():(typeof current!=="undefined"&&Array.isArray(current?.rows)?current.rows:[]);
  const sourceRows=Array.isArray(source)?source:[];
  const roster=rosterIndexes(),assignments=assignmentMap(roster);
  // Use the exact same OnHold population as Dashboard / Planning Board:
  // status + Pick Up Time cutoff, current export precedence, exceptions and TN dedup.
  // Do not infer OnHold from raw status text in this rider view.
  const sharedOnholdRows=typeof window.__badocGetOnholdRows==="function"
    ?window.__badocGetOnholdRows(sourceRows,false):[];
  const onholdRowsByTn=new Map();
  (Array.isArray(sharedOnholdRows)?sharedOnholdRows:[]).forEach(row=>{
    const tn=trackingNumber(row);
    const tnKey=key(tn);
    if(tnKey&&!onholdRowsByTn.has(tnKey))onholdRowsByTn.set(tnKey,row);
  });
  const seen=new Set(),records=[];
  sourceRows.forEach(row=>{
    const tn=trackingNumber(row);
    const tnKey=key(tn);if(!tnKey||seen.has(tnKey))return;seen.add(tnKey);
    // Deliberately exclude "Assigned Rider" fields: they describe the plan, not who scanned the parcel.
    const rawDriverId=value(row,["Driver ID","Rider ID","Delivery Driver ID","Delivery Rider ID","Last Mile Driver ID","LM Driver ID","Scan Driver ID","Actual Driver ID","Courier ID"]);
    // SPX uses 0 / blank-like values as an unassigned driver placeholder.
    // Never turn that placeholder into a real "Driver 0" rider.
    const invalidDriverValue=v=>/^(?:0+|N\/?A|NONE|NULL|UNKNOWN|UNASSIGNED|-)$/i.test(String(v||"").trim());
    const driverId=invalidDriverValue(rawDriverId)?"":rawDriverId;
    const rawSourceName=value(row,["Driver Name","Rider Name","Delivery Driver Name","Delivery Rider Name","Last Mile Driver Name","LM Driver Name","Scan Driver Name","Actual Driver Name","Courier Name","Driver","Rider"]);
    const sourceName=invalidDriverValue(rawSourceName)?"":rawSourceName;
    const rider=(driverId&&roster.byId.get(key(driverId)))||(sourceName&&roster.byName.get(key(sourceName)))||null;
    const actualId=driverId||String(rider?.["Driver ID"]||"").trim();
    const actualName=(driverId&&rider?String(rider["Driver Name"]||"").trim():"")||sourceName||String(rider?.["Driver Name"]||"").trim();
    const hasScanner=!!(actualId||actualName);
    const riderKey=hasScanner?(actualId?"ID:"+key(actualId):"NAME:"+key(actualName)):"";
    const vehicleType=vehicle(rider?.["Vehicle Type"]||value(row,["Vehicle Type","Rider Vehicle Type","Driver Vehicle Type"]));
    const town=value(row,["Town Name","Town","Delivery Town","Municipality"]);
    const assigned=assignments.get(norm(town))||"";
    const assignedRider=assigned?roster.byName.get(key(assigned)):null;
    let comparison="No planned rider";
    if(!hasScanner)comparison="No scanner";
    else if(assigned){
      const assignedId=String(assignedRider?.["Driver ID"]||"").trim();
      comparison=actualId&&assignedId?(key(actualId)===key(assignedId)?"Match":"Mismatch"):(key(actualName)===key(assigned)?"Match":"Mismatch");
    }
    const status=value(row,["Parcel Status To","Status To","TO Status","To Status","Status To (Current)","Status","Parcel Status","Delivery Status","Current Status"])||"Unknown";
    const statusNorm=norm(status).replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
    // OnHold alone comes from the canonical Dashboard / Planning Board classifier.
    const onhold=onholdRowsByTn.has(tnKey);
    const displayStatus=onhold?"OnHold":status;
    const activityStatusKey=onhold?"ONHOLD":key(status);
    const delivered=!onhold&&statusNorm==="DELIVERED";
    const delivering=!onhold&&statusNorm==="DELIVERING";
    records.push({
      row:row,tn:tn,orderId:value(row,["Order ID","Shopee Order SN","Order SN","Order Number"]),
      town:town,townKey:norm(town),actualId:actualId,actualName:actualName||(actualId?"Driver "+actualId:"Unidentified"),
      riderKey:riderKey,hasScanner:hasScanner,vehicle:vehicleType,assigned:assigned,
      comparison:comparison,status:displayStatus,onhold:onhold,delivered:delivered,
      delivering:delivering,area:String(row?._area||"").trim().toUpperCase(),
      date:activityDate(onhold?(onholdRowsByTn.get(tnKey)||row):row,activityStatusKey)
    });
  });
  return {records:records,sourceCount:Array.isArray(source)?source.length:0};
}
function setNumber(id,n){const el=byId(id);if(el)el.textContent=Number(n||0).toLocaleString()}
function optionList(values,selected,label){
  return '<option value="">'+esc(label)+'</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?" selected":"")+'>'+esc(v)+'</option>').join("");
}
function render(){
  const root=byId("actualScannedByRiders");if(!root)return;
  const data=build(),all=data.records;
  const today=manilaTodayKey(),dateSelect=byId("actualScanDate");
  let requestedDate=dateSelect?.value||"";
  if(lastRenderManilaDayKey&&lastRenderManilaDayKey!==today)requestedDate=today;
  if(!requestedDate)requestedDate=today;
  lastRenderManilaDayKey=today;
  const dates=[...new Set([today,...all.map(r=>r.date).filter(Boolean)])].sort().reverse();
  if(dateSelect){
    const chosen=requestedDate===ALL_DATES_VALUE?ALL_DATES_VALUE:(dates.includes(requestedDate)?requestedDate:today);
    dateSelect.innerHTML='<option value="'+ALL_DATES_VALUE+'">All dates</option>'+dates.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join("");
    dateSelect.value=chosen;
  }
  const selected={
    date:dateSelect?.value||today,vehicle:byId("actualScanVehicle")?.value||"",
    rider:byId("actualScanRider")?.value||"",town:byId("actualScanTown")?.value||"",compare:byId("actualScanCompare")?.value||"",
    status:byId("actualScanStatus")?.value||"",search:byId("actualScanSearch")?.value||""
  };
  const riderOptions=[...new Map(all.filter(r=>r.hasScanner).map(r=>[r.riderKey,r.actualName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const towns=[...new Set(all.map(r=>r.town).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const statuses=[...new Set(all.map(r=>r.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const riderSelect=byId("actualScanRider");
  if(riderSelect){riderSelect.innerHTML='<option value="">All riders</option>'+riderOptions.map(x=>'<option value="'+esc(x[0])+'"'+(x[0]===selected.rider?' selected':'')+'>'+esc(x[1])+'</option>').join("");if(riderOptions.some(x=>x[0]===selected.rider))riderSelect.value=selected.rider;}
  [["actualScanTown",towns,selected.town,"All towns"],["actualScanStatus",statuses,selected.status,"All statuses"]].forEach(x=>{
    const el=byId(x[0]);if(!el)return;el.innerHTML=optionList(x[1],x[2],x[3]);if(x[1].includes(x[2]))el.value=x[2];
  });
  const q=norm(selected.search);
  const rows=all.filter(r=>{
    if(selected.date&&selected.date!==ALL_DATES_VALUE&&r.date!==selected.date)return false;
    if(selected.vehicle&&r.vehicle!==selected.vehicle)return false;
    if(selected.rider&&r.riderKey!==selected.rider)return false;
    if(selected.town&&r.town!==selected.town)return false;
    if(selected.compare&&r.comparison!==selected.compare)return false;
    if(selected.status&&r.status!==selected.status)return false;
    if(q&&!([r.actualName,r.actualId,r.tn,r.orderId,r.town,r.assigned,r.status].some(v=>norm(v).includes(q))))return false;
    return true;
  });
  const scanned=rows.filter(r=>r.hasScanner),groups=new Map();
  scanned.forEach(r=>{
    if(!groups.has(r.riderKey))groups.set(r.riderKey,{key:r.riderKey,id:r.actualId,name:r.actualName,vehicle:r.vehicle,count:0,delivered:0,onhold:0,mismatch:0,towns:new Set(),townBreakdown:new Map()});
    const g=groups.get(r.riderKey);g.count++;if(r.delivered)g.delivered++;if(r.onhold)g.onhold++;if(r.comparison==="Mismatch")g.mismatch++;
    if(r.town){
      g.towns.add(r.town);
      const townKey=r.townKey||norm(r.town);
      if(!g.townBreakdown.has(townKey))g.townBreakdown.set(townKey,{town:r.town,count:0,delivered:0,onhold:0,mismatch:0});
      const town=g.townBreakdown.get(townKey);
      town.count++;if(r.delivered)town.delivered++;if(r.onhold)town.onhold++;if(r.comparison==="Mismatch")town.mismatch++;
    }
    if(g.vehicle==="UNKNOWN"&&r.vehicle!=="UNKNOWN")g.vehicle=r.vehicle;
  });
  const riders=[...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  setNumber("actualScannedParcels",scanned.length);setNumber("actualScannedRiders",riders.length);
  setNumber("actualScanned2WH",riders.filter(r=>r.vehicle==="2WH").length);
  setNumber("actualScanned3WH",riders.filter(r=>r.vehicle==="3WH").length);
  setNumber("actualScannedFlexi",riders.filter(r=>r.vehicle==="FLEXI").length);
  setNumber("actualScannedMismatches",scanned.filter(r=>r.comparison==="Mismatch").length);
  const src=byId("actualScannedSourceStatus");
  if(src)src.textContent=data.sourceCount?data.sourceCount.toLocaleString()+" eligible Parcel Count records":"No eligible Parcel Count records";
  const unidentified=rows.filter(r=>!r.hasScanner).length;
  const note=byId("actualScannedNote");
  if(note){
    let t=scanned.length.toLocaleString()+" unique parcels have a recognized actual driver/rider ID or name.";
    if(unidentified)t+=" "+unidentified.toLocaleString()+" eligible parcel(s) have no recognized scanner field and are excluded from rider totals.";
    t+=" Planned assignments are used only for mismatch comparison; assigned-rider fields are not counted as actual scans.";
    note.textContent=t;
  }
  const riderBody=byId("actualScannedRiderBody");
  if(riderBody)riderBody.innerHTML=riders.length?riders.map(r=>{
    const townRows=[...r.townBreakdown.values()].sort((a,b)=>b.count-a.count||a.town.localeCompare(b.town));
    const townList=townRows.length
      ?'<div class="actual-scan-town-dropdown-list">'+townRows.map(t=>
        '<div class="actual-scan-town-dropdown-item"><div class="actual-scan-town-dropdown-name">'+esc(t.town)+'</div>'+
        '<strong>'+t.count.toLocaleString()+' parcels</strong>'+
        '<small>Delivered '+t.delivered.toLocaleString()+' · Onhold '+t.onhold.toLocaleString()+' · Mismatch '+t.mismatch.toLocaleString()+'</small></div>'
      ).join("")+'</div>'
      :'<div class="actual-scan-town-dropdown-empty">No town data for this rider.</div>';
    return '<tr class="actual-scan-rider-row'+(window.__actualScannedSelectedRider===r.key?" is-selected":"")+'" data-rider-key="'+esc(r.key)+'">'+
      '<td><strong>'+esc(r.name)+'</strong><small style="display:block;color:var(--muted);font-size:9px">'+esc(r.id||"")+'</small></td>'+
      '<td>'+esc(r.vehicle==="UNKNOWN"?"Unknown":r.vehicle)+'</td><td class="num">'+r.count.toLocaleString()+'</td>'+
      '<td class="num">'+r.delivered.toLocaleString()+'</td><td class="num">'+r.onhold.toLocaleString()+'</td>'+
      '<td class="num">'+r.mismatch.toLocaleString()+'</td>'+
      '<td><details class="actual-scan-town-dropdown"><summary>'+r.towns.size.toLocaleString()+' towns <span aria-hidden="true">▾</span></summary>'+townList+'</details></td></tr>';
  }).join(""):'<tr><td colspan="7" class="actual-scan-empty">'+(all.length?"No recognized actual rider matches these filters.":"No eligible Parcel Count rows yet. Upload or sync parcel exports first.")+'</td></tr>';
  const townMap=new Map();
  rows.forEach(r=>{
    if(!r.townKey)return;
    if(!townMap.has(r.townKey))townMap.set(r.townKey,{town:r.town,assigned:r.assigned,scanners:new Set(),count:0,mismatch:0});
    const g=townMap.get(r.townKey);if(r.hasScanner){g.scanners.add(r.actualName);g.count++}if(r.comparison==="Mismatch")g.mismatch++;
  });
  const townBody=byId("actualScannedTownBody");
  const townRows=[...townMap.values()].sort((a,b)=>a.town.localeCompare(b.town));
  if(townBody)townBody.innerHTML=townRows.length?townRows.map(t=>
    '<tr><td><strong>'+esc(t.town)+'</strong></td><td>'+esc(t.assigned||"Not assigned")+'</td>'+
    '<td>'+esc([...t.scanners].sort((a,b)=>a.localeCompare(b)).join(", ")||"No scanner identified")+'</td>'+
    '<td class="num">'+t.count.toLocaleString()+'</td><td class="num">'+t.mismatch.toLocaleString()+'</td></tr>'
  ).join(""):'<tr><td colspan="5" class="actual-scan-empty">No town scan data for the current filters.</td></tr>';
  const selectedKey=window.__actualScannedSelectedRider||"";
  const chosen=riders.find(r=>r.key===selectedKey);
  const detail=byId("actualScannedDetail");
  if(detail){
    detail.hidden=!chosen;
    if(chosen){
      byId("actualScannedDetailTitle").textContent=chosen.name+" · "+chosen.count.toLocaleString()+" parcels";
      const detailRows=rows.filter(r=>r.riderKey===selectedKey);
      byId("actualScannedDetailBody").innerHTML=detailRows.slice(0,500).map(r=>{
        const cl=r.comparison==="Mismatch"?"mismatch":(r.comparison==="Match"?"match":"unplanned");
        return '<tr><td>'+esc(r.orderId||"—")+'</td><td>'+esc(r.tn)+'</td><td>'+esc(r.town||"—")+'</td>'+
          '<td>'+esc(r.status)+'</td><td>'+esc(r.actualName)+'</td><td>'+esc(r.assigned||"Not assigned")+'</td>'+
          '<td><span class="actual-scan-pill '+cl+'">'+esc(r.comparison)+'</span></td></tr>';
      }).join("")||'<tr><td colspan="7" class="actual-scan-empty">No parcel details.</td></tr>';
      byId("actualScannedDetailNote").textContent=detailRows.length>500?"Showing first 500 of "+detailRows.length.toLocaleString()+" matching parcels.":"Parcel details for the selected rider.";
    }
  }
  root.__actualCsv=rows.map(r=>({
    "Order ID":r.orderId,"SPX Tracking Number":r.tn,"Town":r.town,"Activity Date":r.date,
    "Status":r.status,"Actual Rider":r.actualName,"Actual Rider ID":r.actualId,
    "Vehicle":r.vehicle,"Assigned Rider":r.assigned,"Assignment Result":r.comparison
  }));
}
window.__badocRenderActualScannedByRiders=render;
// Shared read-only data contract for EOD Data: use the exact same deduplicated
// Parcel Count rows and actual scanner attribution as the Actual Scanned page.
window.__badocGetActualScannedByRidersData=function(){return build()};
window.addEventListener("badoc:parcel-data-updated",function(){if(byId("actualScannedByRiders")?.classList.contains("active"))render()});
document.addEventListener("input",function(e){if(e.target?.closest?.("#actualScannedByRiders .actual-scan-filters"))render()});
document.addEventListener("change",function(e){if(e.target?.closest?.("#actualScannedByRiders .actual-scan-filters"))render()});
document.addEventListener("click",function(e){
  if(e.target?.closest?.("#actualScannedRiderBody .actual-scan-town-dropdown"))return;
  const row=e.target?.closest?.("#actualScannedRiderBody tr[data-rider-key]");
  if(row){window.__actualScannedSelectedRider=row.dataset.riderKey||"";render();return}
  if(e.target?.closest?.("#actualScannedDetailClose")){window.__actualScannedSelectedRider="";render();return}
  if(e.target?.closest?.("#actualScanReset")){
    ["actualScanSearch","actualScanDate","actualScanRider","actualScanVehicle","actualScanTown","actualScanCompare","actualScanStatus"].forEach(id=>{const el=byId(id);if(el)el.value="";});
    window.__actualScannedSelectedRider="";render();return;
  }
  if(e.target?.closest?.("#actualScannedExport")){
    const data=byId("actualScannedByRiders")?.__actualCsv||[];
    if(!data.length){alert("No filtered parcel records to export.");return}
    if(typeof window.download==="function"&&typeof window.csv==="function")window.download("actual-scanned-by-riders.csv",window.csv(data));
    else alert("CSV export is not available in this page.");
  }
});
})();