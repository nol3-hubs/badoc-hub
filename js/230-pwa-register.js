if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js", {updateViaCache:"none"}).then(function(reg){
      reg.update().catch(function(err){console.warn("Badoc Hub service worker update check:",err);});
    }).catch(function (err) {
      console.warn("Badoc Hub PWA service worker:", err);
    });
  });
}

try{
  const initSharedFilterSync=()=>setTimeout(startSharedFilterSync,1200);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initSharedFilterSync,{once:true});
  else initSharedFilterSync();
}catch(e){console.warn("Filter sync init:",e)}

try{const initSharedFilterSync=()=>setTimeout(startSharedFilterSync,1200);if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initSharedFilterSync,{once:true});else initSharedFilterSync();}catch(e){console.warn("Filter sync init:",e)}

// Bidirectional global filter publishing: changes and clears from ANY device
// are sent to the same shared_filter_state row.
try{
  ["recordSearch","recordTown","recordStation","recordStatus"].forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener("input",queueSharedFilterPublish);
    el.addEventListener("change",queueSharedFilterPublish);
  });
}catch(e){console.warn("Filter publish wiring:",e)}
