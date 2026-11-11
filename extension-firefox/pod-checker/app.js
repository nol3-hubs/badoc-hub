(function(){
"use strict";
const chrome = window.podChrome || (window.chrome?.runtime?.sendMessage ? window.chrome : null);
if (!chrome) { console.error("Badoc Hub POD/POOH Checker bridge is unavailable."); return; }

const $ = id => document.getElementById(id);
let results = [];
let captures = [];
let currentPage = 1;
const PAGE_SIZE = 100;
function parseOids() {
  return [...new Set($('oids').value.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean))];
}
function setStatus(text,type="") {$('status').textContent=text;$('status').className="status "+type;}
async function getSpxTab() {
  const tabs = await chrome.tabs.query({url:"https://spx.shopee.ph/*"});
  const proofTabs = tabs.filter(t => /PROOF_OF_ONHOLD/i.test(String(t.url||"")) && /proof_of_onhold/i.test(String(t.url||"")));
  if (!proofTabs.length) throw new Error("SPX Proof of On Hold is not ready. Click Check OIDs to prepare it automatically.");
  return proofTabs.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
}
let spxPreparePromise = null;
async function ensureSpxReady() {
  if (spxPreparePromise) return spxPreparePromise;
  spxPreparePromise = (async () => {
    const overlay = $("spxLoading");
    overlay?.classList.add("show");
    let timeoutId = null;
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          target: "POD_CHECKER_BACKGROUND",
          action: "OPEN_SPX_PORTAL"
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(
            "SPX did not become ready within 45 seconds. Check that you are signed in to SPX, then click Check OIDs again."
          )), 45000);
        })
      ]);
      if (!response?.ok) throw new Error(response?.error || "Chrome could not prepare the SPX Proof of On Hold page.");
      return response;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      overlay?.classList.remove("show");
      spxPreparePromise = null;
    }
  })();
  return spxPreparePromise;
}
async function pageCommand(command,data={}) {
  let tab = await getSpxTab().catch(() => null);
  if (!tab) {
    await ensureSpxReady();
    tab = await getSpxTab();
  }
  try {
    return await chrome.tabs.sendMessage(tab.id,{target:"pood-page-v19",command,data});
  } catch (error) {
    const message = String(error?.message || error || "");
    if (!/no tab with id|receiving end does not exist|could not establish connection|no response from the spx page|cannot connect to the spx tab/i.test(message)) throw error;
    // Recover once if SPX was closed or its content script was disconnected mid-run.
    await ensureSpxReady();
    tab = await getSpxTab();
    return await chrome.tabs.sendMessage(tab.id,{target:"pood-page-v19",command,data});
  }
}
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function isDelivered(r){return /delivered/i.test(String(r?.deliveryStatus||""));}
function displayResult(x){const r=(typeof x==="object"&&x!==null)?x:null;const v=String(r?r.checkResult:(x||"UNVERIFIED"));return r&&isDelivered(r)&&v==="UNVERIFIED"?"PENDING VALIDATION":v;}
function outcomeClass(x){
 const v=displayResult(x);
 if(v==="PASS")return "pass";
 if(v==="FAIL")return "fail";
 if(/^TIER [1-5]$/.test(v))return "tier tier"+v.slice(-1);
 return "pending";
}
function cleanEvidenceField(raw){
 let line=String(raw??"").trim();
 // Older saved results included list/sequence/OID/result prefixes and the
 // formula text. Keep only the actual evidence tags for display/export.
 if(line.includes(" — "))line=line.split(" — ").slice(1).join(" — ");
 line=line.replace(/;\s*rule\s*:[\s\S]*$/i,"").replace(/;\s*rule unavailable[\s\S]*$/i,"").replace(/;\s*SPX has not calculated this record[\s\S]*$/i,"");
 line=line.replace(/^.*?\b(Proof of Contact:)/i,"$1");
 return line.replace(/^\s*[;·,]\s*|\s*[;·,]\s*$/g,"").trim();
}
function evidenceHtml(r){
 if(isDelivered(r)&&!(r.podFields||[]).length)return "PENDING";
 const fields=(r.podFields||[]).map(cleanEvidenceField)
  .map(x=>x.replace(/\bTier\s*:\s*\d+\s*[;·]\s*/i,"" ).replace(/\bTier\s*:\s*\d+\s*/i,""))
  .map(x=>x.replace(/\s*[;·]\s*[;·]\s*/g," · ").replace(/^\s*[;·]\s*|\s*[;·]\s*$/g,"" ).trim()).filter(Boolean);
 if(!fields.length)return isDelivered(r)?"PENDING":"Not identified";
 const colorEvidence=line=>esc(line).replace(/(Tier|Quality|Parcel|AWB|Location|Distance|Proof of Recipient|Proof of Contact):\s*(Yes|No)/g,(_,label,value)=>`${label}: <span class="evidence-${value.toLowerCase()}">${value}</span>`);
 const oneLine=fields.join(" · ");
 return `<details class="pod-evidence-dropdown"><summary title="Click to expand POD evidence">${colorEvidence(oneLine)}</summary><div class="pod-evidence-details">${fields.map(line=>`<div>${colorEvidence(line)}</div>`).join("")}</div></details>`;
}
function evidenceText(r){if(isDelivered(r)&&!(r.podFields||[]).length)return "PENDING";const lines=(r.podFields||[]).map(cleanEvidenceField).filter(Boolean);return lines.length?[...new Set(lines)].join("\n"):(isDelivered(r)?"PENDING":"Not identified");}
async function loadSaved() {
  const data=await chrome.storage.local.get(["podAppOids","podAppResults"]);
  if(data.podAppOids)$('oids').value=data.podAppOids;
  if(data.podAppResults){results=data.podAppResults;renderResults();}
}
async function saveOids(){await chrome.storage.local.set({podAppOids:$('oids').value});}
function renderCaptures(){
  $('captureStatus').textContent=captures.length?`${captures.length} matching request(s) observed in SPX.`:"No matching request captured. Arm capture, search one OID in SPX, then refresh.";
  $('captureList').innerHTML=captures.slice(0,30).map(c=>`<div class="capture-item"><b>${esc(c.method)} ${esc(c.path)}</b><br><span class="muted small">Request OID: ${esc((c.sourceOids||[]).join(", ")||"not visible in request")}<br>Response OID: ${esc((c.responseOids||[]).join(", ")||"not found")}<br>${c.hasOnHoldValidation?"Proof of On Hold response detected":"Other SPX response"}</span><br><span class="tag ${c.replayable&&c.hasOnHoldValidation?"pass":"warn"}">${c.replayable&&c.hasOnHoldValidation?"Reusable read-only template":esc(c.replayBlockReason||"Not reusable")}</span></div>`).join("");
}
function setFilterOptions(id, values, placeholder, current){
 const el=$(id); const options=[...new Set(values.map(v=>String(v||"Not identified").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 el.innerHTML=`<option value="ALL">${esc(placeholder)}</option>`+options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 el.value=options.includes(current)?current:"ALL";
}
function resultEvidenceValues(r){return (r.podFields||[]).map(x=>String(x).match(/Proof of Contact:.*?(?=; rule:|; SPX has not calculated|$)/)?.[0]||"").filter(Boolean).join(" ");}
function filteredResults(){
 const resultFilter=$('filterResult')?.value||"ALL", tierFilter=$('filterTier')?.value||"ALL", statusFilter=$('filterStatus')?.value||"ALL", driverFilter=$('filterDriver')?.value||"ALL";
 return results.filter(r=>{
  const outcome=displayResult(r);
  if(resultFilter!=="ALL"&&outcome!==resultFilter)return false;
  if(tierFilter!=="ALL"&&outcome!==tierFilter)return false;
  if(statusFilter!=="ALL"&&String(isDelivered(r)?"Delivered":r.deliveryStatus||"Not identified")!==statusFilter)return false;
  if(driverFilter!=="ALL"&&String(r.driverName||"Not identified")!==driverFilter)return false;
  return true;
 });
}
function renderResults(){
  $('resultsCount').textContent=results.length?`(${results.length})`:"";
  $('countAll').textContent=results.length;
  $('countPass').textContent=results.filter(r=>r.checkResult==="PASS").length;
  $('countFail').textContent=results.filter(r=>displayResult(r)==="FAIL").length;
  for(let tier=1;tier<=5;tier++){
    const count=results.filter(r=>displayResult(r)===`TIER ${tier}`).length;
    $(`countTier${tier}`).textContent=count;
  }
  setFilterOptions("filterStatus",results.map(r=>r.deliveryStatus),"All statuses",$('filterStatus')?.value||"ALL");
  setFilterOptions("filterDriver",results.map(r=>r.driverName),"All drivers",$('filterDriver')?.value||"ALL");
  const shown=filteredResults();
  const totalPages=Math.max(1,Math.ceil(shown.length/PAGE_SIZE));
  currentPage=Math.min(Math.max(1,currentPage),totalPages);
  const start=(currentPage-1)*PAGE_SIZE;
  const pageRows=shown.slice(start,start+PAGE_SIZE);
  $('filterSummary').textContent=results.length?`Showing ${shown.length?start+1:0}–${Math.min(start+PAGE_SIZE,shown.length)} of ${shown.length} filtered results · Page ${currentPage} of ${totalPages}`:"";
  $('pageIndicator').textContent=`Page ${currentPage} / ${totalPages}`;
  $('prevPage').disabled=currentPage<=1;
  $('nextPage').disabled=currentPage>=totalPages;
  $('results').innerHTML=pageRows.length?pageRows.map(r=>`<tr>
   <td>${esc(r.oid)}</td>
   <td><span class="tag ${outcomeClass(r.checkResult)}">${displayResult(r)}</span></td>
   <td>${esc(isDelivered(r)?"Delivered":r.deliveryStatus||"Not identified")}</td>
   <td>${esc(r.driverName||"Not identified")}</td>
   <td>${evidenceHtml(r)}</td>
  </tr>`).join(""):'<tr><td colspan="5" class="muted">No matching results.</td></tr>';
}
async function refreshCaptures(){
 const r=await pageCommand("LIST");
 if(!r?.ok)throw new Error(r?.error||"Could not get captured requests.");
 captures=r.captures||[];renderCaptures();
}
$('check').addEventListener("click",async()=>{
 const oids=parseOids();if(!oids.length){setStatus("Paste at least one OID first.","error");return;}
 const checkButton=$('check');
 if(checkButton.disabled)return;
 checkButton.disabled=true;
 results=[];renderResults();$('progressBar').style.width="0%";
 // Persist the pasted list as best effort only. Local-storage latency or a
 // reconnecting extension bridge must never prevent the actual OID check.
 saveOids().catch(error=>console.warn("POD Checker could not save the OID input yet:",error));
 try{
  setStatus(`Starting ${oids.length} OID check(s)…`);
  setStatus("Opening SPX in the background and checking that the Proof of On Hold page is ready…");
  await ensureSpxReady();
  const tab=await getSpxTab();
  setStatus(`Connected to SPX in the background. Checking ${oids.length} OID(s) through the read-only Proof of On Hold endpoint…`);
  // Process up to 10 OIDs concurrently. Each OID requires the validation
  // request plus recipient_info, so this balances speed and portal stability.
  const concurrency=Math.min(10,oids.length);
  let nextIndex=0,completed=0;
  results=new Array(oids.length);
  const worker=async()=>{
   while(true){
    const i=nextIndex++;
    if(i>=oids.length)return;
    const oid=oids[i];
    try{
     const response=await pageCommand("DIRECT_CHECK",{oid});
     if(!response?.ok)throw new Error(response?.error||"SPX did not return a result.");
     results[i]=response.result;
    }catch(e){
     results[i]={oid,httpStatus:"ERR",deliveryStatus:"Unable to verify",podResult:"Could not check",podFields:[],checkResult:"UNVERIFIED",checkReason:"The SPX validation request could not be completed.",endpoint:"/spx_delivery/admin/order_settings/epooh/validation_result",note:e.message};
    }
    completed++;
    $('progressBar').style.width=Math.round(completed/oids.length*100)+"%";
    setStatus(`Checked ${completed}/${oids.length} OIDs (${concurrency} concurrent)…`);
    // Batch UI updates to avoid slowing down large runs.
    if(completed%100===0||completed===oids.length)renderResults();
   }
  };
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  renderResults();
  try{await chrome.storage.local.set({podAppResults:results});}catch(storageError){setStatus(`Checks finished, but Chrome could not save all results locally (${storageError.message}). Export CSV to keep a copy.`, "error");}
  const pass=results.filter(r=>r.checkResult==="PASS").length;
  const fail=results.filter(r=>displayResult(r)==="FAIL").length;
  const tiers=results.filter(r=>/^TIER [1-5]$/.test(displayResult(r))).length;
  const pending=results.filter(r=>displayResult(r)==="PENDING VALIDATION").length;
  const skipped=results.filter(r=>displayResult(r)==="SKIPPED").length;
  setStatus(`Finished ${results.length} OID(s): ${pass} PASS, ${fail} FAIL, ${tiers} TIER result(s), ${pending} pending, ${skipped} skipped.`,"good");
 }catch(e){setStatus(e.message,"error");}
 finally{$('check').disabled=false;}
});
$('clearOids').addEventListener("click",()=>{$('oids').value="";saveOids().catch(error=>console.warn("POD Checker could not clear saved OIDs:",error));});
$('clearResults').addEventListener("click",async()=>{results=[];renderResults();await chrome.storage.local.remove("podAppResults");});
$('export').addEventListener("click",()=>{
 if(!results.length){setStatus("No results to export yet.");return;}
 const cols=["oid","checkResult","checkReason","deliveryStatus","driverName","podFields"];
 const csv=[cols,...results.map(r=>cols.map(c=>c==="checkResult"?displayResult(r):Array.isArray(r[c])?evidenceText(r):r[c]??""))].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=`POD_Checker_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('copy').addEventListener("click",async()=>{
 if(!results.length){setStatus("No results to copy.");return;}
 const text=[["OID","Result","Reason","Status","Driver Name","POD evidence"].join("\t"),...results.map(r=>[r.oid,displayResult(r),r.checkReason,r.deliveryStatus,r.driverName,evidenceText(r)].map(v=>String(v??"").replace(/\t/g," ")).join("\t"))].join("\n");
 try{await navigator.clipboard.writeText(text);setStatus("Results copied to clipboard.","good");}catch(e){setStatus("Clipboard access denied. Export CSV instead.","error");}
});
$('oids').addEventListener("input",()=>{saveOids().catch(error=>console.warn("POD Checker could not persist the OID input:",error));});
['filterResult','filterTier','filterStatus','filterDriver'].forEach(id=>$(id).addEventListener('change',()=>{currentPage=1;renderResults();}));
$('prevPage').addEventListener('click',()=>{if(currentPage>1){currentPage--;renderResults();}});
$('nextPage').addEventListener('click',()=>{const total=Math.max(1,Math.ceil(filteredResults().length/PAGE_SIZE));if(currentPage<total){currentPage++;renderResults();}});
$('resetFilters').addEventListener('click',()=>{['filterResult','filterTier','filterStatus','filterDriver'].forEach(id=>$(id).value='ALL');currentPage=1;renderResults();});

// Daily Ops Dashboard connection/import. Users explicitly select the intended
// open spreadsheet. Never guess based on whichever Google Sheets tab is active.
const DASHBOARD_STORAGE_KEY = "podDailyOpsDashboard";
const DAILY_OPS_TITLE_PREFIX = "[NOL3] Daily Ops Dashboard";
// Daily Ops Order IDs may use either the standard PH prefix or the SPEPH prefix.
// Keep the rest of the value strictly alphanumeric and require a minimum payload length.
const OID_CELL_RE = /^(?:PH|SPEPH)[A-Z0-9]{8,}$/i;
let dashboardCandidates = [];
function dashboardStatus(text, type="") {
  const el = $("dashboardStatus");
  if (el) { el.textContent = text; el.className = "status " + type; }
}
function isGoogleSheetsDocumentUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    const host = url.hostname.toLowerCase();
    const isSheetsHost = host === "docs.google.com" || host === "sheets.google.com";
    return url.protocol === "https:" && isSheetsHost && /\/spreadsheets(?:\/|$)/i.test(url.pathname);
  } catch (_) {
    return false;
  }
}
function parseSpreadsheetId(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    const path = url.pathname;
    // Support the common Google account-scoped route (/spreadsheets/u/0/d/ID),
    // the standard route (/spreadsheets/d/ID), and Workspace-prefixed routes.
    const patterns = [
      /\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i,
      /\/a\/[^/]+\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i
    ];
    for (const pattern of patterns) {
      const match = path.match(pattern);
      if (match) return match[1];
    }
    return "";
  } catch (_) {
    return "";
  }
}
async function discoverWorksheetGidsFromOpenTab(tabId){
  // Enumerate the actual sheet tabs in the currently open Google Sheets page.
  // Do not rely on the active URL gid: that is why older builds only worked
  // when users had already selected the Inventory worksheet.
  if(!Number.isInteger(tabId) || !chrome.scripting?.executeScript) return {gids:[],error:"Chrome scripting permission is unavailable."};
  try{
    const injected=await chrome.scripting.executeScript({
      target:{tabId},
      world:"ISOLATED",
      func:async()=>{
        const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
        const labelOf=el=>String(el.getAttribute('aria-label')||el.getAttribute('data-tooltip')||el.getAttribute('title')||el.innerText||el.textContent||"").replace(/\s+/g," ").trim();
        const getTabs=()=>{
          const selectors=['.docs-sheet-tab','[role="tab"]','[data-sheet-id]','[data-sheetid]'];
          const raw=selectors.flatMap(selector=>Array.from(document.querySelectorAll(selector)));
          const seen=new Set();
          const nodes=raw.filter(el=>{
            const target=el.closest('.docs-sheet-tab,[role="tab"]')||el;
            if(seen.has(target))return false;seen.add(target);
            const r=target.getBoundingClientRect();
            if(r.height<8)return false;
            const cls=String(target.className||"");
            const isSheetClass=/docs-sheet-tab/i.test(cls);
            // Google Sheets places worksheet tabs in a strip along the bottom.
            // This avoids confusing them with toolbar tabs or accessibility UI.
            const isBottomRole=target.getAttribute('role')==='tab' && r.top>window.innerHeight*0.55;
            const hasSheetId=target.hasAttribute('data-sheet-id')||target.hasAttribute('data-sheetid');
            if(!isSheetClass&&!isBottomRole&&!hasSheetId)return false;
            const label=labelOf(target);
            return !!label && label.length<100;
          });
          // A few Google Sheets builds expose the sheet tab as a button rather
          // than role=tab. Use only labeled controls in the bottom tab strip.
          if(nodes.length)return nodes;
          const fallback=Array.from(document.querySelectorAll('button,[role="button"],[aria-label]')).filter(el=>{
            const r=el.getBoundingClientRect();
            if(r.height<8 || r.top<window.innerHeight*0.68)return false;
            const label=labelOf(el);
            return !!label && label.length<70 && !/add sheet|all sheets|explore|keyboard|status|comments|share/i.test(label);
          });
          return fallback;
        };
        const gidFromUrl=()=>{
          const u=new URL(location.href);
          return u.hash.match(/(?:^|[&#])gid=(\d+)/)?.[1]||u.search.match(/[?&]gid=(\d+)/)?.[1]||"";
        };
        const directGid=el=>{
          const values=[el.getAttribute('data-sheet-id'),el.getAttribute('data-sheetid'),el.getAttribute('data-gid')];
          for(const v of values){if(v&&/^\d+$/.test(v))return v;}
          const html=String(el.outerHTML||"");
          const m=html.match(/(?:sheetId|sheet_id|gridId|data-sheet-id|data-sheetid|data-gid)["'\s:=]+(\d+)/i);
          return m?.[1]||"";
        };
        const beforeGid=gidFromUrl();
        const initialTabs=getTabs();
        if(!initialTabs.length)return {gids:beforeGid?[beforeGid]:[],labels:[],activeGid:beforeGid,method:"url-only",error:"Google Sheets worksheet tabs were not exposed in the page DOM."};
        const labels=initialTabs.map(labelOf);
        const direct=initialTabs.map(directGid);
        const inventoryIndex=labels.findIndex(label=>/\binventory\b/i.test(label));
        let activeIndex=initialTabs.findIndex(el=>el.getAttribute('aria-selected')==='true'||el.getAttribute('aria-pressed')==='true'||/selected|active/i.test(String(el.className||"")));
        if(activeIndex<0)activeIndex=initialTabs.findIndex(el=>el.getAttribute('tabindex')==='0');
        if(activeIndex<0 && beforeGid){
          const match=initialTabs.findIndex(el=>directGid(el)===beforeGid);
          if(match>=0)activeIndex=match;
        }
        const gids=new Set(direct.filter(Boolean));
        if(beforeGid)gids.add(beforeGid);
        let inventoryGid=inventoryIndex>=0?(direct[inventoryIndex]||""):"";
        // The Daily Ops layout uses an Inventory worksheet tab. Activate only
        // that tab first: clicking every worksheet serially made discovery slow
        // and was unnecessary when the target tab can be identified by name.
        // If no Inventory-named tab exists, retain the exhaustive fallback.
        const order=inventoryIndex>=0?[inventoryIndex]:initialTabs.map((_,i)=>i);
        for(const i of order){
          const current=getTabs();
          const el=current[i];
          if(!el)continue;
          const knownGid=directGid(el);
          if(knownGid)gids.add(knownGid);
          // The active tab's gid is already represented by the original URL.
          if(i===activeIndex) {
            if(i===inventoryIndex)inventoryGid=beforeGid||knownGid||inventoryGid;
            continue;
          }
          try{
            el.scrollIntoView({block:"nearest",inline:"nearest"});
            el.click();
          }catch(_){continue;}
          let gid="";
          for(let attempt=0;attempt<12;attempt++){
            await sleep(80);
            gid=gidFromUrl();
            if(gid && gid!==beforeGid)break;
          }
          if(!gid)gid=gidFromUrl();
          if(gid)gids.add(gid);
          const now=getTabs()[i];
          const attrGid=now?directGid(now):knownGid;
          if(attrGid)gids.add(attrGid);
          if(i===inventoryIndex)inventoryGid=gid||attrGid||inventoryGid;
        }
        // Restore the user's originally active worksheet before the extension
        // finishes scanning. Selection changes only the visible tab, not data.
        const restoreTabs=getTabs();
        let restore=activeIndex>=0?restoreTabs[activeIndex]:null;
        if(!restore && beforeGid)restore=restoreTabs.find(el=>directGid(el)===beforeGid)||null;
        if(restore){try{restore.click();await sleep(220);}catch(_){}}
        const restoredGid=gidFromUrl();
        return {gids:[...gids],labels,activeGid:beforeGid||restoredGid,inventoryGid,method:"tab-strip-scan",restored:!beforeGid||restoredGid===beforeGid};
      }
    });
    const result=injected?.[0]?.result;
    if(!result)return {gids:[],error:"The Google Sheets page did not return worksheet information."};
    return {gids:Array.isArray(result.gids)?result.gids.map(String).filter(Boolean):[],labels:result.labels||[],activeGid:String(result.activeGid||""),inventoryGid:String(result.inventoryGid||""),method:result.method||"",restored:result.restored!==false,error:result.error||""};
  }catch(error){
    return {gids:[],error:error?.message||String(error)};
  }
}
async function listOpenSpreadsheetTabs() {
  // Search all Chrome windows, but only consider the user's intended Daily Ops
  // Dashboard. Other open Google Sheets (personal sheets, scorecards, etc.) are
  // deliberately excluded before any authenticated reads are attempted.
  const allTabs = await chrome.tabs.query({});
  const googleSheetTabs = allTabs.filter(tab => isGoogleSheetsDocumentUrl(tab.url));
  const prefix = DAILY_OPS_TITLE_PREFIX.toLocaleLowerCase();
  const dailyOpsTabs = googleSheetTabs.filter(tab => {
    const title = String(tab.title || "").replace(/\s+-\s+Google Sheets$/i, "").trimStart();
    return title.toLocaleLowerCase().startsWith(prefix);
  });
  const byId = new Map();
  for (const tab of dailyOpsTabs) {
    const spreadsheetId = parseSpreadsheetId(tab.url);
    if (!spreadsheetId) continue;
    const old = byId.get(spreadsheetId);
    // Keep one descriptive instance for each matching dashboard spreadsheet.
    // The active or most recently accessed instance is preferred; selection
    // remains explicit so the extension never silently chooses a file.
    if (!old || tab.active || (tab.lastAccessed||0) > (old.lastAccessed||0)) byId.set(spreadsheetId, tab);
  }
  const result = [...byId.values()];
  result.googleSheetsTabCount = googleSheetTabs.length;
  result.dailyOpsTitleMatchCount = dailyOpsTabs.length;
  result.unparsedGoogleSheetsTabs = dailyOpsTabs.filter(tab => !parseSpreadsheetId(tab.url)).map(tab => ({title: tab.title || "Google Sheets", url: tab.url || ""}));
  result.ignoredGoogleSheetsTitles = googleSheetTabs.filter(tab => !dailyOpsTabs.includes(tab)).map(tab => tab.title || "Google Sheets");
  return result;
}
function parseCsv(text) {
  const rows=[]; let row=[], cell="", quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"' && text[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    } else if(ch==='"') quoted=true;
    else if(ch===','){row.push(cell);cell="";}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}
  return rows;
}
function normalizeSheetText(v){return String(v??"").replace(/^\uFEFF/,"").replace(/\u00a0/g," ").toLowerCase().replace(/\s+/g," ").trim();}
function extractSheetIds(html, activeGid=""){
  const ids=new Set();
  const patterns=[
    /["']?sheetId["']?\s*[:=]\s*["']?(\d+)/gi,
    /["']?sheet_id["']?\s*[:=]\s*["']?(\d+)/gi,
    /["']?gridId["']?\s*[:=]\s*["']?(\d+)/gi,
    /data-sheet-id=["'](\d+)["']/gi,
    /[?#&]gid=(\d+)/gi,
    /gid%3D(\d+)/gi
  ];
  const source=String(html||"");
  for(const re of patterns){let m;while((m=re.exec(source))!==null)ids.add(String(m[1]));}
  if(activeGid)ids.add(String(activeGid));
  // The default first worksheet is commonly gid 0 and may not appear in links
  // when another worksheet is selected.
  ids.add("0");
  return [...ids];
}
function findInventoryHeader(rows){
  const headingIndex=rows.findIndex(row=>row.some(cell=>normalizeSheetText(cell).replace(/[^a-z0-9]/g,"").includes("lmhubinventory")));
  if(headingIndex<0)return null;
  const end=Math.min(rows.length,headingIndex+61);
  for(let r=headingIndex;r<end;r++){
    const col=rows[r].findIndex(cell=>{
      const n=normalizeSheetText(cell).replace(/[^a-z0-9]/g,"");
      return n==="orderid"||n==="oid";
    });
    if(col>=0)return {headingIndex,headerIndex:r,oidColumn:col};
  }
  return null;
}
async function fetchGoogleText(url){
  // Google Sheets often rejects cross-origin fetches from extension pages with
  // a generic TypeError: Failed to fetch. Route the authenticated request through
  // the MV3 service worker, which has explicit Google host permissions.
  let reply;
  try {
    reply = await chrome.runtime.sendMessage({
      target: "POD_CHECKER_BACKGROUND",
      action: "FETCH_GOOGLE_TEXT",
      url: String(url)
    });
  } catch (error) {
    throw new Error(`Could not contact the extension background worker: ${error?.message || error}. Open Firefox Add-ons (about:addons), reload SPX BRIDGE for BADOC HUB, and try again.`);
  }
  if (!reply?.ok) throw new Error(reply?.error || "Google Sheets request failed.");
  const text = String(reply.text || "");
  if (/accounts\.google\.com\/.*ServiceLogin|Sign in to continue/i.test(text.slice(0,5000)))
    throw new Error("Google requires you to sign in again. Open your Daily Ops Dashboard, sign in, then reconnect it.");
  if (/^\s*<!doctype html/i.test(text) && /ServiceLogin|signin\/v2\/identifier/i.test(text.slice(0,12000)))
    throw new Error("Google redirected the request to its sign-in page. Sign in to the same Chrome profile that has your Daily Ops Dashboard open, then reconnect it.");
  return text;
}
async function fetchWorksheetCsv(spreadsheetId, gid){
  const safeId=encodeURIComponent(String(spreadsheetId));
  const safeGid=encodeURIComponent(String(gid));
  const exportUrl=`https://docs.google.com/spreadsheets/d/${safeId}/export?format=csv&gid=${safeGid}`;
  try {
    return await fetchGoogleText(exportUrl);
  } catch (exportError) {
    // Some Google Sheets sessions reject the /export endpoint for a worksheet
    // even though the sheet is readable. Try the authenticated Visualization CSV
    // endpoint as a second read-only path before treating the gid as invalid.
    const gvizUrl=`https://docs.google.com/spreadsheets/d/${safeId}/gviz/tq?tqx=out:csv&gid=${safeGid}`;
    try {
      const csv=await fetchGoogleText(gvizUrl);
      if (/^\s*<!doctype html/i.test(csv) || /google\.visualization\.Query\.setResponse/i.test(csv.slice(0,500))) {
        throw new Error("Google returned a non-CSV worksheet response.");
      }
      return csv;
    } catch (gvizError) {
      throw new Error(`Worksheet ${gid} could not be read. Export endpoint: ${exportError.message||exportError}. Alternate endpoint: ${gvizError.message||gvizError}.`);
    }
  }
}
async function inspectSpreadsheetForInventory(tab){
  const spreadsheetId=parseSpreadsheetId(tab.url);
  if(!spreadsheetId)return null;
  const base=`https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  const activeGid=(String(tab.url||"").match(/[?#&]gid=(\d+)/)||[])[1]||"";
  let html="",scanError="";
  // Fetch the workbook bootstrap HTML while reading the open tab's worksheet
  // strip. These independent operations can run at the same time.
  const [htmlResult,uiTabs]=await Promise.all([
    fetchGoogleText(`${base}/edit`).then(value=>({ok:true,value})).catch(error=>({ok:false,error})),
    discoverWorksheetGidsFromOpenTab(tab.id)
  ]);
  if(htmlResult.ok)html=htmlResult.value;
  else scanError=htmlResult.error?.message||String(htmlResult.error);
  const htmlGids=extractSheetIds(html,activeGid);
  const gids=uiTabs.gids.length
    ? [...new Set([...(uiTabs.inventoryGid?[uiTabs.inventoryGid]:[]),...uiTabs.gids,...htmlGids])]
    : htmlGids;
  if(uiTabs.error)scanError=scanError||uiTabs.error;

  const inventoryGids=[];
  let scanned=0;
  const tried=new Set();
  const readAndCheck=async gid=>{
    const key=String(gid);
    if(!key||tried.has(key))return false;
    tried.add(key);
    try{
      const csv=await fetchWorksheetCsv(spreadsheetId,key);
      scanned++;
      return !!findInventoryHeader(parseCsv(csv));
    }catch(error){
      scanError=scanError||error.message||String(error);
      return false;
    }
  };

  // Fast path: the user-facing worksheet tab is named Inventory. Read that
  // worksheet first and stop immediately when LM HUB INVENTORY + Order ID is
  // found. This turns the common case from N sequential exports into one.
  const preferredGid=String(uiTabs.inventoryGid||"");
  if(preferredGid && await readAndCheck(preferredGid))inventoryGids.push(preferredGid);

  // Fallback for dashboards whose target worksheet has a different tab name
  // or where the tab-strip didn't expose a GID. Use bounded concurrency rather
  // than serial network requests, and stop after the first confirmed match.
  if(!inventoryGids.length){
    const fallbackGids=[...new Set(gids.map(String).filter(Boolean))].filter(gid=>!tried.has(gid));
    let nextIndex=0;
    let matchedGid="";
    const worker=async()=>{
      while(!matchedGid){
        const index=nextIndex++;
        if(index>=fallbackGids.length)return;
        const gid=fallbackGids[index];
        const ok=await readAndCheck(gid);
        if(ok)matchedGid=gid;
      }
    };
    await Promise.all(Array.from({length:Math.min(4,fallbackGids.length)},()=>worker()));
    if(matchedGid)inventoryGids.push(matchedGid);
  }

  const cleanTitle=(tab.title||"Google Sheets document").replace(/\s+-\s+Google Sheets$/i,"").trim();
  return {
    spreadsheetId,
    tabId:tab.id,
    worksheetScanMethod:uiTabs.method||"html-metadata-fallback",
    worksheetLabels:uiTabs.labels||[],
    inventoryGid:String(inventoryGids[0]||uiTabs.inventoryGid||""),
    worksheetTabsRestored:uiTabs.restored!==false,
    url:String(tab.url||`${base}/edit`).split("#")[0],
    title:cleanTitle,
    inventoryGids,
    scanGids:gids,
    activeGid:String(activeGid||""),
    scannedWorksheetCount:scanned,
    verified:inventoryGids.length>0,
    scanError,
    windowId:tab.windowId,
    lastAccessed:tab.lastAccessed||0
  };
}

function showDashboardNotOpenPopup(){
  const modal=$("dashboardNotOpenModal");
  if(!modal)return;
  modal.hidden=false;
  $("closeDashboardNotOpenModal")?.focus();
}
function hideDashboardNotOpenPopup(){
  const modal=$("dashboardNotOpenModal");
  if(modal)modal.hidden=true;
  $("connectDashboard")?.focus();
}
function setDashboardFindingLoading(show,message=""){
  const overlay=$("dashboardFindingLoading");
  if(!overlay)return;
  const messageEl=$("dashboardFindingMessage");
  if(messageEl&&message)messageEl.textContent=message;
  overlay.classList.toggle("show",Boolean(show));
  overlay.setAttribute("aria-hidden",String(!show));
}
async function findDashboardCandidates(){
  const button=$("connectDashboard");
  const originalLabel=button.textContent;
  button.disabled=true;
  button.textContent="Finding Dashboard…";
  $("dashboardPicker").hidden=true;
  $("confirmDashboard").disabled=true;
  dashboardCandidates=[];
  setDashboardFindingLoading(true,"Searching all open Chrome windows for [NOL3] Daily Ops Dashboard…");
  try{
    // Allow the browser to paint the loading overlay before beginning tab and
    // worksheet discovery, which can involve several authenticated requests.
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const tabs=await listOpenSpreadsheetTabs();
    if(!tabs.length){
      if(tabs.dailyOpsTitleMatchCount === 0 && tabs.googleSheetsTabCount > 0){
        const otherTitles=tabs.ignoredGoogleSheetsTitles?.slice(0,3).join("; ") || "";
        const message=`No open Google Sheets tab starts with \"${DAILY_OPS_TITLE_PREFIX}\". Open the correct Daily Ops Dashboard in Chrome, wait for it to load, then click Find Daily Ops Dashboard Sheet again.${otherTitles ? ` Other Google Sheets were ignored: ${otherTitles}` : ""}`;
        dashboardStatus(message,"error");
        showDashboardNotOpenPopup();
        return;
      }
      if(tabs.dailyOpsTitleMatchCount > 0 && tabs.unparsedGoogleSheetsTabs?.length){
        const details=tabs.unparsedGoogleSheetsTabs.slice(0,2).map(t=>`${t.title}: ${t.url}`).join("; ");
        dashboardStatus(`A matching Daily Ops Dashboard is open, but its spreadsheet ID could not be read. Reload that sheet in this same Chrome profile, wait until it finishes loading, then try again.${details ? ` Detected: ${details}` : ""}`,"error");
        return;
      }
      const message=`No Google Sheets dashboard tab starting with \"${DAILY_OPS_TITLE_PREFIX}\" was detected in this Chrome profile. Open your Daily Ops Dashboard in a regular Chrome tab, wait for it to load, then click Find Daily Ops Dashboard Sheet again.`;
      dashboardStatus(message,"error");
      showDashboardNotOpenPopup();
      return;
    }
    const errors=[];
    for(let i=0;i<tabs.length;i++){
      const tab=tabs[i];
      const scanMessage=`Scanning spreadsheet ${i+1} of ${tabs.length}: ${tab.title||"Google Sheets document"}. Checking the Inventory worksheet first…`;
      setDashboardFindingLoading(true,scanMessage);
      dashboardStatus(scanMessage);
      try{
        const candidate=await inspectSpreadsheetForInventory(tab);
        if(candidate)dashboardCandidates.push(candidate);
      }catch(error){errors.push(`${tab.title||"Spreadsheet"}: ${error.message}`);}
    }
    if(!dashboardCandidates.length){
      const detail=errors.length?` Details: ${errors.slice(0,2).join("; ")}`:"";
      throw new Error(`Chrome found ${tabs.length} open Google Sheets tab(s), but could not read their spreadsheet information. Confirm you are signed in and that the dashboard is open in this Chrome profile, then try again.${detail}`);
    }
    // Only offer spreadsheets in which the Daily Ops inventory section was
    // actually identified. This prevents an unrelated open Google Sheet from
    // being connected by mistake.
    const verifiedCandidates=dashboardCandidates.filter(candidate=>candidate.verified);
    if(!verifiedCandidates.length){
      if(dashboardCandidates.some(candidate=>candidate.scanError)){
        const detail=dashboardCandidates.map(candidate=>candidate.scanError).filter(Boolean).slice(0,2).join("; ");
        dashboardStatus(`Google Sheets are open, but the extension could not verify an LM HUB INVENTORY section with an Order ID column. Open the correct Daily Ops Dashboard, make sure it has finished loading, then try again.${detail?` Details: ${detail}`:""}`,"error");
      }else{
        const message="Daily Ops Dashboard was not found among the open Google Sheets. Open your own Daily Ops Dashboard in Chrome and wait for it to load, then click Find Daily Ops Dashboard Sheet again.";
        dashboardStatus(message,"error");
        showDashboardNotOpenPopup();
      }
      return;
    }
    dashboardCandidates=verifiedCandidates;
    const select=$("dashboardCandidate");
    select.innerHTML="";
    dashboardCandidates.forEach((candidate,index)=>{
      const option=document.createElement("option");
      option.value=String(index);
      const state="✓ LM HUB INVENTORY found";
      option.textContent=`${candidate.title} — ID …${candidate.spreadsheetId.slice(-7)} · ${state} · Window ${candidate.windowId}`;
      select.appendChild(option);
    });
    $("dashboardPicker").hidden=false;
    $("confirmDashboard").disabled=false;
    const verified=dashboardCandidates.filter(c=>c.verified).length;
    dashboardStatus(`${dashboardCandidates.length} matching Daily Ops Dashboard spreadsheet(s) found. Select your own dashboard by title and partial ID, then connect it.` ,"good");
  }catch(error){dashboardStatus(error.message||String(error),"error");}
  finally{
    setDashboardFindingLoading(false);
    button.disabled=false;
    button.textContent=originalLabel;
  }
}
async function confirmDashboardConnection(){
  const button=$("confirmDashboard");button.disabled=true;
  try{
    const index=Number($("dashboardCandidate").value);
    const candidate=dashboardCandidates[index];
    if(!candidate)throw new Error("Select a dashboard from the list first.");
    const connection={...candidate,explicitlySelected:true,connectedAt:Date.now()};
    await chrome.storage.local.set({[DASHBOARD_STORAGE_KEY]:connection});
    $("importInventory").disabled=false;
    $("disconnectDashboard").disabled=false;
    $("dashboardPicker").hidden=true;
    dashboardStatus(`Connected to: ${connection.title} (spreadsheet ID …${connection.spreadsheetId.slice(-7)}). Import will use this exact spreadsheet, not another open Google Sheet.` ,"good");
  }catch(error){dashboardStatus(error.message||String(error),"error");}
  finally{button.disabled=false;}
}
async function importInventory(){
  const button=$("importInventory");button.disabled=true;
  try{
    const saved=(await chrome.storage.local.get(DASHBOARD_STORAGE_KEY))[DASHBOARD_STORAGE_KEY];
    if(!saved?.spreadsheetId || saved.explicitlySelected!==true)throw new Error("The previous dashboard connection was automatically selected and may be incorrect. Disconnect it, open your own Daily Ops Dashboard, then use Find Open Dashboards and connect the correct file.");
    dashboardStatus(`Reading LM HUB INVENTORY from ${saved.title||"the connected dashboard"}…`);
    const base=`https://docs.google.com/spreadsheets/d/${saved.spreadsheetId}`;
    // If the selected dashboard was verified during connection, use ONLY the
    // worksheet IDs that actually contained LM HUB INVENTORY. This avoids HTTP
    // 400 errors caused by unrelated numeric IDs in Google's page bootstrap.
    let gids=Array.isArray(saved.inventoryGids)?saved.inventoryGids.map(String).filter(Boolean):[];
    let metadataError="";
    if(!gids.length){
      let freshGids=[];
      try{
        const html=await fetchGoogleText(`${base}/edit`);
        freshGids=extractSheetIds(html,saved.activeGid||"");
      }catch(error){metadataError=error.message||String(error);}
      gids=[...new Set([String(saved.activeGid||""),...freshGids,...(saved.scanGids||[]).map(String),"0"].filter(Boolean))];
    }
    let found=[];let scanned=0;let foundSheet=false;const worksheetErrors=[];
    for(const gid of gids){
      let csv;
      try{
        csv=await fetchWorksheetCsv(saved.spreadsheetId,gid);
      }catch(error){
        worksheetErrors.push(`gid ${gid}: ${error.message||String(error)}`);
        continue;
      }
      const rows=parseCsv(csv);scanned++;
      const header=findInventoryHeader(rows);
      if(!header)continue;
      foundSheet=true;
      for(let r=header.headerIndex+1;r<rows.length;r++){
        const value=String(rows[r][header.oidColumn]||"").trim().replace(/^['"]|['"]$/g,"");
        if(OID_CELL_RE.test(value))found.push(value.toUpperCase());
      }
    }
    if(!foundSheet){
      const details=worksheetErrors.length?` First read error: ${worksheetErrors[0]}`:"";
      const metadata=metadataError?` Workbook metadata could not be refreshed: ${metadataError}.`:"";
      throw new Error(`Could not find LM HUB INVENTORY with an Order ID column in the selected spreadsheet (${saved.title}). The importer now scans the worksheet IDs discovered from the spreadsheet tab strip, regardless of the active tab. Reconnect while the dashboard is open so it can refresh its worksheet list.${metadata}${details}`);
    }
    const unique=[...new Set(found)];
    if(!unique.length)throw new Error("Found LM HUB INVENTORY and its Order ID column in the connected dashboard, but no valid OIDs were present.");
    const existing=parseOids();const merged=[...new Set([...existing,...unique])];
    $("oids").value=merged.join("\n");await saveOids();
    dashboardStatus(`Imported ${unique.length.toLocaleString()} unique OID(s) from ${saved.title}. ${Math.max(0,merged.length-existing.length).toLocaleString()} new OID(s) added to the paste box. Scanned ${scanned} worksheet tab(s).${worksheetErrors.length?` Skipped ${worksheetErrors.length} unreadable worksheet ID(s).`:""}`,"good");
    setStatus(`Imported ${unique.length.toLocaleString()} unique OID(s) from your Daily Ops Dashboard. Click Check OIDs when ready.`,"good");
  }catch(error){
    const message=error.message||String(error);
    dashboardStatus(message,"error");
    if(/Google returned HTTP 401|HTTP 403|Sign in|permission|Failed to fetch/i.test(message))dashboardStatus(`${message} Open the dashboard in Chrome, confirm you are signed in and have access, then click Find Open Dashboards again.`,"error");
  }finally{button.disabled=false;}
}
async function loadDashboardConnection(){
  const saved=(await chrome.storage.local.get(DASHBOARD_STORAGE_KEY))[DASHBOARD_STORAGE_KEY];
  if(saved?.spreadsheetId && saved.explicitlySelected===true){
    $("importInventory").disabled=false;
    $("disconnectDashboard").disabled=false;
    dashboardStatus(`Connected to: ${saved.title||"Daily Ops Dashboard"} (spreadsheet ID …${saved.spreadsheetId.slice(-7)}). If this is the wrong file, click Disconnect Dashboard, then Find Open Dashboards and select the correct one.`,"good");
  } else if(saved?.spreadsheetId){
    // v1.5.34 selected an open Sheet automatically. Clear that potentially
    // incorrect connection and require a deliberate user selection in v1.5.35.
    await chrome.storage.local.remove(DASHBOARD_STORAGE_KEY);
    $("importInventory").disabled=true;
    $("disconnectDashboard").disabled=true;
    dashboardStatus("Previous automatic dashboard connection cleared because it may have selected the wrong spreadsheet. Open your own Daily Ops Dashboard, then click Find Open Dashboards and select it explicitly.","error");
  }
}
$("closeDashboardNotOpenModal")?.addEventListener("click",hideDashboardNotOpenPopup);
$("dashboardNotOpenModal")?.addEventListener("click",event=>{if(event.target?.id==="dashboardNotOpenModal")hideDashboardNotOpenPopup();});
document.addEventListener("keydown",event=>{if(event.key==="Escape" && $("dashboardNotOpenModal") && !$("dashboardNotOpenModal").hidden)hideDashboardNotOpenPopup();});
$("connectDashboard")?.addEventListener("click",findDashboardCandidates);
$("confirmDashboard")?.addEventListener("click",confirmDashboardConnection);
$("importInventory")?.addEventListener("click",importInventory);
$("disconnectDashboard")?.addEventListener("click",async()=>{
  await chrome.storage.local.remove(DASHBOARD_STORAGE_KEY);
  $("importInventory").disabled=true;$("disconnectDashboard").disabled=true;
  $("dashboardPicker").hidden=true;
  dashboardCandidates=[];
  dashboardStatus("Dashboard disconnected. Open your own Daily Ops Dashboard, then click Find Open Dashboards.");
});

loadSaved().catch(error=>setStatus(`Extension connection required: ${error?.message||String(error)}`,"error"));
/* Daily Ops Dashboard connection UI removed from the POD/POOH menu. */


})();
