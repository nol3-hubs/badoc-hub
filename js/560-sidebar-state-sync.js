(function(){
  function syncSidebarState(){
    const app=document.querySelector('.app');
    const side=app&&app.querySelector('.side');
    if(!app||!side)return;
    const collapsed=app.classList.contains('side-collapsed');
    side.classList.toggle('side-collapsed',collapsed);
    side.setAttribute('data-collapsed',collapsed?'true':'false');
  }
  syncSidebarState();
  const app=document.querySelector('.app');
  if(app&&window.MutationObserver){
    new MutationObserver(syncSidebarState).observe(app,{attributes:true,attributeFilter:['class']});
  }
})();
