(function(){
  const nav=document.getElementById("mobileBottomNav");
  if(!nav)return;

  function findNavTarget(page){
    const aliases={
      homeDashboard:["homeDashboard","dashboard","home"],
      dashboard:["dashboard","home"],
      parcels:["parcels","parcel","routing"],
      upload:["upload","uploadExported","upload-exported","export"],
      kpi:["kpi"]
    };
    const wanted=aliases[page]||[page];

    // Prefer an existing sidebar/nav element with a matching data-page.
    for(const p of wanted){
      const el=document.querySelector('[data-page="'+p+'"]');
      if(el && el!==nav.querySelector('[data-page="'+page+'"]')) return el;
    }

    // Then look for buttons/links by visible label.
    const els=[...document.querySelectorAll("button,a")];
    return els.find(el=>wanted.some(p=>el.textContent.trim().toLowerCase().includes(p.toLowerCase())));
  }

  nav.addEventListener("click",function(e){
    const btn=e.target.closest("button[data-page]");
    if(!btn)return;
    const page=btn.dataset.page;
    const target=findNavTarget(page);
    if(target){
      target.click();
      [...nav.querySelectorAll("button")].forEach(b=>b.classList.toggle("active",b===btn));
    }
  });

  // Keep the mobile active state aligned with the app's current page title.
  const observer=new MutationObserver(function(){
    const title=(document.getElementById("pageTitle")?.textContent||"").toLowerCase();
    [...nav.querySelectorAll("button")].forEach(b=>{
      const p=b.dataset.page;
      const active=(p==="homeDashboard" && /dashboard/.test(title)) ||
                   (p==="dashboard" && /parcel count/.test(title)) ||
                   (p==="parcels" && /parcel|routing/.test(title)) ||
                   (p==="upload" && /upload|export/.test(title)) ||
                   (p==="kpi" && /kpi/.test(title)) ||
                   (p==="podPoohChecker" && /pod\/pooh checker/i.test(title));
      b.classList.toggle("active",active);
    });
  });
  const title=document.getElementById("pageTitle");
  if(title)observer.observe(title,{childList:true,subtree:true,characterData:true});
})();
