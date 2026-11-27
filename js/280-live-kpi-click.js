(function(){
  var b=document.getElementById("dashboardLiveKpi");
  if(!b)return;
  b.addEventListener("click",function(){
    if(typeof showPage==="function") showPage("kpi");
  });
})();
