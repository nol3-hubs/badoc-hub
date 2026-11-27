/* BADOC TIME — one clock for the whole hub: Philippine time (Asia/Manila), corrected by the cloud server clock.
   manilaDate() returns a Date whose local getters (getHours, getDate, ...) read Manila wall-clock values,
   so existing code that compares against parcel timestamps keeps working on any device or timezone. */
(function(){
  "use strict";
  if(window.__badocTime)return;
  var fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  var offset=0;
  function parts(ms){var o={};fmt.formatToParts(new Date(ms)).forEach(function(p){if(p.type!=="literal")o[p.type]=+p.value});return o}
  function base(ms){return ms==null?Date.now()+offset:Number(ms)}
  window.__badocTime={
    setOffset:function(v){v=Number(v);if(isFinite(v))offset=v},
    offset:function(){return offset},
    nowMs:function(){return Date.now()+offset},
    manilaDate:function(ms){var p=parts(base(ms));return new Date(p.year,p.month-1,p.day,p.hour%24,p.minute,p.second)},
    dayKey:function(ms){var p=parts(base(ms));return p.year+"-"+String(p.month).padStart(2,"0")+"-"+String(p.day).padStart(2,"0")}
  };
})();
