/* BADOC CLOUD — Firebase Realtime Database adapter.
   Exposes window.BadocCloud.createClient() with the same small surface the app
   already uses: from(table) rows, storage.from(bucket) files, channel() realtime.
   Data layout under /badoc:
     rows/<table>/<id>        { j: "<row as JSON string>" }
     blobs/<bucket>/<path>    { d: base64(gzip(bytes)), z: 1, ct, size }
     meta/<bucket>/<path>     { size, at, ct }      (tiny; read before blobs)
     bc/<channel>/<pushId>    { e: event, p: payload JSON, s: sender, t: ts }
   Realtime listeners sit only on small nodes, and reads are served from a live
   cache / IndexedDB cache whenever possible to keep download traffic low. */
(function () {
  "use strict";
  var ROOT = "badoc";
  var dbp = null;
  var health = { connected: null, lastOkAt: 0, lastError: "", lastErrorAt: 0, errors: 0, serverClockReady: false };
  var resolveServerClockReady = null;
  var serverClockReadyPromise = new Promise(function (resolve) { resolveServerClockReady = resolve; });
  function watchClock(db) {
    try {
      db.ref(".info/serverTimeOffset").on("value", function (s) {
        var v = s.val();
        if (typeof v === "number" && isFinite(v)) {
          if (window.__badocTime) window.__badocTime.setOffset(v);
          health.serverClockReady = true;
          if (resolveServerClockReady) { resolveServerClockReady(v); resolveServerClockReady = null; }
        }
      }, function (e) {
        health.serverClockReady = false;
        health.lastError = String(e && e.message || e || "Firebase server clock unavailable");
        health.lastErrorAt = Date.now();
      });
    } catch (e) {
      health.lastError = String(e && e.message || e || "Firebase server clock listener failed");
      health.lastErrorAt = Date.now();
    }
    try { db.ref(".info/connected").on("value", function (s) { health.connected = s.val() === true; if (health.connected) health.lastOkAt = Date.now(); }); } catch (e) {}
  }
  async function ensureServerClockReady(timeoutMs) {
    if (health.serverClockReady) return true;
    var timeout = Math.max(1000, Number(timeoutMs) || 10000);
    var ready = await Promise.race([
      serverClockReadyPromise.then(function () { return true; }),
      new Promise(function (resolve) { setTimeout(function () { resolve(false); }, timeout); })
    ]);
    if (!ready || !health.serverClockReady) {
      throw new Error("Firebase server clock is not synchronized; CFR1 did not acquire a write lock. Check cloud connectivity and retry.");
    }
    return true;
  }

  function getDb() {
    if (window.BADOC_CLOUD_DISABLED) return Promise.reject(new Error("Cloud sync is disabled. This dashboard is running in local-only mode."));
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      try {
        var fb = window.firebase;
        if (!fb || !fb.database) throw new Error("Firebase SDK not loaded");
        var cfg = window.BADOC_FIREBASE_CONFIG || {};
        if (!cfg.databaseURL) throw new Error("Firebase databaseURL missing");
        var app = fb.apps && fb.apps.length ? fb.app() : fb.initializeApp(cfg);
        var dbi = fb.database(app); watchClock(dbi); resolve(dbi);
      } catch (e) { dbp = null; reject(e); }
    });
    return dbp;
  }
  function err(message, code) { return { message: String(message || "Cloud error"), code: code || "" }; }
  function enc(s) { return encodeURIComponent(String(s)).replace(/\./g, "%2E") || "_"; }
  function dec(s) { try { return decodeURIComponent(s); } catch (_) { return s; } }
  function ref(db, p) { return db.ref(ROOT + "/" + p); }

  /* ---------- bytes <-> base64 (+ gzip) ---------- */
  function toB64(u8) {
    var out = "", CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) out += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(out);
  }
  function fromB64(b64) {
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  async function pipe(u8, stream) {
    var res = new Response(new Blob([u8]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    if (typeof data === "string") return new TextEncoder().encode(data);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof Blob !== "undefined" && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    return new TextEncoder().encode(JSON.stringify(data));
  }
  async function pack(data) {
    var raw = await toBytes(data), z = 0, body = raw;
    if (typeof CompressionStream !== "undefined") {
      try { body = await pipe(raw, new CompressionStream("gzip")); z = 1; } catch (_) { body = raw; z = 0; }
    }
    return { d: toB64(body), z: z, size: raw.length };
  }
  async function unpack(node, ct) {
    var bytes = fromB64(node.d || "");
    if (node.z) bytes = await pipe(bytes, new DecompressionStream("gzip"));
    return new Blob([bytes], { type: ct || node.ct || "application/octet-stream" });
  }

  /* ---------- tiny IndexedDB cache for downloaded files ---------- */
  var idbp = null;
  function idb() {
    if (idbp) return idbp;
    idbp = new Promise(function (resolve) {
      try {
        var rq = indexedDB.open("badoc-cloud-cache", 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore("f"); };
        rq.onsuccess = function () { resolve(rq.result); };
        rq.onerror = function () { resolve(null); };
      } catch (_) { resolve(null); }
    });
    return idbp;
  }
  async function cacheGet(k) {
    var db = await idb(); if (!db) return null;
    return new Promise(function (res) {
      try { var r = db.transaction("f").objectStore("f").get(k); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; }
      catch (_) { res(null); }
    });
  }
  async function cacheSet(k, v) {
    var db = await idb(); if (!db) return;
    try { db.transaction("f", "readwrite").objectStore("f").put(v, k); } catch (_) {}
  }
  async function cacheDel(k) {
    var db = await idb(); if (!db) return;
    try { db.transaction("f", "readwrite").objectStore("f").delete(k); } catch (_) {}
  }

  /* ---------- rows ---------- */
  var liveRows = {}; // "table/id" -> { val, ready }
  function parseRow(node) {
    if (!node || typeof node.j !== "string") return null;
    try { return JSON.parse(node.j); } catch (_) { return null; }
  }
  async function readRow(table, id) {
    var key = table + "/" + id, live = liveRows[key];
    if (live && live.ready) return live.val;
    var db = await getDb();
    var snap = await ref(db, "rows/" + enc(table) + "/" + enc(id)).once("value");
    return parseRow(snap.val());
  }
  async function mutateRow(table, id, fn, createIfMissing) {
    var db = await getDb();
    var r = ref(db, "rows/" + enc(table) + "/" + enc(id));
    var snap = await r.once("value");
    var seed = parseRow(snap.val());
    if (!seed && !createIfMissing) return null;
    var result = null;
    var tx = await r.transaction(function (cur) {
      var base = cur !== null && cur !== undefined ? parseRow(cur) : seed;
      if (!base && !createIfMissing) return undefined;
      result = fn(base || {});
      return { j: JSON.stringify(result) };
    }, undefined, false);
    return tx.committed ? result : null;
  }

  // Insert must be atomic. A read-then-write check can overwrite another
  // device's row when two clients create the same id at nearly the same time.
  async function insertRowAtomically(table, payload) {
    if (!payload || payload.id == null) throw new Error("Row id required");
    var db = await getDb();
    var r = ref(db, "rows/" + enc(table) + "/" + enc(payload.id));
    var tx = await r.transaction(function (cur) {
      if (cur !== null && cur !== undefined) return;
      return { j: JSON.stringify(Object.assign({}, payload)) };
    }, undefined, false);
    var saved = tx.snapshot && tx.snapshot.val();
    return { duplicate: !tx.committed, row: parseRow(saved) };
  }

  function Query(table) {
    this.t = table; this.op = "select"; this.filters = {}; this.payload = null;
    this.returning = false; this.mode = "many";
  }
  Query.prototype.select = function () { if (this.op !== "select") this.returning = true; return this; };
  Query.prototype.insert = function (p) { this.op = "insert"; this.payload = Array.isArray(p) ? p[0] : p; return this; };
  Query.prototype.upsert = function (p) { this.op = "upsert"; this.payload = Array.isArray(p) ? p[0] : p; return this; };
  Query.prototype.update = function (p) { this.op = "update"; this.payload = p; return this; };
  Query.prototype.delete = function () { this.op = "delete"; return this; };
  Query.prototype.eq = function (c, v) { this.filters[c] = v; return this; };
  Query.prototype.limit = function () { return this; };
  Query.prototype.order = function () { return this; };
  Query.prototype.maybeSingle = function () { this.mode = "maybe"; return this; };
  Query.prototype.single = function () { this.mode = "single"; return this; };
  Query.prototype.then = function (a, b) { return this.exec().then(a, b); };
  Query.prototype.exec = async function () {
    try {
      var id = this.filters.id != null ? this.filters.id : (this.payload && this.payload.id);
      if (id == null && this.op === "select") {
        // No id filter: return every row of the table (used for small index tables).
        var dbt = await getDb(), ts = await ref(dbt, "rows/" + enc(this.t)).once("value"), all = [];
        ts.forEach(function (c) { var r0 = parseRow(c.val()); if (r0) all.push(r0); });
        return { data: all, error: null };
      }
      if (id == null) return { data: null, error: err("Row id required") };
      id = String(id);
      var row = null, self = this;
      if (this.op === "select") row = await readRow(this.t, id);
      else if (this.op === "delete") {
        var db = await getDb(); await ref(db, "rows/" + enc(this.t) + "/" + enc(id)).remove();
        delete liveRows[this.t + "/" + id];
        return { data: null, error: null };
      } else if (this.op === "update") {
        row = await mutateRow(this.t, id, function (b) { return Object.assign({}, b, self.payload); }, false);
      } else if (this.op === "upsert") {
        row = await mutateRow(this.t, id, function (b) { return Object.assign({}, b, self.payload); }, true);
      } else if (this.op === "insert") {
        var inserted = await insertRowAtomically(this.t, self.payload);
        if (inserted.duplicate) return { data: null, error: err("duplicate key value", "23505") };
        row = inserted.row;
      }
      if (this.op !== "select" && !this.returning) return { data: null, error: null };
      if (this.mode === "many") return { data: row ? [row] : [], error: null };
      if (!row && this.mode === "single") return { data: null, error: err("No rows found", "PGRST116") };
      return { data: row || null, error: null };
    } catch (e) { return { data: null, error: err(e && e.message) }; }
  };

  /* ---------- storage ---------- */
  function Bucket(name) { this.b = name; }
  Bucket.prototype.upload = async function (path, data, opts) {
    try {
      var db = await getDb(), k = enc(path), ct = (opts && opts.contentType) || (data && data.type) || "application/octet-stream";
      if (!(opts && opts.upsert)) {
        var ex = await ref(db, "meta/" + enc(this.b) + "/" + k).once("value");
        if (ex.exists()) return { data: null, error: err("The resource already exists", "409") };
      }
      var p = await pack(data), at = Date.now(), up = {};
      up["blobs/" + enc(this.b) + "/" + k] = { d: p.d, z: p.z, ct: ct, size: p.size };
      up["meta/" + enc(this.b) + "/" + k] = { size: p.size, at: at, ct: ct };
      await ref(db, "").update(up);
      await cacheDel(this.b + "/" + path);
      return { data: { path: path }, error: null };
    } catch (e) { return { data: null, error: err(e && e.message) }; }
  };
  Bucket.prototype.download = async function (path) {
    try {
      var db = await getDb(), k = enc(path), ck = this.b + "/" + path;
      var m = await ref(db, "meta/" + enc(this.b) + "/" + k).once("value");
      if (!m.exists()) { await cacheDel(ck); return { data: null, error: err("Object not found", "404") }; }
      var meta = m.val(), cached = await cacheGet(ck);
      if (cached && cached.at === meta.at && cached.blob) return { data: cached.blob, error: null };
      var s = await ref(db, "blobs/" + enc(this.b) + "/" + k).once("value");
      if (!s.exists()) return { data: null, error: err("Object not found", "404") };
      var blob = await unpack(s.val(), meta.ct);
      cacheSet(ck, { at: meta.at, blob: blob });
      return { data: blob, error: null };
    } catch (e) { return { data: null, error: err(e && e.message) }; }
  };
  Bucket.prototype.remove = async function (paths) {
    try {
      var db = await getDb(), up = {}, b = this.b;
      (paths || []).forEach(function (p) {
        up["blobs/" + enc(b) + "/" + enc(p)] = null;
        up["meta/" + enc(b) + "/" + enc(p)] = null;
      });
      await ref(db, "").update(up);
      await Promise.all((paths || []).map(function (p) { return cacheDel(b + "/" + p); }));
      return { data: (paths || []).map(function (p) { return { name: p }; }), error: null };
    } catch (e) { return { data: null, error: err(e && e.message) }; }
  };
  Bucket.prototype.list = async function (prefix, opts) {
    try {
      var db = await getDb(), pre = prefix ? String(prefix).replace(/\/+$/, "") + "/" : "";
      var q = ref(db, "meta/" + enc(this.b)).orderByKey();
      if (pre) q = q.startAt(enc(pre)).endAt(enc(pre) + "\uf8ff");
      if (opts && opts.limit) q = q.limitToFirst(opts.limit);
      var snap = await q.once("value"), out = [];
      snap.forEach(function (c) {
        var full = dec(c.key), v = c.val() || {};
        out.push({ name: full.slice(pre.length), id: c.key, updated_at: v.at ? new Date(v.at).toISOString() : null, metadata: { size: v.size, mimetype: v.ct } });
      });
      return { data: out, error: null };
    } catch (e) { return { data: null, error: err(e && e.message) }; }
  };

  /* ---------- realtime channels ---------- */
  var senderId = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function Channel(name) { this.name = name; this.handlers = []; this.offs = []; this.closed = false; }
  Channel.prototype.on = function (type, filter, cb) { this.handlers.push({ type: type, filter: filter || {}, cb: cb }); return this; };
  Channel.prototype.subscribe = function (statusCb) {
    var self = this;
    getDb().then(function (db) {
      if (self.closed) return;
      var wasUp = false;
      var conn = db.ref(".info/connected"), cl = conn.on("value", function (s) {
        if (s.val() === true) { wasUp = true; statusCb && statusCb("SUBSCRIBED"); }
        else if (wasUp) statusCb && statusCb("CHANNEL_ERROR");
      });
      self.offs.push(function () { conn.off("value", cl); });

      self.handlers.forEach(function (h) {
        if (h.type === "broadcast") {
          var q = ref(db, "bc/" + enc(self.name)).limitToLast(1), lastKey = null, started = false;
          q.once("value", function (snap) {
            snap.forEach(function (c) { lastKey = c.key; });
            started = true;
            var lc = q.on("child_added", function (c) {
              if (lastKey && c.key <= lastKey) return;
              var v = c.val() || {};
              if (v.s === senderId || (h.filter.event && v.e !== h.filter.event)) return;
              var payload = null; try { payload = JSON.parse(v.p); } catch (_) {}
              try { h.cb({ event: v.e, payload: payload, type: "broadcast" }); } catch (e) { console.warn(e); }
            });
            self.offs.push(function () { q.off("child_added", lc); });
          });
        } else if (h.type === "postgres_changes") {
          var f = h.filter || {}, m = /^id=eq\.(.+)$/.exec(f.filter || "");
          var table = f.table || "";
          if (!m) return;
          var id = m[1], key = table + "/" + id, r = ref(db, "rows/" + enc(table) + "/" + enc(id)), first = true, prev = null;
          liveRows[key] = liveRows[key] || { val: null, ready: false };
          var lv = r.on("value", function (snap) {
            var row = parseRow(snap.val());
            liveRows[key] = { val: row, ready: true };
            if (first) { first = false; prev = row; return; }
            var ev = prev ? "UPDATE" : "INSERT"; prev = row;
            if (!row) return;
            if (f.event && f.event !== "*" && f.event !== ev) return;
            try { h.cb({ eventType: ev, schema: f.schema || "public", table: table, new: row, old: null }); } catch (e) { console.warn(e); }
          });
          self.offs.push(function () { r.off("value", lv); if (liveRows[key]) liveRows[key].ready = false; });
        }
      });
    }).catch(function (e) { console.warn("Cloud channel:", e); statusCb && statusCb("CHANNEL_ERROR"); });
    return this;
  };
  Channel.prototype.send = async function (msg) {
    try {
      var db = await getDb(), r = ref(db, "bc/" + enc(this.name)), p = r.push();
      await p.set({ e: msg && msg.event || "", p: JSON.stringify(msg && msg.payload || null), s: senderId, t: Date.now() });
      setTimeout(function () { try { p.remove(); } catch (_) {} }, 20000);
      return "ok";
    } catch (e) { return "error"; }
  };
  Channel.prototype.unsubscribe = function () {
    this.closed = true; this.offs.splice(0).forEach(function (f) { try { f(); } catch (_) {} });
    return Promise.resolve("ok");
  };

  // Coalesce identical simultaneous reads across dashboard sections. This is
  // in-flight deduplication only (not a TTL cache), so later reads always reach
  // the current Firebase-backed data and realtime notifications remain authoritative.
  var inFlightCloudReads = Object.create(null);
  function copyCloudReadResult(result) {
    if (!result) return result;
    var data = result.data;
    if (data && typeof data === "object") {
      try { data = JSON.parse(JSON.stringify(data)); } catch (_) {}
    }
    return { data: data, error: result.error || null };
  }
  function track(proto, name) {
    var o = proto[name];
    proto[name] = async function () {
      var r, joinable = name === "exec" && this.op === "select";
      var key = joinable ? JSON.stringify({
        table: this.t, filters: this.filters || {}, mode: this.mode || "many"
      }) : "";
      if (joinable && inFlightCloudReads[key]) {
        r = copyCloudReadResult(await inFlightCloudReads[key]);
      } else {
        var request = o.apply(this, arguments);
        if (joinable) inFlightCloudReads[key] = request;
        try { r = await request; }
        finally {
          if (joinable && inFlightCloudReads[key] === request) delete inFlightCloudReads[key];
        }
      }
      if (r && r.error) { if (r.error.code !== "404" && r.error.code !== "PGRST116") { health.errors++; health.lastError = String(r.error.message || "Cloud error"); health.lastErrorAt = Date.now(); } }
      else if (r) health.lastOkAt = Date.now();
      return r;
    };
  }
  track(Query.prototype, "exec");
  ["upload", "download", "remove", "list"].forEach(function (n) { track(Bucket.prototype, n); });

  /* Atomic lease: only one device can hold `name` at a time (used for the 12 AM reset). */
  function claim(name, owner, ttlMs) {
    return getDb().then(function (db) {
      var r = ref(db, "locks/" + enc(name));
      var now = Date.now() + (window.__badocTime ? window.__badocTime.offset() : 0);
      return r.transaction(function (cur) {
        if (cur && cur.until > now && cur.owner !== owner) return;   // held by another device -> abort
        return { owner: owner, until: now + (ttlMs || 60000), at: now };
      }, undefined, false).then(function (res) { return !!res.committed; });
    });
  }
  // Release a short-lived writer lease immediately after the transaction.
  // Only the current owner can remove it; a different device's lock is untouched.
  function release(name, owner) {
    return getDb().then(function (db) {
      var r = ref(db, "locks/" + enc(name));
      return r.transaction(function (cur) {
        if (cur && cur.owner === owner) return null;
        return;
      }, undefined, false).then(function (res) { return !!res.committed; });
    });
  }

  /* CFR1 uses a fenced lease and its ledger in the SAME RTDB transaction node.
     This is stronger than a Storage upload guarded by a separate lock: an old
     owner whose lease expired cannot commit a late write after a new owner wins. */
  function cfr1Now() { return Date.now() + (window.__badocTime ? window.__badocTime.offset() : 0); }
  function claimCfr1Lease(owner, ttlMs) {
    return getDb().then(async function (db) {
      await ensureServerClockReady(10000);
      var r = ref(db, "cfr1LedgerState"), result = null;
      return r.transaction(function (cur) {
        var now = cfr1Now();
        cur = cur || {};
        var lease = cur.lease || null;
        if (lease && Number(lease.until || 0) > now && lease.owner !== owner) return;
        var sameLiveOwner = !!(lease && lease.owner === owner && Number(lease.until || 0) > now);
        var fence = sameLiveOwner ? Number(lease.fence || 0) : Number(cur.fenceCounter || 0) + 1;
        result = { owner: owner, fence: fence, until: now + (ttlMs || 60000) };
        return Object.assign({}, cur, { fenceCounter: Math.max(Number(cur.fenceCounter || 0), fence), lease: result });
      }, undefined, false).then(function (res) {
        if (!res.committed) return null;
        var saved = res.snapshot && res.snapshot.val();
        var lease = saved && saved.lease;
        return lease && lease.owner === owner ? { owner: owner, fence: Number(lease.fence || 0), until: Number(lease.until || 0) } : null;
      });
    });
  }
  function releaseCfr1Lease(owner, fence) {
    return getDb().then(function (db) {
      var r = ref(db, "cfr1LedgerState");
      return r.transaction(function (cur) {
        if (!cur || !cur.lease || cur.lease.owner !== owner || Number(cur.lease.fence) !== Number(fence)) return;
        var next = Object.assign({}, cur); delete next.lease; return next;
      }, undefined, false).then(function (res) { return !!res.committed; });
    });
  }
  function readCfr1LedgerState() {
    return getDb().then(function (db) { return ref(db, "cfr1LedgerState").once("value"); })
      .then(function (snap) { return snap.val() || {}; });
  }
  function writeCfr1Ledger(owner, fence, ledger) {
    return getDb().then(async function (db) {
      await ensureServerClockReady(10000);
      var r = ref(db, "cfr1LedgerState"), committed = false;
      return r.transaction(function (cur) {
        var now = cfr1Now();
        if (!cur || !cur.lease || cur.lease.owner !== owner || Number(cur.lease.fence) !== Number(fence) || Number(cur.lease.until || 0) <= now) return;
        if (cur.resetPending === true || Number(ledger && ledger._resetGeneration || 0) !== Number(cur.resetGeneration || 0)) return;
        committed = true;
        return Object.assign({}, cur, { ledger: ledger, ledgerRevision: Number(cur.ledgerRevision || 0) + 1 });
      }, undefined, false).then(function (res) {
        if (!res.committed || !committed) throw new Error("CFR1 fenced write rejected: lease expired, ownership changed, or reset generation is stale");
        return res.snapshot && res.snapshot.val() || null;
      });
    });
  }
  function resetCfr1Ledger(owner, fence, resetDate) {
    return getDb().then(function (db) {
      var r = ref(db, "cfr1LedgerState"), committed = false;
      return r.transaction(function (cur) {
        var now = cfr1Now();
        if (!cur || !cur.lease || cur.lease.owner !== owner || Number(cur.lease.fence) !== Number(fence) || Number(cur.lease.until || 0) <= now) return;
        committed = true;
        return Object.assign({}, cur, { ledger: null, resetPending: true, resetGeneration: Number(cur.resetGeneration || 0) + 1, resetDate: String(resetDate || ""), resetAt: now, ledgerRevision: Number(cur.ledgerRevision || 0) + 1 });
      }, undefined, false).then(function (res) {
        if (!res.committed || !committed) throw new Error("CFR1 reset rejected: write lease expired or ownership changed");
        return res.snapshot && res.snapshot.val() || null;
      });
    });
  }
  function completeCfr1Reset(owner, fence) {
    return getDb().then(async function (db) {
      await ensureServerClockReady(10000);
      var r = ref(db, "cfr1LedgerState"), committed = false;
      return r.transaction(function (cur) {
        var now = cfr1Now();
        if (!cur || !cur.lease || cur.lease.owner !== owner || Number(cur.lease.fence) !== Number(fence) || Number(cur.lease.until || 0) <= now || cur.resetPending !== true) return;
        committed = true;
        return Object.assign({}, cur, { resetPending: false, resetCompletedAt: now });
      }, undefined, false).then(function (res) {
        if (!res.committed || !committed) throw new Error("CFR1 reset completion rejected: lease expired or ownership changed");
        return res.snapshot && res.snapshot.val() || null;
      });
    });
  }
  // A reset owner can close after the shared reset marker was committed but
  // before clearing resetPending. A peer may recover only after that owner's
  // fenced lease is absent or expired; an active owner is never bypassed.
  function recoverCfr1Reset() {
    return getDb().then(async function (db) {
      await ensureServerClockReady(10000);
      var r = ref(db, "cfr1LedgerState"), recovered = false;
      return r.transaction(function (cur) {
        var now = cfr1Now();
        if (!cur || cur.resetPending !== true) return cur;
        if (cur.lease && Number(cur.lease.until || 0) > now) return;
        var next = Object.assign({}, cur, { resetPending: false, resetRecoveredAt: now });
        delete next.lease; recovered = true; return next;
      }, undefined, false).then(function (res) {
        if (!res.committed) return false;
        return !res.snapshot.val()?.resetPending || recovered;
      });
    });
  }

  window.BadocCloud = {
    health: function () { return Object.assign({}, health, { offset: window.__badocTime ? window.__badocTime.offset() : 0, serverClockReady: health.serverClockReady === true }); },
    claim: claim,
    release: release,
    claimCfr1Lease: claimCfr1Lease,
    releaseCfr1Lease: releaseCfr1Lease,
    readCfr1LedgerState: readCfr1LedgerState,
    writeCfr1Ledger: writeCfr1Ledger,
    resetCfr1Ledger: resetCfr1Ledger,
    completeCfr1Reset: completeCfr1Reset,
    recoverCfr1Reset: recoverCfr1Reset,
    provider: "firebase",
    createClient: function () {
      return {
        from: function (t) { return new Query(t); },
        storage: { from: function (b) { return new Bucket(b); } },
        channel: function (n) { return new Channel(n); },
        removeChannel: function (ch) { return ch && ch.unsubscribe ? ch.unsubscribe() : Promise.resolve("ok"); }
      };
    },
    ready: function () { return getDb().then(function () { return true; }); }
  };
})();
