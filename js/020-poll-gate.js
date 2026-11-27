/* Pause non-critical polling timers in background tabs; run one catch-up check on return. */
(function(){
  if(window.__badocEvery)return;
  var jobs=Object.create(null),nextId=0,hiddenAt=document.hidden?Date.now():0;
  var nativeSetTimeout=window.setTimeout.bind(window);
  var nativeClearTimeout=window.clearTimeout.bind(window);
  var nativeClearInterval=window.clearInterval.bind(window);
  function invoke(job){
    try{var result=job.fn();if(result&&typeof result.then==="function")result.catch(function(){});}
    catch(error){try{console.warn("Background poll failed:",error);}catch(_){}}
  }
  function schedule(job,delay){
    if(job.cancelled||document.hidden||job.timer!==null)return;
    job.dueAt=Date.now()+Math.max(0,delay);
    job.timer=nativeSetTimeout(function(){
      job.timer=null;
      if(job.cancelled||document.hidden)return;
      schedule(job,job.ms);
      invoke(job);
    },Math.max(0,delay));
  }
  // Negative virtual IDs let the existing clearInterval callers stop these
  // timers while native interval handles retain their normal behavior.
  window.clearInterval=function(id){
    var job=jobs[String(id)];
    if(job){
      job.cancelled=true;
      if(job.timer!==null)nativeClearTimeout(job.timer);
      delete jobs[String(id)];
      return;
    }
    return nativeClearInterval(id);
  };
  window.__badocEvery=function(fn,ms){
    var interval=Math.max(100,Number(ms)||1000),id=String(--nextId);
    var job={fn:fn,ms:interval,timer:null,dueAt:Date.now()+interval,cancelled:false};
    jobs[id]=job;
    schedule(job,interval);
    return Number(id);
  };
  document.addEventListener("visibilitychange",function(){
    if(document.hidden){
      hiddenAt=Date.now();
      Object.keys(jobs).forEach(function(id){
        var job=jobs[id];
        if(job&&job.timer!==null){nativeClearTimeout(job.timer);job.timer=null;}
      });
      return;
    }
    var away=hiddenAt?Date.now()-hiddenAt:0,k=0;
    Object.keys(jobs).forEach(function(id){
      var job=jobs[id];if(!job||job.cancelled||job.timer!==null)return;
      if(away>=job.ms){
        job.timer=nativeSetTimeout(function(){
          job.timer=null;if(job.cancelled||document.hidden)return;
          schedule(job,job.ms);invoke(job);
        },150*(k++));
      }else schedule(job,Math.max(0,job.dueAt-Date.now()));
    });
    hiddenAt=0;
  });
})();
