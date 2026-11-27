/* Lazy loader for the embedded Chrome-extension file map (js/bridge-files.js, ~550 KB of base64).
   Only the Bridge Installer needs it, so it is fetched on demand instead of with every page load.
   The packaging workflow (tools/sync_bridge.py) regenerates js/bridge-files.js from /extension. */
(function(){
  var pending=null;
  function fileUrl(){
    var m=document.querySelector('meta[name="badoc-bridge-files"]');
    return (m&&m.content)||'js/bridge-files.js';
  }
  window.badocEnsureBridgeFiles=function(){
    if(window.BADOC_BRIDGE_FILES)return Promise.resolve(window.BADOC_BRIDGE_FILES);
    if(pending)return pending;
    pending=new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=fileUrl();
      s.onload=function(){
        if(window.BADOC_BRIDGE_FILES)resolve(window.BADOC_BRIDGE_FILES);
        else{pending=null;reject(new Error('Extension files are missing from this dashboard build.'));}
      };
      s.onerror=function(){pending=null;s.remove();reject(new Error('Could not load the extension files. Check your connection and try again.'));};
      document.head.appendChild(s);
    });
    return pending;
  };
})();
