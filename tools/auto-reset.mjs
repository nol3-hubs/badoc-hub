// Badoc Hub — GitHub-only cloud refresh, Daily History capture, and guarded 2 AM reset.
// GitHub Actions has no authenticated SPX tab or local Chrome extension, so it cannot run SPX Sync All.
// It refreshes only parcel/linehaul files that have already been uploaded to the shared cloud.
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL;
const EVENT = process.env.GITHUB_EVENT_NAME || 'workflow_dispatch';
const IS_SCHEDULED = EVENT === 'schedule';
const POLL_MS = Number(process.env.POLL_MS || 5000);
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 45 * 60 * 1000);

if (!APP_URL) throw new Error('APP_URL is missing. Set it under Settings → Secrets and variables → Actions → Variables.');

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function manilaNow() {
  const now = new Date();
  const p = {};
  timeFmt.formatToParts(now).forEach(x => { if (x.type !== 'literal') p[x.type] = Number(x.value); });
  return { date: dateFmt.format(now), hour: p.hour, minute: p.minute, second: p.second };
}
function addDays(key, amount) {
  const a = key.split('-').map(Number);
  const d = new Date(Date.UTC(a[0], a[1] - 1, a[2] + amount));
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')].join('-');
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const startedAt = manilaNow();
console.log('Manila time: ' + startedAt.date + ' ' + startedAt.hour + ':' + startedAt.minute + ':' + startedAt.second);
if (IS_SCHEDULED && startedAt.hour >= 2) {
  console.log('SAFE SKIP: scheduled run started at/after 2 AM Manila. Nothing was opened or changed.');
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ timezoneId: 'Asia/Manila', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('console', msg => {
  if (msg.type() === 'warning' || msg.type() === 'error') console.log('[app]', msg.text().slice(0, 300));
});
page.on('pageerror', error => console.log('[pageerror]', error.message));

try {
  // Hold the dashboard's own reset timer until this job explicitly releases it.
  await page.addInitScript(() => { window.__BADOC_GITHUB_AUTOMATION_HOLD_RESET = true; });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForFunction(() =>
    typeof window.__badocSharedPullNow === 'function' &&
    typeof window.__badocCaptureDailyHistory === 'function' &&
    typeof window.__badocRunDailyReset === 'function' &&
    !!window.BadocCloud,
    null, { timeout: 60000 }
  );

  const today = manilaNow().date;
  const markerDate = await page.evaluate(async () => {
    const cfg = window.BADOC_SHARED_CONFIG || {};
    if (!cfg.url || !cfg.key) throw new Error('Shared cloud configuration is incomplete.');
    const client = window.BadocCloud.createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const result = await client.storage.from('exported-files').download('current/.badoc-daily-reset.json');
    if (result.error) {
      if (/not found|404|object not found/i.test(result.error.message || '')) return null;
      throw new Error('Could not read shared reset marker: ' + (result.error.message || 'unknown cloud error'));
    }
    const saved = JSON.parse(await result.data.text());
    return String(saved && saved.date || '') || null;
  });

  if (markerDate === today) {
    console.log('Already reset for ' + today + '; leaving data untouched.');
    process.exit(0);
  }

  const waitForParcelData = async timeout => page.waitForFunction(() => {
    try {
      const count = (Array.isArray(current && current.valid) ? current.valid.length : 0) +
        (Array.isArray(current && current.mis) ? current.mis.length : 0);
      return count > 0;
    } catch (_) { return false; }
  }, null, { timeout });

  console.log('Refreshing data already saved in the shared cloud. This does not import fresh SPX data.');
  await page.evaluate(async () => { await window.__badocSharedPullNow(); });
  await waitForParcelData(90000);
  await page.waitForFunction(() => {
    const e = window.__badocEodDashboard;
    return !!(e && Number(e.updatedAt) > 0 && e.date && Object.keys(e).length > 3);
  }, null, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__badocCfr1Details, null, { timeout: 60000 });

  const firstStats = await page.evaluate(() => ({
    valid: Array.isArray(current && current.valid) ? current.valid.length : 0,
    misrouted: Array.isArray(current && current.mis) ? current.mis.length : 0,
    batches: Array.isArray(batches) ? batches.length : 0
  }));
  console.log('Initial shared-cloud preflight passed: ' + JSON.stringify(firstStats));

  if (!IS_SCHEDULED) {
    console.log('MANUAL PREFLIGHT ONLY: cloud data and EOD data are available. No snapshot, export, or reset was performed.');
    process.exit(0);
  }

  if (manilaNow().hour >= 2) throw new Error('SAFE STOP: cloud preflight finished at/after 2 AM Manila.');

  // Wait to refresh and capture near the reset boundary, avoiding a snapshot from 30 minutes earlier.
  console.log('Holding reset until 1:58 AM Manila for final cloud and EOD refresh.');
  const waitStarted = Date.now();
  while (true) {
    const t = manilaNow();
    if (t.hour > 1 || (t.hour === 1 && t.minute >= 58)) break;
    if (Date.now() - waitStarted > WAIT_TIMEOUT_MS) throw new Error('Timed out before final refresh. Reset was not released.');
    await sleep(POLL_MS);
  }
  if (manilaNow().hour >= 2) throw new Error('SAFE STOP: missed the 1:58 AM refresh window.');

  await page.evaluate(async () => { await window.__badocSharedPullNow(); });
  await waitForParcelData(60000);

  const oldEodUpdate = await page.evaluate(() => Number(window.__badocEodDashboard && window.__badocEodDashboard.updatedAt || 0));
  const eodRefresh = page.locator('#eodRefreshBtn');
  if (!(await eodRefresh.count())) throw new Error('EOD refresh button is missing; refusing to save an unrefreshed EOD snapshot.');
  await eodRefresh.click();
  await page.waitForFunction(previous => {
    const e = window.__badocEodDashboard;
    return !!(e && Number(e.updatedAt) > previous && e.date && Object.keys(e).length > 3);
  }, oldEodUpdate, { timeout: 30000 });
  await page.waitForFunction(() => !!window.__badocCfr1Details, null, { timeout: 30000 });

  const finalStats = await page.evaluate(() => ({
    valid: Array.isArray(current && current.valid) ? current.valid.length : 0,
    misrouted: Array.isArray(current && current.mis) ? current.mis.length : 0,
    cfr1: Number(window.__badocCfr1Details && window.__badocCfr1Details.totalCount || 0),
    eodUpdatedAt: Number(window.__badocEodDashboard && window.__badocEodDashboard.updatedAt || 0)
  }));
  console.log('Final pre-capture refresh passed: ' + JSON.stringify(finalStats));
  if (manilaNow().hour >= 2) throw new Error('SAFE STOP: final refresh completed at/after 2 AM Manila.');

  const operationalDate = addDays(manilaNow().date, -1);
  console.log('Saving Daily History for ' + operationalDate + '.');
  const snapshot = await page.evaluate(async date => {
    const saved = await window.__badocCaptureDailyHistory('github-cloud-automation', date);
    const verify = await window.__badocLoadDailyHistorySnapshot(date);
    if (!verify || verify.date !== date) throw new Error('Daily History verification failed.');
    return { date: saved.date, verified: true };
  }, operationalDate);
  console.log('Daily History verified: ' + JSON.stringify(snapshot));

  const cfr = await page.evaluate(async date => {
    if (typeof window.__badocCaptureCfrSummary !== 'function') throw new Error('CFR summary function is unavailable.');
    const saved = await window.__badocCaptureCfrSummary(date);
    if (!saved || saved.date !== date) throw new Error('CFR summary verification failed.');
    return { date: saved.date, saved: true };
  }, operationalDate);
  console.log('CFR summary saved: ' + JSON.stringify(cfr));

  const cfr1 = await page.evaluate(async () => {
    const d = window.__badocCfr1Details || {};
    const count = (Array.isArray(d.scanned) ? d.scanned.length : 0) + (Array.isArray(d.unscanned) ? d.unscanned.length : 0);
    if (!count) return { skipped: true, count: 0, reason: 'No CFR1 rows to export.' };
    if (typeof window.__badocExportCfr1ToSheet !== 'function') throw new Error('CFR1 export function is unavailable.');
    const result = await window.__badocExportCfr1ToSheet();
    if (!result || !result.submitted) throw new Error('CFR1 export form was not submitted.');
    return { submitted: true, count: Number(result.count) || count, confirmation: 'form submission only; remote Google Sheet write is not independently verifiable' };
  });
  console.log('CFR1 export: ' + JSON.stringify(cfr1));

  console.log('Captures succeeded. Waiting until 2 AM Manila before releasing reset.');
  const captureWaitStarted = Date.now();
  while (manilaNow().hour < 2) {
    if (Date.now() - captureWaitStarted > 5 * 60 * 1000) throw new Error('Timed out at 2 AM boundary. Reset was not released.');
    await sleep(POLL_MS);
  }

  await page.evaluate(() => {
    window.__BADOC_GITHUB_AUTOMATION_HOLD_RESET = false;
    if (typeof window.__badocRunDailyReset !== 'function') throw new Error('Guarded reset entry point is unavailable.');
    window.__badocRunDailyReset();
  });

  await page.waitForFunction(date => {
    try {
      const status = JSON.parse(localStorage.getItem('badoc_reset_status') || 'null');
      return status && status.date === date && status.state === 'done';
    } catch (_) { return false; }
  }, today, { timeout: 8 * 60 * 1000, polling: POLL_MS });
  console.log('Daily History, CFR summary, and guarded 2 AM reset completed for ' + today + '.');
} catch (error) {
  console.error('GitHub-only automation stopped safely: ' + (error && (error.stack || error)));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
