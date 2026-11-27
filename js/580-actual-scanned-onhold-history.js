/*
 * BADOC Hub — Actual Scanned by Riders: persistent OnHold history overlay
 * Version: 1.1.0
 * Load this AFTER actual-scanned.js.
 * This file does not replace the live/current OnHold classifier. It adds an
 * independent Ever OnHold history so a status transition does not erase the
 * rider's historical OnHold count.
 */
(function () {
  "use strict";

  const DB_NAME = "BadocHubActualScannedHistoryV1";
  const STORE_NAME = "onhold";
  const TASK_STORE_NAME = "assignmentTasks";
  const TASK_STORE_VERSION = 2;
  const HISTORY_KEY = "badoc_hold_history_v2"; // existing legacy TN-only history
  const AT_MAP_STORAGE_KEY = "badoc_actual_scanned_at_rider_map_v1";
  const TASK_MAP_STORAGE_KEY = "badoc_actual_scanned_assignment_tasks_v1";
  const AT_NUMBER_ALIASES = ["AT Number", "AT No", "Assignment Task Number", "Assignment Task No", "Assignment Task ID", "assignment_task_number", "assignment_task_id", "Task Number", "Task No"];
  const TASK_TN_ALIASES = ["SPX Tracking Number", "SPX TN", "SLS Tracking Number", "Tracking Number", "Tracking No", "SPX Tracking No", "Waybill Number", "AWB"];
  const TASK_RIDER_ID_ALIASES = [...RIDER_ID_ALIASES, "Assigned Rider ID", "Assigned Driver ID", "Task Rider ID"];
  const TASK_RIDER_NAME_ALIASES = [...RIDER_NAME_ALIASES, "Assigned Rider", "Assigned Driver Name", "Assigned Driver", "Task Rider Name"];
  const INVALID_DRIVER = /^(?:0+|N\/?A|NONE|NULL|UNKNOWN|UNASSIGNED|-)$/i;
  const ALL_DATES_VALUE = "__ALL_DATES__";
  const UNATTRIBUTED_RIDER_KEY = "UNATTRIBUTED_ONHOLD";
  const STATUS_ALIASES = ["Parcel Status To", "Status To", "TO Status", "To Status", "Status To (Current)", "Status", "Parcel Status", "Delivery Status", "Current Status"];
  // Keep these pickup aliases aligned with badocOnholdPickupBeforeCutoff()
  // so historical capture uses the same fixed 3:00 PM Manila classifier.
  const PICKUP_ALIASES = ["Pick Up Time", "Pickup Time", "First Pick Up Time", "First Pickup Time", "First Pickup DateTime", "At Pick Up Time", "Pickup Date Time", "Pickup Datetime", "Pickup Timestamp", "Scanned Time"];
  const ONHOLD_TIME_ALIASES = ["OnHold Time", "On Hold Time", "OnHold Date Time", "On Hold Date Time", "OnHold Timestamp"];
  const RIDER_ID_ALIASES = ["Driver ID", "Rider ID", "Delivery Driver ID", "Delivery Rider ID", "Last Mile Driver ID", "LM Driver ID", "Scan Driver ID", "Actual Driver ID", "Courier ID"];
  const RIDER_NAME_ALIASES = ["Driver Name", "Rider Name", "Delivery Driver Name", "Delivery Rider Name", "Last Mile Driver Name", "LM Driver Name", "Scan Driver Name", "Actual Driver Name", "Courier Name", "Driver", "Rider"];

  let dbPromise = null;
  let historyReady = false;
  let historyByKey = new Map();
  let assignmentTaskRows = [];
  let assignmentTaskDate = "";
  let assignmentTaskWriteChain = Promise.resolve();
  let assignmentTaskRequestDate = "";
  let writeChain = Promise.resolve();
  let renderQueued = false;
  let lastRenderManilaDayKey = "";
  let baseRender = null;
  let baseGetData = null;

  function norm(value) {
    return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  }
  function key(value) {
    return norm(value).replace(/[^A-Z0-9]/g, "");
  }
  function compact(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function field(row, aliases) {
    const keys = Object.keys(row || {});
    for (const alias of aliases) {
      const wanted = compact(alias);
      const found = keys.find(name => compact(name) === wanted && String(row[name] ?? "").trim() !== "");
      if (found) return String(row[found]).trim();
    }
    return "";
  }
  function trackingNumber(row) {
    try {
      if (typeof window.spxTN === "function") {
        const value = String(window.spxTN(row) || "").trim();
        if (value) return value;
      }
    } catch (_) {}
    return field(row, ["SPX TN", "SLS Tracking Number", "SPX Tracking Number", "Tracking Number", "SPX Tracking No", "AWB"]);
  }
  function manilaDateParts(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const result = {};
    parts.forEach(part => { if (part.type !== "literal") result[part.type] = part.value; });
    return result;
  }
  function todayManilaKey() {
    const p = manilaDateParts(new Date());
    return `${p.year}-${p.month}-${p.day}`;
  }
  function parseManilaStamp(rawValue) {
    const raw = String(rawValue ?? "").trim();
    if (!raw) return null;
    let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);
    if (match) {
      let hour = Number(match[4]);
      const meridiem = String(match[7] || "").toUpperCase();
      if (meridiem === "AM" && hour === 12) hour = 0;
      else if (meridiem === "PM" && hour < 12) hour += 12;
      return {
        dateKey: `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`,
        minutes: hour * 60 + Number(match[5]) + Number(match[6] || 0) / 60
      };
    }
    match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match) {
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      let hour = Number(match[4]);
      const meridiem = String(match[7] || "").toUpperCase();
      if (meridiem === "AM" && hour === 12) hour = 0;
      else if (meridiem === "PM" && hour < 12) hour += 12;
      return {
        dateKey: `${year}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`,
        minutes: hour * 60 + Number(match[5]) + Number(match[6] || 0) / 60
      };
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const p = manilaDateParts(parsed);
    return { dateKey: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute || 0) + Number(p.second || 0) / 60 };
  }
  function onholdStatus(row) {
    const status = norm(field(row, STATUS_ALIASES)).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (!status || /(^|\s)(DELIVERING|DELIVERED)$/.test(status)) return false;
    const pickup = parseManilaStamp(field(row, PICKUP_ALIASES));
    return !!pickup && pickup.dateKey === todayManilaKey() && pickup.minutes < 900;
  }
  function explicitOnhold(row) {
    const status = norm(field(row, STATUS_ALIASES)).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    return ["ONHOLD", "ON HOLD", "LMHUB ONHOLD", "LMHUB ON HOLD"].includes(status);
  }
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB is unavailable"));
      const request = indexedDB.open(DB_NAME, TASK_STORE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
        if (!request.result.objectStoreNames.contains(TASK_STORE_NAME)) {
          request.result.createObjectStore(TASK_STORE_NAME, { keyPath: "dateKey" });
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Could not open OnHold history storage"));
      request.onblocked = () => reject(new Error("OnHold history storage is blocked by another dashboard tab"));
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }
  function loadLegacyKeys() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(key).filter(Boolean) : []);
    } catch (_) { return new Set(); }
  }
  function dateKeyFromRaw(rawValue, fallback = "") {
    const raw = String(rawValue ?? "").trim();
    if (!raw) return fallback;
    let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) return match[1] + "-" + String(Number(match[2])).padStart(2, "0") + "-" + String(Number(match[3])).padStart(2, "0");
    match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      let year = Number(match[3]); if (year < 100) year += 2000;
      return String(year) + "-" + String(Number(match[1])).padStart(2, "0") + "-" + String(Number(match[2])).padStart(2, "0");
    }
    const parsed = parseManilaStamp(raw);
    return parsed?.dateKey || fallback;
  }
  function rowActivityDate(row, fallback) {
    return dateKeyFromRaw(field(row, ["Assigned Time", "Assignment Time", "AT Date", "Task Date", "Assignment Date", "Date", "Activity Date", "DATE"]), fallback);
  }
  function assignmentTaskRowsForDate(dateKey) {
    const live = Array.isArray(window.__badocAssignmentTaskRows) ? window.__badocAssignmentTaskRows : [];
    const liveDate = String(window.__badocAssignmentTaskMeta?.selectedDate || "").trim();
    const source = liveDate === dateKey ? live : (assignmentTaskDate === dateKey ? assignmentTaskRows : []);
    return source.map(row => ({
      dateKey: rowActivityDate(row, liveDate || assignmentTaskDate || dateKey),
      trackingNumber: field(row, TASK_TN_ALIASES),
      atNumber: field(row, AT_NUMBER_ALIASES),
      riderId: field(row, TASK_RIDER_ID_ALIASES),
      riderName: field(row, TASK_RIDER_NAME_ALIASES)
    })).filter(row => row.trackingNumber && row.dateKey === dateKey);
  }
  function uniqueIdentity(rows) {
    const identities = new Map();
    rows.forEach(row => {
      const id = String(row.riderId || "").trim();
      const name = String(row.riderName || "").trim();
      const identityKey = id ? "ID:" + key(id) : (name ? "NAME:" + key(name) : "");
      if (identityKey) identities.set(identityKey, row);
    });
    return identities.size === 1 ? [...identities.values()][0] : null;
  }
  function findAtMapRider(atNumber, dateKey) {
    const atKey = key(atNumber);
    if (!atKey || !dateKey) return null;
    return uniqueIdentity(assignmentTaskRowsForDate(dateKey).filter(row => key(row.atNumber) === atKey));
  }
  function findTaskMatch(tn, dateKey) {
    const tnKey = key(tn);
    if (!tnKey || !dateKey) return null;
    const rows = assignmentTaskRowsForDate(dateKey).filter(row => key(row.trackingNumber) === tnKey);
    if (!rows.length) return null;
    const direct = uniqueIdentity(rows);
    const atNumbers = [...new Set(rows.map(row => key(row.atNumber)).filter(Boolean))];
    if (direct) return { ...direct, source: "Automatic Assignment Task export" };
    if (atNumbers.length === 1) {
      const atNumber = rows.find(row => row.atNumber)?.atNumber || "";
      const mapped = findAtMapRider(atNumber, dateKey);
      if (mapped) return { ...mapped, atNumber, source: "Automatic AT Number match" };
      return { atNumber, source: "Assignment Task AT only" };
    }
    return null;
  }
  function riderVehicle(riderId, riderName, fallback = "") {
    const roster = typeof ridersData !== "undefined" && Array.isArray(ridersData) ? ridersData : [];
    const matched = roster.find(row =>
      (riderId && key(row["Driver ID"]) === key(riderId)) ||
      (riderName && key(row["Driver Name"]) === key(riderName))
    );
    return matched?.["Vehicle Type"] || fallback || "";
  }
  function resolveOnholdAttribution({ tn, row = null, event = null, date = "", actualId = "", actualName = "", hasScanner = false } = {}) {
    const dateKey = dateKeyFromRaw(date, todayManilaKey());
    const eventId = String(event?.riderId || "").trim();
    const eventName = String(event?.riderName || "").trim();
    const rowId = String(actualId || "").trim();
    const rowName = String(actualName || "").trim();
    const directId = eventId || (hasScanner ? rowId : "");
    const directName = eventName || (hasScanner ? rowName : "");
    if (directId || directName) {
      return {
        riderId: directId, riderName: directName || (directId ? "Driver " + directId : ""),
        riderKey: directId ? "ID:" + key(directId) : "NAME:" + key(directName),
        vehicle: event?.vehicle || riderVehicle(directId, directName, ""),
        atNumber: event?.atNumber || field(row, AT_NUMBER_ALIASES),
        source: eventId || eventName ? "OnHold event" : "Current scanner"
      };
    }
    const task = findTaskMatch(tn, dateKey);
    if (task?.riderId || task?.riderName) {
      return {
        riderId: task.riderId || "", riderName: task.riderName || (task.riderId ? "Driver " + task.riderId : ""),
        riderKey: task.riderId ? "ID:" + key(task.riderId) : "NAME:" + key(task.riderName),
        vehicle: riderVehicle(task.riderId, task.riderName, event?.vehicle || ""),
        atNumber: task.atNumber || event?.atNumber || field(row, AT_NUMBER_ALIASES),
        source: task.source || "Automatic Assignment Task export"
      };
    }
    const atNumber = task?.atNumber || event?.atNumber || field(row, AT_NUMBER_ALIASES);
    const mapped = atNumber ? findAtMapRider(atNumber, dateKey) : null;
    if (mapped) {
      return {
        riderId: mapped.riderId || "", riderName: mapped.riderName || (mapped.riderId ? "Driver " + mapped.riderId : ""),
        riderKey: mapped.riderId ? "ID:" + key(mapped.riderId) : "NAME:" + key(mapped.riderName),
        vehicle: riderVehicle(mapped.riderId, mapped.riderName, event?.vehicle || ""),
        atNumber, source: "Automatic AT Number match"
      };
    }
    return {
      riderId: "", riderName: "Unattributed OnHold", riderKey: "",
      vehicle: event?.vehicle || "", atNumber, source: "Unattributed OnHold"
    };
  }
  function setAssignmentTaskStatus(message, isError = false) {
    const element = document.getElementById("actualScannedSourceStatus");
    if (!element) return;
    const current = String(element.textContent || "");
    const parcelPrefix = current.match(/^\d[\d,]* eligible Parcel Count records/);
    element.textContent = (parcelPrefix ? parcelPrefix[0] + " · " : "") + message;
    if (isError) element.title = message;
  }
  async function persistAssignmentTaskRows(rows, dateKey) {
    if (!Array.isArray(rows) || !rows.length || !dateKey) return 0;
    const db = await openDb();
    const tx = db.transaction(TASK_STORE_NAME, "readwrite");
    tx.objectStore(TASK_STORE_NAME).put({ dateKey, rows, savedAt: Date.now(), rowCount: rows.length });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Assignment Task data could not be saved."));
      tx.onabort = () => reject(tx.error || new Error("Assignment Task storage was aborted."));
    });
    assignmentTaskRows = rows;
    assignmentTaskDate = dateKey;
    return rows.length;
  }
  async function loadAssignmentTaskRows() {
    const db = await openDb();
    const dateKey = todayManilaKey();
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction(TASK_STORE_NAME, "readonly").objectStore(TASK_STORE_NAME).get(dateKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not load today's Assignment Task data."));
    });
    if (record && Array.isArray(record.rows)) {
      assignmentTaskRows = record.rows;
      assignmentTaskDate = dateKey;
      return record.rows.length;
    }
    assignmentTaskRows = [];
    assignmentTaskDate = "";
    return 0;
  }
  async function acceptAssignmentTaskExport() {
    const rows = Array.isArray(window.__badocAssignmentTaskRows) ? window.__badocAssignmentTaskRows : [];
    const dateKey = String(window.__badocAssignmentTaskMeta?.selectedDate || "").trim();
    if (!rows.length || dateKey !== todayManilaKey()) {
      setAssignmentTaskStatus("Today's SPX Assignment Task data is not available yet.", true);
      return 0;
    }
    const count = await persistAssignmentTaskRows(rows, dateKey);
    const taskMatches = assignmentTaskRowsForDate(dateKey).length;
    setAssignmentTaskStatus("SPX Assignment Task synced automatically · " + taskMatches.toLocaleString() + " parcel mapping row(s)");
    try { window.__badocRenderActualScannedByRiders?.(); } catch (_) {}
    return count;
  }
  function requestAssignmentTaskExport() {
    const today = todayManilaKey();
    const liveDate = String(window.__badocAssignmentTaskMeta?.selectedDate || "").trim();
    const liveRows = Array.isArray(window.__badocAssignmentTaskRows) ? window.__badocAssignmentTaskRows : [];
    if ((liveRows.length && liveDate === today) || (assignmentTaskRows.length && assignmentTaskDate === today)) {
      if (liveRows.length && liveDate === today) acceptAssignmentTaskExport().catch(error => setAssignmentTaskStatus(error?.message || String(error), true));
      else setAssignmentTaskStatus("SPX Assignment Task data loaded · " + assignmentTaskRows.length.toLocaleString() + " rows");
      return;
    }
    if (assignmentTaskRequestDate === today) return;
    assignmentTaskRequestDate = today;
    setAssignmentTaskStatus("Requesting today's Assignment Task data from SPX automatically…");
    if (typeof window.__badocRequestAssignmentTaskExport === "function") {
      const result = window.__badocRequestAssignmentTaskExport({ date: today });
      if (result?.ok === false) setAssignmentTaskStatus(result.message || "Automatic Assignment Task export could not start.", true);
    } else {
      setAssignmentTaskStatus("Automatic Assignment Task export bridge is not available in this app/extension build.", true);
    }
  }  function makeHistoryRecord(row) {
    const tn = trackingNumber(row);
    const tnKey = key(tn);
    if (!tnKey) return null;
    const pickupRaw = field(row, PICKUP_ALIASES);
    const onholdRaw = field(row, ONHOLD_TIME_ALIASES);
    const eventRaw = onholdRaw || pickupRaw;
    const eventStamp = parseManilaStamp(eventRaw);
    const onholdDate = eventStamp?.dateKey || todayManilaKey();
    const historyKey = `${onholdDate}|${tnKey}`;
    const rawId = field(row, RIDER_ID_ALIASES);
    const rawName = field(row, RIDER_NAME_ALIASES);
    const riderId = INVALID_DRIVER.test(rawId) ? "" : rawId;
    const riderName = INVALID_DRIVER.test(rawName) ? "" : rawName;
    return {
      key: historyKey,
      tn,
      onholdDate,
      onholdAt: eventRaw || new Date().toISOString(),
      riderId,
      riderName,
      atNumber: field(row, AT_NUMBER_ALIASES),
      town: field(row, ["Town Name", "Town", "Delivery Town", "Municipality"]),
      vehicle: field(row, ["Vehicle Type", "Rider Vehicle Type", "Driver Vehicle Type"]),
      area: String(row?._area || "").trim().toUpperCase(),
      orderId: field(row, ["Order ID", "Shopee Order SN", "Order SN", "Order Number"]),
      recordedAt: Date.now()
    };
  }
  function collectRows(rows) {
    if (!Array.isArray(rows)) return [];
    const records = [];
    rows.forEach(row => {
      if (!row || typeof row !== "object") return;
      // Keep explicit OnHold history even after the live status changes to
      // Delivered/Delivering. OnHold Time is the strongest event evidence;
      // otherwise use the explicit status or the dashboard's fixed 3 PM rule.
      if (!field(row, ONHOLD_TIME_ALIASES) && !explicitOnhold(row) && !onholdStatus(row)) return;
      const record = makeHistoryRecord(row);
      if (record) records.push(record);
    });
    return records;
  }
  function persistRecords(records) {
    if (!records.length) return Promise.resolve();
    records.forEach(record => {
      const previous = historyByKey.get(record.key);
      if (!previous) {
        historyByKey.set(record.key, record);
      } else {
        // A first snapshot may have no rider fields. Fill missing attribution
        // from a later export without replacing the first OnHold date.
        historyByKey.set(record.key, {
          ...previous,
          riderId: previous.riderId || record.riderId,
          riderName: previous.riderName || record.riderName,
          atNumber: previous.atNumber || record.atNumber,
          town: previous.town || record.town,
          vehicle: previous.vehicle || record.vehicle,
          area: previous.area || record.area,
          orderId: previous.orderId || record.orderId
        });
      }
    });
    saveLegacyKeys();
    writeChain = writeChain.then(async () => {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      records.forEach(record => store.put(historyByKey.get(record.key) || record));
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("OnHold history write failed"));
        tx.onabort = () => reject(tx.error || new Error("OnHold history write was aborted"));
      });
    }).catch(error => {
      console.warn("BADOC Actual Scanned OnHold history could not be saved:", error);
    });
    return writeChain;
  }
  function captureRows(rows) {
    return persistRecords(collectRows(rows));
  }
  function captureCurrentState() {
    const rows = typeof getParcelCountRows === "function" ? getParcelCountRows() : [];
    const all = Array.isArray(rows) ? rows.slice() : [];
    if (Array.isArray(window.__badocOnholdExportRows)) all.push(...window.__badocOnholdExportRows);
    if (typeof batches !== "undefined" && Array.isArray(batches)) {
      batches.forEach(batch => { if (Array.isArray(batch?.rows)) all.push(...batch.rows); });
    }
    return captureRows(all);
  }
  async function loadHistory() {
    try {
      const db = await openDb();
      const records = await new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error("Could not read OnHold history"));
      });
      records.forEach(record => {
        if (record?.key && record?.tn) historyByKey.set(record.key, record);
      });
      await loadAssignmentTaskRows();
    } catch (error) {
      console.warn("BADOC Actual Scanned OnHold history could not be loaded:", error);
    } finally {
      historyReady = true;
      if (document.getElementById("actualScannedByRiders")?.classList.contains("active")) {
        window.__badocRenderActualScannedByRiders?.();
      }
    }
  }
  function historiesForTrackingNumber(tn) {
    const tnKey = key(tn);
    if (!tnKey) return [];
    return [...historyByKey.values()]
      .filter(record => key(record.tn) === tnKey)
      .sort((a, b) => String(b.onholdDate || "").localeCompare(String(a.onholdDate || "")) || Number(b.recordedAt || 0) - Number(a.recordedAt || 0));
  }
  function findHistory(tn, row, preferredDate = "") {
    const matching = historiesForTrackingNumber(tn);
    if (!matching.length) return null;
    const eventRaw = field(row, ONHOLD_TIME_ALIASES) || field(row, PICKUP_ALIASES);
    const parsed = parseManilaStamp(eventRaw);
    const targetDate = parsed?.dateKey || String(preferredDate || "").trim();
    if (targetDate) return matching.find(record => record.onholdDate === targetDate) || null;
    return matching[0];
  }
  function historyRiderKey(record) {
    if (record?.riderId) return "ID:" + key(record.riderId);
    if (record?.riderName) return "NAME:" + key(record.riderName);
    return "";
  }
  function applyHistory(data) {
    if (!data || !Array.isArray(data.records)) return data;
    data.records.forEach(record => {
      const matching = historiesForTrackingNumber(record.tn);
      const historical = findHistory(record.tn, record.row, record.onhold ? record.date : "");
      record.currentOnhold = record.onhold === true;
      record.everOnhold = matching.length > 0 || record.currentOnhold;
      record.onholdHistory = matching;
      record.onholdDates = [...new Set(matching.map(item => item.onholdDate).filter(Boolean))];
      // Keep current scan attribution and current activity date intact. OnHold
      // history has its own rider/town/vehicle fields so a later status or rider
      // update cannot rewrite who originally handled the OnHold parcel.
      const onholdAttribution = record.currentOnhold
        ? resolveOnholdAttribution({
            tn: record.tn, row: record.row, event: historical, date: record.date,
            actualId: record.actualId, actualName: record.actualName, hasScanner: record.hasScanner
          })
        : null;
      record.onholdRiderId = onholdAttribution?.riderId || "";
      record.onholdRiderName = onholdAttribution?.riderName || "";
      record.onholdRiderKey = onholdAttribution?.riderKey || "";
      record.onholdAtNumber = onholdAttribution?.atNumber || historical?.atNumber || field(record.row, AT_NUMBER_ALIASES);
      record.onholdAttribution = onholdAttribution?.source || (record.everOnhold ? "Historical OnHold" : "");
      record.onholdTown = historical?.town || (record.currentOnhold ? record.town : "");
      record.onholdVehicle = onholdAttribution?.vehicle || historical?.vehicle || (record.currentOnhold ? record.vehicle : "");
      record.onholdDate = historical?.onholdDate || "";
    });
    data.historyRecords = [...historyByKey.values()];
    return data;
  }
  function selectedFilters() {
    return {
      date: document.getElementById("actualScanDate")?.value || todayManilaKey(),
      vehicle: document.getElementById("actualScanVehicle")?.value || "",
      rider: document.getElementById("actualScanRider")?.value || "",
      town: document.getElementById("actualScanTown")?.value || "",
      compare: document.getElementById("actualScanCompare")?.value || "",
      status: document.getElementById("actualScanStatus")?.value || "",
      search: norm(document.getElementById("actualScanSearch")?.value || "")
    };
  }
  function setNumber(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString();
  }
  function normalizedVehicle(value) {
    const valueKey = key(value);
    if (valueKey === "2WH" || valueKey === "2W") return "2WH";
    if (valueKey === "3WH" || valueKey === "3W" || valueKey === "3WC") return "3WH";
    if (valueKey === "FLEXI" || valueKey === "FLEX") return "FLEXI";
    return "UNKNOWN";
  }
  function currentRowMatches(record, filters) {
    if (filters.date && filters.date !== ALL_DATES_VALUE && record.date !== filters.date) return false;
    if (filters.vehicle && record.vehicle !== filters.vehicle) return false;
    const effectiveRiderKey = record.currentOnhold
      ? (record.onholdRiderKey || (record.hasScanner ? record.riderKey : UNATTRIBUTED_RIDER_KEY))
      : record.riderKey;
    if (filters.rider && effectiveRiderKey !== filters.rider) return false;
    if (filters.town && record.town !== filters.town) return false;
    if (filters.compare && record.comparison !== filters.compare) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (filters.search && ![record.actualName, record.actualId, record.tn, record.orderId, record.town, record.assigned, record.status].some(value => norm(value).includes(filters.search))) return false;
    return true;
  }
  function historyRowMatches(record, filters) {
    const resolved = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate });
    const riderKey = resolved.riderKey || UNATTRIBUTED_RIDER_KEY;
    if (filters.date && filters.date !== ALL_DATES_VALUE && record.onholdDate !== filters.date) return false;
    if (filters.vehicle && normalizedVehicle(record.vehicle) !== filters.vehicle) return false;
    if (filters.rider && riderKey !== filters.rider) return false;
    if (filters.town && norm(record.town) !== norm(filters.town)) return false;
    if (filters.compare && filters.compare !== "No planned rider") return false;
    if (filters.status && !["ONHOLD", "ON HOLD", "HISTORICAL ONHOLD"].includes(norm(filters.status).replace(/[_-]+/g, " "))) return false;
    if (filters.search && ![record.riderName, record.riderId, record.tn, record.orderId, record.town, "Historical OnHold"].some(value => norm(value).includes(filters.search))) return false;
    return true;
  }
  function rebuildFilterOptions(data, savedFilters) {
    const filters = savedFilters || selectedFilters();
    const history = [...historyByKey.values()];
    const current = Array.isArray(data?.records) ? data.records : [];
    const rebuild = (id, values, selected, placeholder) => {
      const element = document.getElementById(id);
      if (!element) return;
      const unique = [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      element.innerHTML = '<option value="">' + esc(placeholder) + '</option>' + unique.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join("");
      if (unique.includes(selected)) element.value = selected;
    };
    const dates = [...new Set([todayManilaKey(), ...current.map(record => record.date), ...history.map(record => record.onholdDate)])];
    const riderValues = new Map();
    current.filter(record => record.hasScanner).forEach(record => riderValues.set(record.riderKey, record.actualName));
    history.forEach(record => {
      const resolved = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate });
      const riderKey = resolved.riderKey || UNATTRIBUTED_RIDER_KEY;
      const name = resolved.riderName || "Unattributed OnHold";
      if (name && !riderValues.has(riderKey)) riderValues.set(riderKey, name);
    });
    const dateSelect = document.getElementById("actualScanDate");
    const uniqueDates = [...new Set(dates.map(value => String(value || "").trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    if (dateSelect) {
      dateSelect.innerHTML = '<option value="' + ALL_DATES_VALUE + '">All dates</option>' +
        uniqueDates.map(value => '<option value="' + esc(value) + '">' + esc(value) + '</option>').join("");
      const requestedDate = filters.date || todayManilaKey();
      dateSelect.value = requestedDate === ALL_DATES_VALUE
        ? ALL_DATES_VALUE
        : (uniqueDates.includes(requestedDate) ? requestedDate : todayManilaKey());
    }
    const riderSelect = document.getElementById("actualScanRider");
    if (riderSelect) {
      const values = [...riderValues.entries()].sort((a, b) => a[1].localeCompare(b[1]));
      riderSelect.innerHTML = '<option value="">All riders</option>' + values.map(([value, label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>').join("");
      if (riderValues.has(filters.rider)) riderSelect.value = filters.rider;
    }
    rebuild("actualScanTown", [...current.map(record => record.town), ...history.map(record => record.town)], filters.town, "All towns");
    rebuild("actualScanStatus", [...current.map(record => record.status), "Historical OnHold"], filters.status, "All statuses");
  }
  function refreshVisibleCounts(data, savedFilters) {
    const root = document.getElementById("actualScannedByRiders");
    if (!root) return;
    const filters = savedFilters || selectedFilters();
    rebuildFilterOptions(data, filters);
    const currentRows = (Array.isArray(data.records) ? data.records : []).filter(record => !record.historicalOnly && currentRowMatches(record, filters));
    const historyRows = [...historyByKey.values()].filter(record => historyRowMatches(record, filters));
    const riderStats = new Map();
    const ensureRider = (riderKey, id, name, vehicle) => {
      if (!riderKey) return null;
      if (!riderStats.has(riderKey)) riderStats.set(riderKey, {
        key: riderKey, id: id || "", name: name || (id ? "Driver " + id : "Unidentified"),
        vehicle: normalizedVehicle(vehicle), count: 0, delivered: 0, mismatch: 0,
        everTns: new Set(), currentTns: new Set(), towns: new Map()
      });
      const group = riderStats.get(riderKey);
      if (!group.id && id) group.id = id;
      if ((!group.name || group.name === "Unidentified") && name) group.name = name;
      if (group.vehicle === "UNKNOWN" && vehicle) group.vehicle = normalizedVehicle(vehicle);
      return group;
    };
    const ensureTown = (group, town) => {
      const townName = String(town || "").trim();
      if (!townName) return null;
      const townKey = norm(townName);
      if (!group.towns.has(townKey)) group.towns.set(townKey, {
        town: townName, scanned: 0, delivered: 0, mismatch: 0,
        everTns: new Set(), currentTns: new Set()
      });
      return group.towns.get(townKey);
    };
    currentRows.filter(record => record.hasScanner).forEach(record => {
      const group = ensureRider(record.riderKey, record.actualId, record.actualName, record.vehicle);
      if (!group) return;
      group.count++;
      if (record.delivered) group.delivered++;
      if (record.comparison === "Mismatch") group.mismatch++;
      const town = ensureTown(group, record.town);
      if (town) {
        town.scanned++;
        if (record.delivered) town.delivered++;
        if (record.comparison === "Mismatch") town.mismatch++;
      }
    });
    historyRows.forEach(record => {
      const resolved = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate });
      const riderKey = resolved.riderKey || UNATTRIBUTED_RIDER_KEY;
      const name = resolved.riderName || "Unattributed OnHold";
      const group = ensureRider(riderKey, resolved.riderId, name, resolved.vehicle || record.vehicle);
      if (!group) return;
      const tnKey = key(record.tn);
      if (tnKey) group.everTns.add(tnKey);
      const town = ensureTown(group, record.town);
      if (town && tnKey) town.everTns.add(tnKey);
    });
    // Current OnHold is a live status. Attribute every current OnHold parcel from
    // its matching same-day OnHold event first, then from an actual scanner field.
    // Never substitute a planned town assignment; unknowns remain explicitly visible.
    currentRows.filter(record => record.currentOnhold).forEach(record => {
      const historical = findHistory(record.tn, record.row, record.date);
      const resolved = resolveOnholdAttribution({
        tn: record.tn, row: record.row, event: historical, date: record.date,
        actualId: record.actualId, actualName: record.actualName, hasScanner: record.hasScanner
      });
      const id = resolved.riderId;
      const name = resolved.riderName || "Unattributed OnHold";
      const riderKey = resolved.riderKey || UNATTRIBUTED_RIDER_KEY;
      const group = ensureRider(riderKey, id, name, resolved.vehicle || historical?.vehicle || record.vehicle);
      if (!group) return;
      const tnKey = key(record.tn);
      if (tnKey) group.currentTns.add(tnKey);
      const town = ensureTown(group, historical?.town || record.town);
      if (town && tnKey) town.currentTns.add(tnKey);
    });
    const riders = [...riderStats.values()].map(group => ({
      ...group, ever: group.everTns.size, current: group.currentTns.size
    })).sort((a, b) => b.count - a.count || b.current - a.current || b.ever - a.ever || a.name.localeCompare(b.name));
    const body = document.getElementById("actualScannedRiderBody");
    if (body) body.innerHTML = riders.length ? riders.map(rider => {
      const townRows = [...rider.towns.values()].sort((a, b) =>
        (b.scanned + b.everTns.size) - (a.scanned + a.everTns.size) || a.town.localeCompare(b.town));
      const townList = townRows.length
        ? '<div class="actual-scan-town-dropdown-list">' + townRows.map(town =>
          '<div class="actual-scan-town-dropdown-item"><div class="actual-scan-town-dropdown-name">' + esc(town.town) + '</div>' +
          '<strong>' + town.scanned.toLocaleString() + ' scanned · ' + town.everTns.size.toLocaleString() + ' Ever OnHold</strong>' +
          '<small>Delivered ' + town.delivered.toLocaleString() + ' · Current OnHold ' + town.currentTns.size.toLocaleString() + ' · Mismatch ' + town.mismatch.toLocaleString() + '</small></div>'
        ).join("") + '</div>'
        : '<div class="actual-scan-town-dropdown-empty">No town data for this rider.</div>';
      return '<tr class="actual-scan-rider-row' + (window.__actualScannedSelectedRider === rider.key ? ' is-selected' : '') + '" data-rider-key="' + esc(rider.key) + '">' +
        '<td><strong>' + esc(rider.name) + '</strong><small style="display:block;color:var(--muted);font-size:9px">' + esc(rider.id || "") + '</small></td>' +
        '<td>' + esc(rider.vehicle === "UNKNOWN" ? "Unknown" : rider.vehicle) + '</td>' +
        '<td class="num">' + rider.count.toLocaleString() + '</td><td class="num">' + rider.delivered.toLocaleString() + '</td>' +
        '<td class="num" title="Ever OnHold / Current OnHold">' + rider.ever.toLocaleString() + ' / ' + rider.current.toLocaleString() + '</td>' +
        '<td class="num">' + rider.mismatch.toLocaleString() + '</td>' +
        '<td><details class="actual-scan-town-dropdown"><summary>' + rider.towns.size.toLocaleString() + ' towns <span aria-hidden="true">▾</span></summary>' + townList + '</details></td></tr>';
    }).join("") : '<tr><td colspan="7" class="actual-scan-empty">No rider scan or OnHold history for these filters.</td></tr>';

    const actualRiderKeys = new Set(currentRows.filter(record => record.hasScanner).map(record => record.riderKey));
    // A matching OnHold event is also evidence of an actual rider scan, even
    // when the current parcel snapshot has no Driver ID / Driver Name fields.
    historyRows.forEach(record => {
      const riderKey = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate }).riderKey;
      if (riderKey) actualRiderKeys.add(riderKey);
    });
    currentRows.filter(record => record.currentOnhold).forEach(record => {
      const riderKey = record.onholdRiderKey || "";
      if (riderKey && riderKey !== UNATTRIBUTED_RIDER_KEY) actualRiderKeys.add(riderKey);
    });
    const actualRiders = riders.filter(rider => actualRiderKeys.has(rider.key));
    setNumber("actualScannedParcels", currentRows.filter(record => record.hasScanner).length);
    setNumber("actualScannedRiders", actualRiders.length);
    setNumber("actualScanned2WH", actualRiders.filter(rider => rider.vehicle === "2WH").length);
    setNumber("actualScanned3WH", actualRiders.filter(rider => rider.vehicle === "3WH").length);
    setNumber("actualScannedFlexi", actualRiders.filter(rider => rider.vehicle === "FLEXI").length);
    setNumber("actualScannedMismatches", currentRows.filter(record => record.hasScanner && record.comparison === "Mismatch").length);
    const note = document.getElementById("actualScannedNote");
    if (note) {
      const currentOnholdRows = currentRows.filter(record => record.currentOnhold);
      const currentCount = currentOnholdRows.length;
      const attributedCurrentCount = currentOnholdRows.filter(record => !!record.onholdRiderKey).length;
      const unattributedCurrentCount = Math.max(0, currentCount - attributedCurrentCount);
      const taskCount = currentOnholdRows.filter(record => record.onholdAttribution === "Assignment Task export").length;
      const atCount = currentOnholdRows.filter(record => record.onholdAttribution === "AT Number map" || record.onholdAttribution === "Assignment Task AT match").length;
      const historyCount = historyRows.length;
      note.textContent = currentRows.filter(record => record.hasScanner).length.toLocaleString() +
        ' current scanned parcel(s); ' + currentCount.toLocaleString() + ' current OnHold (' +
        attributedCurrentCount.toLocaleString() + ' attributed, ' + taskCount.toLocaleString() +
        ' via Assignment Task export, ' + atCount.toLocaleString() + ' via AT Number map, and ' +
        unattributedCurrentCount.toLocaleString() + ' still unattributed). ' + historyCount.toLocaleString() +
        ' OnHold history event(s) in the selected filters. Event scanner identity takes priority; AT matching is used only when event/scanner identity is missing. Town assignment is never used as proof of actual scanning.';
    }

    const selectedRider = filters.rider || window.__actualScannedSelectedRider || "";
    const detail = document.getElementById("actualScannedDetail");
    const detailBody = document.getElementById("actualScannedDetailBody");
    if (detailBody) detailBody.querySelectorAll("tr[data-history-event-row]").forEach(row => row.remove());
    const selectedHistory = historyRows.filter(record =>
      (resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate }).riderKey || UNATTRIBUTED_RIDER_KEY) === selectedRider
    );
    if (detail && detailBody && selectedRider && selectedHistory.length) {
      detail.hidden = false;
      const rider = riderStats.get(selectedRider);
      const heading = document.getElementById("actualScannedDetailTitle");
      if (heading && rider) heading.textContent = rider.name + ' · ' + rider.ever.toLocaleString() + ' Ever OnHold';
      selectedHistory.forEach(record => {
        const row = document.createElement("tr");
        row.dataset.historyEventRow = "true";
        const resolved = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate });
        row.innerHTML = '<td>' + esc(record.orderId || "—") + '</td><td>' + esc(record.tn) + '</td><td>' + esc(record.town || "—") + '</td>' +
          '<td>Historical OnHold · ' + esc(record.onholdDate || "") + '</td><td>' + esc(resolved.riderName || "Unattributed OnHold") + '</td><td>—</td>' +
          '<td><span class="actual-scan-pill unplanned">' + esc(resolved.source) + '</span></td>';
        detailBody.appendChild(row);
      });
      const detailNote = document.getElementById("actualScannedDetailNote");
      if (detailNote) detailNote.textContent = 'Historical OnHold events are shown below the current parcel rows. Export Filtered CSV includes both current parcel records and these OnHold history events.';
    }

    const currentCsv = currentRows.map(record => {
      const histories = historiesForTrackingNumber(record.tn);
      const onholdEvent = record.currentOnhold ? findHistory(record.tn, record.row, record.date) : null;
      const resolved = record.currentOnhold ? resolveOnholdAttribution({
        tn: record.tn, row: record.row, event: onholdEvent, date: record.date,
        actualId: record.actualId, actualName: record.actualName, hasScanner: record.hasScanner
      }) : null;
      const onholdRiderId = resolved?.riderId || "";
      const onholdRiderName = resolved?.riderName || "";
      const onholdAttribution = record.currentOnhold ? (resolved?.source || "Unattributed OnHold") :
        (histories.length ? "Historical OnHold recorded" : "Not OnHold");
      return {
        "Record Type": "Current parcel", "Order ID": record.orderId, "SPX Tracking Number": record.tn,
        "Town": record.town, "Activity Date": record.date, "Status": record.status,
        "Actual Rider": record.actualName, "Actual Rider ID": record.actualId, "Vehicle": record.vehicle,
        "OnHold Rider": record.currentOnhold ? (onholdRiderName || "Unattributed OnHold") : "",
        "OnHold Rider ID": onholdRiderId, "OnHold AT Number": resolved?.atNumber || "",
        "OnHold Attribution": onholdAttribution,
        "Assigned Rider": record.assigned, "Assignment Result": record.comparison,
        "Ever OnHold": histories.length || record.currentOnhold ? "Yes" : "No",
        "Current OnHold": record.currentOnhold ? "Yes" : "No",
        "OnHold Dates": [...new Set(histories.map(item => item.onholdDate).filter(Boolean))].join("; ")
      };
    });
    const historyCsv = historyRows.map(record => {
      const resolved = resolveOnholdAttribution({ tn: record.tn, event: record, date: record.onholdDate });
      return {
        "Record Type": "OnHold history", "Order ID": record.orderId || "", "SPX Tracking Number": record.tn,
        "Town": record.town || "", "Activity Date": record.onholdDate || "", "Status": "Historical OnHold",
        "Actual Rider": record.riderName || "", "Actual Rider ID": record.riderId || "",
        "OnHold Rider": resolved.riderName || "Unattributed OnHold", "OnHold Rider ID": resolved.riderId || "",
        "OnHold AT Number": resolved.atNumber || record.atNumber || "", "OnHold Attribution": resolved.source,
        "Vehicle": normalizedVehicle(resolved.vehicle || record.vehicle), "Assigned Rider": "", "Assignment Result": "Historical event",
        "Ever OnHold": "Yes", "Current OnHold": "Unknown", "OnHold Dates": record.onholdDate || ""
      };
    });
    root.__actualCsv = [...currentCsv, ...historyCsv];
  }

  function patchedRender() {
    // Move to the new Manila operating date after midnight. Explicit All dates
    // remains a user choice until the next Manila date rollover.
    const today = todayManilaKey();
    const dateSelect = document.getElementById("actualScanDate");
    if (lastRenderManilaDayKey && lastRenderManilaDayKey !== today && dateSelect) dateSelect.value = today;
    lastRenderManilaDayKey = today;
    // Capture filter selections before the base renderer rebuilds its dropdowns;
    // the history module then restores values that exist only in OnHold history.
    const savedFilters = selectedFilters();
    // Save the old snapshot before the main message handler can replace it.
    captureCurrentState();
    if (baseRender) baseRender();
    if (!baseGetData || !historyReady) return;
    try {
      const data = applyHistory(baseGetData());
      refreshVisibleCounts(data, savedFilters);
      window.__badocActualScannedHistoryReady = true;
    } catch (error) {
      console.warn("BADOC Actual Scanned historical OnHold rendering failed:", error);
    }
  }

  // Capture the previous export snapshot before the dashboard replaces it,
  // then request the separate Assignment Task mapping automatically.
  window.addEventListener("message", event => {
    const message = event?.data;
    if (message?.type !== "BADOC_ASSIGNED_ONHOLD_TODAY_COMPLETE") return;
    captureRows(Array.isArray(window.__badocOnholdExportRows) ? window.__badocOnholdExportRows : []);
    captureRows(Array.isArray(message.onholdRows) ? message.onholdRows : []);
    requestAssignmentTaskExport();
  }, true);
  window.addEventListener("badoc:parcel-data-updated", captureCurrentState);
  window.addEventListener("badoc:assignment-task-updated", function () {
    acceptAssignmentTaskExport().catch(error => setAssignmentTaskStatus(error?.message || String(error), true));
  });
  // Surface automatic Assignment Task bridge errors and allow a later retry.
  window.addEventListener("badoc:assignment-task-error", event => {
    assignmentTaskRequestDate = "";
    setAssignmentTaskStatus(event.detail?.message || "Automatic Assignment Task export failed.", true);
  });

  baseRender = window.__badocRenderActualScannedByRiders || null;
  baseGetData = window.__badocGetActualScannedByRidersData || null;
  if (baseGetData) {
    window.__badocGetActualScannedByRidersData = function () {
      captureCurrentState();
      return applyHistory(baseGetData());
    };
  }
  if (baseRender) window.__badocRenderActualScannedByRiders = patchedRender;

  // Load history first, then capture the currently available uploads/exports.
  loadHistory().then(() => {
    captureCurrentState();
    requestAssignmentTaskExport();
  });
  Promise.resolve(window.__badocOnholdExportsReady).then(() => captureCurrentState()).catch(() => {});
})();
