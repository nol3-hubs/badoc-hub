(function(){
  const m1=document.querySelector('#kpi .kpi-m1-sheet');
  const toggle=document.getElementById('m1Toggle');
  if(!m1||!toggle)return;
  m1.classList.add('m1-collapsed');
  const setState=open=>{
    m1.classList.toggle('m1-open',open);
    m1.classList.toggle('m1-collapsed',!open);
    toggle.setAttribute('aria-expanded',String(open));
    const em=toggle.querySelector('em');
    if(em) em.textContent=open?'▾ EXPANDED':'▸ COLLAPSED';
  };
  toggle.addEventListener('click',()=>setState(m1.classList.contains('m1-collapsed')));
  toggle.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();setState(m1.classList.contains('m1-collapsed'));}
  });
  setState(false);
})();
