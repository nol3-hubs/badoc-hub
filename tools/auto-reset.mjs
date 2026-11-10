// Badoc Hub — nightly auto save & reset.
// Opens the hub in a headless browser after 2:00 AM Manila time. The app itself then saves the Daily History
// snapshot and runs the 2 AM reset (exactly as it does when someone has it open), so nobody has to be online.
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 9 * 60 * 1000);
const POLL_MS = Number(process.env.POLL_MS || 5000);

if (!APP_URL) {
  console.error('APP_URL is not set. Add it in GitHub: Settings → Secrets and variables → Actions → Variables.');
  process.exit(2);
}
const manilaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const manilaHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));

if (manilaHour() < 2 && !process.env.SKIP_TIME_CHECK) {
  console.log('It is before 2:00 AM in Manila — nothing to do yet.');
  process.exit(0);
}
const TODAY = manilaDay();

const browser = await chromium.launch();
const ctx = await browser.newContext({ timezoneId: 'Asia/Manila', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[app]', m.text().slice(0, 220)); });

try {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.error('Could not open the app:', e.message);
  await browser.close();
  process.exit(1);
}

const t0 = Date.now();
let last = null;
while (Date.now() - t0 < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  let st = null;
  try {
    st = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('badoc_reset_status') || 'null'); } catch (e) { return null; }
    });
  } catch (e) { continue; } // the app reloads itself after the reset
  const line = st ? `${st.state} (${st.date})` : 'waiting for the app';
  if (line !== last) { console.log(new Date().toISOString(), line, st && st.reason ? '— ' + st.reason : ''); last = line; }
  if (st && st.date === TODAY && (st.state === 'done' || st.state === 'already-done')) {
    console.log('✅ Daily snapshot saved and reset completed for', TODAY);
    await browser.close();
    process.exit(0);
  }
}
console.error('❌ Timed out. Last status:', last);
try {
  console.error(JSON.stringify(await page.evaluate(() => ({
    cloud: window.BadocCloud && window.BadocCloud.health && window.BadocCloud.health(),
    issues: ((window.__badocHealth && window.__badocHealth.issues) || []).slice(0, 8)
  }))));
} catch (e) { /* ignore */ }
await browser.close();
process.exit(1);
