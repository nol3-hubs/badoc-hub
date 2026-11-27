/* Estimated Tomorrow: recalculate after data/render/load without a periodic reset. */
(function(){
  function runET(){
    try{
      if(typeof window.recalculateEstimatedTomorrowFinal==="function"){
        window.recalculateEstimatedTomorrowFinal();
      }
    }catch(e){ console.warn("Estimated Tomorrow refresh:",e); }
  }

  // Run after the app's normal initialization/render cycle.
  document.addEventListener("DOMContentLoaded", function(){
    runET();
    setTimeout(runET, 300);
    setTimeout(runET, 1200);
  });

  // If the app exposes render, wrap it so stored/current data updates refresh the card.
  var tries=0;
  function hook(){
    tries++;
    if(typeof window.render==="function" && !window.__etRenderHooked){
      var original=window.render;
      window.render=function(){
        var result=original.apply(this, arguments);
        setTimeout(runET, 0);
        return result;
      };
      window.__etRenderHooked=true;
      runET();
      return;
    }
    if(tries<20) setTimeout(hook,250);
  }
  hook();

  // React to visibility/focus without introducing a repeating timer.
  window.addEventListener("pageshow", runET);
  window.addEventListener("focus", runET);
})();
