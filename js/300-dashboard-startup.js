(function(){
  function openDashboard(){
    try{
      if(typeof showPage==="function"){
        showPage("homeDashboard");
      }else{
        document.querySelectorAll(".page").forEach(function(p){p.classList.remove("active")});
        var d=document.getElementById("homeDashboard");
        if(d)d.classList.add("active");
        document.querySelectorAll(".nav button").forEach(function(b){
          b.classList.toggle("active",b.dataset.page==="homeDashboard");
        });
        var t=document.getElementById("pageTitle");
        if(t)t.textContent="Dashboard";
      }
      if(typeof render==="function") render();
      if(typeof window.updateOperationProgress==="function") window.updateOperationProgress();
    }catch(e){console.warn("Dashboard startup:",e)}
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",openDashboard,{once:true});
  }else{
    openDashboard();
  }
})();
