// Local downloaded HTML files (content:// / file://) may block IndexedDB in mobile browsers.
// This build automatically falls back to session-memory storage so CSV upload and multi-upload still work.
const DEFAULTS={
badoc:[
["TUROD"],["LABUT"],["CARAITAN"],[""],["PALTIT"],["LUBIGAN"],["BATO"],[""],
["AR-ARUSIP"],["ALAY-NANGBABAAN (ALAY 15-B)"],["NAGREBCAN"],["BALBALDEZ"],[""],
["SAUD"],["PAGSANAHAN NORTE"],["PAGSANAHAN SUR"],[""],["LA VIRGEN MILAGROSA (PAGUETPET)"],["MORONG"],["SANTA CRUZ NORTE"],["SANTA CRUZ SUR"],[""],
["ALOGOOG"],["LACUBEN"],["ARING"],[""],["CANAAN (POB.)"],["GARRETA (POB.)"],[""],
["GABUT NORTE"],["GABUT SUR"],["NAPU"],["MABUSAG NORTE"],["MABUSAG SUR"],["PARANG"],["PASUC"],[""],["MAGLAOI SUR"]
],
pinili:[
["UGUIS"],["CAMANGA"],["MADUPAYAS"],["LILIPUTEN"],["LUMBAAN-BICBICA"],["SACRITAN"],[""],["AGLIPAY"],["SANTO TOMAS"],["CABAROAN"],["BUANGA"],[""],
["PURITAC"],["DALAYAP"],["NAGTRIGOAN"],["UPON"],[""],["VALBUENA (POB.)"],["PAGDILAO (POB.)"],[""],["SALANAP"],["BARBAR"],["BUNGRO"],["PUGAOAN"],[""],
["APATUT-LUBONG"],["DARAT"],["CAPANGDANAN"],["GULPENG"],[""],["BADIO"],["BULBULALA"],["PUZOL"],["TARTARABANG"]
]};
let towns=DEFAULTS;
const REQUIRED_BADOC_TOWNS=["MAGLAOI SUR"];
function ensureRequiredBadocTowns(){
  if(!towns||typeof towns!=="object"||Array.isArray(towns))towns={badoc:[],pinili:[]};
  if(!Array.isArray(towns.badoc))towns.badoc=[];
  const existing=new Set(towns.badoc.map(value=>Array.isArray(value)?value[0]:value).map(value=>String(value??"").trim().replace(/\s+/g," ").toUpperCase()).filter(Boolean));
  let changed=false;
  REQUIRED_BADOC_TOWNS.forEach(name=>{
    const key=String(name).trim().replace(/\s+/g," ").toUpperCase();
    if(key&&!existing.has(key)){towns.badoc.push([name]);existing.add(key);changed=true;}
  });
  return changed;
}
ensureRequiredBadocTowns();
let batches=[];
let current=null, role="Admin";
const $=id=>document.getElementById(id);

// Large parcel uploads are stored in IndexedDB instead of localStorage.
const DB_NAME="ParcelRoutingDashboardCleanStartV2", DB_VERSION=1, STORE="batches";
let dbReady=null;
let memoryOnlyStorage=false;
window.__badocStorageHealth={state:"checking",message:"Checking local parcel storage",updatedAt:Date.now()};
function setBadocStorageHealth(state,message){
  memoryOnlyStorage=state!=="persistent";
  window.__badocStorageHealth={state,message:String(message||""),updatedAt:Date.now()};
  try{window.dispatchEvent(new CustomEvent("badoc-storage-health",{detail:window.__badocStorageHealth}))}catch(e){}
}
window.__badocGetStorageHealth=()=>({...window.__badocStorageHealth});
function openDB(){
  if(dbReady) return dbReady;
  dbReady=new Promise((resolve)=>{
    try{
      if(!window.indexedDB){ setBadocStorageHealth("memory-only","IndexedDB is unavailable; parcel data cannot survive a reload."); resolve(null); return; }
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE,{keyPath:"id",autoIncrement:true}); };
      req.onsuccess=()=>{setBadocStorageHealth("persistent","IndexedDB parcel storage is available.");resolve(req.result)};
      req.onerror=()=>{ console.warn("IndexedDB unavailable; using session memory storage.",req.error); setBadocStorageHealth("memory-only","IndexedDB could not be opened; parcel data is session-only."); resolve(null); };
      req.onblocked=()=>{ console.warn("IndexedDB blocked; using session memory storage."); setBadocStorageHealth("memory-only","IndexedDB is blocked by another connection; parcel data is session-only."); resolve(null); };
    }catch(e){ console.warn("IndexedDB unavailable; using session memory storage.",e); setBadocStorageHealth("memory-only","IndexedDB could not be initialized; parcel data is session-only."); resolve(null); }
  });
  return dbReady;
}
async function loadBatches(){
  try{
    const db=await openDB();
    if(!db){ batches=[]; current=null; return; }
    batches=await new Promise((resolve,reject)=>{
      const r=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
      r.onsuccess=()=>resolve((r.result||[]).filter(b=>b && b.name && Array.isArray(b.rows)).sort((a,b)=>b.time-a.time));
      r.onerror=()=>reject(r.error);
    });
    current=mergeAllBatches();
  }catch(e){console.error(e); batches=[]; current=null; setBadocStorageHealth("memory-only","Parcel data could not be loaded from IndexedDB: "+String(e?.message||e));}
}
async function saveBatches(){
  try{
    const db=await openDB();
    if(!db){ setBadocStorageHealth("memory-only","Parcel data is currently stored only in this tab."); return false; }
    const tx=db.transaction(STORE,"readwrite"), st=tx.objectStore(STORE);
    await new Promise((resolve,reject)=>{
      st.clear();
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error("Parcel Count storage transaction was aborted."));
      // The store uses an auto-increment key. Do not supply an undefined key.
      batches.forEach(b=>{
        const copy={name:b.name,time:b.time,rows:b.rows,valid:b.valid,mis:b.mis};
        st.add(copy);
      });
    });
    setBadocStorageHealth("persistent","Parcel data saved to IndexedDB.");
    return true;
  }catch(e){ console.warn("IndexedDB save failed; continuing in session memory.",e); setBadocStorageHealth("memory-only","IndexedDB save failed; parcel data is only in this tab: "+String(e?.message||e)); return false; }
}
window.__badocExportLocalParcelBackup=function(){
  const payload={schemaVersion:1,recordType:"badoc-local-parcel-backup",exportedAt:new Date().toISOString(),batches:Array.isArray(batches)?batches:[]};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`badoc-parcel-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  return {batches:payload.batches.length,rows:payload.batches.reduce((sum,b)=>sum+(Array.isArray(b?.rows)?b.rows.length:0),0)};
};
function saveTownSettings(){ensureRequiredBadocTowns();localStorage.setItem("pr_towns",JSON.stringify(towns))}
function norm(s){return String(s??"").trim().replace(/\s+/g," ").toUpperCase()}

/* v274 Phase 1 performance cache: normalize frequently-used parcel fields once per row.
   The cache is WeakMap-backed, so it does not prevent old upload rows from being
   garbage-collected. No business rules are changed here; this only avoids repeating
   the same Object.keys/normalization/SPX-TN scans across dashboard modules. */
const BADOC_ROW_META=new WeakMap();
const BADOC_INDEX_CACHE=new WeakMap();
const BADOC_STATUS_KEYS=["Parcel Status To","Status To","TO Status","To Status","Status To (Current)","Status","Parcel Status","Delivery Status","Current Status"];
const BADOC_SPX_KEYS=["SPX TN","SLS Tracking Number","SPX TN/Tracking Number","Tracking Number","SPX Tracking Number","SPX Tracking No","SPX Tracking No.","SPX TN No","SPX TN Number"];
function badocRowMeta(r){
  if(!r||typeof r!=="object")return {town:"",station:"",destination:"",status:"",tn:""};
  const hit=BADOC_ROW_META.get(r);
  if(hit)return hit;
  let tn="";
  for(const v of Object.values(r)){
    const x=String(v??"").trim().replace(/^['\"]+|['\"]+$/g,"");
    if(/^SPEPH[A-Z0-9]+$/i.test(x)){tn=norm(x);break;}
  }
  if(!tn){for(const k of BADOC_SPX_KEYS){const v=String(r?.[k]??"").trim();if(v){tn=norm(v);break;}}}
  let status="";
  for(const k of BADOC_STATUS_KEYS){if(Object.prototype.hasOwnProperty.call(r,k)&&String(r[k]??"").trim()){status=norm(r[k]);break;}}
  if(!status){const k=Object.keys(r).find(x=>/status/i.test(x));if(k)status=norm(r[k]);}
  const meta={
    town:norm(r?.["Town Name"]??r?.["Town"]??r?.["town"]??""),
    station:norm(r?.["Current Station"]??""),
    destination:norm(r?.["Destination Station"]??""),
    status,
    tn
  };
  BADOC_ROW_META.set(r,meta);
  return meta;
}
window.__badocRowMeta=badocRowMeta;
function badocRowIndex(rows){
  const list=Array.isArray(rows)?rows:[];
  const cached=BADOC_INDEX_CACHE.get(list);
  if(cached)return cached;
  const index={all:new Set(list),town:new Map(),station:new Map(),status:new Map(),destination:new Map(),tn:new Map()};
  const add=(map,key,r)=>{if(!key)return;let set=map.get(key);if(!set){set=new Set();map.set(key,set);}set.add(r);};
  for(const r of list){const m=badocRowMeta(r);add(index.town,m.town,r);add(index.station,m.station,r);add(index.status,m.status,r);add(index.destination,m.destination,r);if(m.tn)index.tn.set(m.tn,r);}
  BADOC_INDEX_CACHE.set(list,index);
  return index;
}
window.__badocRowIndex=badocRowIndex;
function flat(list){return list.filter(x=>x[0]).map(x=>x[0])}
function allowedMap(){let m={};flat(towns.badoc).forEach(x=>m[norm(x)]="Badoc");flat(towns.pinili).forEach(x=>m[norm(x)]="Pinili");return m}
function parseCSV(text){
 const source=String(text??"").replace(/^\uFEFF/,"");
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(quoted){
   if(c==='"'&&next==='"'){cell+='"';i++;}
   else if(c==='"')quoted=false;
   else cell+=c;
  }else if(c==='"'){
   if(cell.length)throw new Error("Malformed CSV: quote found inside an unquoted field.");
   quoted=true;
  }else if(c===","){row.push(cell);cell="";}
  else if(c==="\n"){row.push(cell);rows.push(row);row=[];cell="";}
  else if(c!=="\r")cell+=c;
 }
 if(quoted)throw new Error("Malformed CSV: an opening quote was never closed.");
 if(cell.length||row.length){row.push(cell);rows.push(row);}
 const rawHeaders=rows.shift()||[];
 const headers=rawHeaders.map((value,index)=>{
  const name=String(value??"").trim();
  if(!name)return `__EMPTY_HEADER_${index+1}`;
  return name;
 });
 const seen=new Set();
 headers.forEach(name=>{const key=name.toLowerCase();if(seen.has(key))throw new Error(`Malformed CSV: duplicate column header "${name}".`);seen.add(key);});
 return rows.filter(r=>r.some(value=>String(value??"").trim()!=="")).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));
}
window.__badocParseCSV=parseCSV;

function spxTN(r){return badocRowMeta(r).tn}

async function importParcelCsvText(text,fileName="export_forward_order.csv",source="file") {
  const csvText=String(text||"").replace(/^\uFEFF/,"").trim();
  if(!csvText)throw Error("The SPX export file was empty.");
  if(/^([\\{\\[]|<!doctype|<html)/i.test(csvText))throw Error("SPX returned a JSON or HTML response instead of a CSV export.");
  const rows=parseCSV(csvText);
  if(!rows.length){
    const header=csvText.split(/\\r?\\n/,1)[0]||"";
    if(!/SPX|Tracking|Order|Status/i.test(header))throw Error("The SPX export contains no parcel rows and its CSV header could not be recognized.");
    // A header-only CSV is a valid zero-result export (common for OnHold).
    // Keep the existing parcel batches unchanged and report a successful no-op.
    return {total:0,added:0,updated:0,duplicates:0,name:fileName,persisted:true,warnings:["SPX returned no matching parcel rows; existing Parcel Count data was left unchanged."]};
  }

  const aliasesFor=r=>{
    const out=[],tn=spxTN(r),oid=norm(r?.["Order ID"]??r?.["Order Id"]??"");
    if(tn)out.push("TN:"+tn);if(oid)out.push("OID:"+oid);return out;
  };
  const existingByAlias=new Map();
  (Array.isArray(batches)?batches:[]).forEach(b=>(Array.isArray(b?.rows)?b.rows:[]).forEach(r=>aliasesFor(r).forEach(alias=>existingByAlias.set(alias,r))));
  const seen=new Map(),uniqueRows=[];let added=0,updated=0,dupes=0;
  const importTime=Date.now(),batchId=`${importTime.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  rows.forEach(raw=>{
    const aliases=aliasesFor(raw);if(!aliases.length)return;
    const matchedIndex=aliases.map(alias=>seen.get(alias)).find(index=>index!==undefined);
    const existing=aliases.map(alias=>existingByAlias.get(alias)).find(Boolean);
    const row={...raw};
    if(!Number(row._badoc_sourceUploadedAt))row._badoc_sourceUploadedAt=importTime;
    if(!row._badoc_sourceBatchId)row._badoc_sourceBatchId=batchId;
    if(matchedIndex!==undefined){uniqueRows[matchedIndex]=mergeParcelRowsPreservingPickup(uniqueRows[matchedIndex],row);updated++;dupes++;}
    else{if(existing){const merged=mergeParcelRowsPreservingPickup(existing,row);uniqueRows.push(merged);updated++;dupes++;}else{uniqueRows.push(row);added++;}}
    const index=matchedIndex!==undefined?matchedIndex:uniqueRows.length-1;
    aliases.forEach(alias=>seen.set(alias,index));
  });

  if(!uniqueRows.length)throw Error("The SPX export contained no rows with a usable parcel identifier (SPX TN or Order ID).");
  const normalizedImportRows=mergeRowsUnique(uniqueRows);
  // Validate the local settings write before mutating the parcel batches. Once the
  // batch is committed below, later UI refresh errors must never be reported as
  // an import failure: the parcel data has already changed.
  saveTownSettings();
  const newBatch={name:fileName,time:Date.now(),rows:normalizedImportRows,duplicates:dupes,updated,uploadedBy:role,source};
  batches.unshift(newBatch);
  
  current=mergeAllBatches();
  const persisted=await saveBatches();

  const warnings=[];
  try{render();}catch(error){warnings.push("Parcel data was imported, but the dashboard view could not refresh: "+String(error?.message||error));console.error("Parcel import committed; dashboard render failed:",error);}
  try{window.__badocRenderForecastBoard?.();}catch(error){warnings.push("Forecast board refresh failed: "+String(error?.message||error));console.error("Parcel import committed; forecast render failed:",error);}
  // Keep the user's current section selected after automatic SPX imports.
  // Manual/file imports retain the original behavior of returning to Planning Board.
  if(!/^spx-(?:inbound|delivery)$/i.test(String(source||""))){
    try{showPage("dashboard");}catch(error){warnings.push("Navigation refresh failed: "+String(error?.message||error));console.error("Parcel import committed; navigation refresh failed:",error);}
  }
  if(!persisted)warnings.push("The import is available in this session, but IndexedDB could not confirm a local save. Keep this tab open and retry storage before closing it.");
  return {total:normalizedImportRows.length,added,updated,duplicates:dupes,name:fileName,persisted,warnings};
}

const EXCEPTION_TN_KEY="badoc_exception_tracking_numbers_v1";

/* Shared exemption sync — Firebase-backed, cross-device realtime + polling fallback.
   Local storage remains the immediate working copy; Firebase is the shared source
   after initialization. Writes are serialized and release their short lease. */
const EXEMPTION_CLOUD_TABLE="badoc_exemption_state";
const EXEMPTION_CLOUD_ID="current";
const EXEMPTION_CLOUD_LOCK="badoc-exemption-state-v1";
let exemptionCloudClient=null;
let exemptionCloudQueue=Promise.resolve();
let exemptionRealtimeChannel=null;
let exemptionRealtimeStarted=false;
let exemptionCloudLastUpdate=0;
let exemptionCloudPollStarted=false;
window.__badocExemptionSyncState={state:"idle",message:"Waiting for shared cloud sync",lastOkAt:0,lastError:"",source:""};
function setExemptionCloudState(state,message,extra={}){
  const previous=window.__badocExemptionSyncState||{};
  const next=Object.assign({},previous,extra,{state,message:String(message||""),updatedAt:Date.now()});
  if(state==="ok"){next.lastOkAt=Date.now();next.lastError="";}
  if(state==="fail")next.lastError=String(message||"Cloud sync failed");
  window.__badocExemptionSyncState=next;
  const note=document.querySelector("#exceptionArea .exception-note");
  if(note){
    note.textContent=next.message;
    note.style.minHeight="16px";
    note.style.fontSize="11px";
    note.style.lineHeight="1.35";
    note.style.color=state==="ok"?"#067647":state==="fail"?"#b42318":state==="pending"?"#667085":"";
    note.title=next.message;
  }
}
function getExemptionCloudClient(){
  if(exemptionCloudClient)return exemptionCloudClient;
  const cfg=window.BADOC_SHARED_CONFIG||{};
  if(!window.BadocCloud||!cfg.url||!cfg.key)throw new Error("Badoc shared cloud is not ready");
  exemptionCloudClient=window.BadocCloud.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return exemptionCloudClient;
}
function uniqueExceptionItems(items){
  const out=[],seen=new Set();
  (Array.isArray(items)?items:[]).forEach(value=>{
    const text=String(value??"").trim(),key=exceptionKey(text);
    if(text&&key&&!seen.has(key)){seen.add(key);out.push(text)}
  });
  return out;
}
function exceptionListsEqual(a,b){
  const aa=uniqueExceptionItems(a),bb=uniqueExceptionItems(b);
  if(aa.length!==bb.length)return false;
  const keys=new Set(aa.map(exceptionKey));
  return bb.every(x=>keys.has(exceptionKey(x)));
}
function exemptionCloudOwner(){
  try{
    let id=sessionStorage.getItem("badoc_exemption_cloud_owner_v1");
    if(!id){id="ex-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);sessionStorage.setItem("badoc_exemption_cloud_owner_v1",id)}
    return id;
  }catch(e){return "ex-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10)}
}
async function withExemptionCloudLock(task){
  const cloud=window.BadocCloud,owner=exemptionCloudOwner();
  let acquired=false;
  if(cloud&&typeof cloud.claim==="function"){
    for(let i=0;i<60;i++){
      try{acquired=await cloud.claim(EXEMPTION_CLOUD_LOCK,owner,30000)}
      catch(e){throw new Error("Could not acquire cloud exemption lock: "+String(e?.message||e))}
      if(acquired)break;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(!acquired)throw new Error("Cloud exemption sync is busy on another device. Please retry in a few seconds.");
  }
  try{return await task()}
  finally{
    if(acquired&&cloud&&typeof cloud.release==="function"){
      try{await cloud.release(EXEMPTION_CLOUD_LOCK,owner)}catch(e){console.warn("Could not release exemption cloud lock",e)}
    }
  }
}
function queueExemptionCloud(task,options={}){
  const run=exemptionCloudQueue.then(task,task);
  exemptionCloudQueue=run.catch(error=>{
    const message=String(error?.message||error||"Unknown cloud error");
    console.warn("Cloud exemption sync failed",message);
    if(!options.silent)setExemptionCloudState("fail","Exemption sync failed: "+message);
    return false;
  });
  return exemptionCloudQueue;
}
async function readCloudExemptionRecord(client){
  const result=await client.from(EXEMPTION_CLOUD_TABLE).select("*").eq("id",EXEMPTION_CLOUD_ID).maybeSingle();
  if(result.error)throw new Error(result.error.message||"Cloud exemption read failed");
  return result.data||null;
}
async function writeCloudExemptionItems(client,items,operation="sync"){
  const payload={id:EXEMPTION_CLOUD_ID,items:uniqueExceptionItems(items),updatedAt:new Date().toISOString(),updatedBy:exemptionCloudOwner(),schemaVersion:2,lastOperation:String(operation||"sync")};
  const result=await client.from(EXEMPTION_CLOUD_TABLE).upsert(payload,{onConflict:"id"});
  if(result.error)throw new Error(result.error.message||"Cloud exemption save failed");
  return payload;
}
function refreshExemptionConsumers(){
  saveExceptionTrackingNumbers();
  renderExceptionTracking();
  render();
  syncExemptionsToReceivedChecking();
  if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
  if(typeof updateRecordExportButton==="function")updateRecordExportButton();
}
function applyCloudExemptionRecord(record,source="cloud"){
  if(!record||!Array.isArray(record.items))return false;
  const stamp=Date.parse(record.updatedAt||"")||0;
  if(stamp&&exemptionCloudLastUpdate&&stamp<exemptionCloudLastUpdate)return false;
  if(stamp)exemptionCloudLastUpdate=Math.max(exemptionCloudLastUpdate,stamp);
  const incoming=uniqueExceptionItems(record.items);
  const changed=!exceptionListsEqual(exceptionTrackingNumbers,incoming);
  if(changed){exceptionTrackingNumbers=incoming;refreshExemptionConsumers();}
  setExemptionCloudState("ok",changed?"Exemptions updated from shared cloud":"Exemptions synced with shared cloud",{source,cloudUpdatedAt:record.updatedAt||""});
  return changed;
}
async function syncExceptionsFromCloud(options={}){
  return queueExemptionCloud(async()=>{
    const client=getExemptionCloudClient();
    let record=await readCloudExemptionRecord(client);
    if(!record){
      // Double-check under the writer lease before seeding, so two new devices
      // cannot race and overwrite one another's first shared list.
      record=await withExemptionCloudLock(async()=>{
        const latest=await readCloudExemptionRecord(client);
        if(latest)return latest;
        return await writeCloudExemptionItems(client,exceptionTrackingNumbers,"initial-seed");
      });
    }
    applyCloudExemptionRecord(record,"initial/poll");
    startExemptionRealtimeSync();
    startExemptionFallbackPoll();
    return true;
  },options);
}
function cloudExceptionWrite(action,value){
  const op=String(action||"").toLowerCase(),raw=String(value||"").trim();
  setExemptionCloudState("pending","Saving exemptions to shared cloud…");
  return queueExemptionCloud(()=>withExemptionCloudLock(async()=>{
    const client=getExemptionCloudClient();
    const remoteRecord=await readCloudExemptionRecord(client);
    let items=uniqueExceptionItems([...(remoteRecord?.items||[]),...exceptionTrackingNumbers]);
    const key=exceptionKey(raw);
    if(op==="add"&&raw&&key&&!items.some(x=>exceptionKey(x)===key))items.push(norm(raw));
    else if(op==="remove"&&key)items=items.filter(x=>exceptionKey(x)!==key);
    else if(op==="clear")items=[];
    const saved=await writeCloudExemptionItems(client,items,op);
    applyCloudExemptionRecord(saved,"this device");
    setExemptionCloudState("ok","Exemptions synced to shared cloud",{source:"this device",cloudUpdatedAt:saved.updatedAt});
    return true;
  }));
}
function startExemptionRealtimeSync(){
  if(exemptionRealtimeStarted)return;
  const client=getExemptionCloudClient();
  if(!client||typeof client.channel!=="function")return;
  exemptionRealtimeStarted=true;
  try{
    exemptionRealtimeChannel=client.channel("badoc-exemptions-live-v2")
      .on("postgres_changes",{event:"*",schema:"public",table:EXEMPTION_CLOUD_TABLE,filter:"id=eq."+EXEMPTION_CLOUD_ID},event=>{
        const record=event?.new;
        if(!record||!Array.isArray(record.items))return;
        // Serialize remote notifications behind local writes to avoid replacing
        // a change that is currently being committed by this device.
        const apply=()=>applyCloudExemptionRecord(record,"another device");
        const run=exemptionCloudQueue.then(apply,apply);
        exemptionCloudQueue=run.catch(error=>{console.warn("Exemption realtime apply failed",error);return false;});
      })
      .subscribe(status=>{
        if(status==="SUBSCRIBED")setExemptionCloudState("ok","Exemptions connected to shared cloud",{source:"realtime"});
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setExemptionCloudState("warn","Exemption live sync interrupted; checking periodically",{source:"poll-fallback"});
      });
  }catch(error){
    exemptionRealtimeStarted=false;
    console.warn("Exemption realtime setup failed",error);
    setExemptionCloudState("warn","Live exemption sync unavailable; checking periodically",{source:"poll-fallback"});
  }
}
function startExemptionFallbackPoll(){
  if(exemptionCloudPollStarted)return;
  exemptionCloudPollStarted=true;
  if(typeof window.__badocEvery==="function"){
    window.__badocEvery(()=>{
      if(document.hidden)return;
      syncExceptionsFromCloud({silent:true});
    },20000);
  }else{
    __badocEvery(()=>syncExceptionsFromCloud({silent:true}),20000);
  }
}

function syncExemptionsToReceivedChecking(){
  const frame=$("receivedCheckingFrame");
  try{frame?.contentWindow?.postMessage({type:"badoc-exemptions-sync",items:[...exceptionTrackingNumbers]},"*")}catch(e){}
}window.addEventListener("message",event=>{
  const frame=$("receivedCheckingFrame");
  if(!frame||event.source!==frame.contentWindow)return;
  const d=event.data;
  if(!d||d.type!=="badoc-exemptions-updated"||!Array.isArray(d.items))return;
  const incoming=uniqueExceptionItems(d.items);
  const before=exceptionTrackingNumbers.slice();
  const keySet=arr=>new Set(arr.map(exceptionKey).filter(Boolean));
  const beforeKeys=keySet(before),incomingKeys=keySet(incoming);
  exceptionTrackingNumbers=incoming;
  saveExceptionTrackingNumbers();
  const removed=before.filter(x=>!incomingKeys.has(exceptionKey(x)));
  const added=incoming.filter(x=>!beforeKeys.has(exceptionKey(x)));
  if(removed.length||added.length){
    setExemptionCloudState("pending","Saving Received Checking exemption changes to cloud…");
    queueExemptionCloud(()=>withExemptionCloudLock(async()=>{
      const client=getExemptionCloudClient();
      const remote=await readCloudExemptionRecord(client);
      let items=uniqueExceptionItems([...(remote?.items||[]),...exceptionTrackingNumbers]);
      removed.forEach(x=>items=items.filter(y=>exceptionKey(y)!==exceptionKey(x)));
      added.forEach(x=>{if(!items.some(y=>exceptionKey(y)===exceptionKey(x)))items.push(x)});
      const saved=await writeCloudExemptionItems(client,items,"received-checking-update");
      applyCloudExemptionRecord(saved,"Received Checking");
      setExemptionCloudState("ok","Exemptions synced to shared cloud",{source:"Received Checking",cloudUpdatedAt:saved.updatedAt});
      return true;
    }));
  }
  renderExceptionTracking();
  render();
  if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
  if(typeof updateRecordExportButton==="function")updateRecordExportButton();
  syncExemptionsToReceivedChecking();
});
const receivedCheckingFrameForExemptions=$("receivedCheckingFrame");
if(receivedCheckingFrameForExemptions)receivedCheckingFrameForExemptions.addEventListener("load",()=>setTimeout(syncExemptionsToReceivedChecking,0));

let exceptionTrackingNumbers=[];
function exceptionKey(v){return norm(v).replace(/[\s\-_.]/g,"")}
function loadExceptionTrackingNumbers(){
  try{
    const saved=JSON.parse(localStorage.getItem(EXCEPTION_TN_KEY)||"[]");
    exceptionTrackingNumbers=uniqueExceptionItems(saved);
  }catch(e){exceptionTrackingNumbers=[]}
}
function saveExceptionTrackingNumbers(){
  try{localStorage.setItem(EXCEPTION_TN_KEY,JSON.stringify(exceptionTrackingNumbers))}catch(e){console.warn("Could not save exemption tracking numbers",e)}
}
function exceptionTrackingSet(){return new Set(exceptionTrackingNumbers.map(exceptionKey).filter(Boolean))}
function isExceptionRow(r){
  const set=exceptionTrackingSet();
  const keys=["SPX TN","SLS Tracking Number","SPX TN/Tracking Number","Tracking Number","Order ID"];
  return keys.some(k=>{const v=exceptionKey(r?.[k]);return !!v&&set.has(v)});
}
function renderExceptionTracking(){
  const list=$("exceptionTrackingList"),count=$("exceptionCount");
  if(count)count.textContent=exceptionTrackingNumbers.length.toLocaleString();
  if(!list)return;
  if(!exceptionTrackingNumbers.length){list.innerHTML='<div class="exception-empty">No exception tracking numbers added.</div>';return;}
  list.innerHTML=exceptionTrackingNumbers.map((tn,i)=>`<div class="exception-row"><span class="exception-tn" title="${esc(tn)}">${esc(tn)}</span><button type="button" class="exception-remove" data-exception-index="${i}" title="Remove">×</button></div>`).join("");
  list.querySelectorAll(".exception-remove").forEach(btn=>btn.addEventListener("click",()=>{
    const i=Number(btn.dataset.exceptionIndex);
    if(Number.isInteger(i)&&i>=0&&i<exceptionTrackingNumbers.length){
      const removed=exceptionTrackingNumbers[i];
      exceptionTrackingNumbers.splice(i,1);saveExceptionTrackingNumbers();cloudExceptionWrite("remove",removed);renderExceptionTracking();render();syncExemptionsToReceivedChecking();if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();if(typeof updateRecordExportButton==="function")updateRecordExportButton();
    }
  }));
}
function addExceptionTrackingNumber(){
  const input=$("exceptionTrackingInput");
  const raw=String(input?.value||"").trim(),key=exceptionKey(raw);
  if(!key){if(input)input.focus();return;}
  const exists=exceptionTrackingNumbers.some(x=>exceptionKey(x)===key);
  if(!exists){exceptionTrackingNumbers.push(norm(raw));saveExceptionTrackingNumbers();cloudExceptionWrite("add",norm(raw));renderExceptionTracking();render();syncExemptionsToReceivedChecking();if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();if(typeof updateRecordExportButton==="function")updateRecordExportButton();}
  if(input){input.value="";input.focus();}
}
function clearExceptionTrackingNumbers(){
  if(!exceptionTrackingNumbers.length)return;
  if(!confirm("Clear all exception tracking numbers?"))return;
  exceptionTrackingNumbers=[];saveExceptionTrackingNumbers();cloudExceptionWrite("clear","");renderExceptionTracking();render();syncExemptionsToReceivedChecking();if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();if(typeof updateRecordExportButton==="function")updateRecordExportButton();
}
loadExceptionTrackingNumbers();
setExemptionCloudState("pending","Connecting to shared exemption list…");
// Start polling immediately so a temporary startup/network failure is retried.
startExemptionFallbackPoll();
setTimeout(()=>syncExceptionsFromCloud(),500);
function badocPickupTimeValue(row){
  if(!row||typeof row!=="object")return "";
  const keys=Object.keys(row);
  const normalizeHeader=value=>String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const aliases=[
    "Pick Up Time","Pick up time","PICK UP TIME","Pickup Time",
    "First Pick Up Time","First Pickup Time","At Pick Up Time",
    "Pickup Date Time","Pickup Datetime","Pickup Timestamp","Scanned Time","scannedTime"
  ];
  for(const alias of aliases){
    const wanted=normalizeHeader(alias);
    const key=keys.find(candidate=>normalizeHeader(candidate)===wanted&&String(row[candidate]??"").trim()!=="");
    if(key)return String(row[key]).trim();
  }
  const key=keys.find(candidate=>normalizeHeader(candidate).includes("pickuptime")&&String(row[candidate]??"").trim()!=="");
  return key?String(row[key]).trim():"";
}
function mergeParcelRowsPreservingPickup(previous,incoming){
  const before=previous&&typeof previous==="object"?previous:{};
  const after=incoming&&typeof incoming==="object"?incoming:{};
  const merged={...before};
  // A status-only export often omits descriptive columns. Empty incoming cells
  // must not erase town, coordinates, first-seen data, or other known values.
  Object.entries(after).forEach(([key,value])=>{
    const empty=value===null||value===undefined||String(value).trim()==="";
    if(!empty||before[key]===undefined||before[key]===null||String(before[key]).trim()==="")merged[key]=value;
  });
  const pickup=badocPickupTimeValue(after)||badocPickupTimeValue(before);
  if(pickup)merged["Pick Up Time"]=pickup;
  const firstSeen=Number(before._badoc_sourceUploadedAt||after._badoc_sourceUploadedAt||0);
  if(firstSeen)merged._badoc_sourceUploadedAt=firstSeen;
  const batchId=String(before._badoc_sourceBatchId||after._badoc_sourceBatchId||"");
  if(batchId)merged._badoc_sourceBatchId=batchId;
  return merged;
}
window.__badocMergeParcelRows=mergeParcelRowsPreservingPickup;
function mergeRowsUnique(rows){
  const records=[],byAlias=new Map();
  const aliasesFor=r=>{
    const aliases=[];const tn=spxTN(r),oid=norm(r?.["Order ID"]??r?.["Order Id"]??"");
    if(tn)aliases.push("TN:"+tn);if(oid)aliases.push("OID:"+oid);
    return aliases;
  };
  for(const r of rows){
    const aliases=aliasesFor(r);if(!aliases.length)continue;
    const matches=[...new Set(aliases.map(alias=>byAlias.get(alias)).filter(index=>index!==undefined))].sort((a,b)=>a-b);
    let index;
    if(!matches.length){index=records.length;records.push(r);}
    else{
      index=matches[0];
      records[index]=mergeParcelRowsPreservingPickup(records[index],r);
      // A bridge row can connect a previously TN-only record to a previously
      // OID-only record. Collapse both aliases onto one canonical parcel.
      for(const duplicate of matches.slice(1).sort((a,b)=>b-a)){
        records[index]=mergeParcelRowsPreservingPickup(records[index],records[duplicate]);
        records[duplicate]=null;
        byAlias.forEach((value,key)=>{if(value===duplicate)byAlias.set(key,index);else if(value>duplicate)byAlias.set(key,value-1);});
        records.splice(duplicate,1);
      }
    }
    aliases.forEach(alias=>byAlias.set(alias,index));
  }
  return records.filter(Boolean);
}
window.__badocMergeUniqueParcelRows=mergeRowsUnique;
function mergeAllBatches(){
  const ordered=[...(Array.isArray(batches)?batches:[])].sort((a,b)=>(a.time||0)-(b.time||0));
  const rows=mergeRowsUnique(ordered.flatMap(b=>Array.isArray(b.rows)?b.rows:[]));
  const z=classify(rows);
  return {name:"Combined uploads",time:Date.now(),rows,valid:z.valid,mis:z.mis,combined:true};
}

function classify(rows){
 const map=allowedMap(), valid=[],mis=[];
 for(const r of rows){
  const meta=badocRowMeta(r);
  if(meta.destination!=="BADOC HUB") continue;
  const cs=meta.station;
  if(!["BADOC HUB","SOC 6","CAGAYAN DC"].includes(cs)) continue;
  const town=meta.town; if(map[town]) valid.push({...r,_area:map[town]}); else mis.push({...r,_area:"Misrouted"});
 }
 return {valid,mis};
}
function counts(rows){let c={};rows.forEach(r=>{const town=badocRowMeta(r).town;if(town)c[town]=(c[town]||0)+1});return c}
const HOLD_HISTORY_KEY="badoc_hold_history_v2";
function normalizeParcelStatus(v){return norm(v).replace(/[_-]+/g," ").replace(/\s+/g," ")}
function parcelStatus(r){return badocRowMeta(r).status}
function loadHoldHistory(){
  let set=new Set();
  try{const saved=JSON.parse(localStorage.getItem(HOLD_HISTORY_KEY)||"[]");if(Array.isArray(saved))set=new Set(saved.map(x=>norm(x)).filter(Boolean));}catch{}
  return set;
}
function buildHoldHistory(extraRows=[]){
  const set=loadHoldHistory();
  const all=(Array.isArray(batches)?batches:[]).flatMap(b=>Array.isArray(b?.rows)?b.rows:[]).concat(Array.isArray(extraRows)?extraRows:[]);
  all.forEach(r=>{const tn=spxTN(r),st=parcelStatus(r);if(tn&&(st==="ONHOLD"||st==="ON HOLD"||st==="LMHUB ONHOLD"||st==="LMHUB ON HOLD"))set.add(tn);});
  try{localStorage.setItem(HOLD_HISTORY_KEY,JSON.stringify([...set]));}catch{}
  return set;
}
function wasOnHoldBefore(tn,rows=[]){
  const key=norm(tn);
  return !!key && ((window.__badocOnholdTnKeys instanceof Set ? window.__badocOnholdTnKeys.has(badocOnholdKey(tn)) : buildHoldHistory(rows).has(key)));
}
function townStatusCounts(rows){
  const out={};
  const onholdKeys=new Set(badocGetOnholdRows(rows).map(r=>badocOnholdKey(spxTN(r))).filter(Boolean));
  rows.forEach(r=>{
    const meta=badocRowMeta(r),town=meta.town;
    if(!town)return;
    if(!out[town])out[town]={received:0,delivered:0,delivering:0,hold:0,assigned:0,assigning:0};
    const st=meta.status,tn=meta.tn;
    const isOnhold=!!tn&&onholdKeys.has(badocOnholdKey(tn));
    const isReceived=st==="RECEIVED"||st==="LMHUB RECEIVED";
    if(isOnhold)out[town].hold++;
    else if(isReceived)out[town].received++;
    else if(st==="DELIVERED")out[town].delivered++;
    else if(st==="DELIVERING")out[town].delivering++;
    else if(st==="ASSIGNED"||st==="LMHUB ASSIGNED")out[town].assigned++;
    else if(st==="ASSIGNING"||st==="LMHUB ASSIGNING")out[town].assigning++;
  });
  return out;
}
function splitTownGroups(list){
 const groups=[], current=[];
 list.forEach(x=>{
   if(x[0]) current.push(x[0]);
   else if(current.length){ groups.push(current.splice(0)); }
 });
 if(current.length) groups.push(current);
 return groups;
}

const TOWN_LAYOUT_KEY="pr_town_layout_v2";
let selectedTownMove=null;
let selectedGroupMove=null;
function defaultTownLayout(key){
  const source=(typeof towns!=="undefined"&&towns&&Array.isArray(towns[key]))?towns[key]:[];
  return splitTownGroups(source).map(g=>g.filter(Boolean).map(x=>String(x).trim())).filter(g=>g.length);
}
function loadTownLayouts(){
  try{
    const raw=localStorage.getItem(TOWN_LAYOUT_KEY);
    const x=raw?JSON.parse(raw):{};
    return x&&typeof x==="object"?x:{};
  }catch(e){return {};}
}
function saveTownLayouts(layouts){
  try{localStorage.setItem(TOWN_LAYOUT_KEY,JSON.stringify(layouts));}catch(e){}
}
const TOWN_NOTES_KEY="pr_town_group_notes_v1";
function loadTownNotes(){
  try{const raw=localStorage.getItem(TOWN_NOTES_KEY);const x=raw?JSON.parse(raw):{};return x&&typeof x==="object"?x:{}}catch(e){return {}}
}
function saveTownNotes(notes){
  try{localStorage.setItem(TOWN_NOTES_KEY,JSON.stringify(notes));}catch(e){}
}
function getTownNotes(key){
  const notes=loadTownNotes();
  return Array.isArray(notes[key])?notes[key]:[];
}
function setTownNote(key,index,value){
  const notes=loadTownNotes();
  if(!Array.isArray(notes[key]))notes[key]=[];
  notes[key][index]=String(value??"");
  saveTownNotes(notes);
}
function getTownLayout(key){
  const defaults=defaultTownLayout(key);
  const saved=loadTownLayouts()[key];
  if(!Array.isArray(saved)||!saved.length)return defaults.map(g=>g.slice());
  const allowed=new Map(defaults.flat().map(name=>[norm(name),name]));
  const used=new Set(), out=[];
  saved.forEach(group=>{
    if(!Array.isArray(group))return;
    const g=[];
    group.forEach(name=>{
      const k=norm(name);
      if(k&&allowed.has(k)&&!used.has(k)){g.push(allowed.get(k));used.add(k);}
    });
    if(g.length)out.push(g);
  });
  // Never lose a town because of a bad/old saved layout.
  defaults.forEach(group=>group.forEach(name=>{
    const k=norm(name);
    if(!used.has(k)){out.push([name]);used.add(k);}
  }));
  return out.length?out:defaults.map(g=>g.slice());
}
function persistTownLayout(key,groups){
  const layouts=loadTownLayouts();
  layouts[key]=groups.filter(g=>Array.isArray(g)&&g.length).map(g=>g.slice());
  saveTownLayouts(layouts);
}
function resetTownLayout(){
  if(!confirm("Reset all towns to their original positions?\n\nThis will undo your custom town arrangement for both BADOC and PINILI."))return;
  const layouts=loadTownLayouts();
  delete layouts.badoc;
  delete layouts.pinili;
  saveTownLayouts(layouts);
  const notes=loadTownNotes();
  delete notes.badoc;
  delete notes.pinili;
  saveTownNotes(notes);
  selectedTownMove=null;
  selectedGroupMove=null;
  render();
}
function moveTownByNames(key,town,targetTown){
  const groups=getTownLayout(key).map(g=>g.slice());
  const notes=getTownNotes(key).slice();
  let fromGroup=-1,fromIndex=-1,toGroup=-1,toIndex=-1;
  groups.forEach((g,gi)=>g.forEach((name,ni)=>{
    if(norm(name)===norm(town)){fromGroup=gi;fromIndex=ni;}
    if(norm(name)===norm(targetTown)){toGroup=gi;toIndex=ni;}
  }));
  if(fromGroup<0||toGroup<0||fromGroup===toGroup&&fromIndex===toIndex)return;
  const [name]=groups[fromGroup].splice(fromIndex,1);
  if(groups[fromGroup].length===0){
    groups.splice(fromGroup,1);
    notes.splice(fromGroup,1);
    if(fromGroup<toGroup)toGroup--;
  }
  groups[toGroup].splice(Math.max(0,Math.min(toIndex,groups[toGroup].length)),0,name);
  persistTownLayout(key,groups);
  const allNotes=loadTownNotes();
  allNotes[key]=notes;
  saveTownNotes(allNotes);
  selectedTownMove=null;
  render();
}

function moveTownGroupByIndex(key,fromIndex,toIndex){
  const groups=getTownLayout(key).map(g=>g.slice());
  const notes=getTownNotes(key).slice();
  if(fromIndex<0||toIndex<0||fromIndex>=groups.length||toIndex>=groups.length||fromIndex===toIndex)return;
  const [group]=groups.splice(fromIndex,1);
  const [note]=notes.splice(fromIndex,1);
  groups.splice(toIndex,0,group);
  notes.splice(toIndex,0,note||"");
  persistTownLayout(key,groups);
  const allNotes=loadTownNotes();
  allNotes[key]=notes;
  saveTownNotes(allNotes);
  selectedGroupMove=null;
  selectedTownMove=null;
  render();
}

function moveTownToNewGroup(key,town){
  const groups=getTownLayout(key).map(g=>g.slice());
  const notes=getTownNotes(key).slice();
  let fromGroup=-1,fromIndex=-1;
  groups.forEach((g,gi)=>g.forEach((name,ni)=>{
    if(norm(name)===norm(town)){fromGroup=gi;fromIndex=ni;}
  }));
  if(fromGroup<0||fromIndex<0)return;
  const [name]=groups[fromGroup].splice(fromIndex,1);
  if(!name)return;
  if(groups[fromGroup].length===0){groups.splice(fromGroup,1);notes.splice(fromGroup,1);}
  groups.push([name]);
  notes.push("");
  persistTownLayout(key,groups);
  const allNotes=loadTownNotes();
  allNotes[key]=notes;
  saveTownNotes(allNotes);
  selectedTownMove=null;
  selectedGroupMove=null;
  render();
}

const BADOC_TOWN_GRID_RENDER_CACHE=new Map();
function updateTownMoveStatus(){
  ["badoc","pinili"].forEach(key=>{
    const el=$(key==="badoc"?"badocMoveStatus":"piniliMoveStatus");
    if(!el)return;
    const sel=selectedTownMove&&selectedTownMove.key===key?selectedTownMove:null;
    if(!sel){el.classList.remove("active");el.innerHTML="";return;}
    el.classList.add("active");
    el.innerHTML=`MOVE TOWN: <strong>${esc(sel.town)}</strong> — tap another town to move it here. <button type="button" class="move-cancel">CANCEL</button>`;
    el.querySelector(".move-cancel")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();selectedTownMove=null;updateTownMoveStatus();renderTownGrid(key==="badoc"?"badocGrid":"piniliGrid",towns[key],[],{});});
  });
}

function badocActiveRiderRosterSignature(){
  // Town-card dropdowns depend on the active rider roster. Include that roster
  // in the render signature so a cloud/CSV refresh cannot leave a stale picker.
  const seen=new Set();
  const rows=(Array.isArray(ridersData)?ridersData:[])
    .filter(r=>riderNorm(r["SPX Status"])==="ACTIVE")
    .map(r=>({
      name:String(r["Driver Name"]||"").trim(),
      id:String(r["Driver ID"]||"").trim(),
      vehicle:String(r["Vehicle Type"]||"").trim()
    }))
    .filter(r=>r.name)
    .filter(r=>{
      const k=r.name.toUpperCase()+"|"+r.id;
      if(seen.has(k))return false;
      seen.add(k);
      return true;
    })
    .sort((a,b)=>a.name.localeCompare(b.name));
  return rows.map(r=>[r.name,r.id,r.vehicle].join("\u001f")).join("\u001e");
}

function badocTownGridSignature(id,list,rows,extraCounts,groups){
  const c=counts(rows),sc=townStatusCounts(rows);
  const zoneSig={};
  (rows||[]).forEach(r=>{
    const town=norm(r?.["Town Name"]??r?.["Town"]??r?.["town"]??"");
    const zone=String(r?.["Zone"]??r?.["Zone ID"]??r?.["zone"]??"").trim();
    if(town&&zone){if(!zoneSig[town])zoneSig[town]=new Set();zoneSig[town].add(zone);}
  });
  const zoneSigOut=Object.keys(zoneSig).sort().map(k=>[k,[...zoneSig[k]].sort()]);
  const extra=Object.entries(extraCounts||{}).map(([town,n])=>[norm(town),Number(n||0)]).sort((a,b)=>a[0].localeCompare(b[0]));
  const groupSig=(groups||[]).map(g=>Array.isArray(g)?g.map(norm):[]);
  const countsSig=Object.keys(c).sort().map(k=>[k,Number(c[k]||0)]);
  const statusSig=Object.keys(sc).sort().map(k=>{const x=sc[k]||{};return [k,Number(x.received||0),Number(x.delivered||0),Number(x.delivering||0),Number(x.hold||0),Number(x.receivedTN||0)]});
  const metricRows=[...(rows||[]),...(Array.isArray(window.__badocParcelIncomingMetricRows)?window.__badocParcelIncomingMetricRows:[])];
  const metricTown=parcelMetricTownSummary(metricRows);
  const metricSig=Object.keys(metricTown).sort().map(k=>[k,metricTown[k].bulky,metricTown[k].highValue]);
  return JSON.stringify([id,(list||[]).map(norm),countsSig,statusSig,extra,metricSig,zoneSigOut,badocActiveRiderRosterSignature(),groupSig,loadTownNotes()?.[id==="badocGrid"?"badoc":"pinili"]||[],selectedGroupMove&&selectedGroupMove.key===id?selectedGroupMove.index:null,selectedTownMove&&selectedTownMove.key===id?selectedTownMove.town:null]);
}

function parcelMetricFlags(row){
  const hv=String(row?.["High Value"]??"").trim().toUpperCase();
  const bulky=Number(String(row?.["Chargeable Weight"]??"").replace(/,/g,"").trim());
  return {
    highValue:["Y","YES","TRUE","1"].includes(hv),
    bulky:Number.isFinite(bulky)&&bulky>=4
  };
}
function parcelMetricSummary(rows){
  let bulky=0,highValue=0;
  (rows||[]).forEach(row=>{
    const f=parcelMetricFlags(row);
    if(f.bulky)bulky++;
    if(f.highValue)highValue++;
  });
  return {bulky,highValue};
}
function parcelMetricTownSummary(rows){
  const out={};
  (rows||[]).forEach(row=>{
    const town=String(row?.["Town Name"]??row?.["Town"]??row?.["town"]??"").trim().toUpperCase();
    if(!town)return;
    if(!out[town])out[town]={bulky:0,highValue:0};
    const f=parcelMetricFlags(row);
    if(f.bulky)out[town].bulky++;
    if(f.highValue)out[town].highValue++;
  });
  return out;
}

function renderTownGrid(id,list,rows,extraCounts={}){
  const el=$(id);
  if(!el)return;
  const key=id==="badocGrid"?"badoc":"pinili";
  const groups=getTownLayout(key);
  const sig=badocTownGridSignature(id,list,rows,extraCounts,groups);
  if(BADOC_TOWN_GRID_RENDER_CACHE.get(id)===sig)return;
  BADOC_TOWN_GRID_RENDER_CACHE.set(id,sig);
  const c=counts(rows);
  const sc=townStatusCounts(rows);
  Object.entries(extraCounts||{}).forEach(([town,n])=>{const k=norm(town);c[k]=(c[k]||0)+Number(n||0)});
  el.innerHTML="";
  if(!groups.length){el.innerHTML='<div class="hint">No towns configured.</div>';return;}

  // Keep the original three-column arrangement when possible; additional groups
  // created by moving towns are distributed without ever being hidden.
  const columns=[[],[]];
  // Use two balanced columns for the grouped town cards. Groups stay in their
  // saved order while the visual layout remains even and fully visible.
  groups.forEach((group,i)=>columns[i%2].push(group));

  const selectedGroupRiderNames=new Set((loadTownNotes()[key]||[]).map(v=>String(v||"").trim().toUpperCase()).filter(Boolean));
  let noteIndexCounter=0;
  columns.forEach(column=>{
    const col=document.createElement("div");
    col.className="town-column";
    column.forEach(group=>{
      const noteIndex=noteIndexCounter++;
      const groupIndex=noteIndex;
      const card=document.createElement("div");
      card.className="town-card"+(selectedGroupMove&&selectedGroupMove.key===key&&selectedGroupMove.index===groupIndex?" town-group-selected":"");
      const total=group.reduce((sum,name)=>sum+(c[norm(name)]||0),0);
      const header=document.createElement("div");
      header.className="town-card-header";
      header.draggable=true;
      header.title="Drag this group to another group, or tap the group header then tap another group header";
      header.addEventListener("click",e=>{
        if(e.target===note||e.target.closest("input"))return;
        e.preventDefault();
        if(selectedGroupMove&&selectedGroupMove.key===key&&selectedGroupMove.index!==groupIndex){
          moveTownGroupByIndex(key,selectedGroupMove.index,groupIndex);
        }else if(!selectedGroupMove||selectedGroupMove.key!==key){
          selectedGroupMove={key,index:groupIndex};
          selectedTownMove=null;
          render();
        }else{
          selectedGroupMove=null;
          render();
        }
      });
      header.addEventListener("dragstart",e=>{
        selectedGroupMove={key,index:groupIndex};
        selectedTownMove=null;
        card.classList.add("dragging-group");
        e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",JSON.stringify({type:"group",key,index:groupIndex}));
      });
      header.addEventListener("dragend",()=>card.classList.remove("dragging-group"));
      header.addEventListener("dragover",e=>{e.preventDefault(); if(selectedGroupMove&&selectedGroupMove.index!==groupIndex)card.classList.add("group-drag-over"); e.dataTransfer.dropEffect="move";});
      header.addEventListener("dragleave",()=>card.classList.remove("group-drag-over"));
      header.addEventListener("drop",e=>{
        e.preventDefault(); card.classList.remove("group-drag-over");
        try{
          const data=JSON.parse(e.dataTransfer.getData("text/plain")||"{}");
          if(data.type==="group"&&data.key===key&&Number(data.index)!==groupIndex)moveTownGroupByIndex(key,Number(data.index),groupIndex);
        }catch(err){}
      });
      const title=document.createElement("span");
      title.className="town-card-title";
      title.textContent="Group";
      const note=document.createElement("div");
      note.className="town-rider-picker";
      const riderInput=document.createElement("input");
      riderInput.className="town-rider-input";
      riderInput.type="search";
      riderInput.placeholder="Select active rider...";
      const savedRiderName=String(getTownNotes(key)[noteIndex]||"").trim();
      const riderNameKeyForLabel=v=>riderNorm(v).replace(/[\s_-]+/g,"");
      const savedRiderRecord=(savedRiderName&&Array.isArray(ridersData)?ridersData:[]).find(r=>riderNameKeyForLabel(r["Driver Name"])===riderNameKeyForLabel(savedRiderName));
      const riderVehicleLabel=value=>{
        const vehicle=riderNameKeyForLabel(value||"");
        if(vehicle==="2WH"||vehicle==="2W")return "2WH";
        if(vehicle==="3WH"||vehicle==="3WC"||vehicle==="3W")return "3WH";
        if(vehicle==="FLEXI"||vehicle==="FLEX")return "Flexi";
        return String(value||"").trim();
      };
      const riderDisplayName=(name,vehicle)=>String(name||"").trim()+(riderVehicleLabel(vehicle)?" ("+riderVehicleLabel(vehicle)+")":"");
      riderInput.value=savedRiderRecord?riderDisplayName(savedRiderName,savedRiderRecord["Vehicle Type"]):savedRiderName;
      riderInput.dataset.selectedRiderName=savedRiderName;
      riderInput.setAttribute("aria-label","Select active rider");
      riderInput.autocomplete="off";
      const riderArrow=document.createElement("span");
      riderArrow.className="town-rider-arrow";
      riderArrow.textContent="▾";
      const riderDropdown=document.createElement("div");
      riderDropdown.className="town-rider-dropdown";
      const activeRiders=(()=>{
        const seen=new Set();
        return (Array.isArray(ridersData)?ridersData:[]).filter(r=>riderNorm(r["SPX Status"])==='ACTIVE').map(r=>({
          name:String(r["Driver Name"]||"").trim(),
          id:String(r["Driver ID"]||"").trim(),
          vehicle:String(r["Vehicle Type"]||"").trim()
        })).filter(r=>r.name).filter(r=>{
          const k=r.name.toUpperCase()+"|"+r.id;
          if(seen.has(k))return false;seen.add(k);return true;
        }).sort((a,b)=>a.name.localeCompare(b.name));
      })();
      const positionRiderDropdown=()=>{
        if(!note.classList.contains("open"))return;
        if(typeof riderDropdown.__place==="function")riderDropdown.__place();
        riderDropdown.style.display="block";
      };
      const openRiderPicker=()=>{
        note.classList.add("open");
        renderRiderOptions(false);

        if(riderDropdown.parentElement!==document.body){
          document.body.appendChild(riderDropdown);
        }

        const place=()=>{
          if(!note.classList.contains("open"))return;

          const rect=riderInput.getBoundingClientRect();
          const rootZoomRaw=getComputedStyle(document.documentElement).zoom;
          const rootZoom=parseFloat(rootZoomRaw);
          const zoom=(Number.isFinite(rootZoom)&&rootZoom>0)?rootZoom:1;

          // The app uses html{zoom:80%}. The body-ported absolute menu is still
          // subject to that page zoom, so convert the visual rect back into
          // document CSS coordinates before assigning left/top/width.
          const sx=window.scrollX||document.documentElement.scrollLeft||0;
          const sy=window.scrollY||document.documentElement.scrollTop||0;

          const left=Math.max(0,(rect.left+sx)/zoom);
          const top=Math.max(0,(rect.bottom+4+sy)/zoom);
          const width=Math.max(1,rect.width/zoom);

          // Keep the dropdown fully visible below the selector. If the viewport
          // is shorter than 160px below the selector, it becomes internally
          // scrollable rather than moving above the field.
          const visibleBelow=Math.max(120,(window.innerHeight-rect.bottom-8)/zoom);

          riderDropdown.style.setProperty("position","absolute","important");
          riderDropdown.style.setProperty("left",`${Math.round(left)}px`,"important");
          riderDropdown.style.setProperty("top",`${Math.round(top)}px`,"important");
          riderDropdown.style.setProperty("width",`${Math.round(width)}px`,"important");
          riderDropdown.style.setProperty("max-width",`${Math.round(width)}px`,"important");
          riderDropdown.style.setProperty("max-height",`${Math.min(300,visibleBelow)}px`,"important");
          riderDropdown.style.setProperty("right","auto","important");
          riderDropdown.style.setProperty("display","block","important");
          riderDropdown.style.setProperty("z-index","2147483647","important");
        };

        riderDropdown.__place=place;
        requestAnimationFrame(()=>{
          place();
          requestAnimationFrame(place);
        });
      };
      const closeRiderPicker=()=>{
        note.classList.remove("open");
        riderDropdown.style.removeProperty("left");
        riderDropdown.style.removeProperty("top");
        riderDropdown.style.removeProperty("right");
        riderDropdown.style.removeProperty("width");
        riderDropdown.style.removeProperty("max-width");
        riderDropdown.style.removeProperty("max-height");
        riderDropdown.style.removeProperty("display");
        riderDropdown.style.removeProperty("position");
        riderDropdown.style.removeProperty("z-index");
        riderDropdown.__place=null;
        if(riderDropdown.parentElement!==note)note.appendChild(riderDropdown);
        if(window.__badocPendingRiderRender){
          window.__badocPendingRiderRender=false;
          setTimeout(()=>{if(typeof render==="function")render();},0);
        }
      };
      const renderRiderOptions=(search=true)=>{
        const q=search?riderNorm(riderInput.value):"";
        const allTownNotes=loadTownNotes();
        const selectedNow=new Set(Object.values(allTownNotes).flatMap(v=>Array.isArray(v)?v:[]).map(v=>String(v||"").trim().toUpperCase()).filter(Boolean));
        const currentName=String(riderInput.dataset.selectedRiderName||riderInput.value||"").trim().toUpperCase();
        const matches=activeRiders.filter(r=>{
          const rn=r.name.toUpperCase();
          if(selectedNow.has(rn) && rn!==currentName)return false;
          return !q||riderNorm(r.name).includes(q)||riderNorm(r.id).includes(q)||riderNorm(r.vehicle).includes(q);
        });
        riderDropdown.innerHTML=matches.length?matches.map(r=>`<button type="button" class="town-rider-option" data-rider-name="${esc(r.name)}">${esc(riderDisplayName(r.name,r.vehicle))}${r.id?`<small>${esc(r.id)}</small>`:""}</button>`).join(""):`<div class="town-rider-empty">No active rider found.</div>`;
        riderDropdown.querySelectorAll(".town-rider-option").forEach(btn=>{
          btn.addEventListener("click",e=>{
            e.preventDefault();e.stopPropagation();
            const name=btn.dataset.riderName||"";
            const chosenRider=activeRiders.find(r=>r.name===name);
            riderInput.value=chosenRider?riderDisplayName(name,chosenRider.vehicle):name;
            riderInput.dataset.selectedRiderName=name;
            closeRiderPicker();
            // Save the selection without forcing the whole town grid to re-render.
            // The dropdown stays in place while the existing cloud sync runs.
            const notes=loadTownNotes();
            if(!Array.isArray(notes[key]))notes[key]=[];
            notes[key][noteIndex]=String(name??"");
            try{localStorage.setItem(TOWN_NOTES_KEY,JSON.stringify(notes))}catch{}
            window.__badocRenderDashboardRiderSummary?.();
            if(typeof window.__badocSyncTownNotesNow==="function")
              window.__badocSyncTownNotesNow(notes).catch(e=>console.warn("Rider selection sync:",e));
          });
        });
      };
      riderInput.addEventListener("input",()=>{riderInput.dataset.selectedRiderName="";});
      riderInput.addEventListener("click",e=>{e.stopPropagation();window.__badocPendingRiderRender=false;openRiderPicker();});
      riderInput.addEventListener("pointerdown",e=>e.stopPropagation());
      riderInput.addEventListener("blur",()=>setTimeout(()=>{if(!note.contains(document.activeElement) && !riderDropdown.contains(document.activeElement))closeRiderPicker();},120));
      riderInput.addEventListener("dragstart",e=>e.stopPropagation());
      riderInput.addEventListener("input",e=>{e.stopPropagation();openRiderPicker();renderRiderOptions(true);});
      riderInput.addEventListener("keydown",e=>{if(e.key==="Escape"){closeRiderPicker();riderInput.blur();}else if(e.key==="Enter"){e.preventDefault();const first=riderDropdown.querySelector(".town-rider-option");if(first)first.click();}});
      note.addEventListener("click",e=>e.stopPropagation());
      note.addEventListener("pointerdown",e=>e.stopPropagation());
      note.append(riderInput,riderArrow,riderDropdown);
      const groupReceived=group.reduce((sum,name)=>sum+(sc[norm(name)]?.received||0),0);
      const groupDelivered=group.reduce((sum,name)=>sum+(sc[norm(name)]?.delivered||0),0);
      const groupDelivering=group.reduce((sum,name)=>sum+(sc[norm(name)]?.delivering||0),0);
      const groupHold=group.reduce((sum,name)=>sum+(sc[norm(name)]?.hold||0),0);
      const groupMetricRows=[...(rows||[]),...(Array.isArray(window.__badocParcelIncomingMetricRows)?window.__badocParcelIncomingMetricRows:[])];
      const groupTownKeys=new Set(group.map(name=>norm(name)));
      let groupBulkyTotal=0,groupHighValueTotal=0;
      const groupMetricSeen=new Set();
      groupMetricRows.forEach(row=>{
        const rowTown=norm(row?.["Town Name"]??row?.["Town"]??row?.["town"]??"");
        if(!groupTownKeys.has(rowTown))return;
        const parcelKey=normJoin(
          row?.["Order ID"]??row?.["SPX TN"]??row?.["SPX Tracking Number"]??row?.["SLS Tracking Number"]??""
        );
        const dedupeKey=parcelKey||("ROW:"+groupMetricSeen.size);
        if(groupMetricSeen.has(dedupeKey))return;
        groupMetricSeen.add(dedupeKey);
        const metric=parcelMetricFlags(row);
        if(metric.bulky)groupBulkyTotal++;
        if(metric.highValue)groupHighValueTotal++;
      });
      const groupStatusTotal=groupReceived+groupDelivered+groupDelivering+groupHold;
      const groupSuccessRate=groupStatusTotal?(groupDelivered/groupStatusTotal)*100:0;
      const groupSrText=groupSuccessRate%1===0?groupSuccessRate.toFixed(0):groupSuccessRate.toFixed(1);
      const totalEl=document.createElement("span");
      totalEl.className="town-card-total";
      totalEl.textContent=total.toLocaleString();
      const selectedRiderName=String(getTownNotes(key)[noteIndex]||"").trim();
      const riderNameKey=v=>riderNorm(v).replace(/[\s_-]+/g,"");
      const selectedRider=(selectedRiderName&&Array.isArray(ridersData)?ridersData:[]).find(r=>riderNameKey(r["Driver Name"])===riderNameKey(selectedRiderName));
      const selectedVehicle=riderNameKey(selectedRider?.["Vehicle Type"]||"");
      const isProductivityRider=selectedRider && (selectedVehicle==="3WC" || selectedVehicle==="2WH");
      const isFlexiRider=selectedRider && (selectedVehicle.includes("FLEXI") || selectedVehicle==="FLEX");
      const scanned=groupDelivered+groupDelivering+groupHold;
      const productivityRiders=isProductivityRider?1:0;
      const productivityScanned=isProductivityRider?scanned:0;
      const editableFleetProductivity=Number(localStorage.getItem("badoc_fleet_productivity_v1"));
      const fpTarget=Number.isFinite(editableFleetProductivity)&&editableFleetProductivity>0?editableFleetProductivity:0;
      // 2WH/3WC only: grouped town total volume ÷ editable Fleet Productivity target × 100.
      const fpPercent=(productivityRiders&&fpTarget>0)?((total/fpTarget)*100):0;
      const fpText=fpPercent%1===0?fpPercent.toFixed(0):fpPercent.toFixed(1);
      const groupFpEl=document.createElement("span");
      groupFpEl.className="town-card-fleet-productivity";
      groupFpEl.textContent=`FP ${fpText}%`;
      groupFpEl.title=`Fleet Productivity: ${fpText}% (${total.toLocaleString()} grouped-town volume ÷ editable Fleet Productivity target ${fpTarget} × 100; 2WH/3WC only, Flexi excluded)`;
      const groupBulkyEl=document.createElement("span");
      groupBulkyEl.className="town-card-bulky";
      groupBulkyEl.textContent=`B ${groupBulkyTotal.toLocaleString()}`;
      groupBulkyEl.title=`Grouped Town Bulky Total: ${groupBulkyTotal.toLocaleString()} parcels with Chargeable Weight ≥ 4.00`;
      const groupHighValueEl=document.createElement("span");
      groupHighValueEl.className="town-card-high-value";
      groupHighValueEl.textContent=`HV ${groupHighValueTotal.toLocaleString()}`;
      groupHighValueEl.title=`Grouped Town High Value Total: ${groupHighValueTotal.toLocaleString()} parcels with High Value = Y`;
      const groupSrEl=document.createElement("span");
      groupSrEl.className="town-card-success-rate";
      groupSrEl.textContent=`SR ${groupSrText}%`;
      groupSrEl.title=`Group Success Rate: ${groupSrText}%`;
      header.append(title,note,groupFpEl,groupSrEl,groupBulkyEl,groupHighValueEl,totalEl);
      card.appendChild(header);
      group.forEach(name=>{
        const r=document.createElement("div");
        r.className="town-row"+(selectedTownMove&&selectedTownMove.key===key&&selectedTownMove.town===norm(name)?" town-move-selected":"");
        r.draggable=true;
        r.dataset.town=norm(name);
        r.title="Drag to another town, or tap a town then tap the destination town";
        const townKey=norm(name);
        const ts=sc[townKey]||{received:0,delivered:0,delivering:0,hold:0};
        const townZones=new Set();
        (rows||[]).forEach(row=>{
          const rowTown=norm(row?.["Town Name"]??row?.["Town"]??row?.["town"]??"");
          if(rowTown!==townKey)return;
          const zoneId=String(row?.["Zone ID"]??row?.["ZoneId"]??row?.["zone id"]??"").trim();
          if(zoneId)townZones.add(zoneId);
        });
        const zoneIds=[...townZones].sort();
        const statusTotal=ts.received+ts.delivered+ts.delivering+ts.hold;
        const successRate=statusTotal?((ts.delivered/statusTotal)*100):0;
        const srText=successRate%1===0?successRate.toFixed(0):successRate.toFixed(1);
        const zoneWrap=document.createElement("span");
        zoneWrap.className="town-zone-picker";
        const zoneBtn=document.createElement("button");
        zoneBtn.type="button";
        zoneBtn.className="town-zone-button";
        zoneBtn.innerHTML=`${esc(name)} <span class="town-zone-arrow">▾</span>`;
        zoneBtn.title=zoneIds.length?"Show Zone ID":"Zone ID not available";
        const zoneDrop=document.createElement("div");
        zoneDrop.className="town-zone-dropdown";
        zoneDrop.innerHTML=zoneIds.length?zoneIds.map(z=>`<div class="town-zone-option"><span>Zone ID</span><strong>${esc(z)}</strong></div>`).join(""):"<div class=\"town-zone-empty\">Zone ID not available</div>";
        const positionZoneDropdown=()=>{
          if(!zoneWrap.classList.contains("open"))return;
          const rect=zoneBtn.getBoundingClientRect();
          const gap=4, pad=8;
          zoneDrop.style.position="fixed";
          zoneDrop.style.left=Math.max(pad,Math.min(rect.left,window.innerWidth-300-pad))+"px";
          zoneDrop.style.top=(rect.bottom+gap)+"px";
          zoneDrop.style.zIndex="2147483647";
          const maxH=Math.max(80,window.innerHeight-rect.bottom-gap-pad);
          zoneDrop.style.maxHeight=Math.min(280,maxH)+"px";
        };
        const closeZoneDropdown=()=>{
          zoneWrap.classList.remove("open");
          zoneDrop.style.display="none";
          zoneDrop.style.position=""; zoneDrop.style.left=""; zoneDrop.style.top="";
          zoneDrop.style.zIndex=""; zoneDrop.style.maxHeight="";
          if(zoneDrop.parentElement!==zoneWrap)zoneWrap.appendChild(zoneDrop);
        };
        zoneDrop._closeZoneDropdown=closeZoneDropdown;
        zoneDrop._zoneWrap=zoneWrap;
        zoneBtn.addEventListener("click",e=>{
          e.preventDefault(); e.stopPropagation();
          const wasOpen=zoneWrap.classList.contains("open");
          // Close every other Zone ID dropdown completely, including any portal
          // that was moved to <body>. Do not merely remove the open class.
          // Zone dropdowns are portaled to <body> while open, so search the
          // whole document rather than the town/grid container. This guarantees
          // that opening one town always closes every previously opened dropdown.
          document.querySelectorAll(".town-zone-dropdown").forEach(d=>{
            if(d!==zoneDrop && typeof d._closeZoneDropdown==="function") d._closeZoneDropdown();
          });
          if(!wasOpen){
            // Only one Zone ID menu may be visible at a time.
            document.querySelectorAll(".town-zone-dropdown").forEach(d=>{
              if(d!==zoneDrop){
                if(typeof d._closeZoneDropdown==="function") d._closeZoneDropdown();
                else d.remove();
              }
            });
            zoneWrap.classList.add("open");
            document.body.appendChild(zoneDrop);
            zoneDrop.style.display="block";
            requestAnimationFrame(positionZoneDropdown);
          }
        });
        document.addEventListener("pointerdown",e=>{
          if(e.target.closest(".town-zone-picker") || e.target.closest(".town-zone-dropdown"))return;
          if(zoneWrap.classList.contains("open")) closeZoneDropdown();
        });
        zoneBtn.addEventListener("keydown",e=>{
          if(e.key==="Escape"){ e.preventDefault(); closeZoneDropdown(); zoneBtn.blur(); }
        });
        zoneDrop.addEventListener("pointerdown",e=>e.stopPropagation());
        zoneDrop.addEventListener("click",e=>e.stopPropagation());
        window.addEventListener("resize",positionZoneDropdown);
        window.addEventListener("scroll",positionZoneDropdown,true);
        zoneWrap.append(zoneBtn);
        const townSpan=document.createElement("span");
        townSpan.className="town";
        townSpan.append(document.createElement("span"));
        townSpan.firstChild.className="town-drag-handle";
        townSpan.firstChild.textContent="⋮⋮";
        townSpan.append(zoneWrap);
        r.append(townSpan);
        const statuses=document.createElement("span");
        statuses.className="town-statuses";
        const townMetric=parcelMetricTownSummary([...(rows||[]),...(Array.isArray(window.__badocParcelIncomingMetricRows)?window.__badocParcelIncomingMetricRows:[])])[townKey]||{bulky:0,highValue:0};
        statuses.setAttribute("aria-label",`Received ${ts.received}, Delivering ${ts.delivering}, Delivered ${ts.delivered}, Hold ${ts.hold}, Success Rate ${srText}%`);
        statuses.innerHTML=`<span class="town-status received" title="Received">R ${ts.received}</span><span class="town-status delivered" title="Delivered">DV ${ts.delivered}</span><span class="town-status delivering" title="Delivering">D ${ts.delivering}</span><span class="town-status hold" title="On Hold">H ${ts.hold}</span><span class="town-status success-rate" title="Success Rate">SR ${srText}%</span><span class="count" title="Total">${c[townKey]||0}</span>`;
        r.append(statuses);

        r.addEventListener("click",e=>{
          if(e.target.closest(".town-zone-picker") || e.target.closest(".town-zone-dropdown"))return;
        });
        r.addEventListener("dragstart",e=>{
          selectedTownMove={key,town:norm(name)};
          r.classList.add("dragging");
          e.dataTransfer.effectAllowed="move";
          e.dataTransfer.setData("text/plain",JSON.stringify({key,town:norm(name)}));
        });
        r.addEventListener("dragend",()=>r.classList.remove("dragging"));
        r.addEventListener("dragover",e=>{e.preventDefault();r.classList.add("drag-over");e.dataTransfer.dropEffect="move";});
        r.addEventListener("dragleave",()=>r.classList.remove("drag-over"));
        r.addEventListener("drop",e=>{
          e.preventDefault();r.classList.remove("drag-over");
          try{
            const data=JSON.parse(e.dataTransfer.getData("text/plain")||"{}");
            if(data.key===key&&data.town&&data.town!==norm(name))moveTownByNames(key,data.town,name);
          }catch(err){}
        });
        card.appendChild(r);
      });
      col.appendChild(card);
    });
    el.appendChild(col);
  });

  // One extra empty group space for creating a new group. This is intentionally
  // added after the normal town layout so it cannot disturb the existing groups.
  const newGroup=document.createElement("div");
  newGroup.className="town-card empty-group";
  newGroup.innerHTML=`<div class="empty-group-title">+ NEW GROUP</div><div class="empty-group-hint">Select a town, then tap here to create another group.</div>`;
  newGroup.addEventListener("click",()=>{
    if(selectedTownMove&&selectedTownMove.key===key){
      moveTownToNewGroup(key,selectedTownMove.town);
    }
  });
  newGroup.addEventListener("dragover",e=>{
    e.preventDefault();
    newGroup.classList.add("drag-over");
    e.dataTransfer.dropEffect="move";
  });
  newGroup.addEventListener("dragleave",()=>newGroup.classList.remove("drag-over"));
  newGroup.addEventListener("drop",e=>{
    e.preventDefault();
    newGroup.classList.remove("drag-over");
    try{
      const data=JSON.parse(e.dataTransfer.getData("text/plain")||"{}");
      if(data.key===key&&data.town)moveTownToNewGroup(key,data.town);
    }catch(err){}
  });
  // Put the new-group space inside the LAST existing column so it sits
  // directly at the bottom of the town layout instead of becoming a fourth
  // grid item that wraps under the first column on mobile.
  const lastColumn=el.querySelector(".town-column:last-child");
  if(lastColumn) lastColumn.appendChild(newGroup);
  else{
    const newGroupColumn=document.createElement("div");
    newGroupColumn.className="town-column";
    newGroupColumn.appendChild(newGroup);
    el.appendChild(newGroupColumn);
  }
  updateTownMoveStatus();
}

const resetTownButton=$("resetTownLayout");
if(resetTownButton)resetTownButton.addEventListener("click",resetTownLayout);

function buildTownPrintArea(){
  const existing=document.getElementById("townPrintArea");
  if(existing)existing.remove();
  const area=document.createElement("div");
  area.id="townPrintArea";
  area.setAttribute("aria-hidden","true");
  const printDate=document.createElement("div");
  printDate.className="print-date";
  printDate.textContent="Date: "+new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
  area.appendChild(printDate);
  [["BADOC","badocGrid"],["PINILI","piniliGrid"]].forEach(([label,id])=>{
    const source=document.getElementById(id);
    if(!source)return;
    const section=document.createElement("section");
    section.className="print-section";
    const h=document.createElement("h2");
    h.textContent=label;
    section.appendChild(h);
    const grid=source.cloneNode(true);
    // Capture the selected rider before the rider input is replaced/removed for print.
    grid.querySelectorAll(".town-card-header").forEach(header=>{
      const riderInput=header.querySelector(".town-rider-input");
      const riderName=String(riderInput?.value||"").trim();
      if(riderName) header.dataset.printRider=riderName;
    });
    grid.querySelectorAll("input").forEach(input=>{
      const span=document.createElement("span");
      span.className="town-card-note";
      span.textContent=input.value||"";
      input.replaceWith(span);
    });
    grid.querySelectorAll(".town-row").forEach(row=>{
      row.removeAttribute("draggable");
      row.classList.remove("town-move-selected");
      // Print Towns: show only the town name and its total.
      const statuses=row.querySelector(".town-statuses");
      if(statuses){
        const total=statuses.querySelector(".count");
        const town=row.querySelector(".town");
        row.innerHTML="";
        if(town) row.appendChild(town);
        if(total) row.appendChild(total);
      }
    });
    grid.querySelectorAll(".town-card-success-rate,.town-card-fleet-productivity,.empty-group").forEach(el=>el.remove());
    grid.querySelectorAll(".town-card-header").forEach(header=>{
      const riderName=String(header.dataset.printRider||"").trim();
      const total=header.querySelector(".town-card-total");
      header.innerHTML="";
      if(riderName){
        const rider=document.createElement("span");
        rider.className="print-rider";
        rider.textContent="Rider: "+riderName;
        header.appendChild(rider);
      }
      if(total) header.appendChild(total);
    });
    grid.querySelectorAll(".town-card-note,.town-rider-picker").forEach(el=>el.remove());
    section.appendChild(grid);
    area.appendChild(section);
  });
  document.body.appendChild(area);
  return area;
}

function printTownLayout(){
  const area=buildTownPrintArea();
  const oldPreview=document.getElementById("townPrintPreview");
  if(oldPreview)oldPreview.remove();

  const modal=document.createElement("div");
  modal.id="townPrintPreview";
  modal.innerHTML=`<div class="print-preview-box" role="dialog" aria-modal="true" aria-label="Print Towns preview">
    <div class="print-preview-head">
      <div class="print-preview-title">Print Towns — Preview</div>
      <div class="print-preview-actions">
        <button class="btn" type="button" id="townPreviewCancel">Cancel</button>
        <button class="btn" type="button" id="townPreviewPrint">PRINT</button>
      </div>
    </div>
    <div class="print-preview-body"><div class="print-preview-paper" id="townPreviewPaper"></div></div>
  </div>`;
  document.body.appendChild(modal);
  const paper=modal.querySelector("#townPreviewPaper");
  area.querySelectorAll(".print-section").forEach(section=>paper.appendChild(section.cloneNode(true)));

  const close=()=>{modal.remove();area.remove();};
  modal.querySelector("#townPreviewCancel").addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  modal.querySelector("#townPreviewPrint").addEventListener("click",()=>{
    modal.remove();
    area.removeAttribute("aria-hidden");
    const cleanup=()=>{area.remove();window.removeEventListener("afterprint",cleanup);};
    window.addEventListener("afterprint",cleanup);
    requestAnimationFrame(()=>window.print());
  });
}

const printTownButton=$("printTownLayout");
if(printTownButton)printTownButton.addEventListener("click",printTownLayout);

function fillTownFilter(){
  const el=$("recordTown");
  if(!el)return;
  const currentValue=el.value||"";
  const names=[...(towns?.badoc||[]),...(towns?.pinili||[])];
  const unique=[...new Set(names.map(x=>String(x||"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  el.innerHTML='<option value="">Town Name</option>'+
    unique.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if(unique.includes(currentValue))el.value=currentValue;
}

function fillStatusFilter(){
  const el=$("recordStatus");
  if(!el)return;
  const currentValue=el.value||"";
  const rows=typeof getParcelRecordRows==="function"?getParcelRecordRows():((current&&Array.isArray(current.valid))?current.valid:[]);
  const statuses=[...new Set(rows.map(recordStatusValue).map(x=>String(x??"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  el.innerHTML='<option value="">Status</option>'+
    statuses.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if(statuses.includes(currentValue))el.value=currentValue;
}

const BADOC_ONHOLD_EXPORT_KEY="badoc_onhold_spx_exports_v1";
function badocOnholdKey(value){return String(value??"").trim().toUpperCase().replace(/[\\s\\-_.]/g,"")}
const BADOC_ONHOLD_MANILA_DATETIME_FORMATTER=new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
});
const BADOC_ONHOLD_MANILA_DATE_FORMATTER=new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"
});
let badocOnholdTodayKeyCache="",badocOnholdTodayKeyCacheAt=0;
function badocOnholdTodayKey(){
  const now=Date.now();
  if(!badocOnholdTodayKeyCache||now-badocOnholdTodayKeyCacheAt>=30000){
    const p={};
    BADOC_ONHOLD_MANILA_DATE_FORMATTER.formatToParts(new Date(now)).forEach(part=>{
      if(part.type!=="literal")p[part.type]=part.value;
    });
    badocOnholdTodayKeyCache=p.year+"-"+p.month+"-"+p.day;
    badocOnholdTodayKeyCacheAt=now;
  }
  return badocOnholdTodayKeyCache;
}
function badocOnholdPickupBeforeCutoff(row){
  if(!row||typeof row!=="object")return false;
  const keys=Object.keys(row);
  const compact=value=>String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const wanted=new Set([
    "pickuptime","firstpickuptime","firstpickupdatetime",
    "pickupdatetime","pickuptimestamp","atpickuptime","scannedtime"
  ]);
  let pickupKey=keys.find(key=>wanted.has(compact(key))&&String(row[key]??"").trim()!=="");
  if(!pickupKey){
    pickupKey=keys.find(key=>compact(key).includes("pickuptime")&&String(row[key]??"").trim()!=="");
  }
  if(!pickupKey)return false;
  const raw=String(row[pickupKey]??"").trim();
  // A date without a clock time is not evidence of a pickup before cutoff.
  if(!/\d{1,2}:\d{2}/.test(raw))return false;

  const parseManilaStamp=value=>{
    let m=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);
    if(m){
      let hour=Number(m[4]),mer=String(m[7]||"").toUpperCase();
      if(mer==="AM"&&hour===12)hour=0;else if(mer==="PM"&&hour<12)hour+=12;
      return {dateKey:[m[1],String(Number(m[2])).padStart(2,"0"),String(Number(m[3])).padStart(2,"0")].join("-"),minutes:hour*60+Number(m[5])+Number(m[6]||0)/60};
    }
    m=value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if(m){
      let year=Number(m[3]);if(year<100)year+=2000;
      let hour=Number(m[4]),mer=String(m[7]||"").toUpperCase();
      if(mer==="AM"&&hour===12)hour=0;else if(mer==="PM"&&hour<12)hour+=12;
      return {dateKey:[String(year),String(Number(m[1])).padStart(2,"0"),String(Number(m[2])).padStart(2,"0")].join("-"),minutes:hour*60+Number(m[5])+Number(m[6]||0)/60};
    }
    // Zoned ISO and native timestamps are converted to Philippine time.
    const parsed=new Date(value);
    if(Number.isNaN(parsed.getTime()))return null;
    const p={};
    BADOC_ONHOLD_MANILA_DATETIME_FORMATTER.formatToParts(parsed).forEach(part=>{
      if(part.type!=="literal")p[part.type]=part.value;
    });
    if(!p.year||!p.hour)return null;
    return {dateKey:p.year+"-"+p.month+"-"+p.day,minutes:Number(p.hour)*60+Number(p.minute||0)+Number(p.second||0)/60};
  };

  const pickup=parseManilaStamp(raw);
  return !!pickup&&pickup.dateKey===badocOnholdTodayKey()&&pickup.minutes<900;
}
function badocOnholdStatus(row){
  const raw=String(badocRowMeta(row)?.status||row?.["Parcel Status To"]||row?.["Status To"]||row?.["Status"]||"")
    .trim().toUpperCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
  if(!raw||/(^|\s)(DELIVERING|DELIVERED)$/.test(raw))return false;
  // Shared rule for Dashboard and Planning Board:
  // every populated status except Delivering / Delivered is On-Hold
  // only when Pick Up Time is today and earlier than 3:00 PM Manila time.
  return badocOnholdPickupBeforeCutoff(row);
}
function badocLoadOnholdExportRows(){
  try{const saved=JSON.parse(localStorage.getItem(BADOC_ONHOLD_EXPORT_KEY)||"[]");return Array.isArray(saved)?saved.filter(r=>r&&typeof r==="object"):[]}catch(e){return []}
}

// Full Forward/Return snapshots can exceed localStorage's small quota. Store the
// dataset in IndexedDB, matching the storage approach used for Parcel Count.
const BADOC_ONHOLD_DB_NAME="BadocHubOnholdExportsV1";
const BADOC_ONHOLD_DB_STORE="exports";
let badocOnholdDbReady=null;
function openBadocOnholdDB(){
  if(badocOnholdDbReady)return badocOnholdDbReady;
  badocOnholdDbReady=new Promise((resolve,reject)=>{
    try{
      if(!window.indexedDB){reject(new Error("IndexedDB is unavailable in this browser."));return;}
      const request=indexedDB.open(BADOC_ONHOLD_DB_NAME,1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(BADOC_ONHOLD_DB_STORE)){
          request.result.createObjectStore(BADOC_ONHOLD_DB_STORE,{keyPath:"id"});
        }
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>db.close();
        resolve(db);
      };
      request.onerror=()=>reject(request.error||new Error("Could not open Assigned Today storage."));
      request.onblocked=()=>reject(new Error("Assigned Today storage is blocked by another open dashboard tab. Close other BADOC HUB tabs and retry."));
    }catch(error){reject(error)}
  }).catch(error=>{
    badocOnholdDbReady=null;
    throw error;
  });
  return badocOnholdDbReady;
}
function badocSaveOnholdExportRows(rows){
  const byTn=new Map();
  (Array.isArray(rows)?rows:[]).forEach(row=>{const key=badocOnholdKey(spxTN(row));if(key)byTn.set(key,row)});
  const unique=[...byTn.values()];
  // This assignment updates the live page immediately; persistence is confirmed
  // separately by badocPersistOnholdExportRows before the sync reports success.
  window.__badocOnholdExportRows=unique;
  return unique;
}
async function badocPersistOnholdExportRows(rows){
  const db=await openBadocOnholdDB();
  const record={id:"current",rows:Array.isArray(rows)?rows:[],updatedAt:Date.now(),rowCount:Array.isArray(rows)?rows.length:0};
  const tx=db.transaction(BADOC_ONHOLD_DB_STORE,"readwrite");
  tx.objectStore(BADOC_ONHOLD_DB_STORE).put(record);
  await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||new Error("Assigned Today data could not be saved."));
    tx.onabort=()=>reject(tx.error||new Error("Assigned Today storage transaction was aborted."));
  });
  // Remove any old, smaller localStorage snapshot only after IndexedDB confirms
  // the durable write.
  window.__badocOnholdExportRows=record.rows;
  try{localStorage.removeItem(BADOC_ONHOLD_EXPORT_KEY)}catch(e){}
  return record.rowCount;
}
async function badocRestoreOnholdExportRows(){
  try{
    const db=await openBadocOnholdDB();
    const saved=await new Promise((resolve,reject)=>{
      const request=db.transaction(BADOC_ONHOLD_DB_STORE,"readonly").objectStore(BADOC_ONHOLD_DB_STORE).get("current");
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error("Could not read saved Assigned Today data."));
    });
    if(saved&&Array.isArray(saved.rows)){
      window.__badocOnholdExportRows=saved.rows;
      return saved.rows.length;
    }
    // One-time migration for installations that successfully saved the old
    // localStorage value before the quota was reached.
    const legacy=badocLoadOnholdExportRows();
    if(legacy.length){
      const count=await badocPersistOnholdExportRows(legacy);
      window.__badocOnholdExportRows=legacy;
      return count;
    }
    window.__badocOnholdExportRows=[];
    return 0;
  }catch(error){
    console.warn("Could not restore durable Assigned Today data:",error);
    // Preserve any legacy localStorage data as a best-effort fallback.
    window.__badocOnholdExportRows=badocLoadOnholdExportRows();
    return window.__badocOnholdExportRows.length;
  }
}
async function badocClearOnholdExportRows(){
  try{
    const db=await openBadocOnholdDB();
    const tx=db.transaction(BADOC_ONHOLD_DB_STORE,"readwrite");
    tx.objectStore(BADOC_ONHOLD_DB_STORE).delete("current");
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error("Could not clear Assigned Today data."));
      tx.onabort=()=>reject(tx.error||new Error("Assigned Today clear was aborted."));
    });
  }finally{
    window.__badocOnholdExportRows=[];
    window.__badocOnholdTnKeys=new Set();
    try{localStorage.removeItem(BADOC_ONHOLD_EXPORT_KEY)}catch(e){}
  }
}
function badocGetOnholdRows(baseRows,restrictToBase=false){
  const rows=Array.isArray(baseRows)?baseRows:(typeof getParcelCountRows==="function"?getParcelCountRows():[]);
  const byTn=new Map();
  const baseKeys=new Set();
  const latestRowsByTn=new Map();
  rows.forEach(row=>{
    if(!row)return;
    const key=badocOnholdKey(spxTN(row));
    if(key){
      baseKeys.add(key);
      latestRowsByTn.set(key,row);
    }
    if(isExceptionRow(row)||!badocOnholdStatus(row))return;
    if(key)byTn.set(key,row);
  });
  const exports=Array.isArray(window.__badocOnholdExportRows)?window.__badocOnholdExportRows:badocLoadOnholdExportRows();
  exports.forEach(row=>{
    const key=badocOnholdKey(spxTN(row));
    if(!key||isExceptionRow(row)||(restrictToBase&&!baseKeys.has(key)))return;
    // Reconcile the latest status export against its already-merged Parcel Count
    // row. SPX Forward/Return status snapshots often leave Pick Up Time blank;
    // that blank must not erase the original pickup timestamp used by the
    // fixed 3:00 PM Manila OnHold cutoff. Empty status fields are preserved too.
    const previous=latestRowsByTn.get(key)||byTn.get(key)||{};
    const effective=mergeParcelRowsPreservingPickup(previous,row);
    latestRowsByTn.set(key,effective);
    if(badocOnholdStatus(effective))byTn.set(key,effective);
    else byTn.delete(key);
  });
  return [...byTn.values()];
}
window.__badocGetOnholdRows=badocGetOnholdRows;
window.__badocOnholdExportRows=badocLoadOnholdExportRows();
window.__badocOnholdExportsReady=badocRestoreOnholdExportRows().then(count=>{
  if(count){
    try{if(typeof render==="function")render()}catch(e){console.warn("Assigned Today restore render:",e)}
    try{window.updateOperationProgress?.()}catch(e){}
    try{if(typeof renderRecords==="function")renderRecords()}catch(e){}
  }
  return count;
});

function getParcelCountRows(options={}){
  // Callers can opt into exemption-inclusive rows for metrics that must be
  // independent of the Exemptions list (currently Backlogs only).
  const includeExemptions=options?.includeExemptions===true;
  // Start with the uploaded Parcel Count rows, preserving the existing
  // Badoc/Pinili routing and one-row-per-SPX-TN behavior.
  const valid=Array.isArray(current?.valid)?current.valid:[];
  const mis=Array.isArray(current?.mis)?current.mis:[];
  const statusOf=r=>{
    const keys=["Parcel Status To","Status To","TO Status","To Status","Status To (Current)","Status"];
    for(const k of keys){
      if(r&&Object.prototype.hasOwnProperty.call(r,k)&&String(r[k]??"").trim()) return String(r[k]).trim();
    }
    const key=Object.keys(r||{}).find(k=>/parcel\s*status\s*to|status\s*to|to\s*status/i.test(k));
    return key?String(r[key]??"").trim():"";
  };
  const statusNorm=v=>norm(v).replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
  const allowedStatuses=new Set([
    "RECEIVED","LMHUB RECEIVED","DELIVERING","DELIVERED",
    "ONHOLD","ON HOLD","LMHUB ONHOLD","LMHUB ON HOLD",
    "ASSIGNING","ASSIGNED","LMHUB ASSIGNING","LMHUB ASSIGNED"
  ]);
  const qualifies=r=>allowedStatuses.has(statusNorm(statusOf(r))) && (includeExemptions || !isExceptionRow(r));
  const keyOf=v=>norm(v).replace(/[\s\-_.]/g,"");
  const rows=[];
  const seen=new Set();

  valid.forEach(r=>{
    if(!qualifies(r))return;
    const k=keyOf(spxTN(r));
    if(k){if(seen.has(k))return;seen.add(k);}
    rows.push(r);
  });
  mis.forEach(r=>{
    if(!qualifies(r))return;
    const k=keyOf(spxTN(r));
    if(k&&seen.has(k))return;
    if(k)seen.add(k);
    rows.push({...r,_area:"Misrouted"});
  });

  // Assigned Today stores both Forward and Return exports. Treat each exported
  // record as the newest status for its SPX TN and merge it into the main
  // Planning Board row set, even when that TN was not in the uploaded file.
  const rowIndexByTn=new Map();
  rows.forEach((row,index)=>{
    const key=keyOf(spxTN(row));
    if(key)rowIndexByTn.set(key,index);
  });
  const exported=Array.isArray(window.__badocOnholdExportRows)
    ?window.__badocOnholdExportRows
    :badocLoadOnholdExportRows();
  const areaByTown=allowedMap();

  exported.forEach(exportRow=>{
    if(!exportRow||(!includeExemptions&&isExceptionRow(exportRow)))return;
    const key=keyOf(spxTN(exportRow));
    if(!key)return;
    const rawStatus=String(badocRowMeta(exportRow)?.status||statusOf(exportRow)||"").trim();
    const normalized=statusNorm(rawStatus);
    if(!normalized)return;

    // Preserve Delivering / Delivered. Other statuses enter the On-Hold
    // bucket only when their Pick Up Time is today before 3:00 PM Manila time.
    const planningStatus=/(^|\s)DELIVERING$/.test(normalized)?"DELIVERING":
      /(^|\s)DELIVERED$/.test(normalized)?"DELIVERED":
      badocOnholdStatus(exportRow)?"ONHOLD":normalized;

    const existingIndex=rowIndexByTn.get(key);
    const existing=existingIndex===undefined?null:rows[existingIndex];
    // Use the shared row merger so blank fields from a newer SPX status export
    // cannot erase the original Pick Up Time used by the fixed 3:00 PM OnHold rule.
    const merged=mergeParcelRowsPreservingPickup(existing||{},exportRow);
    merged["Parcel Status To"]=planningStatus;
    // Keep the uploaded row's routing classification when one exists.
    if(existing?._area)merged._area=existing._area;
    else if(!merged._area){
      const town=norm(exportRow?.["Town Name"]??exportRow?.["Town"]??exportRow?.town??badocRowMeta(exportRow)?.town??"");
      const area=areaByTown[town];
      if(area)merged._area=area;
    }

    if(existingIndex===undefined){
      rowIndexByTn.set(key,rows.length);
      rows.push(merged);
    }else{
      rows[existingIndex]=merged;
    }
  });

  return rows;
}

// Parcel Records combines uploaded valid rows with the latest Assigned Today
// Forward/Return exports. Exports replace older rows by SPX TN while retaining
// their original status text for Records filters and the Status column.
function parcelRecordTnKey(row){
  // Use the explicit tracking-number column before any generic fallback.
  const aliases=["SLS Tracking Number","SPX TN","SPX TN/Tracking Number","SPX Tracking Number","SPX Tracking No","SPX Tracking No.","Tracking Number"];
  const wanted=new Set(aliases.map(name=>name.toUpperCase().replace(/[^A-Z0-9]/g,"")));
  for(const field of Object.keys(row||{})){
    const normalized=field.toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(wanted.has(normalized)&&String(row[field]??"").trim()){
      return badocOnholdKey(row[field]);
    }
  }
  return badocOnholdKey(spxTN(row));
}

function getParcelRecordRows(){
  const baseRows=Array.isArray(current?.valid)?current.valid:[];
  const records=[];
  const indexByTn=new Map();
  baseRows.forEach(row=>{
    const key=parcelRecordTnKey(row);
    if(key&&indexByTn.has(key)){
      records[indexByTn.get(key)]=row;
      return;
    }
    if(key)indexByTn.set(key,records.length);
    records.push(row);
  });

  const exports=Array.isArray(window.__badocOnholdExportRows)
    ?window.__badocOnholdExportRows
    :badocLoadOnholdExportRows();
  const areaByTown=allowedMap();
  const allowedStations=new Set(["BADOC HUB","SOC 6","CAGAYAN DC"]);

  exports.forEach(exportRow=>{
    if(!exportRow||isExceptionRow(exportRow))return;
    const key=parcelRecordTnKey(exportRow);
    if(!key)return;
    const meta=badocRowMeta(exportRow);
    // Match the existing Parcel Records valid-record scope.
    if(meta.destination!=="BADOC HUB"||!allowedStations.has(meta.station))return;
    const area=areaByTown[meta.town];
    if(!area)return;

    const existingIndex=indexByTn.get(key);
    const existing=existingIndex===undefined?null:records[existingIndex];
    const merged={...(existing||{}),...exportRow,_area:existing?existing._area:area};
    ["SLS Tracking Number","Order ID","Town Name","Current Station","Destination Station","Zone"].forEach(field=>{
      if(!String(merged[field]??"").trim()&&String(existing?.[field]??"").trim()){
        merged[field]=existing[field];
      }
    });
    const rawStatus=String(exportRow?.["Status"]??exportRow?.["Parcel Status To"]??exportRow?.["Status To"]??"").trim();
    if(rawStatus){
      merged["Status"]=rawStatus;
      // This record-list copy is separate from the Planning Board ONHOLD mapping.
      merged["Parcel Status To"]=rawStatus;
    }
    if(existingIndex===undefined){
      indexByTn.set(key,records.length);
      records.push(merged);
    }else{
      records[existingIndex]=merged;
    }
  });
  return records;
}

let parcelUploadStatusOpen=false;
function toggleParcelUploadStatus(){
  parcelUploadStatusOpen=!parcelUploadStatusOpen;
  const el=$("parcelUploadStatus");
  if(!el)return;
  el.classList.toggle("is-open",parcelUploadStatusOpen);
  const btn=el.querySelector(".pus-toggle");
  if(btn)btn.setAttribute("aria-expanded",String(parcelUploadStatusOpen));
}
function renderParcelUploadStatus(){
  const el=$("parcelUploadStatus");
  if(!el)return;
  const items=Array.isArray(batches)?batches:[];
  const countFiles=items.length.toLocaleString();
  const head=`<button type="button" class="pus-toggle" onclick="toggleParcelUploadStatus()" aria-expanded="${parcelUploadStatusOpen}">
      <span class="pus-head"><span>UPLOAD STATUS</span><span class="pus-total">${countFiles} FILE${items.length===1?"":"S"}</span></span>
      <span class="pus-chevron">▼</span>
    </button>`;
  if(!items.length){
    el.innerHTML=head+`<div class="pus-body"><div class="pus-empty">No parcel export uploaded.</div></div>`;
  }else{
    el.innerHTML=head+`<div class="pus-body">`+items.map(b=>{
      const file=esc(b?.name||"Exported file");
      const count=Array.isArray(b?.rows)?b.rows.length:0;
      const when=b?.time?new Date(b.time).toLocaleString():"";
      const dupes=Number(b?.duplicates||0);
      return `<div class="pus-row">
        <span class="pus-file" title="${file}">📄 ${file}</span>
        <span class="pus-meta">${count.toLocaleString()} unique · ${dupes.toLocaleString()} duplicate${dupes===1?"":"s"}</span>
        <span class="pus-ok">UPLOADED</span>
        <span class="pus-meta">${esc(when)}</span>
      </div>`;
    }).join("")+`</div>`;
  }
  el.classList.toggle("is-open",parcelUploadStatusOpen);
}

const PARCEL_INCOMING_KEY="badoc_parcel_incoming_linehaul_v1";
const PARCEL_INCOMING_PREF_TABLE="badoc_dashboard_preferences";
let parcelIncomingPrefChannel=null,parcelIncomingPrefPulling=false,parcelIncomingPrefWritePending=false;
function parcelIncomingEnabled(){
 try{return localStorage.getItem(PARCEL_INCOMING_KEY)==="1"}catch(e){return false}
}
function applyParcelIncomingPreference(enabled){
 const value=enabled===true;
 try{localStorage.setItem(PARCEL_INCOMING_KEY,value?"1":"0")}catch(e){}
 updateParcelIncomingButton();
 if(typeof render==="function")render();
}
async function parcelIncomingPreferenceClient(){
 const cfg=window.BADOC_SHARED_CONFIG||{};
 if(!window.BadocCloud||!cfg.url||!cfg.key)throw Error("Shared cloud configuration is unavailable");
 return window.BadocCloud.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
window.__badocSyncParcelIncomingPreference=async function(){
 if(parcelIncomingPrefPulling||parcelIncomingPrefWritePending)return false;
 parcelIncomingPrefPulling=true;
 try{
   const client=await parcelIncomingPreferenceClient();
   if(!parcelIncomingPrefChannel){
     parcelIncomingPrefChannel=client.channel("badoc-dashboard-preferences");
     parcelIncomingPrefChannel.on("broadcast",{event:"incoming-linehaul-setting"},()=>window.__badocSyncParcelIncomingPreference?.());
     parcelIncomingPrefChannel.subscribe();
   }
   const result=await client.from(PARCEL_INCOMING_PREF_TABLE).select("*").eq("id",1).maybeSingle();
   if(result.error)throw Error(result.error.message||"Incoming linehaul preference read failed");
   if(result.data){
     if(!parcelIncomingPrefWritePending&&typeof result.data.incoming_linehaul_enabled==="boolean")applyParcelIncomingPreference(result.data.incoming_linehaul_enabled);
   }else{
     // First device initializes the shared value from its current preference.
     const initial={id:1,incoming_linehaul_enabled:parcelIncomingEnabled(),updated_at:new Date().toISOString()};
     const created=await client.from(PARCEL_INCOMING_PREF_TABLE).insert(initial).select().maybeSingle();
     if(created.error&&!/duplicate key/i.test(created.error.message||""))throw Error(created.error.message||"Incoming linehaul preference initialization failed");
     let shared=created.data;
     if(!shared&&created.error){
       const retry=await client.from(PARCEL_INCOMING_PREF_TABLE).select("*").eq("id",1).maybeSingle();
       if(retry.error)throw Error(retry.error.message||"Incoming linehaul preference re-read failed");
       shared=retry.data;
     }
     if(!parcelIncomingPrefWritePending&&shared&&typeof shared.incoming_linehaul_enabled==="boolean")applyParcelIncomingPreference(shared.incoming_linehaul_enabled);
   }
   return true;
 }catch(e){console.warn("Incoming linehaul preference sync:",e);return false}
 finally{parcelIncomingPrefPulling=false}
};
async function saveParcelIncomingPreference(enabled){
 parcelIncomingPrefWritePending=true;
 try{
   const client=await parcelIncomingPreferenceClient();
   const result=await client.from(PARCEL_INCOMING_PREF_TABLE).upsert({id:1,incoming_linehaul_enabled:enabled===true,updated_at:new Date().toISOString()},{onConflict:"id"});
   if(result.error)throw Error(result.error.message||"Incoming linehaul preference save failed");
   if(!parcelIncomingPrefChannel){
     parcelIncomingPrefChannel=client.channel("badoc-dashboard-preferences");
     parcelIncomingPrefChannel.on("broadcast",{event:"incoming-linehaul-setting"},()=>window.__badocSyncParcelIncomingPreference?.());
     parcelIncomingPrefChannel.subscribe();
   }
   await parcelIncomingPrefChannel.send({type:"broadcast",event:"incoming-linehaul-setting",payload:{enabled:enabled===true,at:Date.now()}});
   const state=document.getElementById("parcelIncomingVolumeState");
   if(state)state.textContent=enabled?"Incoming linehaul included in totals and town counts · synced":"Incoming linehaul not included · synced";
   return true;
 }catch(e){
   console.warn("Incoming linehaul preference save failed:",e);
   const state=document.getElementById("parcelIncomingVolumeState");
   if(state)state.textContent="Preference saved on this device only; cloud sync failed";
   return false;
 }finally{parcelIncomingPrefWritePending=false}
}
function getParcelIncomingLinehaul(options={}){
  const includeExemptions=options?.includeExemptions===true;
  /*
    Parcel Count incoming Linehaul uses the same core logic as Today's Volume:
    - Match Linehaul Task SPX TNs to Parcel Records Order ID.
    - Count each SPX TN only once across all Linehaul Tasks.
    - Exemptions are excluded by default in ordinary Parcel Count views, but
      callers calculating Today's Volume can include them so the exemption
      list cannot reduce the daily operating-volume total.
    - Only count parcels whose matched Town Name belongs to the configured
      BADOC/PINILI town lists shown in Parcel Count.
    - Town counts use the same unique-SPX-TN set, so duplicates cannot inflate
      either the total or an individual town.
  */
  const tasks=Array.isArray(linehaulTasks)?linehaulTasks:[];
  const parcelRows=Array.isArray(current?.rows)
    ?current.rows
    :(Array.isArray(current?.valid)?current.valid:[]);
  const seen=new Set();
  const townCounts={};
  const incomingRows=[];
  const configuredTowns=new Set([
    ...(Array.isArray(towns?.badoc)?towns.badoc:[]),
    ...(Array.isArray(towns?.pinili)?towns.pinili:[])
  ].map(norm).filter(Boolean));
  const exceptionSet=typeof exceptionTrackingSet==="function"
    ?exceptionTrackingSet()
    :new Set();
  let total=0;
  const parcelOrderIndex=buildLinehaulParcelOrderIndex(parcelRows);

  tasks.forEach(task=>{
    if(!task||task.blank||task.cleared||!String(task.id||"").trim())return;
    // Only linehauls marked as arriving in time contribute to incoming volume
    // in both Dashboard and Planning Board. Unchecked tasks remain visible in
    // Linehaul Task for monitoring, but do not add to the incoming volume.
    if(task.arrivingInTime!==true)return;

    const breakdown=typeof linehaulTownBreakdown==="function"
      ?linehaulTownBreakdown(task,parcelRows,parcelOrderIndex)
      :{};

    Object.entries(breakdown).forEach(([town,group])=>{
      const townKey=norm(town);
      if(!townKey||!configuredTowns.has(townKey))return;

      (group?.items||[]).forEach(item=>{
        const er=item?.x||{};
        const parcel=item?.r||{};
        const raw=er?.spxTN ?? er?.["SPX TN"] ?? er?.["SPX Tracking Number"] ?? "";
        const tn=normJoin(raw);
        if(!tn||seen.has(tn))return;

        // Match the same exception rule used by Parcel Count. Check the
        // matched Parcel Record itself and the Linehaul SPX TN key.
        if(!includeExemptions&&
           ((typeof isExceptionRow==="function"&&isExceptionRow(parcel)) ||
            exceptionSet.has(typeof tnKey==="function"?tnKey(tn):tn))) return;

        seen.add(tn);
        incomingRows.push(parcel);
        total++;
        townCounts[townKey]=(townCounts[townKey]||0)+1;
      });
    });
  });

  return {total,townCounts,rows:incomingRows};
}
function updateParcelIncomingButton(){
 const btn=$("parcelIncomingVolumeBtn"),state=$("parcelIncomingVolumeState");
 if(!btn)return;
 const on=parcelIncomingEnabled();
 btn.classList.toggle("active",on);btn.setAttribute("aria-pressed",String(on));
 btn.textContent=on?"✓ Incoming linehaul included":"＋ Add incoming linehaul";
 if(state)state.textContent=on?"Incoming linehaul included in totals and town counts":"Incoming linehaul not included";
}

function render(){
 const v=getParcelCountRows(),m=current?.mis||[];
 const badoc=v.filter(x=>x._area==="Badoc");
 const pinili=v.filter(x=>x._area==="Pinili");
 const incoming=parcelIncomingEnabled()?getParcelIncomingLinehaul():{total:0,townCounts:{},rows:[]};
 window.__badocParcelIncomingMetricRows=Array.isArray(incoming.rows)?incoming.rows:[];
 const allMetricRows=[...badoc,...pinili,...window.__badocParcelIncomingMetricRows];
 const metricTotals=parcelMetricSummary(allMetricRows);
 const badocTownSet=new Set((towns.badoc||[]).map(x=>String(x||"").trim().toUpperCase()));
 const piniliTownSet=new Set((towns.pinili||[]).map(x=>String(x||"").trim().toUpperCase()));
 const incomingBadocRows=window.__badocParcelIncomingMetricRows.filter(r=>badocTownSet.has(String(r?.["Town Name"]??r?.["Town"]??"").trim().toUpperCase()));
 const incomingPiniliRows=window.__badocParcelIncomingMetricRows.filter(r=>piniliTownSet.has(String(r?.["Town Name"]??r?.["Town"]??"").trim().toUpperCase()));
 const badocMetric=parcelMetricSummary([...badoc,...incomingBadocRows]);
 const piniliMetric=parcelMetricSummary([...pinili,...incomingPiniliRows]);
 const misMetric=parcelMetricSummary(m);
 const badocIncoming=Object.entries(incoming.townCounts).reduce((n,[town,c])=>n+((towns.badoc||[]).some(x=>norm(x)===town)?c:0),0);
 const piniliIncoming=Object.entries(incoming.townCounts).reduce((n,[town,c])=>n+((towns.pinili||[]).some(x=>norm(x)===town)?c:0),0);
 $("badocTotal").textContent=(badoc.length+badocIncoming).toLocaleString();
 $("piniliTotal").textContent=(pinili.length+piniliIncoming).toLocaleString();
 const areaRate=(rows)=>{const sc=townStatusCounts(rows);let r=0,d=0,g=0,h=0;Object.values(sc).forEach(x=>{r+=x.received;d+=x.delivered;g+=x.delivering;h+=x.hold});const den=r+d+g+h;return den?d/den*100:0};
 const fmtRate=x=>x%1===0?x.toFixed(0):x.toFixed(1);
 const br=$("badocSuccessRate"),pr=$("piniliSuccessRate");
 if(br)br.textContent=`SR ${fmtRate(areaRate(badoc))}%`;
 if(pr)pr.textContent=`SR ${fmtRate(areaRate(pinili))}%`;
 $("total").textContent=(badoc.length+pinili.length+incoming.total).toLocaleString();
 if($("bulkyTotal"))$("bulkyTotal").textContent=metricTotals.bulky.toLocaleString();
 if($("highValueTotal"))$("highValueTotal").textContent=metricTotals.highValue.toLocaleString();
 if($("totalMetricDesc"))$("totalMetricDesc").textContent=`Bulky ${metricTotals.bulky.toLocaleString()} • High Value ${metricTotals.highValue.toLocaleString()}`;
 if($("badocMetricDesc"))$("badocMetricDesc").textContent=`Bulky ${badocMetric.bulky.toLocaleString()} • High Value ${badocMetric.highValue.toLocaleString()}`;
 if($("piniliMetricDesc"))$("piniliMetricDesc").textContent=`Bulky ${piniliMetric.bulky.toLocaleString()} • High Value ${piniliMetric.highValue.toLocaleString()}`;
 if($("misMetricDesc"))$("misMetricDesc").textContent=`Bulky ${misMetric.bulky.toLocaleString()} • High Value ${misMetric.highValue.toLocaleString()}`;
 $("misTotal").textContent=m.length;
 const ms=$("misroutedSideCount"); if(ms)ms.textContent=m.length;
 renderTownGrid("badocGrid",towns.badoc,badoc,incoming.townCounts);
 renderTownGrid("piniliGrid",towns.pinili,pinili,incoming.townCounts);
 window.__badocRenderDashboardRiderSummary?.();
 if(document.getElementById("actualScannedByRiders")?.classList.contains("active"))window.__badocRenderActualScannedByRiders?.();
 updateParcelIncomingButton();
 $("batchLabel").textContent="";
 renderRecords();renderMis();renderHistory();renderTownEdits();renderParcelUploadStatus();window.updateOperationProgress?.()
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function renderHistory(){
  const list=document.getElementById("historyGrid");
  if(!list)return;
  const items=Array.isArray(batches)?batches:[];
  if(!items.length){
    list.innerHTML='<div class="hint" style="padding:10px 2px">No uploads yet.</div>';
    return;
  }
  list.innerHTML=items.map(x=>{
    const file=esc(x?.name||"Exported file");
    const by=esc(x?.uploadedBy||"Unknown");
    const when=x?.time?new Date(x.time).toLocaleString():"";
    return `<details class="upload-history-item">
      <summary class="upload-history-summary">
        <span class="upload-history-file">📄 ${file}</span>
        <span class="upload-history-time">${esc(when)}</span>
      </summary>
      <div class="upload-history-detail"><b>Uploaded by:</b> ${by}</div>
    </details>`;
  }).join("");
}

function selectedValues(id){
  const el=$(id); if(!el)return [];
  return [...el.selectedOptions].map(o=>String(o.value||"").trim()).filter(Boolean);
}
function recordStatusValue(r){
  // Assigned Today rows retain the exact status from the SPX export.
  if(r?._onholdExportSource){
    const raw=String(r?.["Status"]??r?.["Parcel Status To"]??r?.["Status To"]??"").trim();
    if(raw)return raw;
  }
  return badocRowMeta(r).status;
}
function recordMatches(rows,q,filters,ignore){
  const list=Array.isArray(rows)?rows:[];
  if(!q){
    const idx=badocRowIndex(list);
    let sets=[];
    if(ignore!=="town"&&filters.town.length)sets.push(new Set(filters.town.flatMap(v=>[...(idx.town.get(norm(v))||[])])));
    if(ignore!=="station"&&filters.station.length)sets.push(new Set(filters.station.flatMap(v=>[...(idx.station.get(norm(v))||[])])));
    if(ignore!=="status"&&filters.status.length)sets.push(new Set(filters.status.flatMap(v=>[...(idx.status.get(norm(v))||[])])));
    if(sets.length){
      sets.sort((a,b)=>a.size-b.size);
      return [...sets[0]].filter(r=>sets.every(set=>set.has(r)));
    }
    return list;
  }
  return list.filter(r=>{
    const meta=badocRowMeta(r);
    const searchable=[r["SLS Tracking Number"],r["Order ID"],r["Town Name"],r["SPX TN"],
      r["SPX TN/Tracking Number"],r["Tracking Number"],r["Current Station"],
      r["Destination Station"],r["Status"],r["Zone"],meta.tn].map(norm);
    if(!searchable.some(x=>x.includes(q)))return false;
    if(ignore!=="town"&&filters.town.length&&!filters.town.some(v=>norm(v)===meta.town))return false;
    if(ignore!=="station"&&filters.station.length&&!filters.station.some(v=>norm(v)===meta.station))return false;
    if(ignore!=="status"&&filters.status.length&&!filters.status.some(v=>norm(v)===meta.status))return false;
    return true;
  });
}
function refreshRecordFilterCounts(){
  if(parcelFilterIsLocked())return;
  const rows=typeof getParcelRecordRows==="function"?getParcelRecordRows():((current&&Array.isArray(current.valid))?current.valid:[]);
  const q=norm($("recordSearch")?.value||"");
  const filters={town:selectedValues("recordTown"),station:selectedValues("recordStation"),status:selectedValues("recordStatus")};
  const build=(id,key,ignore)=>{
    const el=$(id); if(!el)return;
    const selected=new Set(selectedValues(id));
    const base=recordMatches(rows,q,filters,ignore);
    const counts=new Map();
    base.forEach(r=>{const v=id==="recordStatus"?recordStatusValue(r):String(r?.[key]??"").trim();if(v)counts.set(v,(counts.get(v)||0)+1)});
    el.innerHTML="";
    [...counts.keys()].sort((a,b)=>a.localeCompare(b)).forEach(v=>{
      const o=document.createElement("option");
      o.value=v;o.textContent=v+" ("+counts.get(v).toLocaleString()+")";o.selected=selected.has(v);el.appendChild(o);
    });
  };
  build("recordTown","Town Name","town");
  build("recordStation","Current Station","station");
  build("recordStatus","Status","status");
  const n=filters.town.length+filters.station.length+filters.status.length;
  const hint=$("recordFilterHint");
  if(hint)hint.textContent=n?`${n} filter value${n===1?"":"s"} selected · counts reflect the other active filters`:"";
}

let sharedFilterSyncChannel=null;
let sharedFilterSyncApplying=false;
let sharedFilterSyncTimer=null;
let sharedFilterSyncClient=null;
let sharedFilterSyncReady=false;
let sharedFilterSyncPending=null;
let sharedFilterPollTimer=null;
let sharedFilterRealtimeReady=false;
let sharedFilterPollInFlight=null;
let sharedFilterLastUpdatedAt="";

function sharedFilterState(){
  return {
    search:String($("recordSearch")?.value||""),
    town:selectedValues("recordTown"),
    station:selectedValues("recordStation"),
    status:selectedValues("recordStatus")
  };
}
function applySharedFilterState(state){
  if(parcelFilterIsLocked()&&!sharedFilterSyncApplying)return;
  state=state||{search:"",town:[],station:[],status:[]};
  const apply=()=>{
    const els=["recordTown","recordStation","recordStatus"].map($);
    if(els.some(e=>!e||!e.options.length))return false;
    sharedFilterSyncApplying=true;
    try{
      if($("recordSearch"))$("recordSearch").value=String(state.search||"");
      [["recordTown",state.town||[]],["recordStation",state.station||[]],["recordStatus",state.status||[]]].forEach(([id,vals])=>{
        const el=$(id),wanted=new Set((Array.isArray(vals)?vals:[]).map(String));
        [...el.options].forEach(o=>o.selected=wanted.has(String(o.value)));
      });
      sharedFilterSyncPending=null;
      window.__parcelRecordPage=1;
      renderRecords(true);
      if(window.syncCustomParcelFilters) window.syncCustomParcelFilters();
    }finally{sharedFilterSyncApplying=false}
    return true;
  };
  if(!apply()){
    sharedFilterSyncPending=state;
    let tries=0;
    const wait=()=>{
      if(!sharedFilterSyncPending||tries++>30)return;
      if(!apply())setTimeout(wait,500);
    };
    setTimeout(wait,100);
  }
}
async function publishSharedFilterState(){
  if(sharedFilterSyncApplying||!sharedFilterSyncClient||!sharedFilterSyncReady)return;
  const editSeq=sharedFilterLocalEditSeq;
  const state=sharedFilterState();
  sharedFilterPublishChain=sharedFilterPublishChain.then(async()=>{
    // If the user changed the filter while an older publish was waiting,
    // publish the newest state instead of the stale captured state.
    const latestState=editSeq===sharedFilterLocalEditSeq?state:sharedFilterState();
    try{
      const updated=new Date().toISOString();
      const r=await sharedFilterSyncClient.from("shared_filter_state").upsert(
        {id:"global",state:latestState,updated_at:updated},{onConflict:"id"}
      );
      if(r.error)throw r.error;
      sharedFilterLastUpdatedAt=updated;
      if(sharedFilterSyncChannel){
        await sharedFilterSyncChannel.send({type:"broadcast",event:"badoc-filter",payload:{state:latestState,updated_at:updated}});
      }
    }catch(e){console.warn("Shared filter publish failed:",e)}
  });
  await sharedFilterPublishChain;
}
function queueSharedFilterPublish(){
  if(sharedFilterSyncApplying)return;
  clearTimeout(sharedFilterSyncTimer);
  sharedFilterSyncTimer=setTimeout(publishSharedFilterState,250);
}
async function pollSharedFilterState(){
  if(sharedFilterRealtimeReady||!sharedFilterSyncClient||!sharedFilterSyncReady||sharedFilterSyncApplying)return;
  if(sharedFilterPollInFlight)return sharedFilterPollInFlight;
  sharedFilterPollInFlight=(async()=>{
    try{
      const r=await sharedFilterSyncClient.from("shared_filter_state")
        .select("state,updated_at").eq("id","global").maybeSingle();
      if(r.error)throw r.error;
      const u=String(r.data?.updated_at||"");
      if(r.data && u && u!==sharedFilterLastUpdatedAt){
        if(Date.now()-sharedFilterLastLocalEditAt<1200)return;
        sharedFilterLastUpdatedAt=u;
        applySharedFilterState(r.data.state||{search:"",town:[],station:[],status:[]});
      }
    }catch(e){console.warn("Shared filter fallback poll failed:",e)}
  })();
  try{return await sharedFilterPollInFlight}
  finally{sharedFilterPollInFlight=null}
}
function startSharedFilterPolling(){
  clearInterval(sharedFilterPollTimer);
  // Realtime notifications are immediate while connected. This is fallback-only.
  sharedFilterPollTimer=__badocEvery(pollSharedFilterState,30000);
  pollSharedFilterState();
}
async function startSharedFilterSync(){
  try{
    const cfg=window.BADOC_SHARED_CONFIG||{};
    if(!window.BadocCloud||!cfg.url||!cfg.key)throw Error("Shared cloud configuration unavailable");
    sharedFilterSyncClient=window.BadocCloud.createClient(cfg.url,cfg.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const r=await sharedFilterSyncClient.from("shared_filter_state")
      .select("state,updated_at").eq("id","global").maybeSingle();
    if(r.error)throw r.error;
    sharedFilterSyncReady=true;
    sharedFilterLastUpdatedAt=String(r.data?.updated_at||"");
    if(r.data?.state)applySharedFilterState(r.data.state);
    startSharedFilterPolling();

    sharedFilterSyncChannel=sharedFilterSyncClient.channel("badoc-global-filter-v3")
      .on("broadcast",{event:"badoc-filter"},({payload})=>{
        if(payload?.state&&!sharedFilterSyncApplying){
          if(Date.now()-sharedFilterLastLocalEditAt<1200)return;
          sharedFilterLastUpdatedAt=String(payload.updated_at||Date.now());
          applySharedFilterState(payload.state);
        }
      })
      .on("postgres_changes",
        {event:"*",schema:"public",table:"shared_filter_state",filter:"id=eq.global"},
        payload=>{
          if(payload?.new){
            if(Date.now()-sharedFilterLastLocalEditAt<1200)return;
            sharedFilterLastUpdatedAt=String(payload.new.updated_at||Date.now());
            if(!sharedFilterSyncApplying)applySharedFilterState(payload.new.state||{});
          }
        })
      .subscribe(status=>{
        sharedFilterRealtimeReady=status==="SUBSCRIBED";
        if(!sharedFilterRealtimeReady)pollSharedFilterState();
      });
  }catch(e){
    sharedFilterRealtimeReady=false;
    console.warn("Shared filter sync unavailable:",e);
  }
}

function recordFiltersActive(){
  const q=norm($("recordSearch")?.value||"");
  return !!q||["recordTown","recordStation","recordStatus"].some(id=>{
    const e=$(id); return e&&[...e.selectedOptions].some(o=>String(o.value||"").trim());
  });
}
function updateDashboardFromParcelFilters(){
  const all=typeof getParcelCountRows==="function"?getParcelCountRows():(Array.isArray(current?.valid)?current.valid:[]);
  const filtered=Array.isArray(window.__parcelRecordFiltered)?window.__parcelRecordFiltered:all;
  const active=recordFiltersActive();
  const rows=active?filtered:all;

  const total=$("total"), badoc=$("badocTotal"), pinili=$("piniliTotal"), mis=$("misTotal");
  const bc=rows.filter(r=>norm(r?._area)==="BADOC").length;
  const pc=rows.filter(r=>norm(r?._area)==="PINILI").length;
  const incoming=parcelIncomingEnabled()?getParcelIncomingLinehaul():{total:0,townCounts:{},rows:[]};
  window.__badocParcelIncomingMetricRows=Array.isArray(incoming.rows)?incoming.rows:[];
  const badocIncoming=Object.entries(incoming.townCounts).reduce((n,[town,c])=>n+((towns.badoc||[]).some(x=>norm(x)===town)?c:0),0);
  const piniliIncoming=Object.entries(incoming.townCounts).reduce((n,[town,c])=>n+((towns.pinili||[]).some(x=>norm(x)===town)?c:0),0);
  // TOTAL VOLUME includes all qualifying Parcel Count records, including
  // MISROUTED parcels whose status is Delivering, Delivered, or On-Hold.
  // BADOC/PINILI cards remain limited to their respective routed areas.
  if(total) total.textContent=(rows.length+incoming.total).toLocaleString();
  if(badoc) badoc.textContent=(bc+badocIncoming).toLocaleString();
  if(pinili) pinili.textContent=(pc+piniliIncoming).toLocaleString();
  const filterMetricTotals=parcelMetricSummary([...rows,...window.__badocParcelIncomingMetricRows]);
  const filterBadocSet=new Set((towns.badoc||[]).map(x=>String(x||"").trim().toUpperCase()));
  const filterPiniliSet=new Set((towns.pinili||[]).map(x=>String(x||"").trim().toUpperCase()));
  const filterBadocMetric=parcelMetricSummary([...rows.filter(r=>norm(r?._area)==="BADOC"),...window.__badocParcelIncomingMetricRows.filter(r=>filterBadocSet.has(String(r?.["Town Name"]??r?.["Town"]??"").trim().toUpperCase()))]);
  const filterPiniliMetric=parcelMetricSummary([...rows.filter(r=>norm(r?._area)==="PINILI"),...window.__badocParcelIncomingMetricRows.filter(r=>filterPiniliSet.has(String(r?.["Town Name"]??r?.["Town"]??"").trim().toUpperCase()))]);
  if($("bulkyTotal"))$("bulkyTotal").textContent=filterMetricTotals.bulky.toLocaleString();
  if($("highValueTotal"))$("highValueTotal").textContent=filterMetricTotals.highValue.toLocaleString();
  if($("totalMetricDesc"))$("totalMetricDesc").textContent=`Bulky ${filterMetricTotals.bulky.toLocaleString()} • High Value ${filterMetricTotals.highValue.toLocaleString()}`;
  if($("badocMetricDesc"))$("badocMetricDesc").textContent=`Bulky ${filterBadocMetric.bulky.toLocaleString()} • High Value ${filterBadocMetric.highValue.toLocaleString()}`;
  if($("piniliMetricDesc"))$("piniliMetricDesc").textContent=`Bulky ${filterPiniliMetric.bulky.toLocaleString()} • High Value ${filterPiniliMetric.highValue.toLocaleString()}`;
  const calcAreaRate=(areaRows)=>{const sc=townStatusCounts(areaRows);let r=0,d=0,g=0,h=0;Object.values(sc).forEach(x=>{r+=x.received;d+=x.delivered;g+=x.delivering;h+=x.hold});const den=r+d+g+h;return den?d/den*100:0};
  const fmtAreaRate=x=>x%1===0?x.toFixed(0):x.toFixed(1);
  const bsr=$("badocSuccessRate"),psr=$("piniliSuccessRate");
  if(bsr)bsr.textContent=`SR ${fmtAreaRate(calcAreaRate(rows.filter(r=>norm(r?._area)==="BADOC")))}%`;
  if(psr)psr.textContent=`SR ${fmtAreaRate(calcAreaRate(rows.filter(r=>norm(r?._area)==="PINILI")))}%`;

  const allMis=Array.isArray(current?.mis)?current.mis:[];
  const key=r=>norm(r?.["SLS Tracking Number"]||r?.["SLS Tracking"]||r?.["Tracking Number"]||r?.["Order ID"]||"");
  const keys=new Set(rows.map(key).filter(Boolean));
  const mc=active?allMis.filter(r=>keys.has(key(r))).length:allMis.length;
  const filterMisMetric=parcelMetricSummary(active?allMis.filter(r=>keys.has(key(r))):allMis);
  if(mis) mis.textContent=mc.toLocaleString();
  if($("misMetricDesc"))$("misMetricDesc").textContent=`Bulky ${filterMisMetric.bulky.toLocaleString()} • High Value ${filterMisMetric.highValue.toLocaleString()}`;

  [[total,"TOTAL VOLUME","FILTERED TOTAL VOLUME",rows.length],
   [badoc,"BADOC","FILTERED BADOC",bc],
   [pinili,"PINILI","FILTERED PINILI",pc],
   [mis,"MISROUTED","FILTERED MISROUTED",mc]].forEach(([el,normal,filteredLabel,n])=>{
    const k=el?.closest(".kpi"); if(!k)return;
    const l=k.querySelector(".lab"),d=k.querySelector(".desc");
    if(l)l.textContent=active?filteredLabel:normal;
    if(d){
      if(active){
        const id=el?.id;
        if(!["total","badocTotal","piniliTotal","misTotal"].includes(id)){
          d.textContent=`${n.toLocaleString()} matching records`;
        }
      }else if(["total","badocTotal","piniliTotal","misTotal"].includes(el?.id)){
        d.textContent="";
      }
    }
  });

  // Keep the original three-column structure while allowing the saved custom
  // town arrangement to control the group/card order.
  ["badocGrid","piniliGrid"].forEach(id=>{
    const list=id==="badocGrid"?(towns?.badoc||[]):(towns?.pinili||[]);
    const area=id==="badocGrid"?"BADOC":"PINILI";
    const areaRows=rows.filter(r=>norm(r?._area)===area);
    renderTownGrid(id,list,areaRows,incoming.townCounts);
    const grid=$(id);
    if(active&&grid){
      grid.querySelectorAll(".town-row").forEach(row=>{
        const n=Number(String(row.querySelector(".count")?.textContent||"0").replace(/,/g,""));
        row.style.display=n>0?"":"";
      });
    }
  });
}

function renderRecords(skipFilterOptionRefresh=false){
  if(!skipFilterOptionRefresh) refreshRecordFilterCounts();
  const allRows=typeof getParcelRecordRows==="function"?getParcelRecordRows():(Array.isArray(current?.valid)?current.valid:[]);
  const q=norm($("recordSearch")?.value||"");
  const filters={
    town:selectedValues("recordTown"),
    station:selectedValues("recordStation"),
    status:selectedValues("recordStatus")
  };
  const filtered=recordMatches(allRows,q,filters,null);
  window.__parcelRecordAllCount=allRows.length;
  window.__parcelRecordFiltered=filtered;
  window.__parcelRecordPage=1;
  $("recordMeta").textContent=`· ${filtered.length.toLocaleString()} matching of ${allRows.length.toLocaleString()} records`;
  updateDashboardFromParcelFilters();
  updateRecordExportButton();
  renderRecordPage();
}

function renderRecordPage(){
  const rows=Array.isArray(window.__parcelRecordFiltered)
    ?window.__parcelRecordFiltered:[];
  const pageSizeOptions=[20,50,100];
  const savedSize=Number(window.__parcelRecordPageSize)||20;
  const pageSize=pageSizeOptions.includes(savedSize)?savedSize:20;
  window.__parcelRecordPageSize=pageSize;
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
  const page=Math.max(1,Math.min(Number(window.__parcelRecordPage)||1,totalPages));
  window.__parcelRecordPage=page;

  const start=(page-1)*pageSize;
  const shown=rows.slice(start,start+pageSize);
  const cols=[
    "SLS Tracking Number","Order ID","Town Name","Current Station",
    "Destination Station","Status","Zone"
  ];

  if(!rows.length){
    $("recordTable").innerHTML=
      '<div class="empty">No matching records to show.</div>';
    return;
  }

  const first=start+1;
  const last=Math.min(start+shown.length,rows.length);
  const pageButtons=[];
  const lo=Math.max(1,page-2),hi=Math.min(totalPages,page+2);

  for(let i=lo;i<=hi;i++){
    pageButtons.push(
      `<button type="button" class="parcel-page-btn ${i===page?"active":""}" data-page="${i}">${i}</button>`
    );
  }

  $("recordTable").innerHTML=
    `<div class="tablewrap parcel-records-wrap">
      <table class="table parcel-records-table">
        <thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${shown.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="parcel-pagination" aria-label="Parcel record pagination">
      <div class="parcel-page-info">
        Showing <strong>${first.toLocaleString()}–${last.toLocaleString()}</strong>
        of <strong>${rows.length.toLocaleString()}</strong> matching
      </div>
      <div class="parcel-page-controls">
        <button type="button" class="parcel-page-btn" data-page="${page-1}" ${page<=1?"disabled":""}>‹</button>
        ${pageButtons.join("")}
        <button type="button" class="parcel-page-btn" data-page="${page+1}" ${page>=totalPages?"disabled":""}>›</button>
      </div>
      <label class="parcel-page-size">Show
        <select aria-label="Parcels per page" id="parcelPageSize">
          ${pageSizeOptions.map(n=>`<option value="${n}" ${n===pageSize?"selected":""}>${n}</option>`).join("")}
        </select>
        <span>per page</span>
      </label>
      <div class="parcel-page-count">Page <strong>${page}</strong> of <strong>${totalPages}</strong></div>
    </div>`;

  $("parcelPageSize").onchange=()=>{
    const n=Number($("parcelPageSize").value);
    if(!pageSizeOptions.includes(n))return;
    window.__parcelRecordPageSize=n;
    window.__parcelRecordPage=1;
    renderRecordPage();
  };

  $("recordTable").querySelectorAll(".parcel-page-btn").forEach(btn=>{
    btn.onclick=()=>{
      const p=Number(btn.dataset.page);
      if(!Number.isInteger(p)||p<1||p>totalPages)return;
      window.__parcelRecordPage=p;
      renderRecordPage();
      const wrap=$("records")?.querySelector(".parcel-records-wrap");
      if(wrap)wrap.scrollTop=0;
    };
  });
}
function renderMis(){
 let v=current?.mis||[],q=norm($("misSearch").value);v=v.filter(r=>!q||norm(r["Town Name"]).includes(q)||norm(r["SLS Tracking Number"]).includes(q));
 $("misTable").innerHTML=table(v,true)
}
function table(rows,isMis){
 if(!rows.length)return `<div class="empty">No records to show.</div>`;
 let cols=["SLS Tracking Number","Order ID","Town Name","Current Station","Destination Station","Status","Zone"];
 return `<div class="tablewrap"><table class="table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0,2000).map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${rows.length>2000?`<div class="hint">Showing first 2,000 rows.</div>`:""}`
}
function renderTownEdits(){
 [["badoc","badocEdit"],["pinili","piniliEdit"]].forEach(([key,id])=>{$(id).innerHTML=towns[key].map((x,i)=>x[0]?`<div class="town-edit"><span>${esc(x[0])}</span><button onclick="removeTown('${key}',${i})">Remove</button></div>`:`<div class="town-edit"><span style="color:#555">— spacing —</span><button onclick="removeTown('${key}',${i})">Remove</button></div>`).join("")})
}
function addTown(key){let n=prompt("Town name:");if(n&&n.trim()){towns[key].push([n.trim().toUpperCase()]);saveTownSettings();render()}}
function removeTown(key,i){if(role!=="Admin")return alert("Admin only.");if(confirm("Remove this town/spacing row?")){towns[key].splice(i,1);saveTownSettings();render()}}
function loadBatch(i){current=batches[i];render();showPage("dashboard")}
async function deleteBatch(i){if(role!=="Admin")return alert("Admin only.");if(confirm("Delete this upload permanently from this browser?")){batches.splice(i,1);current=mergeAllBatches();saveTownSettings();render()}}
function download(name,text,type="text/csv"){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function csv(rows){if(!rows.length)return "";let keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))].filter(k=>k!="_area");let q=x=>`"${String(x??"").replace(/"/g,'""')}"`;return [keys.map(q).join(","),...rows.map(r=>keys.map(k=>q(r?.[k])).join(","))].join("\n")}
let ridersData=[];
const ridersFields=["Driver ID","Driver Name","Person ID","Gender","LSP Driver","Vehicle Type","Service Point Name","License Type","License Number","Plate Number","Pickup Station ID","Line Haul Station ID","Delivery Station ID","Return Station ID","Sort Code List","Create Time","Modify Time","License Expiry Date","Contract Type","Employee ID","Distance Coverage","Route Expertise","Default Rate","New Rate","Joined Date","Last Date","Effective Start","ShopeePay Account","Agency","Driver Group","Pickup Station Shift ID","Line Haul Station Shift ID","Delivery Station Shift ID","Return Station Shift ID","LSP Status","SPX Status","Suspension Reason","Terminated Reason","Trip Handover Level","Collect SF/COD channel","Settle SF/COD channel","Feeder Mode","AT Level Handover","Allow Feeders to Self-trigger Transferred Status","Zone","Parcel Transfer","Linked Account With Shopee","Calculated Rating","Number of Rating Received","Push Driver Photo To Frontend","(Driver-Station) Allow Driver to perform Bulk Handover","(Driver-Driver) Allow Driver to perform Bulk Handover","Blocklist","Pickup sub-function(use ',' as separator)"];
function parseCsvText(text){
  const lines=[]; let row=[]; let cell=""; let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell="";}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()!==''))lines.push(row);row=[];cell="";}
    else cell+=c;
  }
  if(cell!==''||row.length){row.push(cell);if(row.some(v=>String(v).trim()!==''))lines.push(row);}
  if(!lines.length)return [];
  const hdr=lines[0].map(v=>String(v).replace(/^\uFEFF/,''));
  return lines.slice(1).map(r=>{const o={};hdr.forEach((h,i)=>o[h]=r[i]??'');return o;});
}
function riderNorm(v){return String(v??'').trim().toUpperCase();}
function renderRiders(){
  // Rider records can arrive after the town grid's first render. Refresh the
  // grid only when its active roster changes; do not touch saved town notes.
  const activeRosterSignature=badocActiveRiderRosterSignature();
  if(window.__badocTownGridRosterSignature!==activeRosterSignature){
    window.__badocTownGridRosterSignature=activeRosterSignature;
    BADOC_TOWN_GRID_RENDER_CACHE.clear();
  }
  window.__badocRenderDashboardRiderSummary?.();
  if(document.getElementById("actualScannedByRiders")?.classList.contains("active"))window.__badocRenderActualScannedByRiders?.();
  // Rider data can finish loading after the town cards were first rendered.
  // Refresh assigned-name labels without changing the saved rider-name values.
  const riderLabelKey=v=>riderNorm(v).replace(/[\\s_-]+/g,"");
  const riderVehicleLabel=v=>{const k=riderLabelKey(v);if(k==="2WH"||k==="2W")return "2WH";if(k==="3WH"||k==="3WC"||k==="3W")return "3WH";if(k==="FLEXI"||k==="FLEX")return "Flexi";return "";};
  const riderByName=new Map();
  (Array.isArray(ridersData)?ridersData:[]).forEach(r=>{const k=riderLabelKey(r["Driver Name"]);if(k&&!riderByName.has(k))riderByName.set(k,r);});
  document.querySelectorAll(".town-rider-input").forEach(input=>{
    const name=String(input.dataset.selectedRiderName||"").trim();
    if(!name||document.activeElement===input)return;
    const record=riderByName.get(riderLabelKey(name));
    const vehicle=record&&riderVehicleLabel(record["Vehicle Type"]);
    input.value=vehicle?name+" ("+vehicle+")":name;
  });
  const q=riderNorm($("ridersSearch")?.value);
  const veh=$("ridersVehicle")?.value||"", stat=$("ridersStatus")?.value||"";
  const activeOnly=$("ridersActiveOnly")?.checked!==false;
  const filtered=ridersData.filter(r=>{
    if(activeOnly&&riderNorm(r["SPX Status"])!=="ACTIVE")return false;
    if(veh&&String(r["Vehicle Type"]||'')!==veh)return false;
    if(stat&&String(r["SPX Status"]||'')!==stat)return false;
    if(!q)return true;
    return [r["Driver ID"],r["Driver Name"],r["Person ID"],r["Plate Number"],r["Agency"],r["Driver Group"],r["Service Point Name"],r["Vehicle Type"]].some(v=>riderNorm(v).includes(q));
  });

  const PAGE_SIZE=20;
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  let page=Number(window.__badocRidersPage||1);
  if(!Number.isInteger(page)||page<1)page=1;
  if(page>totalPages)page=totalPages;
  window.__badocRidersPage=page;

  const meta=$("ridersMeta");
  if(meta)meta.textContent=`(${filtered.length} of ${ridersData.length})`;

  const summary=$("ridersSummary");
  if(summary){
    const activeRiders=ridersData.filter(r=>riderNorm(r["SPX Status"])==='ACTIVE');
    const vehicleNorm=v=>riderNorm(v).replace(/[^A-Z0-9]/g,'');
    const total=activeRiders.length;
    const flexi=activeRiders.filter(r=>vehicleNorm(r["Vehicle Type"])==='FLEXI').length;
    const two=activeRiders.filter(r=>vehicleNorm(r["Vehicle Type"])==='2WH' || vehicleNorm(r["Vehicle Type"])==='2W').length;
    const three=activeRiders.filter(r=>vehicleNorm(r["Vehicle Type"])==='3WC' || vehicleNorm(r["Vehicle Type"])==='3W').length;
    summary.innerHTML=`<div class="kpi"><div class="num">${total}</div><div class="lab">TOTAL RIDERS</div></div><div class="kpi"><div class="num">${three}</div><div class="lab">3W</div></div><div class="kpi"><div class="num">${two}</div><div class="lab">2W</div></div><div class="kpi"><div class="num">${flexi}</div><div class="lab">FLEXI</div></div>`;
  }

  const table=$("ridersTable");if(!table)return;
  const cols=["Driver ID","Driver Name","Vehicle Type","Plate Number","Agency","Driver Group","LSP Status","SPX Status","Service Point Name","Zone","Calculated Rating","Number of Rating Received"];
  table.querySelector("thead").innerHTML=`<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`;

  const startIndex=(page-1)*PAGE_SIZE;
  const pageRows=filtered.slice(startIndex,startIndex+PAGE_SIZE);
  table.querySelector("tbody").innerHTML=pageRows.map(r=>`<tr>${cols.map(c=>`<td>${String(r[c]??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}" style="text-align:center;padding:20px">No riders found.</td></tr>`;

  const pag=$("ridersPagination");
  if(pag){
    if(!filtered.length || totalPages<=1){
      pag.innerHTML=filtered.length?`<span class="hint">Showing ${filtered.length} rider${filtered.length===1?'':'s'}</span>`:'';
    }else{
      const from=startIndex+1;
      const to=Math.min(startIndex+PAGE_SIZE,filtered.length);
      const maxButtons=7;
      let pages=[];
      if(totalPages<=maxButtons){
        pages=Array.from({length:totalPages},(_,i)=>i+1);
      }else{
        const candidates=new Set([1,totalPages,page,page-1,page+1]);
        if(page<=4){[2,3,4,5].forEach(x=>candidates.add(x));}
        else if(page>=totalPages-3){[totalPages-4,totalPages-3,totalPages-2,totalPages-1].forEach(x=>candidates.add(x));}
        pages=[...candidates].filter(x=>x>=1&&x<=totalPages).sort((a,b)=>a-b);
      }
      let html=`<button type="button" class="btn riders-page-btn" data-riders-page="${page-1}" ${page===1?'disabled':''}>‹ Prev</button>`;
      let last=0;
      for(const n of pages){
        if(last && n-last>1)html+=`<span class="hint" style="padding:0 2px">…</span>`;
        html+=`<button type="button" class="btn riders-page-btn${n===page?' primary':''}" data-riders-page="${n}">${n}</button>`;
        last=n;
      }
      html+=`<button type="button" class="btn riders-page-btn" data-riders-page="${page+1}" ${page===totalPages?'disabled':''}>Next ›</button>`;
      html+=`<span class="hint" style="margin-left:6px">Showing ${from}-${to} of ${filtered.length}</span>`;
      pag.innerHTML=html;
      pag.querySelectorAll('[data-riders-page]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const target=Number(btn.dataset.ridersPage);
          if(!Number.isInteger(target)||target<1||target>totalPages||target===page)return;
          window.__badocRidersPage=target;
          renderRiders();
        });
      });
    }
  }
  window.__badocRenderDashboardRiderSummary?.();
}

function initRidersData(){
  const vs=$("ridersVehicle"), ss=$("ridersStatus");
  const vals=(field)=>[...new Set(ridersData.map(r=>String(r[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  if(vs){vs.innerHTML='<option value="">All</option>'+vals("Vehicle Type").map(v=>`<option>${v.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');vs.onchange=()=>{window.__badocRidersPage=1;renderRiders();};}
  if(ss){ss.innerHTML='<option value="">All</option>'+vals("SPX Status").map(v=>`<option>${v.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');ss.onchange=()=>{window.__badocRidersPage=1;renderRiders();};}
  if(!window.__badocRidersBound){window.__badocRidersBound=true;
  $("ridersSearch")?.addEventListener('input',()=>{window.__badocRidersPage=1;renderRiders();});
  $("ridersActiveOnly")?.addEventListener('change',()=>{window.__badocRidersPage=1;renderRiders();});
  $("ridersCsvFile")?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{ridersData=parseCsvText(await f.text());initRidersData();renderRiders();$("ridersHint").textContent=`Loaded ${ridersData.length} riders from ${f.name}.`; }catch(err){$("ridersHint").textContent='Unable to read the rider CSV.';console.error(err)}});
  $("clearAllRidersData")?.addEventListener('click',async()=>{
    const btn=$("clearAllRidersData");
    if(!confirm("Clear ALL Riders Data? This removes the uploaded rider list from this device and shared cloud storage. No built-in rider list will be restored. Rider selections and town assignments are not deleted."))return;
    if(btn)btn.disabled=true;
    try{
      ridersData=[];
      window.__badocRidersPage=1;
      const input=$("ridersCsvFile");if(input)input.value="";
      const search=$("ridersSearch");if(search)search.value="";
      const vehicle=$("ridersVehicle");if(vehicle)vehicle.value="";
      const status=$("ridersStatus");if(status)status.value="";
      initRidersData();
      renderRiders();
      const hint=$("ridersHint");
      if(hint)hint.textContent="All Riders Data cleared on this device. Saving the empty rider list to shared cloud storage… Upload a Riders CSV to add riders again.";
      if(window.__badocClearAllRidersDataShared){
        const shared=await window.__badocClearAllRidersDataShared();
        if(hint)hint.textContent=shared
          ?"All Riders Data cleared on this device and shared cloud storage. The rider table is now empty on all devices. Upload a Riders CSV to add riders again."
          :"Riders Data cleared on this device only. Shared cloud sync is not ready; reconnect and try again to clear it on all devices.";
      }else if(hint){
        hint.textContent="Riders Data cleared on this device only. Shared cloud sync is unavailable, so a reload may restore cloud data.";
      }
    }catch(err){
      console.error("Clear all Riders Data:",err);
      const hint=$("ridersHint");
      if(hint)hint.textContent="Riders Data is empty on this device, but the shared cloud could not be cleared ("+((err&&err.message)||"error")+"). Reconnect and press Clear All Rider Data again.";
    }finally{
      if(btn)btn.disabled=false;
    }
  });
  }
  renderRiders();
}
initRidersData();
function riderPerformanceNorm(value){return String(value??"").trim().toUpperCase().replace(/\s+/g," ")}
function riderPerformanceEsc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function riderPerformanceValue(row,names){
  const keys=Object.keys(row||{});
  for(const name of names){const found=keys.find(key=>riderPerformanceNorm(key)===riderPerformanceNorm(name));if(found&&String(row[found]??"").trim())return String(row[found]).trim();}
  for(const name of names){const wanted=riderPerformanceNorm(name);const found=keys.find(key=>riderPerformanceNorm(key).includes(wanted)||wanted.includes(riderPerformanceNorm(key)));if(found&&String(row[found]??"").trim())return String(row[found]).trim();}
  return "";
}
function riderPerformanceAmount(value){const parsed=Number(String(value??"").replace(/[^0-9.-]/g,""));return Number.isFinite(parsed)?parsed:0}
function renderRiderPerformance(){
  const body=$("riderPerformanceTableBody");if(!body)return;
  const rows=Array.isArray(current?.rows)?current.rows:[];
  const byId=new Map(),byName=new Map();
  (Array.isArray(ridersData)?ridersData:[]).forEach(r=>{const id=String(r["Driver ID"]||"").trim(),name=String(r["Driver Name"]||"").trim();if(id)byId.set(id,r);if(name)byName.set(riderPerformanceNorm(name),r);});
  const grouped=new Map();
  const onholdKeys=window.__badocOnholdTnKeys instanceof Set?window.__badocOnholdTnKeys:new Set();
  rows.forEach(row=>{
    const riderId=riderPerformanceValue(row,["Rider ID","Driver ID","Assigned Rider ID","Delivery Rider ID"]);
    const riderName=riderPerformanceValue(row,["Rider Name","Driver Name","Assigned Rider","Delivery Rider","Rider"]);
    const rider=byId.get(riderId)||byName.get(riderPerformanceNorm(riderName));
    const resolvedId=riderId||String(rider?.["Driver ID"]||"").trim();
    const resolvedName=riderName||String(rider?.["Driver Name"]||"").trim();
    if(!resolvedId&&!resolvedName)return;
    const key=resolvedId||riderPerformanceNorm(resolvedName);
    if(!grouped.has(key))grouped.set(key,{id:resolvedId,name:resolvedName,rider,parcels:0,delivered:0,onHold:0,cod:0,pickup:""});
    const item=grouped.get(key);item.parcels++;item.cod+=riderPerformanceAmount(riderPerformanceValue(row,["COD Amount","COD","Cash on Delivery","COD Collection Amount","Collect COD"]));
    const status=riderPerformanceNorm(riderPerformanceValue(row,["Status","Parcel Status","Delivery Status","Current Status"]));if(status.includes("DELIVERED"))item.delivered++;const tn=spxTN(row);if(tn&&onholdKeys.has(badocOnholdKey(tn)))item.onHold++;
    const pickup=riderPerformanceValue(row,["Pickup Time","Pickup Date Time","Pickup Datetime","Pickup Timestamp","First Pickup Time"]);if(pickup&&(!item.pickup||pickup<item.pickup))item.pickup=pickup;
  });
  const search=riderPerformanceNorm($("riderPerformanceSearch")?.value);
  const items=[...grouped.values()].map(item=>({
    ...item,
    agency:String(item.rider?.["Agency"]||"").trim(),vehicle:String(item.rider?.["Vehicle Type"]||"").trim(),group:String(item.rider?.["Driver Group"]||"").trim()
  })).filter(item=>item.rider).filter(item=>!search||[item.id,item.name,item.agency,item.vehicle,item.group].some(value=>riderPerformanceNorm(value).includes(search))).sort((a,b)=>a.name.localeCompare(b.name));
  const totalCod=items.reduce((sum,item)=>sum+item.cod,0);
  $("riderPerformanceRiders").textContent=items.length.toLocaleString();$("riderPerformanceParcels").textContent=items.reduce((sum,item)=>sum+item.parcels,0).toLocaleString();$("riderPerformanceCod").textContent="₱"+totalCod.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  body.innerHTML=items.length?items.map(item=>`<tr><td>${riderPerformanceEsc(item.id||"—")}</td><td>${riderPerformanceEsc(item.name||"—")}</td><td>${riderPerformanceEsc(item.agency||"—")}</td><td>${riderPerformanceEsc(item.vehicle||"—")}</td><td class="num">${item.parcels.toLocaleString()}</td><td class="num">${item.delivered.toLocaleString()}</td><td class="num">${item.onHold.toLocaleString()}</td><td class="num">₱${item.cod.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`).join(""):`<tr><td colspan="8" style="padding:18px;color:#9299a6;text-align:center">No rider fields were found in the Parcel Count uploads.</td></tr>`;
  $("riderPerformanceStatus").textContent=`PARCEL COUNT • ${rows.length.toLocaleString()} unique uploaded parcels • ${items.length.toLocaleString()} riders shown`;
}
$("riderPerformanceSearch")?.addEventListener("input",renderRiderPerformance);
// FIRST MILE — export through SPX Bridge and retain CSV files locally only.
(function(){
  const $=id=>document.getElementById(id);
  window.__badocFirstMileCloudVersions=window.__badocFirstMileCloudVersions||{orders:0,tasks:0};
  function updateFirstMileLastUpdated(){
    const target=$("firstMileLastUpdated");if(!target)return;
    const formatter=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"short",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
    const getTime=kind=>{
      const stamp=Number(window.__badocFirstMileCloudVersions?.[kind]||0);
      return Number.isFinite(stamp)&&stamp>0?formatter.format(new Date(stamp)):"Not yet synced";
    };
    const orders=getTime("orders");
    const tasks=getTime("tasks");
    target.textContent="Last updated across all devices (PHT) — Orders: "+orders+" · Tasks: "+tasks;
  }
  window.__badocUpdateFirstMileLastUpdated=updateFirstMileLastUpdated;
  let firstMileSequenceBusy=false;
  let firstMileNextStep="";
  async function startFirstMileSync(){
    const btn=$("syncFirstMileAll");if(firstMileSequenceBusy)return;
    if(!(await window.__badocEnsureSpxBridge?.()))return;
    firstMileSequenceBusy=true;firstMileNextStep="orders";
    if(btn){btn.disabled=true;btn.dataset.busy="1";}
    $("firstMileOverallStatus").textContent="Step 1 of 2 · Exporting Pickup Orders…";
    $("firstMileOrdersStatus").textContent="Connecting to SPX…";
    window.__badocOperationModalStart?.("Sync Pickup Orders + Tasks","Step 1 of 2: requesting Pickup Orders. Pickup Tasks will follow and supply Driver Name only.");
    postBadocSpxMessage("BADOC_START_FIRST_MILE_ORDERS_SYNC",{selectedDate:getBadocManilaDayBounds().date});
  }
  window.__badocFirstMileSequenceResult=function(kind,success,message){
    const btn=$("syncFirstMileAll");
    if(kind==="orders"&&success){
      firstMileNextStep="tasks";
      $("firstMileOverallStatus").textContent="Step 2 of 2 · Orders saved. Exporting Pickup Tasks for rider names…";
      window.__badocOperationModalUpdate?.("Pickup Orders saved. Now requesting Pickup Tasks to match Driver Name by Pickup Point ID…");
      postBadocSpxMessage("BADOC_START_FIRST_MILE_TASKS_SYNC",{selectedDate:getBadocManilaDayBounds().date});
      return;
    }
    firstMileSequenceBusy=false;firstMileNextStep="";
    if(btn){btn.disabled=false;btn.dataset.busy="0";}
    $("firstMileOverallStatus").textContent=success
      ?(kind==="orders"?"Pickup Orders sync completed.":"Pickup Tasks sync completed · rider lookup refreshed.")
      :`Pickup ${kind==="orders"?"Orders":"Tasks"} sync stopped: ${message||"export failed"}`;
    window.__badocRenderFirstMileCombined?.();
  };
  window.__badocFailFirstMileSequence=function(message){
    const kind=firstMileNextStep==="tasks"?"tasks":"orders";
    window.__badocFirstMileSequenceResult?.(kind,false,message||"First Mile sync failed.");
    const btn=$("syncFirstMileAll");if(btn){btn.disabled=false;btn.dataset.busy="0";}
  };
  $("syncFirstMileAll")?.addEventListener("click",startFirstMileSync);
  function download(kind){
    const orders=kind==="orders";
    const key=orders?"badoc_first_mile_orders_csv_local_v1":"badoc_first_mile_tasks_csv_local_v1";
    let record=null;try{record=JSON.parse(localStorage.getItem(key)||"null")}catch(_){}
    if(!record?.csvText)return;
    const blob=new Blob([record.csvText],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=record.fileName|| (orders?"first_mile_orders.csv":"first_mile_tasks.csv");
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function getStoredFirstMile(kind){
    const key=kind==="orders"?"badoc_first_mile_orders_csv_local_v1":"badoc_first_mile_tasks_csv_local_v1";
    try{const record=JSON.parse(localStorage.getItem(key)||"null");return record?.csvText?{record,rows:parseCsvText(record.csvText)}:null;}catch(_){return null;}
  }
  const fmNorm=value=>String(value??"").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  function fmHeader(row,aliases,pattern){
    const keys=Object.keys(row||{});const normalized=new Map(keys.map(k=>[fmNorm(k),k]));
    for(const alias of aliases){const key=normalized.get(fmNorm(alias));if(key)return key;}
    if(pattern){const found=keys.find(k=>pattern.test(fmNorm(k)));if(found)return found;}
    return "";
  }
  function fmValue(row,aliases,pattern){const key=fmHeader(row,aliases,pattern);return key?String(row[key]??"").trim():"";}
  function fmTaskStatusLabel(value){
    const key=fmNorm(value);
    const labels={pickupnoorder:"OnHold",accepted:"Assigned",disabled:"Cancelled",inbounded:"Inbounded"};
    return labels[key]||(key?String(value??"").trim():"Unassigned");
  }
  function fmLatestTask(group){
    const tasks=Array.isArray(group?.tasks)?group.tasks:[];
    if(!tasks.length)return null;
    let latest=tasks[0],latestTime=-Infinity;
    for(const task of tasks){
      const raw=fmValue(task,["Create Time","Created Time","Task Create Time","create_time","ctime"]);
      const parsed=raw?Date.parse(String(raw).replace(/\//g,"-")):NaN;
      const stamp=Number.isFinite(parsed)?parsed:-Infinity;
      if(stamp>=latestTime){latest=task;latestTime=stamp;}
    }
    return latest;
  }
  function fmTaskStatusBadgesHtml(group){
    const latest=fmLatestTask(group);
    if(!latest)return '<span class="fm-task-pill fm-task-unassigned">Unassigned</span>';
    const label=fmTaskStatusLabel(fmValue(latest,["Status","Task Status","Pickup Task Status","status_name","status"]));
    const key=fmNorm(label);
    const tone=({assigned:"assigned",cancelled:"cancelled",onhold:"onhold",inbounded:"inbounded",done:"done",unassigned:"unassigned"})[key]||"other";
    return `<span class="fm-task-pill fm-task-${tone}">${fmEsc(label)}</span>`;
  }
  function fmPickupPointId(row){
    // SPX exports can contain more than one "Pickup Point" column. Prefer the
    // actual PUP... identifier value instead of accidentally taking a numeric
    // internal point key (which prevents the task and order from joining).
    const entries=Object.entries(row||{});
    const candidates=entries.filter(([key,value])=>{
      const header=fmNorm(key);
      return /pickuppoint|servicepoint/.test(header)&&!/name|seller|shop/.test(header)&&String(value??"").trim();
    });
    const pup=candidates.find(([,value])=>/^PUP[0-9A-Z]+$/i.test(String(value??"").trim()));
    if(pup)return String(pup[1]).trim();
    const explicit= fmValue(row,[
      "Pickup Point ID","Pickup Point Id","Pickup Point Code","Pickup Point No",
      "Pickup Point Number","Point ID","point_id","pickup_point_id",
      "pickupPointId","service_point_id","service_point_code"
    ],/^(pickup)?point(id|code|no|number)?$|^servicepoint(id|code|no|number)?$/i);
    return explicit||fmValue(row,["Pickup Point"],/^pickuppoint$/i);
  }
  function fmPickupPointName(row){return fmValue(row,["Pickup Point Name","To Pickup Point Name","From Pickup Point Name","Pickup Point","Service Point Name","pickup_point_name","to_pickup_point_name","from_pickup_point_name","service_point_name","pickupPointName","toPickupPointName","fromPickupPointName"],/^(from|to)?pickuppointname$|^servicepointname$/i);}
  function fmSellerName(row){
    return fmValue(row,[
      "Seller Name","Seller Display Name","Seller Nickname",
      "Shop Name","Shop Display Name","Merchant Name","Store Name",
      "Pickup Shop Name","Pickup Seller Name",
      "seller_name","sellerName","seller_display_name","seller_nickname",
      "shop_name","shopName","shop_display_name","merchant_name","merchantName",
      "store_name","storeName","pickup_shop_name","pickup_seller_name","order_seller_name"
    ],/^(seller|shop|merchant|store)(display|nickname)?name$|^pickup(shop|seller)name$|^ordersellername$/i);
  }
  function fmUniquePickupNames(rows,readName=fmPickupPointName){
    const names=new Map();
    for(const row of rows||[]){
      const value=String(readName(row)||"").trim();
      const key=fmNorm(value);
      if(key&&!names.has(key))names.set(key,value);
    }
    return names;
  }

  // Keep point names learned from task exports. The daily reset clears task/order
  // exports, but this small ID->name directory is reference data and survives it.
  const FM_POINT_NAME_MAP_KEY="badoc_first_mile_point_names_v1";
  let fmPointNameMap=null;
  function fmGetPointNameMap(){
    if(fmPointNameMap)return fmPointNameMap;
    try{
      const saved=JSON.parse(localStorage.getItem(FM_POINT_NAME_MAP_KEY)||"{}");
      fmPointNameMap=saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{};
    }catch(_){fmPointNameMap={};}
    return fmPointNameMap;
  }
  function fmRememberPickupPointNames(rows){
    const map=fmGetPointNameMap();
    let changed=false;
    for(const row of rows||[]){
      const id=fmNorm(fmPickupPointId(row));
      if(!id)continue;
      const name=fmPickupPointName(row)||fmSellerName(row);
      if(name&&String(name).trim()&&map[id]!==String(name).trim()){
        map[id]=String(name).trim();
        changed=true;
      }
    }
    if(changed){
      try{localStorage.setItem(FM_POINT_NAME_MAP_KEY,JSON.stringify(map));}catch(e){console.warn("Pickup point-name cache save failed:",e)}
      try{window.__badocPickupCloudSavePointNames?.(map);}catch(e){console.warn("Pickup point-name cloud queue:",e)}
    }
  }
  window.__badocApplyPickupPointNameMap=function(value){
    fmPointNameMap=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    try{localStorage.setItem(FM_POINT_NAME_MAP_KEY,JSON.stringify(fmPointNameMap));}catch(e){}
    try{window.__badocRenderFirstMileCombined?.();}catch(e){}
    return true;
  };
  function fmPickupNameDisplay(group){
    const orderRows=Array.isArray(group?.eligibleOrders)&&group.eligibleOrders.length
      ?group.eligibleOrders:(group?.orders||[]);
    if(group?.pickupOrderOnly){
      // In Pickup Orders mode, task exports must not supply point names or
      // seller details. The task join is reserved exclusively for Driver Name.
      const orderNames=fmUniquePickupNames(orderRows);
      if(orderNames.size)return [...orderNames.values()].join(" | ");
      const sourceRow=orderRows[0]||{};
      const pointId=fmNorm(fmPickupPointId(sourceRow));
      const mapped=pointId?fmGetPointNameMap()[pointId]:"";
      if(mapped)return mapped;
      const sellerNames=fmUniquePickupNames(orderRows,fmSellerName);
      return [...sellerNames.values()].join(" | ")||"—";
    }

    const taskNames=fmUniquePickupNames(group?.tasks||[]);
    const orderNames=fmUniquePickupNames(group?.orders||[]);
    const direct=[...taskNames.values(),...orderNames.values()];
    if(direct.length)return [...new Set(direct)].join(" | ");

    // If today's task has not been assigned yet, resolve its ID using names
    // learned from earlier task exports.
    const sourceRow=(group?.orders||[])[0]||(group?.tasks||[])[0]||{};
    const pointId=fmNorm(fmPickupPointId(sourceRow));
    const mapped=pointId?fmGetPointNameMap()[pointId]:"";
    if(mapped)return mapped;

    // Last-resort display fallback: use seller/shop name supplied by the order.
    const sellerNames=[
      ...fmUniquePickupNames(group?.orders||[],fmSellerName).values(),
      ...fmUniquePickupNames(group?.tasks||[],fmSellerName).values()
    ];
    return [...new Set(sellerNames)].join(" | ")||"—";
  }
  const FM_DRIVER_NAME_FIELDS=[
    "Driver Name","Assigned Driver Name","Rider Name","Assigned Rider",
    "Pickup Driver Name","Pickup Rider Name","Driver","driver_name","rider_name"
  ];
  function fmTaskDriverName(task){
    return fmValue(task,FM_DRIVER_NAME_FIELDS).trim();
  }
  function fmTaskStatusRaw(task){
    return fmValue(task,["Status","Task Status","Pickup Task Status","status_name","status"]);
  }
  function fmIsDisabledPickupTask(task){
    return fmNorm(fmTaskStatusRaw(task))==="disabled";
  }
  function fmHasPickupTaskNumber(value){
    const key=fmNorm(value);
    // SPX sometimes exports placeholders instead of a real task ID.
    // Treat them as missing so the guarded point/time fallback can run.
    return !!key&&!['na','none','null','undefined','notavailable','admin','system','unknown','unassigned','0'].includes(key);
  }
  function fmIsCancelledPickupOrder(order){
    const key=fmNorm(fmPickupOrderStatus(order));
    return key==='canceled'||key==='cancelled'||key==='disabled'||key.startsWith('canceled')||key.startsWith('cancelled');
  }
  function fmAssignedRiderDisplay(group){
    // Show the rider recorded by SPX even when the task/order was later
    // Disabled/Cancelled. The separate Status column remains authoritative
    // for whether the pickup is active; hiding this name would erase history.
    const tasks=Array.isArray(group?.tasks)?group.tasks:[];
    const namedTasks=tasks.filter(task=>fmTaskDriverName(task));
    const latest=fmLatestTask({tasks:namedTasks});
    return latest?fmTaskDriverName(latest)||"Unassigned":"Unassigned";
  }
  function fmOrderId(row){return fmValue(row,[
    "Order ID","Order No","Order Number","Pickup Order ID","Pickup Order No",
    "SPX Tracking Number","SPX Tracking No","Tracking Number","Tracking No",
    "order_id","order_sn","order_number","tracking_number"
  ],/^(pickup)?order(id|no|number|sn)$|^(spx)?tracking(number|no)$/i);}
  function fmPickupTaskNumber(row){return fmValue(row,[
    "Pickup Task Number","Task Number","Pickup Task No","Task ID",
    "pickup_task_number","pickuptasknumber","task_id","task_number"
  ],/^(pickup)?task(id|no|number)$/i);}
  function fmPickupOrderAssignedTime(order){
    return fmValue(order,[
      "Assigned Time","Pickup Assigned Time","Assigned At","assigned_time",
      "pickup_assigned_time","pickupAssignedTime"
    ],/^(pickup)?assigned(time|at)$/i);
  }
  function fmDateTimeKey(value){
    const raw=String(value??"").trim();
    if(!raw)return "";
    const direct=raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(direct){
      return direct[1]+"-"+String(direct[2]).padStart(2,"0")+"-"+String(direct[3]).padStart(2,"0")+
        " "+String(direct[4]).padStart(2,"0")+":"+direct[5]+":"+(direct[6]||"00");
    }
    const parsed=Date.parse(raw.replace(/\//g,"-"));
    return Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,19):"";
  }
  function fmDateTimeMs(value){
    const key=fmDateTimeKey(value);
    if(!key)return NaN;
    const parsed=Date.parse(key.replace(" ","T"));
    return Number.isFinite(parsed)?parsed:NaN;
  }
  const FM_PICKUP_BASELINE_KEYS={
    orders:"badoc_first_mile_orders_baseline_v1",
    tasks:"badoc_first_mile_tasks_baseline_v1"
  };
  function fmPickupBaselineDate(){
    try{return getBadocManilaDayBounds().date;}catch(_){
      return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    }
  }
  function fmReadPickupBaseline(kind){
    try{
      const record=JSON.parse(localStorage.getItem(FM_PICKUP_BASELINE_KEYS[kind])||"null");
      return record&&record.date===fmPickupBaselineDate()&&record.byId&&typeof record.byId==="object"?record:null;
    }catch(_){return null;}
  }
  function fmPickupBaselineEntry(kind,id){
    const baseline=fmReadPickupBaseline(kind),key=fmNorm(id);
    return key&&baseline?baseline.byId[key]||null:null;
  }
  function fmPickupBaselineWasAssigned(kind,id){
    const entry=fmPickupBaselineEntry(kind,id);
    return !!entry&&fmNorm(entry.status)==="assigned";
  }
  window.__badocUpdatePickupBaselineStatus=function(){
    const el=document.getElementById("firstMileBaselineStatus");
    if(!el)return;
    const orders=fmReadPickupBaseline("orders"),tasks=fmReadPickupBaseline("tasks");
    const count=record=>Number(record?.trackedCount||0).toLocaleString();
    if(!orders&&!tasks){
      el.textContent="First-sync baseline will be saved automatically before today’s first successful export is replaced.";
      return;
    }
    const parts=[];
    if(orders)parts.push("Orders "+count(orders)+" IDs");
    if(tasks)parts.push("Tasks "+count(tasks)+" IDs");
    el.textContent="First-sync baseline · "+fmPickupBaselineDate()+" · "+parts.join(" · ")+". Only records first seen as Assigned can later appear as Cancelled.";
  };
  window.__badocCapturePickupFirstSyncBaseline=async function(kind,csvText,meta){
    if(!FM_PICKUP_BASELINE_KEYS[kind])return {saved:false};
    const date=fmPickupBaselineDate();
    const rows=typeof parseCsvText==="function"?parseCsvText(String(csvText||"")):[];
    const incoming={};
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      const id=kind==="orders"?fmOrderId(row):fmPickupTaskNumber(row);
      if(!id)return;
      const status=kind==="orders"
        ?fmOrderSheetStatus(row)
        :fmTaskStatusLabel(fmValue(row,["Status","Task Status","Pickup Task Status","status_name","status"]));
      incoming[fmNorm(id)]={
        id:String(id),status:String(status||"Unknown"),
        pickupPointId:fmPickupPointId(row)||"",taskNumber:fmPickupTaskNumber(row)||""
      };
    });
    const trackedCount=Object.keys(incoming).length;
    if(!trackedCount){
      window.__badocUpdatePickupBaselineStatus?.();
      return {saved:false,reason:"No Order ID or Pickup Task Number was found in the export."};
    }
    let record=fmReadPickupBaseline(kind);
    let added=0;
    if(record){
      const merged={...(record.byId||{})};
      Object.entries(incoming).forEach(([key,value])=>{
        if(!Object.prototype.hasOwnProperty.call(merged,key)){merged[key]=value;added++;}
      });
      if(added){
        record={...record,byId:merged,trackedCount:Object.keys(merged).length,updatedAt:Date.now()};
        try{localStorage.setItem(FM_PICKUP_BASELINE_KEYS[kind],JSON.stringify(record));}
        catch(error){console.warn("Pickup baseline append failed:",error);}
      }
    }else{
      record={
        schemaVersion:1,date,kind,capturedAt:Date.now(),taskId:String(meta?.taskId||""),
        rowCount:Array.isArray(rows)?rows.length:0,trackedCount,byId:incoming
      };
      try{localStorage.setItem(FM_PICKUP_BASELINE_KEYS[kind],JSON.stringify(record));}
      catch(error){console.warn("Pickup first-sync baseline local save failed:",error);}
      added=trackedCount;
    }
    try{
      const cloud=await window.__badocPickupCloudSaveBaseline?.(kind,record);
      if(cloud?.record){
        record=cloud.record;
        try{localStorage.setItem(FM_PICKUP_BASELINE_KEYS[kind],JSON.stringify(record));}catch(_){}
      }
    }catch(error){console.warn("Pickup first-sync baseline cloud save pending:",error);}
    window.__badocUpdatePickupBaselineStatus?.();
    return {saved:added>0,added,record};
  };
  function fmPickupOrderStatus(order){
    return fmValue(order,[
      "Status (pickup order)","Status(pickup order)","Pickup Status",
      "Pickup Order Status","Order Status","Status Name","status_name",
      "pickup_status_name","order_status_name","Status","status"
    ],/^status.*pickuporder$|^pickuporderstatus$|^status$/i);
  }
  function fmOrderSheetStatus(order){
    const rawLabel=fmPickupOrderStatus(order);
    const textStatus=fmNorm(rawLabel);
    if((textStatus.includes("pickedup")&&!textStatus.includes("notpickedup"))||textStatus==="pickupdone"||textStatus==="collected")return "Picked Up";
    if(textStatus==="onhold"||textStatus==="pickupnoorder"||textStatus.includes("onhold"))return "Onhold";
    if(textStatus==="assigned")return "Assigned";
    const rawStatus=fmNorm(fmValue(order,["Status Code","Status ID","Order Status ID","Pickup Status ID","status_code","status_id","order_status","order_status_id","pickup_status","pickup_status_id"]));
    if(rawStatus==="4"||rawStatus==="4pickedup")return "Picked Up";
    if(rawStatus==="2"||rawStatus==="2assigned")return "Assigned";
    return rawLabel||rawStatus||"Unknown";
  }
  function fmOrderPickupStatusLabel(order){
    return fmOrderSheetStatus(order)==="Picked Up"?"Picked Up":"Not Picked Up";
  }
  function fmPickupOrderOnlyStatus(order){
    const raw=fmPickupOrderStatus(order)||fmOrderSheetStatus(order)||"Unknown";
    const key=fmNorm(raw);
    if(key==="canceled"||key==="cancelled"||key==="disabled")return "Cancelled";
    return raw;
  }
  function fmCombinedPickupStatus(group){
    if(group?.taskOnly){
      const task=fmLatestTask(group)||group.tasks?.[0]||{};
      const raw=fmTaskStatusRaw(task);
      const key=fmNorm(raw);
      if(["disabled","cancelled","canceled"].includes(key))return "Cancelled";
      if(key==="accepted")return "Accepted";
      return fmTaskStatusLabel(raw)||"Unknown";
    }
    if(group?.pickupOrderOnly){
      // The safely matched Pickup Task is the source of the displayed status.
      // Pickup No Order is normalized to OnHold and Disabled to Cancelled.
      const matchedTask=fmLatestTask(group);
      const taskStatus=matchedTask?fmTaskStatusRaw(matchedTask):"";
      if(group.matchIssue==="ambiguous")return "Ambiguous Task Match";
      return taskStatus?fmTaskStatusLabel(taskStatus):"No Task Match";
    }
    const order=group?.eligibleOrders?.[0]||null;
    const latest=fmLatestTask(group);
    const taskRaw=latest?fmValue(latest,["Status","Task Status","Pickup Task Status","status_name","status"]):"";
    const taskKey=fmNorm(taskRaw);
    const taskLabel=latest?fmTaskStatusLabel(taskRaw):"";
    const orderId=order?fmOrderId(order):"";
    const orderTaskNumber=order?fmPickupTaskNumber(order):"";
    const taskNumber=latest?fmPickupTaskNumber(latest):"";
    const orderRaw=order?fmPickupOrderStatus(order)||fmOrderSheetStatus(order)||"Unknown":"";
    const orderKey=fmNorm(orderRaw);

    // An explicit order-level cancellation is authoritative. A Pickup Task is
    // linked by Pickup Point ID when an order has no task number, and that
    // point-level Accepted status must not turn a canceled order into Assigned.
    if(order&&(orderKey==="cancelled"||orderKey==="canceled"||orderKey==="disabled")){
      const wasAssigned=fmPickupBaselineWasAssigned("orders",orderId)||
        fmPickupBaselineWasAssigned("tasks",orderTaskNumber);
      if(orderKey==="cancelled"||orderKey==="canceled"){
        return wasAssigned?"Cancelled after Assigned":orderRaw;
      }
      return wasAssigned?"Cancelled after Assigned":"Hidden Disabled";
    }

    if(latest&&["accepted","disabled","pickupnoorder","inbounded"].includes(taskKey)){
      if(taskKey==="disabled"){
        const wasAssigned=fmPickupBaselineWasAssigned("tasks",taskNumber)||
          fmPickupBaselineWasAssigned("orders",orderId)||
          fmPickupBaselineWasAssigned("tasks",orderTaskNumber);
        return wasAssigned?"Cancelled after Assigned":"Hidden Disabled";
      }
      return taskLabel;
    }
    if(order)return orderRaw||"Unknown";
    if(latest){
      if(taskKey==="disabled"||taskKey==="cancelled"||taskKey==="canceled"){
        return fmPickupBaselineWasAssigned("tasks",taskNumber)?"Cancelled after Assigned":"Hidden Disabled";
      }
      return taskLabel||"Unknown";
    }
    return "Unknown";
  }
  function fmOrderLinksHtml(group){
    const ids=(group?.eligibleOrders||[]).map(fmOrderId).filter(Boolean);
    if(!ids.length)return "—";
    return ids.map(id=>{
      const href="https://spx.shopee.ph/#/orderDetail/"+encodeURIComponent(id)+"/pickup_info";
      return '<div class="fm-order-id-item">'+
        '<a class="fm-order-link" href="'+fmEsc(href)+'" target="_blank" rel="noopener noreferrer" title="Open Order '+fmEsc(id)+' in SPX">'+fmEsc(id)+'</a>'+
      '</div>';
    }).join("");
  }
  function fmPickupInfoButtonsHtml(group){
    const ids=(group?.eligibleOrders||[]).map(fmOrderId).filter(Boolean);
    if(!ids.length)return "";
    return '<span class="fm-pickup-info-actions">'+ids.map(id=>
      '<button class="fm-pickup-info-btn" type="button" data-order-id="'+fmEsc(id)+'" aria-label="View proof photos for order '+fmEsc(id)+'" title="View uploaded pickup proof photos"><span aria-hidden="true">📷</span> Proof</button>'
    ).join("")+'</span>';
  }
  const FM_ETA_DATE_FORMATTER=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"});
  function fmEtaDate(row){
    const raw=fmValue(row,["ETA","Estimated Time of Arrival","Estimated Arrival Time","Pickup ETA","Pickup Estimated Time","eta_date","eta_time","estimated_arrival_time"],/^eta(date|time)?$/i);
    if(!raw)return "";
    const direct=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(direct)return `${direct[1]}-${String(direct[2]).padStart(2,"0")}-${String(direct[3]).padStart(2,"0")}`;
    const slash=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if(slash)return `${slash[3]}-${String(slash[1]).padStart(2,"0")}-${String(slash[2]).padStart(2,"0")}`;
    let date=null;
    if(/^\d+(\.\d+)?$/.test(raw)){
      const n=Number(raw);
      if(n>100000000000)date=new Date(n);
      else if(n>1000000000)date=new Date(n*1000);
      else if(n>20000&&n<80000)date=new Date(Date.UTC(1899,11,30)+n*86400000);
    }else{
      const normalized=raw.includes("T")?raw:raw.replace(/\s+/,"T");
      date=new Date(normalized);
    }
    if(!date||Number.isNaN(date.getTime()))return "";
    return FM_ETA_DATE_FORMATTER.format(date);
  }
  function fmEtaDate(row){
    const raw=fmValue(row,["ETA","Estimated Time of Arrival","Estimated Arrival Time","Pickup ETA","Pickup Estimated Time","eta_date","eta_time","estimated_arrival_time"],/^eta(date|time)?$/i);
    if(!raw)return "";
    const direct=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(direct)return `${direct[1]}-${String(direct[2]).padStart(2,"0")}-${String(direct[3]).padStart(2,"0")}`;
    const slash=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if(slash)return `${slash[3]}-${String(slash[1]).padStart(2,"0")}-${String(slash[2]).padStart(2,"0")}`;
    let date=null;
    if(/^\d+(\.\d+)?$/.test(raw)){
      const n=Number(raw);
      if(n>100000000000)date=new Date(n);
      else if(n>1000000000)date=new Date(n*1000);
      else if(n>20000&&n<80000)date=new Date(Date.UTC(1899,11,30)+n*86400000);
    }else{
      const normalized=raw.includes("T")?raw:raw.replace(/\s+/,"T");
      date=new Date(normalized);
    }
    if(!date||Number.isNaN(date.getTime()))return "";
    return FM_ETA_DATE_FORMATTER.format(date);
  }
  // Pickup task counts are for today's Manila date only. SPX's task export can
  // contain older task history, so Create Time must be checked before grouping.
  function fmTaskCreateDate(row){
    const raw=fmValue(row,["Create Time","Task Create Time","Created Time","create_time","ctime"],/^createtime$|^taskcreatetime$|^ctime$/i);
    return raw ? fmEtaDate({ETA:raw}) : "";
  }
  // BADOC HUB is station 3061. Prefer the station ID; use the station name
  // only for exports that omit the ID column.
  function fmIsBadocPickupTask(row){
    const stationId=fmValue(row,["Station ID","Station Id","Current Station ID","station_id","current_station_id"],/^station(id)?$|^currentstationid$/i);
    if(stationId)return String(stationId).trim()==="3061";
    const stationName=fmValue(row,["Station Name","Current Station Name","station_name","current_station_name"],/^stationname$|^currentstationname$/i);
    if(stationName)return fmNorm(stationName)==="badochub";
    return true;
  }
  function fmEsc(value){return typeof esc==="function"?esc(value):String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  let firstMileCombinedRows=[];
  let firstMileAlertRows=[];
  let firstMileVisibleRows=[];
  function fmTodayExportRows(kind){
    const stored=getStoredFirstMile(kind);
    if(!stored||!Array.isArray(stored.rows))return [];
    const today=getBadocManilaDayBounds().date;
    return stored.rows.filter(row=>kind==="orders"?fmEtaDate(row)===today:fmTaskCreateDate(row)===today);
  }
  function fmUpdateRawCopyButtons(){
    const orders=fmTodayExportRows("orders");
    const tasks=fmTodayExportRows("tasks");
    const orderButton=$("copyFMHubInventory");
    const taskButton=$("copyPickupTaskManagement");
    if(orderButton){orderButton.disabled=!orders.length;orderButton.textContent="FM Hub Inventory"+(orders.length?" ("+orders.length.toLocaleString()+")":"");}
    if(taskButton){taskButton.disabled=!tasks.length;taskButton.textContent="Pickup Task Management"+(tasks.length?" ("+tasks.length.toLocaleString()+")":"");}
  }
  async function fmCopyRawExportRows(kind,button,baseLabel){
    const rows=fmTodayExportRows(kind);
    const reportPanel=button?.closest?.("[data-report-panel]");
    const reportStatus=reportPanel?.querySelector("[data-report-copy-status]");
    if(!rows.length){
      fmUpdateRawCopyButtons();
      if(reportStatus){
        reportStatus.textContent=kind==="orders"
          ?"No Pickup Orders with ETA today are loaded. Sync Pickup Orders + Tasks in the Pickup menu first."
          :"No Pickup Tasks created today are loaded. Sync Pickup Orders + Tasks in the Pickup menu first.";
        reportStatus.dataset.state="warn";
      }
      return false;
    }
    // This is the same raw Pickup Orders / Pickup Tasks dataset, today's row
    // filter, column discovery, cell cleanup, and TSV serialization used by
    // the two copy buttons in the Pickup menu.
    const headers=[...new Set(rows.flatMap(row=>Object.keys(row||{})))];
    const clean=value=>{
      if(value===null||value===undefined)return "";
      if(typeof value==="object")return JSON.stringify(value);
      return String(value);
    };
    const TAB=String.fromCharCode(9);
    const ROW_BREAK=String.fromCharCode(13,10);
    const cleanCell=value=>clean(value).replaceAll(TAB," ").replaceAll(String.fromCharCode(13)," ").replaceAll(String.fromCharCode(10)," ");
    const lines=[headers.map(header=>cleanCell(header)).join(TAB),...rows.map(row=>headers.map(header=>cleanCell(row?.[header])).join(TAB))];
    const payload=lines.join(ROW_BREAK);
    let copied=false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(payload);copied=true;}}catch(_){}
    if(!copied){
      const area=document.createElement("textarea");
      area.value=payload;area.setAttribute("readonly","");
      area.style.position="fixed";area.style.left="-9999px";area.style.top="0";
      document.body.appendChild(area);area.select();
      try{copied=document.execCommand("copy");}catch(_){copied=false;}
      area.remove();
    }
    if(reportStatus){
      const label=baseLabel|| (kind==="orders"?"FM Hub Inventory":"Pickup Task Management");
      reportStatus.textContent=copied
        ?`Copied ${rows.length.toLocaleString()} row(s) from the Pickup menu: ${label}.`
        :"Copy failed. Check browser clipboard permissions.";
      reportStatus.dataset.state=copied?"success":"error";
    }else if(button){
      button.textContent=copied?`Copied ${lines.length} rows${skippedPreviousDayCanceled? ` · skipped ${skippedPreviousDayCanceled} canceled from yesterday` : ""}`:"Copy failed";
      setTimeout(()=>{if(button.isConnected)fmUpdateRawCopyButtons();},2200);
    }
    return copied;
  }
  // Let Reports call the raw Pickup export copier regardless of which page is active.
  window.__badocCopyPickupRawExportRows=fmCopyRawExportRows;
  $("copyFMHubInventory")?.addEventListener("click",event=>fmCopyRawExportRows("orders",event.currentTarget,"FM Hub Inventory"));
  $("copyPickupTaskManagement")?.addEventListener("click",event=>fmCopyRawExportRows("tasks",event.currentTarget,"Pickup Task Management"));
  function renderFirstMileCombined(){
    const ordersData=getStoredFirstMile("orders");
    const tasksData=getStoredFirstMile("tasks");
    fmUpdateRawCopyButtons();
    const stats=$("firstMileCombinedStats"),table=$("firstMileCombinedTable"),meta=$("firstMileCombinedMeta"),downloadBtn=$("downloadFirstMileCombined");
    const unmatchedPanel=$("firstMileUnmatchedPanel");
    const alertControls=$("firstMileAutoAlertControls");
    if(unmatchedPanel)unmatchedPanel.hidden=true;
    if(alertControls)alertControls.hidden=true;
    firstMileAlertRows=[];

    if(!ordersData&&!tasksData){
      firstMileCombinedRows=[];
      firstMileVisibleRows=[];
      if(stats)stats.innerHTML=[[0,"Pickup Orders export"],[0,"Orders ETA today"],[0,"Tasks created today"],[0,"Standalone Tasks"],[0,"Accepted Tasks"]].map(([n,l])=>'<div><strong>'+n+'</strong><span>'+l+'</span></div>').join("");
      if(meta)meta.textContent="Sync Pickup Orders + Tasks to load today's pickup activity.";
      if(table)table.innerHTML='<div class="first-mile-combined-empty">Sync Pickup Orders + Tasks to show today\'s pickup activity.</div>';
      if(downloadBtn)downloadBtn.disabled=true;
      const copyBtn=$("copyFirstMileForSheet");
      if(copyBtn){copyBtn.disabled=true;copyBtn.textContent="Copy for Sheet";}
      return;
    }

    const allOrderRows=Array.isArray(ordersData?.rows)?ordersData.rows:[];
    const today=getBadocManilaDayBounds().date;
    const orderRows=allOrderRows.filter(order=>fmEtaDate(order)===today);

    // Keep all station-matched tasks available for the existing exact-match
    // order join. Standalone task rows are restricted to tasks created today.
    const taskRows=Array.isArray(tasksData?.rows)?tasksData.rows.filter(fmIsBadocPickupTask):[];
    const todayTaskRows=taskRows.filter(task=>fmTaskCreateDate(task)===today);

    const tasksByPickupPoint=new Map();
    const tasksByPickupTaskNumber=new Map();
    taskRows.forEach(task=>{
      const pointKey=fmNorm(fmPickupPointId(task));
      if(pointKey){
        if(!tasksByPickupPoint.has(pointKey))tasksByPickupPoint.set(pointKey,[]);
        tasksByPickupPoint.get(pointKey).push(task);
      }
      const taskNumberKey=fmNorm(fmPickupTaskNumber(task));
      if(fmHasPickupTaskNumber(taskNumberKey)){
        if(!tasksByPickupTaskNumber.has(taskNumberKey))tasksByPickupTaskNumber.set(taskNumberKey,[]);
        tasksByPickupTaskNumber.get(taskNumberKey).push(task);
      }
    });

    const orderGroups=orderRows.map(order=>{
      const pickupPointId=fmPickupPointId(order)||"";
      const pointKey=fmNorm(pickupPointId);
      const orderTaskNumber=fmPickupTaskNumber(order);
      const assignedTimeMs=fmDateTimeMs(fmPickupOrderAssignedTime(order));
      let candidates=[];
      let matchIssue="";

      if(fmHasPickupTaskNumber(orderTaskNumber)){
        // Primary match: task number. A different pickup point is never
        // accepted, even when the task number happens to exist elsewhere.
        candidates=(tasksByPickupTaskNumber.get(fmNorm(orderTaskNumber))||[]).filter(task=>{
          const taskPointKey=fmNorm(fmPickupPointId(task));
          return !!pointKey&&!!taskPointKey&&taskPointKey===pointKey;
        });
        // Duplicate task-number rows may be narrowed by the same 2-second
        // timestamp window, but the timestamp never overrides the task ID.
        if(candidates.length>1&&Number.isFinite(assignedTimeMs)){
          const timeMatches=candidates.filter(task=>{
            const taskTimeMs=fmDateTimeMs(fmValue(task,["Create Time","Task Create Time","Created Time","create_time","ctime"],/^createtime$|^taskcreatetime$|^ctime$/i));
            return Number.isFinite(taskTimeMs)&&Math.abs(taskTimeMs-assignedTimeMs)<=2000;
          });
          if(timeMatches.length)candidates=timeMatches;
        }
      }else if(pointKey&&Number.isFinite(assignedTimeMs)){
        // Fallback is allowed only when point and assignment/create times agree.
        // If the task also exposes a seller/point name, it must agree with the order.
        const timeCandidates=(tasksByPickupPoint.get(pointKey)||[]).filter(task=>{
          const taskTimeMs=fmDateTimeMs(fmValue(task,["Create Time","Task Create Time","Created Time","create_time","ctime"],/^createtime$|^taskcreatetime$|^ctime$/i));
          return Number.isFinite(taskTimeMs)&&Math.abs(taskTimeMs-assignedTimeMs)<=2000;
        });
        // Pickup Point ID is the authoritative link between these exports.
        // Seller Name and Pickup Point Name are different source fields and
        // must not veto an otherwise unique ID + timestamp match.
        candidates=timeCandidates;
        if(candidates.length>1)matchIssue="ambiguous";
      }

      // Ambiguous matches are not safe: do not borrow a rider or task status.
      const matchedTasks=candidates.length===1?candidates:[];
      const matchedTask=matchedTasks[0]||null;
      const taskDisabled=!!matchedTask&&fmIsDisabledPickupTask(matchedTask);
      return {
        pickupPointId:pickupPointId,
        orders:[order],
        eligibleOrders:[order],
        tasks:matchedTasks,
        taskDisabled:taskDisabled,
        matchIssue:matchIssue,
        pickupOrderOnly:true
      };
    });

    // Preserve the existing order-cancellation rule.
    const beforeCancellationFilter=orderGroups.length;
    const eligibleOrderGroups=orderGroups.filter(group=>{
      const order=group.eligibleOrders?.[0]||group.orders?.[0]||{};
      return !fmIsCancelledPickupOrder(order)||group.taskDisabled===true;
    });
    const excludedCancelledWithoutDisabled=beforeCancellationFilter-eligibleOrderGroups.length;

    // Track tasks already safely represented on an order row, so those tasks
    // are not duplicated as standalone rows.
    const matchedTaskObjects=new Set();
    const matchedTaskKeys=new Set();
    const taskRowKey=task=>{
      const pointKey=fmNorm(fmPickupPointId(task));
      const taskNumberKey=fmNorm(fmPickupTaskNumber(task));
      if(taskNumberKey)return "id:"+pointKey+"|"+taskNumberKey;
      const created=fmNorm(fmValue(task,["Create Time","Task Create Time","Created Time","create_time","ctime"]));
      const status=fmNorm(fmTaskStatusRaw(task));
      const rider=fmNorm(fmTaskDriverName(task));
      const signature=[pointKey,created,status,rider].join("|");
      return signature.replace(/\|/g,"")?"row:"+signature:"row:"+JSON.stringify(task);
    };
    eligibleOrderGroups.forEach(group=>{
      (group.tasks||[]).forEach(task=>{
        matchedTaskObjects.add(task);
        matchedTaskKeys.add(taskRowKey(task));
      });
    });

    const taskOnlyRows=[];
    const seenTodayTaskKeys=new Set();
    todayTaskRows.forEach(task=>{
      const key=taskRowKey(task);
      if(matchedTaskObjects.has(task)||matchedTaskKeys.has(key)||seenTodayTaskKeys.has(key))return;
      seenTodayTaskKeys.add(key);
      const statusKey=fmNorm(fmTaskStatusRaw(task));
      taskOnlyRows.push({
        pickupPointId:fmPickupPointId(task)||"",
        orders:[],
        eligibleOrders:[],
        tasks:[task],
        taskOnly:true,
        isTaskOnlyInbounded:statusKey==="inbounded",
        isTaskOnlyOnhold:statusKey==="pickupnoorder"||statusKey==="onhold"
      });
    });

    firstMileCombinedRows=eligibleOrderGroups.concat(taskOnlyRows);

    const statusCounts=new Map();
    firstMileCombinedRows.forEach(group=>{
      const label=fmCombinedPickupStatus(group)||"Unknown";
      const key=fmNorm(label)||"unknown";
      statusCounts.set(key,(statusCounts.get(key)||0)+1);
    });
    const statusCount=(...keys)=>keys.reduce((sum,key)=>sum+(statusCounts.get(key)||0),0);
    const acceptedTaskCount=todayTaskRows.filter(task=>fmNorm(fmTaskStatusRaw(task))==="accepted").length;
    if(stats)stats.innerHTML=[
      [allOrderRows.length,"Pickup Orders export"],
      [eligibleOrderGroups.length,"Orders ETA today"],
      [todayTaskRows.length,"Tasks created today"],
      [taskOnlyRows.length,"Standalone Tasks"],
      [acceptedTaskCount,"Accepted Tasks"],
      [statusCount("inbounded"),"Inbounded"],
      [statusCount("onhold"),"OnHold"],
      [statusCount("cancelled","canceled","disabled","hiddendisabled"),"Cancelled"]
    ].map(([n,l])=>'<div><strong>'+Number(n).toLocaleString()+'</strong><span>'+fmEsc(l)+'</span></div>').join("");

    const search=fmNorm($("firstMileCombinedSearch")?.value||"");
    const filtered=firstMileCombinedRows.filter(group=>{
      if(!search)return true;
      const order=group.eligibleOrders?.[0]||{};
      const searchableValues=[group.pickupPointId,...Object.values(order)];
      (group.tasks||[]).forEach(task=>{
        searchableValues.push(fmPickupTaskNumber(task),fmTaskStatusRaw(task),fmTaskDriverName(task),fmPickupPointId(task),...Object.values(task));
      });
      return searchableValues.some(value=>fmNorm(value).includes(search));
    }).map((group,index)=>({group,index,rider:fmAssignedRiderDisplay(group)}));
    const riderCollator=new Intl.Collator("en",{sensitivity:"base",numeric:true});
    filtered.sort((a,b)=>{
      const aUnassigned=fmNorm(a.rider)==="unassigned",bUnassigned=fmNorm(b.rider)==="unassigned";
      if(aUnassigned!==bUnassigned)return aUnassigned?1:-1;
      return riderCollator.compare(a.rider,b.rider)||a.index-b.index;
    });
    const visibleGroups=filtered.map(item=>item.group);
    firstMileVisibleRows=visibleGroups;

    const ambiguousMatchCount=eligibleOrderGroups.filter(group=>group.matchIssue==="ambiguous").length;
    if(meta)meta.textContent="Showing "+filtered.length.toLocaleString()+" of "+firstMileCombinedRows.length.toLocaleString()+" rows: "+eligibleOrderGroups.length.toLocaleString()+" orders with ETA today and "+taskOnlyRows.length.toLocaleString()+" standalone tasks created today (Philippine time). Pickup Point ID and matching timestamps link the exports; ambiguous task matches remain separate. "+ambiguousMatchCount.toLocaleString()+" ambiguous match(es) were kept separate. Hidden "+excludedCancelledWithoutDisabled.toLocaleString()+" cancelled orders without a matched Disabled task.";

    const copyBtn=$("copyFirstMileForSheet");
    const sheetRowCount=filtered.length;
    const hasSheetRows=sheetRowCount>0;
    if(copyBtn){copyBtn.disabled=!hasSheetRows;copyBtn.textContent=hasSheetRows?"Copy for Sheet ("+sheetRowCount+")":"Copy for Sheet";}

    const columns=[
      ["Order Number",g=>fmOrderId(g.eligibleOrders?.[0]||{})||"—"],
      ["Pickup Task Number",g=>fmPickupTaskNumber(fmLatestTask(g)||g.tasks?.[0]||{})||"—"],
      ["Pickup Point ID",g=>{
        const order=g.eligibleOrders?.[0]||{};
        const task=fmLatestTask(g)||g.tasks?.[0]||{};
        return fmPickupPointId(order)||fmPickupPointId(task)||g.pickupPointId||"—";
      }],
      ["Seller Name",g=>{
        const order=g.eligibleOrders?.[0]||{};
        const task=fmLatestTask(g)||g.tasks?.[0]||{};
        return fmSellerName(order)||fmSellerName(task)||fmPickupPointName(task)||"—";
      }],
      ["Pickup Type",g=>fmValue(fmLatestTask(g)||g.tasks?.[0]||{},["Pickup Type","Task Type","Type","pickup_type","task_type","pickup_type_name"])||"—"],
      ["ETA / Create Time",g=>{
        const order=g.eligibleOrders?.[0]||{};
        const task=fmLatestTask(g)||g.tasks?.[0]||{};
        return fmValue(order,["ETA","Estimated Time of Arrival","Estimated Arrival Time","Pickup ETA","eta_date","eta_time"])||
          fmValue(task,["Create Time","Task Create Time","Created Time","create_time","ctime"])||"—";
      }],
      ["Status",g=>fmCombinedPickupStatus(g)||"Unknown"],
      ["Assigned Rider",g=>fmAssignedRiderDisplay(g)],
      ["PROOF",g=>fmPickupInfoButtonsHtml(g)]
    ];

    if(table&&$("firstMile")?.classList.contains("active")){
      if(!filtered.length){
        const emptyMessage=search
          ?"No Pickup Orders or Pickup Tasks match the current search."
          :"No Pickup Orders have an ETA today and no Pickup Tasks were created today ("+today+").";
        table.innerHTML='<div class="first-mile-combined-empty">'+fmEsc(emptyMessage)+'</div>';
      }else{
        const columnsHtml='<thead><tr>'+columns.map(c=>'<th>'+fmEsc(c[0])+'</th>').join('')+'</tr></thead>';
        const rowHtml=g=>'<tr>'+columns.map(c=>{
          const value=c[1](g);
          if(c[0]==="Status"){
            const key=fmNorm(value);
            const tone=({assigned:"assigned",accepted:"assigned",pickedup:"done",pickupdone:"done",onhold:"onhold",pickupnoorder:"onhold",inbounded:"inbounded",cancelled:"cancelled",canceled:"cancelled",disabled:"cancelled",cancelledafterassigned:"cancelled",cancelledtaskdisabled:"cancelled",ambiguoustaskmatch:"onhold"})[key]||"other";
            const detail=g.matchIssue==="ambiguous"?"More than one task matched this Pickup Point ID and assignment time. No task status or driver was copied.":"";
            return '<td title="'+fmEsc(detail||value)+'"><span class="fm-task-pill fm-task-'+tone+'">'+fmEsc(value)+'</span></td>';
          }
          if(c[0]==="Order Number")return '<td>'+fmOrderLinksHtml(g)+'</td>';
          if(c[0]==="Assigned Rider"){
            const rider=value==="Unassigned"?'<span class="fm-task-pill fm-task-unassigned">Unassigned</span>':fmEsc(value);
            return '<td class="fm-assigned-rider-cell" title="'+fmEsc(value)+'">'+rider+'</td>';
          }
          if(c[0]==="PROOF")return '<td class="fm-pickup-info-cell">'+(value||"—")+'</td>';
          return '<td title="'+fmEsc(value)+'">'+fmEsc(value)+'</td>';
        }).join('')+'</tr>';
        table.innerHTML='<table>'+columnsHtml+'<tbody>'+visibleGroups.map(rowHtml).join('')+'</tbody></table>';
      }
    }
    if(downloadBtn)downloadBtn.disabled=!filtered.length;
  }
    window.__badocRenderFirstMileCombined=renderFirstMileCombined;

  // Scheduled First Mile button clicks and new-unassigned alarm (Philippine time).
  (function(){
    const schedule=new Set(["10:00","11:00","12:00","13:00","14:00","15:00","15:30","15:40","15:50","16:00","16:30"]);
    const statusEl=()=>document.getElementById("firstMileAutoAlertStatus");
    const manilaParts=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).reduce((o,p)=>(o[p.type]=p.value,o),{});
    const ALARM_PREF_KEY="badoc_first_mile_alarm_enabled_v1";
    const SOUND_PREF_KEY="badoc_first_mile_alarm_sound_enabled_v1";
    const BROWSER_NOTIF_PREF_KEY="badoc_first_mile_browser_notifications_enabled_v1";
    const readBoolPref=(key,fallback=true)=>{try{const value=localStorage.getItem(key);return value===null?fallback:value==="1";}catch(_){return fallback;}};
    const writeBoolPref=(key,value)=>{try{localStorage.setItem(key,value?"1":"0");}catch(e){}};
    let lastAutoRun="",alarmEnabled=readBoolPref(ALARM_PREF_KEY,true),soundEnabled=readBoolPref(SOUND_PREF_KEY,true),browserNotificationsEnabled=readBoolPref(BROWSER_NOTIF_PREF_KEY,true),alarmActive=false,audioCtx=null,alarmTimer=null,knownUnassigned=null,soundBlocked=false;
    function refreshAlertSettingsStatus(){
      const permission=("Notification" in window)?Notification.permission:"unsupported";
      const permissionEl=document.getElementById("settingsNotificationPermission");
      if(permissionEl)permissionEl.textContent=permission==="granted"?"Browser permission: Allowed":permission==="denied"?"Browser permission: Blocked in browser settings":permission==="default"?"Browser permission: Not requested":"Browser notifications are not supported";
      const requestBtn=document.getElementById("settingsRequestNotificationPermission");
      if(requestBtn)requestBtn.hidden=permission==="granted"||permission==="unsupported";
      const alarm=document.getElementById("settingsAlarmEnabled");if(alarm)alarm.checked=alarmEnabled;
      const sound=document.getElementById("settingsSoundEnabled");if(sound)sound.checked=soundEnabled;
      const notifications=document.getElementById("settingsBrowserNotifications");if(notifications)notifications.checked=browserNotificationsEnabled;
    }
    function setSoundState(ready,reason){
      soundBlocked=!!soundEnabled&&!ready;
      const b=document.getElementById("enableFirstMileAlarm");if(b)b.hidden=ready||!soundEnabled;
      const el=statusEl();
      if(el){
        const permission=("Notification" in window)?Notification.permission:"unsupported";
        const notificationLabel=!browserNotificationsEnabled?"OFF":permission==="granted"?"ON":permission==="denied"?"BLOCKED":"NEEDS PERMISSION";
        el.textContent="Unassigned alarm: "+(alarmEnabled?"ON":"OFF")+" · Sound: "+(!soundEnabled?"OFF":ready?"ON":"NOT READY")+" · Browser notifications: "+notificationLabel;
      }
      refreshAlertSettingsStatus();
    }
    async function tryRestoreSound(){
      if(!soundEnabled){setSoundState(false,"sound disabled in Settings");return false;}
      try{
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC){setSoundState(false,"Web Audio is unavailable");return false;}
        audioCtx=audioCtx||new AC();
        // Do not wait for resume() during page load: Chrome can leave that
        // promise pending until a user gesture, which previously left the UI
        // stuck on "Restoring..." forever.
        if(audioCtx.state==="suspended"){
          try{const resumeResult=audioCtx.resume();if(resumeResult&&typeof resumeResult.catch==="function")resumeResult.catch(()=>setSoundState(false,"autoplay permission is required"));}catch(e){}
        }
        const ready=audioCtx.state==="running";
        if(ready){try{localStorage.setItem(SOUND_PREF_KEY,"1");}catch(e){}}
        setSoundState(ready,ready?"":"autoplay permission is required");
        if(!audioCtx.__badocStateHandler){
          audioCtx.__badocStateHandler=true;
          audioCtx.addEventListener("statechange",()=>{
            const active=audioCtx.state==="running";
            if(active){try{localStorage.setItem(SOUND_PREF_KEY,"1");}catch(e){}}
            setSoundState(active,active?"":"autoplay permission is required");
            if(active&&alarmActive){beep();if(soundEnabled&&!alarmTimer)alarmTimer=setInterval(beep,5000);}
          });
        }
        return ready;
      }catch(e){setSoundState(false,e.message||"autoplay permission is required");return false;}
    }
    const orderKey=g=>[String(g.pickupPointId||""),...(g.orders||[]).map(o=>String(fmValue(o,["Order ID","Order No","Order Number","Pickup Order ID","order_id","order_sn","order_number"])||"")).filter(Boolean).sort()].join("|");
    function currentUnassigned(){
      return new Set((firstMileAlertRows||[])
        .filter(g=>fmAssignedRiderDisplay(g)==="Unassigned")
        .map(orderKey));
    }
    function playAlarmTone(){
      if(!soundEnabled||!audioCtx||audioCtx.state!=="running")return;
      try{
        const now=audioCtx.currentTime;
        [0,0.22,0.44].forEach(offset=>{
          const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
          osc.type="square";osc.frequency.value=880;
          gain.gain.setValueAtTime(0.0001,now+offset);
          gain.gain.exponentialRampToValueAtTime(0.22,now+offset+0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.13);
          osc.connect(gain);gain.connect(audioCtx.destination);
          osc.start(now+offset);osc.stop(now+offset+0.15);
        });
      }catch(e){console.warn("Pickup alarm audio:",e);}
    }
    function beep(){
      if(!alarmEnabled||!alarmActive||!soundEnabled)return;
      playAlarmTone();
    }
    function startAlarm(count){
      if(!alarmEnabled||alarmActive)return;
      alarmActive=true;
      const ack=document.getElementById("ackFirstMileAlarm");if(ack)ack.hidden=false;
      const el=statusEl();if(el)el.textContent=count+" new unassigned pickup group(s) detected — alarm active.";
      if(soundEnabled){beep();alarmTimer=setInterval(beep,5000);}
      if(browserNotificationsEnabled&&"Notification" in window&&Notification.permission==="granted"){
        try{new Notification("New Unassigned Pickup Detected!",{body:count+" new unassigned pickup group(s) appeared in Pickup.",tag:"badoc-first-mile-unassigned"});}catch(e){}
      }
    }
    function acknowledge(){
      alarmActive=false;if(alarmTimer)clearInterval(alarmTimer);alarmTimer=null;
      const ack=document.getElementById("ackFirstMileAlarm");if(ack)ack.hidden=true;
      const el=statusEl();if(el)el.textContent="Alarm acknowledged. Automatic First Mile sync remains active.";
    }
    async function unlockAlarmSound(){
      try{
        const ok=await tryRestoreSound();
        if(ok){try{localStorage.setItem(SOUND_PREF_KEY,"1");}catch(e){}}
        if(browserNotificationsEnabled&&"Notification" in window&&Notification.permission==="default")await Notification.requestPermission();
        if(alarmActive&&ok)beep();
        refreshAlertSettingsStatus();
        if(knownUnassigned===null)knownUnassigned=currentUnassigned();
      }catch(e){setSoundState(false,e.message||"permission required");}
    }
    document.getElementById("enableFirstMileAlarm")?.addEventListener("click",unlockAlarmSound);
    function setAlarmEnabled(value){
      alarmEnabled=!!value;writeBoolPref(ALARM_PREF_KEY,alarmEnabled);
      if(!alarmEnabled){
        if(alarmTimer)clearInterval(alarmTimer);alarmTimer=null;alarmActive=false;
        const ack=document.getElementById("ackFirstMileAlarm");if(ack)ack.hidden=true;
      }
      knownUnassigned=currentUnassigned();
      const el=statusEl();if(el)el.textContent="Unassigned alarm "+(alarmEnabled?"enabled":"disabled")+" in Settings.";
      setSoundState(audioCtx?.state==="running");
    }
    async function setSoundEnabled(value){
      soundEnabled=!!value;writeBoolPref(SOUND_PREF_KEY,soundEnabled);
      if(!soundEnabled){
        if(alarmTimer)clearInterval(alarmTimer);alarmTimer=null;
        try{if(audioCtx&&audioCtx.state==="running")await audioCtx.suspend();}catch(e){}
        setSoundState(false,"sound disabled in Settings");
      }else{
        const ready=await tryRestoreSound();
        if(alarmActive&&ready){beep();if(!alarmTimer)alarmTimer=setInterval(beep,5000);}
      }
      refreshAlertSettingsStatus();
    }
    function setBrowserNotificationsEnabled(value){
      browserNotificationsEnabled=!!value;writeBoolPref(BROWSER_NOTIF_PREF_KEY,browserNotificationsEnabled);
      refreshAlertSettingsStatus();
      const el=statusEl();if(el)el.textContent="Browser notifications "+(browserNotificationsEnabled?"enabled":"disabled")+" in Settings.";
    }
    async function requestBrowserNotificationPermission(){
      if(!("Notification" in window)){refreshAlertSettingsStatus();return "unsupported";}
      try{const result=await Notification.requestPermission();refreshAlertSettingsStatus();return result;}
      catch(e){refreshAlertSettingsStatus();return "error";}
    }
    async function testBrowserNotification(){
      if(!browserNotificationsEnabled)return {ok:false,message:"Enable Browser Notifications in Settings first."};
      const permission=await requestBrowserNotificationPermission();
      if(permission!=="granted")return {ok:false,message:permission==="denied"?"Permission is blocked in browser settings.":"Notification permission was not granted."};
      try{new Notification("Badoc Hub test notification",{body:"Browser notifications are working.",tag:"badoc-settings-test"});return {ok:true,message:"Test notification sent."};}
      catch(e){return {ok:false,message:e?.message||String(e)};}
    }
    async function testAlarmSound(){
      if(!soundEnabled)return {ok:false,message:"Enable Alarm Sound in Settings first."};
      const ready=await tryRestoreSound();
      if(!ready)return {ok:false,message:"Sound is not ready. Click Enable alarm sound in the Pickup menu, then try again."};
      playAlarmTone();return {ok:true,message:"Test sound played."};
    }
    window.__badocAlertSettings={
      getState:()=>({alarmEnabled,soundEnabled,browserNotificationsEnabled,permission:("Notification" in window)?Notification.permission:"unsupported"}),
      setAlarmEnabled,setSoundEnabled,setBrowserNotificationsEnabled,
      requestPermission:requestBrowserNotificationPermission,
      testNotification:testBrowserNotification,testSound:testAlarmSound
    };
    document.getElementById("settingsAlarmEnabled")?.addEventListener("change",event=>setAlarmEnabled(event.target.checked));
    document.getElementById("settingsSoundEnabled")?.addEventListener("change",event=>setSoundEnabled(event.target.checked));
    document.getElementById("settingsBrowserNotifications")?.addEventListener("change",event=>setBrowserNotificationsEnabled(event.target.checked));
    document.getElementById("settingsRequestNotificationPermission")?.addEventListener("click",requestBrowserNotificationPermission);
    document.getElementById("settingsTestNotification")?.addEventListener("click",async()=>{
      const result=await testBrowserNotification();
      const el=document.getElementById("settingsNotificationPermission");if(el)el.textContent=result.message;
    });
    document.getElementById("settingsTestSound")?.addEventListener("click",async()=>{
      const result=await testAlarmSound();
      const el=statusEl();if(el)el.textContent=result.message;
    });
    refreshAlertSettingsStatus();
    // Restore the saved sound preference on every dashboard load. Chrome may
    // still require a fresh gesture; show the enable button only in that case.
    tryRestoreSound();
    // Any ordinary user gesture can satisfy Chrome's autoplay policy; no
    // dedicated setup click is needed if this succeeds.
    window.addEventListener("pointerdown",()=>{
      if(soundBlocked)tryRestoreSound();
    },{once:true,passive:true});
    document.getElementById("ackFirstMileAlarm")?.addEventListener("click",acknowledge);
    function checkForNewUnassigned(){
      const now=currentUnassigned();
      if(knownUnassigned===null){knownUnassigned=now;return;}
      let added=0;now.forEach(k=>{if(!knownUnassigned.has(k))added++;});
      knownUnassigned=now;
      if(added)startAlarm(added);
    }
    window.__badocCheckNewUnassigned=checkForNewUnassigned;
    // Unassigned groups are checked directly after the Pickup dataset is rebuilt.
    // Do not observe the virtualized table DOM: scrolling only swaps visible rows.
    // Check frequently so background-tab timer throttling does not create duplicate clicks.
    setInterval(()=>{
      const p=manilaParts(),hm=p.hour+":"+p.minute,key=p.year+"-"+p.month+"-"+p.day+" "+hm;
      if(!schedule.has(hm)||lastAutoRun===key)return;
      const btn=document.getElementById("syncFirstMileAll");
      if(!btn||btn.disabled||btn.dataset.busy==="1")return;
      lastAutoRun=key;
      try{btn.click();const el=statusEl();if(el)el.textContent="Automatic Sync Pickup Orders triggered at "+hm+" (Philippine time).";}
      catch(e){console.error("Scheduled First Mile click failed:",e);lastAutoRun="";}
    },15000);
  })();
  let firstMileSearchTimer=0;
  $("firstMileCombinedSearch")?.addEventListener("input",()=>{
    clearTimeout(firstMileSearchTimer);
    firstMileSearchTimer=setTimeout(renderFirstMileCombined,120);
  });
  $("firstMileTaskStatusFilter")?.addEventListener("change",renderFirstMileCombined);
  $("copyFirstMileForSheet")?.addEventListener("click",async()=>{
    const sourceGroups=firstMileVisibleRows||[];
    // Exclude orders already canceled in yesterday's first-sync snapshot.
    // Current-day cancellations remain eligible for today's sheet.
    const todayParts=fmPickupBaselineDate().split("-").map(Number);
    const previousDate=new Date(Date.UTC(todayParts[0],todayParts[1]-1,todayParts[2]-1)).toISOString().slice(0,10);
    let previousOrderBaseline=null;
    try{
      previousOrderBaseline=await window.__badocPickupCloudReadBaseline?.("orders",previousDate);
    }catch(error){console.warn("Could not load yesterday's Pickup Orders baseline:",error);}
    const previousOrderStatuses=previousOrderBaseline?.byId||{};
    const hasCanceledCandidates=sourceGroups.some(group=>{
      if(group.taskOnly===true||group.isTaskOnlyInbounded===true||group.isTaskOnlyOnhold===true||group.taskDisabled===true)return false;
      const order=(group.eligibleOrders||[])[0];
      const status=fmNorm(order?fmPickupOrderStatus(order)||fmOrderSheetStatus(order):"");
      return ["canceled","cancelled","disabled"].includes(status);
    });
    // Do not silently copy ambiguous canceled rows when yesterday's history
    // cannot be verified. The first-sync baseline is needed to distinguish
    // prior-day cancellations from cancellations that happened today.
    if(hasCanceledCandidates&&(!previousOrderBaseline?.byId||!Object.keys(previousOrderBaseline.byId).length)){
      const copyBtn=$("copyFirstMileForSheet");
      if(copyBtn){
        const original=copyBtn.textContent;
        copyBtn.textContent="Yesterday's baseline unavailable";
        setTimeout(()=>{if(copyBtn.isConnected)copyBtn.textContent=original;},3000);
      }
      return;
    }
    let skippedPreviousDayCanceled=0;
    const groups=sourceGroups.filter(group=>{
      if(group.taskOnly===true||group.isTaskOnlyInbounded===true||group.isTaskOnlyOnhold===true)return true;
      const order=(group.eligibleOrders||[])[0];
      if(!order)return true;
      const id=fmNorm(fmOrderId(order));
      const previousStatus=fmNorm(previousOrderStatuses[id]?.status);
      const wasAlreadyCanceled=["canceled","cancelled","disabled"].includes(previousStatus);
      // A currently matched Disabled task is direct evidence and must remain
      // eligible for copying, even when yesterday's first-sync snapshot had
      // already recorded the order as cancelled.
      const skipHistoricalCancellation=wasAlreadyCanceled&&group.taskDisabled!==true;
      if(skipHistoricalCancellation)skippedPreviousDayCanceled++;
      return !skipHistoricalCancellation;
    });
    const clean=value=>String(value??"").replace(/[\t\r\n]+/g," ").trim();
    // Copy for Sheet maps Inbounded and Picked Up to the sheet's "Picked - Up" label.
    // Other standalone task statuses (for example Accepted) are written to 5PM STATUS.
    // This conversion is local to the copy action; Pickup UI/export keep their own statuses.
    const sheetPickupStatus=value=>{
      const status=String(value??"").trim();
      const key=fmNorm(status);
      if(key==="canceled"||key==="cancelled"||key.startsWith("cancelled"))return "Cancelled";
      if(key==="accepted")return "Assigned";
      return ["inbounded","pickedup"].includes(key) ? "Picked - Up" : status;
    };
    const lines=[];
    // Column positions follow the user's 16 spreadsheet headers exactly.
    // Date is today's Philippine date; parcel measurement and tracking fields
    // remain blank until populated manually or from a separate verified source.
    const sheetDate=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"
    }).format(new Date());
    for(const group of groups){
      const orders=group.eligibleOrders||[];
      const assignedRider=fmAssignedRiderDisplay(group)==="—"?"":fmAssignedRiderDisplay(group);
      if(group.taskOnly===true||group.isTaskOnlyInbounded===true||group.isTaskOnlyOnhold===true){
        const task=fmLatestTask(group)||group.tasks?.[0]||{};
        const pointId=fmPickupPointId(task)||group.pickupPointId||"";
        const taskNumber=fmValue(task,["Pickup Task Number","Task Number","Pickup Task No","Task ID","task_id","pickup_task_number"]);
        const taskStatus=fmCombinedPickupStatus(group)||(group.isTaskOnlyInbounded?"Inbounded":"Onhold");
        const isAcceptedTask=fmNorm(taskStatus)==="accepted";
        const useDefaultPackaging=isAcceptedTask||group.isTaskOnlyOnhold===true;
        const cells=[
          sheetDate,             // Date (Asia/Manila)
          pointId,               // Pickup Point ID
          "",                    // No verified pickup Order ID in SPX Tasks export
          useDefaultPackaging ? "Non-bulky" : "", // Bulky type
          "",                    // total_sc_weight
          "",                    // sc_max_item_max_dimension
          "",                    // sc_sum_item_height
          "",                    // packaging_type
          assignedRider,         // Assigned Rider from SPX Tasks
          useDefaultPackaging ? "TRUE" : "", // Printed AWB checkbox
          useDefaultPackaging ? "Pouch - M" : "", // Packaging Material
          (group.isTaskOnlyInbounded===true||group.isTaskOnlyOnhold===true) ? "" : sheetPickupStatus(taskStatus), // Preserve special Inbounded/OnHold behavior
          "",                    // 7PM STATUS
          "",                    // 9PM STATUS
          "",                    // EOD Status
          ""                    // Remarks must remain blank
        ];
        lines.push(cells.map(clean).join("\t"));
        continue;
      }
      if(orders.length!==1)continue;
      // Pickup Orders are authoritative for the point ID; task rows supply
      // only the Assigned Rider name above.
      const pointId=fmPickupPointId(orders[0])||group.pickupPointId||"";
      for(const order of orders){
        const cells=[
          sheetDate,       // Column 1 - date (Asia/Manila)
          pointId,         // pickup_point_id
          fmOrderId(order),// pickup_order_id
          "Non-bulky",     // bulky_type
          "",              // total_sc_weight
          "",              // sc_max_item_max_dimension
          "",              // sc_sum_item_height
          "",              // packaging_type
          assignedRider,   // ASSIGNED RIDER - from Pickup Tasks export
          "TRUE",          // Printed AWB?
          "Pouch - M",     // Packaging Material to be used
          sheetPickupStatus(fmCombinedPickupStatus(group)), // 5PM STATUS
          "",              // 7PM STATUS
          "",              // 9PM STATUS
          "",              // EOD Status
          ""               // Remarks
        ];
        lines.push(cells.map(clean).join("\t"));
      }
    }
    if(!lines.length)return;
    const payload=lines.join("\r\n");
    const button=$("copyFirstMileForSheet");
    let copied=false;
    try{
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(payload);copied=true;}
    }catch(_){}
    if(!copied){
      const area=document.createElement("textarea");
      area.value=payload;area.setAttribute("readonly","");
      area.style.position="fixed";area.style.left="-9999px";area.style.top="0";
      document.body.appendChild(area);area.select();
      try{copied=document.execCommand("copy");}catch(_){copied=false;}
      area.remove();
    }
    if(button){
      const original=`Copy for Sheet (${lines.length})`;
      button.textContent=copied?`Copied ${lines.length} rows`:"Copy failed";
      button.dataset.copyState=copied?"success":"error";
      setTimeout(()=>{if(button.isConnected){button.textContent=original;button.dataset.copyState="";}},2200);
    }
  });
  $("downloadFirstMileCombined")?.addEventListener("click",()=>{
    // Export all currently visible Pickup Order and standalone Pickup Task rows.
    const exportRows=firstMileVisibleRows||[];
    if(!exportRows.length)return;
    const headers=["Order Number","Pickup Task Number","Pickup Point ID","Seller Name","Pickup Type","ETA / Create Time","Status","Assigned Rider"];
    const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const lines=[headers.map(q).join(","),...exportRows.map(g=>{
      const order=g.eligibleOrders?.[0]||{};
      const task=fmLatestTask(g)||g.tasks?.[0]||{};
      return [
        fmOrderId(order),
        fmPickupTaskNumber(task),
        fmPickupPointId(order)||fmPickupPointId(task)||g.pickupPointId,
        fmSellerName(order)||fmSellerName(task)||fmPickupPointName(task),
        fmValue(task,["Pickup Type","Task Type","Type","pickup_type","task_type","pickup_type_name"]),
        fmValue(order,["ETA","Estimated Time of Arrival","Estimated Arrival Time","Pickup ETA","eta_date","eta_time"])||
          fmValue(task,["Create Time","Task Create Time","Created Time","create_time","ctime"]),
        fmCombinedPickupStatus(g),
        fmAssignedRiderDisplay(g)
      ].map(q).join(",");
    })];
    download("badoc_first_mile_combined_"+new Date().toISOString().slice(0,10)+".csv",lines.join("\r\n"));
  });
  $("downloadFirstMileOrders")?.addEventListener("click",()=>download("orders"));
  $("downloadFirstMileTasks")?.addEventListener("click",()=>download("tasks"));
  ["orders","tasks"].forEach(kind=>{
    const orders=kind==="orders",key=orders?"badoc_first_mile_orders_csv_local_v1":"badoc_first_mile_tasks_csv_local_v1";
    try{
      const r=JSON.parse(localStorage.getItem(key)||"null");
      if(r?.csvText){
        const status=$(orders?"firstMileOrdersStatus":"firstMileTasksStatus");
        const result=$(orders?"firstMileOrdersResult":"firstMileTasksResult");
        const dl=$(orders?"downloadFirstMileOrders":"downloadFirstMileTasks");
        if(status)status.textContent=`Saved locally · ${Number(r.rowCount||0).toLocaleString()} rows · ${new Date(r.savedAt).toLocaleString("en-PH")}`;
        if(result)result.textContent=`${Number(r.rowCount||0).toLocaleString()} rows stored on this device · SPX task ${r.taskId||"—"}`;
        if(dl)dl.disabled=false;
      }
    }catch(_){}
  });
  renderFirstMileCombined();
  window.__badocUpdateFirstMileLastUpdated?.();
})();

// Cache the static navigation collections; these nodes are created with the app shell.
var badocNavigationPageNodes=Array.from(document.querySelectorAll(".page"));
var badocNavigationButtons=Array.from(document.querySelectorAll(".nav button"));
var badocNavigationTitles={homeDashboard:"Dashboard",dashboard:"Planning Board",actualScannedByRiders:"Actual Scanned by Riders",volumeForecastBoard:"Volume Forecast",kpi:"KPI",records:"Parcel Records",linehaul:"Linehaul Task",receivedChecking:"Dispatch",podPoohChecker:"POD/POOH Checker",misrouted:"Misrouted Parcels",dailyRiderPerformance:"Rider Performance",ridersData:"Riders Data",dailyHistory:"EOD Data",reports:"Reports",instructions:"Instructions",firstMile:"Pickup",settings:"Settings"};
var badocMenuRenderToken=0;

function showPage(p){
 const page=$(p);
 badocNavigationPageNodes.forEach(x=>x.classList.remove("active"));
 if(page)page.classList.add("active");
 badocNavigationButtons.forEach(x=>x.classList.toggle("active",x.dataset.page===p));
 $("pageTitle").textContent=badocNavigationTitles[p]||p.replace(/^\w/,c=>c.toUpperCase()).replace("Towns","Town Management");
 document.body.classList.toggle("pickup-page-active",p==="firstMile");

 // Let the selected page paint first. A newer menu selection cancels queued work.
 const renderToken=++badocMenuRenderToken;
 const renderMenuContent=()=>{
   if(renderToken!==badocMenuRenderToken||!page||!page.classList.contains("active"))return;
   try{
     if(p==="firstMile")window.__badocRenderFirstMileCombined?.();
     if(p==="linehaul")renderLinehaul();
     if(p==="dailyRiderPerformance")renderRiderPerformance();
     if(p==="actualScannedByRiders")window.__badocRenderActualScannedByRiders?.();
     // Operational metrics are already refreshed on startup, after data changes,
     // and by the 30-second operation-runtime refresh. Do not recalculate them
     // synchronously every time the user opens Volume Forecast.
     if(p==="volumeForecastBoard")window.__badocRenderForecastBoard?.();
   }catch(error){console.warn("Menu render failed for "+p+":",error);}
 };
 if(page&&["firstMile","linehaul","dailyRiderPerformance","actualScannedByRiders","volumeForecastBoard"].includes(p)){
   const schedule=()=>window.setTimeout(renderMenuContent,0);
   if(typeof window.requestAnimationFrame==="function")window.requestAnimationFrame(schedule);
   else schedule();
 }

 if(p==="actualScannedByRiders"||p==="volumeForecastBoard"){
   document.getElementById("planningBoardNav")?.classList.add("open");
   document.getElementById("planningBoardToggle")?.setAttribute("aria-expanded","true");
 }else if(p!=="dashboard"){
   const nav=document.getElementById("planningBoardNav"),toggle=document.getElementById("planningBoardToggle");
   if(nav)nav.classList.remove("open");if(toggle)toggle.setAttribute("aria-expanded","false");
 }
}
$("parcelIncomingVolumeBtn")?.addEventListener("click",()=>{
  const next=!parcelIncomingEnabled();
  try{localStorage.setItem(PARCEL_INCOMING_KEY,next?"1":"0")}catch(e){}
  render();
  saveParcelIncomingPreference(next);
});
window.addEventListener("load",()=>{
  window.__badocSyncParcelIncomingPreference?.();
  setInterval(()=>window.__badocSyncParcelIncomingPreference?.(),20000);
});

const FLEET_PRODUCTIVITY_KEY="badoc_fleet_productivity_v1";
function initFleetProductivity(){
  const input=$("fleetProductivity");
  if(!input)return;
  try{
    const saved=localStorage.getItem(FLEET_PRODUCTIVITY_KEY);
    if(saved!==null && saved!==""){const n=Number(saved);input.value=String(Number.isFinite(n)?Math.max(0,Math.round(n*100)/100):0);}
  }catch(e){}
  input.addEventListener("input",()=>{
    const raw=String(input.value??"");
    if(raw==="")return;
    const n=Number(raw);
    if(!Number.isFinite(n)){input.value="";return;}
    const value=Math.max(0,Math.round(n*100)/100);
    if(String(value)!==raw)input.value=String(value);
    try{localStorage.setItem(FLEET_PRODUCTIVITY_KEY,String(value))}catch(e){}
  });
}
initFleetProductivity();
$("misroutedKpi").onclick=()=>showPage("misrouted");
$("misroutedKpi").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();showPage("misrouted")}};
// Instructions are intentionally static. Edit the text in the #instructionsContent element above.

document.querySelectorAll(".nav button[data-page]").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
let parcelRecordFilterTimer=null;
let parcelRecordFilterFrame=null;
let sharedFilterPublishChain=Promise.resolve();
let sharedFilterLocalEditSeq=0;
let sharedFilterLastLocalEditAt=0;
let parcelFilterInteractionLockUntil=0;
function parcelFilterIsLocked(){return Date.now()<parcelFilterInteractionLockUntil;}
function parcelFilterSnapshot(){return {search:String($("recordSearch")?.value||""),town:selectedValues("recordTown"),station:selectedValues("recordStation"),status:selectedValues("recordStatus")};}
function restoreParcelFilterSnapshot(state){
  if(!state)return;
  if($("recordSearch"))$("recordSearch").value=String(state.search||"");
  [["recordTown",state.town||[]],["recordStation",state.station||[]],["recordStatus",state.status||[]]].forEach(([id,vals])=>{
    const el=$(id); if(!el)return; const wanted=new Set((Array.isArray(vals)?vals:[]).map(String));
    [...el.options].forEach(o=>o.selected=wanted.has(String(o.value)));
  });
  if(window.syncCustomParcelFilters) window.syncCustomParcelFilters();
}

function scheduleParcelRecordFilter(immediate=false){
  if(sharedFilterSyncApplying)return;
  if(parcelRecordFilterTimer)clearTimeout(parcelRecordFilterTimer);
  if(parcelRecordFilterFrame)cancelAnimationFrame(parcelRecordFilterFrame);
  if(immediate&&sharedFilterSyncTimer){
    clearTimeout(sharedFilterSyncTimer);
    sharedFilterSyncTimer=null;
  }
  const table=$("recordTable");
  if(table)table.classList.add("record-filter-updating");
  const run=()=>{
    parcelRecordFilterFrame=requestAnimationFrame(()=>{
      parcelRecordFilterFrame=null;
      window.__parcelRecordPage=1;
      renderRecords(true);
      queueSharedFilterPublish();
      requestAnimationFrame(()=>table?.classList.remove("record-filter-updating"));
    });
  };
  if(immediate)run();
  else parcelRecordFilterTimer=setTimeout(run,140);
}
const recordSearchEl=$("recordSearch");
if(recordSearchEl){
  recordSearchEl.addEventListener("input",()=>{
    // A new local edit invalidates any older queued filter state.
    sharedFilterLocalEditSeq++;
    sharedFilterLastLocalEditAt=Date.now();
    parcelFilterInteractionLockUntil=Date.now()+5000;
    const isEmpty=String(recordSearchEl.value||"").trim()==="";
    scheduleParcelRecordFilter(isEmpty);
  });
}
["recordTown","recordStation","recordStatus"].forEach(id=>{
  const e=$(id); if(!e)return;
  e.addEventListener("change",()=>{
    sharedFilterLocalEditSeq++;
    sharedFilterLastLocalEditAt=Date.now();
    const snap=parcelFilterSnapshot();
    parcelFilterInteractionLockUntil=Date.now()+5000;
    scheduleParcelRecordFilter(true);
    setTimeout(()=>restoreParcelFilterSnapshot(snap),0);
    setTimeout(()=>restoreParcelFilterSnapshot(snap),100);
    setTimeout(()=>restoreParcelFilterSnapshot(snap),500);
  });
});
$("clearRecordFilters").onclick=async()=>{
  sharedFilterLocalEditSeq++;
  sharedFilterLastLocalEditAt=Date.now();
  if(parcelRecordFilterTimer){clearTimeout(parcelRecordFilterTimer);parcelRecordFilterTimer=null;}
  if(parcelRecordFilterFrame){cancelAnimationFrame(parcelRecordFilterFrame);parcelRecordFilterFrame=null;}
  if(sharedFilterSyncTimer){clearTimeout(sharedFilterSyncTimer);sharedFilterSyncTimer=null;}
  $("recordSearch").value="";
  ["recordTown","recordStation","recordStatus"].forEach(id=>{
    const e=$(id);
    if(e)[...e.options].forEach(o=>o.selected=false);
  });
  window.__parcelRecordPage=1;
  renderRecords();
  if(window.syncCustomParcelFilters) window.syncCustomParcelFilters();

  // Queue the empty state behind any already-running publish so an older
  // search can never become the final shared filter state.
  if(sharedFilterSyncClient&&sharedFilterSyncReady){
    const clearSeq=sharedFilterLocalEditSeq;
    sharedFilterPublishChain=sharedFilterPublishChain.then(async()=>{
      if(clearSeq!==sharedFilterLocalEditSeq)return;
      try{
        const emptyState={search:"",town:[],station:[],status:[]};
        const updated=new Date().toISOString();
        const r=await sharedFilterSyncClient.from("shared_filter_state").upsert(
          {id:"global",state:emptyState,updated_at:updated},{onConflict:"id"}
        );
        if(r.error)throw r.error;
        sharedFilterLastUpdatedAt=updated;
        if(sharedFilterSyncChannel){
          await sharedFilterSyncChannel.send({type:"broadcast",event:"badoc-filter",payload:{state:emptyState,updated_at:updated}});
        }
      }catch(err){console.warn("Clear filter publish failed:",err)}
    });
  }
};
$("misSearch").addEventListener("input",renderMis);
function exportValidFiltered(){
  if(!current){alert("There is no current upload to export.");return;}
  // Export the same merged parcel population used in Parcel Records, including
  // the latest Assigned Today SPX Forward/Return status and pickup-time fields.
  const all=typeof getParcelRecordRows==="function"
    ?getParcelRecordRows()
    :(Array.isArray(current.valid)?current.valid:[]);
  const filtered=Array.isArray(window.__parcelRecordFiltered)?window.__parcelRecordFiltered:all;
  const active=recordFiltersActive();
  const rows=active?filtered:all;
  if(!rows.length){alert("There are no matching parcel records to export.");return;}
  download(`valid-parcels-${active?"filtered":"all"}.csv`,csv(rows));
}
function updateRecordExportButton(){
  const b=$("exportValid");if(!b)return;
  const filtered=Array.isArray(window.__parcelRecordFiltered)?window.__parcelRecordFiltered:[];
  b.textContent=recordFiltersActive()?`Export filtered CSV (${filtered.length.toLocaleString()})`:"Export valid CSV";
}
$("addExceptionTracking").onclick=addExceptionTrackingNumber;
$("exceptionTrackingInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addExceptionTrackingNumber()}});
$("clearExceptionTracking").onclick=clearExceptionTrackingNumbers;
renderExceptionTracking();
$("exportValid").onclick=exportValidFiltered;$("exportMis").onclick=()=>current&&download("misrouted-parcels.csv",csv(current.mis));
$("addBadoc").onclick=()=>addTown("badoc");$("addPinili").onclick=()=>addTown("pinili");
$("backup").onclick=()=>download("parcel-dashboard-backup.json",JSON.stringify({towns,batches},null,2),"application/json");
$("restoreBtn").onclick=()=>$("restoreFile").click();$("restoreFile").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);towns=x.towns;batches=x.batches;current=batches[0]||null;saveTownSettings();render();alert("Backup restored.")}catch(err){alert("Invalid backup file.")}};r.readAsText(f)};
$("resetCfr1").onclick=async()=>{
  if(!confirm("Reset the shared CFR1 daily ledger and 7:00 AM count freeze for all devices?\n\nThis does not delete Parcel Count uploads, Linehaul data, Pickup data, or Exemptions. CFR1 will rebuild from parcel data currently available on this device.\n\nContinue?"))return;
  const button=$("resetCfr1"),status=$("cfr1CloudSyncStatus");
  if(button){button.disabled=true;button.textContent="Resetting CFR1…";}
  try{
    const reset=window.__badocCfr1CloudSync&&window.__badocCfr1CloudSync.resetCloud;
    if(typeof reset!=="function")throw new Error("CFR1 cloud reset service is unavailable.");
    await reset();
    window.__badocCfr1LedgerMemory=null;
    if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
    if(status)status.textContent="CFR1 reset completed; rebuilding from available parcel data.";
    alert("The shared CFR1 ledger and count freeze have been reset. Operational uploads were retained.");
  }catch(error){
    console.error("Reset CFR1 failed:",error);
    if(status)status.textContent=("CFR1 reset failed — "+String(error&&error.message||error)).slice(0,260);
    alert("CFR1 was not reset. Operational uploads were retained.\n\n"+String(error&&error.message||error));
  }finally{
    if(button){button.disabled=false;button.textContent="Reset CFR1";}
  }
};

$("clearData").onclick=async()=>{
  if(!confirm("Clear operational uploads and working data from this device and their shared cloud copies?\n\nThis removes Upload Exported parcel batches, Linehaul Task data, First Mile Pickup Orders/Tasks and the Pickup Point ID/name directory, plus Exemptions.\n\nCFR1 is retained and is NOT reset by this action. Town/station settings, Riders Data, Daily History, and dashboard preferences are also retained.\n\nContinue?"))return;
  const clearBtn=$("clearData");
  if(clearBtn){clearBtn.disabled=true;clearBtn.textContent="Clearing data…";}
  try{
    const db=await openDB();
    if(db)await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error("aborted"));
    });
    if(typeof window.__badocCloudClearOnholdToday==="function")await window.__badocCloudClearOnholdToday();
    else await badocClearOnholdExportRows();
    batches=[];
    current=null;

    // Remove the Pickup menu's separately stored Orders and Tasks exports.
    if(typeof window.__badocClearLocalPickupData==="function")window.__badocClearLocalPickupData();
    else{
      ["badoc_first_mile_orders_csv_local_v1","badoc_first_mile_tasks_csv_local_v1"].forEach(k=>localStorage.removeItem(k));
      window.__badocRenderFirstMileCombined?.();
    }
    // Settings > Clear all data also clears the saved Pickup Point ID/name directory.
    localStorage.removeItem("badoc_first_mile_point_names_v1");
    window.__badocRenderFirstMileCombined?.();

    /* Linehaul Task uses localStorage, not the parcel IndexedDB store. */
    ["badoc_linehaul_tasks_town_v1","badoc_linehaul_packed_rows_v1","badoc_linehaul_blank_packed_rows_v1","badoc_linehaul_export_total_v1","badoc_linehaul_export_unique_v1"].forEach(k=>localStorage.removeItem(k));
    if(typeof linehaulTasks!=="undefined")linehaulTasks=[];
    const lhFile=document.getElementById("linehaulCsvFile");if(lhFile)lhFile.value="";
    const lhBody=document.getElementById("linehaulBody");if(lhBody)lhBody.innerHTML='<tr><td colspan="5" class="empty">No linehaul task and town data.</td></tr>';
    const lhStatus=document.getElementById("linehaulStatus");if(lhStatus)lhStatus.textContent="0 tasks";
    const lhTotal=document.getElementById("lhKpiTotal");if(lhTotal)lhTotal.textContent="0";
    const lhDoid=document.getElementById("lhKpiDoid");if(lhDoid)lhDoid.textContent="0";
    if(typeof renderLinehaul==="function")renderLinehaul();

    // Clear exemption local state and synchronize the empty list to Dispatch/cloud.
    exceptionTrackingNumbers=[];
    saveExceptionTrackingNumbers();
    renderExceptionTracking();
    syncExemptionsToReceivedChecking();
    if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
    if(typeof updateRecordExportButton==="function")updateRecordExportButton();

    if(typeof window.__badocClearAllSharedData==="function")await window.__badocClearAllSharedData({includePickupNames:true});
    if(typeof cloudExceptionWrite==="function")await cloudExceptionWrite("clear","");
    render();
    alert("Operational uploads, Linehaul Task data, Exemptions, and saved Pickup Orders/Tasks have been cleared. CFR1, Town/station settings, Riders Data, Daily History, and dashboard preferences were kept.");
    window.location.reload();
  }catch(err){
    console.error("Clear all data failed:",err);
    alert("Operational data could not be cleared completely. Check the shared cloud connection and retry.\n\n"+(err?.message||err));
  }finally{
    if(clearBtn){clearBtn.disabled=false;clearBtn.textContent="Clear all data";}
  }
};

/*
 V1.10 KPI CONNECTION
 Set KPI_API_URL to the deployed Google Apps Script Web App URL.
 Example: https://script.google.com/macros/s/DEPLOYMENT_ID/exec
 The Apps Script should return JSON for the active sheet.
*/
function kpiCsv(text){
  const out=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}
    else if(c===','&&!q){row.push(cell);cell=""}
    else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell="";if(row.some(x=>x.trim()))out.push(row);row=[]}
    else cell+=c;
  }
  if(cell!==""||row.length){row.push(cell);out.push(row)}
  return out;
}
function kn(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ")}
function kv(id,v){const e=$(id);if(e)e.textContent=(v===undefined||v==="")?"—":v}

async function loadLiveKPI(forceRefreshArg){
  const SHEET_ID="11heDz_BMJPM9UDXEZ5nF4cyi6t53pbcLk--1cI62-70";
  const GID="0";
  const REFRESH_MS=5*60*1000;
  const STATION_NAME="Badoc Hub";
  const forceRefresh=forceRefreshArg===true||!!(forceRefreshArg&&typeof forceRefreshArg==="object");
  const ensureRefreshTimer=()=>{
    if(!window.__kpiRefreshTimer)window.__kpiRefreshTimer=__badocEvery(()=>loadLiveKPI(true),REFRESH_MS);
  };
  if(window.__badocKpiLoadPromise)return window.__badocKpiLoadPromise;
  const now=Date.now();
  const lastSuccess=Number(window.__badocKpiLastSuccessAt)||0;
  const lastAttempt=Number(window.__badocKpiLastAttemptAt)||0;
  if(!forceRefresh&&lastSuccess&&now-lastSuccess<REFRESH_MS){ensureRefreshTimer();return;}
  if(!forceRefresh&&lastAttempt>lastSuccess&&now-lastAttempt<30000){ensureRefreshTimer();return;}
  window.__badocKpiLastAttemptAt=now;

  const status=t=>{const e=$("kpiStatus");if(e)e.textContent=t};
  const setText=(id,v)=>{const e=$(id);if(e)e.textContent=(v==null||String(v).trim()==="")?"—":String(v).trim()};
  const norm=v=>String(v??"").trim().toLowerCase().replace(/\s+/g," ");

  const groups=[
    ["COST METRICS",["Fleet Productivity (Points)","Backroom Productivity","New Rider Utilization %","4WH MTD Headcount","4WH Bulky %"]],
    ["LEAD TIME METRICS",["Clear Floor Rate (CFR1 - Early Dispatch)","Success Rate (LM + RTS + NSS)","Loss Rate"]],
    ["BUYER & SELLER EXPERIENCE METRICS",["FM No Successful Pickup","FM Partial Pickup","LM POD Tier Performance","LM Onhold Validation"]],
    ["HUB COMPLIANCE & FRAUD METRICS",["Hub Compliance Score","Feeder Fraud","Linehaul Arrival Points","Hub BSC Additional Points"]]  ];

  const aliases={
    "Fleet Productivity (Points)":["Fleet Productivity (Points)","Fleet Productivity"],
    "Success Rate (LM + RTS + NSS)":["Success Rate (LM + RTS + NSS)"]
  };

  const cleanCell=v=>String(v??"").trim();
  const col=(row,label)=>{
    const want=norm(label);
    if(!want)return -1;
    let i=row.findIndex(v=>{const n=norm(v); return n!==""&&n===want});
    if(i<0)i=row.findIndex(v=>{const n=norm(v); return n!==""&&(n.includes(want)||want.includes(n))});
    return i;
  };
  const metricCol=(row,name)=>{
    for(const x of (aliases[name]||[name])){
      const i=col(row,x);
      if(i>=0)return i;
    }
    return -1;
  };

  const readGoogle=()=>new Promise((resolve,reject)=>{
    const cb="__badocKpiPull_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    let finished=false;
    const timer=setTimeout(()=>finish(new Error("Google KPI request timed out.")),15000);
    function finish(err,data){
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      try{delete window[cb]}catch(_){ }
      script.remove();
      err?reject(err):resolve(data);
    }
    window[cb]=payload=>{
      try{
        if(!payload||payload.status!=="ok"||!payload.table){
          throw new Error((payload?.errors||[]).map(x=>x.message||x.reason||"").filter(Boolean).join("; ")||"Google did not return KPI data.");
        }
        /* IMPORTANT: the first rows of this sheet are month/title rows, not
           column headers. Keep the complete returned matrix exactly as-is. */
        const rows=[];
        (payload.table.rows||[]).forEach(r=>{
          const cells=(r.c||[]).map(c=>c?(c.f!=null?c.f:(c.v!=null?c.v:"")):"");
          while(cells.length && cleanCell(cells[cells.length-1])==="")cells.pop();
          rows.push(cells);
        });
        finish(null,rows);
      }catch(err){finish(err)}
    };
    script.onerror=()=>finish(new Error("Google KPI endpoint could not be reached."));
    script.src=
      "https://docs.google.com/spreadsheets/d/"+SHEET_ID+
      "/gviz/tq?gid="+encodeURIComponent(GID)+
      "&headers=0"+
      "&tqx="+encodeURIComponent("out:json;responseHandler:"+cb)+
      "&tq="+encodeURIComponent("select *")+
      "&_ts="+Date.now();
    document.head.appendChild(script);
  });

  const monthFromRow=row=>{
    const m=String((row||[]).join(" ")).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/i);
    return m?m[0]:"";
  };
  const dateFromRow=row=>{
    const m=String((row||[]).join(" ")).match(/\b20\d{2}-\d{2}-\d{2}\b/);
    return m?m[0]:"";
  };
  const parseMonthDate=month=>{
    const t=Date.parse(month+" 1");
    return Number.isFinite(t)?t:0;
  };

  /*
   * Actual sheet structure returned by Google:
   *   month marker row
   *   month start-date / metric-name row
   *   PIC row
   *   dashboard-name row
   *   metric group row: overall | am prod | br prod | 3w_hc ...
   *   metadata/value header row: Region | Score | Grade | Remarks | Actual ...
   *   station KPI values row
   *
   * The sheet does NOT contain a "Current Station" column. It is the
   * Badoc Hub KPI sheet, so the station label is kept as the app context.
   */
  const findMonthBlocks=rows=>{
    const blocks=[];
    for(let i=0;i<rows.length;i++){
      const month=monthFromRow(rows[i]);
      if(!month)continue;

      let meta=-1;
      for(let j=i+1;j<Math.min(rows.length,i+7);j++){
        const x=(rows[j]||[]).map(norm);
        const hasRegion=x.includes("region");
        const hasScore=x.includes("score");
        const hasGrade=x.includes("grade");
        const hasRemarks=x.includes("remarks");
        const hasActual=x.includes("actual");
        if(hasRegion&&hasScore&&hasGrade&&hasRemarks&&hasActual){meta=j;break;}
      }
      if(meta<0)continue;

      let metricHeader=-1;
      for(let j=i+1;j<meta;j++){
        const x=(rows[j]||[]).map(norm);
        if(x.some(v=>v.includes("fleet productivity")) ||
           x.some(v=>v.includes("backroom productivity")) ||
           x.some(v=>v.includes("new rider utilization"))){
          metricHeader=j;
          break;
        }
      }
      let data=-1;
      for(let j=meta+1;j<Math.min(rows.length,meta+4);j++){
        const r=rows[j]||[];
        const nonEmpty=r.filter(v=>cleanCell(v)!=="").length;
        if(nonEmpty>=3){data=j;break;}
      }
      if(data<0)continue;

      blocks.push({
        month,
        monthDate:parseMonthDate(month),
        marker:i,
        startDate:dateFromRow(rows[i+1]||[]),
        metricHeader,
        meta,
        data
      });
    }
    return blocks;
  };

  const getMetricValue=(rows,dataIndex,metricHeaderIndex,name)=>{
    const metricRow=rows[metricHeaderIndex]||[];
    const data=rows[dataIndex]||[];
    const start=metricCol(metricRow,name);
    if(start<0)return {actual:"",target:"",targetB:"",targetA:"",weight:""};
    const simpleMetrics=["Loss Rate","FM No Successful Pickup","FM Partial Pickup","LM POD Tier Performance","LM Onhold Validation","Hub Compliance Score","Feeder Fraud","Linehaul Arrival Points","Hub BSC Additional Points"];
    if(simpleMetrics.includes(name)){
      return {actual:data[start]??"",target:data[start+1]??"",targetB:"",targetA:"",weight:data[start+2]??""};
    }
    // New Rider Utilization % has no B+ target in the source Google Sheet.
    // Its columns are Actual, Target to hit A+, and Weight.
    if(name==="New Rider Utilization %"){
      return {actual:data[start]??"",target:"",targetB:"",targetA:data[start+1]??"",weight:data[start+2]??""};
    }
    return {actual:data[start]??"",target:"",targetB:data[start+1]??"",targetA:data[start+2]??"",weight:data[start+3]??""};
  };

  const numeric=v=>{
    const n=parseFloat(String(v??"").replace(/[%,$,]/g,""));
    return Number.isFinite(n)?n:null;
  };

  const makeHealthSummary=(rows,mh,bi)=>{
    const metrics=rows[mh]||[], data=rows[bi]||[];
    let on=0,near=0,below=0,total=0;
    groups.forEach(([,names])=>names.forEach(name=>{
      const st=metricCol(metrics,name);
      if(st<0)return;
      const actual=numeric(data[st]);
      const b=numeric(data[st+1]);
      const a=numeric(data[st+2]);
      if(actual===null)return;
      total++;
      if(b===null)return;
      // 4WH MTD Headcount is a lower-is-better metric: a smaller actual
      // headcount earns the higher grade, unlike productivity/achievement metrics.
      const lowerIsBetter=["4WH MTD Headcount","Loss Rate","FM No Successful Pickup","FM Partial Pickup"].includes(name);
      if(a!==null && (lowerIsBetter ? actual<=a : actual>=a))on++;
      else if(lowerIsBetter ? actual<=b : actual>=b)near++;
      else below++;
    }));
    return {on,near,below,total};
  };

  const renderHealthSummary=(container,summary)=>{
    const box=document.createElement("div");
    box.className="kpi-v3-health";
    box.innerHTML=
      `<div><strong>${summary.on}</strong><span>At / Above A+</span></div>`+
      `<div><strong>${summary.near}</strong><span>At / Above B+</span></div>`+
      `<div><strong>${summary.below}</strong><span>Below B+</span></div>`+
      `<div><strong>${summary.total}</strong><span>Tracked</span></div>`;
    container.appendChild(box);
  };

  const renderMonth=(container,title,rows,block,summary)=>{
    const headers=rows[block.meta]||[];
    const data=rows[block.data]||[];
    const scoreColLocal=col(headers,"Score");

    const section=document.createElement("section");
    section.className="kpi-month-section";
    section.innerHTML=`<div class="kpi-month-title">${esc(title)}</div><div class="kpi-month-content"></div>`;
    const content=section.querySelector(".kpi-month-content");

    if(summary){
      setText("kpiMonth",block.month);
      setText("sheetScore",scoreColLocal>=0?data[scoreColLocal]:"");
      setText("kpiRegion",data[col(headers,"Region")]);
      setText("kpiSubregion",data[col(headers,"Subregion")]);
      setText("kpiStation",STATION_NAME);
      setText("kpiGrade",data[col(headers,"Grade")]);
      setText("kpiRemarks",data[col(headers,"Remarks")]);
    }

    groups.forEach(([group,names])=>{
      const cat=document.createElement("div");
      cat.className="kpi-category";
      cat.innerHTML=`<div class="kpi-category-title">${esc(group)}</div><div class="kpi-metric-grid"></div>`;
      const grid=cat.querySelector(".kpi-metric-grid");
      names.forEach(name=>{
        const v=getMetricValue(rows,block.data,block.metricHeader,name);
        // BADOC_HUB_COMPLIANCE_SCORE_WEIGHT_FALLBACK_V1

        if(name==="Hub Compliance Score"){
          const actualText=String(v.actual??"").trim();
          const weightText=String(v.weight??"").trim();
          if((!actualText || actualText==="—") && weightText){
            v.actual=v.weight;
            v.weight="";
          }
        }

        const card=document.createElement("div");
        card.className="kpi-metric v3-kpi-card";
        const simple=["Loss Rate","FM No Successful Pickup","FM Partial Pickup","LM POD Tier Performance","LM Onhold Validation","Hub Compliance Score","Feeder Fraud","Linehaul Arrival Points","Hub BSC Additional Points"].includes(name);
        card.innerHTML=`<h3>${esc(name)}</h3>`+
          `<div class="kpi-actual">${esc(v.actual||"—")}</div>`+
          `<div class="kpi-target-row">`+
          (simple
            ? `<div><span>Target</span><strong>${esc(v.target||"—")}</strong></div>`
            : name==="New Rider Utilization %"
              ? `<div><span>Target to hit A+</span><strong>${esc(v.targetA||"—")}</strong></div>`
              : `<div><span>Target to hit B+</span><strong>${esc(v.targetB||"—")}</strong></div>`+
                `<div><span>Target to hit A+</span><strong>${esc(v.targetA||"—")}</strong></div>`)+
          `<div><span>Weight</span><strong>${esc(v.weight||"—")}</strong></div>`+
          `</div>`;
        // Color every card when the source provides usable target data.
        // Metrics with B+/A+ thresholds use red/orange/green bands. Metrics
        // with a single Target use green when the target is met and red when
        // missed. For loss/failed/partial pickup rates, lower is better.
        const actualNum=numeric(v.actual), targetNum=numeric(v.target);
        const bNum=numeric(v.targetB), aNum=numeric(v.targetA);
        const lowerIsBetter=["4WH MTD Headcount","Loss Rate","FM No Successful Pickup","FM Partial Pickup"].includes(name);
        const meets=(actual,target)=>lowerIsBetter?actual<=target:actual>=target;
        const zeroGoodThresholdMetrics=["Hub Compliance Score","Feeder Fraud","Linehaul Arrival Points"];
        if(actualNum!==null && zeroGoodThresholdMetrics.includes(name)){
          if(actualNum===0) card.classList.add("kpi-status-a");
          else if(actualNum>=0.1 || actualNum<0) card.classList.add("kpi-status-below-b");
        }else if(actualNum!==null){
          if(aNum!==null || bNum!==null){
            if(aNum!==null && meets(actualNum,aNum)) card.classList.add("kpi-status-a");
            else if(bNum!==null && meets(actualNum,bNum)) card.classList.add("kpi-status-b");
            else if(aNum!==null || bNum!==null) card.classList.add("kpi-status-below-b");
          }else if(targetNum!==null){
            if(meets(actualNum,targetNum)){
              card.classList.add("kpi-status-a");
            }else{
              // Single-target metrics: orange when performance is within 5% of target,
              // red when it is more than 5% away. For a zero target, avoid division by zero.
              const gap=Math.abs(actualNum-targetNum);
              const nearTarget=targetNum!==0 && gap/Math.abs(targetNum)<=0.05;
              card.classList.add(nearTarget?"kpi-status-b":"kpi-status-below-b");
            }
          }
        }
        grid.appendChild(card);
      });
      content.appendChild(cat);
    });

    if(summary){
    }
    container.appendChild(section);
  };

  const KPI_CACHE_KEY="badoc_kpi_sheet_rows_v1";
  const readKpiCache=()=>{
    try{
      const cached=JSON.parse(localStorage.getItem(KPI_CACHE_KEY)||"null");
      if(cached&&cached.version===1&&Array.isArray(cached.rows)&&cached.rows.length&&Number(cached.savedAt)>0)return cached;
    }catch(e){}
    return null;
  };
  const writeKpiCache=rows=>{
    try{
      const payload=JSON.stringify({version:1,savedAt:Date.now(),rows});
      // Avoid filling browser storage if the source sheet unexpectedly grows very large.
      if(payload.length<=3*1024*1024)localStorage.setItem(KPI_CACHE_KEY,payload);
    }catch(e){
      console.warn("KPI cache write skipped:",e);
    }
  };

  const showError=msg=>{
    status("GOOGLE SHEET • UNAVAILABLE");
    const c=$("kpiCategories");
    if(c)c.innerHTML=`<div class="kpi-data-error">${esc(msg)}<br><button type="button" class="btn primary" id="kpiRetryBtn" style="margin-top:12px">↻ Retry KPI</button></div>`;
    $("kpiRetryBtn")?.addEventListener("click",()=>loadLiveKPI(true));
  };

  // Rendering is shared by the cached snapshot and the live response. This keeps
  // all existing month selection, KPI thresholds, grades, and scoring rules intact.
  const renderRows=rows=>{
    if(!rows||!rows.length)throw new Error("Google KPI sheet returned no data.");
    const blocks=findMonthBlocks(rows);
    if(!blocks.length)throw new Error("KPI month/value block not found.");

    blocks.sort((a,b)=>b.monthDate-a.monthDate||b.data-a.data);
    const current=blocks[0];
    const previous=blocks[1];
    const container=$("kpiCategories");
    if(!container)throw new Error("KPI display container not found.");
    container.innerHTML="";

    renderMonth(container,"CURRENT KPI • "+current.month,rows,current,true);

    if(previous){
      const details=document.createElement("details");
      details.className="kpi-v3-m1";
      const summary=document.createElement("summary");
      summary.className="m1-summary-toggle";
      const m1Headers=rows[previous.meta]||[];
      const m1Data=rows[previous.data]||[];
      const score=col(m1Headers,"Score");
      summary.innerHTML=`<span class="m1-summary-title">M-1 • ${esc(previous.month)}</span><span class="m1-summary-score"><small>OVERALL SCORE</small><strong>${esc(score>=0?(m1Data[score]||"—"):"—")}</strong></span>`;
      details.appendChild(summary);

      const inner=document.createElement("div");
      inner.className="kpi-m1-inner";
      const card=document.createElement("div");
      card.className="kpi-m1-summary-card";
      const grade=col(m1Headers,"Grade"), remarks=col(m1Headers,"Remarks"), region=col(m1Headers,"Region"), sub=col(m1Headers,"Subregion");
      card.innerHTML=`<div class="kpi-m1-summary-head"><div class="kpi-m1-summary-kicker">SHOWING SCORE FOR THE MONTH OF:</div><div class="kpi-m1-summary-month">${esc(previous.month)}</div><div class="kpi-m1-summary-score"><span>OVERALL SCORE</span><strong>${esc(score>=0?(m1Data[score]||"—"):"—")}</strong></div></div><div class="kpi-m1-summary-meta"><div><span>REGION</span><b>${esc(region>=0?(m1Data[region]||"—"):"—")}</b></div><div><span>SUBREGION</span><b>${esc(sub>=0?(m1Data[sub]||"—"):"—")}</b></div><div><span>CURRENT STATION</span><b>${esc(STATION_NAME)}</b></div><div><span>GRADE</span><b>${esc(grade>=0?(m1Data[grade]||"—"):"—")}</b></div><div><span>REMARKS</span><b>${esc(remarks>=0?(m1Data[remarks]||"—"):"—")}</b></div></div>`;
      inner.appendChild(card);
      details.appendChild(inner);
      container.appendChild(details);
      renderMonth(inner,"M-1 • "+previous.month,rows,previous,false);
    }
    // Notify Dashboard summary and attention widgets after DOM-ready so
    // consumers loaded later in the script bundle receive the update immediately.
    const notifyDashboardKpi=()=>{
      try{window.dispatchEvent(new Event("badoc-kpi-data-ready"));}catch(e){}
    };
    if(document.readyState==="loading"){
      document.addEventListener("DOMContentLoaded",notifyDashboardKpi,{once:true});
    }else{
      notifyDashboardKpi();
    }
    return true;
  };

  // Show the last successful sheet response before starting a network request.
  // A fresh snapshot avoids a new Google request on every reload; stale snapshots
  // remain visible while the live response refreshes in the background.
  let cachedSnapshot=readKpiCache();
  let cachedRendered=false;
  let cachedRowsJson="";
  if(cachedSnapshot){
    try{
      renderRows(cachedSnapshot.rows);
      cachedRendered=true;
      cachedRowsJson=JSON.stringify(cachedSnapshot.rows);
      window.__badocKpiLastSuccessAt=Number(cachedSnapshot.savedAt)||0;
      status("GOOGLE SHEET • CACHED • REFRESHING");
    }catch(cacheError){
      console.warn("Saved KPI cache could not be rendered; loading live sheet:",cacheError);
      cachedSnapshot=null;
    }
  }

  const run=async()=>{
    if(!cachedRendered)status("GOOGLE SHEET • CONNECTING");
    try{
      const rows=await readGoogle();
      if(!rows||!rows.length)throw new Error("Google KPI sheet returned no data.");
      const liveRowsJson=JSON.stringify(rows);
      // Do not rebuild all KPI cards if the live data is identical to the cache.
      if(!cachedRendered||liveRowsJson!==cachedRowsJson)renderRows(rows);
      writeKpiCache(rows);
      window.__badocKpiLastSuccessAt=Date.now();
      status("GOOGLE SHEET • LIVE • AUTO REFRESH 5 MIN");
    }catch(err){
      console.warn("KPI pull failed:",err);
      if(cachedRendered){
        status("GOOGLE SHEET • CACHED DATA • REFRESH FAILED");
      }else{
        showError(err?.message||"Unable to read the public KPI sheet.");
      }
    }
  };

  // If the saved snapshot is still within the five-minute refresh window, use it
  // without hitting Google. The timer below will fetch fresh data at the next interval.
  const cachedAge=cachedSnapshot?Date.now()-Number(cachedSnapshot.savedAt):Infinity;
  if(!forceRefresh&&cachedRendered&&cachedAge>=0&&cachedAge<REFRESH_MS){
    ensureRefreshTimer();
    return;
  }

  const request=run();
  window.__badocKpiLoadPromise=request;
  try{await request;}
  finally{
    if(window.__badocKpiLoadPromise===request)window.__badocKpiLoadPromise=null;
    ensureRefreshTimer();
  }
}

loadLiveKPI();
const LH_KEY="badoc_linehaul_tasks_town_v1";
const LH_PACKED_KEY="badoc_linehaul_packed_rows_v1";
const LH_BLANK_PACKED_KEY="badoc_linehaul_blank_packed_rows_v1";
const LH_EXPORT_TOTAL_KEY="badoc_linehaul_export_total_v1";
const LH_EXPORT_UNIQUE_KEY="badoc_linehaul_export_unique_v1";
let linehaulTasks=[];
function loadLinehaul(){
  try{
    linehaulTasks=JSON.parse(localStorage.getItem(LH_KEY)||"[]");
    if(!Array.isArray(linehaulTasks))linehaulTasks=[];
    linehaulTasks=linehaulTasks.filter(x=>x && (String(x.id||"").trim() || x.blank));
  }catch(e){linehaulTasks=[]}
}
function saveLinehaul(){localStorage.setItem(LH_KEY,JSON.stringify(linehaulTasks))}
function lhNum(v){const n=parseFloat(String(v??"").replace(/,/g,"").trim());return Number.isFinite(n)?n:0}
function lhHeaderIndex(headers,names){
  const clean=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const hs=Array.isArray(headers)?headers:[headers];
  return hs.map(clean).findIndex(h=>names.some(n=>{const x=clean(n);return h===x||h.includes(x)||x.includes(h)}));
}
function parseLinehaulCSV(text){
  text=String(text||"").replace(/^\uFEFF/,"");
  const rows=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}
    else if(c===','&&!q){row.push(cell);cell=""}
    else if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);cell="";
      if(row.some(x=>String(x).trim()!==""))rows.push(row);
      row=[];
    }else cell+=c;
  }
  if(cell!==""||row.length){row.push(cell);rows.push(row)}
  if(rows.length<2)throw Error("The exported file is empty.");

  const h=rows[0].map(x=>String(x).replace(/^\uFEFF/,"").trim());
  const data=rows.slice(1);
  const idx=(names)=>{
    const clean=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,"");
    return h.map(clean).findIndex(x=>names.some(n=>{const y=clean(n);return x===y||x.includes(y)||y.includes(x)}));
  };
  const ti=idx(["Line Haul Task ID","Linehaul Task ID","Line Haul Task"]);
  const spxi=idx(["SPX TN","SPX Tracking Number"]);
  const toi=idx(["TO Number","TO No","TONumber"]);
  const qi=idx(["TO Include Order Quantity","TO Include Order quantity","Include Order Quantity","Order Quantity"]);
  const ri=idx(["TO Received Order Quantity","TO Received Order quantity","Received Order Quantity","Received Quantity"]);
  const si=idx(["TO Status","Status","Order Status"]);
  if(ti<0)throw Error("Line Haul Task ID was not found in the exported file.");
  if(spxi<0)throw Error("SPX TN was not found in the exported file.");

  const groups={};
  data.forEach(r=>{
    const id=String(r[ti]??"").trim();
    const key=id||"__BLANK_LINEHAUL__";
    if(!groups[key])groups[key]={id,blank:!id,exportTOs:new Set(),exportQty:0,exportReceived:0,statuses:[],exportRows:[]};
    const g=groups[key];
    const spxTN=String(r[spxi]??"").trim();
    const to=toi>=0?String(r[toi]??"").trim():"";
    if(to)g.exportTOs.add(to);
    if(qi>=0)g.exportQty+=lhNum(r[qi]);
    if(ri>=0)g.exportReceived+=lhNum(r[ri]);
    if(si>=0&&String(r[si]??"").trim())g.statuses.push(String(r[si]).trim());
    g.exportRows.push({
      spxTN,to,qty:qi>=0?lhNum(r[qi]):0,received:ri>=0?lhNum(r[ri]):0,
      status:si>=0?String(r[si]??"").trim():""
    });
  });

  return Object.values(groups).map(g=>({
    id:g.id,blank:g.blank,exportTOs:[...g.exportTOs],exportQty:g.exportQty,
    exportReceived:g.exportReceived,
    status:g.statuses.length?(new Set(g.statuses).size===1?g.statuses[0]:"In Progress"):"Pending Receive",
    exportRows:g.exportRows
  }));
}
function normJoin(v){
  return String(v??"").trim().toUpperCase().replace(/[\s\-_.]/g,"");
}
function townFromParcel(r){
  return String(r?.["Town Name"]??"").trim().toUpperCase();
}
function trackingFromParcel(r){
  return String(r?.["SLS Tracking Number"]??"").trim();
}
function orderFromParcel(r){
  return String(r?.["Order ID"]??"").trim();
}

/* Exact sample-file relationship:
   inbound_to_from_spx.csv      : SPX TN
   export_forward_order.csv     : Order ID -> Town Name
*/
function buildForwardOrderIndex(records){
  const idx=new Map();
  (records||[]).forEach(r=>{
    const order=normJoin(r["Order ID"]);
    if(order)idx.set(order,r);
  });
  return idx;
}
function linehaulParcelOrderKey(value){
  return String(value??"")
    .trim()
    .replace(/^['"]+|['"]+$/g,"")
    .replace(/\s+/g,"")
    .toUpperCase();
}
function buildLinehaulParcelOrderIndex(parcelRows){
  const sourceRows=Array.isArray(parcelRows)?parcelRows:[];
  const orderIdOf=r=>(
    r?.orderId ??
    r?.orderID ??
    r?.["Order ID"] ??
    r?.["ORDER ID"] ??
    r?.["OrderID"] ??
    r?.spxTN ??
    r?.["SPX TN"]
  );
  const orderMap=new Map();
  sourceRows.forEach(r=>{
    const id=linehaulParcelOrderKey(orderIdOf(r));
    if(id)orderMap.set(id,r);
  });
  return orderMap;
}
function linehaulTownBreakdown(task, parcelRows, parcelOrderIndex){
  const out={};
  const sourceRows=Array.isArray(parcelRows)?parcelRows:[];
  const exportRows=Array.isArray(task?.exportRows)?task.exportRows:[];

  // Match the Linehaul SPX TN to Parcel Records Order ID. Reuse a caller-built
  // index when processing several task groups so Parcel Records are indexed once.
  const orderMap=parcelOrderIndex instanceof Map
    ?parcelOrderIndex
    :buildLinehaulParcelOrderIndex(sourceRows);

  const townOf=r=>(
    r?.town ??
    r?.Town ??
    r?.["Town"] ??
    r?.["Town Name"] ??
    r?.["TOWN NAME"] ??
    r?.destinationTown ??
    r?.destination_town ??
    r?.["Destination Town"]
  );

  exportRows.forEach(er=>{
    const spx=er?.spxTN ?? er?.["SPX TN"] ?? er?.["SPX TN ID"] ?? er?.orderId ?? er?.["Order ID"];
    const id=linehaulParcelOrderKey(spx);
    if(!id)return;

    const parcel=orderMap.get(id);
    if(!parcel)return;

    const town=String(townOf(parcel)||"").trim();
    if(!town)return;

    if(!out[town])out[town]={items:[],count:0};
    out[town].items.push({
      x:{...er,spxTN:er?.spxTN||spx,town},
      r:parcel
    });
    out[town].count++;
  });

  return out;
}
function renderLinehaulTownDashboard(){
  const el=$("linehaulTownDashboard");
  if(!el)return;
  const counts={};
  linehaulTasks.forEach(task=>{
    if(task.blank)return;
    Object.entries(task.townBreakdown||{}).forEach(([town,group])=>{
      const name=String(town||"").trim().toUpperCase();
      if(!name)return;
      counts[name]=(counts[name]||0)+(group.items||[]).length;
    });
  });

  const badoc=[
    ["TUROD","LABUT","CARAITAN"],
    ["SAUD","PAGSANAHAN NORTE","PAGSANAHAN SUR"],
    ["CANAAN (POB.)","GARRETA (POB.)"],
    ["PALTIT","LUBIGAN","BATO"],
    ["LA VIRGEN MILAGROSA (PAGUETPET)","MORONG","SANTA CRUZ NORTE","SANTA CRUZ SUR"],
    ["GABUT NORTE","GABUT SUR","NAPU","MABUSAG NORTE","MABUSAG SUR","PARANG","PASUC"],
    ["AR-ARUSIP","ALAY-NANGBABAAN (ALAY 15-B)","NAGREBCAN","BALBALDEZ"],
    ["ALOGOOG","LACUBEN","ARING"]
  ];
  const pinili=[
    ["UGUIS","CAMANGA","MADUPAYAS","LILIPUTEN","LUMBAAN-BICBICA","SACRITAN"],
    ["PURITAC","DALAYAP","NAGTRIGOAN","UPON"],
    ["APATUT-LUBONG","DARAT","CAPANGDANAN","GULPENG"],
    ["AGLIPAY","SANTO TOMAS","CABAROAN","BUANGA"],
    ["VALBUENA (POB.)","PAGDILAO (POB.)"],
    ["BADIO","BULBULALA","PUZOL","TARTARABANG"],
    ["SALANAP","BARBAR","BUNGRO","PUGAOAN"]
  ];

  function makeSection(title,groups){
    return `<div class="lh-town-section">
      <div class="lh-section-title">${esc(title)}</div>
      <div class="lh-town-grid">
        ${groups.map(group=>`<div class="lh-town-card">
          ${group.map(t=>`<div class="lh-town-row"><span>${esc(t)}</span><b>${(counts[t]||0).toLocaleString()}</b></div>`).join("")}
        </div>`).join("")}
      </div>
    </div>`;
  }
  el.innerHTML=makeSection("BADOC",badoc)+makeSection("PINILI",pinili);
}

function renderLinehaulDoidPanel(){
  const panel=$("lhDoidPanel"), list=$("lhDoidList");
  if(!panel||!list)return;

  const records=[];
  linehaulTasks.forEach(task=>{
    (task?.exportRows||[]).forEach(row=>{
      const tn=normJoin(row?.spxTN);
      if(tn)records.push({row,task});
    });
  });

  const groups=new Map();
  records.forEach(item=>{
    const tn=normJoin(item.row?.spxTN);
    if(!groups.has(tn))groups.set(tn,{display:String(item.row?.spxTN||"").trim(),items:[]});
    groups.get(tn).items.push(item);
  });

  const duplicates=[...groups.values()]
    .filter(g=>g.items.length>1)
    .sort((a,b)=>a.display.localeCompare(b.display));

  // Build Order ID -> parcel record index for Town Name.
  const forwardRecords=(typeof current!=="undefined"&&Array.isArray(current?.rows))
    ? current.rows : [];
  const orderIndex=buildForwardOrderIndex(forwardRecords);

  const val=(obj,names)=>{
    for(const n of names){
      const v=obj?.[n];
      if(v!==undefined&&String(v).trim()!=="")return String(v).trim();
    }
    return "";
  };

  const details=g=>{
    const first=g.items[0];
    const r=first.row||{};
    const townRec=orderIndex.get(normJoin(r.spxTN))||{};
    const town=townFromParcel(townRec)||val(r,["Town Name","Town","TownName"]);
    const currentStation=val(townRec,["Current Station","Current Station Name","CurrentStation"]) ||
      val(r,["Current Station","Current Station Name","CurrentStation"]);
    const destination=val(townRec,["Destination Station","Destination","Destination Station Name","DestinationStation"]) ||
      val(r,["Destination Station","Destination","Destination Station Name","DestinationStation"]);
    const status=val(townRec,["Status","Order Status","TO Status"]) ||
      val(r,["Status","Order Status","TO Status"]) || "";
    const task=String(first.task?.id||"").trim();

    return `<div class="lh-doid-detail">
      <div class="lh-doid-tn">${esc(g.display)}</div>
      <div class="lh-doid-fields">
        <div><span>Town Name</span><b>${esc(town||"—")}</b></div>
        <div><span>Current Station</span><b>${esc(currentStation||"—")}</b></div>
        <div><span>Destination Station</span><b>${esc(destination||"—")}</b></div>
        <div><span>Status</span><b>${esc(status||"—")}</b></div>
      </div>
      ${task?`<div class="lh-doid-task">Linehaul Task: ${esc(task)} · ${g.items.length} occurrences</div>`:""}
    </div>`;
  };

  list.innerHTML=duplicates.length
    ? duplicates.map(details).join("")
    : '<div class="lh-doid-empty">No duplicate SPX TN found.</div>';

  panel.style.display="block";
  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function refreshLinehaulIncomingVolume(){
  const el=document.getElementById("lhKpiIncoming");
  if(!el)return;
  let total=0;
  try{
    // Use the same unique, matched parcel population as the existing
    // checked-task incoming-linehaul calculation. Unchecked tasks are excluded.
    const incoming=typeof getParcelIncomingLinehaul==="function"
      ?getParcelIncomingLinehaul()
      :{total:0};
    total=Number(incoming?.total||0);
  }catch(error){
    console.warn("Total incoming linehaul volume could not refresh:",error);
  }
  el.textContent=(Number.isFinite(total)?total:0).toLocaleString();
}

function renderLinehaulKpis(){
  refreshLinehaulIncomingVolume();
  let doid=0;

  const allRows=[];
  linehaulTasks.forEach(task=>{
    if(Array.isArray(task?.exportRows)){
      allRows.push(...task.exportRows.filter(row=>!isExceptionRow({"SPX TN":row?.spxTN??row?.["SPX TN"]??row?.["SPX Tracking Number"]??""})));
    }
  });
  // Preserve the original Linehaul Task row total for this card.
  // The separate Total Incoming Volume card applies the Arriving In Time selection.

  // DOID remains a separate duplicate-SPX-TN group count.
  const counts=new Map();
  allRows.forEach(row=>{
    const tn=normJoin(row?.spxTN);
    if(tn)counts.set(tn,(counts.get(tn)||0)+1);
  });
  counts.forEach(n=>{if(n>1)doid++});

  const set=(id,v)=>{
    const e=document.getElementById(id);
    if(e)e.textContent=Number(v||0).toLocaleString();
  };

  set("lhKpiTotal",allRows.length);
  set("lhKpiDoid",doid);
}
function renderLinehaulCore(){
  renderLinehaulTownDashboard();
  renderLinehaulKpis();
  const body=$("linehaulBody");
  let rows=[], visibleTasks=0;

  // These parcel lookups are shared by every Linehaul Task. Building them
  // inside the task loop made menu navigation scale as tasks × parcel rows.
  const hasTaskRows=Array.isArray(linehaulTasks)&&linehaulTasks.some(task=>!task?.blank&&String(task?.id||"").trim());
  const allMisrouted=hasTaskRows&&Array.isArray(current?.mis)?current.mis:[];
  const misKey=r=>normJoin(r?.["SLS Tracking Number"]||r?.["Order ID"]||r?.["SPX TN"]||r?.["SPX Tracking Number"]||"");
  const taskMisMap=new Map();
  allMisrouted.forEach(r=>{
    const k=misKey(r);
    if(k&&!taskMisMap.has(k))taskMisMap.set(k,r);
  });
  const parcelOrderIndex=new Set();
  if(hasTaskRows){
    (current?.rows||[]).forEach(r=>{
      const k=normJoin(r?.["Order ID"]||r?.["SPX TN"]||r?.["SPX Tracking Number"]||"");
      if(k)parcelOrderIndex.add(k);
    });
  }
  const detailStore=window.__lhTaskDetails instanceof Map
    ?window.__lhTaskDetails
    :(window.__lhTaskDetails=new Map());
  detailStore.clear();

  linehaulTasks.forEach(task=>{
    const taskId=String(task.id||"").trim();
    if(!taskId || task.blank)return;

    const towns=task.townBreakdown||{};
    const validTowns=Object.keys(towns)
      .map(t=>String(t||"").trim())
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b));

    if(!validTowns.length)return;
    visibleTasks++;

    validTowns.forEach(town=>{
      const group=towns[town];
      (group.items||[]).forEach((item,n)=>{
        const x=item.x,r=item.r;
        // Never render a row with a blank task or town.
        if(!taskId || !town)return;
        rows.push(`<tr class="lh-detail ${n===0?"lh-first":""}">
          <td>${n===0?esc(taskId):""}</td>
          <td>${esc(x.spxTN||"—")}</td>
          <td>${n===0?`<b>${esc(town)}</b>`:""}</td>
          <td>${esc(x.to||"—")}</td>
          <td>${esc(x.received>0?"Received":task.status)}</td>
        </tr>`);
      });
    });
  });

  const shownTasks=linehaulTasks.filter(x=>{
    const id=String(x?.id||"").trim();
    const towns=Object.keys(x?.townBreakdown||{}).filter(t=>String(t||"").trim());
    return id&&towns.length;
  });
  // One complete dashboard for EACH Linehaul Task ID:
  // KPI cards first, then the exact same BADOC/PINILI town-card format.
  const taskTownSections=[];
  const badocGroups=[
    ["TUROD","LABUT","CARAITAN"],["SAUD","PAGSANAHAN NORTE","PAGSANAHAN SUR"],
    ["CANAAN (POB.)","GARRETA (POB.)"],["PALTIT","LUBIGAN","BATO"],
    ["LA VIRGEN MILAGROSA (PAGUETPET)","MORONG","SANTA CRUZ NORTE","SANTA CRUZ SUR"],
    ["GABUT NORTE","GABUT SUR","NAPU","MABUSAG NORTE","MABUSAG SUR","PARANG","PASUC"],
    ["AR-ARUSIP","ALAY-NANGBABAAN (ALAY 15-B)","NAGREBCAN","BALBALDEZ"],
    ["ALOGOOG","LACUBEN","ARING"]
  ];
  const piniliGroups=[
    ["UGUIS","CAMANGA","MADUPAYAS","LILIPUTEN","LUMBAAN-BICBICA","SACRITAN"],
    ["PURITAC","DALAYAP","NAGTRIGOAN","UPON"],
    ["APATUT-LUBONG","DARAT","CAPANGDANAN","GULPENG"],
    ["AGLIPAY","SANTO TOMAS","CABAROAN","BUANGA"],
    ["VALBUENA (POB.)","PAGDILAO (POB.)"],["BADIO","BULBULALA","PUZOL","TARTARABANG"],
    ["SALANAP","BARBAR","BUNGRO","PUGAOAN"]
  ];

  const badocTownNames=badocGroups.flat();
  const piniliTownNames=piniliGroups.flat();

  const packedForTask=(task)=>{
    const rows=task.exportRows||[];
    const seen=new Set();
    rows.forEach(x=>{const k=normJoin(x?.spxTN);if(k)seen.add(k)});
    return seen.size;
  };

  linehaulTasks.forEach((task,taskIndex)=>{
    const taskId=String(task?.id||"").trim();
    if(!taskId||task.blank)return;

    const towns=task.townBreakdown||{};
    const counts={};
    Object.entries(towns).forEach(([town,g])=>{
      const t=String(town||"").trim().toUpperCase();
      if(t)counts[t]=(g.items||[]).length;
    });

    const badocTotal=badocTownNames.reduce((s,t)=>s+(counts[t]||0),0);
    const piniliTotal=piniliTownNames.reduce((s,t)=>s+(counts[t]||0),0);
    const packedTotal=packedForTask(task);

    // Misrouted for this specific Linehaul Task:
    // Match the task SPX TNs against the existing Parcel Count misrouted records.
    // This is display-only and does not change the existing classification logic.
    // Build lookup indexes once for all tasks. Keep the per-task UI lightweight.
    const taskMisrouted=[],taskUnmatched=[];
    const misSeen=new Set(),unmatchedSeen=new Set();
    (task.exportRows||[]).forEach(er=>{
      const k=normJoin(er?.spxTN||er?.["SPX TN"]||er?.["Order ID"]||"");
      if(!k)return;
      const mr=taskMisMap.get(k);
      if(mr&&!misSeen.has(k)){misSeen.add(k);taskMisrouted.push(mr)}
      if(!parcelOrderIndex.has(k)&&!unmatchedSeen.has(k)){unmatchedSeen.add(k);taskUnmatched.push(er)}
    });

    // Keep detail rows in memory and render them only when the user expands a panel.
    const detailKey=`lhdetail_${taskIndex}`;
    detailStore.set(detailKey,{mis:taskMisrouted,unmatched:taskUnmatched,taskId});

    // Total task volume is shown as valid matched / total exported SPX TNs.
    // Valid matched excludes task-specific misrouted and unmatched parcels.
    const taskTotal=(task.exportRows||[]).filter(row=>!isExceptionRow({"SPX TN":row?.spxTN??row?.["SPX TN"]??row?.["SPX Tracking Number"]??""})).length;
    const taskMatched=Math.max(0,taskTotal-taskMisrouted.length-taskUnmatched.length);
    const incomingTotal=taskMatched;

    // Attribute cards are calculated from the same valid/matched task population
    // represented by the task total. High Value uses the Forward Order
    // "High Value" column (Y = high value). Bulky uses "Chargeable Weight"
    // and counts parcels at 4.00 or above.
    const excludedMetricKeys=new Set();
    const metricKeyOf=v=>normJoin(v);
    taskMisrouted.forEach(r=>{
      const k=metricKeyOf(r?.["SLS Tracking Number"]||r?.["Order ID"]||r?.["SPX TN"]||r?.["SPX Tracking Number"]);
      if(k)excludedMetricKeys.add(k);
    });
    taskUnmatched.forEach(r=>{
      const k=metricKeyOf(r?.spxTN||r?.["SPX TN"]||r?.["SPX Tracking Number"]||r?.["Order ID"]);
      if(k)excludedMetricKeys.add(k);
    });
    let bulkyTotal=0,highValueTotal=0;
    const metricSeen=new Set();
    Object.values(task.townBreakdown||{}).forEach(group=>{
      (group?.items||[]).forEach(item=>{
        const x=item?.x||{}, r=item?.r||{};
        const tn=metricKeyOf(x?.spxTN||x?.["SPX TN"]||x?.["SPX Tracking Number"]||x?.orderId||x?.["Order ID"]);
        if(!tn || metricSeen.has(tn) || excludedMetricKeys.has(tn) || isExceptionRow(r))return;
        metricSeen.add(tn);
        const hv=String(r?.["High Value"]??"").trim().toUpperCase();
        if(hv==="Y") highValueTotal++;
        const cw=Number(String(r?.["Chargeable Weight"]??"").replace(/,/g,"").trim());
        if(Number.isFinite(cw) && cw>=4) bulkyTotal++;
      });
    });

    const cards=`
      <div class="lh-task-kpis">
        <div class="lh-task-kpi"><div class="lh-task-kpi-value">${taskMatched.toLocaleString()} / ${taskTotal.toLocaleString()}</div><div class="lh-task-kpi-label">TOTAL VOLUME FOR THIS LINEHAUL TASK</div></div>
        <div class="lh-task-kpi"><div class="lh-task-kpi-value">${badocTotal.toLocaleString()}</div><div class="lh-task-kpi-label">BADOC</div></div>
        <div class="lh-task-kpi"><div class="lh-task-kpi-value">${piniliTotal.toLocaleString()}</div><div class="lh-task-kpi-label">PINILI</div></div>
        <div class="lh-task-kpi lh-task-kpi-mis"><div class="lh-task-kpi-value">${taskMisrouted.length.toLocaleString()}</div><div class="lh-task-kpi-label">MISROUTED</div></div>
        <div class="lh-task-kpi lh-task-kpi-unmatched"><div class="lh-task-kpi-value">${taskUnmatched.length.toLocaleString()}</div><div class="lh-task-kpi-label">UNMATCHED</div></div>
        <div class="lh-task-kpi lh-task-kpi-bulky"><div class="lh-task-kpi-value">${bulkyTotal.toLocaleString()}</div><div class="lh-task-kpi-label">BULKY TOTAL</div></div>
        <div class="lh-task-kpi lh-task-kpi-high-value"><div class="lh-task-kpi-value">${highValueTotal.toLocaleString()}</div><div class="lh-task-kpi-label">HIGH VALUE TOTAL</div></div>
      </div>
      <div class="lh-task-mis-panel ${taskMisrouted.length?"":"is-empty"}" data-detail-key="${detailKey}" data-detail-type="mis">
        <button type="button" class="lh-task-mis-toggle" aria-expanded="false">
          <span>⚠ MISROUTED PARCELS</span><strong>${taskMisrouted.length.toLocaleString()}</strong><em>Click to expand</em>
        </button>
        <div class="lh-task-mis-body"></div>
      </div>
      <div class="lh-task-mis-panel lh-task-unmatched-panel ${taskUnmatched.length?"":"is-empty"}" data-detail-key="${detailKey}" data-detail-type="unmatched">
        <button type="button" class="lh-task-mis-toggle lh-task-unmatched-toggle" aria-expanded="false">
          <span>⚠ UNMATCHED PARCELS</span><strong>${taskUnmatched.length.toLocaleString()}</strong><em>Click to expand</em>
        </button>
        <div class="lh-task-mis-body"></div>
      </div>`;

    const makeSection=(title,groups)=>`
      <div class="lh-town-section lh-task-town-section">
        <div class="lh-section-title">${esc(title)}</div>
        <div class="lh-town-grid">
          ${groups.map(group=>`<div class="lh-town-card">
            ${group.map(t=>`<div class="lh-town-row"><span>${esc(t)}</span><b>${(counts[t]||0).toLocaleString()}</b></div>`).join("")}
          </div>`).join("")}
        </div>
      </div>`;

    taskTownSections.push(`
      <div class="lh-task-block collapsed">
        <div class="lh-task-block-header lh-task-toggle" role="button" tabindex="0" aria-expanded="false">
          <span class="lh-task-chevron">▶</span><span>LINEHAUL TASK</span><strong>${esc(taskId)}</strong>
          <b class="lh-task-header-total">TOTAL ${taskMatched.toLocaleString()}</b>
          <label class="lh-task-arrival-header" title="Check this if this linehaul is expected to arrive in time. Include its volume in Dashboard and Planning Board incoming volume." onclick="event.stopPropagation()">
            <input type="checkbox" data-lh-arrival-checkbox data-lh-arrival-task="${esc(taskId)}" ${task.arrivingInTime===true?"checked":""}>
            <span>ARRIVING IN TIME</span>
          </label>
        </div>
        ${cards}
        ${makeSection("BADOC",badocGroups)}
        ${makeSection("PINILI",piniliGroups)}
      </div>`);
  });

  const taskTownEl=$("linehaulTaskTownDashboard");
  if(taskTownEl)taskTownEl.innerHTML=taskTownSections.join("");

  // Master arrival-time checkbox: checked only when every active task is checked.
  const allArrivalBox=$("lhAllArrivingInTime");
  const activeArrivalTasks=(Array.isArray(linehaulTasks)?linehaulTasks:[]).filter(t=>t&&!t.blank&&!t.cleared&&String(t.id||"").trim());
  if(allArrivalBox){
    const checkedCount=activeArrivalTasks.filter(t=>t.arrivingInTime===true).length;
    allArrivalBox.checked=activeArrivalTasks.length>0&&checkedCount===activeArrivalTasks.length;
    allArrivalBox.indeterminate=checkedCount>0&&checkedCount<activeArrivalTasks.length;
    if(!allArrivalBox.dataset.bound){
      allArrivalBox.dataset.bound="1";
      allArrivalBox.addEventListener("change",()=>{
        const tasks=(Array.isArray(linehaulTasks)?linehaulTasks:[]).filter(t=>t&&!t.blank&&!t.cleared&&String(t.id||"").trim());
        tasks.forEach(t=>{t.arrivingInTime=allArrivalBox.checked;});
        try{saveLinehaul()}catch(err){console.warn("Could not save all linehaul arrival choices locally:",err)}
        // Repaint Linehaul KPI cards immediately without leaving this menu.
        if(typeof renderLinehaul==="function")renderLinehaul();
        if(typeof render==="function")render();
        if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
        if(typeof window.__badocCloudSaveLinehaulArrivalFlags==="function"){
          window.__badocCloudSaveLinehaulArrivalFlags().then(()=>{
            if(typeof setLinehaulSpxSyncStatus==="function")setLinehaulSpxSyncStatus("Arrival-time selections synced","success");
          }).catch(err=>{
            console.warn("Linehaul arrival-time sync failed:",err);
            if(typeof setLinehaulSpxSyncStatus==="function")setLinehaulSpxSyncStatus("Arrival-time choices saved on this device; cloud sync failed","error");
          });
        }
      });
    }
  }

  if(!taskTownEl._collapseBound){
    taskTownEl._collapseBound=true;
    taskTownEl.addEventListener("change",e=>{
      const checkbox=e.target?.closest?.("[data-lh-arrival-checkbox]");
      if(!checkbox)return;
      const taskId=String(checkbox.getAttribute("data-lh-arrival-task")||"").trim();
      const task=linehaulTasks.find(x=>!x?.blank&&String(x?.id||"").trim()===taskId);
      if(!task)return;
      task.arrivingInTime=!!checkbox.checked;
      try{saveLinehaul()}catch(err){console.warn("Could not save linehaul arrival choice locally:",err)}
      // Refresh Linehaul KPI cards immediately, then refresh dependent dashboard totals.
      if(typeof renderLinehaul==="function")renderLinehaul();
      if(typeof render==="function")render();
      if(typeof window.updateOperationProgress==="function")window.updateOperationProgress();
      if(typeof window.__badocCloudSaveLinehaulArrivalFlags==="function"){
        window.__badocCloudSaveLinehaulArrivalFlags().then(()=>{
          if(typeof setLinehaulSpxSyncStatus==="function")setLinehaulSpxSyncStatus("Arrival-time selections synced","success");
        }).catch(err=>{
          console.warn("Linehaul arrival-time sync failed:",err);
          if(typeof setLinehaulSpxSyncStatus==="function")setLinehaulSpxSyncStatus("Arrival-time choice saved on this device; cloud sync failed","error");
        });
      }
    });
    const toggle=(header)=>{
      const block=header.closest(".lh-task-block");
      if(!block)return;
      const collapsed=block.classList.toggle("collapsed");
      header.setAttribute("aria-expanded",String(!collapsed));
      const chevron=header.querySelector(".lh-task-chevron");
      if(chevron)chevron.textContent=collapsed?"▶":"▼";
      const hint=header.querySelector("em");
      if(hint)hint.textContent=collapsed?"Click to expand":"Click to collapse";
    };
    taskTownEl.addEventListener("click",e=>{
      if(e.target.closest("[data-lh-arrival-checkbox]"))return;
      const header=e.target.closest(".lh-task-toggle");
      if(header)toggle(header);
    });
    taskTownEl.addEventListener("keydown",e=>{
      const header=e.target.closest(".lh-task-toggle");
      if(header&&(e.key==="Enter"||e.key===" ")){
        e.preventDefault();toggle(header);
      }
    });
    taskTownEl.addEventListener("click",e=>{
      const btn=e.target.closest(".lh-task-mis-toggle");
      if(!btn)return;
      const panel=btn.closest(".lh-task-mis-panel");
      if(!panel||panel.classList.contains("is-empty"))return;
      const open=panel.classList.toggle("open");
      btn.setAttribute("aria-expanded",String(open));
      const hint=btn.querySelector("em");
      if(hint)hint.textContent=open?"Click to collapse":"Click to expand";
      if(open && !panel.dataset.rendered){
        const key=panel.dataset.detailKey,type=panel.dataset.detailType;
        const d=window.__lhTaskDetails?.get(key);
        if(!d)return;
        const list=type==="unmatched"?d.unmatched:d.mis;
        const body=panel.querySelector(".lh-task-mis-body");
        if(!body)return;
        if(type==="unmatched"){
          body.innerHTML=list.length?`<div class="lh-task-mis-table-wrap"><table class="lh-task-mis-table">
            <thead><tr><th>SPX TN</th><th>Linehaul Task</th></tr></thead>
            <tbody>${list.map(r=>`<tr><td>${esc(r?.spxTN||r?.["SPX TN"]||r?.["Order ID"]||"—")}</td><td>${esc(d.taskId)}</td></tr>`).join("")}</tbody>
          </table></div>`:'<div class="lh-task-mis-none">No unmatched parcels for this Linehaul Task.</div>';
        }else{
          body.innerHTML=list.length?`<div class="lh-task-mis-table-wrap"><table class="lh-task-mis-table">
            <thead><tr><th>SPX TN</th><th>Town</th><th>Current Station</th><th>Destination Station</th><th>Status</th></tr></thead>
            <tbody>${list.map(r=>`<tr>
              <td>${esc(r["SLS Tracking Number"]||r["Order ID"]||"—")}</td>
              <td>${esc(r["Town Name"]||"—")}</td>
              <td>${esc(r["Current Station"]||"—")}</td>
              <td>${esc(r["Destination Station"]||"—")}</td>
              <td>${esc(r["Status"]||"—")}</td>
            </tr>`).join("")}</tbody>
          </table></div>`:'<div class="lh-task-mis-none">No misrouted parcels for this Linehaul Task.</div>';
        }
        panel.dataset.rendered="1";
      }
    });
  }

  $("linehaulStatus").textContent=`${visibleTasks} task${visibleTasks===1?"":"s"}`;

  if(!rows.length){
    body.innerHTML='<tr><td colspan="5" class="empty">No linehaul task and town data.</td></tr>';
    return;
  }
  body.innerHTML=rows.join("");
}
function renderLinehaul(){
  const page=document.getElementById("linehaul");
  if(page && !page.classList.contains("active")) return;
  renderLinehaulCore();
}

async function importLinehaulCsvText(text,fileName="Uploaded TO List.csv",source="file"){
  const imported=parseLinehaulCSV(text);
  if(!imported.length)throw Error("No Line Haul Task ID / SPX TN values were found.");
  const exportedRows=imported.flatMap(t=>t.exportRows||[]);
  const exportedRowCount=exportedRows.length;  const exportedUniqueSPX=new Set(exportedRows.map(r=>normJoin(r?.spxTN)).filter(Boolean)).size;
  localStorage.setItem(LH_EXPORT_TOTAL_KEY,String(exportedRowCount));
  localStorage.setItem(LH_EXPORT_UNIQUE_KEY,String(exportedUniqueSPX));

  const allRows=imported.flatMap(t=>t.exportRows||[]);
  const blankRows=imported.filter(t=>t.blank).flatMap(t=>t.exportRows||[]);
  localStorage.setItem(LH_PACKED_KEY,JSON.stringify(allRows));
  localStorage.setItem(LH_BLANK_PACKED_KEY,JSON.stringify(blankRows));

  const parcelRowsForImport=Array.isArray(current?.rows)?current.rows:[];
  const parcelOrderIndexForImport=buildLinehaulParcelOrderIndex(parcelRowsForImport);
  imported.forEach(task=>{
    if(task.blank){
      task.townBreakdown={};
      task.matchedCount=0;
      return;
    }
    const towns=linehaulTownBreakdown(task,parcelRowsForImport,parcelOrderIndexForImport);
    task.townBreakdown=towns;
    task.matchedCount=Object.values(towns).reduce((s,g)=>s+g.items.length,0);
    Object.entries(towns).forEach(([town,group])=>(group.items||[]).forEach(item=>{item.x.town=town;item.x.status=item.x.status||task.status;}));
  });

  const map=new Map(linehaulTasks.map(x=>[x.blank?"__BLANK_LINEHAUL__":x.id,x]));
  imported.forEach(x=>{
    const key=x.blank?"__BLANK_LINEHAUL__":x.id;
    const previous=map.get(key);
    if(typeof x.arrivingInTime!=="boolean"){
      x.arrivingInTime=previous&&typeof previous.arrivingInTime==="boolean"
        ?previous.arrivingInTime:false;
    }
    map.set(key,x);
  });
  // Clear first: the older task list is replaced by the newer export (not merged).
  linehaulTasks=[...new Map(imported.map(x=>[x.blank?"__BLANK_LINEHAUL__":x.id,x])).values()];
  saveLinehaul();
  renderLinehaul();
  if(typeof window.updateOperationProgress==="function") window.updateOperationProgress();
  setTimeout(()=>window.updateOperationProgress?.(),50);
  // Manual CSV imports keep the historical behavior of opening Linehaul Task.
  // Automatic SPX syncs must not change the page the user is currently viewing.
  if(source!=="spx") showPage("linehaul");

  const matched=imported.reduce((s,x)=>s+(x.matchedCount||0),0);
  const total=imported.reduce((s,x)=>s+(x.exportRows?.length||0),0);
  const label=source==="spx"?"Synced":"Imported";
  return {importedCount:imported.length,matched,total,fileName,label};
}

$("linehaulCsvFile")?.addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const result=await importLinehaulCsvText(await f.text(),f.name,"file");
    alert(`${result.label} ${result.importedCount} linehaul task${result.importedCount===1?"":"s"}. Matched ${result.matched.toLocaleString()} of ${result.total.toLocaleString()} SPX TNs to Parcel Record Order IDs.`);
  }catch(err){
    alert("Could not read this exported file: "+err.message);
    console.error(err);
  }
  e.target.value="";
});

const BADOC_SPX_BRIDGE_SOURCE="BADOC_SPX_BRIDGE";
const BADOC_PAGE_SOURCE="BADOC_PAGE";

// Persist independent last-success timestamps for the three Parcel Count SPX actions.
const BADOC_PARCEL_SYNC_STAMPS = {
  inbound: {key:"badoc_parcel_count_received_transported_last_sync_v69", element:"parcelInboundSpxSyncStatus", mirrorElements:["forecastBoardSyncStatus"], label:"Received / Transported / LH Packed / Packing", verb:"Last synced"},
  delivery: {key:"badoc_parcel_count_delivery_status_last_sync_v69", element:"parcelDeliverySpxSyncStatus", label:"Delivering / Delivered / On-Hold", verb:"Last synced"},
};
function badocParcelSyncTimestampText(stamp){
  if(!stamp)return "Not yet";
  try{return new Date(Number(stamp)).toLocaleString("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
  catch(_){return new Date(Number(stamp)).toLocaleString();}
}
function badocParcelSyncStatusText(kind,recordNow=false){
  const cfg=BADOC_PARCEL_SYNC_STAMPS[kind];
  if(!cfg)return "";
  let stamp=0;
  try{
    if(recordNow){stamp=Date.now();localStorage.setItem(cfg.key,String(stamp));}
    else stamp=Number(localStorage.getItem(cfg.key)||0);
  }catch(_){stamp=recordNow?Date.now():0;}
  return `${cfg.label} · ${cfg.verb}: ${badocParcelSyncTimestampText(stamp)}`;
}
function badocRestoreParcelSyncStatuses(){
  for(const [kind,cfg] of Object.entries(BADOC_PARCEL_SYNC_STAMPS)){
    const ids=[cfg.element,...(cfg.mirrorElements||[])];
    for(const id of ids){
      const el=$(id);if(!el)continue;
      el.textContent=badocParcelSyncStatusText(kind,false);
      el.classList.remove("is-working","is-success","is-error");
      try{if(Number(localStorage.getItem(cfg.key)||0))el.classList.add("is-success");}catch(_){}
    }
  }
}

const BADOC_INBOUND_SYNC_BUTTON_IDS=["syncParcelInboundFromSPX","syncVolumeForecastFromSPX"];
function setBadocInboundSyncButtonsBusy(busy){
  BADOC_INBOUND_SYNC_BUTTON_IDS.forEach(id=>{
    const btn=$(id);if(!btn)return;
    btn.dataset.busy=busy?"1":"0";
    btn.disabled=!!busy;
  });
}
function setParcelInboundSpxSyncStatus(message,state="") {
  if(state==="success")message=badocParcelSyncStatusText("inbound",true);
  const cfg=BADOC_PARCEL_SYNC_STAMPS.inbound;
  [cfg.element,...(cfg.mirrorElements||[])].forEach(id=>{
    const el=$(id);if(!el)return;
    el.textContent=message||"";
    el.classList.remove("is-working","is-success","is-error");
    if(state)el.classList.add("is-"+state);
  });
  if(state==="working")window.__badocOperationModalUpdate?.(message||"Working…");
}

let badocInboundSyncContext="planning";
async function beginAssignedOnholdTodaySync(){
  const btn=$("syncAssignedOnholdToday");
  if(!btn||btn.dataset.busy==="1")return;
  if(!(await window.__badocEnsureSpxBridge?.()))return;
  btn.dataset.busy="1";btn.disabled=true;
  const status=$("assignedOnholdTodayStatus");
  if(status){status.textContent="Connecting to SPX…";status.classList.remove("is-success","is-error");status.classList.add("is-working");}
  window.__badocOperationModalStart?.("Assigned Today","Exporting Forward and Return orders from SPX for Badoc Hub. Filters: Assigned Time today; no Created Date restriction. Delivering, Delivered and LMHub_Received keep their statuses; all other non-empty statuses count as On-Hold…");
  clearTimeout(window.__badocAssignedOnholdTodayTimer);
  window.__badocAssignedOnholdTodayTimer=setTimeout(()=>{
    btn.disabled=false;btn.dataset.busy="0";
    if(status){status.textContent="No response from SPX after 5 minutes. Check SPX and retry.";status.classList.remove("is-working");status.classList.add("is-error");}
    window.__badocOperationModalFinish?.("Assigned Today Timed Out","No response from the extension after 5 minutes.",[],"error");
  },12*60*1000);
  postBadocSpxMessage("BADOC_START_ASSIGNED_ONHOLD_TODAY");
}
$("syncAssignedOnholdToday")?.addEventListener("click",beginAssignedOnholdTodaySync);

async function beginParcelInboundSpxBridgeSync(event){
  const requestedContext=event?.currentTarget?.id==="syncVolumeForecastFromSPX"?"forecast":"planning";
  if(!(await window.__badocEnsureSpxBridge?.()))return;
  if(BADOC_INBOUND_SYNC_BUTTON_IDS.some(id=>$(id)?.dataset.busy==="1"))return;
  badocInboundSyncContext=requestedContext;
  setBadocInboundSyncButtonsBusy(true);
  const modalTitle=requestedContext==="forecast"?"Sync Volume Forecast":"Sync Received / Transported / LH Packed / Packing";
  window.__badocOperationModalStart?.(modalTitle,"Connecting to SPX and requesting the same inbound export used by Planning Board (Received, Transporting, Transported, LH Packed, and Packing)…");
  setParcelInboundSpxSyncStatus("Connecting to SPX…","working");
  armBadocSyncWatchdog("inbound");
  armBadocBridgeCommandWatchdog("parcel-inbound");
  postBadocSpxMessage("BADOC_START_PARCEL_INBOUND_SYNC");
}

function getBadocManilaDayBounds(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const map=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  const y=Number(map.year),m=Number(map.month)-1,d=Number(map.day);
  // SPX timestamps are epoch seconds representing Manila local midnight.
  const startMs=Date.UTC(y,m,d)-8*60*60*1000;
  const endMs=startMs+24*60*60*1000-1;
  const fmt=n=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(n)).replace(", "," ");
  const today=`${map.year}-${map.month}-${map.day}`;
  return {
    date:today,
    assignedStartUnix:Math.floor(startMs/1000),
    assignedEndUnix:Math.floor(endMs/1000),
    assignedStart:`${today} 00:00:00`,
    assignedEnd:`${today} 23:59:59`,
    assignedLabel:`${today} 00:00:00 → ${today} 23:59:59`
  };
}

function setParcelDeliverySpxSyncStatus(message,state=""){
  if(state==="success")message=badocParcelSyncStatusText("delivery",true);
  const el=$("parcelDeliverySpxSyncStatus");
  if(el){
    el.textContent=message||"";
    el.classList.remove("is-working","is-success","is-error");
    if(state)el.classList.add("is-"+state);
  }
  if(state==="working")window.__badocOperationModalUpdate?.(message||"Working…");
}

const BADOC_DELIVERY_STATUS_BUTTONS={
  "2":{button:"syncParcelDeliveringFromSPX",status:"parcelDeliveringStatus",name:"Delivering"},
  "4":{button:"syncParcelDeliveredFromSPX",status:"parcelDeliveredStatus",name:"Delivered"},
  "5":{button:"syncParcelOnHoldFromSPX",status:"parcelOnHoldStatus",name:"OnHold"}
};
let badocActiveDeliveryStatus="";

function setIndividualDeliveryStatus(statusId,message,state=""){
  const cfg=BADOC_DELIVERY_STATUS_BUTTONS[String(statusId)];
  if(!cfg)return;
  const el=$(cfg.status);
  if(el){el.textContent=message||"";el.classList.remove("is-working","is-success","is-error");if(state)el.classList.add("is-"+state);}
  if(state==="working")window.__badocOperationModalUpdate?.(message||"Working…");
}
async function beginIndividualParcelDeliverySync(statusId,options={}){
  const cfg=BADOC_DELIVERY_STATUS_BUTTONS[String(statusId)];
  if(!cfg)return false;
  // Combined sync performs one bridge preflight for the whole three-status
  // sequence. Do not repeat the handshake for each hidden status trigger.
  if(options.bridgeReady!==true && !(await window.__badocEnsureSpxBridge?.()))return false;
  if(badocActiveDeliveryStatus)return false;
  const btn=$(cfg.button);
  if(btn?.dataset.busy==="1")return false;
  const day=getBadocManilaDayBounds();
  badocActiveDeliveryStatus=String(statusId);
  if(btn){btn.dataset.busy="1";btn.disabled=true;}
  window.__badocOperationModalStart?.(`Sync ${cfg.name}`,`Requesting SPX ${cfg.name}-only export. Assigned Time: ${day.assignedLabel}`);
  setIndividualDeliveryStatus(statusId,`Connecting to SPX · Assigned ${day.assignedLabel}`,"working");
  armBadocSyncWatchdog("delivery",statusId);
  postBadocSpxMessage("BADOC_START_PARCEL_DELIVERY_SYNC",{
    trackingStatus:String(statusId),
    statusName:cfg.name,
    bulkyType:"1,0,2",
    assignedStartUnix:day.assignedStartUnix,
    assignedEndUnix:day.assignedEndUnix,
    assignedStart:day.assignedStart,
    assignedEnd:day.assignedEnd,
    assignedLabel:day.assignedLabel
  });
  return true;
}
Object.entries(BADOC_DELIVERY_STATUS_BUTTONS).forEach(([statusId,cfg])=>{
  $(cfg.button)?.addEventListener("click",()=>beginIndividualParcelDeliverySync(statusId));
});

function setCombinedDeliverySyncStatus(message,state=""){
  const el=$("parcelDeliverySpxSyncStatus");
  if(!el)return;
  el.textContent=message||"";
  el.classList.remove("is-working","is-success","is-error");
  if(state)el.classList.add("is-"+state);
}
async function beginCombinedParcelDeliverySync(){
  const combinedBtn=$("syncParcelDeliveryAllFromSPX");
  if(!combinedBtn||combinedBtn.dataset.busy==="1")return;
  combinedBtn.dataset.busy="1";
  combinedBtn.disabled=true;
  try{
    setCombinedDeliverySyncStatus("Connecting to SPX…","working");
    if(!(await window.__badocEnsureSpxBridge?.()))throw new Error("Badoc Hub Extension is not connected. Reconnect the extension, then retry.");
    if(badocActiveDeliveryStatus)throw new Error("Another delivery-status export is already running.");

    const day=getBadocManilaDayBounds();
    const statusIds=["2","4","5"];
    const statusName="Delivering / Delivered / OnHold";
    // One native SPX export request containing all three status IDs.
    badocActiveDeliveryStatus=statusIds.join(",");
    window.__badocOperationModalStart?.("Sync Delivering / Delivered / OnHold",`Requesting one SPX export for all three statuses. Assigned Time: ${day.assignedLabel}`);
    setCombinedDeliverySyncStatus("Requesting one SPX export for Delivering, Delivered, and OnHold…","working");
    armBadocSyncWatchdog("delivery",statusIds.join(","));
    postBadocSpxMessage("BADOC_START_PARCEL_DELIVERY_SYNC",{
      trackingStatus:statusIds.join(","),
      statusName,
      bulkyType:"1,0,2",
      assignedStartUnix:day.assignedStartUnix,
      assignedEndUnix:day.assignedEndUnix,
      assignedStart:day.assignedStart,
      assignedEnd:day.assignedEnd,
      assignedLabel:day.assignedLabel
    });
  }catch(error){
    badocActiveDeliveryStatus="";
    const message=String(error?.message||error);
    setCombinedDeliverySyncStatus("Combined export did not start: "+message,"error");
    window.__badocOperationModalFinish?.("Combined Delivery Sync Failed",message,[],"error");
    combinedBtn.disabled=false;
    combinedBtn.dataset.busy="0";
  }
}
$("syncParcelDeliveryAllFromSPX")?.addEventListener("click",beginCombinedParcelDeliverySync);

function setLinehaulSpxSyncStatus(message,state=""){
  const el=$("linehaulSpxSyncStatus");
  if(el){
    el.textContent=message||"";
    el.classList.remove("is-working","is-success","is-error");
    if(state)el.classList.add("is-"+state);
  }
  if(state==="working")window.__badocOperationModalUpdate?.(message||"Working…");
}

function postBadocSpxMessage(type,data={}){
  window.postMessage({source:BADOC_PAGE_SOURCE,type,...data},"*");
}

let badocSpxSyncPromise=null;

const BADOC_SYNC_WATCHDOGS=Object.create(null);
function clearBadocSyncWatchdog(kind){
  const timer=BADOC_SYNC_WATCHDOGS[kind];
  if(timer)clearTimeout(timer);
  delete BADOC_SYNC_WATCHDOGS[kind];
}
function armBadocSyncWatchdog(kind,statusId){
  clearBadocSyncWatchdog(kind);
  BADOC_SYNC_WATCHDOGS[kind]=setTimeout(()=>{
    clearBadocSyncWatchdog(kind);
    const message="No response from SPX after 5 minutes. The sync was stopped; check the SPX tab and retry.";
    if(kind==="inbound"){
      setBadocInboundSyncButtonsBusy(false);
      setParcelInboundSpxSyncStatus(message,"error");
      window.__badocOperationModalFinish?.("Received Sync Timed Out",message,[],"error");
    }else if(kind==="delivery"){
      const combined=String(statusId||badocActiveDeliveryStatus)==="2,4,5";
      if(combined){
        const btn=$("syncParcelDeliveryAllFromSPX");
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        setCombinedDeliverySyncStatus(message,"error");
      }else{
        const cfg=BADOC_DELIVERY_STATUS_BUTTONS[String(statusId||badocActiveDeliveryStatus)];
        const btn=cfg&&$(cfg.button);
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        if(statusId||badocActiveDeliveryStatus)setIndividualDeliveryStatus(String(statusId||badocActiveDeliveryStatus),message,"error");
        else setParcelDeliverySpxSyncStatus(message,"error");
      }
      badocActiveDeliveryStatus="";
      window.__badocOperationModalFinish?.(combined?"Combined Delivery Sync Timed Out":"Delivery Sync Timed Out",message,[],"error");
    }else if(kind==="linehaul"){
      const btn=$("syncLinehaulFromSPX");
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
      setLinehaulSpxSyncStatus(message,"error");
      window.__badocOperationModalFinish?.("Linehaul Sync Timed Out",message,[],"error");
    }
  },5*60*1000);
}

const BADOC_BRIDGE_COMMAND_TIMERS=Object.create(null);
function clearBadocBridgeCommandWatchdog(kind){
  if(BADOC_BRIDGE_COMMAND_TIMERS[kind])clearTimeout(BADOC_BRIDGE_COMMAND_TIMERS[kind]);
  delete BADOC_BRIDGE_COMMAND_TIMERS[kind];
}
function armBadocBridgeCommandWatchdog(kind){
  clearBadocBridgeCommandWatchdog(kind);
  BADOC_BRIDGE_COMMAND_TIMERS[kind]=setTimeout(()=>{
    clearBadocBridgeCommandWatchdog(kind);
    if(kind==="parcel-inbound" && BADOC_INBOUND_SYNC_BUTTON_IDS.some(id=>$(id)?.dataset.busy==="1")){
      clearBadocSyncWatchdog("inbound");
      setBadocInboundSyncButtonsBusy(false);
      const message="The Received sync command reached the extension page bridge, but the background service worker did not start the export. Open the extension's service worker console for errors, then reload the extension.";
      setParcelInboundSpxSyncStatus(message,"error");
      window.__badocOperationModalFinish?.("SPX Sync Request Not Received",message,[],"error");
    }else if((kind==="first-mile-orders"||kind==="first-mile-tasks") && $("syncFirstMileAll")?.dataset.busy==="1"){
      const message="The First Mile command reached the extension page bridge, but the background service worker did not acknowledge it. Reload the extension and retry.";
      window.__badocFailFirstMileSequence?.(message);
      window.__badocOperationModalFinish?.("First Mile Sync Not Started",message,[],"error");
    }
  },12000);
}
const BADOC_FIRST_MILE_PROGRESS_TIMERS=Object.create(null);
function clearBadocFirstMileProgressWatchdog(kind){
  if(BADOC_FIRST_MILE_PROGRESS_TIMERS[kind])clearTimeout(BADOC_FIRST_MILE_PROGRESS_TIMERS[kind]);
  delete BADOC_FIRST_MILE_PROGRESS_TIMERS[kind];
}
function armBadocFirstMileProgressWatchdog(kind){
  clearBadocFirstMileProgressWatchdog(kind);
  BADOC_FIRST_MILE_PROGRESS_TIMERS[kind]=setTimeout(()=>{
    clearBadocFirstMileProgressWatchdog(kind);
    if($("syncFirstMileAll")?.dataset.busy!=="1")return;
    const label=kind==="first-mile-orders"?"Orders":"Tasks";
    const message="First Mile "+label+" export stopped reporting progress for 90 seconds. Check the SPX extension service worker console and retry.";
    window.__badocFailFirstMileSequence?.(message);
    window.__badocOperationModalFinish?.("First Mile Sync Timed Out",message,[],"error");
  },90000);
}

badocRestoreParcelSyncStatuses();

async function beginLinehaulSpxBridgeSync(){
  if(!(await window.__badocEnsureSpxBridge?.()))return;
  const btn=$("syncLinehaulFromSPX");
  if(btn?.dataset.busy==="1")return;
  if(btn)btn.dataset.busy="1";
  if(btn)btn.disabled=true;
  window.__badocOperationModalStart?.("Sync Linehaul from SPX","Connecting to SPX and requesting linehaul tasks…");
  setLinehaulSpxSyncStatus("Connecting to SPX…","working");
  armBadocSyncWatchdog("linehaul");
  postBadocSpxMessage("BADOC_START_LINEHAUL_SYNC");
}

window.addEventListener("message",async event=>{
  if(event.source!==window)return;
  const data=event.data||{};
  if(data.source!==BADOC_SPX_BRIDGE_SOURCE)return;

  if(data.type==="BADOC_BRIDGE_DISCONNECTED"){
    const reason=String(data.message||"The SPX extension connection was lost. Reload the extension and retry.").trim();
    const inboundBusy=BADOC_INBOUND_SYNC_BUTTON_IDS.some(id=>$(id)?.dataset.busy==="1");
    const deliveryBusy=!!badocActiveDeliveryStatus;
    const linehaulBtn=$("syncLinehaulFromSPX");
    const linehaulBusy=linehaulBtn?.dataset.busy==="1";
    const firstMileBtn=$("syncFirstMileAll");
    const firstMileBusy=firstMileBtn?.dataset.busy==="1";
    if(inboundBusy){
      clearBadocBridgeCommandWatchdog("parcel-inbound");
      clearBadocSyncWatchdog("inbound");
      setBadocInboundSyncButtonsBusy(false);
      setParcelInboundSpxSyncStatus("Extension disconnected — "+reason,"error");
    }
    if(deliveryBusy){
      clearBadocSyncWatchdog("delivery");
      const cfg=BADOC_DELIVERY_STATUS_BUTTONS[badocActiveDeliveryStatus];
      const btn=cfg&&$(cfg.button);
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
      setIndividualDeliveryStatus(badocActiveDeliveryStatus,"Extension disconnected — "+reason,"error");
      badocActiveDeliveryStatus="";
    }
    if(linehaulBusy){
      clearBadocSyncWatchdog("linehaul");
      linehaulBtn.disabled=false;linehaulBtn.dataset.busy="0";
      setLinehaulSpxSyncStatus("Extension disconnected — "+reason,"error");
    }
    if(firstMileBusy){
      clearBadocBridgeCommandWatchdog("first-mile-orders");
      clearBadocBridgeCommandWatchdog("first-mile-tasks");
      clearBadocFirstMileProgressWatchdog("first-mile-orders");
      clearBadocFirstMileProgressWatchdog("first-mile-tasks");
      const message="Extension disconnected during First Mile sync — "+reason;
      window.__badocFailFirstMileSequence?.(message);
    }
    if(inboundBusy||deliveryBusy||linehaulBusy||firstMileBusy){
      window.__badocOperationModalFinish?.("SPX Extension Disconnected",reason,[],"error");
    }
    return;
  }

  if(data.type==="BADOC_SPX_COMMAND_FORWARDED" && data.kind==="assigned-onhold-today"){
    clearTimeout(window.__badocAssignedOnholdTodayTimer);
    window.__badocAssignedOnholdTodayTimer=setTimeout(()=>{
      const btn=$("syncAssignedOnholdToday"),status=$("assignedOnholdTodayStatus");
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
      if(status){status.textContent="No response from SPX after 5 minutes. Retry the export.";status.classList.remove("is-working");status.classList.add("is-error");}
      window.__badocOperationModalFinish?.("Assigned Today Timed Out","SPX did not complete the export within 5 minutes.",[],"error");
    },12*60*1000);
    return;
  }
  if(data.type==="BADOC_SPX_COMMAND_ACCEPTED" && data.kind==="assigned-onhold-today"){
    const status=$("assignedOnholdTodayStatus");
    if(status)status.textContent=data.message||"SPX accepted the export request…";
    return;
  }
  if(data.type==="BADOC_ASSIGNED_ONHOLD_TODAY_COMPLETE"){
    clearTimeout(window.__badocAssignedOnholdTodayTimer);
    const btn=$("syncAssignedOnholdToday"),status=$("assignedOnholdTodayStatus");
    const forward=Number(data.forwardRowCount||0),returned=Number(data.returnRowCount||0);
    const exportRows=Array.isArray(data.onholdRows)?data.onholdRows:[];
    // Replace the complete snapshot, then wait for IndexedDB to confirm the
    // durable write before the operation is marked COMPLETED.
    const merged=badocSaveOnholdExportRows(exportRows);
    const persistAndFinish=async()=>{
      try{
        const cloudResult=await window.__badocCloudSaveOnholdToday(merged,{
          todayDate:data.todayDate,
          forwardRowCount:forward,
          returnRowCount:returned
        });
        const savedCount=Number(cloudResult?.rowCount??merged.length);
        const liveOnholdRows=badocGetOnholdRows(typeof getParcelCountRows==="function"?getParcelCountRows():[],false);
        window.__badocOnholdTnKeys=new Set(liveOnholdRows.map(r=>badocOnholdKey(spxTN(r))).filter(Boolean));
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        try{window.render?.()}catch(e){}
        try{window.updateOperationProgress?.()}catch(e){}
        try{if(typeof renderRecords==="function")renderRecords()}catch(e){}
        const excludedRows=Number(data.excludedForward||0)+Number(data.excludedReturn||0);
        const msg=`Saved ${savedCount.toLocaleString()} unique SPX tracking records to shared cloud and local IndexedDB. Processed ${forward.toLocaleString()} Forward rows and ${returned.toLocaleString()} Return rows for ${data.todayDate||"today"}. Filters: Current Station Badoc Hub; Assigned Time today; no Created Date restriction; Delivering and Delivered excluded from On-Hold; every other non-empty status, including LMHub_Received, counts as On-Hold only when Pick Up Time is today before 3:00 PM Manila time; duplicate SPX TNs replaced by the newest export.`;
        if(status){status.textContent=msg;status.classList.remove("is-working","is-error");status.classList.add("is-success");}
        window.__badocOperationModalFinish?.("Assigned Today Complete",msg,[["Forward rows",forward.toLocaleString()],["Return rows",returned.toLocaleString()],["Saved unique records",savedCount.toLocaleString()],["Excluded rows",excludedRows.toLocaleString()]],"success");
      }catch(error){
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        const message="SPX exports completed, but Assigned Today did not sync to the shared cloud. A local recovery copy may be available on this device. "+String(error?.message||error);
        if(status){status.textContent=message;status.classList.remove("is-working","is-success");status.classList.add("is-error");}
        window.__badocOperationModalFinish?.("Assigned Today Storage Failed",message,[["Forward rows",forward.toLocaleString()],["Return rows",returned.toLocaleString()],["Saved unique records","Not confirmed"]],"error");
      }
    };
    void persistAndFinish();
    return;
  }
  if(data.type==="BADOC_ASSIGNED_ONHOLD_TODAY_ERROR"){
    clearTimeout(window.__badocAssignedOnholdTodayTimer);
    const btn=$("syncAssignedOnholdToday"),status=$("assignedOnholdTodayStatus");
    if(btn){btn.disabled=false;btn.dataset.busy="0";}
    if(status){status.textContent=data.message||"Assigned Today export failed.";status.classList.remove("is-working","is-success");status.classList.add("is-error");}
    window.__badocOperationModalFinish?.("Assigned Today Failed",data.message||"SPX export failed.",[],"error");
    return;
  }

  if(data.type==="BADOC_SPX_COMMAND_FORWARDED" && data.kind==="parcel-inbound"){
    // The page bridge has delivered the command to the extension port.
    // Switch from the page-to-extension watchdog to the background-start watchdog.
    clearBadocBridgeCommandWatchdog("parcel-inbound");
    setParcelInboundSpxSyncStatus("Received sync command forwarded. Waiting for SPX background to start the export…","working");
    armBadocBridgeCommandWatchdog("parcel-inbound");
    return;
  }

  if(data.type==="BADOC_SPX_COMMAND_ACCEPTED" && data.kind==="parcel-inbound"){
    clearBadocBridgeCommandWatchdog("parcel-inbound");
    setParcelInboundSpxSyncStatus(data.message||"SPX extension accepted the Received sync request. Submitting export…","working");
    return;
  }

  if(data.type==="BADOC_SPX_COMMAND_FORWARDED" && (data.kind==="first-mile-orders"||data.kind==="first-mile-tasks")){
    clearBadocBridgeCommandWatchdog(data.kind);
    const orders=data.kind==="first-mile-orders";
    const status=$(orders?"firstMileOrdersStatus":"firstMileTasksStatus");
    if(status)status.textContent="Command forwarded to extension background. Waiting for SPX export startup…";
    armBadocBridgeCommandWatchdog(data.kind);
    return;
  }
  if(data.type==="BADOC_SPX_COMMAND_ACCEPTED" && (data.kind==="first-mile-orders"||data.kind==="first-mile-tasks")){
    clearBadocBridgeCommandWatchdog(data.kind);
    const orders=data.kind==="first-mile-orders";
    const status=$(orders?"firstMileOrdersStatus":"firstMileTasksStatus");
    if(status)status.textContent=data.message||"Extension accepted the First Mile export request…";
    armBadocFirstMileProgressWatchdog(data.kind);
    return;
  }


  if(data.type==="BADOC_SPX_PROGRESS"){
    const phase=String(data.phase||"");
    const kind=String(data.kind||"");
    if(kind==="parcel-inbound" || phase.startsWith("parcel-") && !phase.startsWith("parcel-delivery")){
      clearBadocBridgeCommandWatchdog("parcel-inbound");
      armBadocSyncWatchdog("inbound");
    }
    else if(kind==="parcel-delivery" || phase.startsWith("parcel-delivery"))armBadocSyncWatchdog("delivery",data.trackingStatus||badocActiveDeliveryStatus);
    else if(kind==="linehaul" || phase.startsWith("linehaul"))armBadocSyncWatchdog("linehaul");
    if(kind==="first-mile-orders" || kind==="first-mile-tasks" || phase.startsWith("first-mile")){
      const firstMileKind=kind==="first-mile-tasks"?"first-mile-tasks":"first-mile-orders";
      clearBadocBridgeCommandWatchdog(firstMileKind);
      armBadocFirstMileProgressWatchdog(firstMileKind);
      const orders=kind==="first-mile-orders" || phase.includes("orders");
      const status=$(orders?"firstMileOrdersStatus":"firstMileTasksStatus");
      if(status)status.textContent=data.message||"Exporting First Mile data from SPX…";
    }else if(kind==="parcel-inbound" || phase.startsWith("parcel-" ) && !phase.startsWith("parcel-delivery")){
      setParcelInboundSpxSyncStatus(data.message||"Syncing Received / Transported from SPX…","working");
    }else if(kind==="parcel-delivery" || phase.startsWith("parcel-delivery")){
      const progressStatus=String(data.trackingStatus||badocActiveDeliveryStatus||"");
      if(progressStatus==="2,4,5"||progressStatus.split(",").filter(Boolean).length>1){
        setCombinedDeliverySyncStatus(data.message||"Syncing combined delivery-status export…","working");
      }else{
        setIndividualDeliveryStatus(progressStatus,data.message||"Syncing selected delivery status…","working");
      }
    }else{
      setLinehaulSpxSyncStatus(data.message||"Syncing Incoming Linehaul from SPX…","working");
    }
    return;
  }

  if(data.type==="BADOC_SPX_PARCEL_DELIVERY_CSV"){
    clearBadocSyncWatchdog("delivery");
    const statusId=String(data.trackingStatus||data.statusId||badocActiveDeliveryStatus||"");
    const isCombined=statusId.split(",").map(x=>x.trim()).filter(Boolean).length>1;
    const cfg=BADOC_DELIVERY_STATUS_BUTTONS[statusId]||BADOC_DELIVERY_STATUS_BUTTONS[badocActiveDeliveryStatus];
    const btn=isCombined?$("syncParcelDeliveryAllFromSPX"):(cfg?$(cfg.button):$("syncParcelDeliveryFromSPX"));
    try{
      const statusName=isCombined?(data.statusName||"Delivering / Delivered / OnHold"):(cfg?.name||data.statusName||"Delivery status");
      if(isCombined)setCombinedDeliverySyncStatus(`Importing combined ${statusName} export ${data.taskId||""}…`,"working");
      else setIndividualDeliveryStatus(statusId,`Importing ${statusName} export ${data.taskId||""}…`,"working");
      if(!data.csvText)throw Error(`The bridge returned an empty ${statusName} CSV payload.`);
      const result=await importParcelCsvText(data.csvText,data.fileName||`export_${statusName.toLowerCase().replace(/[^a-z0-9]+/g,"_")}_today.csv`,"spx-delivery");
      let cloudState="Failed",cloudError="";
      try{
        if(typeof window.__badocCloudUploadParcelText!=="function")throw Error("Shared cloud sync is not available in this app session.");
        const cloudResult=await window.__badocCloudUploadParcelText(data.csvText,data.fileName||`export_${statusName.toLowerCase().replace(/[^a-z0-9]+/g,"_")}_today.csv`,"spx-delivery");
        cloudState=cloudResult?.queued?"Queued for Sync All cloud upload":"Synced";
        if(cloudState==="Synced"){
          try{localStorage.setItem(BADOC_PARCEL_SYNC_STAMPS.delivery.key,String(Date.now()))}catch(_){}
        }
      }catch(syncErr){
        cloudError=String(syncErr?.message||syncErr||"Unknown cloud sync error").slice(0,300);
        console.error("SPX delivery-status cloud sync failed; local data was retained:",syncErr);
      }
      const syncNote=!result.persisted
        ? `Imported ${result.total.toLocaleString()} rows · ${statusName}; local storage warning — keep this tab open. Cloud: ${cloudState.toLowerCase()}.`
        : result.warnings?.length
          ? `Imported ${result.total.toLocaleString()} rows · ${statusName}; dashboard refresh warning. Cloud: ${cloudState.toLowerCase()}.`
          : `${cloudState==="Synced"?"Synced":"Imported"} ${result.total.toLocaleString()} rows · ${statusName}; cloud: ${cloudState.toLowerCase()}`;
      if(isCombined){
        setCombinedDeliverySyncStatus(syncNote,cloudState==="Failed"||!result.persisted?"error":"success");
        if(cloudState==="Synced")setParcelDeliverySpxSyncStatus(badocParcelSyncStatusText("delivery",false),"success");
      }else{
        setIndividualDeliveryStatus(statusId,syncNote,cloudState==="Failed"?"error":"success");
      }
      const modalWarnings=[...(result.warnings||[])];
      if(cloudError)modalWarnings.push("Cloud sync failed: "+cloudError);
      window.__badocOperationModalFinish?.(isCombined?"Combined Delivery Import Complete":`${statusName} Import Complete`,cloudState==="Failed"?"Parcel data was imported locally, but shared cloud sync failed.":cloudState==="Queued for Sync All cloud upload"?"Parcel data was imported locally and queued for the Sync All cloud upload.":`${statusName} data was imported locally and synced to shared cloud data.`,[
        ["Statuses",statusName],["Rows",result.total.toLocaleString()],["New tracking numbers",result.added.toLocaleString()],["Updated tracking numbers",result.updated.toLocaleString()],["Local storage",result.persisted?"Saved":"Session only · save not confirmed"],["Cloud sync",cloudState],["Warnings",modalWarnings.join(" | ")||"None"]
      ],cloudState==="Failed"||!result.persisted?"error":"success");
    }catch(err){
      console.error("SPX delivery-status CSV import failed before commit:",err);
      const failure=`Import failed before commit — existing Parcel Count data kept.`;
      if(isCombined)setCombinedDeliverySyncStatus(failure,"error");
      else setIndividualDeliveryStatus(statusId,failure,"error");
      window.__badocOperationModalFinish?.(isCombined?"Combined Delivery Import Failed":"Delivery Status Import Failed","The new export was not committed to Parcel Count. Existing data was kept.",[["Error",err.message||"Unknown error"]],"error");
    }finally{
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
      badocActiveDeliveryStatus="";
    }
    return;
  }
  if(data.type==="BADOC_SPX_PARCEL_DELIVERY_PROGRESS"){
    const sid=String(data.trackingStatus||data.statusId||badocActiveDeliveryStatus||"");
    if(sid==="2,4,5"||sid.split(",").filter(Boolean).length>1)setCombinedDeliverySyncStatus(data.message||"Syncing combined delivery-status export…","working");
    else if(sid)setIndividualDeliveryStatus(sid,data.message||"Syncing status export…","working");
    return;
  }

  if(data.type==="BADOC_SPX_PARCEL_DONE")return;

  if(data.type==="BADOC_SPX_PARCEL_CSV"){
    try{
      setParcelInboundSpxSyncStatus(`Importing SPX Parcel Count export ${data.taskId||""}…`,"working");
      if(!data.csvText)throw Error("The bridge returned an empty Parcel Count CSV payload.");
      const result=await importParcelCsvText(data.csvText,data.fileName||"export_forward_order.csv","spx-inbound");
      if(typeof window.__badocCloudUploadParcelText==="function"){
        setParcelInboundSpxSyncStatus("Saving Parcel Count data to shared cloud…","working");
        await window.__badocCloudUploadParcelText(data.csvText,data.fileName||"export_forward_order.csv","spx-inbound");
      }
      setParcelInboundSpxSyncStatus(`Synced ${result.total.toLocaleString()} Parcel Count rows`,`success`);
      window.__badocOperationModalFinish?.(badocInboundSyncContext==="forecast"?"Sync Volume Forecast Complete":"Sync Received Complete","Parcel Count inbound data loaded successfully.",[
        ["Rows",result.total.toLocaleString()],["New tracking numbers",result.added.toLocaleString()],["Updated tracking numbers",result.updated.toLocaleString()]
      ],"success");
    }catch(err){
      console.error("SPX Parcel Count CSV import failed:",err);
      setParcelInboundSpxSyncStatus("Sync failed — existing Parcel Count data kept.","error");
      window.__badocOperationModalFinish?.(badocInboundSyncContext==="forecast"?"Sync Volume Forecast Failed":"Sync Received Failed","Your existing Parcel Count data was not cleared.",[["Error",err.message||"Unknown error"]],"error");
    }finally{
      clearBadocBridgeCommandWatchdog("parcel-inbound");
      clearBadocSyncWatchdog("inbound");
      setBadocInboundSyncButtonsBusy(false);
    }
    return;
  }

  if(data.type==="BADOC_SPX_FIRST_MILE_ORDERS_CSV" || data.type==="BADOC_SPX_FIRST_MILE_TASKS_CSV"){
    const orders=data.type==="BADOC_SPX_FIRST_MILE_ORDERS_CSV";
    const firstMileKind=orders?"first-mile-orders":"first-mile-tasks";
    clearBadocBridgeCommandWatchdog(firstMileKind);
    clearBadocFirstMileProgressWatchdog(firstMileKind);
    const key=orders?"badoc_first_mile_orders_csv_local_v1":"badoc_first_mile_tasks_csv_local_v1";
    const statusId=orders?"firstMileOrdersStatus":"firstMileTasksStatus";
    const resultId=orders?"firstMileOrdersResult":"firstMileTasksResult";
    const downloadId=orders?"downloadFirstMileOrders":"downloadFirstMileTasks";
    try{
      if(!data.csvText)throw Error("SPX returned an empty First Mile CSV.");
      try{await window.__badocCapturePickupFirstSyncBaseline?.(orders?"orders":"tasks",data.csvText,{taskId:data.taskId||""});}catch(baselineError){console.warn("Pickup first-sync baseline capture failed:",baselineError);}
      localStorage.setItem(key,JSON.stringify({csvText:data.csvText,fileName:data.fileName|| (orders?"first_mile_orders.csv":"first_mile_tasks.csv"),taskId:data.taskId||"",savedAt:Date.now(),rowCount:Number(data.rowCount||Math.max(0,data.csvText.split(/\\r?\\n/).filter(Boolean).length-1))}));
      window.__badocUpdateFirstMileLastUpdated?.();
      const record=JSON.parse(localStorage.getItem(key));
      const cloudResult=typeof window.__badocPickupCloudSave==="function"
        ?await window.__badocPickupCloudSave(orders?"orders":"tasks",record)
        :{ok:false,message:"Pickup cloud service is not ready; saved locally."};
      const inboundedSuffix=orders?"":` · ${Number(data.inboundedCount||0).toLocaleString()} Inbounded`;
      const status=$(statusId);
      if(status)status.textContent=`${cloudResult?.ok?"Cloud synced":"Cloud sync pending"} · ${record.rowCount.toLocaleString()} rows${inboundedSuffix} · ${new Date(record.savedAt).toLocaleString("en-PH")}`;
      const result=$(resultId);
      if(result)result.textContent=`${record.rowCount.toLocaleString()} rows${inboundedSuffix} · ${cloudResult?.ok?"Shared across devices":"Saved locally; will retry cloud upload"} · SPX task ${record.taskId||"—"}`;
      const download=$(downloadId);if(download)download.disabled=false;
      window.__badocRenderFirstMileCombined?.();
      if(orders){
        window.__badocFirstMileSequenceResult?.("orders",true);
      }else{
        const cloudMessage=cloudResult?.ok
          ?"Orders and Tasks are saved locally and synced to shared cloud storage."
          :"Orders and Tasks are saved locally. Cloud upload is pending and will retry automatically.";
        window.__badocOperationModalFinish?.("First Mile Sync Complete",cloudMessage,[["Task rows",record.rowCount.toLocaleString()],["Local storage","Saved"],["Shared cloud",cloudResult?.ok?"Synced":"Pending retry"]],"success");
        window.__badocFirstMileSequenceResult?.("tasks",true);
      }
    }catch(error){
      const status=$(statusId);if(status)status.textContent=`Import failed: ${error.message}`;
      window.__badocOperationModalFinish?.("First Mile Import Failed",error.message,[],"error");
      window.__badocFirstMileSequenceResult?.(orders?"orders":"tasks",false,error.message||"Local save failed.");
    }finally{
      if(!orders){const btn=$("syncFirstMileAll");if(btn){btn.disabled=false;btn.dataset.busy="0";}}
    }
    return;
  }
  if(data.type==="BADOC_SPX_ERROR"){
    clearBadocSyncWatchdog("inbound");clearBadocSyncWatchdog("delivery");clearBadocSyncWatchdog("linehaul");
    console.error("BADOC SPX bridge error:",data.message);
    if(data.kind==="first-mile-orders" || data.kind==="first-mile-tasks"){
      clearBadocBridgeCommandWatchdog(data.kind);
      clearBadocFirstMileProgressWatchdog(data.kind);
      const orders=data.kind==="first-mile-orders";
      const status=$(orders?"firstMileOrdersStatus":"firstMileTasksStatus");
      if(status)status.textContent=`Export failed: ${data.message||"Unknown error"}`;
      window.__badocOperationModalFinish?.(orders?"First Mile Orders Failed":"First Mile Tasks Failed",data.message||"SPX export failed.",[],"error");
      window.__badocFirstMileSequenceResult?.(orders?"orders":"tasks",false,data.message||"SPX export failed.");
      const btn=$("syncFirstMileAll");if(btn){btn.disabled=false;btn.dataset.busy="0";}
    }else if(data.kind==="parcel-delivery"){
      const combined=badocActiveDeliveryStatus==="2,4,5";
      if(combined){
        const btn=$("syncParcelDeliveryAllFromSPX");
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        setCombinedDeliverySyncStatus("Combined sync failed — existing Parcel Count data kept.","error");
      }else{
        const cfg=BADOC_DELIVERY_STATUS_BUTTONS[badocActiveDeliveryStatus];
        const btn=cfg?$(cfg.button):$("syncParcelDeliveryFromSPX");
        if(btn){btn.disabled=false;btn.dataset.busy="0";}
        if(badocActiveDeliveryStatus)setIndividualDeliveryStatus(badocActiveDeliveryStatus,"Sync failed — existing Parcel Count data kept.","error");
        else setParcelDeliverySpxSyncStatus("Sync failed — existing Parcel Count data kept.","error");
      }
      badocActiveDeliveryStatus="";
      window.__badocOperationModalFinish?.(combined?"Combined Delivery Sync Failed":"Delivery Status Sync Failed","Your existing Parcel Count data was not cleared.",[["Error",data.message||"Unknown error"]],"error");
    }else if(data.kind==="parcel-inbound"){
      clearBadocBridgeCommandWatchdog("parcel-inbound");
      setBadocInboundSyncButtonsBusy(false);
      setParcelInboundSpxSyncStatus("Sync failed — existing Parcel Count data kept.","error");
      window.__badocOperationModalFinish?.(badocInboundSyncContext==="forecast"?"Sync Volume Forecast Failed":"Sync Received Failed","Your existing Parcel Count data was not cleared.",[["Error",data.message||"Unknown error"]],"error");
    }else{
      const btn=$("syncLinehaulFromSPX");
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
      setLinehaulSpxSyncStatus("Sync failed — existing Linehaul data kept.","error");
      window.__badocOperationModalFinish?.("Linehaul Sync Failed","Your existing Linehaul data was not cleared.",[["Error",data.message||"Unknown error"]],"error");
    }
    return;
  }

  if(data.type==="BADOC_SPX_CSV"){
    clearBadocSyncWatchdog("linehaul");
    const btn=$("syncLinehaulFromSPX");
    try{
      setLinehaulSpxSyncStatus(`Importing SPX Linehaul task ${data.taskId||""}…`,"working");
      if(!data.csvText)throw Error("The bridge returned an empty CSV payload.");
      const result=await importLinehaulCsvText(data.csvText,data.fileName||"inbound_to_from_spx.csv","spx");
      // IMPORTANT: automatic SPX imports must also publish their CSV to the
      // shared Linehaul object. Otherwise the cloud-sync poll can pull the
      // previous snapshot a few seconds later and make the new data disappear.
      if(typeof window.__badocCloudUploadLinehaulText==="function"){
        setLinehaulSpxSyncStatus(`Saving SPX Linehaul data to shared cloud…`,"working");
        await window.__badocCloudUploadLinehaulText(data.csvText,data.fileName||"inbound_to_from_spx.csv");
      }
      setLinehaulSpxSyncStatus(`Synced ${result.total.toLocaleString()} rows · ${result.importedCount} task${result.importedCount===1?"":"s"}`,"success");
      window.__badocOperationModalFinish?.("Linehaul Sync Complete","SPX linehaul tasks loaded successfully.",[
        ["Tasks",result.importedCount.toLocaleString()],["Rows",result.total.toLocaleString()],["Matched SPX TNs",result.matched.toLocaleString()]
      ],"success");
    }catch(err){
      console.error("SPX Linehaul CSV import failed:",err);
      setLinehaulSpxSyncStatus("Sync failed — existing Linehaul data kept.","error");
      window.__badocOperationModalFinish?.("Linehaul Sync Failed","Your existing Linehaul data was not cleared.",[["Error",err.message||"Unknown error"]],"error");
    }finally{
      if(btn){btn.disabled=false;btn.dataset.busy="0";}
    }
  }
});

$("syncParcelInboundFromSPX")?.addEventListener("click",beginParcelInboundSpxBridgeSync);
$("syncVolumeForecastFromSPX")?.addEventListener("click",beginParcelInboundSpxBridgeSync);
$("syncParcelDeliveryFromSPX")?.addEventListener("click",beginParcelDeliverySpxBridgeSync);
$("syncLinehaulFromSPX")?.addEventListener("click",beginLinehaulSpxBridgeSync);

$("clearLinehaul")?.addEventListener("click",()=>{
  if(linehaulTasks.length&&confirm("Clear all linehaul tasks?")){
    linehaulTasks=[];
    localStorage.removeItem(LH_KEY);
    localStorage.removeItem(LH_PACKED_KEY);
    localStorage.removeItem(LH_BLANK_PACKED_KEY);
    localStorage.removeItem(LH_EXPORT_TOTAL_KEY);
    localStorage.removeItem(LH_EXPORT_UNIQUE_KEY);
    saveLinehaul();
    const unmappedHost=$("lhUnmappedSpxCardHost");
    if(unmappedHost){unmappedHost.classList.remove("v10-show-unmapped");unmappedHost.innerHTML="";}
    renderLinehaul();
    renderLinehaulKpis();
  }
});
linehaulTasks=[];renderLinehaul();setTimeout(()=>window.updateOperationProgress?.(),0);

(function(){
  const card=$("lhDoidCard"), close=$("lhDoidClose");
  if(card)card.addEventListener("click",()=>{const p=$("lhDoidPanel");if(!p)return;if(p.style.display==="none"||!p.style.display){renderLinehaulDoidPanel()}else{p.style.display="none"}});
  if(close)close.addEventListener("click",()=>{const p=$("lhDoidPanel");if(p)p.style.display="none"});
})();
