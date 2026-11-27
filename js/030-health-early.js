/* SYNC HEALTH (collector): remembers recent warnings/errors and Google request results. Read-only; never changes app behaviour. */
(function(){
  "use strict";
  if(window.__badocHealth)return;
  var H=window.__badocHealth={issues:[],fetches:{},seen:{}};
  function add(kind,msg){
    msg=String(msg||"").replace(/\s+/g," ").trim().slice(0,240); if(!msg)return;
    var key=kind+"|"+msg,i=H.issues.find(function(x){return x.key===key});
    if(i){i.n++;i.at=Date.now()}else{H.issues.unshift({key:key,kind:kind,msg:msg,n:1,at:Date.now()});if(H.issues.length>40)H.issues.pop()}
  }
  H.add=add;
  ["warn","error"].forEach(function(k){
    var o=console[k];
    console[k]=function(){
      try{add(k,[].map.call(arguments,function(a){return a&&a.message?a.message:(a&&typeof a==="object"?"":String(a))}).join(" "))}catch(e){}
      return o.apply(this,arguments);
    };
  });
  window.addEventListener("error",function(e){add("error",e.message||"Script error")});
  window.addEventListener("unhandledrejection",function(e){add("error","Unhandled: "+(e.reason&&e.reason.message||e.reason))});
  var of=window.fetch;
  if(of)window.fetch=function(input){
    var u=""; try{u=String(input&&input.url||input)}catch(e){}
    var p=of.apply(this,arguments);
    if(/google\.com/.test(u)){
      var tag=(u.match(/\/d\/(?:e\/)?([A-Za-z0-9_-]{6})/)||u.match(/\/s\/([A-Za-z0-9_-]{6})/)||[0,u.slice(8,20)])[1];
      p.then(function(r){H.fetches[tag]={ok:r.ok,status:r.status,at:Date.now()}},function(e){H.fetches[tag]={ok:false,err:String(e&&e.message||e),at:Date.now()}});
    }
    return p;
  };
})();
