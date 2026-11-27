# Refactor notes (index split)

**What changed**
- `index.html` 2.0 MB -> ~75 KB: markup only. 58 inline scripts -> `js/NNN-*.js` (same order, same global scope); 54 `<style>` blocks -> `css/app.css` (same order).
- Calculation and cloud-sync code is byte-identical to before (only the Bridge Installer, Received-Checking loader and the generated extension map differ).
- Extension file map (~550 KB) is no longer in every page load: `js/bridge-files.js` loads on demand (`js/445-lazy-bridge-files.js`).
- `app-css` block was missing a closing `}`; browsers hid it per `<style>`, so it is now closed explicitly (behavior unchanged).
- Added CSP, meta description, preconnects. CSP allows Google Sheets (script), Apps Script (form POST) and Firebase (connect).
- `sw.js`: hash-stamped assets are cache-first, others stale-while-revalidate; precache list is generated.
- Workflows: `package-chrome-extension.yml` now calls `tools/sync_bridge.py` (also fixes a rerun failure in the old inline KPI patch check); new `stamp-assets.yml`.
- `downloads/` pruned to the newest 3 builds per browser (older ones remain in git history). README versions corrected.

**Day-to-day**: edit files in `js/` or `css/`, then `node tools/stamp-assets.mjs` (CI also does it).

**Not changed on purpose**: Firebase rules, `120-app-core.js` (one file; hoisting-dependent), timers/MutationObservers, `!important` usage.

**Follow-up fixes**
- Six scripts that sat after `</html>` are now inside `<body>` (same order).
- Operation-modal subtitle no longer hard-codes an extension version; it follows the real requirement (JS at runtime, `tools/sync_bridge.py` for the static fallback).
- `actual-scanned.js` and `extension/pod-checker/app.js` are now content-hash stamped like `js/` and `css/`.

## Daily reset and CFR1 boundary safeguards — 2026-11-24

- Hardened the daily reset to require a working shared-cloud connection and atomic reset lock. Cloud read, lock, shared-clear, CFR1-clear, and marker-write failures stop the reset rather than being treated as success.
- The shared reset completion marker is written and read back successfully before local cleanup is committed. Each device records its local completion only after its own IndexedDB and local working data have been cleared.
- A device that sees another device's completed marker clears only its own local parcel/linehaul/pickup data, then refreshes exemptions from the shared source. It does not issue another cloud-wide clear.
- CFR1 Rule B now accepts uploaded batches only when their upload timestamp is from the current Asia/Manila calendar date and at or before 4:00 AM. CFR1 Rule A's existing received-time rule remains date-unrestricted. The 7:00 AM membership freeze, live status refresh, scanned/unscanned classification, and other dashboard/Planning Board calculations are unchanged.
- Regenerated asset hashes and the service-worker cache manifest.
- Validation performed: JavaScript syntax checks, JSON manifest parsing, local asset/hash checks, and a mocked daily-reset harness for primary, peer-device, and cloud-failure paths. Live Firebase/SPX verification was not available in this package-only session.

## Follow-up audit fixes (excluding Firebase authentication/rules)

- CFR1 persistence now uses a single Firebase Realtime Database transaction node (`badoc/cfr1LedgerState`) containing the ledger and its fenced lease. A write is accepted only when its owner, fencing token, lease expiry, and reset generation still match. This prevents an expired writer from committing a late Storage upload after another device takes over.
- CFR1 reset enters a `resetPending` state, increments the reset generation, removes the legacy Storage object, and only enables new-generation writes after the reset callback has completed. Ledgers created before the reset generation are rejected. The previous Storage object remains a one-time migration source only before the first fenced reset.
- Incoming Linehaul inclusion is now a shared cloud preference (`badoc_dashboard_preferences`, row `id=1`), with realtime notification and a 20-second polling fallback. Dashboard totals, Planning Board snapshots, and CFR summaries continue using the same existing inclusion toggle; the selected value is also recorded in the CFR daily summary.
- CFR daily summary parsing now treats offset-less SPX CSV timestamps as Manila wall-clock values and converts explicitly zoned timestamps to `Asia/Manila`. The redelivery previous-day calculation uses UTC calendar arithmetic to avoid device-timezone drift.
- Firebase authentication and database security rules were intentionally not changed, per the requested scope.

Validation performed in the offline workspace: JavaScript syntax checks, JSON parsing, local asset reference checks, Manila timestamp boundary tests, and mocked Firebase transaction tests for lease expiry, fencing-token advancement, reset-pending rejection, reset completion, and post-reset writes. Live Firebase/SPX multi-device behavior still requires deployment testing.

## Follow-up reliability fixes — 2026-11-24 (Firebase security excluded)

- CFR1 frozen-ledger recovery now rejects any previously unseen parcel whose source batch is missing a trustworthy batch timestamp or was uploaded after the recorded 7:00 AM freeze. Existing members still receive live status updates. This closes the late-upload/old-received-time admission path.
- CFR1 now preserves an existing town when a newer status-only row has an empty Town Name, using matching OID/TN identity. It also migrates a TN-only ledger key to OID when the same parcel later gains an Order ID, avoiding a duplicate membership entry.
- Parcel Count and Linehaul clear operations now clear their local dirty/pending retry markers before publishing the authoritative cloud tombstone. Parcel Count retry logic now respects a newer/equal cloud tombstone instead of restoring `upload_exists=true` from stale pending state.
- The scheduled reset preflight now accepts a successfully loaded empty Parcel Count dataset; it no longer requires at least one valid/misrouted row to proceed.
- Firebase authentication and database security rules remain unchanged as explicitly requested.
- Validation: `node --check` across application, extension, and tooling JavaScript; JSON parsing; asset stamping and cache-manifest regeneration. Live cloud/device integration was not available in this offline archive session.
