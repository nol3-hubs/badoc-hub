/* Success-rate colours: update only affected rate labels instead of rescanning the full dashboard after every DOM mutation. */
(function(){
  "use strict";
  const SEL=".town-card-success-rate,.town-status.success-rate,#badocSuccessRate,#piniliSuccessRate,#dashEodRate,#eodBigRate,#performanceRate";
  const CLASSES=["rate-good","rate-warn","rate-low","rate-none"];
  const cls=p=>p>=95?"rate-good":p>=90?"rate-warn":"rate-low";
  function paint(el){
    if(!el||!el.matches||!el.matches(SEL))return;
    const m=/(-?\d+(?:[.,]\d+)?)\s*%/.exec(el.textContent||"");
    const value=m?parseFloat(m[1].replace(",",".")):0;
    const want=!m||value<=0?"rate-none":cls(value);
    for(const name of CLASSES)if(name!==want)el.classList.remove(name);
    if(!el.classList.contains(want))el.classList.add(want);
  }
  function run(){
    document.querySelectorAll(SEL).forEach(paint);
  }
  const pending=new Set();
  let raf=0;
  function addAffected(node){
    if(!node)return;
    const element=node.nodeType===1?node:node.parentElement;
    if(!element)return;
    const match=element.closest&&element.closest(SEL);
    if(match)pending.add(match);
    if(node.nodeType===1){
      if(element.matches(SEL))pending.add(element);
      element.querySelectorAll?.(SEL).forEach(el=>pending.add(el));
    }
  }
  function flush(){
    raf=0;
    pending.forEach(paint);
    pending.clear();
  }
  function observe(){
    const root=document.querySelector(".app")||document.body;
    if(!root)return;
    const observer=new MutationObserver(records=>{
      for(const record of records){
        addAffected(record.target);
        if(record.type==="childList")record.addedNodes.forEach(addAffected);
      }
      if(pending.size&&!raf)raf=requestAnimationFrame(flush);
    });
    observer.observe(root,{childList:true,subtree:true,characterData:true});
    run();
  }
  window.__badocPaintRates=run;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});
  else observe();
})();
