(function(){
  if(window.__badocVolumeForecastCardNavigation)return;
  window.__badocVolumeForecastCardNavigation=true;
  function openAllDayVolumeForecast(){
    // Use the same real submenu control the user would click so its page state
    // and expanded Planning Board navigation stay in sync.
    const submenuButton=document.querySelector('#planningBoardSubmenu button[data-page="volumeForecastBoard"]');
    if(submenuButton){submenuButton.click();return;}
    if(typeof window.showPage==="function")window.showPage("volumeForecastBoard");
  }
  document.addEventListener("click",event=>{
    const card=event.target?.closest?.("#incomingVolumeCard");
    if(card)openAllDayVolumeForecast();
  });
  document.addEventListener("keydown",event=>{
    const card=event.target?.closest?.("#incomingVolumeCard");
    if(card&&(event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      openAllDayVolumeForecast();
    }
  });
})();
