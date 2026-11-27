(function(){
  let active=false, completed=false, confirmResolver=null;
  const get=id=>document.getElementById(id);
  const root=get("badocOperationModal");
  if(!root)return;
  const closeBtn=get("badocOpClose"),cancelBtn=get("badocOpCancel"),copyBtn=get("badocOpCopy");
  const copyFeedback=get("badocOpCopyFeedback");
  let copyAction=null,copyGeneration=0;
  function clearCopyAction(){
    copyGeneration++;
    copyAction=null;
    if(copyBtn){copyBtn.hidden=true;copyBtn.disabled=false;copyBtn.textContent="Copy Results";}
    if(copyFeedback){copyFeedback.hidden=true;copyFeedback.textContent="";}
  }
  function setVisible(show){root.hidden=!show;root.setAttribute("aria-hidden",String(!show));document.body.classList.toggle("badoc-op-open",show);}
  function clearDetails(){const node=get("badocOpDetails");if(node)node.replaceChildren();}
  function addDetails(items){
    const node=get("badocOpDetails");if(!node)return;node.replaceChildren();
    for(const item of (Array.isArray(items)?items:[])){
      if(!Array.isArray(item)||item.length<2)continue;
      const card=document.createElement("div");card.className="badoc-op-detail";
      const label=document.createElement("span");label.textContent=String(item[0]??"");
      const value=document.createElement("strong");value.textContent=String(item[1]??"");
      card.append(label,value);node.appendChild(card);
    }
  }
  function resolveConfirm(accepted){
    if(!confirmResolver)return false;
    const resolve=confirmResolver;confirmResolver=null;
    active=false;completed=true;cancelBtn.hidden=true;
    setVisible(false);resolve(!!accepted);return true;
  }
  window.__badocOperationModalStart=function(title,message){
    active=true;completed=false;clearCopyAction();root.classList.remove("is-success","is-error","is-info","is-confirm","is-batch-search");
    get("badocOpTitle").textContent=title||"Working…";get("badocOpMessage").textContent=message||"Working…";
    get("badocOpState").textContent="In progress";get("badocOpState").className="badoc-op-state busy";
    get("badocOpIcon").textContent="↻";closeBtn.textContent="Working…";closeBtn.disabled=true;cancelBtn.hidden=true;
    clearDetails();setVisible(true);
  };
  window.__badocOperationModalUpdate=function(message){
    if(!active||completed)return;
    if(message)get("badocOpMessage").textContent=String(message);
  };
  window.__badocOperationModalSetCopy=function(label,callback){
    if(!copyBtn)return;
    copyAction=typeof callback==="function"?callback:null;
    copyBtn.textContent=String(label||"Copy Results");
    copyBtn.disabled=false;
    copyBtn.hidden=!copyAction;
    if(copyFeedback){copyFeedback.hidden=true;copyFeedback.textContent="";}
  };
  window.__badocOperationModalConfirm=function(title,message,details=[],acceptLabel="Confirm"){
    clearCopyAction();
    if(confirmResolver)resolveConfirm(false);
    return new Promise(resolve=>{
      active=false;completed=false;confirmResolver=resolve;
      root.classList.remove("is-success","is-error","is-info","is-confirm","is-batch-search");root.classList.add("is-confirm");
      get("badocOpTitle").textContent=title||"Confirm action";
      get("badocOpMessage").textContent=message||"Continue?";
      get("badocOpState").textContent="Confirm";get("badocOpState").className="badoc-op-state done";
      get("badocOpIcon").textContent="?";closeBtn.textContent=acceptLabel||"Confirm";closeBtn.disabled=false;cancelBtn.hidden=false;cancelBtn.textContent="Cancel";
      addDetails(details);setVisible(true);
    });
  };
  window.__badocOperationModalFinish=function(title,message,details=[],state="success"){
    active=false;completed=true;
    if(state!=="success"&&state!=="info")clearCopyAction();
    root.classList.remove("is-success","is-error","is-info","is-confirm","is-batch-search");
    if(/batch search result/i.test(String(title||"")))root.classList.add("is-batch-search");
    if(!["success","error","info"].includes(state))state="success";
    root.classList.add("is-"+state);
    get("badocOpTitle").textContent=title||"Operation finished";get("badocOpMessage").textContent=message||"";
    get("badocOpState").textContent=state==="success"?"Completed":state==="error"?"Failed":"Notice";
    get("badocOpState").className="badoc-op-state "+(state==="error"?"failed":"done");
    get("badocOpIcon").textContent=state==="success"?"✓":state==="error"?"!":"i";
    closeBtn.textContent="Close";closeBtn.disabled=false;cancelBtn.hidden=true;
    addDetails(details);setVisible(true);
  };
  function close(){if(!completed)return;setVisible(false);}
  closeBtn.addEventListener("click",()=>{if(confirmResolver){resolveConfirm(true);return;}close();});
  copyBtn?.addEventListener("click",async()=>{
    if(typeof copyAction!=="function")return;
    const action=copyAction;
    const generation=copyGeneration;
    copyBtn.disabled=true;
    copyBtn.textContent="Copying…";
    try{
      const copied=await action();
      // A new loading operation may have started while clipboard permission
      // was pending. Do not let an old copy completion overwrite its dialog.
      if(generation!==copyGeneration)return;
      if(copied===false){
        copyBtn.textContent="Retry Copy";
        copyBtn.disabled=false;
        if(copyFeedback){copyFeedback.textContent="Copy failed. Check clipboard permissions and try again.";copyFeedback.hidden=false;copyFeedback.dataset.state="error";}
      }else{
        copyBtn.textContent="Copied";
        copyBtn.disabled=true;
        if(copyFeedback){copyFeedback.textContent="✓ Results copied to your clipboard.";copyFeedback.hidden=false;copyFeedback.dataset.state="success";}
      }
    }catch(error){
      if(generation!==copyGeneration)return;
      console.error("Badoc report copy failed:",error);
      copyBtn.textContent="Retry Copy";
      copyBtn.disabled=false;
      if(copyFeedback){copyFeedback.textContent="Copy failed: "+String(error?.message||error);copyFeedback.hidden=false;copyFeedback.dataset.state="error";}
    }
  });
  cancelBtn.addEventListener("click",()=>resolveConfirm(false));
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape"||root.hidden)return;
    if(confirmResolver){resolveConfirm(false);return;}
    close();
  });
})();
