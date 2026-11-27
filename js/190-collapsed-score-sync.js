(function(){
  const sync=()=>{
    const source=document.getElementById("m1Score");
    const target=document.getElementById("m1CollapsedScore");
    if(source&&target) target.textContent=source.textContent||"—";
  };
  sync();
  const body=document.getElementById("m1Body");
  if(body&&window.MutationObserver){
    new MutationObserver(sync).observe(body,{childList:true,subtree:true,characterData:true});
  }
})();
