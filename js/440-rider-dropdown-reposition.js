(function(){
  const reposition=()=>{
    document.querySelectorAll(".town-rider-picker.open").forEach(p=>{
      const d=document.body.querySelector(".town-rider-dropdown");
      if(d && typeof d.__place==="function")d.__place();
    });
  };
  window.addEventListener("resize",reposition,{passive:true});
  window.addEventListener("scroll",reposition,{passive:true,capture:true});
})();
