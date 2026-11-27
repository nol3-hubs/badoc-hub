(function(){
  const nav=document.getElementById("mobileBottomNav");
  if(!nav)return;
  function setActive(page){
    nav.querySelectorAll("button").forEach(b=>{
      b.classList.toggle("active",b.dataset.mobilePage===page);
    });
  }
  nav.addEventListener("click",function(e){
    const b=e.target.closest("button[data-mobile-page]");
    if(!b)return;
    let target=document.querySelector('.side button[data-page="'+b.dataset.mobilePage+'"]');
    if(!target && b.dataset.mobilePage==="upload"){
      target=[...document.querySelectorAll(".side button")].find(x=>(x.textContent||"").toLowerCase().includes("upload"));
    }
    if(target){
      target.click();
      setActive(b.dataset.mobilePage);
    }
  });
  setActive("dashboard");
})();
