(function(){
  const ids=["recordTown","recordStation","recordStatus"];
  const labels={recordTown:"Town",recordStation:"Current Station",recordStatus:"Status"};
  const instances=new Map();

  function escHtml(v){
    return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
  }
  function getValues(el){
    return [...el.selectedOptions].map(o=>String(o.value||"").trim()).filter(Boolean);
  }
  function getOptions(el){
    return [...el.options].filter(o=>String(o.value||"").trim()).map(o=>({
      value:String(o.value), text:String(o.textContent||o.value), selected:!!o.selected
    }));
  }
  function make(id){
    const el=document.getElementById(id);
    if(!el || instances.has(id))return;
    el.classList.add("parcel-native-filter-hidden");
    const host=document.createElement("div");
    host.className="parcel-custom-multiselect";
    host.dataset.for=id;
    const trigger=document.createElement("button");
    trigger.type="button";
    trigger.className="parcel-custom-trigger";
    trigger.setAttribute("aria-haspopup","listbox");
    trigger.setAttribute("aria-expanded","false");
    trigger.setAttribute("aria-label",labels[id]+" filter");
    const panel=document.createElement("div");
    panel.className="parcel-custom-panel";
    panel.setAttribute("role","listbox");
    panel.setAttribute("aria-multiselectable","true");
    host.append(trigger,panel);
    el.parentNode.insertBefore(host,el.nextSibling);

    const state={el,host,trigger,panel,observer:null,open:false};
    instances.set(id,state);

    function close(){
      state.open=false;host.classList.remove("open");trigger.setAttribute("aria-expanded","false");
    }
    function open(){
      // Close the other custom filter instead of allowing overlapping menus.
      instances.forEach((x,k)=>{if(k!==id){x.host.classList.remove("open");x.open=false;x.trigger.setAttribute("aria-expanded","false")}});
      state.open=true;host.classList.add("open");trigger.setAttribute("aria-expanded","true");
    }
    trigger.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();state.open?close():open()});
    panel.addEventListener("click",e=>e.stopPropagation());
    el.addEventListener("change",()=>{render(id);});

    state.render=()=>render(id);
    state.observer=new MutationObserver(()=>render(id));
    state.observer.observe(el,{childList:true,subtree:true});
    render(id);
  }

  function render(id){
    const state=instances.get(id); if(!state)return;
    const {el,trigger,panel}=state;
    const options=getOptions(el), selected=getValues(el), selectedSet=new Set(selected);
    const title=labels[id];
    trigger.textContent=selected.length ? (selected.length===1 ? selected[0] : `${title} (${selected.length} selected)`) : `All ${title}`;
    trigger.title=selected.length ? selected.join(", ") : `All ${title}`;
    panel.innerHTML="";
    if(!options.length){
      panel.innerHTML='<div class="parcel-custom-empty">No options available</div>';
      return;
    }
    options.forEach(o=>{
      const row=document.createElement("label");
      row.className="parcel-custom-option"+(selectedSet.has(o.value)?" is-selected":"");
      row.setAttribute("role","option");
      row.setAttribute("aria-selected",selectedSet.has(o.value)?"true":"false");
      const cb=document.createElement("input");
      cb.type="checkbox";cb.checked=selectedSet.has(o.value);cb.tabIndex=-1;
      const text=document.createElement("span");
      text.textContent=o.text;
      row.append(cb,text);
      row.addEventListener("click",e=>{
        e.preventDefault();
        const now=new Set(getValues(el));
        if(now.has(o.value))now.delete(o.value);else now.add(o.value);
        [...el.options].forEach(opt=>{opt.selected=now.has(String(opt.value))});
        // Keep the menu open so multiple values can be selected without a native dialog reset.
        cb.checked=now.has(o.value);
        render(id);
        el.dispatchEvent(new Event("change",{bubbles:true}));
      });
      panel.appendChild(row);
    });
  }

  window.syncCustomParcelFilters=function(){instances.forEach((_,id)=>render(id));};

  function init(){
    ids.forEach(make);
    document.addEventListener("click",()=>instances.forEach(x=>{
      x.host.classList.remove("open");x.open=false;x.trigger.setAttribute("aria-expanded","false");
    }));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
