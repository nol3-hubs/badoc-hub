(function(){
  "use strict";
  const byId=id=>document.getElementById(id);
  const titles={
    todayVolume:"Today's Volume — Parcel OIDs",
    dispatched:"Dispatched — Parcel OIDs",
    forecast:"Volume Forecast — Parcel OIDs",
    received:"Received — Parcel OIDs",
    delivering:"Delivering — Parcel OIDs",
    delivered:"Delivered — Parcel OIDs",
    onhold:"On-Hold — Parcel OIDs",
    backlogs:"Backlogs — Parcel OIDs",
    redelivery:"Redelivery — Parcel OIDs",
    rts:"RTS — Parcel OIDs",
    exemptions:"Exemptions — Parcel OIDs"
  };
  let lastTrigger=null;
  const overlay=byId("dashboardParcelDetailOverlay");
  const closeButton=byId("dashboardParcelDetailClose");

  const DETAIL_PAGE_SIZE=100;
  let activeDetailRows=[];
  let activeDetailKey="";
  let activeDetailPage=1;
  let activeDetailCount=null;
  let activeDetailRiderFilter="";

  function renderRowsPage(){
    const body=byId("dashboardParcelDetailBody");
    if(!body)return;
    const allRows=activeDetailRows;
    body.replaceChildren();

    if(activeDetailKey==="delivering"&&allRows.length){
      const riderCounts=new Map();
      allRows.forEach(item=>{
        const name=String(item?.rider??"").trim();
        const key=name?"rider:"+name.toLocaleLowerCase():"unassigned";
        const entry=riderCounts.get(key)||{name:name||"Unassigned",count:0};
        entry.count++;
        riderCounts.set(key,entry);
      });

      const filterWrap=document.createElement("div");
      filterWrap.className="dashboard-parcel-detail-rider-filter";
      filterWrap.style.cssText="display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:0 0 12px;color:var(--c-9fb0bf-text);font-size:12px";

      const filterLabel=document.createElement("label");
      filterLabel.textContent="Filter by rider";
      filterLabel.htmlFor="dashboardParcelDetailRiderFilter";
      filterLabel.style.cssText="font-weight:600;white-space:nowrap";

      const riderSelect=document.createElement("select");
      riderSelect.id="dashboardParcelDetailRiderFilter";
      riderSelect.setAttribute("aria-label","Filter Delivering parcels by rider");
      riderSelect.style.cssText="min-width:260px;max-width:100%;border:1px solid var(--c-344454-border);background:var(--c-10161e-bg);color:var(--c-f4f9fc-text);border-radius:8px;padding:8px 10px;font:inherit";

      const allOption=document.createElement("option");
      allOption.value="";
      allOption.textContent="All riders ("+allRows.length.toLocaleString()+")";
      riderSelect.appendChild(allOption);

      [...riderCounts.entries()]
        .sort((a,b)=>b[1].count-a[1].count||a[1].name.localeCompare(b[1].name))
        .forEach(([key,entry])=>{
          const option=document.createElement("option");
          option.value=key;
          option.textContent=entry.name+" ("+entry.count.toLocaleString()+")";
          riderSelect.appendChild(option);
        });

      riderSelect.value=activeDetailRiderFilter;
      riderSelect.addEventListener("change",()=>{
        activeDetailRiderFilter=riderSelect.value;
        activeDetailPage=1;
        renderRowsPage();
      });

      filterWrap.appendChild(filterLabel);
      filterWrap.appendChild(riderSelect);
      body.appendChild(filterWrap);
    }

    const rows=activeDetailKey==="delivering"&&activeDetailRiderFilter
      ?allRows.filter(item=>{
        const name=String(item?.rider??"").trim();
        const key=name?"rider:"+name.toLocaleLowerCase():"unassigned";
        return key===activeDetailRiderFilter;
      })
      :allRows;

    if(!rows.length){
      const empty=document.createElement("div");
      empty.className="dashboard-parcel-detail-empty";
      empty.textContent=Number(activeDetailCount)>0
        ?"No parcel-level OID records are available from the current source for this card."
        :"No matching parcel records.";
      body.appendChild(empty);
      return;
    }

    const totalPages=Math.max(1,Math.ceil(rows.length/DETAIL_PAGE_SIZE));
    activeDetailPage=Math.max(1,Math.min(activeDetailPage,totalPages));
    const start=(activeDetailPage-1)*DETAIL_PAGE_SIZE;
    const end=Math.min(start+DETAIL_PAGE_SIZE,rows.length);

    const wrap=document.createElement("div");
    wrap.style.overflowX="auto";
    const table=document.createElement("table");
    table.className="dashboard-parcel-detail-table";
    const thead=document.createElement("thead");
    const headerRow=document.createElement("tr");
    const showRider=["delivering","onhold"].includes(activeDetailKey);
    const showReceivedTime=activeDetailKey==="backlogs";
    const headers=["OID / ORDER ID","STATUS","TOWN",showReceivedTime?"RECEIVED TIME":"SCANNED TIME"];
    if(showRider)headers.push("RIDER");
    headers.forEach(label=>{
      const th=document.createElement("th");
      th.textContent=label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody=document.createElement("tbody");
    rows.slice(start,end).forEach(item=>{
      const tr=document.createElement("tr");
      const values=[item.orderId,item.status,item.town,showReceivedTime?item.receivedTime:item.scannedTime];
      if(showRider)values.push(item.rider);
      values.forEach(value=>{
        const td=document.createElement("td");
        td.textContent=String(value??"").trim()||"—";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);

    const pager=document.createElement("div");
    pager.className="dashboard-parcel-detail-pagination";
    pager.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 2px 2px;color:var(--c-9fb0bf-text);font-size:12px";

    const pageInfo=document.createElement("span");
    pageInfo.textContent="Showing "+(start+1).toLocaleString()+"–"+end.toLocaleString()+" of "+rows.length.toLocaleString()+" records · Page "+activeDetailPage.toLocaleString()+" of "+totalPages.toLocaleString();
    pager.appendChild(pageInfo);

    const controls=document.createElement("div");
    controls.style.cssText="display:flex;gap:6px;align-items:center";
    const makePageButton=(label,page,disabled)=>{
      const button=document.createElement("button");
      button.type="button";
      button.textContent=label;
      button.dataset.dashboardDetailPage=String(page);
      button.disabled=disabled;
      button.style.cssText="border:1px solid var(--c-344454-border);background:var(--c-10161e-bg);color:var(--c-f4f9fc-text);border-radius:7px;padding:6px 10px;cursor:pointer";
      if(disabled)button.style.opacity=".45";
      return button;
    };
    controls.appendChild(makePageButton("← Previous",activeDetailPage-1,activeDetailPage<=1));
    controls.appendChild(makePageButton("Next →",activeDetailPage+1,activeDetailPage>=totalPages));
    pager.appendChild(controls);
    body.appendChild(pager);
  }

  function render(key){
    try{window.__badocBuildDashboardParcelDetails?.()}catch(error){console.warn("Dashboard parcel details could not be built:",error)}
    const data=window.__badocDashboardParcelDetails?.[key]||{rows:[],count:null,note:"Dashboard detail data is not ready yet."};
    activeDetailRows=Array.isArray(data.rows)?data.rows:[];
    activeDetailKey=key;
    activeDetailPage=1;
    activeDetailRiderFilter="";

    const title=byId("dashboardParcelDetailTitle");
    const summary=byId("dashboardParcelDetailSummary");
    const note=byId("dashboardParcelDetailNote");
    const total=data.count!==null&&data.count!==undefined&&Number.isFinite(Number(data.count))?Number(data.count):null;
    activeDetailCount=total;
    if(title)title.textContent=titles[key]||"Parcel Details";
    if(summary){
      summary.textContent=activeDetailRows.length.toLocaleString()+" OID records available"+
        (total===null?"":" · Card total "+total.toLocaleString());
    }
    if(note){
      note.textContent=String(data.note||"");
      note.hidden=!data.note;
    }
    renderRowsPage();
  }

  const detailBody=byId("dashboardParcelDetailBody");
  detailBody?.addEventListener("click",event=>{
    const button=event.target?.closest?.("[data-dashboard-detail-page]");
    if(!button||!detailBody.contains(button)||button.disabled)return;
    const nextPage=Number(button.dataset.dashboardDetailPage);
    if(!Number.isFinite(nextPage))return;
    activeDetailPage=nextPage;
    renderRowsPage();
  });

  function open(key,trigger){
    if(!overlay)return;
    lastTrigger=trigger||document.activeElement;
    render(key);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
    closeButton?.focus();
  }
  function close(){
    if(!overlay)return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden","true");
    if(lastTrigger&&typeof lastTrigger.focus==="function")lastTrigger.focus();
    lastTrigger=null;
  }
  window.__badocOpenDashboardParcelDetails=open;

  document.addEventListener("click",event=>{
    const card=event.target?.closest?.("[data-dashboard-detail]");
    if(!card)return;
    open(card.dataset.dashboardDetail,card);
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&overlay?.classList.contains("open")){
      close();
      return;
    }
    const card=event.target?.closest?.("[data-dashboard-detail]");
    if(card&&(event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      open(card.dataset.dashboardDetail,card);
    }
  });
  closeButton?.addEventListener("click",close);
  overlay?.addEventListener("click",event=>{
    if(event.target===overlay)close();
  });
})();
