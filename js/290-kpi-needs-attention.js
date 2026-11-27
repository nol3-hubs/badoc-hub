(function(){
  if(window.__badocKpiNeedsAttentionSync)return;
  window.__badocKpiNeedsAttentionSync=true;

  function syncNeedsAttention(){
    var container=document.getElementById("kpiCategories");
    var source=container&&container.querySelector(":scope > .kpi-month-section");
    var error=container&&container.querySelector(".kpi-data-error");
    var list=document.getElementById("dashboardKpiAttentionList");
    var count=document.getElementById("dashboardKpiAttentionCount");
    if(!list||!count)return;

    // Reuse the KPI menu's exact red status. Read current month only.
    var cards=source
      ? Array.from(source.querySelectorAll(".v3-kpi-card.kpi-status-below-b"))
      : [];
    count.textContent=String(cards.length);
    list.replaceChildren();

    if(!cards.length){
      var empty=document.createElement("div");
      empty.className="dashboard-kpi-attention-empty";
      empty.textContent=source
        ?"No red KPI items."
        :error
          ?"KPI data unavailable. Open KPI to retry."
          :"Loading KPI data…";
      list.appendChild(empty);
      return;
    }

    cards.forEach(function(card){
      var name=card.querySelector("h3");
      var actual=card.querySelector(".kpi-actual");
      var category=card.closest(".kpi-category");
      var categoryTitle=category&&category.querySelector(".kpi-category-title");
      var item=document.createElement("div");
      item.className="dashboard-kpi-attention-item";

      var details=document.createElement("div");
      details.className="dashboard-kpi-attention-details";
      if(categoryTitle){
        var group=document.createElement("span");
        group.className="dashboard-kpi-attention-group";
        group.textContent=categoryTitle.textContent.trim();
        details.appendChild(group);
      }
      var title=document.createElement("span");
      title.className="dashboard-kpi-attention-name";
      title.textContent=name?name.textContent.trim():"KPI";
      details.appendChild(title);

      var value=document.createElement("strong");
      value.className="dashboard-kpi-attention-value";
      value.textContent=actual&&actual.textContent.trim()?actual.textContent.trim():"—";
      item.append(details,value);
      list.appendChild(item);
    });
  }

  function observe(){
    var source=document.getElementById("kpiCategories");
    if(!source)return;
    new MutationObserver(syncNeedsAttention).observe(source,{
      childList:true,subtree:true,characterData:true,attributes:true,
      attributeFilter:["class"]
    });
    syncNeedsAttention();
  }
  window.__badocSyncKpiNeedsAttention=syncNeedsAttention;
  window.addEventListener("badoc-kpi-data-ready",syncNeedsAttention);
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",observe,{once:true});
  }else{
    observe();
  }
})();
