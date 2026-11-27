(function () {
  const frame = document.getElementById('receivedCheckingFrame');
  const payloadNode = window.__BADOC_RECEIVED_CHECKING_B64 ? { textContent: window.__BADOC_RECEIVED_CHECKING_B64 } : null; // payload lives in js/100-received-checking-payload.js
  if (!frame || !payloadNode) return;
  try {
    const encoded = payloadNode.textContent.trim();
    const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
    const integrationSkin = `
      <style id="receivedCheckingIntegratedSkin">
        html, body { background:transparent!important; }
        body { margin:0!important; }
        header { position:relative!important; top:auto!important; z-index:1!important; background:transparent!important; border-bottom:1px solid var(--line)!important; padding:8px 10px!important; }
        header .brand { display:none!important; }
        header .actions { margin-left:auto!important; justify-content:flex-end!important; flex-wrap:wrap!important; }
        main { max-width:none!important; margin:0!important; padding:10px 10px 18px!important; }
        .sync { margin-top:0!important; }
        .secondary-panel { margin:8px 0!important; }
        html[data-badoc-host-theme="dark"] {
          --bg:transparent; --card:#101a22; --text:#e5edf4; --muted:#aebdc6;
          --line:#263744; --accent:#1683ff; --good:#22c55e; --warn:#f59e0b;
          --bad:#f87171; --shadow:0 6px 18px rgba(0,0,0,.18); color-scheme:dark;
        }
        html[data-badoc-host-theme="dark"] .syncbox,
        html[data-badoc-host-theme="dark"] .card,
        html[data-badoc-host-theme="dark"] .secondary-panel,
        html[data-badoc-host-theme="dark"] .tablewrap,
        html[data-badoc-host-theme="dark"] .filters input,
        html[data-badoc-host-theme="dark"] .multi-select,
        html[data-badoc-host-theme="dark"] .multi-select-menu,
        html[data-badoc-host-theme="dark"] .multi-select-btn,
        html[data-badoc-host-theme="dark"] .exemption-tools input {
          background:#0f1b24!important; border-color:#263744!important; color:#e5edf4!important;
        }
        html[data-badoc-host-theme="dark"] .secondary,
        html[data-badoc-host-theme="dark"] .exemption-tools button {
          background:#17232e!important; border-color:#304454!important; color:#e5edf4!important;
        }
        html[data-badoc-host-theme="dark"] .primary-notification,
        html[data-badoc-host-theme="dark"] .secondary-notification {
          background:#10243a!important; border-color:#24558a!important;
        }
        html[data-badoc-host-theme="dark"] #syncStatus,
        html[data-badoc-host-theme="dark"] #secondaryStatus {
          color:#bfdbfe!important;
        }
        html[data-badoc-host-theme="dark"] th { background:#101820!important; color:#d8e3e8!important; border-color:#263744!important; }
        html[data-badoc-host-theme="dark"] td { color:#e5edf4!important; border-color:#263744!important; }
        html[data-badoc-host-theme="dark"] .pill { background:#172b3d!important; color:#dbeafe!important; }
        html[data-badoc-host-theme="dark"] .empty,
        html[data-badoc-host-theme="dark"] .label,
        html[data-badoc-host-theme="dark"] .status,
        html[data-badoc-host-theme="dark"] .exemption-meta { color:#aebdc6!important; }
        html[data-badoc-host-theme="dark"] input::placeholder { color:#81919f!important; }
        @media(max-width:700px) { header { padding:7px 8px!important; } main { padding:8px 8px 14px!important; } }
      </style>`;
    let receivedHtml = new TextDecoder('utf-8').decode(bytes);
    const hostTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    receivedHtml = receivedHtml.replace('<html lang="en">', `<html lang="en" data-badoc-host-theme="${hostTheme}">`);
    receivedHtml = receivedHtml.replace('</head>', `${integrationSkin}
<style id="print-towns-a4-one-page-v182">
/* v182: Print Towns is optimized for a single A4 landscape sheet. App layout is unchanged. */
@media screen {
  #townPrintPreview .print-preview-paper {
    width:297mm !important; min-height:210mm !important; padding:4mm !important;
    box-sizing:border-box !important; margin:0 auto !important;
  }
  #townPrintPreview .print-section { margin:0 0 2mm !important; }
  #townPrintPreview .print-section h2 { font-size:9pt !important; margin:0 0 1mm !important; padding:0 0 .5mm !important; }
  #townPrintPreview .town-grid { grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:1mm !important; }
  #townPrintPreview .town-column { gap:1mm !important; }
  #townPrintPreview .town-card { padding:.8mm !important; border-radius:1px !important; }
  #townPrintPreview .town-card-header { min-height:0 !important; margin-bottom:.3mm !important; padding-bottom:.3mm !important; gap:1mm !important; }
  #townPrintPreview .print-rider { font-size:6pt !important; line-height:1 !important; }
  #townPrintPreview .town-card-total { font-size:6.5pt !important; min-width:7mm !important; padding:.2mm .6mm !important; }
  #townPrintPreview .town-row, #townPrintPreview .town, #townPrintPreview .count { font-size:5.8pt !important; line-height:1 !important; padding:.25mm 0 !important; }
}
@media print {
  @page { size:A4 landscape; margin:4mm; }
  html, body { margin:0 !important; padding:0 !important; }
  body > *:not(#townPrintArea) { display:none !important; }
  #townPrintArea {
    display:block !important; position:static !important; visibility:visible !important;
    width:289mm !important; max-width:289mm !important; margin:0 !important; padding:0 !important;
    box-sizing:border-box !important; overflow:visible !important;
  }
  #townPrintArea .print-date { font-size:6pt !important; line-height:1 !important; margin:0 0 1mm !important; }
  #townPrintArea .print-section {
    display:block !important; width:100% !important; margin:0 0 1.5mm !important; padding:0 !important;
    break-inside:avoid !important; page-break-inside:avoid !important; page-break-after:avoid !important;
  }
  #townPrintArea .print-section:last-child { margin-bottom:0 !important; }
  #townPrintArea .print-section h2 { font-size:8pt !important; line-height:1 !important; margin:0 0 .7mm !important; padding:0 0 .4mm !important; border-bottom:.5px solid #000 !important; }
  #townPrintArea .town-grid { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:1mm !important; align-items:start !important; }
  #townPrintArea .town-column { display:flex !important; flex-direction:column !important; gap:1mm !important; min-width:0 !important; }
  #townPrintArea .town-card { padding:.65mm !important; border-radius:1px !important; min-width:0 !important; break-inside:avoid !important; page-break-inside:avoid !important; box-shadow:none !important; }
  #townPrintArea .town-card-header { display:flex !important; align-items:center !important; justify-content:space-between !important; gap:1mm !important; min-height:0 !important; margin-bottom:.25mm !important; padding-bottom:.25mm !important; }
  #townPrintArea .print-rider { display:block !important; flex:1 1 auto !important; min-width:0 !important; color:#000 !important; font-size:5.8pt !important; line-height:1 !important; font-weight:700 !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
  #townPrintArea .town-card-total { flex:0 0 auto !important; font-size:6.2pt !important; line-height:1 !important; min-width:7mm !important; padding:.2mm .6mm !important; border: .5px solid #000 !important; border-radius:1px !important; }
  #townPrintArea .town-row { display:grid !important; grid-template-columns:minmax(0,1fr) auto !important; gap:2px !important; padding:.2mm 0 !important; font-size:5.8pt !important; line-height:1 !important; border-bottom:.3px solid #ddd !important; }
  #townPrintArea .town { font-size:5.8pt !important; line-height:1 !important; font-weight:600 !important; }
  #townPrintArea .count { font-size:5.8pt !important; line-height:1 !important; }
  #townPrintArea .town-card-note, #townPrintArea .town-rider-picker, #townPrintArea .town-drag-handle, #townPrintArea .empty-group { display:none !important; }
}
</style>
<style id="dashboard-visual-polish-and-card-equalization-v1">
/* Dashboard visual polish — presentation only; existing IDs, data and calculations are unchanged. */
#homeDashboard{
  display:block;
  padding:12px!important;
}
#homeDashboard .syncall,
#homeDashboard .dashboard-overview,
#homeDashboard #dashboardKpiSummary{
  border:1px solid var(--line,#263544)!important;
  border-radius:16px!important;
  box-shadow:0 8px 24px rgba(0,0,0,.08)!important;
  overflow:hidden;
}
#homeDashboard .syncall{
  margin:0 0 14px!important;
  background:linear-gradient(135deg,rgba(22,131,255,.09),var(--panel,#101820))!important;
}
#homeDashboard .dashboard-overview{
  margin:0 0 14px!important;
  padding:0!important;
  background:linear-gradient(145deg,var(--panel,#101820),var(--bg,#080d12))!important;
}
#homeDashboard .dashboard-overview-head{
  min-height:78px!important;
  padding:16px 20px!important;
  background:linear-gradient(110deg,rgba(22,131,255,.14),rgba(22,131,255,.025))!important;
  border-bottom:1px solid var(--line,#263544)!important;
}
#homeDashboard .dashboard-overview-kicker{
  display:inline-flex!important;
  align-items:center!important;
  gap:7px!important;
  color:var(--blue,#38a7ff)!important;
  font-size:9px!important;
  font-weight:900!important;
  letter-spacing:1.2px!important;
}
#homeDashboard .dashboard-overview-kicker:before{
  content:"";
  width:6px;height:6px;border-radius:50%;
  background:currentColor;
  box-shadow:0 0 0 4px rgba(56,167,255,.12);
}
#homeDashboard .dashboard-overview h2{
  margin:5px 0 0!important;
  color:var(--text,#f4f7fb)!important;
  font-size:20px!important;
  font-weight:850!important;
  letter-spacing:-.35px!important;
}
#homeDashboard .dashboard-summary-grid{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:12px!important;
  padding:16px 18px!important;
  align-items:stretch!important;
  border-bottom:1px solid var(--line,#263544)!important;
}
#homeDashboard .dashboard-summary-card,
#homeDashboard .dashboard-summary-card.volume,
#homeDashboard .dashboard-summary-card.dispatched,
#homeDashboard .dashboard-summary-card.clear,
#homeDashboard .dashboard-summary-card.incoming{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:center!important;
  gap:5px!important;
  width:100%!important;
  height:108px!important;
  min-height:108px!important;
  margin:0!important;
  padding:14px 16px!important;
  box-sizing:border-box!important;
  border:1px solid var(--line,#263544)!important;
  border-top:3px solid var(--blue,#38a7ff)!important;
  border-radius:12px!important;
  background:linear-gradient(145deg,rgba(56,167,255,.09),var(--panel,#101820))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
  transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important;
}
#homeDashboard .dashboard-summary-card.dispatched{
  border-top-color:#22c55e!important;
  background:linear-gradient(145deg,rgba(34,197,94,.09),var(--panel,#101820))!important;
}
#homeDashboard .dashboard-summary-card.incoming{
  border-top-color:#a78bfa!important;
  background:linear-gradient(145deg,rgba(167,139,250,.10),var(--panel,#101820))!important;
}
#homeDashboard .dashboard-summary-card strong{
  margin:0!important;
  color:var(--text,#f4f7fb)!important;
  font-size:clamp(27px,2.1vw,34px)!important;
  font-weight:900!important;
  line-height:1!important;
  letter-spacing:-.8px!important;
  font-variant-numeric:tabular-nums!important;
}
#homeDashboard .dashboard-summary-card.volume strong{color:#38bdf8!important}
#homeDashboard .dashboard-summary-card.dispatched strong{color:#4ade80!important}
#homeDashboard .dashboard-summary-card.incoming strong{color:#c4b5fd!important}
#homeDashboard .dashboard-summary-card span{
  display:block!important;
  margin:2px 0 0!important;
  color:var(--text,#e7edf4)!important;
  font-size:10px!important;
  font-weight:850!important;
  line-height:1.25!important;
  letter-spacing:.55px!important;
}
#homeDashboard .dashboard-summary-card small{
  display:block!important;
  min-height:11px!important;
  margin:0!important;
  color:var(--muted,#9ba9b7)!important;
  font-size:9px!important;
  line-height:1.2!important;
}
#homeDashboard .dashboard-summary-card:hover{
  transform:translateY(-2px);
  box-shadow:0 8px 18px rgba(0,0,0,.12)!important;
}
#homeDashboard .dashboard-status-section{
  padding:16px 18px 18px!important;
}
#homeDashboard .dashboard-card-groups{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:14px!important;
  align-items:stretch!important;
}
#homeDashboard .dashboard-card-group{
  min-width:0!important;
  padding:14px!important;
  border:1px solid var(--line,#263544)!important;
  border-radius:13px!important;
  background:linear-gradient(145deg,rgba(255,255,255,.025),var(--panel,#101820))!important;
  box-shadow:0 3px 12px rgba(0,0,0,.05)!important;
}
#homeDashboard .dashboard-card-group-head{
  min-height:35px!important;
  margin:0 0 12px!important;
  padding:0 0 10px!important;
  border-bottom:1px solid var(--line,#263544)!important;
}
#homeDashboard .dashboard-card-group-head strong{
  color:var(--text,#f4f7fb)!important;
  font-size:12px!important;
  font-weight:900!important;
  letter-spacing:.15px!important;
}
#homeDashboard .dashboard-card-group-head small{
  color:var(--muted,#9ba9b7)!important;
  font-size:9px!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-grid{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  grid-auto-rows:108px!important;
  gap:9px!important;
  align-items:stretch!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card{
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:center!important;
  gap:5px!important;
  width:100%!important;
  height:108px!important;
  min-height:108px!important;
  margin:0!important;
  padding:12px 11px!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
  border:1px solid var(--line,#263544)!important;
  border-top:3px solid var(--blue,#38a7ff)!important;
  border-radius:11px!important;
  background:linear-gradient(145deg,rgba(56,167,255,.07),var(--panel,#101820))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
  transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card strong{
  display:block!important;
  width:100%!important;
  margin:0!important;
  color:var(--text,#f4f7fb)!important;
  font-size:clamp(20px,1.55vw,26px)!important;
  font-weight:900!important;
  line-height:1!important;
  letter-spacing:-.5px!important;
  font-variant-numeric:tabular-nums!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card span{
  display:block!important;
  min-height:12px!important;
  margin:1px 0 0!important;
  color:var(--text,#e7edf4)!important;
  font-size:9px!important;
  font-weight:850!important;
  line-height:1.2!important;
  letter-spacing:.35px!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card small{
  display:block!important;
  min-height:10px!important;
  margin:0!important;
  color:var(--muted,#9ba9b7)!important;
  font-size:8px!important;
  line-height:1.2!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card:hover{
  transform:translateY(-2px);
  border-color:rgba(56,167,255,.48)!important;
  box-shadow:0 7px 16px rgba(0,0,0,.11)!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card.received{border-top-color:#22c55e!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.delivering{border-top-color:#38bdf8!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.delivered{border-top-color:#16a34a!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.onhold{border-top-color:#f59e0b!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.cfr1{border-top-color:#a78bfa!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.backlogs{border-top-color:#ef4444!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.redelivery{border-top-color:#f59e0b!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.rts{border-top-color:#f87171!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.exemptions{border-top-color:#a78bfa!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.received strong{color:#4ade80!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.delivering strong{color:#38bdf8!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.delivered strong{color:#4ade80!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.onhold strong{color:#fbbf24!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.cfr1 strong{
  display:block!important;
  text-align:left!important;
  color:#c4b5fd!important;
  font-size:clamp(20px,1.5vw,25px)!important;
  line-height:1!important;
}
#homeDashboard .dashboard-card-group .dashboard-status-card.backlogs strong{color:#f87171!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.redelivery strong{color:#fbbf24!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.rts strong{color:#fca5a5!important}
#homeDashboard .dashboard-card-group .dashboard-status-card.exemptions strong{color:#c4b5fd!important}
#homeDashboard #dashboardKpiSummary{
  margin:0 0 14px!important;
  padding:16px!important;
  background:linear-gradient(145deg,rgba(56,167,255,.06),var(--panel,#101820))!important;
}
#homeDashboard #dashboardKpiSummary .dashboard-kpi-title{
  color:var(--text,#f4f7fb)!important;
  font-size:15px!important;
  font-weight:900!important;
  letter-spacing:.2px!important;
}
@media(max-width:1250px){
  #homeDashboard .dashboard-card-groups{grid-template-columns:minmax(0,1fr)!important}
}
@media(max-width:900px){
  #homeDashboard .dashboard-summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  #homeDashboard .dashboard-summary-card,
  #homeDashboard .dashboard-summary-card.volume,
  #homeDashboard .dashboard-summary-card.dispatched,
  #homeDashboard .dashboard-summary-card.incoming{
    height:100px!important;min-height:100px!important;
  }
  #homeDashboard .dashboard-card-group .dashboard-status-grid{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    grid-auto-rows:100px!important;
  }
  #homeDashboard .dashboard-card-group .dashboard-status-card{
    height:100px!important;min-height:100px!important;
  }
}
@media(max-width:700px){
  #homeDashboard{padding:7px!important}
  #homeDashboard .dashboard-overview-head{padding:13px 14px!important}
  #homeDashboard .dashboard-summary-grid{
    grid-template-columns:1fr!important;
    gap:8px!important;padding:10px 12px!important;
  }
  #homeDashboard .dashboard-summary-card,
  #homeDashboard .dashboard-summary-card.volume,
  #homeDashboard .dashboard-summary-card.dispatched,
  #homeDashboard .dashboard-summary-card.incoming{
    height:94px!important;min-height:94px!important;padding:12px 14px!important;
  }
  #homeDashboard .dashboard-status-section{padding:11px 12px 13px!important}
  #homeDashboard .dashboard-card-group{padding:11px!important}
  #homeDashboard .dashboard-card-group .dashboard-status-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-rows:94px!important;gap:8px!important;
  }
  #homeDashboard .dashboard-card-group .dashboard-status-card{
    height:94px!important;min-height:94px!important;padding:10px!important;
  }
  #homeDashboard .dashboard-card-group .dashboard-status-card strong{font-size:22px!important}
  #homeDashboard .dashboard-card-group .dashboard-status-card.cfr1 strong{font-size:21px!important}
}
@media(max-width:380px){
  #homeDashboard .dashboard-summary-card strong{font-size:25px!important}
  #homeDashboard .dashboard-card-group .dashboard-status-card{padding:8px!important}
  #homeDashboard .dashboard-card-group .dashboard-status-card strong{font-size:20px!important}
}
html[data-theme="light"] #homeDashboard .syncall,
html[data-theme="light"] #homeDashboard .dashboard-overview,
html[data-theme="light"] #homeDashboard #dashboardKpiSummary{
  border-color:#dce4ec!important;
  box-shadow:0 6px 20px rgba(16,24,40,.055)!important;
}
html[data-theme="light"] #homeDashboard .dashboard-overview{
  background:linear-gradient(145deg,#ffffff,#f8fbff)!important;
}
html[data-theme="light"] #homeDashboard .dashboard-overview-head{
  background:linear-gradient(110deg,#edf6ff,#f8fbff)!important;
  border-bottom-color:#dce4ec!important;
}
html[data-theme="light"] #homeDashboard .dashboard-overview h2,
html[data-theme="light"] #homeDashboard .dashboard-card-group-head strong,
html[data-theme="light"] #homeDashboard .dashboard-summary-card span,
html[data-theme="light"] #homeDashboard .dashboard-card-group .dashboard-status-card span{
  color:#172b3d!important;
}
html[data-theme="light"] #homeDashboard .dashboard-summary-card,
html[data-theme="light"] #homeDashboard .dashboard-card-group .dashboard-status-card{
  background:linear-gradient(145deg,#ffffff,#f6f9fc)!important;
  border-color:#dce4ec!important;
  box-shadow:0 2px 6px rgba(16,24,40,.035)!important;
}
html[data-theme="light"] #homeDashboard .dashboard-card-group{
  background:linear-gradient(145deg,#ffffff,#f8fafc)!important;
  border-color:#dce4ec!important;
  box-shadow:0 3px 12px rgba(16,24,40,.035)!important;
}
html[data-theme="light"] #homeDashboard .dashboard-card-group-head{border-bottom-color:#e6ebf1!important}
html[data-theme="light"] #homeDashboard .dashboard-summary-card strong,
html[data-theme="light"] #homeDashboard .dashboard-card-group .dashboard-status-card strong{
  filter:saturate(.9);
}
html[data-theme="light"] #homeDashboard .dashboard-card-group .dashboard-status-card small,
html[data-theme="light"] #homeDashboard .dashboard-summary-card small{
  color:#69798a!important;
}
</style>
</head>`);
    frame.addEventListener('load', syncReceivedCheckingTheme);
    frame.srcdoc = receivedHtml;
    function syncReceivedCheckingTheme() {
      try {
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        frame.contentDocument?.documentElement?.setAttribute('data-badoc-host-theme', theme);
      } catch (_) {}
    }
    const themeObserver = new MutationObserver(syncReceivedCheckingTheme);
    themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  } catch (err) {
    frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font:14px Arial;padding:24px;color:#b91c1c">Dispatch could not load. Refresh the app and try again.<br></body>';
    console.error('Dispatch embedded page failed to initialize:', err);
  }
})();
