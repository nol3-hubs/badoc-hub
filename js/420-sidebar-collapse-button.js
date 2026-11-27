(function(){
  const app=document.querySelector('.app');
  const btn=document.getElementById('sideCollapseBtn');
  if(!app||!btn)return;
  const key='badoc_side_collapsed_v1';
  let collapsed=false;
  try{collapsed=localStorage.getItem(key)==='1'}catch(e){}
  const apply=()=>{
    app.classList.toggle('side-collapsed',collapsed);
    const label=collapsed?'Expand menu':'Collapse menu';
    btn.setAttribute('aria-label',label);
    btn.setAttribute('aria-expanded',collapsed?'false':'true');
    btn.title=label;
    const icon=btn.querySelector('.side-collapse-icon');
    if(icon)icon.textContent=collapsed?'›':'‹';
  };
  btn.addEventListener('click',()=>{collapsed=!collapsed;try{localStorage.setItem(key,collapsed?'1':'0')}catch(e){}apply()});
  apply();
})();
