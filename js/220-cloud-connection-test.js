(function(){
  async function runCloudTest(){
    const btn=document.getElementById("cloudTestBtn"),out=document.getElementById("cloudTestResult");
    if(btn)btn.disabled=true;
    if(out)out.textContent="Testing…";
    try{
      const cfg=window.BADOC_SHARED_CONFIG||{};
      if(!window.BadocCloud)throw Error("Cloud library is not loaded");
      if(!cfg.url)throw Error("Cloud database URL is missing");
      if(!cfg.key)throw Error("Cloud key is missing");

      const c=window.BadocCloud.createClient(cfg.url,cfg.key,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      const bucket="exported-files";

      const listed=await c.storage.from(bucket).list("current",{limit:10});
      if(listed.error)throw Error("Bucket access: "+(listed.error.message||listed.error));

      const path="current/.cloud-connection-test.txt";
      const body=new Blob(["BADOC cloud connection test "+Date.now()],{type:"text/plain"});

      const up=await c.storage.from(bucket).upload(path,body,{
        contentType:"text/plain",upsert:true,cacheControl:"0"
      });
      if(up.error)throw Error("Upload permission: "+(up.error.message||up.error));

      const dl=await c.storage.from(bucket).download(path);
      if(dl.error)throw Error("Download permission: "+(dl.error.message||dl.error));

      const rm=await c.storage.from(bucket).remove([path]);
      if(rm.error)throw Error("Delete permission: "+(rm.error.message||rm.error));

      const ch=c.channel("badoc-cloud-test-"+Date.now());
      let rt="timeout";
      await new Promise(resolve=>{
        let done=false;
        const finish=v=>{if(done)return;done=true;rt=v;resolve()};
        const timer=setTimeout(()=>finish("timeout"),3500);
        ch.subscribe(s=>{
          if(s==="SUBSCRIBED"){clearTimeout(timer);finish("OK")}
          else if(s==="CHANNEL_ERROR"){clearTimeout(timer);finish("channel error")}
          else if(s==="TIMED_OUT"){clearTimeout(timer);finish("timeout")}
        });
      });
      try{await c.removeChannel(ch)}catch{}

      if(out)out.textContent="CONNECTED ✓  Bucket ✓  Upload ✓  Download ✓  Delete ✓  Realtime: "+rt;
    }catch(e){
      console.error("Cloud test failed:",e);
      if(out)out.textContent="FAILED ✕  "+(e?.message||String(e));
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  function bind(){
    document.getElementById("cloudTestBtn")?.addEventListener("click",runCloudTest);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
