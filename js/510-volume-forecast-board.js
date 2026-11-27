(function(){
  if(window.__badocForecastBoardV29)return;
  window.__badocForecastBoardV29=true;
  var page=1,pageSize=50,filteredRows=[];
  var ids={total:"forecastBoardTotal",badoc:"forecastBoardBadoc",pinili:"forecastBoardPinili",stations:"forecastBoardStations",state:"forecastBoardState",stats:"forecastBoardStatusStats",badocGrid:"forecastBoardBadocGrid",piniliGrid:"forecastBoardPiniliGrid",meta:"forecastBoardRecordMeta",table:"forecastBoardTable",pagination:"forecastBoardPagination",search:"forecastBoardSearch",town:"forecastBoardTown",station:"forecastBoardStation",status:"forecastBoardStatus"};
  var el=function(id){return document.getElementById(id)};
  var text=function(v){return String(v==null?"":v)};
  var esc=function(v){return text(v).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]})};
  var key=function(v){return text(v).toUpperCase().replace(/[^A-Z0-9]+/g,"")};
  var normText=function(v){return text(v).trim().toUpperCase()};
  var townOf=function(r){return text(r&& (r["Town Name"]??r["Town"]??r.town) || "").trim()};
  var tnOf=function(r,item){return text(r&&(r["SLS Tracking Number"]??r["SLS Tracking"]??r["Tracking Number"]??r["SPX TN"]??r["SPX Tracking Number"]) || item&&item.tn || "").trim()};
  var orderOf=function(r){return text(r&&(r["Order ID"]??r["Order Id"]??r["order_id"]) || "").trim()};
  var statusKey=function(v){return key(v)};
  var statusLabel=function(v){var k=statusKey(v);var map={RECEIVED:"RECEIVED",LMHUBRECEIVED:"LMHub Received",SOCLHTRANSPORTING:"SOC LH Transporting",SOCLHTRANSPORTED:"SOC LH Transported",SOCLHPACKED:"SOC LH Packed",SOCLHPACKING:"SOC LH Packing",SOCPACKED:"SOC Packed",SOCPACKING:"SOC Packing"};return map[k]||text(v||"Unknown")};
  var shortStatus=function(k){var map={RECEIVED:"R",LMHUBRECEIVED:"R",SOCLHTRANSPORTING:"TR",SOCLHTRANSPORTED:"TD",SOCLHPACKED:"P",SOCLHPACKING:"PK",SOCPACKED:"P",SOCPACKING:"PK"};return map[k]||k.slice(0,4)};
  var sourceRowsDetailsCache=null,sourceRowsArrayCache=null,sourceRowsCache=[];
  function sourceRows(){
    var d=window.__badocForecastDetails;
    var boardRows=d&&(Array.isArray(d.allDayRows)?d.allDayRows:d.rows);
    if(!d||!Array.isArray(boardRows)){
      sourceRowsDetailsCache=null;sourceRowsArrayCache=null;sourceRowsCache=[];
      return {details:null,rows:[]};
    }
    if(sourceRowsDetailsCache!==d||sourceRowsArrayCache!==boardRows){
      sourceRowsDetailsCache=d;
      sourceRowsArrayCache=boardRows;
      sourceRowsCache=[];
      boardRows.forEach(function(item){
        var r=item.record||item.row;
        if(!r||typeof r!=="object")return;
        var tn=tnOf(r,item);if(!tn)return;
        sourceRowsCache.push({item:item,row:r,tn:tn,town:townOf(r),station:text(item.station||r["Current Station"]||""),status:text(item.status||r["Parcel Status To"]||r.Status||"")});
      });
    }
    var enabled=typeof window.__badocForecastGroupEnabled==="function"?window.__badocForecastGroupEnabled:function(){return true};
    var out=[];
    sourceRowsCache.forEach(function(x){if(enabled(x.station,x.status))out.push(x);});
    return {details:d,rows:out};
  }
    function areaSets(){
    var b=typeof towns!=="undefined"&&Array.isArray(towns.badoc)?towns.badoc:[];
    var p=typeof towns!=="undefined"&&Array.isArray(towns.pinili)?towns.pinili:[];
    return {badoc:new Set(b.map(normText)),pinili:new Set(p.map(normText)),badocList:b,piniliList:p};
  }
  function riderNameKey(value){return text(value).trim().toUpperCase().replace(/[\s_-]+/g,"");}
  function renderRiderSummary(){
    var node=el("dashboardRiderSummary");if(!node)return;
    var assignedNames=new Map();
    ["badoc","pinili"].forEach(function(areaKey){
      var assignments=typeof getTownNotes==="function"?getTownNotes(areaKey):[];
      var groupCount=typeof getTownLayout==="function"?getTownLayout(areaKey).length:assignments.length;
      for(var i=0;i<Math.min(groupCount,assignments.length);i++){
        var name=text(assignments[i]||"").trim(),keyName=riderNameKey(name);
        if(name&&keyName&&!assignedNames.has(keyName))assignedNames.set(keyName,name);
      }
    });
    var riders=Array.isArray(ridersData)?ridersData:[],byName=new Map();
    riders.forEach(function(r){
      var k=riderNameKey(r&&r["Driver Name"]);if(!k)return;
      var previous=byName.get(k);
      if(!previous||(normText(r["SPX Status"])==="ACTIVE"&&normText(previous["SPX Status"])!=="ACTIVE"))byName.set(k,r);
    });
    var counts={total:assignedNames.size,two:0,three:0,flexi:0,unclassified:0};
    assignedNames.forEach(function(name,k){
      var rider=byName.get(k),vehicle=text(rider&&rider["Vehicle Type"]).toUpperCase().replace(/[^A-Z0-9]/g,"");
      if(vehicle==="2WH"||vehicle==="2W")counts.two++;
      else if(vehicle==="3WH"||vehicle==="3WC"||vehicle==="3W")counts.three++;
      else if(vehicle==="FLEXI"||vehicle==="FLEX")counts.flexi++;
      else counts.unclassified++;
    });
    var totalNode=el("dashboardRiderTotal"),twoNode=el("dashboardRider2WH"),threeNode=el("dashboardRider3WH"),flexiNode=el("dashboardRiderFlexi"),noteNode=el("dashboardRiderNote");
    if(totalNode)totalNode.textContent=counts.total.toLocaleString();
    // Keep Hub Performance in sync immediately when town rider assignments change.
    var hubTotalNode=el("opTotalRiders");
    if(hubTotalNode)hubTotalNode.textContent=counts.total.toLocaleString();
    if(twoNode)twoNode.textContent=counts.two.toLocaleString();
    if(threeNode)threeNode.textContent=counts.three.toLocaleString();
    if(flexiNode)flexiNode.textContent=counts.flexi.toLocaleString();
    var note=counts.unclassified
      ?counts.unclassified.toLocaleString()+" assigned rider(s) could not be classified from the uploaded Riders Data vehicle type."
      :"Each assigned rider is counted once, even when the same name is selected for more than one town group.";
    if(!counts.total)note="Select riders in the town-group selectors to populate this summary.";
    if(!riders.length&&counts.total)note="Upload Riders Data to classify assigned riders by vehicle type. Assigned riders are still included in the total.";
    if(noteNode)noteNode.textContent=note;
  }
  function selectedRows(source){
    var sourceRowsList=Array.isArray(source)?source:sourceRows().rows;
    var q=normText(el(ids.search)?.value||"");
    var town=normText(el(ids.town)?.value||"");
    var station=normText(el(ids.station)?.value||"");
    var status=normText(el(ids.status)?.value||"");
    return sourceRowsList.filter(function(x){
      if(town&&normText(x.town)!==town)return false;
      if(station&&normText(x.station)!==station)return false;
      if(status&&normText(statusLabel(x.status))!==status)return false;
      if(q){var hay=[x.tn,orderOf(x.row),x.town,x.station,x.statusLabel,statusLabel(x.status),x.row["Destination Station"]||""].join(" ").toUpperCase();if(hay.indexOf(q)<0)return false;}
      return true;
    });
  }
    function updateSelects(rows){
    [[ids.town,"All towns",function(x){return x.town;}],[ids.station,"All stations",function(x){return x.station;}],[ids.status,"All statuses",function(x){return statusLabel(x.status);}]].forEach(function(spec){
      var node=el(spec[0]);if(!node)return;var old=node.value;var vals=Array.from(new Set(rows.map(spec[2]).filter(Boolean))).sort(function(a,b){return a.localeCompare(b)});
      node.innerHTML='<option value="">'+spec[1]+'</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join("");
      if(vals.indexOf(old)>=0)node.value=old;
    });
  }
  function statCounts(rows){var map={};rows.forEach(function(x){var k=statusKey(x.status);map[k]=(map[k]||0)+1});return map;}
  function renderStats(rows){
    // The all-day status summary intentionally omits the standalone Received card.
    // Received remains part of the underlying data and other breakdowns.
    var counts=statCounts(rows),order=["LMHUBRECEIVED","SOCLHTRANSPORTING","SOCLHTRANSPORTED","SOCLHPACKED","SOCLHPACKING","SOCPACKED","SOCPACKING"];
    var labels=["LMHub Received","SOC LH Transporting","SOC LH Transported","SOC LH Packed","SOC LH Packing","SOC Packed","SOC Packing"];
    var merged={};order.forEach(function(k,i){merged[labels[i]]=(merged[labels[i]]||0)+(counts[k]||0)});
    var node=el(ids.stats);if(!node)return;
    node.innerHTML=Object.entries(merged).map(function(pair){return '<div class="forecast-board-status-card"><strong>'+Number(pair[1]||0).toLocaleString()+'</strong><span>'+esc(pair[0])+'</span></div>'}).join("");
  }
  function statusGroupRows(details){
    var rows=[],counts=details&&(details.allDayCounts||details.counts)||{};
    Object.keys(counts).forEach(function(station){
      Object.keys(counts[station]||{}).forEach(function(status){
        rows.push({station:station,status:status,count:Number(counts[station][status]||0)});
      });
    });
    rows.sort(function(a,b){return a.station.localeCompare(b.station)||a.status.localeCompare(b.status)});
    return rows;
  }
  function renderStatusControls(details){
    var node=el("forecastBoardStatusControls"),summary=el("forecastBoardStatusSelectionSummary");
    if(!node)return;
    var rows=statusGroupRows(details);
    var enabled=typeof window.__badocForecastGroupEnabled==="function"?window.__badocForecastGroupEnabled:function(){return true};
    var selected=0,all=0;
    rows.forEach(function(item){all+=item.count;if(enabled(item.station,item.status))selected+=item.count;});
    if(summary)summary.textContent=rows.length?selected.toLocaleString()+" of "+all.toLocaleString()+" eligible parcels included · "+rows.filter(function(x){return enabled(x.station,x.status)}).length+" of "+rows.length+" station/status groups enabled · all-day data":"No eligible station/status groups are available in the loaded data.";
    if(!rows.length){node.innerHTML='<div class="forecast-board-status-empty">No qualifying station/status groups are available in the loaded all-day data.</div>';return;}
    var html='<table><thead><tr><th>ADD</th><th>CURRENT STATION</th><th>STATUS</th><th style="text-align:right">COUNT</th></tr></thead><tbody>';
    rows.forEach(function(item,index){
      var checked=!!enabled(item.station,item.status);
      html+='<tr class="'+(checked?'':'is-disabled')+'"><td><input type="checkbox" data-forecast-group="'+index+'" '+(checked?'checked':'')+' aria-label="Include '+esc(item.station)+' '+esc(item.status)+'"></td><td>'+esc(item.station||"—")+'</td><td>'+esc(statusLabel(item.status))+'</td><td class="forecast-board-status-count">'+item.count.toLocaleString()+'</td></tr>';
    });
    html+='</tbody></table>';node.innerHTML=html;
    node.querySelectorAll('input[data-forecast-group]').forEach(function(cb){
      cb.addEventListener('change',function(){
        var item=rows[Number(cb.getAttribute('data-forecast-group'))];if(!item)return;
        if(window.__badocForecastFilterSelections&&typeof window.__badocForecastFilterKey==="function"){
          window.__badocForecastFilterSelections[window.__badocForecastFilterKey(item.station,item.status)]=cb.checked;
          window.__badocSaveForecastFilterSelections?.();
          window.updateOperationProgress?.();
          render();
        }
      });
    });
  }
  function setAllStatusGroups(enabled){
    var details=window.__badocForecastDetails,rows=statusGroupRows(details);
    if(!window.__badocForecastFilterSelections||typeof window.__badocForecastFilterKey!=="function")return;
    rows.forEach(function(item){window.__badocForecastFilterSelections[window.__badocForecastFilterKey(item.station,item.status)]=!!enabled;});
    window.__badocSaveForecastFilterSelections?.();
    window.updateOperationProgress?.();
    render();
  }
  function buildTownStats(rows,sets){
    var byArea={badoc:new Map(),pinili:new Map()};
    (rows||[]).forEach(function(x){
      var name=normText(x.town);if(!name)return;
      var z=text(x.row["Zone ID"]??x.row["ZoneId"]??x.row["zone id"]??"").trim();
      ["badoc","pinili"].forEach(function(area){
        if(!sets[area].has(name))return;
        var map=byArea[area],stat=map.get(name);
        if(!stat){stat={count:0,zones:new Set()};map.set(name,stat);}
        stat.count++;
        if(z)stat.zones.add(z);
      });
    });
    return byArea;
  }
  function renderTownGroups(targetId,areaKey,groups,townStats){
    var node=el(targetId);if(!node)return;
    var columns=[[],[]];(groups||[]).forEach(function(g,i){columns[i%2].push(g)});
    node.innerHTML="";
    if(!groups||!groups.length){node.innerHTML='<div class="forecast-board-empty">No towns configured.</div>';return;}
    columns.forEach(function(column){var col=document.createElement("div");col.className="forecast-town-column";
      column.forEach(function(group){
        var card=document.createElement("div");card.className="forecast-town-group";
        var total=(group||[]).reduce(function(sum,name){var stat=townStats.get(normText(name));return sum+(stat?stat.count:0)},0);
        var head=document.createElement("div");head.className="forecast-town-group-head";head.innerHTML='<span>TOWN GROUP</span><span class="forecast-town-group-total">'+total.toLocaleString()+'</span>';card.appendChild(head);
        group.forEach(function(name){
          var stat=townStats.get(normText(name)),count=stat?stat.count:0;
          var zones=stat?stat.zones:new Set();
          var zoneText=zones.size?"Zone "+Array.from(zones).sort().join(", "):"Zone not provided";
          var row=document.createElement("div");row.className="forecast-town-item";
          row.innerHTML='<span class="forecast-town-name" title="'+esc(name+' · '+zoneText)+'">'+esc(name)+'<small class="forecast-town-zone">'+esc(zoneText)+'</small></span><strong class="forecast-town-count">'+count.toLocaleString()+'</strong>';
          card.appendChild(row);
        });
        col.appendChild(card);
      });node.appendChild(col);
    });
  }
    function csvCell(v){var s=text(v);return '"'+s.replace(/"/g,'""')+'"';}
  function renderTable(rows){
    var node=el(ids.table),meta=el(ids.meta),pager=el(ids.pagination);if(!node)return;
    filteredRows=rows;var count=rows.length,totalPages=Math.max(1,Math.ceil(count/pageSize));page=Math.max(1,Math.min(page,totalPages));
    if(meta)meta.textContent='· '+count.toLocaleString()+' matching records';
    if(!count){node.innerHTML='<div class="forecast-board-empty">No matching all-day parcel records.</div>';if(pager)pager.innerHTML='';return;}
    var shown=rows.slice((page-1)*pageSize,page*pageSize);
    var cols=["SPX Tracking Number","Order ID","Town","Current Station","Status","Destination Station","Zone ID"];
    var html='<table class="table"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>';
    shown.forEach(function(x){var r=x.row;var vals=[x.tn,orderOf(r),x.town,x.station,statusLabel(x.status),r["Destination Station"]??r["Destination station"]??"",r["Zone ID"]??r["ZoneId"]??r["zone id"]??""];html+='<tr>'+vals.map(function(v){return '<td>'+esc(v||"—")+'</td>'}).join('')+'</tr>'});
    html+='</tbody></table>';node.innerHTML=html;
    if(pager){var first=(page-1)*pageSize+1,last=Math.min(page*pageSize,count);pager.innerHTML='<span>Showing '+first.toLocaleString()+'–'+last.toLocaleString()+' of '+count.toLocaleString()+'</span><span><button type="button" id="forecastBoardPrev" '+(page<=1?'disabled':'')+'>← Previous</button> <b>Page '+page+' / '+totalPages+'</b> <button type="button" id="forecastBoardNext" '+(page>=totalPages?'disabled':'')+'>Next →</button></span>';el('forecastBoardPrev')?.addEventListener('click',function(){page--;renderTable(filteredRows)});el('forecastBoardNext')?.addEventListener('click',function(){page++;renderTable(filteredRows)});}
  }
  function render(){
    var data=sourceRows(),details=data.details,rows=data.rows,sets=areaSets();
    renderRiderSummary();
    if(!details){el(ids.state).textContent="All-day parcel data is not ready yet. Sync or refresh the Dashboard first.";}
    else{el(ids.state).textContent=rows.length.toLocaleString()+" selected unique parcels · all-day view · same station/status selections";}
    renderStatusControls(details);
    updateSelects(rows);
    var shown=selectedRows(rows),townStats=buildTownStats(shown,sets);
    var badocCount=0,piniliCount=0,bulky=0,highValue=0,stations=new Set();
    shown.forEach(function(x){
      var townKey=normText(x.town);
      if(sets.badoc.has(townKey))badocCount++;
      if(sets.pinili.has(townKey))piniliCount++;
      var station=normText(x.station);if(station)stations.add(station);
      if(typeof parcelMetricFlags==="function"){
        var mf=parcelMetricFlags(x.row);if(mf.bulky)bulky++;if(mf.highValue)highValue++;
      }
    });
    if(el(ids.total))el(ids.total).textContent=shown.length.toLocaleString();
    if(el(ids.badoc))el(ids.badoc).textContent=badocCount.toLocaleString();
    if(el(ids.pinili))el(ids.pinili).textContent=piniliCount.toLocaleString();
    if(el("forecastBoardBulky"))el("forecastBoardBulky").textContent=bulky.toLocaleString();
    if(el("forecastBoardHighValue"))el("forecastBoardHighValue").textContent=highValue.toLocaleString();
    if(el(ids.stations))el(ids.stations).textContent=stations.size.toLocaleString();
    renderStats(shown);
    var bGroups=typeof getTownLayout==="function"?getTownLayout("badoc"):sets.badocList.map(function(n){return [n]});
    var pGroups=typeof getTownLayout==="function"?getTownLayout("pinili"):sets.piniliList.map(function(n){return [n]});
    renderTownGroups(ids.badocGrid,"badoc",bGroups,townStats.badoc);
    renderTownGroups(ids.piniliGrid,"pinili",pGroups,townStats.pinili);
    page=1;renderTable(shown);
  }
    function exportCsv(){var rows=selectedRows();if(!rows.length){alert("No all-day parcel records to export.");return;}var fields=["SPX Tracking Number","Order ID","Town","Current Station","Status","Destination Station","Zone ID"];var lines=[fields.map(csvCell).join(",")];rows.forEach(function(x){var r=x.row;lines.push([x.tn,orderOf(r),x.town,x.station,statusLabel(x.status),r["Destination Station"]??""].map(csvCell).join(","))});var blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="badoc-all-day-volume-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);}
  function copyTns(){var rows=selectedRows(),value=rows.map(function(x){return x.tn}).filter(Boolean).join("\n");if(!value){alert("No tracking numbers to copy.");return;}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){alert(rows.length.toLocaleString()+" tracking numbers copied.")}).catch(function(){fallbackCopy(value,rows.length)})}else fallbackCopy(value,rows.length);}
  function fallbackCopy(value,count){var t=document.createElement("textarea");t.value=value;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();var ok=false;try{ok=document.execCommand("copy")}catch(e){}t.remove();alert(ok?count.toLocaleString()+" tracking numbers copied.":"Copy failed. Please select the tracking numbers from the table.");}
  function bind(){
    [ids.search,ids.town,ids.station,ids.status].forEach(function(id){var n=el(id);if(n&&!n.dataset.forecastBound){n.dataset.forecastBound="1";n.addEventListener(id===ids.search?"input":"change",function(){page=1;render();});}});
    var clear=el("forecastBoardClearFilters");if(clear&&!clear.dataset.bound){clear.dataset.bound="1";clear.addEventListener("click",function(){[ids.search,ids.town,ids.station,ids.status].forEach(function(id){if(el(id))el(id).value=""});page=1;render();});}
    var allStatus=el("forecastBoardStatusAll");if(allStatus&&!allStatus.dataset.bound){allStatus.dataset.bound="1";allStatus.addEventListener("click",function(){setAllStatusGroups(true);});}
    var noStatus=el("forecastBoardStatusNone");if(noStatus&&!noStatus.dataset.bound){noStatus.dataset.bound="1";noStatus.addEventListener("click",function(){setAllStatusGroups(false);});}
    var exp=el("forecastBoardExport");if(exp&&!exp.dataset.bound){exp.dataset.bound="1";exp.addEventListener("click",exportCsv);}
    var copy=el("forecastBoardCopy");if(copy&&!copy.dataset.bound){copy.dataset.bound="1";copy.addEventListener("click",copyTns);}
    var nav=document.getElementById("planningBoardNav"),toggle=document.getElementById("planningBoardToggle");
    if(nav&&toggle&&!toggle.dataset.bound){toggle.dataset.bound="1";toggle.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var open=!nav.classList.contains("open");nav.classList.toggle("open",open);toggle.setAttribute("aria-expanded",String(open));});}
    document.querySelectorAll('#planningBoardSubmenu button[data-page]').forEach(function(btn){if(btn.dataset.bound)return;btn.dataset.bound="1";btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(typeof window.showPage==="function")window.showPage(btn.dataset.page);if(nav){nav.classList.add("open");toggle?.setAttribute("aria-expanded","true");}});});
    var primary=document.querySelector('#planningBoardNav .planning-board-primary');if(primary&&!primary.dataset.bound){primary.dataset.bound="1";primary.addEventListener("click",function(){nav?.classList.add("open");toggle?.setAttribute("aria-expanded","true");});}
  }
  window.__badocRenderDashboardRiderSummary=renderRiderSummary;
  window.__badocRenderForecastBoard=render;
  function init(){
    bind();
    if(el("volumeForecastBoard")?.classList.contains("active"))render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  // Forecast is recalculated by the existing dashboard logic after imports and syncs.
  // Refresh this view only while it is visible; no second dataset or background poll is created.
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&el("volumeForecastBoard")?.classList.contains("active")){window.updateOperationProgress?.();render();}});
})();
