(function(){
  // One startup refresh is enough: the normal data-render path calls
  // renderRecords(), which refreshes updateDashboardFromParcelFilters().
  // Do not poll/rebuild all dashboard metrics every 1.5 seconds.
  if(window.__badocParcelVolumeFixV11)return;
  window.__badocParcelVolumeFixV11=true;
  const refresh=()=>{
    try{
      if(typeof render==="function")render();
      else if(typeof updateDashboardFromParcelFilters==="function")updateDashboardFromParcelFilters();
    }catch(e){console.warn("Parcel volume refresh:",e)}
  };
  setTimeout(refresh,0);
})();
