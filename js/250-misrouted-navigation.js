(function(){
  if(window.__integratedMisroutedNavigation)return;
  window.__integratedMisroutedNavigation=true;
  var oldShow=window.showPage;
  if(typeof oldShow==="function"){
    window.showPage=function(p){
      if(p==="misrouted"){
        oldShow("dashboard");
        setTimeout(function(){
          var el=document.getElementById("misroutedIntegrated");
          if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
        },50);
        return;
      }
      return oldShow.apply(this,arguments);
    };
  }
})();
