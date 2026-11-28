#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const core=readFileSync(resolve(root,'js/120-app-core.js'),'utf8');
function extract(startMarker,endMarker){
  const start=core.indexOf(startMarker);assert.notEqual(start,-1,`missing ${startMarker}`);
  const end=core.indexOf(endMarker,start);assert.notEqual(end,-1,`missing ${endMarker}`);
  return core.slice(start,end);
}
const sandbox={window:{},norm:value=>String(value??'').trim().replace(/\s+/g,' ').toUpperCase(),spxTN:r=>String(r?.['SLS Tracking Number']??r?.['SPX TN']??r?.['Tracking Number']??'').trim().toUpperCase()};
vm.createContext(sandbox);
vm.runInContext(extract('function parseCSV(text){','\nwindow.__badocParseCSV=parseCSV;'),sandbox);
vm.runInContext(extract('function badocPickupTimeValue(row){','\nwindow.__badocMergeParcelRows=mergeParcelRowsPreservingPickup;'),sandbox);
vm.runInContext(extract('function mergeRowsUnique(rows){','\nfunction mergeAllBatches(){'),sandbox);

test('CSV parser handles BOM, quoted commas, escaped quotes and CRLF',()=>{
  const rows=sandbox.parseCSV('\uFEFFSLS Tracking Number,Town Name,Remark\r\nSPEPH123,"BADOC, NORTH","said ""hello"""');
  assert.equal(rows.length,1);assert.equal(rows[0]['Town Name'],'BADOC, NORTH');assert.equal(rows[0].Remark,'said "hello"');
});
test('CSV parser rejects unclosed quotes and duplicate headers',()=>{
  assert.throws(()=>sandbox.parseCSV('TN,Name\n"SPEPH123,John'),/opening quote/);
  assert.throws(()=>sandbox.parseCSV('TN,tn\n1,2'),/duplicate column header/i);
});
test('latest Forward/Return export merge preserves the prior pickup timestamp',()=>{
  assert.match(core,/const merged=mergeParcelRowsPreservingPickup\(existing\|\|\{\},exportRow\);/);
  assert.match(core,/merged\[\"Parcel Status To\"\]=planningStatus;/);
});

test('row merge preserves known town and pickup data when newer export is blank',()=>{
  const merged=sandbox.mergeParcelRowsPreservingPickup({'SLS Tracking Number':'SPEPH123','Town Name':'BADOC','Pick Up Time':'2026-11-24 06:00','Status':'In Transit'},{'SLS Tracking Number':'SPEPH123','Town Name':'','Status':'Delivered','Pick Up Time':''});
  assert.equal(merged['Town Name'],'BADOC');assert.equal(merged['Pick Up Time'],'2026-11-24 06:00');assert.equal(merged.Status,'Delivered');
});
test('TN-only and OID-only rows reconcile to one parcel when an identifier connects them',()=>{
  const rows=sandbox.mergeRowsUnique([
    {'SLS Tracking Number':'SPEPH123','Town Name':'BADOC'},
    {'Order ID':'OID-9','Town Name':'BADOC'},
    {'SLS Tracking Number':'SPEPH123','Order ID':'OID-9','Status':'Delivered'}
  ]);
  assert.equal(rows.length,1);assert.equal(rows[0]['Order ID'],'OID-9');assert.equal(rows[0].Status,'Delivered');
});

test('CFR1 Rule B uses original per-row upload provenance after cloud synchronization',()=>{
  const runtime=readFileSync(resolve(root,'js/240-operation-runtime.js'),'utf8');
  assert.match(runtime,/btime:Number\(r\?\._badoc_sourceUploadedAt\|\|b\?\.time\|\|0\)/);
  const cloud=readFileSync(resolve(root,'js/210-shared-cloud-sync.js'),'utf8');
  assert.match(cloud,/_badoc_sourceUploadedAt/);
});

test('Daily History and CFR summary captures perform read-back verification',()=>{
  const history=readFileSync(resolve(root,'js/410-cloud-daily-history.js'),'utf8');
  assert.match(history,/Daily History read-back verification failed/);
  assert.match(history,/CFR summary read-back verification failed/);
  assert.match(history,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
});
test('storage health and local recovery export are exposed',()=>{
  assert.match(core,/__badocGetStorageHealth/);assert.match(core,/__badocExportLocalParcelBackup/);
  const health=readFileSync(resolve(root,'js/500-health-ui.js'),'utf8');
  assert.match(health,/shExportParcelBackup/);
});
test('Chrome and Firefox extension manifests exist and reference their background entrypoints',()=>{
  const chrome=JSON.parse(readFileSync(resolve(root,'extension/manifest.json'),'utf8'));
  const firefox=JSON.parse(readFileSync(resolve(root,'extension-firefox/manifest.json'),'utf8'));
  assert.equal(chrome.manifest_version,3);assert.ok(existsSync(resolve(root,'extension',chrome.background.service_worker)));
  assert.ok(existsSync(resolve(root,'extension-firefox',firefox.background.scripts?.[0]||firefox.background.service_worker||'')));
});
test('cloud uploads and cloud clears share a cross-device writer lease',()=>{
  const cloud=readFileSync(resolve(root,'js/210-shared-cloud-sync.js'),'utf8');
  assert.match(cloud,/badoc-shared-file-writer-v1/);
  assert.match(cloud,/await acquireSharedFileWriterLease\(\);sharedWriterLease=true/);
  assert.match(cloud,/if\(sharedWriterLease\)await releaseSharedFileWriterLease\(\)/);
});
test('daily reset script recognizes a valid empty parcel dataset',()=>{
  const reset=readFileSync(resolve(root,'tools/auto-reset.mjs'),'utf8');
  assert.match(reset,/Array\.isArray\(current\.valid\).*Array\.isArray\(current\.mis\).*Array\.isArray\(current\.rows\)/s);
});


test('cloud row insert is atomic and cannot overwrite a concurrent existing row',async()=>{
  const adapter=readFileSync(resolve(root,'js/050-cloud-adapter.js'),'utf8');
  const start=adapter.indexOf('async function insertRowAtomically(table, payload) {');
  assert.notEqual(start,-1,'atomic insert helper exists');
  const end=adapter.indexOf('\n\n  function Query(table)',start);
  assert.notEqual(end,-1,'atomic insert helper boundary exists');
  const store={};
  const isolated={
    getDb:async()=>({}),
    enc:value=>encodeURIComponent(String(value)).replace(/\./g,'%2E')||'_',
    ref:(_db,path)=>({transaction:async update=>{
      const current=Object.prototype.hasOwnProperty.call(store,path)?store[path]:null;
      const next=update(current);
      if(next===undefined)return {committed:false,snapshot:{val:()=>current}};
      store[path]=next;
      return {committed:true,snapshot:{val:()=>next}};
    }}),
    parseRow:node=>node&&typeof node.j==='string'?JSON.parse(node.j):null
  };
  vm.createContext(isolated);
  vm.runInContext(adapter.slice(start,end),isolated);
  const first=await isolated.insertRowAtomically('settings',{id:'global',value:'first'});
  const second=await isolated.insertRowAtomically('settings',{id:'global',value:'second'});
  assert.equal(first.duplicate,false);
  assert.equal(first.row.value,'first');
  assert.equal(second.duplicate,true);
  assert.equal(second.row.value,'first');
});


test('menu navigation defers heavy page rendering and avoids duplicate forecast recalculation',()=>{
  const start=core.indexOf('function showPage(p){');assert.notEqual(start,-1);
  const end=core.indexOf('\n$("parcelIncomingVolumeBtn")',start);assert.notEqual(end,-1);
  const nav=core.slice(start,end);
  assert.match(nav,/requestAnimationFrame/);
  assert.match(nav,/badocMenuRenderToken/);
  assert.doesNotMatch(nav,/updateOperationProgress/);
});

test('Linehaul rendering shares parcel indexes across tasks and clears its detail cache',()=>{
  const start=core.indexOf('function renderLinehaulCore(){');assert.notEqual(start,-1);
  const end=core.indexOf('\nfunction renderLinehaul(){',start);assert.notEqual(end,-1);
  const block=core.slice(start,end);
  const taskLoop=block.indexOf('linehaulTasks.forEach((task,taskIndex)=>{');
  assert.notEqual(taskLoop,-1);
  assert.ok(block.indexOf('const taskMisMap=new Map();')<taskLoop);
  assert.ok(block.indexOf('const parcelOrderIndex=new Set();')<taskLoop);
  const inner=block.slice(taskLoop);
  assert.doesNotMatch(inner,/const taskMisMap=new Map\(\)/);
  assert.doesNotMatch(inner,/const parcelOrderIndex=new Set\(\)/);
  assert.match(block,/detailStore\.clear\(\)/);
});

test('KPI menu reuses fresh sheet data and deduplicates concurrent pulls',()=>{
  assert.match(core,/__badocKpiLastSuccessAt/);
  assert.match(core,/__badocKpiLoadPromise/);
  assert.match(core,/now-lastSuccess<REFRESH_MS/);
});


test('Volume Forecast maps parcel rows once per source dataset and reuses them for filtering',()=>{
  const forecast=readFileSync(resolve(root,'js/510-volume-forecast-board.js'),'utf8');
  assert.match(forecast,/sourceRowsDetailsCache!==d\|\|sourceRowsArrayCache!==boardRows/);
  assert.match(forecast,/sourceRowsCache\.push\(/);
  assert.match(forecast,/selectedRows\(rows\)/);
  assert.doesNotMatch(forecast,/var shown=selectedRows\(\)/);
});

test('Volume Forecast town cards use a single town aggregation instead of filtering the full list per town',()=>{
  const forecast=readFileSync(resolve(root,'js/510-volume-forecast-board.js'),'utf8');
  assert.match(forecast,/function buildTownStats\(rows\)/);
  assert.match(forecast,/var townStats=buildTownStats\(shown\)/);
  const start=forecast.indexOf('function renderTownGroups(');
  const end=forecast.indexOf('function csvCell(',start);
  assert.notEqual(start,-1);assert.notEqual(end,-1);
  const renderer=forecast.slice(start,end);
  assert.doesNotMatch(renderer,/rows\.filter\(/);
  assert.match(renderer,/townStats\.get\(normText\(name\)\)/);
});

test('Volume Forecast skips full rendering while its page is hidden at startup',()=>{
  const forecast=readFileSync(resolve(root,'js/510-volume-forecast-board.js'),'utf8');
  assert.match(forecast,/function init\(\)\{\s*bind\(\);\s*if\(el\("volumeForecastBoard"\)\?\.classList\.contains\("active"\)\)render\(\);/);
});


test('Pickup results hide Record Type and sort assigned rider names ascending',()=>{
  const marker='const columns=[';
  const start=core.indexOf(marker);assert.notEqual(start,-1);
  const end=core.indexOf('if(table&&$("firstMile")',start);assert.notEqual(end,-1);
  const columns=core.slice(start,end);
  assert.doesNotMatch(columns,/Record Type/);
  assert.match(core,/new Intl\.Collator\("en",\{sensitivity:"base",numeric:true\}\)/);
  assert.match(core,/riderCollator\.compare\(a\.rider,b\.rider\)/);
  assert.match(core,/aUnassigned\?1:-1/);
});

test('Pickup results render every filtered row without virtual scrolling or a 2000-row cap',()=>{
  const start=core.indexOf('if(table&&$("firstMile")',core.indexOf('function renderFirstMileCombined'));
  const end=core.indexOf('if(downloadBtn)downloadBtn.disabled=!filtered.length;',start);
  assert.notEqual(start,-1);assert.notEqual(end,-1);
  const render=core.slice(start,end);
  assert.match(render,/visibleGroups\.map\(rowHtml\)\.join\(''\)/);
  assert.doesNotMatch(render,/renderWindow|virtualStart|virtualEnd|maxRows|2000/);
  assert.match(readFileSync(resolve(root,'css/app.css'),'utf8'),/\.first-mile-combined-table\{[\s\S]*?max-height:none!important;[\s\S]*?overflow-y:visible!important;/);
});


test('Pickup CSV export also omits the Record Type field',()=>{
  const start=core.indexOf('$("downloadFirstMileCombined")?.addEventListener("click"');
  const end=core.indexOf('$("downloadFirstMileOrders")',start);
  assert.notEqual(start,-1);assert.notEqual(end,-1);
  const exporter=core.slice(start,end);
  assert.match(exporter,/const headers=\["Order Number","Pickup Task Number"/);
  assert.doesNotMatch(exporter,/Record Type|g\.taskOnly\?"Pickup Task"/);
});


test('Light theme has readable colors for Planning Board, Collapse Menu and Linehaul sync',()=>{
  const css=readFileSync(resolve(root,'css/app.css'),'utf8');
  assert.match(css,/html\[data-theme="light"\] \.side \.planning-board-nav\.open \.planning-board-primary[\s\S]*?background:#e8f2ff!important;[\s\S]*?color:#17436b!important;/);
  assert.match(css,/html\[data-theme="light"\] \.side > \.sidebar-footer > #sideCollapseBtn[\s\S]*?background:#edf5fc!important;[\s\S]*?color:#234967!important;/);
  assert.match(css,/html\[data-theme="light"\] #linehaul #syncLinehaulFromSPX[\s\S]*?background:#1d63bd!important;[\s\S]*?color:#fff!important;/);
});


test('Light mode keeps an expanded non-active Planning Board neutral',()=>{
  const css=readFileSync(resolve(root,'css/app.css'),'utf8');
  assert.match(css,/\.planning-board-nav\.open \.planning-board-primary:not\(\.active\)[\s\S]*?background:transparent!important;[\s\S]*?box-shadow:none!important;/);
  assert.match(css,/\.planning-board-primary\.active\{[\s\S]*?background:#e8f2ff!important;/);
});

test('Light mode recolors the entire sidebar footer and theme switch row',()=>{
  const css=readFileSync(resolve(root,'css/app.css'),'utf8');
  assert.match(css,/html\[data-theme="light"\] \.side > \.sidebar-footer\{[\s\S]*?background:#f4f7fb!important;/);
  assert.match(css,/html\[data-theme="light"\] \.side > \.sidebar-footer > \.theme-switch-row\{[\s\S]*?background:#edf4fa!important;/);
  assert.match(css,/html\[data-theme="light"\] \.side > \.sidebar-footer \.theme-switch-label,[\s\S]*?color:#40566b!important;/);
});


test('Batch Search Result export is fixed to the canonical 51 parcel columns',()=>{
  const background=readFileSync(resolve(root,'extension/background.js'),'utf8');
  const start=background.indexOf('const BATCH_SEARCH_RESULT_HEADERS = Object.freeze(');
  const end=background.indexOf('async function runBatchSearchExportJob(job)',start);
  assert.notEqual(start,-1);assert.notEqual(end,-1);
  const sandbox={};vm.createContext(sandbox);
  vm.runInContext(background.slice(start,end),sandbox);
  const headers=Array.from(sandbox.BATCH_SEARCH_RESULT_HEADERS);
  assert.equal(headers.length,51);
  assert.equal(headers[0],'Order ID');
  assert.equal(headers[1],'SLS Tracking Number');
  assert.equal(headers[50],'Size Type');
  const row=sandbox.batchSearchCanonicalSourceFields({
    'Assignment Task Tracking Number':'SPEPH06562202607B',
    'Search Result':'Found',
    'Error':'',
    'Size Type':'Non-Cache',
    'Received Time':'46352.85241',
    'SLS Tracking Number':'PH262656732858K',
    'Order ID':'SPEPH06562202607B',
    'Specical Dg Type':'Non-DG'
  });
  assert.deepEqual(Object.keys(row),headers);
  assert.equal(row['Order ID'],'SPEPH06562202607B');
  assert.equal(row['SLS Tracking Number'],'PH262656732858K');
  assert.match(row['Received Time'],/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  assert.equal(row['Specical Dg Type'],'Non-DG');
  assert.equal(Object.hasOwn(row,'Assignment Task Tracking Number'),false);
  assert.equal(Object.hasOwn(row,'Search Result'),false);
  assert.equal(Object.hasOwn(row,'Error'),false);
  const csv=sandbox.batchSearchCsv([row]);
  assert.deepEqual(csv.split('\r\n',1)[0].split(','),headers);
});

test('Batch Search parser identifies repeated parcel header rows without dropping data rows',()=>{
  const background=readFileSync(resolve(root,'extension/background.js'),'utf8');
  const start=background.indexOf('const BATCH_SEARCH_RESULT_HEADERS = Object.freeze(');
  const end=background.indexOf('async function runBatchSearchExportJob(job)',start);
  const sandbox={};vm.createContext(sandbox);
  vm.runInContext(background.slice(start,end),sandbox);
  const headers=Array.from(sandbox.BATCH_SEARCH_RESULT_HEADERS);
  assert.equal(sandbox.isBatchSearchRepeatedHeaderRow(headers,headers),true);
  const parcel=headers.map(header=>{
    if(header==='Order ID')return 'SPEPH06562202607B';
    if(header==='SLS Tracking Number')return 'PH262656732858K';
    if(header==='Status')return 'Delivered';
    return '';
  });
  assert.equal(sandbox.isBatchSearchRepeatedHeaderRow(headers,parcel),false);
  assert.match(background,/rawDataRows\.filter\(row=>!isBatchSearchRepeatedHeaderRow\(headers,row\)\)/);
});

test('Batch Search output keeps Not Found and Failed as counts, not extra columns',()=>{
  const background=readFileSync(resolve(root,'extension/background.js'),'utf8');
  const start=background.indexOf('async function runBatchSearchExportJob(job)');
  const end=background.indexOf('function getExportMediaId(',start);
  const block=background.slice(start,end);
  assert.match(block,/const outputHeaders=BATCH_SEARCH_RESULT_HEADERS/);
  assert.match(block,/if\(error\) \{ failedCount\+\+; continue; \}/);
  assert.match(block,/if\(!record\|\|record\.explicitlyNotFound\) \{ notFoundCount\+\+; continue; \}/);
  assert.doesNotMatch(block,/Assignment Task Tracking Number|Search Result|Badoc Search Result/);
  assert.equal(block.includes('row[errorHeader]'),false);
});


test('LM Hub Inventory uses the updated 51-column header without Longitude or Latitude',()=>{
  const reports=readFileSync(resolve(root,'js/090-reports-tabs.js'),'utf8');
  const headerStart=reports.indexOf('const lmInventoryHeaders=[');
  assert.notEqual(headerStart,-1,'LM Hub Inventory header array exists');
  const arrayStart=reports.indexOf('[',headerStart);
  const arrayEnd=reports.indexOf('];',arrayStart);
  assert.notEqual(arrayEnd,-1,'LM Hub Inventory header array closes');
  const headers=vm.runInNewContext(reports.slice(arrayStart,arrayEnd+1));
  const expected=[
    'Order ID','SLS Tracking Number','Shopee Order SN','Sort Code Name','Town Name','Location Type',
    'Driver ID','Driver Name','Driver Phone','Received Time','Current Station Received Time',
    'Delivering Time','Delivered Time','OnHold Time','OnHoldReason','Reschedule Date','Status',
    'Reject remark','COD Amount','Manifest Number','Order Account','Original ASF','Rounding ASF',
    'Total of On Hold Times','Reschedule Time','Delivery Attempts','Bulky Type','SLA Target Date',
    'Time to SLA','Payment Method','Current Station','Shop ID','Shop Category','Zone ID','Zone',
    'Destination Station','Next Station','Pickup Station','Ros','Driver Contract Type','Pick Up Time',
    'Collected Time','Transported to sp time','SLA Tag','High Value','Specical Dg Type','Damaged Tag',
    'Return Destination','Chargeable Weight','Cache Type','Size Type'
  ];
  assert.deepEqual(headers,expected);
  assert.equal(headers.length,51);
  assert.equal(headers.includes('Longitude'),false);
  assert.equal(headers.includes('Latitude'),false);
});

test('Settings combines Clear Data and Reset CFR1 behind one confirmation',()=>{
  const html=readFileSync(resolve(root,'index.html'),'utf8');
  assert.ok(html.includes('id="clearData" type="button">Clear Data + Reset CFR1'));
  assert.equal(html.includes('id="resetCfr1"'),false);
  assert.equal(html.includes('settingsClearDataWord'),false);
  const start=core.indexOf('$("clearData").onclick=async()=>{');
  const end=core.indexOf('/*\\n V1.10 KPI CONNECTION',start);
  assert.notEqual(start,-1);assert.notEqual(end,-1);
  const handler=core.slice(start,end);
  assert.ok(handler.includes('if(!confirm("Clear operational data and reset CFR1'));
  assert.ok(handler.includes('await resetCfr1Cloud();'));
  assert.ok(handler.indexOf('await resetCfr1Cloud();')<handler.indexOf('const db=await openDB();'));
  assert.equal(core.includes('$("resetCfr1")'),false);
  const settings=readFileSync(resolve(root,'js/570-settings-center.js'),'utf8');
  assert.equal(settings.includes('settingsClearDataWord'),false);
});
