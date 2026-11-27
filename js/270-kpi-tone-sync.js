(function(){
  function applyTone(value, card, prefix, toneMap){
    if(!card)return;
    var tones=["red","orange","green"];
    tones.forEach(function(t){card.classList.remove(prefix+"-"+t);});
    var tone=toneMap(value);
    if(tone)card.classList.add(prefix+"-"+tone);
  }

  function scoreTone(value){
    var raw=String(value==null?"":value).replace(/,/g,"");
    var match=raw.match(/-?\d+(?:\.\d+)?/);
    if(!match)return "";
    var score=Number(match[0]);
    if(!Number.isFinite(score))return "";
    if(score<90)return "red";
    if(score<95)return "orange";
    return "green";
  }

  function updateDashboardKpiSummary(){
    var score=document.getElementById("sheetScore");
    var grade=document.getElementById("kpiGrade");
    var dScore=document.getElementById("dashboardOverallScore");
    var dGrade=document.getElementById("dashboardKpiGrade");

    var scoreValue=score&&score.textContent?score.textContent.trim():"";
    var gradeValue=grade&&grade.textContent?grade.textContent.trim():"";

    if(dScore)dScore.textContent=scoreValue||"—";
    if(dGrade)dGrade.textContent=gradeValue||"—";

    var scoreCard=dScore&&dScore.closest(".dashboard-kpi-card");
    var gradeCard=dGrade&&dGrade.closest(".dashboard-kpi-card");

    /* Both cards use the Overall Score threshold, so Grade has no independent color logic. */
    applyTone(scoreValue,scoreCard,"kpi-score",scoreTone);
    if(gradeCard){
      ["red","orange","green"].forEach(function(t){gradeCard.classList.remove("kpi-grade-"+t);});
      applyTone(scoreValue,gradeCard,"kpi-score",scoreTone);
    }
  }

  window.__badocSyncDashboardKpiTone=updateDashboardKpiSummary;
  window.addEventListener("badoc-kpi-data-ready",updateDashboardKpiSummary);
  updateDashboardKpiSummary();
  if(typeof __badocEvery==="function")__badocEvery(updateDashboardKpiSummary,5000);
  else setInterval(updateDashboardKpiSummary,5000);
})();
