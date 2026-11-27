(function(){
  "use strict";
  if(window.__badocPickupInfoUi)return;
  window.__badocPickupInfoUi=true;
  const pending=new Map();
  let activePhotoUrls=[];
  let activePhotoIndex=0;
  const esc=value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const asTime=value=>{
    if(value===null||value===undefined||value==="")return "—";
    let date=null;const number=Number(value);
    if(Number.isFinite(number)&&number>0)date=new Date(number<100000000000?number*1000:number);
    else date=new Date(String(value));
    return date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(date):String(value);
  };
  function ensureModal(){
    let modal=document.getElementById("badocPickupInfoModal");if(modal)return modal;
    modal=document.createElement("div");modal.id="badocPickupInfoModal";
    modal.innerHTML='<section class="pickup-info-card" role="dialog" aria-modal="true" aria-labelledby="badocPickupInfoTitle"><header class="pickup-info-head"><strong id="badocPickupInfoTitle">Proof</strong><button type="button" class="pickup-info-close" aria-label="Close">×</button></header><div class="pickup-info-body"><p class="pickup-info-message" id="badocPickupInfoMessage">Loading Pickup Info…</p><div id="badocPickupInfoContent"></div></div></section><div class="pickup-photo-viewer" id="badocPickupPhotoViewer" role="dialog" aria-modal="true" aria-label="Pickup proof photo viewer" hidden><button type="button" class="pickup-photo-viewer-close" aria-label="Close image viewer">×</button><button type="button" class="pickup-photo-viewer-nav pickup-photo-viewer-prev" data-photo-prev aria-label="Previous photo">‹</button><figure><img id="badocPickupPhotoViewerImage" alt="Pickup proof photo"><figcaption id="badocPickupPhotoViewerCaption"></figcaption></figure><button type="button" class="pickup-photo-viewer-nav pickup-photo-viewer-next" data-photo-next aria-label="Next photo">›</button></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click",event=>{
      const target=event.target;
      if(target===modal){closeModal();return;}
      if(target.closest?.(".pickup-info-close")){closeModal();return;}
      if(target.closest?.(".pickup-photo-viewer-close")){closePhotoViewer();return;}
      if(target.closest?.("[data-photo-prev]")){movePhoto(-1);return;}
      if(target.closest?.("[data-photo-next]")){movePhoto(1);return;}
      if(target.id==="badocPickupPhotoViewer"){closePhotoViewer();return;}
      const photo=target.closest?.(".pickup-info-photo");
      if(photo){
        event.preventDefault();
        activePhotoUrls=Array.from(modal.querySelectorAll(".pickup-info-photo")).map(button=>button.dataset.photoUrl).filter(Boolean);
        activePhotoIndex=activePhotoUrls.indexOf(photo.dataset.photoUrl);
        showPhotoViewer(modal);
      }
    });
    document.addEventListener("keydown",event=>{
      const viewer=document.getElementById("badocPickupPhotoViewer");
      if(event.key==="Escape"){
        if(viewer&&!viewer.hidden)closePhotoViewer();else closeModal();
      }else if(viewer&&!viewer.hidden&&event.key==="ArrowLeft")movePhoto(-1);
      else if(viewer&&!viewer.hidden&&event.key==="ArrowRight")movePhoto(1);
    });
    return modal;
  }
  function closeModal(){closePhotoViewer();const modal=document.getElementById("badocPickupInfoModal");if(modal)modal.classList.remove("open");}
  function showPhotoViewer(modal){
    if(!activePhotoUrls.length||activePhotoIndex<0)return;
    const viewer=modal.querySelector("#badocPickupPhotoViewer");
    const image=modal.querySelector("#badocPickupPhotoViewerImage");
    const caption=modal.querySelector("#badocPickupPhotoViewerCaption");
    image.src=activePhotoUrls[activePhotoIndex];
    image.alt="Pickup proof photo "+(activePhotoIndex+1);
    caption.textContent="Photo "+(activePhotoIndex+1)+" of "+activePhotoUrls.length;
    const previous=viewer.querySelector("[data-photo-prev]");
    const next=viewer.querySelector("[data-photo-next]");
    previous.disabled=activePhotoIndex===0;
    next.disabled=activePhotoIndex===activePhotoUrls.length-1;
    viewer.hidden=false;
  }
  function movePhoto(direction){
    const modal=document.getElementById("badocPickupInfoModal");
    if(!modal||!activePhotoUrls.length)return;
    const next=activePhotoIndex+direction;
    if(next<0||next>=activePhotoUrls.length)return;
    activePhotoIndex=next;showPhotoViewer(modal);
  }
  function closePhotoViewer(){
    const viewer=document.getElementById("badocPickupPhotoViewer");
    if(viewer){viewer.hidden=true;const image=viewer.querySelector("img");if(image)image.removeAttribute("src");}
    activePhotoUrls=[];activePhotoIndex=0;
  }
  function safePhoto(value){
    let raw="";
    if(typeof value==="string")raw=value;
    else if(value&&typeof value==="object")raw=value.url||value.photo_url||value.image_url||value.origin_image||value.image||"";
    if(!raw)return "";
    try{
      const url=new URL(raw,"https://spx.shopee.ph");
      const host=url.hostname.toLowerCase();
      if(url.protocol!=="https:"||(host!=="spx.shopee.ph"&&!host.endsWith(".susercontent.com")&&!host.endsWith(".file.susercontent.com")))return "";
      return url.href;
    }catch(_){return "";}
  }
  function render(item){
    const modal=ensureModal(),message=modal.querySelector("#badocPickupInfoMessage"),content=modal.querySelector("#badocPickupInfoContent"),pk=item?.pk||{};
    const fields=[
      ["Pickup status",pk.st],["ETA",asTime(pk.eta)],["Pickup window",asTime(pk.s0)+" – "+asTime(pk.s1)],
      ["Assigned time",asTime(pk.as)],["Picked-up time",asTime(pk.picked)],["Tag",pk.tag],
      ["Pickup Point ID",pk.pp],["Assigned rider",pk.drv]
    ];
    message.textContent="Order "+String(item?.id||"")+" · Uploaded proof photos and pickup attempt details from the signed-in SPX session.";
    const summary='<div class="pickup-info-summary">'+fields.map(([label,value])=>'<div><small>'+esc(label)+'</small><strong>'+esc(value||"—")+'</strong></div>').join("")+'</div>';
    const attempts=Array.isArray(pk.att)?pk.att:[];
    const list=attempts.length?attempts.map((attempt,index)=>{
      const gf=attempt.gf==="1"||attempt.gf==="true"?"Inside geofence":attempt.gf==="0"||attempt.gf==="false"?"Outside geofence":"Not available";
      const photos=(Array.isArray(attempt.pl)?attempt.pl:[]).map(safePhoto).filter(Boolean);
      return '<article class="pickup-info-attempt"><div class="pickup-info-attempt-head"><span>Record '+(index+1)+' · '+esc(attempt.res||"No result")+'</span><span>'+esc(asTime(attempt.t))+'</span></div>'+
        '<div class="pickup-info-attempt-grid"><div>Pickup Attempt Time: '+esc(asTime(attempt.t))+'</div><div>Pickup Result: '+esc(attempt.res||"—")+'</div><div>Pickup Task: '+esc(attempt.task||"—")+'</div><div>Pickup Driver: '+esc(attempt.drv||"—")+'</div><div>Driver ID: '+esc(attempt.drvId||"—")+'</div><div>Within Geofence: '+esc(gf)+'</div><div>Seller signature: '+(attempt.sig?"Yes":"No")+'</div><div>Remark: '+esc(attempt.rm||"—")+'</div></div>'+
        (photos.length?'<div class="pickup-info-photos" aria-label="Uploaded proof photos">'+photos.map((url,i)=>'<button type="button" class="pickup-info-photo" data-photo-url="'+esc(url)+'" title="View full-size proof photo '+(i+1)+'"><img src="'+esc(url)+'" alt="Pickup proof photo '+(i+1)+'" loading="lazy" decoding="async"><span>Photo '+(i+1)+'</span></button>').join("")+'</div>':'<p class="pickup-info-no-photos">No uploaded proof photos were returned for this record.</p>')+'</article>';
    }).join(""):'<p class="pickup-info-message">SPX returned no pickup-attempt history for this order.</p>';
    const photoCount=attempts.reduce((count,attempt)=>count+(Array.isArray(attempt.pl)?attempt.pl.map(safePhoto).filter(Boolean).length:0),0);
    content.innerHTML='<h4>Proof of Pickup Info ('+attempts.length+') · '+photoCount+' photo'+(photoCount===1?'':'s')+'</h4>'+list+summary;
  }
  window.addEventListener("message",event=>{
    if(event.source!==window)return;
    const data=event.data||{};
    if(data.source!=="BADOC_SPX_BRIDGE"||data.type!=="BADOC_PICKUP_INFO_RESULT")return;
    const key=String(data.reqId||""),request=pending.get(key);if(!request)return;
    clearTimeout(request.timer);pending.delete(key);
    if(data.ok)request.resolve(data.item);else request.reject(new Error(data.error||"Proof lookup failed."));
  });
  async function lookup(orderId,button){
    const modal=ensureModal(),message=modal.querySelector("#badocPickupInfoMessage"),content=modal.querySelector("#badocPickupInfoContent");
    modal.classList.add("open");modal.querySelector("#badocPickupInfoTitle").textContent="Proof · "+orderId;
    message.textContent="Connecting to the signed-in SPX tab…";message.classList.remove("pickup-info-error");content.innerHTML="";
    if(button)button.disabled=true;
    try{
      const ready=await window.__badocEnsureSpxBridge?.();
      if(ready===false)throw new Error("Badoc Hub Extension is not connected or is out of date. Update the extension, then reload BADOC HUB.");
      const reqId="pickup-info-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
      const item=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(reqId);reject(new Error("Proof lookup timed out. Reload the SPX tab and try again."));},35000);
        pending.set(reqId,{resolve,reject,timer});
        window.postMessage({source:"BADOC_PAGE",type:"BADOC_LOOKUP_PICKUP_INFO",reqId,orderId},"*");
      });
      render(item);
    }catch(error){
      message.textContent=error?.message||String(error);message.classList.add("pickup-info-error");content.innerHTML="";
    }finally{if(button)button.disabled=false;}
  }
  document.addEventListener("click",event=>{
    const button=event.target.closest?.(".fm-pickup-info-btn");if(!button)return;
    const orderId=String(button.dataset.orderId||"").trim();if(orderId)lookup(orderId,button);
  });
})();
