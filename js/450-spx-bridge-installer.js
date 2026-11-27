(function(){
const BRIDGE_VERSION="1";
  const BRIDGE_CHECK_TIMEOUT=5000;
  const REQUIRED_CHROME_VERSION="1.6.7";
  const REQUIRED_FIREFOX_VERSION="69.5.15";
  let installedPackageVersion="";
  const isFirefox=/Firefox\//i.test(navigator.userAgent);
  const requiredPackageVersion=isFirefox?REQUIRED_FIREFOX_VERSION:REQUIRED_CHROME_VERSION;
  // Keep the visible "Extension vX" labels (e.g. the operation modal subtitle) equal to the real requirement.
  (function(){const apply=()=>document.querySelectorAll("[data-required-extension-version]").forEach(el=>{el.textContent=requiredPackageVersion});
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();})();
  function compareVersions(a,b){
    const aa=String(a||"").split(/[.+-]/).map(x=>/^\d+$/.test(x)?Number(x):x);
    const bb=String(b||"").split(/[.+-]/).map(x=>/^\d+$/.test(x)?Number(x):x);
    for(let i=0;i<Math.max(aa.length,bb.length);i++){
      const x=aa[i]??0,y=bb[i]??0;
      if(x===y)continue;
      if(typeof x==="number"&&typeof y==="number")return x>y?1:-1;
      return String(x)>String(y)?1:-1;
    }
    return 0;
  }
  const BADOC_SPX_BRIDGE_SOURCE=window.BADOC_SPX_BRIDGE_SOURCE||"BADOC_SPX_BRIDGE";
  const BADOC_PAGE_SOURCE=window.BADOC_PAGE_SOURCE||"BADOC_PAGE";
  let bridgeCheckInFlight=null;
  let bridgeReady=false;

  let BRIDGE_FILES_BASE64 = window.BADOC_BRIDGE_FILES || {}; // filled on demand by badocEnsureBridgeFiles()

  function bridgeModal(){return document.getElementById("badocSpxBridgeInstallModal");}
  function openBridgeInstaller(){try{window.badocEnsureBridgeFiles&&window.badocEnsureBridgeFiles().catch(()=>{});}catch(_){}bridgeModal()?.classList.add("is-open");}
  function closeBridgeInstaller(){
    // Closing the installer must not reload the dashboard. Escape is commonly
    // used to dismiss dialogs and should never reset the current page.
    const modal=bridgeModal();
    if(modal)modal.classList.remove("is-open");
    if(!bridgeCheckInFlight)checkBridgeInstalled(BRIDGE_CHECK_TIMEOUT);
  }

  function setBridgeDownloadStatus(message){
    const el=document.getElementById("badocSpxBridgeDownloadStatus");
    if(!el)return;
    el.textContent=message||"";
    el.classList.toggle("is-visible",!!message);
  }

  async function openChromeExtensions(){
    const hint=document.getElementById("badocSpxOpenExtensionsHint");
    // A normal webpage cannot navigate to chrome:// URLs. When Badoc Hub Extension is installed,
    // the extension can open the privileged page through chrome.tabs.create().
    if(bridgeReady){
      window.postMessage({source:BADOC_PAGE_SOURCE,type:"BADOC_OPEN_EXTENSIONS"},"*");
      setBridgeDownloadStatus("Opening Chrome Extensions in a new tab…");
      if(hint)hint.textContent="Opening a new tab…";
      return;
    }
    try{
      await navigator.clipboard.writeText("chrome://extensions/");
      setBridgeDownloadStatus("chrome://extensions/ copied. Press Ctrl+L, Ctrl+V, then Enter.");
      if(hint)hint.textContent="Chrome blocks webpages from directly opening chrome:// pages, so the address has been copied for you.";
    }catch(err){
      window.prompt("Copy this into Chrome's address bar:","chrome://extensions/");
      setBridgeDownloadStatus("Copy chrome://extensions/ into the address bar, then press Enter.");
      if(hint)hint.textContent="Chrome blocks webpages from directly opening chrome:// pages.";
    }
  }

  function base64ToBytes(base64){
    const binary=atob(base64);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes;
  }

  function base64ToUtf8(base64){
    return new TextDecoder().decode(base64ToBytes(base64));
  }

  async function pickBridgeDirectory(){
    if(typeof window.showDirectoryPicker!=="function"){
      throw new Error("Folder access is not available in this browser/page. Open BADOC from GitHub Pages in Chrome or Edge.");
    }
    return await window.showDirectoryPicker({mode:"readwrite",startIn:"downloads"});
  }

  async function writeBridgeFile(dir,name,data){
    const parts=String(name).split("/").filter(Boolean);
    const filename=parts.pop();
    let parent=dir;
    for(const part of parts)parent=await parent.getDirectoryHandle(part,{create:true});
    const handle=await parent.getFileHandle(filename,{create:true});
    const writable=await handle.createWritable({keepExistingData:false});
    try{await writable.write(data);}finally{await writable.close();}
  }

  async function installBridgeDirectly(){
    if(typeof window.showDirectoryPicker!=="function"){
      setBridgeDownloadStatus("Direct Install is not available here. Open BADOC from your HTTPS GitHub Pages address in Chrome or Edge.");
      return;
    }

    for(let attempt=1;attempt<=2;attempt++){
      try{
        setBridgeDownloadStatus(attempt===1
          ? "Select the EMPTY Badoc Hub Extension folder you created…"
          : "Windows changed the folder state. Please select the same Badoc Hub Extension folder again…");

        const dir=await pickBridgeDirectory();
        await window.badocEnsureBridgeFiles(); BRIDGE_FILES_BASE64=window.BADOC_BRIDGE_FILES||{};
        const names=Object.keys(BRIDGE_FILES_BASE64);

        // Verify the chosen directory is usable before writing any files.
        try{
          await dir.values().next();
        }catch(checkErr){
          if(checkErr?.name==="InvalidStateError") throw checkErr;
        }

        for(const name of names){
          await writeBridgeFile(dir,name,base64ToBytes(BRIDGE_FILES_BASE64[name]));
        }

        setBridgeDownloadStatus("✅ Badoc Hub Extension v"+requiredPackageVersion+" installed directly into the selected folder. Open chrome://extensions → Developer mode → Load unpacked → select this folder.");
        return;
      }catch(err){
        if(err?.name==="AbortError"){
          setBridgeDownloadStatus("Installation cancelled.");
          return;
        }
        if(err?.name==="InvalidStateError" && attempt<2){
          continue;
        }
        console.error("BADOC Badoc Hub Extension direct install failed:",err);
        const msg=err?.message||String(err);
        setBridgeDownloadStatus("❌ Install failed: "+msg+". Close any File Explorer window showing this folder, then try Install again.");
        return;
      }
    }
  }


  function buildBadocExtensionZipBytes(){
    const files=window.BADOC_BRIDGE_FILES||{};
    const names=Object.keys(files);
    if(!names.length) throw new Error("Extension files are missing from this dashboard build.");
    const enc=new TextEncoder();
    const crc32=bytes=>{
      let crc=0xffffffff;
      for(let i=0;i<bytes.length;i++){
        crc^=bytes[i];
        for(let k=0;k<8;k++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
      }
      return (crc^0xffffffff)>>>0;
    };
    const u16=n=>[n&255,(n>>>8)&255];
    const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    const now=new Date();
    const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
    const dosDate=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    const local=[], central=[];
    let offset=0;
    for(const name of names){
      const nameBytes=enc.encode(name);
      const data=base64ToBytes(files[name]);
      const crc=crc32(data);
      const header=[0x50,0x4b,0x03,0x04,...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0)];
      local.push(new Uint8Array([...header,...nameBytes]),data);
      const c=[0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)];
      central.push(new Uint8Array([...c,...nameBytes]));
      offset+=header.length+nameBytes.length+data.length;
    }
    const centralSize=central.reduce((n,b)=>n+b.length,0);
    const end=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(names.length),...u16(names.length),...u32(centralSize),...u32(offset),...u16(0)]);
    const parts=[...local,...central,end];
    const total=parts.reduce((n,b)=>n+b.length,0);
    const out=new Uint8Array(total);
    let pos=0;
    for(const part of parts){out.set(part,pos);pos+=part.length;}
    return out;
  }
  window.buildBadocExtensionZipBytes=buildBadocExtensionZipBytes;

  async function downloadBadocExtensionZip(){
    try{await window.badocEnsureBridgeFiles();const bytes=window.buildBadocExtensionZipBytes();const blob=new Blob([bytes],{type:"application/zip"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Badoc Hub Extension.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setBridgeDownloadStatus("Downloaded Badoc Hub Extension.zip. Extract it, then load the Badoc Hub Extension folder in chrome://extensions.");}catch(err){setBridgeDownloadStatus("Could not create ZIP download: "+(err?.message||String(err)));}
  }
  function updateVersionIndicator(state,message){
    let el=document.getElementById("badocExtensionVersionStatus");
    if(!el){
      el=document.createElement("div");
      el.id="badocExtensionVersionStatus";
      el.setAttribute("role","status");
      el.style.cssText="display:inline-flex;align-items:center;gap:7px;margin-left:10px;padding:7px 11px;border:1px solid var(--line,#334155);border-radius:10px;font-size:11px;font-weight:700;line-height:1.4;width:max-content;max-width:min(460px,calc(100vw - 32px));min-width:0;white-space:nowrap;overflow:hidden;text-overflow:clip;vertical-align:middle;flex:0 1 auto;box-sizing:border-box";
      el.addEventListener("mouseenter",()=>{const track=el.querySelector(".badoc-extension-status-track");if(track)track.style.animationPlayState="paused";});
      el.addEventListener("mouseleave",()=>{const track=el.querySelector(".badoc-extension-status-track");if(track)track.style.animationPlayState="running";});
      const anchor=document.getElementById("top-header-info")||document.querySelector(".top .top-header-info");
      if(anchor)anchor.appendChild(el);
      else document.body.appendChild(el);
    }
    const colors={checking:["#64748b","#94a3b8"],ok:["#065f46","#34d399"],outdated:["#7f1d1d","#f87171"],missing:["#7c2d12","#fb923c"]};
    const pair=colors[state]||colors.missing;
    el.style.background=pair[0]+"22";
    el.style.borderColor=pair[1]+"88";
    el.style.color=pair[1];
    let spinner=el.querySelector(".badoc-extension-check-spinner");
    if(state==="checking"){
      if(!spinner){
        spinner=document.createElement("span");
        spinner.className="badoc-extension-check-spinner";
        spinner.setAttribute("aria-hidden","true");
        spinner.textContent="";
        spinner.style.cssText="display:inline-block;width:12px;height:12px;flex:0 0 12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;box-sizing:border-box;animation:badocExtensionCheckSpin .65s linear infinite";
        el.insertBefore(spinner,el.firstChild);
      }
    }else if(spinner){spinner.remove();}
    const fullMessage=String(message||"").startsWith("Extension")?String(message):"Extension "+String(message||"");
    let track=el.querySelector(".badoc-extension-status-track");
    if(!track){
      track=document.createElement("span");
      track.className="badoc-extension-status-track";
      track.style.cssText="display:inline-block;white-space:nowrap;will-change:transform";
      if(spinner)el.replaceChildren(spinner);
      else el.textContent="";
      el.appendChild(track);
    }
    track.style.animation="none";
    track.textContent=fullMessage;
    requestAnimationFrame(()=>{
      const available=Math.max(0,el.clientWidth-22);
      const textWidth=track.scrollWidth;
      if(textWidth>available){
        track.textContent=fullMessage+"　 •　 "+fullMessage+"　 •　 ";
        const duration=Math.max(9,Math.min(28,(textWidth*2)/42));
        track.style.animation="badocExtensionStatusMarquee "+duration+"s linear infinite";
      }else{
        track.textContent=fullMessage;
        track.style.animation="none";
        track.style.transform="none";
      }
    });
    if(!document.getElementById("badocExtensionStatusMarqueeStyle")){
      const style=document.createElement("style");
      style.id="badocExtensionStatusMarqueeStyle";
      style.textContent="@keyframes badocExtensionStatusMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes badocExtensionCheckSpin{to{transform:rotate(360deg)}}#badocExtensionVersionStatus:hover .badoc-extension-status-track{animation-play-state:paused!important}";
      document.head.appendChild(style);
    }
    el.title="Detected extension version: "+(installedPackageVersion||"unknown")+" · Required: "+requiredPackageVersion+" · Hover to pause";
  }
  function checkBridgeInstalled(timeout=BRIDGE_CHECK_TIMEOUT){
    if(bridgeCheckInFlight)return bridgeCheckInFlight;
    bridgeReady=false;
    updateVersionIndicator("checking","Checking extension version…");
    bridgeCheckInFlight=new Promise(resolve=>{
      let settled=false;
      let versionSeen=false;
      const finish=ready=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        window.removeEventListener("message",onMessage);
        bridgeReady=!!ready;
        if(!ready){
          const isCurrent=versionSeen&&compareVersions(installedPackageVersion,requiredPackageVersion)>=0;
          const detail=isCurrent
            ? "Extension v"+installedPackageVersion+" detected; background bridge is disconnected."
            : installedPackageVersion
              ? "Extension v"+installedPackageVersion+" is outdated. Required: v"+requiredPackageVersion+"."
              : "Waiting for extension · checking again…";
          setBridgeDownloadStatus(isCurrent||installedPackageVersion?detail:"Extension not detected yet. Retrying connection check…");
          // Keep the loading treatment visible while the dashboard retries
          // the bridge handshake in the background every 10 seconds.
          updateVersionIndicator(isCurrent?"disconnected":(installedPackageVersion?"outdated":"checking"),detail);
        }else{
          const detail="v"+installedPackageVersion+" connected";
          setBridgeDownloadStatus("Extension "+detail);
          updateVersionIndicator("ok",detail);
        }
        resolve(!!ready);
        bridgeCheckInFlight=null;
      };
      const onMessage=event=>{
        if(event.source!==window)return;
        const data=event.data||{};
        if(data.source!==BADOC_SPX_BRIDGE_SOURCE||data.type!=="BADOC_BRIDGE_READY")return;
        if(String(data.version||"").trim()!==BRIDGE_VERSION)return;
        installedPackageVersion=String(data.packageVersion||"").trim();
        if(!installedPackageVersion){
          setBridgeDownloadStatus("Detected an older extension without package-version reporting. Update the extension.");
          finish(false);return;
        }
        versionSeen=true;
        if(compareVersions(installedPackageVersion,requiredPackageVersion)<0){
          setBridgeDownloadStatus("Extension v"+installedPackageVersion+" is outdated. Required: v"+requiredPackageVersion+".");
          finish(false);return;
        }
        if(data.connected===false){
          const detail="v"+installedPackageVersion+" detected; waiting for background service…";
          setBridgeDownloadStatus("Extension "+detail);
          updateVersionIndicator("disconnected",detail);
          return;
        }
        finish(true);
      };
      const timer=setTimeout(()=>finish(false),timeout);
      window.addEventListener("message",onMessage);
      window.postMessage({source:BADOC_PAGE_SOURCE,type:"BADOC_BRIDGE_HELLO",version:BRIDGE_VERSION},"*");
    });
    return bridgeCheckInFlight;
  }
  async function ensureBadocSpxBridge(){
    const ready=await checkBridgeInstalled();
    if(ready)return true;
    openBridgeInstaller();
    return false;
  }

  window.__badocEnsureSpxBridge=ensureBadocSpxBridge;
  window.__badocOpenSpxBridgeInstaller=openBridgeInstaller;
  window.__badocSpxBridgeReady=()=>bridgeReady;

  const initBridgeInstaller=()=>{
    document.getElementById("badocSpxBridgeInstallerClose")?.addEventListener("click",closeBridgeInstaller);
    document.getElementById("badocSpxBridgeInstallerClose2")?.addEventListener("click",closeBridgeInstaller);
    document.getElementById("badocSpxBridgeDownloadZip")?.addEventListener("click",downloadBadocExtensionZip);
  document.getElementById("badocSpxOpenExtensions")?.addEventListener("click",openChromeExtensions);

  window.addEventListener("message",event=>{
    if(event.source!==window)return;
    const data=event.data||{};
    if(data.source!==BADOC_SPX_BRIDGE_SOURCE)return;
    if(data.type==="BADOC_EXTENSIONS_OPENED") setBridgeDownloadStatus("✅ Chrome Extensions opened in a new tab.");
  });
    bridgeModal()?.addEventListener("click",e=>{if(e.target===bridgeModal())closeBridgeInstaller();});
    window.addEventListener("keydown",e=>{
      if(e.key!=="Escape"||!bridgeModal()?.classList.contains("is-open"))return;
      e.preventDefault();
      closeBridgeInstaller();
    });
    checkBridgeInstalled(BRIDGE_CHECK_TIMEOUT);
    if(typeof window.__badocEvery==="function")window.__badocEvery(()=>{if(!bridgeCheckInFlight&&!bridgeReady)checkBridgeInstalled(BRIDGE_CHECK_TIMEOUT);},10000);
    else window.setInterval(()=>{if(!bridgeCheckInFlight&&!bridgeReady)checkBridgeInstalled(BRIDGE_CHECK_TIMEOUT);},10000);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initBridgeInstaller,{once:true});
  else initBridgeInstaller();
})();
