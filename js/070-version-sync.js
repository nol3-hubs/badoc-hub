(function(){
 function syncVersion(){
  var m=document.querySelector('meta[name="badoc-app-version"]'),v=m?String(m.content||"").trim():"";
  if(!v)return;
  var top=document.getElementById("appVersionBadge");if(top)top.textContent="APP "+v;
  var setting=document.querySelector(".app-version-setting b");if(setting)setting.textContent=v;
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncVersion,{once:true});else syncVersion();
})();
