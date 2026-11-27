(function(){
  if(window.__dashboardKpiMenuSync)return;
  window.__dashboardKpiMenuSync=true;
  function sync(){
    var score=document.getElementById("sheetScore");
    var grade=document.getElementById("kpiGrade");
    var remarks=document.getElementById("kpiRemarks");
    var ds=document.getElementById("dashboardOverallScore");
    var dg=document.getElementById("dashboardKpiGrade");
    if(ds)ds.textContent=(score&&score.textContent.trim())||"—";
    if(dg)dg.textContent=(grade&&grade.textContent.trim())||"—";
  }
  window.__badocSyncDashboardKpiSummary=sync;
  window.addEventListener("badoc-kpi-data-ready",sync);
  sync();
})();
