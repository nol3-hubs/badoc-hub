(function(){
  if(window.__dashboardEodSummarySync)return;
  window.__dashboardEodSummarySync=true;
  const $id=id=>document.getElementById(id);
  const normKey=v=>String(v??"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const get=(...keys)=>{
    const d=window.__badocEodDashboard||{};
    for(const k of keys){
      const v=d[normKey(k)];
      if(v!==undefined&&String(v).trim()!=="")return v;
    }
    return "—";
  };
  function sync(){
    const d=window.__badocEodDashboard||{};
    const set=(id,v)=>{const e=$id(id);if(e)e.textContent=(v===undefined||v===null||String(v).trim()==="")?"—":v};
    set("dashEodHub",d.hub||"Hub");
    set("dashEodDate",d.date||"—");
    set("dashEodDispatched",get("total dispatched"));
    set("dashEodDelivered",get("total delivered"));
    set("dashEodOnhold",get("total onhold","total on hold"));
    set("dashEodRedelivery",get("total redelivery"));
    set("dashEodRts",get("total rts"));
    set("dashEodRate",d.deliveryPerformance||"—");
    set("dashEodFleet3w",get("fleet 3w","3w"));
    set("dashEodFleet2w",get("fleet 2w","2w"));
    set("dashEodFleetFlexi",get("fleet flexi","flexi"));
    set("dashEodTotalRiders",d.totalRidersUsed||"—");
  }
  sync();
  __badocEvery(sync,5000);
})();
