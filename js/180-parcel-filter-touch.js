(function(){
  var ids=["recordTown","recordStation","recordStatus"];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    if(!el)continue;
    el.style.maxWidth="100%";
    el.addEventListener("touchstart",function(){
      this.style.touchAction="manipulation";
    },{passive:true});
  }
})();
