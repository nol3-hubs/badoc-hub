(function(){
  let active="scanned";
  const byId=id=>document.getElementById(id);

  function renderList(){
    const data=window.__badocCfr1Details||{scanned:[],unscanned:[]};
    const scanned=Array.isArray(data.scanned)?data.scanned:[];
    const unscanned=Array.isArray(data.unscanned)?data.unscanned:[];
    const st=byId("cfr1TabScanned"), ut=byId("cfr1TabUnscanned"), body=byId("cfr1DetailBody");
    if(!st||!ut||!body)return;
    st.textContent="SCANNED ("+scanned.length+")";
    ut.textContent="UNSCANNED ("+unscanned.length+")";
    st.classList.toggle("active",active==="scanned");
    ut.classList.toggle("active",active==="unscanned");
    const rows=active==="scanned"?scanned:unscanned;
    body.textContent="";
    if(!rows.length){
      const empty=document.createElement("div");
      empty.className="cfr1-detail-empty";
      empty.textContent="No "+active+" CFR1 parcels.";
      body.appendChild(empty);
      return;
    }
    const table=document.createElement("table");
    table.className="cfr1-detail-table";
    const thead=document.createElement("thead");
    const hr=document.createElement("tr");
    const headers=active==="scanned"?["ORDER ID","TOWN","STATUS","RECEIVED TIME","SCANNED TIME"]:["ORDER ID","TOWN","STATUS","RECEIVED TIME"];
    headers.forEach(label=>{
      const th=document.createElement("th"); th.textContent=label; hr.appendChild(th);
    });
    thead.appendChild(hr); table.appendChild(thead);
    const tbody=document.createElement("tbody");
    rows.forEach(item=>{
      const tr=document.createElement("tr");
      const td1=document.createElement("td"); td1.textContent=item.orderId||"—";
      const td2=document.createElement("td"); td2.textContent=item.town||"—";
      const td3=document.createElement("td");
      const statusText=String(item.status||"—");
      if(/^INTERCEPT(?:\s|·|$)/i.test(statusText)){
        const marker=document.createElement("span");
        marker.textContent="INTERCEPT";
        marker.style.cssText="color:#dc2626;font-weight:800;background:rgba(220,38,38,.10);padding:2px 5px;border-radius:4px";
        td3.appendChild(marker);
        const remainder=statusText.replace(/^INTERCEPT\s*/i,"").replace(/^·\s*/,"");
        if(remainder)td3.appendChild(document.createTextNode(" · "+remainder));
      }else{
        td3.textContent=statusText;
      }
      tr.append(td1,td2,td3);
      const td4=document.createElement("td"); td4.textContent=item.receivedTime||"—"; tr.appendChild(td4);
      if(active==="scanned"){
        const td5=document.createElement("td"); td5.textContent=item.scannedTime||"—"; tr.appendChild(td5);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); body.appendChild(table);
  }

  // Paste the Google Apps Script Web App URL here once deployed (ends in /exec).
  // See cfr1-export-apps-script.gs for the code to paste into the target Sheet.
  const CFR1_EXPORT_URL="https://script.google.com/a/macros/spxexpress.com/s/AKfycbyAatZngTjIXBBH9EP6XVEhMDtth0e4HgfmcsRQLj5B5oj3hOrouxy8f9XWfgyts5J4Eg/exec";

  function waitForCfr1ExportConfirmation(frame, requestId, timeoutMs=45000){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,value)=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        window.removeEventListener("message",onMessage);
        fn(value);
      };
      const onMessage=event=>{
        // Apps Script HtmlService runs its response inside a Google sandbox
        // frame. Its postMessage event.source can therefore be a nested frame,
        // not the outer iframe we created in this page. Do not reject a valid
        // response solely because event.source !== frame.contentWindow.
        // The private per-request nonce and message marker identify this reply.
        const message=event.data||{};
        if(message.source!=="BADOC_CFR1_APPS_SCRIPT"||String(message.requestId||"")!==requestId)return;
        const result=message.result||{};
        if(message.ok===true&&result.ok===true)finish(resolve,result);
        else finish(reject,new Error(result.error||"Google Apps Script rejected the CFR1 export."));
      };
      const timer=setTimeout(()=>{
        finish(reject,new Error("No confirmation was received from Google Apps Script within "+Math.round(timeoutMs/1000)+" seconds. The request may still have reached the sheet. Check Apps Script → Executions before retrying."));
      },timeoutMs);
      window.addEventListener("message",onMessage);
    });
  }

  async function exportToSheet(options={}){
    const fromCapture=options&&options.fromCapture===true;
    const btn=byId("cfr1DetailExport");
    if(!fromCapture&&!btn)return {submitted:false,confirmed:false,count:0};
    if(!CFR1_EXPORT_URL){
      const error=new Error("CFR1 export is not connected to a Google Sheet.");
      if(!fromCapture)alert(error.message);
      throw error;
    }
    const data=window.__badocCfr1Details;
    if(!data||(!Array.isArray(data.scanned)&&!Array.isArray(data.unscanned))){
      throw new Error("CFR1 parcel details are not available yet. Refresh the dashboard and try again.");
    }
    const rows=[
      ...(Array.isArray(data.scanned)?data.scanned:[]).map(r=>({
        group:"SCANNED",
        orderId:r.orderId||"",
        town:r.town||"",
        status:r.status||"",
        receivedTime:r.receivedTime||"",
        scannedTime:r.scannedTime||""
      })),
      ...(Array.isArray(data.unscanned)?data.unscanned:[]).map(r=>({
        group:"UNSCANNED",
        orderId:r.orderId||"",
        town:r.town||"",
        status:r.status||"",
        receivedTime:r.receivedTime||"",
        scannedTime:r.scannedTime||""
      }))
    ];
    if(!rows.length){
      return {submitted:false,confirmed:true,skipped:true,count:0,reason:"No CFR1 parcels were available to export."};
    }
    const originalText=btn?btn.textContent:"";
    if(btn){btn.disabled=true;btn.textContent="Exporting…";}
    try{
      // A response page from Apps Script posts a request-specific confirmation
      // back to this dashboard. Submission alone is never treated as success.
      let frame=document.getElementById("cfr1ExportFrame");
      if(!frame){
        frame=document.createElement("iframe");
        frame.id="cfr1ExportFrame";
        frame.name="cfr1ExportFrame";
        frame.style.display="none";
        document.body.appendChild(frame);      }
      const requestId="badoc-cfr1-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);
      const confirmation=waitForCfr1ExportConfirmation(frame,requestId);
      const form=document.createElement("form");
      form.method="POST";
      form.action=CFR1_EXPORT_URL;
      form.target=frame.name;
      form.style.display="none";
      const input=document.createElement("input");
      input.type="hidden";
      input.name="payload";
      input.value=JSON.stringify({rows,requestId});
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      const result=await confirmation;
      return {
        submitted:true,
        confirmed:true,
        count:Number(result.count)||0,
        received:Number(result.received)||rows.length,
        skippedAlreadyUploadedToday:Number(result.skippedAlreadyUploadedToday)||0,
        skippedDuplicateInRequest:Number(result.skippedDuplicateInRequest)||0,
        skippedMissingOrderId:Number(result.skippedMissingOrderId)||0,
        date:String(result.date||""),
        snapshot:String(result.snapshot||"not-provided"),
        requestId:requestId
      };
    }catch(e){
      console.warn("CFR1 export failed or was not confirmed:",e);
      if(btn)btn.textContent="✕ Export Not Confirmed";
      if(!fromCapture)alert("CFR1 export was not confirmed:\n\n"+(e&&e.message?e.message:String(e)));
      throw e;
    }finally{
      if(btn)setTimeout(()=>{btn.disabled=false;btn.textContent=originalText;},5000);
    }
  }

  // The Daily History Capture Now action reuses this exact CFR1 export path.
  window.__badocExportCfr1ToSheet=()=>exportToSheet({fromCapture:true});
  function openDetails(){
    const overlay=byId("cfr1DetailOverlay");
    if(!overlay)return;
    active="scanned";
    renderList();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
  }
  function closeDetails(){
    const overlay=byId("cfr1DetailOverlay");
    if(!overlay)return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden","true");
  }

  document.addEventListener("click",e=>{
    if(e.target.closest("#cfr1Card")) openDetails();
    if(e.target.closest("#cfr1DetailClose")) closeDetails();
    if(e.target.closest("#cfr1DetailExport")) exportToSheet();
    if(e.target===byId("cfr1DetailOverlay")) closeDetails();
    if(e.target.closest("#cfr1TabScanned")){active="scanned";renderList()}
    if(e.target.closest("#cfr1TabUnscanned")){active="unscanned";renderList()}
  });
  document.addEventListener("keydown",e=>{
    const card=e.target.closest&&e.target.closest("#cfr1Card");
    if(card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openDetails()}
    if(e.key==="Escape")closeDetails();
  });
})();
