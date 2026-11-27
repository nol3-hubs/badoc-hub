(function(){
  if(window.__badocKpiMenuFinalFix)return;
  window.__badocKpiMenuFinalFix=true;

  function openKpi(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    var page=document.getElementById("kpi");
    if(!page)return;

    if(typeof window.showPage==="function"){
      try{ window.showPage("kpi"); }catch(err){}
    }

    document.querySelectorAll(".page").forEach(function(p){p.classList.remove("active")});
    page.classList.add("active");

    document.querySelectorAll(".nav button").forEach(function(b){
      b.classList.toggle("active",b.getAttribute("data-page")==="kpi");
    });

    var title=document.getElementById("pageTitle");
    if(title)title.textContent="KPI";

    window.scrollTo(0,0);

    if(typeof window.loadLiveKPI==="function"){
      try{
        var hasKpiRows=!!document.querySelector("#kpiCategories > .kpi-month-section");
        window.loadLiveKPI(!hasKpiRows);
      }catch(err){}
    }
  }

  // One delegated path supports existing and dynamically inserted KPI buttons.
  document.addEventListener("click",function(e){
    var btn=e.target.closest && e.target.closest('.side .nav button[data-page="kpi"]');
    if(btn)openKpi(e);
  },true);

  document.addEventListener("keydown",function(e){
    var btn=e.target.closest && e.target.closest('.side .nav button[data-page="kpi"]');
    if(btn && (e.key==="Enter"||e.key===" ")){
      e.preventDefault();
      openKpi(e);
    }
  },true);
})();
