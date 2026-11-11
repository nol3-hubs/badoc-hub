// Badoc Hub — GitHub-only cloud refresh, Daily History capture, and guarded 2 AM reset.
// This intentionally does NOT run SPX Sync All: GitHub Actions has no authenticated SPX tab
// or local Chrome extension. It refreshes only data already saved in the shared cloud.
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL;
const EVENT = process.env.GITHUB_EVENT_NAME || 'workflow_dispatch';
const IS_SCHEDULED = EVENT === 'schedule';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 35 * 60 * 1000);
const POLL_MS = Number(process.env.POLL_MS || 5000);

if (!APP_URL) {
  throw new Error('APP_URL is not set. Add it under GitHub → Settings → Secrets and variables → Actions → Variables.');
}

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
});
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function manilaParts() {
  const now = new Date();
  const d = fmt.format(now);
  const t = Object.fromEntries(partsFmt.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { date: d, hour: t.hour, minute: t.minute, second: t.second };
}
function addDays(dateKey, amount) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + amount));
  return [dt.getUTCFullYear(), String(dt.getUTCMonth() + 1).padStart(2, '0'), String(dt.getUTCDate()).padStart(2, '0')].join('-');
}
const initial = manilaParts();
console.log('Manila time: ' + initial.date + ' ' + String(initial.hour).padStart(2, '0') + ':' + String(initial.minute).padStart(2, '0') + ':' + String(initial.second).padStart(2, '0'));

// Scheduled jobs must arrive before 2 AM so cloud data can be checked before the reset window.
// A late scheduled start is skipped rather than opening the app and risking an unprepared reset.
if (IS_SCHEDULED && initial.hour >= 2) {
  console.log('SAFE SKIP: Scheduled job started at/after 2:00 AM Manila. No page opened and no data was changed.');
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  timezoneId: 'Asia/Manila',
  viewport: { width: 1440, height: 1000 }
});
const page = await context.newPage();
page.on('console', msg => {
  if (msg.type() === 'warning' || msg.type() === 'error') console.log('[app]', msg.text().slice(0, 300));
});
page.on('pageerror', error => console.log('[pageerror]', error.message));

let resetInvoked = false;
try {
  // Hold the app's own 2 AM timer until the automation explicitly releases it.
  await page.addInitScript(() => { window.__BADOC_GITHUB_AUTOMATION_HOLD_RESET = true; });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForFunction(() =>
    typeof window.__badocSharedPullNow === 'function' &&
    typeof window.__badocCaptureDailyHistory === 'function' &&
    typeof window.__badocRunDailyReset === 'function' &&
    !!window.BadocCloud,
    null,
    { timeout: 60000 }
  );

  const today = manilaParts().date;
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
    const payload = JSON.parse(await result.data.text());
    return String(payload?.date || '') || null;
  });

  if (markerDate === today) {
    console.log('Already reset for ' + today + ' according to shared cloud marker. Leaving data untouched.');
    await browser.close();
    process.exit(0);
  }

  console.log('Refreshing data already stored in shared cloud (not importing from SPX).');
  await page.evaluate(async () => { await window.__badocSharedPullNow(); });
  await page.waitForFunction(() => {
    try {
      const count = (Array.isArray(current?.valid) ? current.valid.length : 0) +
        (Array.isArray(current?.mis) ? current.mis.length : 0);
      return count > 0;
    } catch (_) { return false; }
  }, null, { timeout: 90000 });

  const dataStats = await page.evaluate(() => ({
    valid: Array.isArray(current?.valid) ? current.valid.length : 0,
    misrouted: Array.isArray(current?.mis) ? current.mis.length : 0,
    batches: Array.isArray(batches) ? batches.length : 0,
    cloudStatus: document.getElementById('sharedStatus')?.textContent?.trim() || 'unknown'
  }));
  console.log('Shared cloud data loaded: ' + JSON.stringify(dataStats));

  await page.waitForFunction(() => {
    const e = window.__badocEodDashboard;
    return !!(e && Number(e.updatedAt) > 0 && e.date && Object.keys(e).length > 3);
  }, null, { timeout: 60000 });

  await page.waitForFunction(() => !!window.__badocCfr1Details, null, { timeout: 60000 });
  const operationalDate = addDays(today, -1);

  // Manual workflow_dispatch is a harmless preflight only; it never saves or resets.
  if (!IS_SCHEDULED) {
    console.log('PREFLIGHT OK: shared cloud data is loaded and EOD/CFR1 data is ready. Operational date would be ' + operationalDate + '. No snapshot or reset was run.');
    await browser.close();
    process.exit(0);
  }

  // A scheduled run must start before 2 AM. If a long startup delayed us past 2 AM,
  // fail closed rather than saving potentially stale data or triggering reset.
  const nowAfterLoad = manilaParts();
  if (nowAfterLoad.hour >= 2) {
    throw new Error('SAFE STOP: page/cloud preflight completed at/after 2:00 AM Manila. Reset was not released.');
  }

  console.log('Saving Daily History snapshot for operational date ' + operationalDate + '.');
  const snapshotResult = await page.evaluate(async date => {
    const snapshot = await window.__badocCaptureDailyHistory('github-cloud-automation', date);
    const verify = await window.__badocLoadDailyHistorySnapshot(date);
    if (!verify || verify.date !== date) throw new Error('Daily History snapshot verification failed.');
    return { date: snapshot.date, verified: verify.date === date };
  }, operationalDate);
  console.log('Daily History saved and verified: ' + JSON.stringify(snapshotResult));

  const cfrResult = await page.evaluate(async date => {
    if (typeof window.__badocCaptureCfrSummary !== 'function') throw new Error('CFR daily summary function is unavailable.');
    const saved = await window.__badocCaptureCfrSummary(date);
    if (!saved || saved.date !== date) throw new Error('CFR daily summary verification failed.');
    return { date: saved.date, saved: true };
  }, operationalDate);
  console.log('CFR daily summary saved: ' + JSON.stringify(cfrResult));

  const cfr1Result = await page.evaluate(async () => {
    const details = window.__badocCfr1Details || {};
    const count = (Array.isArray(details.scanned) ? details.scanned.length : 0) +
      (Array.isArray(details.unscanned) ? details.unscanned.length : 0);
    if (!count) return { skipped: true, count: 0, reason: 'No CFR1 rows to export.' };
    if (typeof window.__badocExportCfr1ToSheet !== 'function') throw new Error('CFR1 export function is unavailable.');
    const result = await window.__badocExportCfr1ToSheet();
    if (!result?.submitted) throw new Error('CFR1 export form was not submitted.');
    return { submitted: true, count: Number(result.count) || count, confirmation: 'submission only; remote sheet write is not independently verifiable by the page' };
  });
  console.log('CFR1 export: ' + JSON.stringify(cfr1Result));

  // Wait for the app's Manila 2 AM boundary, while its reset timer remains held.
  console.log('Captures complete. Waiting for 2:00 AM Manila before releasing the reset.');
  const waitStarted = Date.now();
  while (manilaParts().hour < 2) {
    if (Date.now() - waitStarted > TIMEOUT_MS) throw new Error('Timed out waiting for 2:00 AM Manila. Reset was not released.');
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }

  console.log('Releasing the app reset routine after successful cloud refresh and captures.');
  await page.evaluate(() => {
    window.__BADOC_GITHUB_AUTOMATION_HOLD_RESET = false;
    if (typeof window.__badocRunDailyReset !== 'function') throw new Error('Guarded reset entry point is unavailable.');
    window.__badocRunDailyReset(); // starts the async reset; the page reloads after completion
    return true;
  });
  resetInvoked = true;

  await page.waitForFunction(date => {
    try {
      const status = JSON.parse(localStorage.getItem('badoc_reset_status') || 'null');
      return status && status.date === date && status.state === 'done';
    } catch (_) { return false; }
  }, today, { timeout: 8 * 60 * 1000, polling: POLL_MS });
  console.log('Daily History, CFR summary, and guarded 2 AM reset completed for ' + today + '.');
} catch (error) {
  console.error('GitHub-only automation stopped safely:', error?.stack || error);
  if (resetInvoked) console.error('The reset was invoked; inspect the app reset status before retrying.');
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
