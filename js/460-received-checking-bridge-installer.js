(function(){
  const VERSION='1';
  const SOURCE='BADOC_RECEIVED_CHECKING';
  const BRIDGE_FILES_BASE64 = window.BADOC_BRIDGE_FILES;
  const modal=document.getElementById('receivedCheckingBridgeInstallModal');
  const status=document.getElementById('rcBridgeInstallStatus');
  let closeTimer=null;
  function show(message){status.textContent=message||'';status.classList.toggle('show',!!message);}
  function open(reason){
    if(closeTimer){clearTimeout(closeTimer);closeTimer=null;}
    modal?.classList.add('is-open');
    show(reason==='secondary'?'Badoc Hub Extension is needed to sync Transported / RTS.':'Badoc Hub Extension is needed to sync Received parcels.');
  }
  function closeAndRefresh(){
    modal?.classList.remove('is-open');

  }
  function bytes64(value){const bin=atob(value);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
  function text64(value){return new TextDecoder().decode(bytes64(value));}
  async function writeFile(dir,name,contents){const h=await dir.getFileHandle(name,{create:true});const w=await h.createWritable({keepExistingData:false});try{await w.write(contents);}finally{await w.close();}}
  async function downloadBridgeFiles(){
    try{await window.badocEnsureBridgeFiles();const bytes=window.buildBadocExtensionZipBytes();const blob=new Blob([bytes],{type:"application/zip"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Badoc Hub Extension.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);show("Downloaded Badoc Hub Extension.zip. Extract it, then load the Badoc Hub Extension folder in chrome://extensions.");}catch(err){show("Could not create ZIP download: "+(err?.message||String(err)));}
  }
  async function openExtensions(){
    try{await navigator.clipboard.writeText('chrome://extensions/');show('Copied chrome://extensions/. Paste it into Chrome’s address bar and press Enter.');}
    catch(_){window.prompt('Copy this into Chrome’s address bar:','chrome://extensions/');show('Open chrome://extensions/ in a new tab.');}
  }
  const frame=document.getElementById('receivedCheckingFrame');
  window.addEventListener('message',event=>{
    if(event.source!==frame?.contentWindow)return;
    const d=event.data||{};
    if(d.source===SOURCE&&d.type==='BADOC_OPEN_BRIDGE_INSTALLER')open(d.reason||'received');
  });
  document.getElementById('rcBridgeInstallFiles')?.addEventListener('click',downloadBridgeFiles);
  document.getElementById('rcBridgeOpenExtensions')?.addEventListener('click',openExtensions);
  document.getElementById('rcBridgeClose')?.addEventListener('click',closeAndRefresh);
  document.getElementById('rcBridgeCloseX')?.addEventListener('click',closeAndRefresh);
  modal?.addEventListener('click',e=>{if(e.target===modal)closeAndRefresh();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal?.classList.contains('is-open'))closeAndRefresh();});
})();
