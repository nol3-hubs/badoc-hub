(function(){
  const SOURCE="BADOC_PAGE", BRIDGE_SOURCE="BADOC_SPX_BRIDGE";
  let nextId=1, bridgeReady=false, readyWaiters=[], pending=new Map();
  window.addEventListener("message",event=>{
    if(event.source!==window)return;
    const data=event.data||{};
    if(data.source!==BRIDGE_SOURCE)return;
    if(data.type==="BADOC_BRIDGE_READY"){
      bridgeReady=true;readyWaiters.splice(0).forEach(resolve=>resolve(true));return;
    }
    if(data.type==="BADOC_BRIDGE_DISCONNECTED"){
      bridgeReady=false;return;
    }
    if(data.type==="BADOC_POD_RPC_RESULT"){
      const entry=pending.get(String(data.rpcId||""));
      if(!entry)return;
      pending.delete(String(data.rpcId));clearTimeout(entry.timer);
      if(data.ok)entry.resolve(data.result);
      else entry.reject(new Error(data.error||"Badoc Hub Extension request failed."));
    }
  });
  function waitForBridge(timeout=12000){
    if(bridgeReady)return Promise.resolve(true);
    return new Promise(resolve=>{
      let done=false, retryTimer=null;
      const finish=value=>{
        if(done)return;
        done=true;
        clearTimeout(timer);
        if(retryTimer)clearTimeout(retryTimer);
        readyWaiters=readyWaiters.filter(fn=>fn!==onReady);
        resolve(!!value);
      };
      const onReady=()=>finish(true);
      const sendHello=()=>{
        if(done||bridgeReady){finish(true);return;}
        window.postMessage({source:SOURCE,type:"BADOC_BRIDGE_HELLO",version:"1"},"*");
        retryTimer=setTimeout(sendHello,350);
      };
      const timer=setTimeout(()=>finish(bridgeReady),timeout);
      readyWaiters.push(onReady);
      sendHello();
    });
  }
  async function rpc(method,args=[],timeout=20000){
    if(!await waitForBridge())throw new Error("Badoc Hub Extension v"+requiredPackageVersion+" is required but is not connected. Install or reload the extension, then refresh Badoc Hub.");
    const rpcId=`pod-${Date.now()}-${nextId++}`;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(rpcId);reject(new Error("The extension did not respond. Reload Badoc Hub Extension in chrome://extensions and refresh this page."));},timeout);
      pending.set(rpcId,{resolve,reject,timer});
      window.postMessage({source:SOURCE,type:"BADOC_POD_RPC",rpcId,method,args},"*");
    });
  }
  window.podChrome={
    tabs:{query:query=>rpc("tabs.query",[query||{}],15000),sendMessage:(tabId,message)=>rpc("tabs.sendMessage",[tabId,message||{}],65000)},
    storage:{local:{get:keys=>rpc("storage.local.get",[keys],15000),set:items=>rpc("storage.local.set",[items||{}],15000),remove:keys=>rpc("storage.local.remove",[keys],15000)}},
    runtime:{sendMessage:message=>rpc("runtime.sendMessage",[message||{}],message?.action==="OPEN_SPX_PORTAL"?120000:message?.action==="EXPORT_ASSIGNED_PARCELS_TODAY"?55*60*1000:30000)},
    scripting:{executeScript:options=>rpc("scripting.discoverWorksheetGids",[options?.target?.tabId],30000).then(result=>[{result}])}
  };
})();
