importScripts("xlsx.js");
const SPX_ORIGIN = "https://spx.shopee.ph";
const ASSIGNMENT_TASK_EXPORT_PATH = "/spx_delivery/admin/assignment/assignment_task/export";
const ASSIGNMENT_TASK_EXPORT_BIZ_NAME = "delivery_mgt";
const ASSIGNMENT_TASK_EXPORT_NAME = "feeder_assignment_task";
const ASSIGNMENT_TASK_STATION_ID = 3061;
const TASK_LIST_PATH = "/spxdata/api/export_platform/export_task/list_for_portal";
const SIGNED_URL_PATH = "/spxdata/api/export_platform/export_task/get_signed_download_url";
const EXPORT_NAME = "inbound_to_from_spx";
const STATION_ID = 3061; // legacy Badoc fallback only; not used to validate hub-aware jobs
const VERSION = chrome.runtime.getManifest().version;
const RIDER_EXPORT_PATH = "/api/driverservice/admin/driver/export";
const RIDER_TASK_LIST_PATH = "/spxdata/api/export_platform/export_task/list_for_portal";
const RIDER_EXPORT_NAME = "spx_driver";
const RIDER_EXPORT_BIZ_NAME = "driver";


const POLL_MS = 3000;
const ASSIGNMENT_TASK_MEDIA_ID_WAIT_MS = 30 * 1000; // allow SPX time to attach export media metadata after success
const ASSIGNMENT_TASK_MEDIA_ID_POLL_MS = 4000;
const LINEHAUL_POLL_MS = 2000;
const MAX_WAIT_MS = 25 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;
const PARCEL_EXPORT_NAME = "export_forward_order";
const PARCEL_EXPORT_BIZ_NAME = "fleet_order";
// Received Checking-only exports (kept separate from the host app's existing Parcel Count sync).
const PARCEL_SECONDARY_TRANSPORT_STATUS_ID = 36;
const PARCEL_SECONDARY_RETURN_STATUS_ID = 10;
const PARCEL_SECONDARY_TRANSPORT_STATUS_NAME = "SOC_LHTransported";
const PARCEL_SECONDARY_RETURN_STATUS_NAME = "Return_LMHub_Received";
const PARCEL_RETURN_EXPORT_PATH = "/api/admin/tracking/am_hub/return/export";
const FM_PICKUP_ORDER_PATH = "/api/admin/pickup/fm_hub/pickup_order/export";
const FM_PICKUP_TASK_PATH = "/api/admin/pickup/fm_hub/pickup_task/export";
const FM_ORDER_LOOKBACK_DAYS = 14;
const PARCEL_STATION_ID = 3061; // legacy Badoc fallback only; not used to validate hub-aware jobs
const PARCEL_INBOUND_STATUS_IDS = [1, 882, 35, 34, 36, 15, 928, 918, 33, 9, 7, 8, 630, 49, 50];
const PARCEL_INBOUND_STATUS_SET = new Set(PARCEL_INBOUND_STATUS_IDS.map(String));
const PARCEL_NATIVE_WAIT_MS = 60000;

// Direct native Forward Order export API.
// This replaces the fragile Order Tracking Export dialog automation for
// Parcel Count inbound sync. The request is the same native endpoint captured
// from SPX's own Forward Order export flow.
const PARCEL_FORWARD_EXPORT_PATH = "/api/admin/tracking/am_hub/forward/export";
const PARCEL_FORWARD_STATUS_NAMES = [
  "LMHub_Received",
  "LMHub_Assigning",
  "LMHub_Assigned",
  "SOC_LHArrived",
  "SOC_LHPacked",
  "SOC_LHPacking",
  "SOC_LHTransported",
  "SOC_LHTransporting",
  "SOC_LHUnloaded",
  "SOC_LHUnloading",
  "SOC_Packed",
  "SOC_Packing",
  "SOC_PendingReceive",
  "SOC_Received",
  "SOC_Staging"
];
const PARCEL_FORWARD_EXPORT_LOOKBACK_DAYS = 14;

// Direct native Forward Order export for today's Filtered Assigned
// Delivering / Delivered / OnHold population.
const PARCEL_DELIVERY_STATUS_IDS = [4, 2, 5];
const PARCEL_DELIVERY_STATUS_NAMES = ["Delivered", "Delivering", "OnHold"];
const PARCEL_DELIVERY_LOOKBACK_DAYS = 14;
const PARCEL_DELIVERY_STATION_ID = 3061; // legacy Badoc fallback only; not used to validate hub-aware jobs

// Current native SPX Inbound -> TO List export endpoint captured from
// the authenticated SPX page. The previous /api/instation/... route now
// returns the SPA HTML shell instead of the export JSON.
const LINEHAUL_EXPORT_PATH = "/api/in-station/receive/to/export";
const LINEHAUL_FORMAT_CONDITION = "Status=Pending Receive;Operator=All";
const LINEHAUL_STATION_ID = 3061; // legacy Badoc fallback only; not used to validate hub-aware jobs
const LINEHAUL_BIZ_NAME = "instation";
const LINEHAUL_EXPORT_NAME = "inbound_to_from_spx";

// SPX's current native request includes these request-security headers.
// They can rotate with the authenticated browser session, so the captured
// values are used as a fallback rather than being treated as permanent API
// credentials. Cookie-derived values are preferred when available.
const LINEHAUL_CAPTURED_HEADERS = {
  "PG-I": "ncZVlzAW7OdXd+GiOQFJwNfieqVj6a5NTeowDIjPJ8FvkQn8ZVIKnWHbAWmWKSzLGM1K16QE+zkGcwrRskQ=",
  "X-CSRFToken": "1dfd58cfabd4476eb07678cd79d99b2e",
  "x-sap-ri": "8282c36afb1f978f0a5a3b330101f1fe7cbf75952de0992d73e4",
  "app": "FMS Portal",
  "device-id": "3364e655404ce13752579f775532ac7f",
  "x-sap-sec": "p9qbfo5imzAjyzAjzRAwyzzjzRAjyzzjyzAfyzAjczXjyjRiyzAzyzAjQC/Eh55jyzA6yAAjbzXjylAbDsxav28gr8sidNCFtWh9EUBP5qPMrQzAVEjxGHv12IhJyWLShjOYuyUSKJCnqMXW371eYH3I27gCUJ6yCfNuhP3L2wbsKIKIeTuYvdopbwvC1Psh80LdSKjXL+MAdv1qc/XWRzcllN820mOjcrDf/4PdwO6681mrblU9ei8DugeQoH3XPOo9QnKjwk0Kh/Ndo4806oZBMyOo7HC2/xS1vM5+J2cGqqvr9oRYGCXztSPKv9XJGKd1dp9uQ3t12N9Zipy8iWOaqBRmdwjYw4uTnfiSB2KBRUFh1AvJtZYmCifx3eFSKUOd5MMRti3Qqh7/ik8wLPEF094xNCG8uwEL+Pt2ccSZTZ+TyK6R2MWqnDxxt3ZpHNZH6anQWAepyol8HwyzAjVQa+YguPwQwjyzAjJCKEh55jyzAVyzAjjzAjyYQFX3uBfFtbbS2fGhePfJfBhTnolzAjyla+Y8jrwM1ByzAjyC=="
};




const badocPorts = new Set();
// Allow only the compatible Sync All exports to overlap: Received, Assigned Today,
// and First Mile start together; Linehaul may join after Received finishes.
// Other SPX jobs remain mutually exclusive to avoid tab/API collisions.
const activeJobs = new Map();
const PARALLEL_JOB_ALLOWLIST = {
  "parcel-inbound": new Set(["parcel-delivery", "parcel-secondary", "first-mile-orders", "first-mile-tasks", "linehaul", "assigned-onhold-today"]),
  "parcel-delivery": new Set(["parcel-inbound", "parcel-secondary", "first-mile-orders", "first-mile-tasks", "linehaul"]),
  "parcel-secondary": new Set(["parcel-inbound", "parcel-delivery", "first-mile-orders", "first-mile-tasks", "linehaul"]),
  "first-mile-orders": new Set(["parcel-inbound", "parcel-delivery", "parcel-secondary", "first-mile-tasks", "linehaul", "assigned-onhold-today"]),
  "first-mile-tasks": new Set(["parcel-inbound", "parcel-delivery", "parcel-secondary", "first-mile-orders", "linehaul", "assigned-onhold-today"]),
  "linehaul": new Set(["parcel-inbound", "parcel-delivery", "parcel-secondary", "first-mile-orders", "first-mile-tasks", "assigned-onhold-today"]),
  "assigned-onhold-today": new Set(["parcel-inbound", "first-mile-orders", "first-mile-tasks", "linehaul"]),
  "batch-search-result": new Set(["assignment-task"])
};

function sendToPort(port, type, data = {}) {
  if (!port) return false;
  try {
    port.postMessage({ type, ...data });
    return true;
  } catch {
    return false;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function canStartActiveJob(kind, ownerPort) {
  if (activeJobs.has(kind)) return false;
  const running = [...activeJobs.values()];
  if (!running.length) return true;
  const allowed = PARALLEL_JOB_ALLOWLIST[kind];
  return !!allowed && running.every(job => job.ownerPort === ownerPort && allowed.has(job.kind));
}

function reserveActiveJob(kind, ownerPort, extra = {}) {
  if (!canStartActiveJob(kind, ownerPort)) return null;
  const job = { kind, ownerPort, startedAt: 0, spxTabId: null, cancelled: false, ...extra };
  activeJobs.set(kind, job);
  return job;
}

function releaseActiveJob(job) {
  if (job && activeJobs.get(job.kind) === job) activeJobs.delete(job.kind);
}

function sendToBadoc(type, data = {}) {
  // Compatible parallel jobs are required to come from the same BADOC page.
  // Keep all progress/import results attached to that page, not other tabs.
  const owners = [...new Set([...activeJobs.values()].map(job => job.ownerPort).filter(Boolean))];
  if (owners.length === 1) return sendToPort(owners[0], type, data);
  if (owners.length > 1) return owners.reduce((sent, port) => sendToPort(port, type, data) || sent, false);
  let sent = false;
  for (const port of badocPorts) {
    if (sendToPort(port, type, data)) sent = true;
  }
  return sent;
}

function progress(message, extra = {}) {
  const phase = String(extra.phase || "");
  const kind = extra.kind || (phase.startsWith("parcel-delivery") ? "parcel-delivery" :
    phase.startsWith("parcel-") ? "parcel-inbound" :
    phase.startsWith("linehaul") ? "linehaul" : undefined);
  sendToBadoc("BADOC_SPX_PROGRESS", { message, ...extra, ...(kind ? { kind } : {}) });
}

function riderProgress(message, extra = {}) {
  sendToBadoc("BADOC_SPX_RIDER_PROGRESS", { message, ...extra, kind: "riders" });
}


async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function extensionFetchText(url, init = {}) {
  const controller = new AbortController();
  try {
    return await withTimeout((async () => {
      const response = await fetch(url, {
        credentials: "include", cache: "no-store", redirect: "follow",
        ...init, signal: controller.signal,
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Cache-Control": "no-cache", "Pragma": "no-cache",
          ...(init.headers || {})
        }
      });
      const text = await response.text();
      return {
        status: response.status, ok: response.ok,
        contentType: response.headers.get("content-type") || "",
        contentDisposition: response.headers.get("content-disposition") || "",
        text
      };
    })(), FETCH_TIMEOUT_MS, "SPX request");
  } catch (error) {
    controller.abort();
    throw error;
  }
}

async function extensionFetchBuffer(url, init = {}) {
  const controller = new AbortController();
  try {
    return await withTimeout((async () => {
      const response = await fetch(url, {
        credentials: "include", cache: "no-store", redirect: "follow",
        ...init, signal: controller.signal,
        headers: {
          "Accept": "*/*", "Cache-Control": "no-cache", "Pragma": "no-cache",
          ...(init.headers || {})
        }
      });
      const buffer = await response.arrayBuffer();
      return {
        status: response.status, ok: response.ok,
        contentType: response.headers.get("content-type") || "",
        contentDisposition: response.headers.get("content-disposition") || "",
        buffer
      };
    })(), FETCH_TIMEOUT_MS, "SPX file request");
  } catch (error) {
    controller.abort();
    throw error;
  }
}

function firstMileRowsToCsv(rows) {
  const cell = value => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map(row => row.map(cell).join(",")).join("\n");
}

function firstMileCsvFileName(sourceName, fallbackName) {
  const raw = String(sourceName || fallbackName || "first_mile_export.csv").split(/[\\/]/).pop().trim();
  const stem = raw.replace(/\.(?:xlsx?|csv|txt)$/i, "").replace(/[^a-z0-9._-]+/gi, "_").replace(/^\.+|\.+$/g, "") || "first_mile_export";
  return `${stem}.csv`;
}

async function firstMileBufferToCsv(buffer, fallbackName, contentDisposition = "") {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length) throw new Error("SPX returned an empty First Mile export file.");
  let csvText;
  if (bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const rows = await xlsxToRows(buffer);
    if (!Array.isArray(rows) || !rows.length || !rows[0]?.some(value => String(value ?? "").trim())) {
      throw new Error("SPX returned an Excel file, but no worksheet headers could be read.");
    }
    csvText = firstMileRowsToCsv(rows);
  } else {
    csvText = new TextDecoder("utf-8").decode(bytes);
  }
  csvText = String(csvText || "").replace(/^\uFEFF/, "");
  const trimmed = csvText.trim();
  if (!trimmed) throw new Error("SPX returned an empty First Mile export file.");
  if (/^(\{|\[|<!doctype|<html)/i.test(trimmed)) {
    throw new Error("SPX returned a JSON ticket or HTML page instead of the First Mile export file.");
  }
  let sourceName = fallbackName;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^;\"\r\n]+)/i);
  if (match?.[1]) {
    try { sourceName = decodeURIComponent(match[1].trim()); } catch { sourceName = match[1].trim(); }
  }
  // SPX may name the source workbook .xlsx. The extension converts it to CSV,
  // so the saved copy must always carry a .csv extension.
  return { text: csvText, fileName: firstMileCsvFileName(sourceName, fallbackName) };
}

async function downloadFirstMileExportFile(signedUrl, fallbackName) {
  const response = await extensionFetchBuffer(signedUrl, {
    headers: { "Accept": "text/csv, text/plain, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/octet-stream, */*" }
  });
  if (!response.ok) throw new Error(`First Mile export download failed (HTTP ${response.status}).`);
  let disposition = response.contentDisposition || "";
  if (!disposition) {
    const signedName = fileNameFromSignedUrl(signedUrl);
    if (signedName) disposition = `attachment; filename="${signedName.replace(/"/g, "")}"`;
  }
  return firstMileBufferToCsv(response.buffer, fallbackName, disposition);
}

function getFirstMileTaskId(json) {
  const data = Array.isArray(json?.data) ? (json.data[0] || {}) : (json?.data || {});
  const candidates = [
    data?.task_id, data?.taskId, data?.export_task_id, data?.exportTaskId, data?.id,
    json?.task_id, json?.taskId, json?.export_task_id, json?.exportTaskId
  ];
  for (const value of candidates) {
    const id = Number(value || 0);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return 0;
}

function getFirstMileFileName(json) {
  const data = Array.isArray(json?.data) ? (json.data[0] || {}) : (json?.data || {});
  return String(data?.file_name || data?.filename || data?.fileName || json?.file_name || json?.filename || "").trim();
}

async function discoverFirstMileTask(startSec, fileName, kind, job) {
  const wanted = kind === "first-mile-orders" ? /order/ : /task/;
  const avoid = kind === "first-mile-orders" ? /task/ : /order/;
  const hint = String(fileName || "").toLowerCase().replace(/\.(?:xlsx?|csv)$/i, "").replace(/^live_/, "");
  let newestSeen = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    if (job.cancelled) throw new Error("Sync cancelled.");
    // Pickup exports can be registered in the FM task source rather than the
    // default FMS task list. Query both source partitions and the default list,
    // and inspect several pages so a busy hub cannot hide the new export.
    const taskSets = await Promise.all(["fm", "fms", ""].flatMap(source => [
      { source, omitStartTime: false },
      { source, omitStartTime: true }
    ]).map(async ({ source, omitStartTime }) => {
      const pages = [];
      for (let page = 1; page <= 3; page++) {
        try {
          const batch = await listTasks(startSec, source, page, omitStartTime);
          pages.push(...batch);
          if (batch.length < 100) break;
        } catch (error) {
          if (page === 1) pages.push({ __list_error: `${source || "default"}${omitStartTime ? " unfiltered" : " recent"}: ${error?.message || String(error)}` });
          break;
        }
      }
      return pages;
    }));
    const tasks = [...new Map(taskSets.flat().filter(task => !task?.__list_error).map(task => [String(task?.task_id || JSON.stringify(task)), task])).values()];
    const values = task => {
      const parts = [];
      const visit = value => {
        if (typeof value === "string" || typeof value === "number") parts.push(String(value));
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") Object.values(value).forEach(visit);
      };
      visit(task);
      return parts.join(" ").toLowerCase();
    };
    const taskIdOf = task => Number(task?.task_id || task?.taskId || task?.export_task_id || task?.exportTaskId || task?.id || 0);
    const eligible = tasks.filter(task => {
      if (!(taskIdOf(task) > 0)) return false;
      const joined = values(task);
      // The Pickup Orders endpoint currently registers its export under the
      // generic fleet_order_export_forward task type. It does not include the
      // word "pickup", so the previous pickup-only test silently missed it.
      const pickupNameMatch = !!hint && joined.includes(hint);
      const pickupTypeMatch = joined.includes("pickup") && wanted.test(joined) && !avoid.test(joined);
      const fleetPickupOrderMatch = kind === "first-mile-orders" &&
        /fleet_order_export_forward/.test(joined) &&
        !/pickup_task|task_export/.test(joined);
      return pickupNameMatch || pickupTypeMatch || fleetPickupOrderMatch;
    }).sort((a,b) => taskIdOf(b) - taskIdOf(a));
    if (eligible.length) return eligible[0];
    newestSeen = tasks.slice(0, 8).map(task => `#${taskIdOf(task) || "?"} ${values(task).slice(0, 110)}`).join(" || ");
    progress(`${kind === "first-mile-orders" ? "First Mile Orders" : "First Mile Tasks"}: locating the SPX export task across FM/FMS task lists…`, {
      phase: "first-mile-discover-task", kind, attempt: attempt + 1
    });
    await sleep(2500);
  }
  job.firstMileTaskListPreview = newestSeen || "No matching export task appeared in FM, FMS, or default task lists.";
  return null;
}

async function getFirstMileSignedDownloadUrl(taskId) {
  let lastError = "";
  for (const source of ["fms", "fm", ""]) {
    const query = `${source ? `source=${source}&` : ""}task_id=${encodeURIComponent(taskId)}`;
    try {
      const response = await extensionFetchText(`${SPX_ORIGIN}${SIGNED_URL_PATH}?${query}`);
      const json = parseJsonResponse("SPX First Mile signed download URL", response);
      if (Number(json?.retcode) !== 0) {
        lastError = json?.message || "SPX did not return a signed download URL.";
        continue;
      }
      const url = String(json?.data?.download_url || json?.data?.url || json?.download_url || "").trim();
      if (url) return url;
      lastError = "SPX returned no signed download URL.";
    } catch (error) { lastError = error?.message || String(error); }
  }
  throw new Error(lastError || "SPX did not return a First Mile download URL.");
}

function parseJsonResponse(label, response) {
  const raw = String(response?.text || "");
  try {
    return JSON.parse(raw);
  } catch {
    const preview = raw.replace(/\s+/g, " ").slice(0, 260);
    if (/<!doctype|<html/i.test(preview)) {
      throw new Error(`${label}: SPX returned the web app HTML instead of JSON (HTTP ${response?.status || 0}).`);
    }
    throw new Error(`${label}: SPX returned non-JSON data (HTTP ${response?.status || 0}, ${response?.contentType || "unknown"}).`);
  }
}

function getExportTaskId(task, depth = 0) {
  if (task == null || depth > 4) return 0;
  if (Array.isArray(task)) { for (const item of task) { const id = getExportTaskId(item, depth + 1); if (id) return id; } return 0; }
  if (typeof task !== "object") return 0;
  for (const key of ["task_id", "taskId", "export_task_id", "exportTaskId", "id"]) {
    const id = Number(task[key] || 0); if (Number.isFinite(id) && id > 0) return id;
  }
  for (const key of ["task", "export_task", "exportTask", "data", "result"]) { const id = getExportTaskId(task[key], depth + 1); if (id) return id; }
  return 0;
}
function findExportTaskRows(value, depth = 0) {
  if (value == null || depth > 6) return null;
  if (Array.isArray(value)) {
    if (value.some(item => getExportTaskId(item) > 0)) return value;
    for (const item of value) { const nested = findExportTaskRows(item, depth + 1); if (nested) return nested; }
    return null;
  }
  if (typeof value !== "object") return null;
  const entries = Object.entries(value).sort(([a], [b]) => {
    const score = key => /task/i.test(key) ? 0 : /list|record|result|data/i.test(key) ? 1 : 2;
    return score(a) - score(b);
  });
  for (const [, child] of entries) { const nested = findExportTaskRows(child, depth + 1); if (nested) return nested; }
  return null;
}
async function listTasks(startSec, source = "", page = 1, omitStartTime = false, taskId = 0) {
  const sourceParam = source ? `&source=${encodeURIComponent(source)}` : "";
  const startParam = omitStartTime ? "" : `start_time=${encodeURIComponent(startSec)}&`;
  const taskIdParam = taskId ? `&task_ids=${encodeURIComponent(taskId)}` : "";
  const url = `${SPX_ORIGIN}${TASK_LIST_PATH}?${startParam}count=100&pageno=${Math.max(1, Number(page) || 1)}${sourceParam}${taskIdParam}`;
  const response = await extensionFetchText(url);
  const json = parseJsonResponse("SPX export task list", response);
  if (Number(json?.retcode) !== 0) throw new Error(json?.message || "SPX task list request failed.");
  const known = [json?.data?.task_list,json?.data?.list,json?.data?.tasks,json?.task_list,json?.list,json?.tasks,Array.isArray(json?.data)?json.data:null].filter(Array.isArray);
  const populated = known.find(rows => rows.length && rows.some(row => getExportTaskId(row) > 0));
  if (populated) return populated;
  const nested = findExportTaskRows(json?.data) || findExportTaskRows(json);
  if (nested) return nested;
  return known[0] || [];
}

function getExportMediaId(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 18) return "";
  if (typeof value === "string") {
    const text = value.trim();
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try { return getExportMediaId(JSON.parse(text), depth + 1, seen); } catch {}
    }
    return "";
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "";
    seen.add(value);
    for (const item of value) {
      const found = getExportMediaId(item, depth + 1, seen);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);
  for (const key of ["media_id", "mediaId", "mediaID"]) {
    const raw = value[key];
    if (raw != null && (typeof raw !== "object" || Array.isArray(raw)) && String(raw).trim()) return String(raw).trim();
  }
  for (const key of ["media", "media_info", "mediaInfo", "media_file", "mediaFile", "export_file", "exportFile", "file_info", "fileInfo", "attachment"]) {
    const child = value[key];
    if (!child || typeof child !== "object") continue;
    for (const idKey of ["media_id", "mediaId", "mediaID", "file_id", "fileId", "id"]) {
      const raw = child[idKey];
      if (raw != null && String(raw).trim()) return String(raw).trim();
    }
  }
  const entries = Object.entries(value).sort(([a], [b]) => {
    const score = key => /media|file|attachment|data|result|task/i.test(key) ? 0 : 1;
    return score(a) - score(b);
  });
  for (const [, child] of entries) {
    const found = getExportMediaId(child, depth + 1, seen);
    if (found) return found;
  }
  return "";
}

async function getSignedDownloadUrl(taskId, preferredSource = "fms", mediaId = "") {
  let lastError = "";
  const media = String(mediaId || "").trim();
  const sources = [...new Set([preferredSource, "fms", "fm", ""])];
  for (const source of sources) {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    params.set("task_id", String(taskId));
    if (media) params.set("media_id", media);
    try {
      const response = await extensionFetchText(`${SPX_ORIGIN}${SIGNED_URL_PATH}?${params.toString()}`);
      const json = parseJsonResponse("SPX signed download URL", response);
      if (Number(json?.retcode) !== 0) { lastError = json?.message || "SPX did not return a signed download URL."; continue; }
      const url = String(json?.data?.download_url || json?.data?.url || json?.download_url || "").trim();
      if (url) return url;
      lastError = `SPX returned no signed download URL for the ${source || "default"} queue.`;
    } catch (error) { lastError = error?.message || String(error); }
  }
  throw new Error(lastError || "SPX did not return a signed download URL.");
}

function fileNameFromSignedUrl(signedUrl) {
  let fallback = "inbound_to_from_spx.csv";
  try {
    const u = new URL(signedUrl);
    const disposition = u.searchParams.get("response-content-disposition") || "";
    const match = disposition.match(/filename(?:\*)?=(?:UTF-8''|\"?)([^;\r\n\"]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1].trim());
  } catch {}
  return fallback;
}

async function downloadCsv(signedUrl) {
  const response = await extensionFetchText(signedUrl, {
    headers: { "Accept": "text/csv,text/plain,*/*" }
  });
  if (!response.ok) {
    throw new Error(`CSV download failed (HTTP ${response.status}).`);
  }
  const text = String(response.text || "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("SPX returned an empty CSV file.");
  return {
    text,
    fileName: fileNameFromSignedUrl(signedUrl)
  };
}


function parseAssignedExportCsvRows(source) {
  const input = String(source || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      row.push(field);
      if (row.some(value => String(value).trim())) rows.push(row);
      row = []; field = "";
      if (ch === "\r" && input[i + 1] === "\n") i++;
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some(value => String(value).trim())) rows.push(row);
  }
  return rows;
}

function extractAssignedParcelOidsFromRows(headers, rows) {
  const normalizedHeaders = (Array.isArray(headers) ? headers : [])
    .map(value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const orderIdColumns = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter(item => /^(oid|orderid|orderno|ordernumber|ordersn|shipmentid|shipmentno)$/.test(item.header))
    .map(item => item.index);
  const oidPattern = /^(?:PH|SPEPH)[A-Z0-9]{8,}$/i;
  const found = new Set();
  const addValues = values => {
    for (const raw of values) {
      const value = String(raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
      if (oidPattern.test(value)) found.add(value);
    }
  };
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (orderIdColumns.length) addValues(orderIdColumns.map(index => row[index]));
    else addValues(row);
  }
  if (!found.size && orderIdColumns.length) {
    for (const row of rows) addValues(row);
  }
  return [...found];
}

function normalizeAssignedExportHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findAssignedExportColumn(headers, aliases) {
  const wanted = new Set(aliases.map(normalizeAssignedExportHeader));
  return (Array.isArray(headers) ? headers : []).findIndex(header =>
    wanted.has(normalizeAssignedExportHeader(header))
  );
}

function philippineDateKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{10}$/.test(raw) || /^\d{13}$/.test(raw)) {
    const millis = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
    const date = new Date(millis);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || "";
    return part("year") + "-" + part("month") + "-" + part("day");
  }

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return iso[1];

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slash) {
    const first = Number(slash[1]), second = Number(slash[2]), year = Number(slash[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    }
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(parsed);
  const part = type => parts.find(item => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function filterAssignedTodayExportRows(extracted, todayDate, label, rangeCreatedStartDate, includeCreatedDate = true) {
  const headers = Array.isArray(extracted?.headers) ? extracted.headers : [];
  const rows = Array.isArray(extracted?.rows) ? extracted.rows : [];
  const stationIndex = findAssignedExportColumn(headers, [
    "current station", "current station name", "current hub", "current hub name"
  ]);
  const assignedTimeIndex = findAssignedExportColumn(headers, [
    "assigned time", "assigned datetime", "assign time", "assignment time", "assigned at",
    "assigned date", "assign date", "assignment date", "assignment datetime",
    "pick up time", "pickup time", "pick up datetime", "pickup datetime"
  ]);
  const createdDateIndex = includeCreatedDate ? findAssignedExportColumn(headers, [
    "created date", "create date", "order created date", "order create date",
    "created time", "create time", "order created time", "order create time",
    "ctime", "order time"
  ]) : -1;
  const missing = [];
  if (stationIndex < 0) missing.push("Current Station");
  if (missing.length) throw new Error(label + " CSV is missing required filter column(s): " + missing.join(", ") + ".");
  const assignedTimeFilterSource = assignedTimeIndex >= 0 ? "CSV column" : "SPX export request";
  const createdDateFilterSource = !includeCreatedDate ? "Not applied" : (createdDateIndex >= 0 ? "CSV column" : "SPX export request");
  const kept = [];
  const excluded = { otherStation: 0, otherAssignedDate: 0, otherCreatedDate: 0 };
  for (const row of rows) {
    const station = String(row[stationIndex] ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!station.includes("badoc hub")) { excluded.otherStation++; continue; }
    if (assignedTimeIndex >= 0 && philippineDateKey(row[assignedTimeIndex]) !== todayDate) {
      excluded.otherAssignedDate++; continue;
    }
    if (includeCreatedDate && createdDateIndex >= 0) {
      const createdDate = philippineDateKey(row[createdDateIndex]);
      if (!createdDate || createdDate < rangeCreatedStartDate || createdDate > todayDate) {
        excluded.otherCreatedDate++; continue;
      }
    }
    // Forward/Return exports are status snapshots. Preserve their exported
    // status so the Planning Board can classify each tracking number.
    kept.push(row);
  }
  return {
    headers, rows: kept, rowCount: kept.length, rawRowCount: rows.length,
    oids: extractAssignedParcelOidsFromRows(headers, kept), excluded,
    assignedTimeFilterSource, createdDateFilterSource
  };
}
function extractAssignedParcelOids(csvText) {
  const rows = parseAssignedExportCsvRows(csvText);
  if (!rows.length) throw new Error("SPX returned an empty parcel export.");
  const headers = rows[0].map(value => String(value ?? "").trim());
  const dataRows = rows.slice(1).map(row => row.map(value => String(value ?? "")));
  return {
    oids: extractAssignedParcelOidsFromRows(headers, dataRows),
    rowCount: dataRows.length,
    headers,
    rows: dataRows
  };
}

async function waitForAssignedTodayExportTask(taskId, startSec, job, label) {
  const deadline = Date.now() + 4 * 60 * 1000, sources = ["fms", "fm", ""];
  let lastStatus = null, lastQueue = null, lastMessageAt = 0, lastWideScanAt = 0, lastTaskPreview = "", lookupErrors = [];
  let fullTaskLookupAttempted = false;
  const locate = results => {
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const task = (result.value || []).find(item => getExportTaskId(item) === Number(taskId));
      if (task) return { task, source: result.source };
    }
    return null;
  };
  while (Date.now() < deadline) {
    if (job.cancelled) throw new Error("Assigned Parcels Today export cancelled.");
    const exactRaw = await Promise.allSettled(sources.map(source => listTasks(startSec, source, 1, false, taskId)));
    const exact = exactRaw.map((result,index)=>({...result,source:sources[index]}));
    lookupErrors = exact.filter(r=>r.status==="rejected").map(r=>r.reason?.message||"task lookup failed");
    let located = locate(exact);
    if (!located && Date.now()-lastWideScanAt >= 12000) {
      lastWideScanAt=Date.now();
      const firstRaw=await Promise.allSettled(sources.map(source=>listTasks(startSec,source,1,false,0)));
      const first=firstRaw.map((result,index)=>({...result,source:sources[index]}));
      for (const result of first) {
        if(result.status!=="fulfilled"){lookupErrors.push(result.reason?.message||"unfiltered scan failed");continue;}
        let rows=result.value||[];
        let task=rows.find(item=>getExportTaskId(item)===Number(taskId));
        if(task){located={task,source:result.source};break;}
        lastTaskPreview=rows.slice(0,8).map(item=>"#"+(getExportTaskId(item)||"?")+" status "+String(item?.export_status??item?.status??"?")).join(" | ");
        for(let page=2;rows.length>=100&&page<=5;page++){
          try{rows=await listTasks(startSec,result.source,page,false,0);task=rows.find(item=>getExportTaskId(item)===Number(taskId));if(task){located={task,source:result.source};break;}}
          catch(error){lookupErrors.push(error?.message||String(error));break;}
        }
        if(located)break;
      }
    }
    if(!located && Date.now()-lastWideScanAt<3500){
      const raw=await Promise.allSettled(sources.map(source=>listTasks(0,source,1,true,taskId)));
      const results=raw.map((result,index)=>({...result,source:sources[index]}));
      located=locate(results);
      for(const r of results)if(r.status==="rejected")lookupErrors.push(r.reason?.message||"unbounded lookup failed");
    }
    let message="";
    if(located?.task){
      const task=located.task, raw=task?.export_status??task?.status??task?.task_status??"";
      const status=Number(raw), statusText=String(raw).trim().toLowerCase(), queue=String(task?.queue_position||"");
      const complete=status===2||/^(complete|completed|success|succeeded|finished)$/.test(statusText);
      const failed=status===3||/^(failed|failure|error|cancelled|canceled)$/.test(statusText)||!!task?.failed_reason;
      if(complete) {
        let completedTask = task;
        let mediaId = getExportMediaId(task);
        // A task_ids-filtered SPX response can be a compact summary. Re-query
        // without task_ids to retrieve the full completed record and file metadata.
        if (!mediaId && !fullTaskLookupAttempted) {
          fullTaskLookupAttempted = true;
          const detailSources = [...new Set([located.source, ...sources])];
          let bestDetail = null;
          for (const detailSource of detailSources) {
            let rows = [];
            try {
              rows = await listTasks(0, detailSource, 1, true, 0);
            } catch (error) {
              lookupErrors.push("full " + (detailSource || "default") + " task lookup: " + (error?.message || String(error)));
              continue;
            }
            let detailed = rows.find(item => getExportTaskId(item) === Number(taskId)) || null;
            if (detailed) {
              if (!bestDetail) bestDetail = { task: detailed, source: detailSource };
              mediaId = getExportMediaId(detailed);
              if (mediaId) return { task: { ...task, ...detailed }, source: detailSource, mediaId };
            }
            for (let page = 2; !detailed && rows.length >= 100 && page <= 5; page++) {
              try {
                rows = await listTasks(0, detailSource, page, true, 0);
                detailed = rows.find(item => getExportTaskId(item) === Number(taskId)) || null;
              } catch (error) {
                lookupErrors.push("full " + (detailSource || "default") + " task page " + page + ": " + (error?.message || String(error)));
                break;
              }
              if (detailed) {
                if (!bestDetail) bestDetail = { task: detailed, source: detailSource };
                mediaId = getExportMediaId(detailed);
                if (mediaId) return { task: { ...task, ...detailed }, source: detailSource, mediaId };
              }
            }
          }
          if (bestDetail) {
            completedTask = { ...task, ...bestDetail.task };
            mediaId = getExportMediaId(completedTask);
          }
        }
        return { task: completedTask, source: located.source, mediaId };
      }
      if(failed)throw new Error(task?.failed_reason||(label+" SPX export task "+taskId+" failed ("+(statusText||status)+")."));
      const elapsed=Math.floor((Date.now()-job.startedAt)/1000);
      message=label+" export task "+taskId+" is processing"+(queue?" · queue "+queue:"")+" · "+(located.source||"default")+" queue · elapsed "+String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0")+"…";
      if(status!==lastStatus||queue!==lastQueue||Date.now()-lastMessageAt>=5000){lastStatus=status;lastQueue=queue;lastMessageAt=Date.now();}else message="";
    }else{
      const elapsed=Math.floor((Date.now()-job.startedAt)/1000);
      message="SPX accepted "+label+" task "+taskId+"; searching FMS, FM, and default queues (including unfiltered task rows) · elapsed "+String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0")+"…";
      if(Date.now()-lastMessageAt<5000)message="";else lastMessageAt=Date.now();
    }
    if(message){progress(message,{phase:"pod-assigned-task",kind:job.kind,taskId,source:label});notifyPodCheckerAssignedProgress(message);}
    await sleep(4000);
  }
  const diagnostic=lastStatus!==null?" Last task status: "+String(lastStatus)+(lastQueue?", queue "+lastQueue:"")+".":" The task ID was not found in returned task rows."+(lastTaskPreview?" Recent task rows: "+lastTaskPreview+".":"");
  const errors=lookupErrors.length?" Lookup errors: "+[...new Set(lookupErrors)].slice(0,3).join("; ")+".":"";
  throw new Error(label+" task "+taskId+" was accepted by SPX but did not become downloadable within 4 minutes."+diagnostic+errors+" Open the SPX export task monitor to confirm its state.");
}


async function downloadAssignmentTaskFile(task, taskId) {
  const rawPath = String(task?.file_name || "").trim().replace(/^\/+/, "");
  if (!rawPath) throw new Error("SPX completed the Assignment Task but did not return file_name.");

  // Only allow the known SPX Assignment Task export artifact path and require
  // its embedded task ID to match the task returned by our own export request.
  const match = rawPath.match(/^downloads\/export\/live\/ph\/(\d{4})\/(\d{2})\/(\d{2})\/delivery\/assignment_task\/(\d+)\/([A-Za-z0-9._-]+\.csv)$/i);
  if (!match || Number(match[4]) !== Number(taskId)) {
    throw new Error("SPX Assignment Task file_name is not a recognized task-specific CSV path for task " + taskId + ".");
  }

  const url = new URL(rawPath, SPX_ORIGIN + "/");
  if (url.origin !== SPX_ORIGIN || url.username || url.password || url.search || url.hash) {
    throw new Error("SPX Assignment Task file_name resolved to an unsafe download URL.");
  }

  const response = await extensionFetchText(url.toString(), {
    headers: {
      "Accept": "text/csv,text/plain,application/octet-stream,*/*",
      "Referer": SPX_ORIGIN + "/"
    }
  });
  const text = String(response?.text || "").replace(/^\uFEFF/, "");
  if (!response.ok) throw new Error("SPX direct Assignment Task file download failed (HTTP " + response.status + ").");
  if (!text.trim()) throw new Error("SPX returned an empty direct Assignment Task file.");
  if (/^(?:<!doctype|<html|\{|\[)/i.test(text.trim().slice(0, 300))) {
    throw new Error("SPX direct Assignment Task file path returned HTML or JSON instead of CSV.");
  }
  return {
    text,
    fileName: match[5],
    url: url.toString()
  };
}

async function waitForAssignmentTaskMediaId(taskId, completedInfo, job, label = "Assignment Task") {
  let bestTask = { ...(completedInfo?.task || {}) };
  let bestSource = completedInfo?.source || "fms";
  let mediaId = completedInfo?.mediaId || getExportMediaId(bestTask);
  if (mediaId) return { task: bestTask, source: bestSource, mediaId, lookupErrors: [] };

  const sources = [...new Set([bestSource, "fms", "fm", ""])];
  const startedAt = Date.now();
  const deadline = startedAt + ASSIGNMENT_TASK_MEDIA_ID_WAIT_MS;
  let lastProgressAt = 0;
  const lookupErrors = [];

  while (Date.now() < deadline) {
    if (job?.cancelled) throw new Error(label + " media-ID lookup cancelled.");

    // SPX can mark an export Succeeded before the media/file metadata is
    // visible in list_for_portal. Re-read the full, unfiltered task rows
    // instead of treating the first completed snapshot as final.
    for (const source of sources) {
      let rows = [];
      try {
        rows = await listTasks(0, source, 1, true, 0);
      } catch (error) {
        lookupErrors.push((source || "default") + ": " + (error?.message || String(error)));
        continue;
      }

      let detailed = rows.find(item => getExportTaskId(item) === Number(taskId)) || null;
      for (let page = 2; !detailed && rows.length >= 100 && page <= 5; page++) {
        try {
          rows = await listTasks(0, source, page, true, 0);
          detailed = rows.find(item => getExportTaskId(item) === Number(taskId)) || null;
        } catch (error) {
          lookupErrors.push((source || "default") + " page " + page + ": " + (error?.message || String(error)));
          break;
        }
      }

      if (!detailed) continue;
      bestTask = { ...bestTask, ...detailed };
      bestSource = source;
      mediaId = getExportMediaId(detailed) || getExportMediaId(bestTask);
      if (mediaId) return { task: bestTask, source: bestSource, mediaId, lookupErrors };
    }

    const now = Date.now();
    if (now - lastProgressAt >= 8000) {
      const elapsed = Math.floor((now - startedAt) / 1000);
      sendToPort(job?.ownerPort, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
        message: "SPX marked Assignment Task " + taskId + " as Succeeded. Waiting for its file media_id to appear in the full task record… (" + elapsed + "s)"
      });
      lastProgressAt = now;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await sleep(Math.min(ASSIGNMENT_TASK_MEDIA_ID_POLL_MS, remaining));
  }

  return { task: bestTask, source: bestSource, mediaId: "", lookupErrors };
}

async function runAssignedTodayExportSource({ endpoint, label, range, job, isForward = false, includeCreatedDate = true }) {
  // Match the FMS Order Export dialog: Assigned Time is today's date filter.
  // SPX maps its visible Assigned Time control to pick_up_time; leave On Hold Time unrestricted.
  // Created Date is optional: the Planning Board's Assigned Today action omits it,
  // while the POD/POOH Checker keeps its existing 14-day Created Date restriction.
  // Request all statuses so the Planning Board can classify the latest exported status.
  const body = {
    bulky_type: "1,0,2",
    ...(includeCreatedDate ? {
      ctime: String(range.createdStartSec) + "," + String(range.assignedEndSec)
    } : {}),
    pick_up_time: String(range.assignedStartSec) + "," + String(range.assignedEndSec),
    format_condition:
      "Current Station= Badoc Hub; " +
      "Assigned Time= " + range.todayDate + " 00:00:00," + range.todayDate + " 23:59:59; " +
      (includeCreatedDate ? "Created Date= " + range.createdStartDate + " 00:00:00," + range.todayDate + " 23:59:59; " : "") +
      "Bulky Type= Bulky,N/A,Non-Bulky; " +
      "Driver= All"
  };

  progress("Submitting SPX " + label + " export for " + range.todayDate +
    " (Current Station: Badoc Hub; Assigned Time: today; " +
    (includeCreatedDate ? "Created Date: last 14 days; " : "no Created Date restriction; ") +
    "preserving exported statuses)…", {
    phase: "pod-assigned-today-export", kind: job.kind, source: label,
    dateStart: range.todayDate, dateEnd: range.todayDate,
    currentStation: "Badoc Hub", assignedDate: range.todayDate,
    includeCreatedDate,
    createdDateStart: includeCreatedDate ? range.createdStartDate : null,
    createdDateEnd: includeCreatedDate ? range.todayDate : null,
    preservedExportStatuses: true
  });

  const response = await extensionFetchText(SPX_ORIGIN + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/plain, */*" },
    body: JSON.stringify(body)
  });
  const json = parseJsonResponse("SPX " + label + " export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(label + " export request failed: " +
      (json?.message || "SPX export failed (HTTP " + response.status + ")."));
  }

  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) throw new Error("SPX accepted the " + label + " export request but returned no task ID.");

  const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
  const completedInfo = await waitForAssignedTodayExportTask(taskId, waitStartSec, job, label);
  const completed = completedInfo.task;

  if (isForward) {
    if (String(completed?.export_name || "") !== PARCEL_EXPORT_NAME ||
        String(completed?.biz_name || "") !== PARCEL_EXPORT_BIZ_NAME) {
      throw new Error("The completed SPX task is not a Forward Order export.");
    }
  } else if (Number(completed?.station_id || 0) !== PARCEL_STATION_ID) {
    throw new Error("The Return Order export task station did not match BADOC HUB.");
  }

  progress("SPX " + label + " task " + taskId + " is complete. Downloading the CSV…", {
    phase: "pod-assigned-today-download", kind: job.kind, source: label, taskId
  });
  const signedUrl = await getSignedDownloadUrl(taskId, completedInfo.source);
  const csv = await downloadCsv(signedUrl);
  const raw = extractAssignedParcelOids(csv.text);
  const filtered = filterAssignedTodayExportRows(raw, range.todayDate, label, range.createdStartDate, includeCreatedDate);
  return {
    taskId,
    rowCount: filtered.rowCount,
    rawRowCount: filtered.rawRowCount,
    oids: filtered.oids,
    headers: filtered.headers,
    rows: filtered.rows,
    excluded: filtered.excluded,
    assignedTimeFilterSource: filtered.assignedTimeFilterSource,
    createdDateFilterSource: filtered.createdDateFilterSource,
    fileName: csv.fileName
  };
}

async function exportAssignedParcelsTodayFromSpx(jobOverride = null, options = {}) {
  const range = parcelDeliveryDateRange();
  const job = jobOverride || { kind: "pod-assigned-today", startedAt: Date.now(), cancelled: false };
  const includeCreatedDate = options?.includeCreatedDate !== false;

  // Keep the two SPX export types separate, then merge their OIDs below.
  // Run sequentially to follow the established SPX export-task handling flow.
  const forward = await runAssignedTodayExportSource({
    endpoint: PARCEL_FORWARD_EXPORT_PATH,
    label: "Forward Order",
    range,
    job,
    isForward: true,
    includeCreatedDate
  });
  const returned = await runAssignedTodayExportSource({
    endpoint: PARCEL_RETURN_EXPORT_PATH,
    label: "Return Order",
    range,
    job,
    isForward: false,
    includeCreatedDate
  });

  const onholdByTn = new Map();
  const collectOnholdRows = source => {
    const tnIndex = findAssignedExportColumn(source?.headers || [], [
      "SPX TN", "SLS Tracking Number", "SPX Tracking Number", "Tracking Number",
      "SPX TN/Tracking Number", "SPX Tracking No", "SLS Tracking No"
    ]);
    if (tnIndex < 0) throw new Error(source?.source + " export is missing the SPX Tracking Number column; cannot safely deduplicate On-Hold records.");
    (source?.rows || []).forEach(row => {
      const tn = String(row[tnIndex] ?? "").trim().toUpperCase();
      const key = tn.replace(/[\\s\\-_.]/g, "");
      if (key) onholdByTn.set(key, { ...Object.fromEntries((source.headers || []).map((h,i)=>[h,row[i] ?? ""])), _onholdExportSource: source === returned ? "Return Order" : "Forward Order" });
    });
  };
  collectOnholdRows(forward);
  collectOnholdRows(returned);
  const onholdRows = [...onholdByTn.values()];
  const oids = [...new Set([...forward.oids, ...returned.oids])];
  return {
    ok: true,
    todayDate: range.todayDate,
    taskId: forward.taskId,
    forwardTaskId: forward.taskId,
    returnTaskId: returned.taskId,
    forwardRowCount: forward.rowCount,
    returnRowCount: returned.rowCount,
    forwardRawRowCount: forward.rawRowCount,
    returnRawRowCount: returned.rawRowCount,
    filterCriteria: {
      currentStation: "Badoc Hub",
      assignedDate: range.todayDate,
      includeCreatedDate,
      ...(includeCreatedDate ? {
        createdDateStart: range.createdStartDate,
        createdDateEnd: range.todayDate
      } : {}),
      excludedStatuses: ["all exported statuses"]
    },
    forwardOidCount: forward.oids.length,
    returnOidCount: returned.oids.length,
    duplicateCount: forward.oids.length + returned.oids.length - oids.length,
    oids,
    onholdRows,
    downloadedData: [
      { source: "Forward Order", headers: forward.headers, rows: forward.rows, rawRowCount: forward.rawRowCount, excluded: forward.excluded, assignedTimeFilterSource: forward.assignedTimeFilterSource },
      { source: "Return Order", headers: returned.headers, rows: returned.rows, rawRowCount: returned.rawRowCount, excluded: returned.excluded, assignedTimeFilterSource: returned.assignedTimeFilterSource }],
    fileName: "Forward_and_Return_Assigned_Today.csv"
  };
}

async function exportOnHoldOidsFromSpx(jobOverride = null) {
  const job = jobOverride || {
    kind: "pod-checker-onhold",
    startedAt: Date.now(),
    cancelled: false,
    trackingStatus: "5"
  };
  job.trackingStatus = "5";

  // SPX requires both time-range parameters for a Forward Order export.
  // Use epoch → now so the request does not restrict current OnHold parcels
  // by Created Date or Assigned/OnHold Time.
  const rangeEndSec = Math.floor(Date.now() / 1000);
  const body = {
    tracking_status: "5",
    bulky_type: "1,0,2",
    ctime: "1," + rangeEndSec,
    pick_up_time: "1," + rangeEndSec,
    format_condition:
      "Status Log= OnHold; " +
      "Current Station= Badoc Hub; " +
      "Bulky Type= Bulky,N/A,Non-Bulky; " +
      "Driver= All"
  };

  notifyPodCheckerAssignedProgress("Submitting current OnHold export for Badoc Hub…");
  const response = await extensionFetchText(SPX_ORIGIN + PARCEL_FORWARD_EXPORT_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*"
    },
    body: JSON.stringify(body)
  });
  const json = parseJsonResponse("SPX OnHold export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error("OnHold export request failed: " +
      (json?.message || "SPX export failed (HTTP " + response.status + ")."));
  }

  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) throw new Error("SPX accepted the OnHold export request but returned no task ID.");

  notifyPodCheckerAssignedProgress("OnHold export task " + taskId + " created. Waiting for completion…");
  const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
  const completedInfo = await waitForAssignedTodayExportTask(taskId, waitStartSec, job, "OnHold");
  const completed = completedInfo.task;
  if (!isParcelDeliveryTask(completed, job)) {
    throw new Error("The completed SPX task does not match the requested OnHold-only export.");
  }

  notifyPodCheckerAssignedProgress("OnHold export completed. Downloading its CSV…");
  const signedUrl = await getSignedDownloadUrl(taskId, completedInfo.source);
  const csv = await downloadCsv(signedUrl);
  const extracted = extractAssignedParcelOids(csv.text);

  const stationIndex = findAssignedExportColumn(extracted.headers, [
    "current station", "current station name", "current hub", "current hub name"
  ]);
  if (stationIndex < 0) {
    throw new Error("SPX OnHold CSV is missing the Current Station column, so the hub filter cannot be verified.");
  }

  const statusIndex = findAssignedExportColumn(extracted.headers, [
    "status", "current status", "tracking status", "shipment status"
  ]);
  const keptRows = extracted.rows.filter(row => {
    const station = String(row[stationIndex] ?? "").trim().toLowerCase().replace(/[\\s_-]+/g, " ");
    if (!station.includes("badoc hub")) return false;
    if (statusIndex >= 0) {
      const status = String(row[statusIndex] ?? "").trim();
      if (status && !/on[\\s_-]*hold/i.test(status)) return false;
    }
    return true;
  });

  const oids = [...new Set(
    extractAssignedParcelOidsFromRows(extracted.headers, keptRows)
      .map(value => String(value || "").trim().toUpperCase())
      .filter(Boolean)
  )];
  const oidRows = keptRows.reduce((count, row) =>
    count + (extractAssignedParcelOidsFromRows(extracted.headers, [row]).length ? 1 : 0), 0
  );

  return {
    ok: true,
    source: "SPX OnHold export",
    status: "OnHold",
    station: "Badoc Hub",
    taskId,
    rowCount: keptRows.length,
    rawRowCount: extracted.rows.length,
    excludedOtherStation: extracted.rows.length - keptRows.length,
    duplicateCount: Math.max(0, oidRows - oids.length),
    oids,
    fileName: csv.fileName
  };
}

async function ensureToListRoute(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = String(tab?.url || "");

  if (/^https:\/\/spx\.shopee\.ph\/\#\/dcToManagement(?:[/?#]|$)/i.test(currentUrl)) {
    progress("SPX is already on Inbound → TO List.", { phase: "route" });
    return;
  }

  progress("Opening SPX Inbound → TO List automatically…", { phase: "route" });

  await new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (timer) clearTimeout(timer);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onUpdated = (updatedTabId, changeInfo, updatedTab) => {
      if (updatedTabId !== tabId) return;

      const url = String(updatedTab?.url || "");
      if (
        changeInfo.status === "complete" &&
        /https:\/\/spx\.shopee\.ph\/\#\/dcToManagement/i.test(url)
      ) {
        finish();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    timer = setTimeout(() => {
      fail(new Error("Timed out opening SPX Inbound → TO List."));
    }, 20000);

    chrome.tabs.update(tabId, {
      url: `${SPX_ORIGIN}/#/dcToManagement`
    }).catch(fail);
  });

  // Give the SPX Vue application time to mount the TO List component.
  await sleep(1800);
}

async function invokeSpxNativeExport(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      const visible = el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      };

      const exportButtons = [...document.querySelectorAll("button.ssc-customhook-group-btn")]
        .filter(btn => (btn.innerText || "").trim() === "Export")
        .filter(visible)
        .map(btn => {
          let el = btn;
          for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
            if (el.matches?.(".btns-container.btns-container-left.btns-container-wrapper")) {
              return { btn, score: 100 };
            }
          }
          return { btn, score: 0 };
        })
        .sort((a, b) => b.score - a.score);

      const button = exportButtons[0]?.btn || null;
      if (!button) {
        throw new Error("SPX TO List Export control was not found on the current page.");
      }

      const sButtonVm = button.__vue__;
      const wrapperVm = sButtonVm?.$parent;
      const dropdownVm = wrapperVm?.$parent;

      if (!dropdownVm || typeof dropdownVm.handleCommand !== "function") {
        throw new Error("SPX Export dropdown Vue component was not found.");
      }

      // This is the exact Vue command path used by SDropdown when the
      // "Export" menu item is selected. No DOM/mouse click is performed.
      dropdownVm.handleCommand("Export");

      const deadline = Date.now() + 5000;
      let confirmBtn = null;
      let exportVm = null;

      while (Date.now() < deadline) {
        confirmBtn = [...document.querySelectorAll("button")]
          .filter(b => (b.innerText || "").trim() === "Confirm")
          .filter(visible)
          .pop() || null;

        if (confirmBtn) {
          let vm = confirmBtn.__vue__;
          while (vm) {
            const props = vm.$options?.propsData || {};
            if (
              props.contextName === "dcToManagement" &&
              typeof props.exportFunction === "function" &&
              typeof vm.confirm === "function"
            ) {
              exportVm = vm;
              break;
            }
            vm = vm.$parent;
          }
        }

        if (exportVm) break;
        await new Promise(r => setTimeout(r, 100));
      }

      if (!exportVm) {
        throw new Error("SPX Receive Task Export component did not open.");
      }

      // Exact internal values used by the SPX export component.
      exportVm.form.status = [0];
      exportVm.form.operator_list = [];
      exportVm.form.receive_operator = undefined;
      exportVm.form.receive_time = [];
      exportVm.form.partially_receive_time = [];
      exportVm.formatCondition = "Status=Pending Receive;Operator=All";

      const originalExportFunction = exportVm.exportFunction;
      let apiResult = null;

      exportVm.exportFunction = async function(params) {
        const response = await originalExportFunction(params);
        const body = response?.data ?? response ?? null;

        // Never return/capture the Axios response object itself: Axios may
        // contain circular/non-cloneable properties. Keep only JSON-safe data.
        try {
          apiResult = JSON.parse(JSON.stringify(body));
        } catch {
          apiResult = {
            retcode: body?.retcode,
            message: body?.message,
            data: body?.data && {
              task_id: body.data?.task_id
            }
          };
        }

        return response;
      };

      try {
        await exportVm.confirm();
      } finally {
        exportVm.exportFunction = originalExportFunction;
      }

      const taskId = Number(
        apiResult?.data?.task_id ||
        apiResult?.task_id ||
        0
      );

      return {
        taskId,
        apiResult: taskId ? apiResult : null
      };
    }
  });

  const result = results?.[0]?.result;
  if (!result) throw new Error("SPX returned no export result.");
  return result;
}


async function invokeSpxAssignmentTaskExport(tabId, selectedDate) {
  const requestId = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const resultStorageKey = "badoc_assignment_task_export_" + requestId;
  let results = null;
  let injectionError = null;
  try {
    results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [selectedDate, requestId, resultStorageKey],
    func: async (dateValue, exportRequestId, exportResultStorageKey) => {
      try {
      const visible = el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      };
      const isTopFrame = window === window.top;
      const route = String(location.hash || "");
      if (isTopFrame && !route.includes("assignment-task-new")) {
        throw new Error("Open SPX Delivery Assignment → List before requesting the Assignment Task report.");
      }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || "")) ? String(dateValue) : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      const startText = date + " 00:00:00";
      const endText = date + " 23:59:59";

      const dialogSelector = '[role="dialog"],[aria-modal="true"],.el-dialog,.el-dialog__wrapper,.ant-modal,.ivu-modal,[class*="dialog"],[class*="modal"],[class*="Dialog"],[class*="Modal"]';
      // SPX may render its export form inside an open shadow root or a child frame.
      // The same helper is used in each injected frame, so we can discover the
      // actual dialog controls without assuming a single top-level DOM tree.
      const queryDeep = (root, selector) => {
        const found = [];
        const scopes = [root];
        const seenScopes = new Set();
        while (scopes.length) {
          const scope = scopes.shift();
          if (!scope || seenScopes.has(scope) || typeof scope.querySelectorAll !== "function") continue;
          seenScopes.add(scope);
          try {
            found.push(...scope.querySelectorAll(selector));
            for (const node of scope.querySelectorAll("*")) {
              if (node.shadowRoot) scopes.push(node.shadowRoot);
            }
          } catch (_) {}
        }
        return [...new Set(found)];
      };
      const closestDialog = element => {
        let current = element;
        while (current) {
          try {
            if (current.matches?.(dialogSelector)) return current;
          } catch (_) {}
          if (current.parentElement) current = current.parentElement;
          else {
            const root = current.getRootNode?.();
            current = root?.host || null;
          }
        }
        return null;
      };
      const getVueChain = element => {
        const queue = [element?.__vue__, element?.__vueParentComponent].filter(Boolean);
        const seen = new Set();
        const chain = [];
        while (queue.length && chain.length < 24) {
          const current = queue.shift();
          if (!current || (typeof current !== "object" && typeof current !== "function") || seen.has(current)) continue;
          seen.add(current);
          chain.push(current);
          const parent = current.$parent || current.parent || current.$?.parent || current.proxy?.$parent;
          if (parent && !seen.has(parent)) queue.push(parent);
        }
        return chain;
      };
      const getCandidate = (rawVm, dialogText, dialogRoot) => {
        // SPX may split the export dialog across nested Vue components: the
        // date form can live in a child while exportFunction/confirm live in
        // its parent. Inspect the full component chain instead of requiring
        // all three members on one component instance.
        const componentChain = getVueChain(rawVm);
        const records = componentChain.map(component => {
          const proxy = component?.proxy || component;
          const setupState = component?.setupState || {};
          const ctx = component?.ctx || {};
          const propsList = [
            component?.$options?.propsData, component?.$props, component?.props,
            component?.vnode?.props, component?.$?.vnode?.props, proxy?.$props
          ].filter(value => value && typeof value === "object");
          return { component, proxy, setupState, ctx, propsList };
        });
        const owners = [];
        const addOwner = owner => {
          if (owner && typeof owner === "object" && !owners.includes(owner)) owners.push(owner);
        };
        for (const record of records) {
          addOwner(record.proxy);
          addOwner(record.component);
          addOwner(record.setupState);
          addOwner(record.ctx);
          addOwner(record.proxy?.$data);
          addOwner(record.component?.data);
          addOwner(record.component?.$?.setupState);
          addOwner(record.component?.exposed);
          record.propsList.forEach(addOwner);
        }

        // SPX has used form, formData, searchForm, and filter-form objects
        // across different export-dialog builds.
        const formNames = ["form", "exportForm", "searchForm", "filterForm", "queryForm", "formData", "filters"];
        let formHit = null;
        for (const name of formNames) {
          formHit = owners.map(owner => ({ owner, name, value: owner[name] }))
            .find(item => item.value && typeof item.value === "object");
          if (formHit) break;
        }
        const exportHit = owners.map(owner => ({ owner, value: owner.exportFunction }))
          .find(item => typeof item.value === "function");
        const confirmNames = ["confirm", "confirmExport", "handleConfirm", "onConfirm", "submit", "handleSubmit"];
        let confirmHit = null;
        for (const name of confirmNames) {
          confirmHit = owners.map(owner => ({ owner, name, value: owner[name] }))
            .find(item => typeof item.value === "function");
          if (confirmHit) break;
        }
        if (!formHit || !exportHit) return null;

        const formValue = formHit.value;
        const actualForm = formValue.__v_isRef && formValue.value && typeof formValue.value === "object"
          ? formValue.value : formValue;
        const keys = Object.keys(actualForm);
        let createdKey = keys.find(key => {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (normalized.includes("create") || normalized.includes("ctime")) &&
            (normalized.includes("time") || normalized.includes("date") || normalized.endsWith("at"));
        });

        // Some SPX builds use a generic dateRange key. Only infer it when the
        // dialog visibly labels the control as Created Date and there is one
        // unambiguous date-range value in the form.
        const isDateSample = value => {
          if (value == null || value === "") return true;
          if (value instanceof Date) return true;
          if (typeof value === "number") return Number.isFinite(value) && value !== 0;
          if (typeof value === "string") return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value.trim());
          return typeof value === "object" && (
            typeof value.clone === "function" || typeof value.toDate === "function" || value.$d instanceof Date
          );
        };
        const isDateRange = value => {
          if (Array.isArray(value)) return value.length === 2 && value.every(isDateSample);
          if (value && typeof value === "object" &&
              ("start" in value || "end" in value || "startTime" in value || "endTime" in value)) {
            const start = value.start ?? value.startTime;
            const end = value.end ?? value.endTime;
            return isDateSample(start) && isDateSample(end);
          }
          return false;
        };
        if (!createdKey && /created\s*date|create\s*date/i.test(String(dialogText || ""))) {
          const rangeKeys = keys.filter(key => isDateRange(actualForm[key]));
          if (rangeKeys.length === 1) createdKey = rangeKeys[0];
        }

        const context = records.map(record => {
          const propsContext = record.propsList.map(props =>
            props.contextName || props.context_name || ""
          ).find(Boolean) || "";
          return String(
            propsContext || record.proxy?.contextName || record.component?.contextName ||
            record.component?.type?.name || record.component?.$options?.name || ""
          );
        }).filter(Boolean).join(" ");
        if (!createdKey && !/assignment|task|created\s*date/i.test(context + " " + String(dialogText || ""))) return null;

        const callbackOwners = owners.filter(owner => owner.exportFunction === exportHit.value);
        const vm = records.map(record => record.proxy)
          .find(proxy => proxy && typeof proxy.$forceUpdate === "function") ||
          records[0]?.proxy || exportHit.owner;
        return {
          vm, rawVm, form: actualForm, createdKey, context,
          originalExportFunction: exportHit.value, confirm: confirmHit?.value,
          confirmOwner: confirmHit?.owner, callbackOwners, dialogRoot
        };
      };
      const findExportComponent = () => {
        const roots = queryDeep(document, dialogSelector).filter(visible);
        const targets = new Set();
        for (const root of roots) {
          targets.add(root);
          for (const child of queryDeep(root, "*")) {
            if (visible(child)) targets.add(child);
          }
        }
        for (const element of queryDeep(document, 'button,[role="button"],input,form')) {
          if (visible(element)) targets.add(element);
        }
        const matchesByComponent = new Map();
        for (const element of targets) {
          const dialogRoot = closestDialog(element) || element.closest?.("form") || element;
          const localText = String(dialogRoot.innerText || dialogRoot.textContent || "").slice(0, 3000);
          const dialogText = localText.length > 30 ? localText : String(document.body?.innerText || "").slice(0, 3000);
          for (const rawVm of getVueChain(element)) {
            const candidate = getCandidate(rawVm, dialogText, dialogRoot);
            if (!candidate) continue;
            const score =
              (/assignment/i.test(candidate.context) ? 8 : 0) +
              (/task/i.test(candidate.context) ? 5 : 0) +
              (/assignment/i.test(dialogText) ? 4 : 0) +
              (/task/i.test(dialogText) ? 2 : 0) +
              (candidate.createdKey ? 3 : 0);
            const previous = matchesByComponent.get(rawVm);
            if (!previous || score > previous.score) {
              matchesByComponent.set(rawVm, { candidate, score });
            }
          }
        }
        const matches = [...matchesByComponent.values()].sort((a, b) => b.score - a.score);
        return matches[0]?.candidate || null;
      };
      // Fallback for SPX Assignment Task dialogs whose Vue internals are not exposed
      // to the page bridge. Identify the visible Export dialog by its Created Date label.
      const findAssignmentExportDialog = () => {
        const roots = queryDeep(document, dialogSelector).filter(visible);
        const matches = [];
        for (const root of roots) {
          const text = String(root.innerText || root.textContent || "").replace(/\s+/g, " ").trim();
          if (!/created\s*date|create\s*date/i.test(text) || !/\bexport\b/i.test(text)) continue;
          const inputs = queryDeep(root, 'input:not([type="hidden"])')
            .filter(input => visible(input))
            .filter(input => !["checkbox","radio","button","submit","reset","file"].includes(String(input.type || "").toLowerCase()));
          const buttons = queryDeep(root, 'button,[role="button"],.el-button')
            .filter(button => visible(button));
          if (!inputs.length || !buttons.length) continue;
          const primaryCount = buttons.filter(button => /primary/i.test(String(button.className || ""))).length;
          const score = (inputs.length >= 2 ? 8 : 0) + primaryCount * 4 +
            (root.matches?.(".el-dialog,.ant-modal,.ivu-modal,[role=dialog]") ? 3 : 0);
          matches.push({ root, inputs, buttons, text, score });
        }
        return matches.sort((a,b) => b.score - a.score)[0] || null;
      };
      const setNativeInputValue = (input, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        const wasReadOnly = input.readOnly;
        try { input.readOnly = false; } catch (_) {}
        if (descriptor?.set) descriptor.set.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
        input.blur();
        if (wasReadOnly) {
          try { input.readOnly = true; } catch (_) {}
        }
      };
      const submitAssignmentExportDialog = dialog => {
        const dateInputs = dialog.inputs.filter(input => {
          const meta = [
            input.placeholder, input.getAttribute("aria-label"), input.className,
            input.parentElement?.className, input.closest?.(".el-date-editor")?.className,
            input.value
          ].join(" ");
          return /date|time|range/i.test(meta) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(String(input.value || "").trim());
        });
        const inputs = (dateInputs.length >= 2 ? dateInputs : dialog.inputs).slice(0, 2);
        if (!inputs.length) throw new Error("SPX Export dialog was found, but its Created Date input was not accessible.");
        if (inputs.length >= 2) {
          setNativeInputValue(inputs[0], startText);
          setNativeInputValue(inputs[1], endText);
        } else {
          setNativeInputValue(inputs[0], startText + " - " + endText);
        }
        const isCancel = button => /cancel|kanselahin|batal|close|tutup/i.test(
          String(button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()
        );
        const actionButtons = dialog.buttons.filter(button => !isCancel(button));
        const actionButton =
          actionButtons.find(button => /confirm|matukoy|export|generate|download|submit|apply|ok|确定|確認/i.test(
            String(button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()
          )) ||
          actionButtons.find(button => /primary/i.test(String(button.className || ""))) ||
          actionButtons[actionButtons.length - 1];
        if (!actionButton) throw new Error("SPX Export dialog was found, but its Confirm/Export action was not available.");
        const disabled = actionButton.disabled === true || actionButton.getAttribute?.("aria-disabled") === "true";
        if (disabled) throw new Error("SPX Export Confirm button is disabled after setting the Created Date range.");
        const buttonLabel = String(actionButton.innerText || actionButton.textContent || actionButton.getAttribute("aria-label") || "").trim();
        actionButton.click();
        return { start: startText, end: endText, button: buttonLabel };
      };
      let domExportSubmitted = false;
      let domExportDetails = null;
      let found = findExportComponent();
      let exportActivationMethod = "manual trusted click";
      let exportButton = null;
      let hint = null;
      let previousOutline = "";
      let previousOutlineOffset = "";

      const updateManualHint = (title, message) => {
        if (!isTopFrame) return;
        if (!hint) {
          hint = document.createElement("div");
          hint.id = "badocAssignmentTaskManualExportHint";
          hint.style.cssText = "position:fixed;top:14px;right:18px;z-index:2147483647;width:min(390px,calc(100vw - 36px));padding:14px 16px;border:2px solid #0ea5e9;border-radius:12px;background:#071522;color:#eaf6ff;box-shadow:0 10px 35px rgba(0,0,0,.45);font:13px/1.45 Arial,sans-serif;box-sizing:border-box";
          const heading = document.createElement("div");
          heading.dataset.role = "heading";
          heading.style.cssText = "font-weight:800;font-size:14px;margin-bottom:6px";
          const body = document.createElement("div");
          body.dataset.role = "body";
          const close = document.createElement("button");
          close.type = "button";
          close.textContent = "×";
          close.setAttribute("aria-label", "Close");
          close.style.cssText = "position:absolute;top:5px;right:8px;border:0;background:transparent;color:#eaf6ff;font-size:22px;cursor:pointer";
          close.addEventListener("click", () => hint?.remove());
          hint.append(heading, body, close);
          document.documentElement.appendChild(hint);
        }
        const heading = hint.querySelector('[data-role="heading"]');
        const body = hint.querySelector('[data-role="body"]');
        if (heading) heading.textContent = title;
        if (body) body.textContent = message;
      };

      const findVisibleExportMenuItem = () => queryDeep(document,
        '[role="menuitem"],[role="option"],.el-dropdown-menu__item,.ant-dropdown-menu-item,.ivu-dropdown-item,li,a,button,[role="button"],[class*="menu-item"],[class*="dropdown-item"]'
      ).filter(visible).filter(item =>
        item !== exportButton &&
        String(item.innerText || item.textContent || item.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim() === "Export"
      ).find(item =>
        item.getAttribute?.("role") === "menuitem" ||
        item.tagName === "LI" ||
        /menu.*item|dropdown.*item/i.test(String(item.className || ""))
      ) || null;

      if (!found && isTopFrame) {
        const toolbarDeadline = Date.now() + 45000;
        while (!exportButton && Date.now() < toolbarDeadline) {
          exportButton = queryDeep(document, 'button,[role="button"]')
            .filter(button => visible(button) && String(button.innerText || button.textContent || "").replace(/\s+/g, " ").trim() === "Export")
            .sort((a,b) => {
              const score = el => (el.matches?.("button.ssc-customhook-group-btn") ? 20 : 0) +
                (el.closest?.(".btns-container.btns-container-left.btns-container-wrapper") ? 10 : 0);
              return score(b) - score(a);
            })[0] || null;
          if (!exportButton) await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (!exportButton) {
          throw new Error("SPX Assignment Task page loaded, but its toolbar Export control was not found. Confirm SPX sign-in and retry.");
        }
        previousOutline = exportButton.style.outline;
        previousOutlineOffset = exportButton.style.outlineOffset;
        exportButton.style.outline = "3px solid #0ea5e9";
        exportButton.style.outlineOffset = "3px";
        try { exportButton.scrollIntoView({ block: "center", inline: "nearest" }); } catch (_) {}
        updateManualHint(
          "Starting SPX Export automatically",
          "Badoc Hub opened the Assignment Task route and is selecting Export for " + date + ". No manual tab switching is required."
        );
        try {
          exportButton.click();
          exportActivationMethod = "automated toolbar click";
        } catch (clickError) {
          throw new Error("SPX blocked the automatic toolbar Export click: " + String(clickError?.message || clickError));
        }
      }

      // Capture the actual SPX export response as a fallback when SPX's Vue
      // component internals are not exposed to the extension. This keeps the
      // workflow automatic even when the operator submits the native dialog.
      const originalPageFetch = window.fetch;
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;
      const xhrRequestMeta = new WeakMap();
      const captureExportTaskResponse = (rawBody, requestUrl) => {
        const urlText = String(requestUrl || "");
        if (!/export/i.test(urlText) || /(list|history|signed|download)/i.test(urlText)) return;
        let payload = rawBody;
        if (typeof payload === "string") {
          try { payload = JSON.parse(payload); } catch (_) { return; }
        }
        if (!payload || typeof payload !== "object") return;
        if (payload.retcode != null && Number(payload.retcode) !== 0) return;
        const taskId = getTaskIdFromPageResponse(payload);
        if (!taskId) return;
        const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
        const result = {
          __badocAssignmentTask: true,
          ok: true,
          stage: "network-capture",
          taskId,
          apiResult: payload,
          directUrl: String(data.download_url || data.url || payload.download_url || "").trim(),
          createdDate: date,
          context: "assignment-task"
        };
        try { sessionStorage.setItem(exportResultStorageKey, JSON.stringify(result)); } catch (_) {}
      };
      const wrappedXhrOpen = function(method, url, ...args) {
        xhrRequestMeta.set(this, { method: String(method || "GET"), url: String(url || "") });
        return originalXhrOpen.call(this, method, url, ...args);
      };
      const wrappedXhrSend = function(...args) {
        this.addEventListener("load", function() {
          try {
            const meta = xhrRequestMeta.get(this);
            if (!meta) return;
            const body = this.responseType === "json" ? this.response : this.responseText;
            captureExportTaskResponse(body, meta.url);
          } catch (_) {}
        }, { once: true });
        return originalXhrSend.apply(this, args);
      };
      const wrappedPageFetch = async function(input, init) {
        const response = await originalPageFetch.apply(this, arguments);
        try {
          const requestUrl = typeof input === "string" ? input : input?.url;
          if (/export/i.test(String(requestUrl || "")) && !/(list|history|signed|download)/i.test(String(requestUrl || ""))) {
            response.clone().text().then(body => captureExportTaskResponse(body, requestUrl)).catch(() => {});
          }
        } catch (_) {}
        return response;
      };
      try {
        XMLHttpRequest.prototype.open = wrappedXhrOpen;
        XMLHttpRequest.prototype.send = wrappedXhrSend;
        if (typeof originalPageFetch === "function") window.fetch = wrappedPageFetch;
      } catch (_) {}
      const restorePageNetworkCapture = () => {
        try { if (XMLHttpRequest.prototype.open === wrappedXhrOpen) XMLHttpRequest.prototype.open = originalXhrOpen; } catch (_) {}
        try { if (XMLHttpRequest.prototype.send === wrappedXhrSend) XMLHttpRequest.prototype.send = originalXhrSend; } catch (_) {}
        try { if (window.fetch === wrappedPageFetch) window.fetch = originalPageFetch; } catch (_) {}
      };

      // SPX may not expose its Vue dialog instance. Keep watching for a user
      // submission and use the export API response to recover the task ID.
      const dialogDeadline = Date.now() + 60000;
      let menuAutoClickAttempted = false;
      let menuAutoClickAt = 0;
      let menuManualFallbackShown = false;
      let networkCapture = null;
      while (!found && Date.now() < dialogDeadline) {
        try {
          const rawCapture = sessionStorage.getItem(exportResultStorageKey);
          if (rawCapture) {
            const parsedCapture = JSON.parse(rawCapture);
            if (parsedCapture?.__badocAssignmentTask && parsedCapture.ok === true) {
              networkCapture = parsedCapture;
              break;
            }
          }
        } catch (_) {}
        found = findExportComponent();
        if (found) break;
        if (!domExportSubmitted) {
          const exportDialog = findAssignmentExportDialog();
          if (exportDialog) {
            domExportDetails = submitAssignmentExportDialog(exportDialog);
            domExportSubmitted = true;
            updateManualHint(
              "Submitting SPX Export",
              "Badoc Hub detected the Created Date form, set " + date + " from 00:00:00 to 23:59:59, and selected " +
              (domExportDetails.button || "the Export action") + ". Waiting for SPX to return the export task…"
            );
            await new Promise(resolve => setTimeout(resolve, 220));
            continue;
          }
        }
        const menuItem = isTopFrame ? findVisibleExportMenuItem() : null;
        if (menuItem && !menuAutoClickAttempted) {
          menuAutoClickAttempted = true;
          menuAutoClickAt = Date.now();
          const disabled = menuItem.disabled === true ||
            menuItem.getAttribute?.("aria-disabled") === "true" ||
            /\\b(is-disabled|disabled)\\b/i.test(String(menuItem.className || ""));
          if (disabled) {
            menuManualFallbackShown = true;
            updateManualHint(
              "SPX Export option is disabled",
              "The Export menu item is disabled in SPX. Check the page state, then select Export manually when it becomes available."
            );
          } else {
            try {
              menuItem.scrollIntoView({ block: "nearest", inline: "nearest" });
              // The toolbar button is opened by the operator. Select only the
              // exact Export menu item (never Export History) to complete the
              // native SPX dropdown handoff automatically.
              menuItem.click();
              updateManualHint(
                "Opening SPX Export form",
                "Badoc Hub selected the Export option and is detecting the form. It will apply " + date + " automatically."
              );
            } catch (clickError) {
              menuManualFallbackShown = true;
              updateManualHint(
                "Select Export manually",
                "SPX blocked automatic menu selection. Click the first Export option (not Export History); Badoc Hub will then continue with " + date + "."
              );
            }
          }
        } else if (
          menuItem &&
          menuAutoClickAttempted &&
          !menuManualFallbackShown &&
          Date.now() - menuAutoClickAt > 1200
        ) {
          // Keep a clear fallback when SPX leaves the dropdown open after a
          // programmatic click instead of silently waiting for the full timeout.
          menuManualFallbackShown = true;
          updateManualHint(
            "SPX Export menu is still open",
            "The menu did not close after automatic selection. Click the first Export option (not Export History); Badoc Hub will continue when the form appears."
          );
        }
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      restorePageNetworkCapture();
      if (exportButton) {
        exportButton.style.outline = previousOutline;
        exportButton.style.outlineOffset = previousOutlineOffset;
      }
      if (networkCapture) {
        if (hint) hint.remove();
        return networkCapture;
      }
      if (found && hint) hint.remove();

      if (!found) {
        if (hint) {
          updateManualHint(
            domExportSubmitted ? "SPX Export was submitted; waiting for task response" : "SPX Export form was not detected",
            domExportSubmitted
              ? "The Created Date form was submitted (" + domExportDetails.start + " to " + domExportDetails.end + "). SPX has not returned an export task response yet."
              : "The 60-second wait ended without an SPX Export form. The automatic Export click did not open the form; retry after confirming the SPX session is signed in."
          );
          setTimeout(() => hint?.remove(), 15000);
        }
        const visibleButtons = queryDeep(document, 'button,[role="button"]').filter(visible).map(button =>
          String(button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()
        ).filter(Boolean).slice(0, 12).join(", ");
        const visibleInputs = queryDeep(document, "input,[role='textbox']").filter(visible).map(input =>
          input.getAttribute("placeholder") || input.getAttribute("aria-label") || input.type || "input"
        ).slice(0, 10).join(", ");
        if (domExportSubmitted) {
          throw new Error(
            "SPX Assignment Task Export form was detected and submitted for " + date +
            ", but SPX did not return an export task response within 60 seconds. " +
            "Created Date: " + domExportDetails.start + " to " + domExportDetails.end +
            " | Confirm button: " + domExportDetails.button +
            " | Visible buttons: " + visibleButtons + " | visible inputs: " + visibleInputs
          );
        }
        throw new Error(
          "Timed out waiting for the SPX Export form after the extension automatically opened the Assignment Task Export menu. SPX may have changed its page controls or blocked the scripted click. " +
          "Visible buttons: " + visibleButtons + " | visible inputs: " + visibleInputs
        );
      }
      const { vm: exportVm, form, createdKey, context } = found;
      if (!createdKey) {
        throw new Error("SPX Assignment Task export form has no Created Date field. Detected form fields: " + Object.keys(form).join(", "));
      }

      const existing = form[createdKey];
      const buildDateValue = (text, sample) => {
        if (sample instanceof Date) return new Date(text.replace(" ", "T"));
        if (sample && typeof sample.clone === "function" && typeof sample.startOf === "function") {
          const datePart = text.slice(0, 10);
          const timePart = text.slice(11);
          const parsed = new Date(datePart + "T" + timePart);
          if (window.moment) return window.moment(parsed);
          const copy = sample.clone();
          return copy.set({
            year: parsed.getFullYear(), month: parsed.getMonth(), date: parsed.getDate(),
            hour: parsed.getHours(), minute: parsed.getMinutes(), second: parsed.getSeconds(), millisecond: 0
          });
        }
        if (typeof sample === "number") {
          const stamp = new Date(text.replace(" ", "T")).getTime();
          return sample > 100000000000 ? stamp : Math.floor(stamp / 1000);
        }
        return text;
      };
      if (Array.isArray(existing)) {
        form[createdKey] = [
          buildDateValue(startText, existing[0]),
          buildDateValue(endText, existing[1] ?? existing[0])
        ];
      } else if (existing && typeof existing === "object" && ("start" in existing || "end" in existing || "startTime" in existing || "endTime" in existing)) {
        const clone = { ...existing };
        const startKey = "start" in clone ? "start" : "startTime";
        const endKey = "end" in clone ? "end" : "endTime";
        clone[startKey] = buildDateValue(startText, clone[startKey]);
        clone[endKey] = buildDateValue(endText, clone[endKey]);
        form[createdKey] = clone;
      } else {
        form[createdKey] = [startText, endText];
      }

      try { exportVm.$forceUpdate?.(); } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
      const originalExportFunction = found.originalExportFunction || exportVm.exportFunction;
      const confirmExport = found.confirm || exportVm.confirm;
      const confirmOwner = found.confirmOwner || exportVm;
      const confirmRoot = found.dialogRoot || document;
      const confirmButton = [...confirmRoot.querySelectorAll("button,[role='button'],.el-button")]
        .filter(visible)
        .find(button => /\b(confirm|export|generate|download)\b/i.test(
          String(button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()
        ));
      if (typeof originalExportFunction !== "function") {
        throw new Error("SPX Assignment Task export handler was not found in the dialog component chain.");
      }
      if (typeof confirmExport !== "function" && !confirmButton) {
        throw new Error("SPX Assignment Task dialog was detected, but no Confirm/Export action was available.");
      }
      let apiResult = null;
      const wrappedExportFunction = async function(params) {
        const response = await originalExportFunction.call(this, params);
        const body = response?.data ?? response ?? null;
        try { apiResult = JSON.parse(JSON.stringify(body)); }
        catch (_) {
          apiResult = {
            retcode: body?.retcode,
            message: body?.message,
            data: { task_id: body?.data?.task_id, download_url: body?.data?.download_url }
          };
        }
        try {
          sessionStorage.setItem(exportResultStorageKey, JSON.stringify({
            __badocAssignmentTask: true, ok: true, stage: "api-response",
            taskId: getTaskIdFromPageResponse(apiResult), apiResult,
            directUrl: String(apiResult?.data?.download_url || apiResult?.data?.url || "").trim(),
            createdDate: date, context
          }));
        } catch (_) {}
        return response;
      };
      let patchedOwner = null;
      for (const owner of (found.callbackOwners || [exportVm])) {
        try {
          owner.exportFunction = wrappedExportFunction;
          if (owner.exportFunction === wrappedExportFunction) {
            patchedOwner = owner;
            break;
          }
        } catch (_) {}
      }
      if (!patchedOwner) {
        throw new Error("SPX Assignment Task export callback could not be hooked from its dialog component.");
      }
      try {
        if (typeof confirmExport === "function") {
          await confirmExport.call(confirmOwner);
        } else {
          confirmButton.click();
          const clickDeadline = Date.now() + 30000;
          while (Date.now() < clickDeadline && !apiResult) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (!apiResult) {
            throw new Error("SPX Confirm/Export was clicked, but the export handler did not return an API response.");
          }
        }
      } finally {
        try { patchedOwner.exportFunction = originalExportFunction; } catch (_) {}
      }
      const taskId = getTaskIdFromPageResponse(apiResult);
      const data = apiResult?.data || apiResult || {};
      const finalResult = {
        __badocAssignmentTask: true, ok: true, stage: "confirmed",
        taskId, apiResult,
        directUrl: String(data.download_url || data.url || "").trim(),
        createdDate: date, context
      };
      try { sessionStorage.setItem(exportResultStorageKey, JSON.stringify(finalResult)); } catch (_) {}
      return finalResult;

      function getTaskIdFromPageResponse(value, depth = 0) {
        if (!value || depth > 5) return 0;
        if (Array.isArray(value)) {
          for (const item of value) { const id = getTaskIdFromPageResponse(item, depth + 1); if (id) return id; }
          return 0;
        }
        if (typeof value !== "object") return 0;
        for (const key of ["task_id", "taskId", "export_task_id", "exportTaskId", "id"]) {
          const id = Number(value[key] || 0);
          if (Number.isFinite(id) && id > 0) return id;
        }
        for (const key of ["task", "export_task", "exportTask", "data", "result"]) {
          const id = getTaskIdFromPageResponse(value[key], depth + 1);
          if (id) return id;
        }
        return 0;
      }
      } catch(error) {
        const failure = {
          __badocAssignmentTask: true, ok: false,
          error: String(error?.message || error),
          stack: String(error?.stack || "").slice(0, 1200),
          route: String(location.href || "")
        };
        try { sessionStorage.setItem(exportResultStorageKey, JSON.stringify(failure)); } catch (_) {}
        return failure;
      }
    }
  });
  } catch (error) { injectionError = error; }
  let result = null;
  const successfulTopFrame = Array.isArray(results)
    ? results.find(item => item && item.frameId === 0 && item.result?.__badocAssignmentTask && item.result.ok === true)
    : null;
  const successfulFrame = Array.isArray(results)
    ? results.find(item => item && item.result?.__badocAssignmentTask && item.result.ok === true)
    : null;
  const injection = successfulTopFrame || successfulFrame || (Array.isArray(results)
    ? (results.find(item => item && item.frameId === 0) || results[0])
    : null);
  const injectionFrameId = Number.isInteger(injection?.frameId) ? injection.frameId : null;
  if (injection?.error) injectionError = new Error(String(injection.error.message || injection.error));
  result = injection?.result || null;
  // The export callback writes its response to sessionStorage before SPX can
  // close/repaint its dialog. Read it back if executeScript lost its return.
  if (!result) {
    const readDeadline = Date.now() + 5000;
    while (Date.now() < readDeadline && !result) {
      try {
        const storedResults = await chrome.scripting.executeScript({
          target: injectionFrameId === null ? { tabId } : { tabId, frameIds: [injectionFrameId] },
          world: "MAIN",
          args: [resultStorageKey],
          func: key => {
            try {
              const raw = sessionStorage.getItem(key);
              if (!raw) return null;
              sessionStorage.removeItem(key);
              return JSON.parse(raw);
            } catch (error) {
              return { __badocAssignmentTask: true, ok: false, error: "Could not read saved SPX export response: " + String(error?.message || error) };
            }
          }
        });
        const stored = Array.isArray(storedResults)
          ? (storedResults.find(item => item && item.frameId === 0) || storedResults[0])
          : null;
        result = stored?.result || null;
        if (result) break;
      } catch (error) { injectionError = injectionError || error; }
      await sleep(250);
    }
  }
  if (!result) {
    const detail = injectionError?.message ? " " + injectionError.message : "";
    throw new Error("SPX did not return its Assignment Task export response before the page handoff ended. Confirm the Export dialog was submitted and retry." + detail);
  }
  if (result.__badocAssignmentTask && result.ok === false) {
    throw new Error("SPX Assignment Task page: " + result.error + (result.route ? " · " + result.route : ""));
  }
  if (!result.__badocAssignmentTask || result.ok !== true) {
    throw new Error("SPX page returned an unexpected Assignment Task response.");
  }
  return result;
}

function assignmentTaskDateRange(selectedDate) {
  let date = String(selectedDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = phDateString();
  const parsed = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    date = phDateString();
  }
  // SPX ctime uses Unix seconds aligned to Asia/Manila midnight.
  const dayStartMs = Date.parse(date + "T00:00:00Z") - 8 * 60 * 60 * 1000;
  const startSec = Math.floor(dayStartMs / 1000);
  const endSec = startSec + 24 * 60 * 60 - 1;
  return {
    date,
    startSec,
    endSec,
    formatCondition: "Created Date= " + date + " 00:00:00," + date + " 23:59:59"
  };
}

function assignmentTaskRowMatches(task, range, submittedAtSec) {
  if (!task || typeof task !== "object") return false;
  if (String(task.biz_name || "") !== ASSIGNMENT_TASK_EXPORT_BIZ_NAME) return false;
  if (String(task.export_name || "") !== ASSIGNMENT_TASK_EXPORT_NAME) return false;
  if (Number(task.station_id || 0) && Number(task.station_id) !== ASSIGNMENT_TASK_STATION_ID) return false;
  const condition = parseTaskCondition(task);
  const conditionStart = Number(condition?.gte?.ctime || 0);
  const conditionEnd = Number(condition?.lte?.ctime || 0);
  const exactDateRange = conditionStart === range.startSec && conditionEnd === range.endSec;
  const createdAt = Number(task.ctime || 0);
  const freshTask = createdAt >= submittedAtSec - 120 && createdAt <= Math.floor(Date.now() / 1000) + 60;
  const hasConditionRange = conditionStart > 0 || conditionEnd > 0;
  return exactDateRange || (!hasConditionRange && freshTask);
}

function findAssignmentTaskIdInResponse(json, range, submittedAtSec) {
  const directTaskId = Number(
    json?.data?.task_id || json?.task_id ||
    json?.data?.task?.task_id || json?.data?.export_task_id || 0
  );
  if (Number.isFinite(directTaskId) && directTaskId > 0) return directTaskId;

  const possibleLists = [
    json?.data?.task_list, json?.data?.tasks, json?.data?.list,
    json?.task_list, json?.tasks, json?.list
  ].filter(Array.isArray);
  for (const rows of possibleLists) {
    const match = rows
      .filter(task => assignmentTaskRowMatches(task, range, submittedAtSec))
      .sort((a, b) => Number(b?.ctime || 0) - Number(a?.ctime || 0))[0];
    const taskId = Number(match?.task_id || match?.taskId || 0);
    if (taskId > 0) return taskId;
  }
  return 0;
}

async function findSubmittedAssignmentTaskId(range, submittedAtSec, job) {
  const sources = ["fms", "fm", ""];
  const startTime = Math.max(0, submittedAtSec - 120);
  const deadline = Date.now() + 45000;
  let lastErrors = [];
  while (Date.now() < deadline) {
    if (job.cancelled) throw new Error("Assignment Task export cancelled.");
    const lookups = await Promise.allSettled(
      sources.map(source => listTasks(startTime, source, 1, false, 0))
    );
    for (let i = 0; i < lookups.length; i++) {
      const lookup = lookups[i];
      if (lookup.status !== "fulfilled") {
        lastErrors.push((sources[i] || "default") + ": " + (lookup.reason?.message || String(lookup.reason)));
        continue;
      }
      const match = (lookup.value || [])
        .filter(task => assignmentTaskRowMatches(task, range, submittedAtSec))
        .sort((a, b) => Number(b?.ctime || 0) - Number(a?.ctime || 0))[0];
      const taskId = Number(match?.task_id || match?.taskId || 0);
      if (taskId > 0) return taskId;
    }
    await sleep(1800);
  }
  const detail = lastErrors.length ? " Task-list lookup errors: " + [...new Set(lastErrors)].slice(0, 3).join("; ") + "." : "";
  throw new Error("SPX received the Assignment Task export request but did not expose its new feeder_assignment_task ID in the response or task list." + detail);
}

async function submitAssignmentTaskExport(job) {
  const range = assignmentTaskDateRange(job.selectedDate);
  const submittedAtSec = Math.floor(Date.now() / 1000);
  const query = fmQuery({
    ctime: String(range.startSec) + "," + String(range.endSec),
    format_condition: range.formatCondition
  });
  const url = SPX_ORIGIN + ASSIGNMENT_TASK_EXPORT_PATH + "?" + query;

  sendToPort(job.ownerPort, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
    message: "Submitting Assignment Task export directly to SPX for " + range.date + " without opening an SPX tab…"
  });
  const response = await extensionFetchText(url, {
    method: "GET",
    headers: await getLinehaulRequestHeaders()
  });
  const json = parseJsonResponse("SPX Assignment Task export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error("SPX Assignment Task export request failed: " +
      (json?.message || "SPX export failed (HTTP " + response.status + ")."));
  }

  let taskId = findAssignmentTaskIdInResponse(json, range, submittedAtSec);
  if (!taskId) {
    sendToPort(job.ownerPort, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
      message: "SPX accepted the Created Date export request. Locating its new feeder_assignment_task in the export task list…"
    });
    taskId = await findSubmittedAssignmentTaskId(range, submittedAtSec, job);
  }

  sendToPort(job.ownerPort, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
    message: "SPX created Assignment Task export " + taskId + ". Waiting for the CSV…"
  });
  const data = json?.data || json || {};
  return {
    taskId,
    range,
    apiResult: json,
    directUrl: String(data.download_url || data.url || "").trim()
  };
}

async function runAssignmentTaskExportJob(job) {
  const port = job.ownerPort;
  try {
    job.startedAt = Date.now();
    const submitted = await submitAssignmentTaskExport(job);
    let csv = null;
    const taskId = Number(submitted.taskId || 0);

    if (submitted.directUrl) {
      csv = await downloadCsv(submitted.directUrl);
    } else if (taskId) {
      const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
      let completedInfo = await waitForAssignedTodayExportTask(taskId, waitStartSec, job, "Assignment Task");
      const completedTask = completedInfo.task || {};
      if (completedTask.biz_name && String(completedTask.biz_name) !== ASSIGNMENT_TASK_EXPORT_BIZ_NAME) {
        throw new Error("SPX returned a different export type for Assignment Task " + taskId + ".");
      }
      if (completedTask.export_name && String(completedTask.export_name) !== ASSIGNMENT_TASK_EXPORT_NAME) {
        throw new Error("SPX returned a different export name for Assignment Task " + taskId + ".");
      }
      if (Number(completedTask.station_id || 0) && Number(completedTask.station_id) !== ASSIGNMENT_TASK_STATION_ID) {
        throw new Error("SPX returned an Assignment Task export from a different station.");
      }

      let directFileError = "";
      if (completedTask.file_name) {
        sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
          message: "Assignment Task " + taskId + " succeeded. Downloading its authenticated CSV file path…"
        });
        try {
          csv = await downloadAssignmentTaskFile(completedTask, taskId);
        } catch (error) {
          directFileError = error?.message || String(error);
          console.warn("SPX direct Assignment Task file download failed; checking media_id fallback:", directFileError);
        }
      }

      if (!csv) {
        let mediaId = completedInfo.mediaId || getExportMediaId(completedTask) || getExportMediaId(submitted.apiResult);
        if (!mediaId) {
          completedInfo = await waitForAssignmentTaskMediaId(taskId, completedInfo, job, "Assignment Task");
          mediaId = completedInfo.mediaId || getExportMediaId(completedInfo.task) || getExportMediaId(submitted.apiResult);
        }
        if (!mediaId) {
          const task = completedInfo.task || completedTask;
          const taskFields = Object.keys(task).slice(0, 24).join(", ") || "none";
          const diagnosticKeys = ["media_id", "is_mms_gray", "file_name", "export_source", "export_name", "biz_name", "export_status", "queue_position"];
          const diagnosticValues = diagnosticKeys.map(key => {
            const value = task[key];
            const rendered = value === undefined ? "missing" : value === null || value === "" ? "empty" : JSON.stringify(value);
            return key + "=" + rendered;
          }).join(", ");
          const lookupDetail = completedInfo.lookupErrors?.length
            ? " Metadata lookup errors: " + [...new Set(completedInfo.lookupErrors)].slice(0, 3).join("; ") + "."
            : "";
          throw new Error(
            "SPX completed Assignment Task " + taskId + ", but file_name and media_id remained unavailable after " +
            Math.round(ASSIGNMENT_TASK_MEDIA_ID_WAIT_MS / 1000) + " seconds of post-completion full-record checks. " +
            "Queue: " + (completedInfo.source || "default") + ". Task fields: " + taskFields +
            ". Key values: " + diagnosticValues +
            (directFileError ? ". Direct file download: " + directFileError : "") +
            ". The signed-download request was not sent because SPX requires media_id (code 40902)." + lookupDetail
          );
        }
        sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
          message: "Assignment Task " + taskId + " completed. Media ID recovered; requesting the signed CSV download…"
        });
        const signedUrl = await getSignedDownloadUrl(taskId, completedInfo.source, mediaId);
        csv = await downloadCsv(signedUrl);
      }
    } else {
      throw new Error("SPX did not return a usable Assignment Task task ID or download URL.");
    }

    const rowCount = Math.max(0, String(csv.text || "").split(/\r?\n/).filter(Boolean).length - 1);
    if (!rowCount) throw new Error("SPX Assignment Task export completed but contained no data rows.");
    sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_CSV", {
      taskId: taskId || "direct",
      selectedDate: submitted.range.date,
      fileName: csv.fileName || "assignment_task.csv",
      csvText: csv.text,
      rowCount
    });
  } catch (error) {
    console.error("BADOC SPX Assignment Task export failed:", error);
    sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_ERROR", {
      message: error?.message || String(error),
      selectedDate: job.selectedDate
    });
  } finally {
    releaseActiveJob(job);
  }
}

function setsEqual(a, b) {
  const aa = new Set((a || []).map(String));
  const bb = new Set((b || []).map(String));
  if (aa.size !== bb.size) return false;
  for (const x of aa) if (!bb.has(x)) return false;
  return true;
}

function parseTaskCondition(task) {
  const raw = task?.condition;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch { return {}; }
}

function normalizeHubName(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function taskMatchesExpectedHub(task, job) {
  const expected = normalizeHubName(job?.hubName);
  if (!expected) return true;
  const actual = normalizeHubName(task?.station_name || task?.stationName);
  // Some SPX responses omit station_name. The task is already identified by
  // the task_id returned by our own export request, so absence of the display
  // name must not reject a valid task. When SPX does return station_name, use
  // it to prevent an export for a different selected hub from being accepted.
  return !actual || actual === expected;
}

function isParcelDeliveryTask(task, job) {
  if (String(task?.export_name || "") !== PARCEL_EXPORT_NAME) return false;
  if (String(task?.biz_name || "") !== PARCEL_EXPORT_BIZ_NAME) return false;
  if (!taskMatchesExpectedHub(task, job)) return false;
  const condition = parseTaskCondition(task);
  const trackingStatus = String(condition?.tracking_status || "");
  if (!trackingStatus) return false;
  const requested = String(job?.trackingStatus || "").split(",").map(x => x.trim()).filter(x => ["2","4","5"].includes(x));
  const expected = requested.length ? [...new Set(requested)] : PARCEL_DELIVERY_STATUS_IDS;
  return setsEqual(trackingStatus.split(",").map(x => x.trim()).filter(Boolean), expected);
}

function isParcelInboundTask(task, job) {
  if (String(task?.export_name || "") !== PARCEL_EXPORT_NAME) return false;
  if (String(task?.biz_name || "") !== PARCEL_EXPORT_BIZ_NAME) return false;
  if (!taskMatchesExpectedHub(task, job)) return false;
  const condition = parseTaskCondition(task);
  const trackingStatus = String(condition?.tracking_status || "");
  if (!trackingStatus) return false;
  const expectedIds = job?.receivedChecking ? [1] : PARCEL_INBOUND_STATUS_IDS;
  return setsEqual(trackingStatus.split(",").map(x => x.trim()).filter(Boolean), expectedIds);
}


function phDateMidnightMs(date) {
  // SPX date fields are Philippine local dates. Avoid browser-local timezone
  // differences by constructing the UTC instant for Asia/Manila midnight.
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  return Date.UTC(y, m, d) - (8 * 60 * 60 * 1000);
}

function parcelForwardDateRange() {
  const now = new Date();
  // Work from the current Philippine calendar date, not the machine timezone.
  const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - PARCEL_FORWARD_EXPORT_LOOKBACK_DAYS);

  const startMs = phDateMidnightMs(start);
  const endMs = phDateMidnightMs(end);

  const fmt = d =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;

  return {
    startSec: Math.floor(startMs / 1000),
    endSec: Math.floor(endMs / 1000),
    startDate: fmt(start),
    endDate: fmt(end)
  };
}

async function submitParcelForwardExport(job) {
  const range = parcelForwardDateRange();
  const inboundStatusIds = job?.receivedChecking ? [1] : PARCEL_INBOUND_STATUS_IDS;
  const inboundStatusNames = job?.receivedChecking ? ["LMHub_Received"] : PARCEL_FORWARD_STATUS_NAMES;
  const body = {
    tracking_status: inboundStatusIds.join(","),
    bulky_type: "1,0,2",
    ctime: `${range.startSec},${range.endSec}`,
    format_condition:
      `Status Log= ${inboundStatusNames.join(",")}; ` +
      `Bulky Type= Bulky,N/A,Non-Bulky; ` +
      `Created Date= ${range.startDate} 00:00:00,${range.endDate} 00:00:00; ` +
      `Driver= All`
  };

  progress(
    `Submitting direct SPX Forward Order export (${range.startDate} → ${range.endDate})…`,
    { phase: "parcel-api-export", dateStart: range.startDate, dateEnd: range.endDate }
  );

  const response = await extensionFetchText(
    `${SPX_ORIGIN}${PARCEL_FORWARD_EXPORT_PATH}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*"
      },
      body: JSON.stringify(body)
    }
  );

  const json = parseJsonResponse("SPX Forward Order export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(
      json?.message ||
      `SPX Forward Order export request failed (HTTP ${response.status}).`
    );
  }

  const taskId = Number(
    json?.data?.task_id ||
    json?.task_id ||
    0
  );

  if (!taskId) {
    throw new Error("SPX accepted the Forward Order export request but returned no task ID.");
  }

  progress(`SPX Forward Order export task ${taskId} created directly.`, {
    phase: "parcel-task",
    taskId,
    dateStart: range.startDate,
    dateEnd: range.endDate
  });

  return { taskId, range, requestBody: body, apiResult: json };
}

function parcelDeliveryDateRange() {
  const now = new Date();
  // Always use the Philippine calendar date, regardless of the computer's
  // local timezone.
  const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(
    phNow.getUTCFullYear(),
    phNow.getUTCMonth(),
    phNow.getUTCDate()
  ));
  const lookback = new Date(today);
  lookback.setUTCDate(lookback.getUTCDate() - PARCEL_DELIVERY_LOOKBACK_DAYS);

  const startMs = phDateMidnightMs(lookback);
  const todayStartMs = phDateMidnightMs(today);
  const todayEndMs = todayStartMs + (24 * 60 * 60 * 1000) - 1;

  const fmt = d =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;

  return {
    createdStartSec: Math.floor(startMs / 1000),
    createdEndSec: Math.floor(todayStartMs / 1000),
    assignedStartSec: Math.floor(todayStartMs / 1000),
    assignedEndSec: Math.floor(todayEndMs / 1000),
    createdStartDate: fmt(lookback),
    todayDate: fmt(today)
  };
}

async function submitParcelDeliveryExport(job) {
  const range = parcelDeliveryDateRange();
  const requestedIds = String(job?.trackingStatus || "").split(",").map(x => x.trim()).filter(x => ["2","4","5"].includes(x));
  const statusIds = requestedIds.length ? [...new Set(requestedIds)] : PARCEL_DELIVERY_STATUS_IDS;
  const nameById = { "2":"Delivering", "4":"Delivered", "5":"OnHold" };
  const statusNames = statusIds.map(id => nameById[id]);
  const body = {
    tracking_status: statusIds.join(","),
    bulky_type: "1,0,2",
    ctime: `${range.createdStartSec},${range.assignedEndSec}`,
    pick_up_time: `${range.assignedStartSec},${range.assignedEndSec}`,
    format_condition:
      `Status Log= ${statusNames.join(",")}; ` +
      `Bulky Type= Bulky,N/A,Non-Bulky; ` +
      `Created Date= ${range.createdStartDate} 00:00:00,${range.todayDate} 23:59:59; ` +
      `Assigned Time= ${range.todayDate} 00:00:00,${range.todayDate} 23:59:59; ` +
      `Driver= All`
  };
  progress(`Submitting SPX ${statusNames.join(" / ")}-only export for ${range.todayDate}…`, {
    phase: "parcel-delivery-api-export", kind: "parcel-delivery", trackingStatus: statusIds.join(","), statusName: statusNames.join(" / "), dateStart: range.todayDate, dateEnd: range.todayDate
  });
  const response = await extensionFetchText(`${SPX_ORIGIN}${PARCEL_FORWARD_EXPORT_PATH}`, {
    method: "POST",
    headers: {"Content-Type":"application/json","Accept":"application/json, text/plain, */*"},
    body: JSON.stringify(body)
  });
  const json = parseJsonResponse(`SPX ${statusNames.join(" / ")} export`, response);
  if (!response.ok || Number(json?.retcode) !== 0) throw new Error(json?.message || `SPX ${statusNames.join(" / ")} export failed (HTTP ${response.status}).`);
  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) throw new Error("SPX accepted the delivery export request but returned no task ID.");
  progress(`SPX ${statusNames.join(" / ")} export task ${taskId} created.`, {
    phase:"parcel-delivery-task",kind:"parcel-delivery",trackingStatus:statusIds.join(","),statusName:statusNames.join(" / "),taskId,dateStart:range.todayDate,dateEnd:range.todayDate
  });
  return {taskId,range,requestBody:body,apiResult:json,statusIds,statusNames};
}

function taskMatchesRiderExport(task) {
  return String(task?.export_name || "") === RIDER_EXPORT_NAME &&
    String(task?.biz_name || "") === RIDER_EXPORT_BIZ_NAME;
}

async function listRiderTask(taskId) {
  const url = `${SPX_ORIGIN}${RIDER_TASK_LIST_PATH}?start_time=${Math.max(0, Math.floor(Date.now()/1000)-3600)}&task_ids=${encodeURIComponent(taskId)}`;
  const response = await extensionFetchText(url);
  const json = parseJsonResponse("SPX rider export task", response);
  if (Number(json?.retcode) !== 0) throw new Error(json?.message || "SPX rider export task lookup failed.");
  const tasks = Array.isArray(json?.data?.task_list) ? json.data.task_list : [];
  return tasks.find(t => Number(t?.task_id || 0) === Number(taskId)) || null;
}

async function submitRiderExport(job) {
  riderProgress(`Submitting SPX Rider export${job?.hubName ? ` for ${job.hubName}` : ""}…`, {
    phase: "rider-api-export",
    kind: "riders",
    hubName: job?.hubName || "",
    hubCode: job?.hubCode || ""
  });

  const csrf = await getSpxCookieValue(["csrftoken", "csrf_token", "csrfToken", "X-CSRFToken"]);
  const deviceId = await getSpxCookieValue(["spx-admin-device-id", "device-id", "device_id", "deviceId"]);
  const response = await extensionFetchText(`${SPX_ORIGIN}${RIDER_EXPORT_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Referer": `${SPX_ORIGIN}/`,
      "app": "FMS Portal",
      "X-CSRFToken": csrf,
      "device-id": deviceId
    },
    body: "{}"
  });

  const json = parseJsonResponse("SPX rider export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(json?.message || `SPX rider export failed (HTTP ${response.status}).`);
  }

  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) throw new Error("SPX accepted the rider export request but returned no task ID.");

  riderProgress(`SPX Rider export task ${taskId} created.`, {
    phase: "rider-task",
    kind: "riders",
    taskId,
    hubName: job?.hubName || "",
    hubCode: job?.hubCode || ""
  });

  return { taskId, apiResult: json };
}

function driverFileNameFromTask(task) {
  const raw = String(task?.file_name || "").trim();
  const name = raw.split("/").pop() || "ph_driver.csv";
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") || "ph_driver.csv";
}

async function downloadDriverCsv(task) {
  const rawPath = String(task?.file_name || "").trim().replace(/^\/+/, "");
  if (!rawPath) throw new Error("SPX completed the rider export but returned no file path.");
  const url = `${SPX_ORIGIN}/${rawPath}`;
  riderProgress(`Downloading completed rider CSV ${driverFileNameFromTask(task)}…`, {
    phase: "rider-download",
    kind: "riders",
    taskId: Number(task?.task_id || 0)
  });

  const response = await extensionFetchText(url, {
    headers: {
      "Accept": "text/csv,text/plain,application/octet-stream,*/*",
      "Referer": `${SPX_ORIGIN}/`
    }
  });
  const text = String(response?.text || "").replace(/^\uFEFF/, "");
  if (!response.ok) throw new Error(`SPX rider CSV download failed (HTTP ${response.status}).`);
  if (!text.trim()) throw new Error("SPX returned an empty rider CSV.");
  if (/<!doctype|<html/i.test(text.slice(0,300))) throw new Error("SPX returned the web app HTML instead of the rider CSV.");
  return { text, fileName: driverFileNameFromTask(task), url };
}

async function runRiderJob(job) {
  try {
    job.startedAt = Date.now();
    riderProgress("Starting SPX Rider export…", { phase: "rider-api", kind: "riders", hubName: job.hubName, hubCode: job.hubCode });

    const submitted = await submitRiderExport(job);
    const taskId = submitted.taskId;
    const deadline = Date.now() + MAX_WAIT_MS;
    let lastStatus = null;
    let lastAt = 0;

    while (Date.now() < deadline) {
      if (job.cancelled) throw new Error("Sync cancelled.");
      const task = await listRiderTask(taskId);
      if (task) {
        if (!taskMatchesRiderExport(task)) throw new Error("The completed SPX task does not match the rider export.");
        const status = Number(task?.export_status ?? -1);
        if (status === 2) {
          const condition = parseTaskCondition(task);
          const stationId = Number(condition?.station_id || task?.station_id || 0) || 0;
          const csv = await downloadDriverCsv(task);
          const rowCount = csv.text.split(/\r?\n/).filter(x => x.trim()).length;
          const dataRows = Math.max(0, rowCount - 1);
          riderProgress(`Downloaded ${dataRows.toLocaleString()} riders. Sending to NOL3 Planning…`, {
            phase: "rider-import",
            kind: "riders",
            taskId,
            rowCount: dataRows,
            hubName: job.hubName,
            hubCode: job.hubCode,
            stationId,
            fileName: csv.fileName
          });
          sendToBadoc("BADOC_SPX_RIDER_CSV", {
            taskId,
            rowCount: dataRows,
            fileName: csv.fileName,
            csvText: csv.text,
            hubId: job.hubId,
            hubName: job.hubName,
            hubCode: job.hubCode,
            stationId,
            taskStationName: String(task?.station_name || "")
          });
          return;
        }
        if (status === 3 || task?.failed_reason) throw new Error(task?.failed_reason || "SPX rider export failed.");
        const now = Date.now();
        if (status !== lastStatus || now-lastAt >= 10000) {
          riderProgress(`SPX Rider export task ${taskId} is processing…`, {
            phase: "rider-processing",
            kind: "riders",
            taskId,
            hubName: job.hubName,
            hubCode: job.hubCode
          });
          lastStatus = status;
          lastAt = now;
        }
      } else {
        riderProgress(`SPX Rider export task ${taskId} created. Waiting for task status…`, { phase: "rider-processing", kind: "riders", taskId, hubName: job.hubName, hubCode: job.hubCode });
      }
      await sleep(POLL_MS);
    }
    throw new Error("SPX rider export is still queued after 25 minutes.");
  } catch (error) {
    console.error("BADOC SPX rider auto-import failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", { message: error?.message || String(error), kind: "riders" });
  } finally {
    releaseActiveJob(job);
  }
}

async function runParcelDeliveryJob(job) {
  try {
    job.startedAt = Date.now();
    progress("Starting Delivering / Delivered / On-Hold sync using the direct SPX export API…", {
      phase: "parcel-delivery-api"
    });

    const submitted = await submitParcelDeliveryExport(job);
    const taskId = submitted.taskId;
    const waitStartSec = Math.max(
      0,
      Math.floor((job.startedAt - 10 * 60 * 1000) / 1000)
    );

    const completed = await waitForCompletion(taskId, waitStartSec, job);

    if (!isParcelDeliveryTask(completed, job)) {
      throw new Error("The completed SPX task does not match the requested delivery-status export.");
    }

    progress(
      `SPX delivery task ${taskId} is complete. Getting a fresh signed download URL…`,
      { phase: "parcel-delivery-download-url", taskId }
    );

    const signedUrl = await getSignedDownloadUrl(taskId);
    progress("Downloading the completed Delivering / Delivered / On-Hold CSV directly…", {
      phase: "parcel-delivery-download",
      taskId
    });

    const csv = await downloadCsv(signedUrl);
    const rowCount = csv.text.split(/\r?\n/).filter(Boolean).length;
    const dataRows = Math.max(0, rowCount - 1);

    progress(
      `Downloaded ${dataRows.toLocaleString()} delivery-status rows. Sending to NOL3 Planning…`,
      { phase: "parcel-delivery-import", taskId }
    );

    sendToBadoc("BADOC_SPX_PARCEL_DELIVERY_CSV", {
      taskId,
      trackingStatus: submitted.statusIds.join(","),
      statusName: submitted.statusNames.join(" / "),
      fileName: csv.fileName || `export_forward_order_${submitted.statusNames.join("_").toLowerCase()}.csv`,
      csvText: csv.text
    });
  } catch (error) {
    console.error("BADOC SPX direct Parcel delivery sync failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", {
      message: error?.message || String(error),
      kind: "parcel-delivery"
    });
  } finally {
    releaseActiveJob(job);
  }
}

async function submitOneSecondaryExport(job, { statusId, statusName, endpoint, label }) {
  const range = parcelForwardDateRange();
  const body = {
    tracking_status: String(statusId),
    bulky_type: "1,0,2",
    ctime: `${range.startSec},${range.endSec}`,
    format_condition:
      `Status Log= ${statusName}; ` +
      `Bulky Type= Bulky,N/A,Non-Bulky; ` +
      `Created Date= ${range.startDate} 00:00:00,${range.endDate} 00:00:00; ` +
      `Driver= All`
  };
  progress(`Submitting SPX ${label} export (${range.startDate} → ${range.endDate})…`, {
    phase: "parcel-api-export", kind: "parcel-secondary", statusName, dateStart: range.startDate, dateEnd: range.endDate
  });
  const response = await extensionFetchText(`${SPX_ORIGIN}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/plain, */*" },
    body: JSON.stringify(body)
  });
  const json = parseJsonResponse(`SPX ${label} export`, response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(json?.message || `SPX ${label} export failed (HTTP ${response.status}).`);
  }
  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) throw new Error(`SPX accepted the ${label} export request but returned no task ID.`);
  progress(`SPX ${label} export task ${taskId} created.`, { phase: "parcel-secondary-task", kind: "parcel-secondary", taskId, statusName });
  return { taskId, range, statusName, label };
}

async function downloadSecondaryExport(submitted, job) {
  const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
  const completed = await waitForCompletion(submitted.taskId, waitStartSec, job);
  if (Number(completed?.station_id || 0) !== PARCEL_STATION_ID) {
    throw new Error(`The ${submitted.label} task station did not match BADOC HUB.`);
  }
  progress(`${submitted.label} export complete. Getting signed download URL…`, { phase: "parcel-secondary-download-url", kind: "parcel-secondary", taskId: submitted.taskId, statusName: submitted.statusName });
  const signedUrl = await getSignedDownloadUrl(submitted.taskId);
  const csv = await downloadCsv(signedUrl);
  sendToBadoc("BADOC_SPX_SECONDARY_PARCEL_CSV", {
    taskId: submitted.taskId, statusName: submitted.statusName,
    fileName: csv.fileName || `export_${submitted.label.toLowerCase().replace(/\s+/g, "_")}.csv`, csvText: csv.text
  });
  return Math.max(0, csv.text.split(/\r?\n/).filter(Boolean).length - 1);
}

function phDateString(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftIsoDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+").replace(/%2C/gi, ",")}`)
    .join("&");
}

function buildFirstMileExportUrl(kind, selectedDate) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || "")) ? selectedDate : phDateString();
  const startSec = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) - 8 * 3600;
  const endSec = startSec + 86400 - 1;
  if (kind === "first-mile-orders") {
    const fromDate = shiftIsoDate(date, -FM_ORDER_LOOKBACK_DAYS);
    const fromSec = startSec - FM_ORDER_LOOKBACK_DAYS * 86400;
    // SPX dialog: All statuses and All bulky types; Created Time is the only restriction.
    const params = {
      ctime: `${fromSec},${endSec}`,
      format_condition: `Created Time= ${fromDate} 00:00:00,${date} 23:59:59`
    };
    return `${SPX_ORIGIN}${FM_PICKUP_ORDER_PATH}?${fmQuery(params)}`;
  }
  // SPX Pickup Task Management: All statuses, no other filter fields.
  return SPX_ORIGIN + FM_PICKUP_TASK_PATH;
}

async function runFirstMileExportJob(job) {
  const kind = job.kind;
  const label = kind === "first-mile-orders" ? "First Mile Orders" : "First Mile Tasks";
  const fallbackName = kind === "first-mile-orders" ? "first_mile_orders.csv" : "first_mile_tasks.csv";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(job.selectedDate || "")) ? job.selectedDate : phDateString();
  try {
    job.startedAt = Date.now();
    progress(`Submitting SPX ${label} export…`, { phase: "first-mile-export", kind });
    const url = buildFirstMileExportUrl(kind, date);
    // Read the response as bytes first. SPX may return JSON, CSV, or a real XLSX
    // workbook from this endpoint; response.text() corrupts binary XLSX payloads.
    const response = await extensionFetchBuffer(url, { headers: { Accept: "application/json, text/plain, */*" } });
    if (!response.ok) throw new Error(`SPX ${label} export failed (HTTP ${response.status}).`);

    const responseBytes = new Uint8Array(response.buffer);
    const responseText = new TextDecoder("utf-8").decode(response.buffer).replace(/^\uFEFF/, "");
    const responsePreview = responseText.trim();
    const isXlsxResponse = responseBytes.length > 3 && responseBytes[0] === 0x50 && responseBytes[1] === 0x4b;
    const isJsonResponse = /^\s*[\[{]/.test(responsePreview);
    const isHtmlResponse = /^<!doctype|^<html/i.test(responsePreview) || /html/i.test(response.contentType);
    const isFileResponse = isXlsxResponse || (!isJsonResponse && !isHtmlResponse && (/csv|text|spreadsheet|excel|octet-stream/i.test(response.contentType) || responsePreview.split(/\r?\n/, 1)[0].includes(",")));
    if (isFileResponse) {
      const directFile = await firstMileBufferToCsv(response.buffer, fallbackName, response.contentDisposition);
      return finishFirstMileExport(job, kind, date, 0, directFile, label);
    }
    if (isHtmlResponse) throw new Error(`${label}: SPX returned the web app HTML instead of an export response.`);

    const json = parseJsonResponse(`SPX ${label} export`, { ...response, text: responseText });
    if (Number(json?.retcode) !== 0) throw new Error(json?.message || `SPX ${label} export failed.`);

    let taskId = getFirstMileTaskId(json);
    const fileName = getFirstMileFileName(json);
    let directCsv = null;

    if (!taskId) {
      // Pickup exports can respond with retcode=0 and task_id=0 plus a filename.
      // SPX's file-mode response (Accept: */*) may then return the CSV/XLSX itself.
      progress(`${label}: SPX accepted the request without a task ID; checking the direct export response…`, {
        phase: "first-mile-file-mode", kind
      });
      try {
        const fileResponse = await extensionFetchBuffer(url, { headers: { Accept: "*/*" } });
        if (!fileResponse.ok) throw new Error(`HTTP ${fileResponse.status}`);
        const head = new TextDecoder("utf-8").decode(new Uint8Array(fileResponse.buffer).slice(0, 300)).replace(/^\uFEFF/, "").trim();
        const isJson = /^\s*[\[{]/.test(head) || /json/i.test(fileResponse.contentType);
        const isHtml = /^<!doctype|^<html/i.test(head) || /html/i.test(fileResponse.contentType);
        const isXlsx = new Uint8Array(fileResponse.buffer).slice(0, 2).every((v, i) => v === [0x50, 0x4b][i]);
        if (!isJson && !isHtml && (isXlsx || /csv|text|spreadsheet|excel|octet-stream/i.test(fileResponse.contentType) || head.includes(","))) {
          directCsv = await firstMileBufferToCsv(fileResponse.buffer, fileName || fallbackName, fileResponse.contentDisposition);
        }
      } catch (error) {
        job.firstMileFileModeError = error?.message || String(error);
      }
    }

    if (!taskId && !directCsv) {
      const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
      const task = await discoverFirstMileTask(waitStartSec, fileName, kind, job);
      taskId = Number(task?.task_id || 0);
      if (!taskId) {
        const preview = JSON.stringify(json).replace(/\s+/g, " ").slice(0, 220);
        const details = [fileName ? `SPX file: ${fileName}` : "", job.firstMileTaskListPreview ? `Recent export tasks: ${job.firstMileTaskListPreview}` : "", job.firstMileFileModeError ? `File mode: ${job.firstMileFileModeError}` : ""].filter(Boolean).join(" | ");
        throw new Error(`${label}: SPX accepted the export but did not return a task ID or a direct file. SPX response: ${preview}${details ? ` | ${details}` : ""}`);
      }
    }

    if (directCsv) return finishFirstMileExport(job, kind, date, 0, directCsv, label);

    progress(`${label}: export task ${taskId} found. Waiting for completion…`, { phase: "first-mile-task", kind, taskId });
    const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
    await waitForCompletion(taskId, waitStartSec, job);
    progress(`${label}: export complete. Retrieving download URL…`, { phase: "first-mile-download-url", kind, taskId });
    const signedUrl = await getFirstMileSignedDownloadUrl(taskId);
    const csv = await downloadFirstMileExportFile(signedUrl, fallbackName);
    return finishFirstMileExport(job, kind, date, taskId, csv, label);
  } catch (error) {
    console.error(`BADOC ${label} sync failed:`, error);
    sendToBadoc("BADOC_SPX_ERROR", { message: error?.message || String(error), kind });
  } finally {
    releaseActiveJob(job);
  }
}

function countFirstMileCsvColumnValue(csvText, columnAliases, expectedValue) {
  const source = String(csvText || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return null;
  const norm = value => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = new Set((columnAliases || []).map(norm));
  const headerIndex = rows[0].findIndex(value => aliases.has(norm(value)));
  if (headerIndex < 0) return null;
  const wanted = norm(expectedValue);
  return rows.slice(1).filter(values => norm(values[headerIndex]) === wanted).length;
}

function finishFirstMileExport(job, kind, date, taskId, csv, label) {
  const rows = Math.max(0, String(csv?.text || "").split(/\r?\n/).filter(Boolean).length - 1);
  const inboundedCount = kind === "first-mile-tasks"
    ? countFirstMileCsvColumnValue(csv?.text, ["Status", "Task Status", "Pickup Task Status"], "Inbounded")
    : null;
  if (kind === "first-mile-tasks" && inboundedCount === null) {
    throw new Error("SPX First Mile Tasks export is missing the Status column. The existing saved Tasks data was kept.");
  }
  const statusSummary = inboundedCount === null ? "" : " · " + inboundedCount.toLocaleString() + " Inbounded";
  progress(label + ": downloaded " + rows.toLocaleString() + " rows" + statusSummary + ". Returning CSV to BADOC HUB…", {
    phase: "first-mile-import", kind, taskId, rowCount: rows,
    ...(inboundedCount === null ? {} : { inboundedCount })
  });
  sendToBadoc(kind === "first-mile-orders" ? "BADOC_SPX_FIRST_MILE_ORDERS_CSV" : "BADOC_SPX_FIRST_MILE_TASKS_CSV", {
    taskId: taskId || "direct",
    selectedDate: date,
    fileName: csv.fileName || (kind === "first-mile-orders" ? "first_mile_orders.csv" : "first_mile_tasks.csv"),
    csvText: csv.text,
    rowCount: rows,
    ...(inboundedCount === null ? {} : { inboundedCount })
  });
  progress(label + ": " + rows.toLocaleString() + " rows ready for import" + statusSummary + ".", {
    phase: "first-mile-done", kind, taskId: taskId || 0, rowCount: rows,
    ...(inboundedCount === null ? {} : { inboundedCount })
  });
}

async function runParcelSecondaryJob(job) {
  try {
    job.startedAt = Date.now();
    progress("Starting separate transported and returned parcel sync…", { phase: "parcel-secondary-api", kind: "parcel-secondary" });
    // These are two distinct SPX exports: Forward Order for SOC_LHTransported,
    // and the Return export endpoint for Return_LMHub_Received.
    const transported = await submitOneSecondaryExport(job, {
      statusId: PARCEL_SECONDARY_TRANSPORT_STATUS_ID,
      statusName: PARCEL_SECONDARY_TRANSPORT_STATUS_NAME,
      endpoint: PARCEL_FORWARD_EXPORT_PATH,
      label: "SOC_LHTransported"
    });
    const transportedRows = await downloadSecondaryExport(transported, job);
    const returned = await submitOneSecondaryExport(job, {
      statusId: PARCEL_SECONDARY_RETURN_STATUS_ID,
      statusName: PARCEL_SECONDARY_RETURN_STATUS_NAME,
      endpoint: PARCEL_RETURN_EXPORT_PATH,
      label: "Return_LMHub_Received"
    });
    const returnRows = await downloadSecondaryExport(returned, job);
    sendToBadoc("BADOC_SPX_SECONDARY_PARCEL_DONE", {
      rowCount: transportedRows + returnRows,
      transportedRows, returnRows,
      fileName: "SPX transported and returned exports"
    });
  } catch (error) {
    console.error("BADOC SPX secondary parcel sync failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", { message: error?.message || String(error), kind: "parcel-secondary" });
  } finally {
    releaseActiveJob(job);
  }
}


async function runParcelInboundJob(job) {
  try {
    job.startedAt = Date.now();
    progress("Starting Parcel Count inbound sync using the direct SPX export API…", {
      phase: "parcel-api"
    });

    // No temporary Order Tracking tab, Vue component, dialog, or Confirm
    // button is needed. The extension service worker already has authenticated
    // SPX access and host permissions for the native API.
    const submitted = await submitParcelForwardExport(job);
    const taskId = submitted.taskId;

    const waitStartSec = Math.max(
      0,
      Math.floor((job.startedAt - 10 * 60 * 1000) / 1000)
    );

    const completed = await waitForCompletion(taskId, waitStartSec, job);

    if (!isParcelInboundTask(completed, job)) {
      throw new Error("The completed SPX task does not match the expected Forward Order export.");
    }

    progress(
      `SPX Parcel Count task ${taskId} is complete. Getting a fresh signed download URL…`,
      { phase: "parcel-download-url", taskId }
    );

    const signedUrl = await getSignedDownloadUrl(taskId);

    progress("Downloading the completed Parcel Count CSV directly…", {
      phase: "parcel-download",
      taskId
    });

    const csv = await downloadCsv(signedUrl);
    const rowCount = csv.text.split(/\r?\n/).filter(Boolean).length;
    const dataRows = Math.max(0, rowCount - 1);

    progress(
      `Downloaded ${dataRows.toLocaleString()} Parcel Count rows. Sending to NOL3 Planning…`,
      { phase: "parcel-import", taskId }
    );

    sendToBadoc("BADOC_SPX_PARCEL_CSV", {
      taskId,
      fileName: csv.fileName,
      csvText: csv.text
    });

    sendToBadoc("BADOC_SPX_PARCEL_DONE", {
      taskId,
      rowCount: dataRows,
      fileName: csv.fileName
    });
  } catch (error) {
    console.error("BADOC SPX direct Parcel inbound sync failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", {
      message: error?.message || String(error),
      kind: "parcel-inbound"
    });
  } finally {
    // Direct API mode does not create a temporary SPX tab/window.
    releaseActiveJob(job);
  }
}

function isTargetTask(task, job) {
  if (String(task?.export_name || "") !== LINEHAUL_EXPORT_NAME) return false;
  if (String(task?.biz_name || "") !== LINEHAUL_BIZ_NAME) return false;
  if (!taskMatchesExpectedHub(task, job)) return false;

  const condition = parseTaskCondition(task);
  // SPX currently returns current_station_id=0 for the completed Inbound ->
  // TO List export task, so do not hardcode Badoc's 3061 here. The task_id was
  // returned by the export request we just submitted, which is the primary
  // identity check; station_name is an optional hub-aware guard.
  return String(condition?.status ?? "") === "0" || Object.keys(condition).length === 0;
}

function notifyPodCheckerAssignedProgress(message) {
  // Send progress over the dashboard's already-connected BADOC_PAGE port.
  // runtime.sendMessage cannot deliver a push notification to a hosted page shim.
  sendToBadoc("BADOC_POD_CHECKER_ASSIGNED_PROGRESS", {
    message: String(message || "")
  });
}

async function waitForCompletion(taskId, startSec, job, pollIntervalMs = POLL_MS) {
  const deadline = Date.now() + MAX_WAIT_MS;
  let lastStatus = null;
  let lastQueue = null;
  let lastAt = 0;

  while (Date.now() < deadline) {
    if (job.cancelled) throw new Error("Sync cancelled.");

    const tasks = await listTasks(startSec);
    const task = tasks.find(t => Number(t?.task_id || 0) === taskId);

    if (task) {
      const status = Number(task?.export_status ?? -1);
      const queue = String(task?.queue_position || "");

      if (status === 2) return task;
      if (status === 3 || task?.failed_reason) {
        throw new Error(task?.failed_reason || "SPX export failed.");
      }

      const now = Date.now();
      if (status !== lastStatus || queue !== lastQueue || now - lastAt >= 10000) {
        const elapsed = Math.floor((now - job.startedAt) / 1000);
        const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const ss = String(elapsed % 60).padStart(2, "0");
        progress(
          `SPX export task ${taskId} is processing${queue ? ` · queue ${queue}` : ""} · elapsed ${mm}:${ss}…`,
          { phase: "processing", taskId, queuePosition: queue, kind: job.kind }
        );
        lastStatus = status;
        lastQueue = queue;
        lastAt = now;
      }
    } else {
      progress(`SPX export task ${taskId} created. Waiting for task status…`, {
        phase: "processing",
        taskId,
        kind: job.kind
      });
    }

    await sleep(Math.max(1000, Number(pollIntervalMs)||POLL_MS));
  }

  throw new Error("SPX export is still queued after 25 minutes.");
}

async function getSpxCookieValue(names) {
  for (const name of names) {
    try {
      const cookie = await chrome.cookies.get({
        url: SPX_ORIGIN,
        name
      });
      if (cookie?.value) return cookie.value;
    } catch {}
  }
  return "";
}

async function getLinehaulRequestHeaders() {
  const csrf = await getSpxCookieValue(["csrftoken", "csrf_token", "csrfToken", "X-CSRFToken"]);
  const deviceId = await getSpxCookieValue(["device-id", "device_id", "deviceId"]);

  return {
    "Accept": "application/json, text/plain, */*",
    "Referer": `${SPX_ORIGIN}/`,
    "app": LINEHAUL_CAPTURED_HEADERS.app,
    "PG-I": LINEHAUL_CAPTURED_HEADERS["PG-I"],
    "X-CSRFToken": csrf || LINEHAUL_CAPTURED_HEADERS["X-CSRFToken"],
    "x-sap-ri": LINEHAUL_CAPTURED_HEADERS["x-sap-ri"],
    "device-id": deviceId || LINEHAUL_CAPTURED_HEADERS["device-id"],
    "x-sap-sec": LINEHAUL_CAPTURED_HEADERS["x-sap-sec"]
  };
}

async function submitLinehaulExport(job) {
  const formatCondition = LINEHAUL_FORMAT_CONDITION;
  const url = `${SPX_ORIGIN}${LINEHAUL_EXPORT_PATH}?status=0&format_condition=${encodeURIComponent(formatCondition)}`;

  progress("Creating Pending Receive Linehaul export directly through the current SPX API…", {
    phase: "linehaul-api-export"
  });

  const response = await extensionFetchText(url, {
    method: "GET",
    headers: await getLinehaulRequestHeaders()
  });

  const json = parseJsonResponse("SPX Pending Receive Linehaul export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(
      json?.message ||
      `SPX Pending Receive Linehaul export failed (HTTP ${response.status}).`
    );
  }

  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) {
    throw new Error("SPX accepted the Linehaul export request but returned no task ID.");
  }

  progress(`SPX Linehaul export task ${taskId} created directly.`, {
    phase: "linehaul-task",
    taskId
  });

  return { taskId, formatCondition, apiResult: json };
}

async function runJob(job) {
  try {
    job.startedAt = Date.now();

    progress("Starting Linehaul sync using the direct SPX export API — no SPX tab will be opened…", {
      phase: "linehaul-api"
    });

    const submitted = await submitLinehaulExport(job);
    const taskId = submitted.taskId;
    const waitStartSec = Math.max(
      0,
      Math.floor((job.startedAt - 10 * 60 * 1000) / 1000)
    );

    const completed = await waitForCompletion(taskId, waitStartSec, job, LINEHAUL_POLL_MS);

    if (!isTargetTask(completed, job)) {
      throw new Error("The completed SPX task does not match the expected Linehaul export.");
    }

    progress(`SPX Linehaul task ${taskId} is complete. Getting a fresh signed download URL…`, {
      phase: "linehaul-download-url",
      taskId
    });

    const signedUrl = await getSignedDownloadUrl(taskId);

    progress("Downloading the completed Linehaul CSV directly…", {
      phase: "linehaul-download",
      taskId
    });

    const csv = await downloadCsv(signedUrl);
    const rowCount = csv.text.split(/\r?\n/).filter(Boolean).length;
    const dataRows = Math.max(0, rowCount - 1);

    progress(
      `Downloaded ${dataRows.toLocaleString()} Linehaul rows. Sending to NOL3 Planning…`,
      { phase: "linehaul-import", taskId }
    );

    sendToBadoc("BADOC_SPX_CSV", {
      taskId,
      fileName: csv.fileName || "inbound_to_from_spx.csv",
      csvText: csv.text
    });

    sendToBadoc("BADOC_SPX_DONE", {
      taskId,
      rowCount: dataRows,
      fileName: csv.fileName || "inbound_to_from_spx.csv"
    });
  } catch (error) {
    console.error("BADOC SPX direct Linehaul sync failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", {
      message: error?.message || String(error),
      kind: "linehaul"
    });
  } finally {
    // Direct API mode does not create or manage a temporary SPX tab/window.
    releaseActiveJob(job);
  }
}



async function openBatchSearchOrderTrackingTab(ownerPort, job) {
  sendToPort(ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
    phase: "batch-search-open-tab",
    message: "Opening a temporary SPX Order Tracking tab using your current signed-in session…"
  });

  const createOptions = {
    url: SPX_ORIGIN + "/#/orderTracking",
    active: true
  };
  const sourceWindowId = ownerPort?.sender?.tab?.windowId;
  if (Number.isInteger(sourceWindowId) && sourceWindowId >= 0) {
    createOptions.windowId = sourceWindowId;
  }

  const tab = await chrome.tabs.create(createOptions);
  if (!Number.isInteger(tab?.id)) {
    throw new Error("Chrome could not create the temporary SPX Order Tracking tab.");
  }
  job.spxTabId = tab.id;

  const deadline = Date.now() + 90000;
  let lastUrl = String(tab.url || "");
  let lastStatus = String(tab.status || "loading");

  while (Date.now() < deadline) {
    if (job.cancelled) throw new Error("Batch Search Result export cancelled.");

    let current;
    try {
      current = await chrome.tabs.get(tab.id);
    } catch (_) {
      throw new Error("The temporary SPX Order Tracking tab was closed before Batch Search could start.");
    }
    lastUrl = String(current.url || lastUrl);
    lastStatus = String(current.status || lastStatus);

    if (current.status === "complete" && /#\/orderTracking(?:[/?]|$)/i.test(lastUrl)) {
      try {
        const probeResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () => {
            const visible = element => {
              if (!element || !element.isConnected) return false;
              const rect = element.getBoundingClientRect();
              if (!rect.width || !rect.height) return false;
              const style = getComputedStyle(element);
              return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
            };
            const bodyText = String(document.body?.innerText || "").slice(0, 5000);
            return {
              route: String(location.hash || ""),
              readyState: document.readyState,
              pageHasContent: !!document.body && bodyText.trim().length > 20,
              loginRequired: !!document.querySelector("input[type='password']") ||
                /session (?:has )?expired|please (?:log in|sign in)|(?:log in|sign in) to continue|login required/i.test(bodyText)
            };
          }
        });
        const page = probeResults?.[0]?.result;
        if (page?.loginRequired) {
          throw new Error("The new SPX tab requires sign-in. Sign in to SPX, then retry Batch Search Result.");
        }
        if (page && /orderTracking/i.test(page.route) && page.readyState === "complete" && page.pageHasContent) {
          sendToPort(ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
            phase: "batch-search-tab-ready",
            message: "SPX Order Tracking has loaded in the new tab. Waiting for Batch Search controls…"
          });
          return current;
        }
      } catch (error) {
        if (/requires sign-in/i.test(String(error?.message || error))) throw error;
        // SPX may still be mounting its Vue page or navigating between route states.
      }
    } else if (
      current.status === "complete" &&
      /(?:#\/(?:login|signin|sign-in)|\/(?:login|signin)(?:[/?#]|$))/i.test(lastUrl)
    ) {
      throw new Error("The new SPX tab opened the login page. Sign in to SPX, then retry Batch Search Result.");
    }

    await sleep(600);
  }

  throw new Error(
    "Timed out waiting for the temporary SPX Order Tracking tab to load. " +
    "Confirm that SPX is signed in, then retry Batch Search Result. Last URL: " + lastUrl +
    " (status: " + lastStatus + ")."
  );
}

async function closeBatchSearchOrderTrackingTab(job) {
  const tabId = job?.spxTabId;
  if (!Number.isInteger(tabId)) return;
  job.spxTabId = null;
  try {
    await chrome.tabs.remove(tabId);
  } catch (_) {
    // The tab may already have been closed manually or by the browser.
  }
}

async function executeBatchSearchChunk(tabId, trackingNumbers, chunkIndex, totalChunks, job) {
  if (job.cancelled) throw new Error("Batch Search Result export cancelled.");
  sendToPort(job.ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
    phase: "batch-search-submit",
    chunkIndex,
    totalChunks,
    inputCount: trackingNumbers.length,
    message: "Opening SPX Batch Search and submitting chunk " + chunkIndex + "/" + totalChunks + " with " +
      trackingNumbers.length.toLocaleString() + " tracking number(s)…"
  });

  const injected = await withTimeout(chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [trackingNumbers, chunkIndex, totalChunks],
    func: async (numbers, chunkNumber, chunkTotal) => {
      const diagnostics = [];
      try {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      };
      const textOf = element => String(element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
      const isDisabled = element => {
        if (!element) return true;
        if (element.disabled === true || element.getAttribute("disabled") !== null ||
            String(element.getAttribute("aria-disabled") || "").toLowerCase() === "true") return true;
        let current = element;
        for (let depth = 0; current && depth < 5; depth++, current = current.parentElement) {
          const cls = typeof current.className === "string" ? current.className : "";
          if (/(^|\s)(?:is-)?disabled(?:\s|$)|is-disabled|--disabled/i.test(cls)) return true;
          if (current.getAttribute?.("aria-disabled") === "true") return true;
        }
        return false;
      };
      const waitFor = async (predicate, timeoutMs, message) => {
        const started = Date.now();
        let lastError = "";
        while (Date.now() - started < timeoutMs) {
          try {
            const value = predicate();
            if (value) return value;
          } catch (error) { lastError = error?.message || String(error); }
          await sleep(250);
        }
        throw new Error(message + (lastError ? " " + lastError : ""));
      };
      const findButtons = () => [...document.querySelectorAll("button,[role='button']")].filter(visible);
      const pageRoute = String(location.hash || "");
      if (!/orderTracking/i.test(pageRoute)) {
        throw new Error("The selected SPX tab is not on Order Management → Order Tracking.");
      }
      if (!Array.isArray(numbers) || !numbers.length || numbers.length > 3000) {
        throw new Error("Each SPX Batch Search must contain between 1 and 3,000 tracking numbers.");
      }
      const textareaSelector = "textarea[placeholder*='SPX Tracking Number'],textarea[placeholder*='Tracking Number'],textarea";
      let textarea = [...document.querySelectorAll(textareaSelector)].find(visible) || null;
      if (!textarea) {
        const batchButton = await waitFor(
          () => findButtons().find(button => /^batch\s*search$/i.test(textOf(button))),
          30000,
          "SPX Order Tracking loaded, but its Batch Search button did not become available."
        );
        batchButton.click();
        textarea = await waitFor(
          () => [...document.querySelectorAll(textareaSelector)].find(visible),
          20000,
          "SPX Batch Search dialog did not open or its tracking-number box was not found."
        );
      }

      const dialogSelector = "[role='dialog'],[aria-modal='true'],.el-dialog,.el-dialog__wrapper,.ant-modal,.ivu-modal,[class*='dialog'],[class*='Dialog'],[class*='modal'],[class*='Modal']";
      const modalCandidates = [...document.querySelectorAll(dialogSelector)]
        .filter(element => visible(element) && element.contains(textarea));
      const ancestorScopes = [];
      for (let node = textarea.parentElement, depth = 0; node && depth < 14; node = node.parentElement, depth++) {
        if (visible(node) && node.contains(textarea)) ancestorScopes.push(node);
      }
      let dialog = modalCandidates[0] || ancestorScopes.find(node =>
        /dialog|modal/i.test(String(node.className || "")) || /batch\\s*search/i.test(textOf(node))
      ) || textarea.parentElement?.parentElement?.parentElement || document.body;
      const inputText = numbers.join("\n");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(textarea, inputText);
      else textarea.value = inputText;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));
      if (String(textarea.value || "").trim().split(/\r?\n/).filter(Boolean).length !== numbers.length) {
        throw new Error("SPX Batch Search did not accept all tracking numbers in the input box.");
      }

      const submitControlSelector = "button,[role='button'],input[type='button'],input[type='submit'],.el-button,.ant-btn,.ivu-btn,[class*='submit'],[class*='Submit']";
      const normalizedControlText = element => String(
        textOf(element) || element?.getAttribute?.("aria-label") ||
        element?.getAttribute?.("title") || element?.value || ""
      ).replace(/\\s+/g, " ").trim().toLowerCase();
      const nearestClickable = element =>
        element?.closest?.("button,[role='button'],input[type='button'],input[type='submit'],.el-button,.ant-btn,.ivu-btn,[onclick]") || element;
      const findSubmitControl = scope => {
        if (!scope || typeof scope.querySelectorAll !== "function") return null;
        const controls = [...scope.querySelectorAll(submitControlSelector)].filter(visible);
        const exactControl = controls.find(element => normalizedControlText(element) === "submit");
        if (exactControl) return nearestClickable(exactControl);
        const textNodes = [...scope.querySelectorAll("span,div,a,li,label")]
          .filter(element => visible(element) && normalizedControlText(element) === "submit");
        for (const element of textNodes) {
          const control = nearestClickable(element);
          if (control && visible(control) && normalizedControlText(control) === "submit") return control;
        }
        return null;
      };
      let submitButton = null;
      const searchScopes = [];
      const addScope = scope => {
        if (scope && typeof scope.querySelectorAll === "function" && !searchScopes.includes(scope)) searchScopes.push(scope);
      };
      // Search the textarea's ancestors from nearest to widest so the footer
      // can be found even when SPX renders it outside the dialog body.
      ancestorScopes.forEach(addScope);
      modalCandidates.forEach(addScope);
      addScope(dialog);
      addScope(document);
      for (const scope of searchScopes) {
        submitButton = findSubmitControl(scope);
        if (submitButton) {
          let node = submitButton;
          for (let depth = 0; node && depth < 14; node = node.parentElement, depth++) {
            if (node.contains?.(textarea) && (
              node.matches?.(dialogSelector) ||
              /dialog|modal/i.test(String(node.className || "")) ||
              /batch\\s*search/i.test(textOf(node))
            )) {
              dialog = node;
              break;
            }
          }
          break;
        }
      }
      if (!submitButton) {
        const visibleButtons = [...document.querySelectorAll("button,[role='button'],.el-button,.ant-btn,.ivu-btn")]
          .filter(visible)
          .map(element => normalizedControlText(element))
          .filter(Boolean)
          .slice(0, 18);
        const modalName = textOf(dialog).slice(0, 140);
        throw new Error(
          "Could not locate a visible Submit control after pasting the tracking numbers. " +
          "SPX Batch Search dialog text: " + modalName +
          ". Visible button labels on page: " + (visibleButtons.join(" | ") || "none") +
          ". Dialog candidates containing the tracking box: " + modalCandidates.length + "."
        );
      }
      if (isDisabled(submitButton)) {
        await waitFor(() => !isDisabled(submitButton), 5000, "SPX kept Submit disabled after the tracking numbers were pasted.");
      }
      const batchSearchStatusId = "badocBatchSearchStatus";
      const showBatchSearchStatus = (message, state = "working") => {
        let status = document.getElementById(batchSearchStatusId);
        if (!status) {
          status = document.createElement("div");
          status.id = batchSearchStatusId;
          status.setAttribute("role", "status");
          status.setAttribute("aria-live", "polite");
          Object.assign(status.style, {
            position: "fixed", top: "16px", right: "18px", zIndex: "2147483647",
            maxWidth: "min(560px, calc(100vw - 36px))", padding: "13px 18px",
            borderRadius: "10px", border: "1px solid #2797d4",
            background: "#092b40", color: "#ffffff",
            boxShadow: "0 8px 28px rgba(0,0,0,.28)",
            font: "600 14px/1.45 Arial,sans-serif", letterSpacing: ".1px"
          });
          (document.body || document.documentElement).appendChild(status);
        }
        status.textContent = message;
        status.dataset.state = state;
        status.style.borderColor = state === "done" ? "#20b879" : state === "error" ? "#e05252" : "#2797d4";
        status.style.background = state === "done" ? "#073c2b" : state === "error" ? "#4a1717" : "#092b40";
      };
      const findSearchResultConfirmation = () => {
        const confirmationPattern = /^All\s+([\d,]+)\s+orders?\s+have\s+been\s+found\.?$/i;
        const selectors = [
          '.el-alert.el-alert--success',
          '.el-message--success',
          '.el-notification',
          '[role="alert"]',
          '[class*="alert"][class*="success"]',
          '[class*="Alert"][class*="success"]'
        ].join(',');
        const candidates = [...document.querySelectorAll(selectors)].filter(visible);
        for (const element of candidates) {
          const message = textOf(element).replace(/\s+/g, ' ').trim();
          const match = message.match(confirmationPattern);
          if (match) {
            return {
              count: Number(String(match[1]).replace(/,/g, '')),
              message
            };
          }
        }
        // Fallback for SPX builds that render the green success bar without
        // an alert role/class. The phrase must still match the exact
        // confirmation shown below the Batch Search controls.
        const bodyText = String(document.body?.innerText || '');
        const match = bodyText.match(/(?:^|\n)\s*(All\s+[\d,]+\s+orders?\s+have\s+been\s+found\.?)\s*(?:\n|$)/i);
        if (!match) return null;
        const parsed = match[1].match(confirmationPattern);
        if (!parsed) return null;
        return { count: Number(String(parsed[1]).replace(/,/g, '')), message: match[1].trim() };
      };
      showBatchSearchStatus("SPX is searching " + numbers.length.toLocaleString() + " tracking numbers…", "working");
      submitButton.click();

      await waitFor(
        () => !visible(textarea) || !visible(dialog),
        30000,
        "SPX Batch Search dialog did not close after Submit."
      );
      showBatchSearchStatus(
        "Batch Search submitted. Waiting for SPX's green confirmation: All orders have been found…",
        "working"
      );
      const searchConfirmation = await waitFor(
        () => findSearchResultConfirmation(),
        180000,
        "SPX did not show the green 'All … orders have been found.' confirmation. Export was not started."
      );
      const searchResultCount = searchConfirmation.count;
      const completedMessage = "SPX confirmed: " + searchConfirmation.message +
        " Batch Search is complete. Preparing Batch-Search Results export…";
      showBatchSearchStatus(completedMessage, "done");
      await sleep(900);

      let capturedBlob = null;
      let capturedBlobUrl = "";
      let capturedFileName = "";
      let capturedDownloadUrl = "";
      let capturedTaskId = 0;
      let captureActive = false;
      const objectUrls = new Map();
      const pendingCaptureTasks = [];
      const networkDiagnostics = [];
      const originalCreateObjectURL = URL.createObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      const originalOpen = window.open;
      const originalFetch = window.fetch;
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;

      const pathOnly = value => {
        try { const url = new URL(String(value || ""), location.href); return url.origin + url.pathname; }
        catch (_) { return String(value || "").slice(0, 240); }
      };
      const contentFileName = disposition => {
        const match = String(disposition || "").match(/filename\*?=(?:UTF-8''|")?([^;"\r\n]+)/i);
        return match ? String(match[1]).trim().replace(/^"|"$/g, "") : "";
      };
      const findExportValues = (root, depth = 0, seen = new Set()) => {
        const found = { downloadUrl: "", taskId: 0, fileName: "" };
        if (!root || typeof root !== "object" || depth > 12 || seen.has(root)) return found;
        seen.add(root);
        const downloadKeys = new Set(["downloadurl","fileurl","signedurl","downloadlink","filelink","downloadpath","filepath"]);
        const taskKeys = new Set(["taskid","exporttaskid","exportid"]);
        for (const [key, value] of Object.entries(root)) {
          const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
          if (typeof value === "string" && downloadKeys.has(normalized) && value.trim()) found.downloadUrl ||= value.trim();
          if (typeof value === "string" && /^(?:file_)?name$/i.test(normalized) && /\.(?:csv|xlsx?)$/i.test(value.trim())) found.fileName ||= value.trim();
          if (taskKeys.has(normalized) && Number(value) > 0) found.taskId ||= Number(value);
        }
        for (const value of Object.values(root)) {
          if (value && typeof value === "object") {
            const nested = findExportValues(value, depth + 1, seen);
            found.downloadUrl ||= nested.downloadUrl;
            found.taskId ||= nested.taskId;
            found.fileName ||= nested.fileName;
          }
        }
        return found;
      };
      const rememberNetwork = record => {
        if (networkDiagnostics.length < 25) networkDiagnostics.push(record);
      };
      const rememberJsonOrFile = async (url, response, source) => {
        const contentType = String(response.headers?.get?.("content-type") || "");
        const disposition = String(response.headers?.get?.("content-disposition") || "");
        const lowerUrl = String(url || "").toLowerCase();
        const likelyEndpoint = /batch|search|export|download|task|spreadsheet|csv/i.test(lowerUrl);
        const likelyFile = /attachment|filename=/i.test(disposition) ||
          /text\/csv|application\/(octet-stream|vnd\.|excel|zip)|spreadsheet/i.test(contentType);
        if (!likelyEndpoint && !likelyFile) return;
        const record = {
          source,
          url: pathOnly(url),
          status: Number(response.status || 0),
          contentType: contentType.slice(0, 120),
          contentDisposition: disposition.slice(0, 180)
        };
        try {
          const clone = response.clone();
          if (likelyFile) {
            const blob = await clone.blob();
            record.byteLength = blob.size;
            if (blob.size) {
              capturedBlob = blob;
              capturedFileName = contentFileName(disposition) || capturedFileName;
            }
          } else {
            const bodyText = (await clone.text()).slice(0, 200000);
            let json = null;
            try { json = JSON.parse(bodyText); } catch (_) {}
            if (json) {
              const fields = findExportValues(json);
              if (fields.downloadUrl) {
                try { capturedDownloadUrl = new URL(fields.downloadUrl, location.href).href; }
                catch (_) { capturedDownloadUrl = fields.downloadUrl; }
              }
              if (fields.taskId) capturedTaskId = fields.taskId;
              if (fields.fileName) capturedFileName = fields.fileName;
              record.retcode = json.retcode ?? json.code ?? "";
              record.message = String(json.message || json.msg || "").slice(0, 220);
              record.taskId = fields.taskId || 0;
              record.hasDownloadUrl = !!fields.downloadUrl;
              record.preview = bodyText.slice(0, 650);
            } else {
              record.preview = bodyText.slice(0, 450);
              if (/^(?:\uFEFF)?[^<{[][\s\S]*[,;\t]/.test(bodyText.trim())) {
                const blob = new Blob([bodyText], { type: contentType || "text/csv" });
                if (blob.size) capturedBlob = blob;
              }
            }
          }
        } catch (error) {
          record.captureError = String(error?.message || error).slice(0, 200);
        }
        rememberNetwork(record);
      };
      const enqueueCapture = promise => {
        pendingCaptureTasks.push(Promise.resolve(promise).catch(error => {
          rememberNetwork({ source: "capture", error: String(error?.message || error).slice(0, 180) });
        }));
      };

      try {
        URL.createObjectURL = function(object) {
          const url = originalCreateObjectURL.call(URL, object);
          if (captureActive && object instanceof Blob && object.size) {
            objectUrls.set(url, object);
            capturedBlob = object;
            capturedBlobUrl = url;
            if (object.name) capturedFileName = String(object.name);
          }
          return url;
        };
        HTMLAnchorElement.prototype.click = function() {
          const href = String(this.href || this.getAttribute("href") || "");
          if (captureActive) {
            if (this.download) capturedFileName = String(this.download || capturedFileName || "");
            const blob = objectUrls.get(href);
            if (blob) { capturedBlob = blob; capturedBlobUrl = href; }
            else if (href && !/^javascript:|^about:/i.test(href)) capturedDownloadUrl = href;
          }
          return originalAnchorClick.apply(this, arguments);
        };
        window.open = function(url) {
          const href = String(url || "");
          if (captureActive && href) {
            if (objectUrls.has(href)) {
              capturedBlob = objectUrls.get(href);
              capturedBlobUrl = href;
            } else if (!/^javascript:|^about:/i.test(href)) capturedDownloadUrl = href;
          }
          return originalOpen.apply(this, arguments);
        };
        window.fetch = async function() {
          const args = arguments;
          const response = await originalFetch.apply(this, args);
          if (captureActive) {
            const requestUrl = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
            enqueueCapture(rememberJsonOrFile(requestUrl, response, "fetch"));
          }
          return response;
        };
        XMLHttpRequest.prototype.open = function(method, url) {
          this.__badocBatchSearchRequest = { method: String(method || "GET"), url: String(url || "") };
          return originalXhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
          if (captureActive) {
            this.addEventListener("load", () => {
              try {
                const request = this.__badocBatchSearchRequest || {};
                const headers = this.getAllResponseHeaders ? this.getAllResponseHeaders() : "";
                const recordResponse = {
                  status: this.status,
                  headers: { get: name => {
                    const line = String(headers).split(/\r?\n/).find(value => value.toLowerCase().startsWith(String(name).toLowerCase() + ":"));
                    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
                  }},
                  clone: () => ({
                    blob: async () => {
                      if (this.responseType === "blob") return this.response;
                      if (this.responseType === "arraybuffer") return new Blob([this.response]);
                      return new Blob([this.responseText || ""]);
                    },
                    text: async () => {
                      if (this.responseType === "json") return JSON.stringify(this.response || {});
                      if (this.responseType === "blob" && this.response) return await this.response.text();
                      if (this.responseType === "arraybuffer" && this.response) return new TextDecoder().decode(this.response);
                      return String(this.responseText || "");
                    }
                  })
                };
                enqueueCapture(rememberJsonOrFile(request.url, recordResponse, "xhr:" + request.method));
              } catch (error) {
                rememberNetwork({ source: "xhr", error: String(error?.message || error).slice(0, 180) });
              }
            }, { once: true });
          }
          return originalXhrSend.apply(this, arguments);
        };

        const exportLabel = "export batch-search results";
        const menuSelectors = "button,[role='menuitem'],a,li,.el-dropdown-menu__item,.ant-dropdown-menu-item,.ivu-dropdown-item";
        const findExportItem = () => {
          const known = [...document.querySelectorAll(menuSelectors)].filter(visible)
            .find(element => textOf(element).toLowerCase() === exportLabel);
          if (known) return known;
          const fallback = [...document.querySelectorAll("body *")].filter(element =>
            visible(element) && textOf(element).toLowerCase() === exportLabel &&
            ![...element.children].some(child => textOf(child).toLowerCase() === exportLabel)
          );
          return fallback[0] || null;
        };
        const exportButton = await waitFor(
          () => findButtons().find(button => /^export$/i.test(textOf(button))),
          15000,
          "SPX Order Tracking Export dropdown was not found."
        );
        let exportItem = null;
        const menuDeadline = Date.now() + 120000;
        // SPX opens this dropdown on hover. Dispatch the same pointer/mouse
        // enter events on its dropdown wrapper and trigger; do not click the
        // generic Export button because that can start a different export.
        const hoverTargets = [...new Set([
          exportButton.closest?.('.el-dropdown'),
          exportButton.closest?.('.ant-dropdown-trigger'),
          exportButton.closest?.('.ivu-dropdown'),
          exportButton.parentElement,
          exportButton
        ].filter(Boolean))];
        const simulateExportHover = () => {
          for (const target of hoverTargets) {
            if (!target.isConnected) continue;
            const rect = target.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            try {
              if (typeof PointerEvent === 'function') {
                target.dispatchEvent(new PointerEvent('pointerover', {
                  bubbles: true, cancelable: true, pointerType: 'mouse',
                  clientX: x, clientY: y, view: window
                }));
                target.dispatchEvent(new PointerEvent('pointerenter', {
                  bubbles: false, cancelable: false, pointerType: 'mouse',
                  clientX: x, clientY: y, view: window
                }));
              }
              target.dispatchEvent(new MouseEvent('mouseover', {
                bubbles: true, cancelable: true, view: window, clientX: x, clientY: y
              }));
              target.dispatchEvent(new MouseEvent('mouseenter', {
                bubbles: false, cancelable: false, view: window, clientX: x, clientY: y
              }));
            } catch (_) {}
          }
        };
        while (Date.now() < menuDeadline) {
          exportItem = findExportItem();
          if (exportItem && !isDisabled(exportItem)) break;
          simulateExportHover();
          await sleep(300);
        }
        if (!exportItem || isDisabled(exportItem)) {
          showBatchSearchStatus("SPX has not finished searching the tracking numbers yet. Waiting for the Batch-Search Results option…", "working");
          throw new Error("SPX did not enable Export → Export Batch-Search Results after the search. Check that SPX finished searching the pasted numbers.");
        }

        // Search is confirmed by SPX's green success alert above; proceed to export.

        captureActive = true;
        exportItem.click();
        let ready = false;
        try {
          await waitFor(
            () => capturedBlob || capturedDownloadUrl || capturedTaskId,
            120000,
            "SPX accepted Export Batch-Search Results, but no file, download URL, or export-task ID was observed."
          );
          ready = true;
        } catch (_) {}
        await Promise.allSettled(pendingCaptureTasks);
        if (!ready) {
          return {
            ok: false,
            error: "SPX export was selected, but no downloadable file, signed URL, or export-task ID was captured.",
            diagnostics: networkDiagnostics,
            pageTitle: String(document.title || "").slice(0, 120),
            route: String(location.hash || "").slice(0, 120)
          };
        }
        if (!capturedBlob) {
          return {
            ok: true,
            base64: "",
            downloadUrl: capturedDownloadUrl,
            taskId: capturedTaskId,
            fileName: capturedFileName || ("batch_search_result_" + chunkNumber + ".xlsx"),
            diagnostics: networkDiagnostics,
            searchCompleted: true,
            inputCount: numbers.length,
            searchResultCount,
            chunkNumber,
            chunkTotal
          };
        }
        const blob = capturedBlob;
        if (!blob || !blob.size) throw new Error("SPX returned an empty Batch-Search Results file.");
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
        }
        return {
          ok: true,
          base64: btoa(binary),
          mimeType: String(blob.type || ""),
          fileName: capturedFileName || ("batch_search_result_" + chunkNumber + ".xlsx"),
          byteLength: bytes.length,
          blobUrlCaptured: !!capturedBlobUrl,
          diagnostics: networkDiagnostics,
          searchCompleted: true,
          inputCount: numbers.length,
          searchResultCount,
          chunkNumber,
          chunkTotal
        };
      } finally {
        captureActive = false;
        try { URL.createObjectURL = originalCreateObjectURL; } catch (_) {}
        try { HTMLAnchorElement.prototype.click = originalAnchorClick; } catch (_) {}
        try { window.open = originalOpen; } catch (_) {}
        try { window.fetch = originalFetch; } catch (_) {}
        try { XMLHttpRequest.prototype.open = originalXhrOpen; } catch (_) {}
        try { XMLHttpRequest.prototype.send = originalXhrSend; } catch (_) {}
      }
      } catch (error) {
        return {
          ok: false,
          error: String(error?.message || error),
          diagnostics
        };
      }
    }
  }), 210000, "SPX Batch Search and export");

  const result = injected?.[0]?.result;
  if (!result) {
    throw new Error("SPX Order Tracking did not return a result from the page script. It may have reloaded or navigated during export. Keep the signed-in Order Tracking tab open and retry.");
  }
  if (!result.ok) {
    const diagnosticText = Array.isArray(result.diagnostics) && result.diagnostics.length
      ? " Network responses: " + result.diagnostics.slice(0, 6).map(item =>
          (item.source || "request") + " " + (item.status || "") + " " +
          (item.url || "") + " " + (item.contentType || "") +
          (item.message || item.captureError || item.error || "")
        ).join(" | ")
      : "";
    throw new Error((result.error || "SPX Batch-Search Results export failed.") + diagnosticText);
  }

  if (result.searchCompleted) {
    const searched = Number(result.inputCount) || trackingNumbers.length;
    const found = result.searchResultCount == null || !Number.isFinite(Number(result.searchResultCount)) ? null : Number(result.searchResultCount);
    sendToPort(job.ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
      phase: "batch-search-search-complete",
      chunkIndex,
      totalChunks,
      inputCount: searched,
      resultCount: found,
      message: "SPX finished searching " + searched.toLocaleString() + " tracking number(s)" +
        (found === null ? "." : " and found " + found.toLocaleString() + " result row(s).") +
        " Preparing the Batch-Search Results export…"
    });
  }

  let buffer = null;
  let resultFileName = result.fileName || ("batch_search_result_" + chunkIndex + ".xlsx");
  let resultDisposition = "";
  if (result.base64) {
    const binary = atob(result.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    buffer = bytes.buffer;
  } else if (result.downloadUrl) {
    let downloadUrl;
    try { downloadUrl = new URL(result.downloadUrl, SPX_ORIGIN); }
    catch (_) { throw new Error("SPX returned an invalid Batch Search download URL."); }
    const allowedHost = downloadUrl.hostname === "spx.shopee.ph" ||
      downloadUrl.hostname === "susercontent.com" ||
      downloadUrl.hostname.endsWith(".susercontent.com") ||
      downloadUrl.hostname.endsWith(".file.susercontent.com");
    if (downloadUrl.protocol !== "https:" || !allowedHost || downloadUrl.username || downloadUrl.password) {
      throw new Error("SPX returned a Batch Search download URL outside the allowed SPX file hosts.");
    }
    const fileResponse = await extensionFetchBuffer(downloadUrl.toString(), {
      headers: {
        "Accept": "text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*",
        "Referer": SPX_ORIGIN + "/"
      }
    });
    if (!fileResponse.ok) throw new Error("SPX Batch Search file download failed (HTTP " + fileResponse.status + ").");
    buffer = fileResponse.buffer;
    resultDisposition = fileResponse.contentDisposition || "";
  } else if (Number(result.taskId) > 0) {
    const taskId = Number(result.taskId);
    sendToPort(job.ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
      phase: "batch-search-task",
      chunkIndex,
      totalChunks,
      taskId,
      message: "SPX returned Batch Search export task " + taskId + ". Waiting for its downloadable file…"
    });
    const waitStartSec = Math.max(0, Math.floor((job.startedAt - 10 * 60 * 1000) / 1000));
    const completedInfo = await waitForAssignedTodayExportTask(taskId, waitStartSec, job, "Batch Search Results");
    let mediaId = completedInfo.mediaId || getExportMediaId(completedInfo.task);
    if (!mediaId) {
      const sources = [...new Set([completedInfo.source || "fms", "fms", "fm", ""])];
      const deadline = Date.now() + ASSIGNMENT_TASK_MEDIA_ID_WAIT_MS;
      let lastNotice = 0;
      while (Date.now() < deadline && !mediaId) {
        if (job.cancelled) throw new Error("Batch Search Results media lookup cancelled.");
        for (const source of sources) {
          try {
            const rows = await listTasks(0, source, 1, true, 0);
            const full = (rows || []).find(item => getExportTaskId(item) === taskId);
            if (full) {
              mediaId = getExportMediaId(full);
              if (mediaId) break;
            }
          } catch (_) {}
        }
        if (!mediaId && Date.now() - lastNotice >= 8000) {
          sendToPort(job.ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
            phase: "batch-search-media",
            chunkIndex,
            totalChunks,
            taskId,
            message: "SPX marked Batch Search export " + taskId + " complete. Waiting for its media ID…"
          });
          lastNotice = Date.now();
        }
        if (!mediaId) await sleep(ASSIGNMENT_TASK_MEDIA_ID_POLL_MS);
      }
    }
    const signedUrl = await getSignedDownloadUrl(taskId, completedInfo.source, mediaId);
    const fileResponse = await extensionFetchBuffer(signedUrl, {
      headers: {
        "Accept": "text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*",
        "Referer": SPX_ORIGIN + "/"
      }
    });
    if (!fileResponse.ok) throw new Error("SPX Batch Search export task file download failed (HTTP " + fileResponse.status + ").");
    buffer = fileResponse.buffer;
    resultDisposition = fileResponse.contentDisposition || "";
  } else {
    const detail = Array.isArray(result.diagnostics) && result.diagnostics.length
      ? " Captured: " + result.diagnostics.slice(0, 6).map(item => [item.source,item.status,item.url,item.contentType,item.message,item.preview].filter(Boolean).join(" ")).join(" | ")
      : "";
    throw new Error("SPX export response had no file payload, download URL, or task ID." + detail);
  }

  if (!buffer || !buffer.byteLength) throw new Error("SPX returned an empty Batch-Search Results file.");
  const converted = await firstMileBufferToCsv(buffer, resultFileName, resultDisposition);
  const rows = parseAssignedExportCsvRows(converted.text);
  if (!rows.length || !rows[0]?.length) {
    throw new Error("SPX Batch-Search Results file did not contain CSV headers.");
  }
  return { text: converted.text, fileName: converted.fileName, rows };
}

async function runBatchSearchExportJob(job) {
  const port = job.ownerPort;
  try {
    job.startedAt = Date.now();
    const numbers = [...new Set((Array.isArray(job.trackingNumbers) ? job.trackingNumbers : [])
      .map(value => String(value || "").trim()).filter(Boolean))];
    if (!numbers.length) throw new Error("Assignment Task export did not contain SPX Tracking Numbers.");
    if (numbers.length > 30000) {
      throw new Error("Batch Search contains " + numbers.length.toLocaleString() + " tracking numbers. The current safe limit is 30,000 per run.");
    }
    const tab = await openBatchSearchOrderTrackingTab(port, job);
    const chunks = [];
    for (let offset = 0; offset < numbers.length; offset += 3000) {
      chunks.push(numbers.slice(offset, offset + 3000));
    }
    const totalChunks = chunks.length;
    let headers = null;
    const outputRows = [];
    let outputFileName = "batch_search_result.csv";

    for (let index = 0; index < chunks.length; index++) {
      if (job.cancelled) throw new Error("Batch Search Result export cancelled.");
      sendToPort(port, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
        phase: "batch-search-running",
        chunkIndex: index + 1,
        totalChunks,
        inputCount: numbers.length,
        message: "Running SPX Batch Search " + (index + 1) + "/" + totalChunks + " (" +
          chunks[index].length.toLocaleString() + " tracking numbers)…"
      });
      const result = await executeBatchSearchChunk(tab.id, chunks[index], index + 1, totalChunks, job);
      const rows = result.rows;
      const currentHeaders = rows[0].map(value => String(value ?? "").trim());
      if (!headers) {
        headers = currentHeaders;
        outputFileName = result.fileName || outputFileName;
      } else if (headers.length !== currentHeaders.length ||
          headers.some((value, col) => value !== currentHeaders[col])) {
        throw new Error("SPX Batch-Search Results columns changed between chunks. The combined output was not created.");
      }
      outputRows.push(...rows.slice(1));
      sendToPort(port, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
        phase: "batch-search-chunk-complete",
        chunkIndex: index + 1,
        totalChunks,
        resultCount: outputRows.length,
        inputCount: numbers.length,
        message: "Completed SPX Batch Search " + (index + 1) + "/" + totalChunks + ". Collected " +
          outputRows.length.toLocaleString() + " result row(s)…"
      });
    }

    sendToPort(port, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
      phase: "batch-search-all-searches-complete",
      inputCount: numbers.length,
      chunkCount: chunks.length,
      resultCount: outputRows.length,
      message: "SPX finished searching all " + numbers.length.toLocaleString() +
        " tracking numbers. Collected " + outputRows.length.toLocaleString() + " result row(s). Saving the Batch Search Result file…"
    });
    const csvText = firstMileRowsToCsv([headers || [], ...outputRows]);
    sendToPort(port, "BADOC_SPX_BATCH_SEARCH_CSV", {
      selectedDate: job.selectedDate,
      sourceTaskId: job.sourceTaskId || "",
      inputCount: numbers.length,
      chunkCount: chunks.length,
      rowCount: outputRows.length,
      fileName: firstMileCsvFileName(outputFileName, "batch_search_result.csv"),
      csvText
    });
  } catch (error) {
    console.error("BADOC SPX Batch Search Result export failed:", error);
    sendToPort(port, "BADOC_SPX_BATCH_SEARCH_ERROR", {
      selectedDate: job.selectedDate,
      message: error?.message || String(error)
    });
  } finally {
    await closeBatchSearchOrderTrackingTab(job);
    releaseActiveJob(job);
  }
}

function isBadocPageUrl(url) {
  const u = String(url || "");
  if (u.startsWith("file://") || /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(u)) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "github.io" || parsed.hostname.endsWith(".github.io"));
  } catch (_) { return false; }
}

async function runBadocPickupInfoLookup(port, message) {
  const reqId=String(message?.reqId||"");
  const orderId=String(message?.orderId||"").trim();
  const reply=(ok,item,error)=>sendToPort(port,"BADOC_PICKUP_INFO_RESULT",{reqId,ok,item:item||null,error:error||""});
  if(!reqId||!/^[A-Za-z0-9_-]{6,48}$/.test(orderId)){reply(false,null,"A valid Order ID is required.");return;}
  try{
    let tabs=await chrome.tabs.query({url:`${SPX_ORIGIN}/*`});
    tabs=tabs.filter(tab=>!tab.discarded).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0));
    if(!tabs.length)throw new Error("Open an SPX page and sign in, then retry Pickup Info.");
    const results=await Promise.race([
      chrome.scripting.executeScript({
        target:{tabId:tabs[0].id},world:"MAIN",args:[orderId],
        func:async id=>{
          const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
          try{
            const response=await fetch("/api/fleet_order/order/detail/pickup_info?shipment_id="+encodeURIComponent(id),{
              credentials:"include",cache:"no-store",signal:controller.signal,
              headers:{"Accept":"application/json","Cache-Control":"no-cache"}
            });
            if(!response.ok)throw new Error("SPX returned HTTP "+response.status+".");
            const json=await response.json();
            if(json?.retcode!==undefined&&Number(json.retcode)!==0)throw new Error(String(json.message||json.msg||"SPX rejected this Pickup Info request."));
            const list=Array.isArray(json?.data?.pickup_info_list)?json.data.pickup_info_list:[];
            const first=list[0]||{},attempts=[];
            list.forEach(entry=>(Array.isArray(entry?.pickup_order_tracking)?entry.pickup_order_tracking:[]).forEach(attempt=>{
              attempts.push({res:attempt?.pickup_result||"",t:attempt?.ctime||0,task:attempt?.pickup_task_id||"",
                drv:attempt?.pickup_driver_name||"",drvId:attempt?.pickup_driver||"",
                gf:attempt?.with_geofence==null?"":String(attempt.with_geofence),
                rm:String(attempt?.remark||"").slice(0,90),
                pl:(Array.isArray(attempt?.photo_list)?attempt.photo_list:[]).slice(0,6),sig:attempt?.seller_signature?1:0});
            }));
            attempts.sort((a,b)=>(Number(b.t)||0)-(Number(a.t)||0));
            return {id,pk:{st:first?.pickup_status||"",eta:first?.eta||0,s0:first?.pickup_start_time||0,
              s1:first?.pickup_end_time||0,as:first?.assigned_time||0,picked:first?.pickedup_time||0,
              tag:first?.tag_list?.[0]?.tag_name||"",pp:first?.pickup_point_id||"",
              drv:Array.isArray(first?.driver_name)?(first.driver_name[0]||""):first?.driver_name||"",att:attempts}};
          }finally{clearTimeout(timer);}
        }
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("The signed-in SPX tab did not answer within 40 seconds. Reload that tab and retry.")),40000))
    ]);
    const item=results?.[0]?.result;
    if(!item)throw new Error("SPX returned no Pickup Info data for this Order ID.");
    reply(true,item,"");
  }catch(error){reply(false,null,error?.name==="AbortError"?"SPX Pickup Info request timed out.":(error?.message||String(error)));}
}

function isBadocPageSender(sender) {
  const url = String(sender?.url || "");
  if (isBadocPageUrl(url)) return true;
  // Chrome reports an iframe's inherited srcdoc URL as about:srcdoc in some versions.
  // Validate the inherited sender origin instead of rejecting the Received Checking frame.
  const origin = String(sender?.origin || "");
  if (url.startsWith("about:") && origin) {
    const originUrl = origin.endsWith("/") ? origin : origin + "/";
    return isBadocPageUrl(originUrl);
  }
  return false;
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "BADOC_PAGE") return;

  const senderUrl = String(port.sender?.url || "");
  if (!isBadocPageSender(port.sender)) {
    console.warn("Badoc Hub Extesion rejected BADOC page origin:", senderUrl);
    try { port.disconnect(); } catch {}
    return;
  }

  badocPorts.add(port);
  sendToPort(port, "BADOC_BRIDGE_READY", { version: VERSION });

  port.onMessage.addListener(message => {
    const type = message?.type;
    if(type==="BADOC_LOOKUP_PICKUP_INFO"){void runBadocPickupInfoLookup(port,message);return;}
    const failBusy = (kind, text = "A BADOC SPX sync is already running.") =>
      sendToPort(port, "BADOC_SPX_ERROR", { message: text, ...(kind ? { kind } : {}) });

    if (type === "BADOC_START_POD_CHECKER_ASSIGNED_TODAY") {
      const requestId = String(message?.requestId || "");
      const job = reserveActiveJob("pod-checker-assigned-today", port, {
        requestId,
        startedAt: Date.now()
      });
      if (!job) {
        sendToPort(port, "BADOC_POD_CHECKER_ASSIGNED_ERROR", {
          requestId,
          message: "Another SPX export is already running. Try Assigned Parcels Today again after it finishes."
        });
        return;
      }
      sendToPort(port, "BADOC_POD_CHECKER_ASSIGNED_ACCEPTED", {
        requestId,
        message: "Extension accepted Assigned Parcels Today. Preparing Forward and Return exports…"
      });
      void (async () => {
        try {
          const result = await exportAssignedParcelsTodayFromSpx(job);
          sendToPort(port, "BADOC_POD_CHECKER_ASSIGNED_COMPLETE", {
            requestId,
            result: {
              ok: true,
              todayDate: result.todayDate,
              forwardRowCount: result.forwardRowCount,
              returnRowCount: result.returnRowCount,
              forwardOidCount: result.forwardOidCount,
              returnOidCount: result.returnOidCount,
              duplicateCount: result.duplicateCount,
              oids: result.oids,
              downloadedData: (result.downloadedData || []).map(source => ({
                source: source.source,
                headers: source.headers,
                rowCount: source.rowCount,
                rawRowCount: source.rawRowCount,
                assignedTimeFilterSource: source.assignedTimeFilterSource
              }))
            }
          });
        } catch (error) {
          sendToPort(port, "BADOC_POD_CHECKER_ASSIGNED_ERROR", {
            requestId,
            message: error?.message || String(error)
          });
        } finally {
          releaseActiveJob(job);
        }
      })();
      return;
    }

    if (type === "BADOC_START_POD_CHECKER_ONHOLD") {
      const requestId = String(message?.requestId || "");
      const job = reserveActiveJob("pod-checker-onhold", port, {
        requestId,
        startedAt: Date.now(),
        trackingStatus: "5"
      });
      if (!job) {
        sendToPort(port, "BADOC_POD_CHECKER_ONHOLD_ERROR", {
          requestId,
          message: "Another SPX export is already running. Try OnHold again after it finishes."
        });
        return;
      }
      sendToPort(port, "BADOC_POD_CHECKER_ONHOLD_ACCEPTED", {
        requestId,
        message: "Extension accepted OnHold. Preparing an OnHold-only export…"
      });
      void (async () => {
        try {
          const result = await exportOnHoldOidsFromSpx(job);
          sendToPort(port, "BADOC_POD_CHECKER_ONHOLD_COMPLETE", { requestId, result });
        } catch (error) {
          sendToPort(port, "BADOC_POD_CHECKER_ONHOLD_ERROR", {
            requestId,
            message: error?.message || String(error)
          });
        } finally {
          releaseActiveJob(job);
        }
      })();
      return;
    }

    if (type === "BADOC_START_BATCH_SEARCH_EXPORT") {
      const trackingNumbers = Array.isArray(message?.trackingNumbers) ? message.trackingNumbers : [];
      sendToPort(port, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
        phase: "command-received",
        inputCount: trackingNumbers.length,
        message: "Extension background received the Batch Search Result command. Preparing SPX Order Tracking…"
      });
      const job = reserveActiveJob("batch-search-result", port, {
        selectedDate: String(message?.selectedDate || "").trim(),
        sourceTaskId: String(message?.sourceTaskId || "").trim(),
        trackingNumbers,
        startedAt: Date.now()
      });
      if (!job) {
        sendToPort(port, "BADOC_SPX_BATCH_SEARCH_ERROR", {
          message: "Another SPX export is still running. Wait for it to finish, then retry Batch Search Result."
        });
        return;
      }
      void runBatchSearchExportJob(job);
      return;
    }

    if (type === "BADOC_START_ASSIGNMENT_TASK_EXPORT") {
      const selectedDate = String(message?.selectedDate || "").trim();
      // Acknowledge immediately on receipt, before reserving the job or starting
      // any SPX work. This distinguishes bridge delivery from export startup.
      sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
        stage: "command-received",
        selectedDate,
        message: "Extension background received the Assignment Task command. Preparing the direct SPX export…"
      });
      try {
        const job = reserveActiveJob("assignment-task", port, {
          selectedDate: /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : phDateString(),
          startedAt: Date.now()
        });
        if (!job) {
          sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_ERROR", {
            message: "Another SPX export is already running. Retry Assignment Task after it finishes."
          });
          return;
        }
        sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
          stage: "job-accepted",
          selectedDate: job.selectedDate,
          message: "Extension accepted the Assignment Task export request…"
        });
        void runAssignmentTaskExportJob(job);
      } catch (error) {
        sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_ERROR", {
          message: "Extension could not start the Assignment Task export: " + (error?.message || String(error))
        });
      }
      return;
    }

    if (type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" || type === "BADOC_START_FIRST_MILE_TASKS_SYNC") {
      const kind = type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" ? "first-mile-orders" : "first-mile-tasks";
      sendToPort(port, "BADOC_SPX_COMMAND_ACCEPTED", { kind, message: `Extension background accepted ${kind === "first-mile-orders" ? "First Mile Orders" : "First Mile Tasks"} export. Preparing SPX request…` });
      const job = reserveActiveJob(kind, port, { selectedDate: String(message?.selectedDate || "").trim() });
      if (!job) { failBusy(kind); return; }
      void runFirstMileExportJob(job);
      return;
    }

    if (type === "BADOC_START_PARCEL_SECONDARY_SYNC") {
      const job = reserveActiveJob("parcel-secondary", port);
      if (!job) { failBusy("parcel-secondary"); return; }
      sendToPort(port, "BADOC_SPX_COMMAND_ACCEPTED", {
        kind: "parcel-secondary",
        message: "Extension background accepted Received / Transported export. Preparing SPX requests…"
      });
      void runParcelSecondaryJob(job);
      return;
    }

    if (type === "BADOC_START_RECEIVED_CHECKING_INBOUND_SYNC") {
      const job = reserveActiveJob("parcel-inbound", port, { receivedChecking: true });
      if (!job) { failBusy("parcel-inbound"); return; }
      void runParcelInboundJob(job);
      return;
    }

    if (type === "BADOC_START_RIDER_SYNC") {
      const job = reserveActiveJob("riders", port, {
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0
      });
      if (!job) { failBusy("riders"); return; }
      void runRiderJob(job);
      return;
    }

    if (type === "BADOC_START_LINEHAUL_SYNC") {
      const job = reserveActiveJob("linehaul", port, {
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0
      });
      if (!job) { failBusy("linehaul"); return; }
      void runJob(job);
      return;
    }

    if (type === "BADOC_START_PARCEL_DELIVERY_SYNC") {
      const job = reserveActiveJob("parcel-delivery", port, {
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0,
        trackingStatus: message?.trackingStatus,
        bulkyType: message?.bulkyType,
        assignedStartUnix: message?.assignedStartUnix,
        assignedEndUnix: message?.assignedEndUnix,
        assignedStart: message?.assignedStart,
        assignedEnd: message?.assignedEnd,
        assignedLabel: message?.assignedLabel,
        createdEndUnix: message?.createdEndUnix
      });
      if (!job) { failBusy("parcel-delivery"); return; }
      void runParcelDeliveryJob(job);
      return;
    }

    if (type === "BADOC_START_PARCEL_INBOUND_SYNC") {
      // Acknowledge receipt immediately, before reserving/starting the export job.
      // The dashboard can now distinguish a port-delivery failure from a job-start failure.
      sendToPort(port, "BADOC_SPX_COMMAND_ACCEPTED", { kind: "parcel-inbound", message: "Extension background received the Received sync request. Preparing SPX export…" });
      const job = reserveActiveJob("parcel-inbound", port, {
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0
      });
      if (!job) { failBusy("parcel-inbound"); return; }
      void runParcelInboundJob(job);
      return;
    }

    if (type === "BADOC_START_ASSIGNED_ONHOLD_TODAY") {
      const job = reserveActiveJob("assigned-onhold-today", port);
      if (!job) {
        sendToPort(port, "BADOC_ASSIGNED_ONHOLD_TODAY_ERROR", {
          kind: "assigned-onhold-today",
          message: "Assigned Today cannot start because an incompatible SPX job is already running. Try again after it finishes."
        });
        return;
      }
      sendToPort(port, "BADOC_SPX_COMMAND_ACCEPTED", {
        kind: "assigned-onhold-today",
        message: "Extension accepted Assigned Today. Preparing Forward and Return exports…"
      });
      void (async () => {
        job.startedAt = Date.now();
        try {
          const result = await exportAssignedParcelsTodayFromSpx(job, { includeCreatedDate: false });
          if (job.cancelled) throw new Error("Assigned Today sync was stopped.");
          const forward = result.downloadedData?.find(item => item.source === "Forward Order") || {};
          const returned = result.downloadedData?.find(item => item.source === "Return Order") || {};
          const excludedTotal = value => Object.values(value || {}).reduce((sum,n) => sum + Number(n || 0), 0);
          sendToPort(port, "BADOC_ASSIGNED_ONHOLD_TODAY_COMPLETE", {
            todayDate: result.todayDate,
            forwardRowCount: result.forwardRowCount,
            returnRowCount: result.returnRowCount,
            assignedTodayCount: Array.isArray(result.oids)?result.oids.length:0,
            duplicateCount: Number(result.duplicateCount||0),
            onholdRows: Array.isArray(result.onholdRows)?result.onholdRows:[],
            excludedForward: excludedTotal(forward.excluded),
            excludedReturn: excludedTotal(returned.excluded)
          });
        } catch (error) {
          sendToPort(port, "BADOC_ASSIGNED_ONHOLD_TODAY_ERROR", {
            kind: "assigned-onhold-today",
            message: error?.message || String(error)
          });
        } finally {
          releaseActiveJob(job);
        }
      })();
      return;
    }

    if (type === "BADOC_ABORT_SYNC") {
      for (const job of activeJobs.values()) if (job.ownerPort === port) job.cancelled = true;
    }
  });
  port.onDisconnect.addListener(() => {
    badocPorts.delete(port);
    for (const job of activeJobs.values()) if (job.ownerPort === port) job.cancelled = true;
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "BADOC_OPEN_EXTENSIONS") {
    chrome.tabs.create({ url: "chrome://extensions/" })
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, message: error?.message || String(error) }));
    return true;
  }

  if (message?.type !== "BADOC_PING") return;
  sendResponse({
    ok: true,
    version: VERSION,
    connected: badocPorts.size > 0,
    active: activeJobs.size > 0
  });
});


// ───────── Integrated POD/POOH Checker background actions ─────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== "POD_CHECKER_BACKGROUND") return false;

  if (message.action === "EXPORT_ONHOLD_OIDS_FROM_SPX") {
    (async () => {
      try { sendResponse(await exportOnHoldOidsFromSpx()); }
      catch (error) { sendResponse({ ok: false, error: error?.message || String(error) }); }
    })();
    return true;
  }

  if (message.action === "EXPORT_ASSIGNED_PARCELS_TODAY") {
    (async () => {
      try {
        sendResponse(await exportAssignedParcelsTodayFromSpx());
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }


  // Run Google Sheets requests from the MV3 service worker. This avoids the
  // extension-page CORS failure seen when calling docs.google.com directly.
  if (message.action === "FETCH_GOOGLE_TEXT") {
    (async () => {
      let requested;
      try {
        requested = new URL(String(message.url || ""));
        if (requested.protocol !== "https:" || requested.hostname !== "docs.google.com" || !requested.pathname.startsWith("/spreadsheets/")) {
          throw new Error("Blocked Google request: only Google Sheets spreadsheet URLs are allowed.");
        }
        const response = await fetch(requested.href, {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store"
        });
        const text = await response.text();
        if (!response.ok) {
          const diagnostic = text
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;|&#160;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 260);
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Google returned HTTP ${response.status}. Confirm this Chrome profile is signed in and has Viewer access to the selected Daily Ops Dashboard.${diagnostic ? ` Google detail: ${diagnostic}` : ""}`);
          }
          throw new Error(`Google returned HTTP ${response.status} while reading the selected dashboard.${diagnostic ? ` Google detail: ${diagnostic}` : ""}`);
        }
        sendResponse({ ok: true, status: response.status, finalUrl: response.url, text });
      } catch (error) {
        const messageText = error?.message || String(error);
        if (/Failed to fetch|NetworkError|fetch failed/i.test(messageText)) {
          sendResponse({ ok: false, error: "Google Sheets could not be reached from the extension. Check your internet connection, sign-in, and Google access, then reload the extension and try again." });
        } else {
          sendResponse({ ok: false, error: messageText });
        }
      }
    })();
    return true;
  }

  if (message.action !== "OPEN_SPX_PORTAL") return false;

  (async () => {
    const proofOfOnHoldUrl = "https://spx.shopee.ph/#/orderDetail/PROOF_OF_ONHOLD/proof_of_onhold?originUrl=%2ForderTracking&module=am_hubDeliveryManagement&stationType=AM_HUB";
    const isProofPage = url => /PROOF_OF_ONHOLD/i.test(String(url || "")) && /proof_of_onhold/i.test(String(url || ""));

    // Reuse a Proof of On Hold tab if it already exists. Otherwise reuse another
    // SPX tab and route it to the required page. Create a background tab only
    // when SPX is completely closed; never activate the tab or switch the user away.
    const spxTabs = await chrome.tabs.query({ url: `${SPX_ORIGIN}/*` });
    const preferredWindowId = sender?.tab?.windowId;
    const sortTabs = (a, b) => {
      const aSameWindow = a.windowId === preferredWindowId ? 1 : 0;
      const bSameWindow = b.windowId === preferredWindowId ? 1 : 0;
      if (aSameWindow !== bSameWindow) return bSameWindow - aSameWindow;
      return (b.lastAccessed || 0) - (a.lastAccessed || 0);
    };
    const existingProofTabs = spxTabs.filter(tab => isProofPage(tab.url)).sort(sortTabs);
    const otherSpxTabs = spxTabs.filter(tab => !isProofPage(tab.url)).sort(sortTabs);
    let tab = existingProofTabs[0] || otherSpxTabs[0] || null;
    let created = false;
    let navigated = false;

    if (!tab) {
      tab = await chrome.tabs.create({ url: proofOfOnHoldUrl, active: false });
      created = true;
    } else if (!isProofPage(tab.url)) {
      tab = await chrome.tabs.update(tab.id, { url: proofOfOnHoldUrl, active: false });
      navigated = true;
    }
    if (!tab?.id) throw new Error("Chrome could not prepare an SPX tab.");

    // Wait for navigation to finish without activating the background tab.
    const navDeadline = Date.now() + 60000;
    let tabState = await chrome.tabs.get(tab.id);
    while (tabState.status !== "complete" && Date.now() < navDeadline) {
      await new Promise(resolve => setTimeout(resolve, 300));
      tabState = await chrome.tabs.get(tab.id);
    }
    if (tabState.status !== "complete") throw new Error("SPX navigation timed out. The background tab is still loading.");

    // A tab may have been open before Badoc Hub Extesion was reloaded. Chrome
    // does not retroactively run manifest content_scripts in an existing tab.
    // Inject both POD bridge halves explicitly. Each has an installation guard,
    // so this is safe for newly opened tabs and repeat checks too.
    const injectPodCheckerBridge = async () => {
      // Install the MAIN-world receiver first, then its isolated-world Chrome
      // message relay. Both scripts are safe to reinject by design.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        files: ["pod-checker/page_bridge.js"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "ISOLATED",
        files: ["pod-checker/content.js"]
      });
    };

    try {
      await injectPodCheckerBridge();
    } catch (injectionError) {
      const detail = injectionError?.message || String(injectionError);
      throw new Error(`Badoc Hub Extesion could not attach its SPX checker scripts to this tab: ${detail}. Check that the extension has site access to https://spx.shopee.ph, then reload SPX and try again.`);
    }

    // Confirm the receiver before requesting SPA route readiness. If its first
    // handshake fails, reinject both bridge halves once to replace stale
    // listeners left behind by an extension reload, then retry the quick PING.
    let bridgePing = null;
    let bridgeError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) {
        try {
          await injectPodCheckerBridge();
        } catch (repairError) {
          const detail = repairError?.message || String(repairError);
          bridgeError = new Error(`SPX bridge recovery injection failed: ${detail}`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      try {
        bridgePing = await chrome.tabs.sendMessage(tab.id, { target: "pood-page-v19", command: "PING" });
        if (bridgePing?.ok && String(bridgePing.bridgeVersion || "") === "19") break;
        bridgeError = new Error(bridgePing?.error || (bridgePing?.ok
          ? "A stale SPX POD receiver answered instead of receiver v19."
          : "SPX page bridge did not answer its readiness ping."));
      } catch (error) {
        bridgeError = error;
      }
    }
    if (!bridgePing?.ok || String(bridgePing.bridgeVersion || "") !== "19") {
      throw new Error(`Could not connect to the SPX POD receiver v19 after automatic recovery. ${bridgeError?.message || "The SPX tab did not return a receiver response."} Check SPX site access and sign-in, then reload the SPX tab once.`);
    }

    // SPX is a SPA. Ask once for bounded route/content readiness.
    let readiness;
    try {
      readiness = await chrome.tabs.sendMessage(tab.id, { target: "pood-page-v19", command: "WAIT_FMS_READY" });
    } catch (error) {
      throw new Error(error?.message || "SPX Proof of On Hold page did not respond. Reload SPX and try again.");
    }
    if (!readiness?.ok) {
      throw new Error(readiness?.error || "SPX Proof of On Hold page is not ready. Check your SPX sign-in and try again.");
    }

    sendResponse({
      ok: true,
      created,
      reused: !created,
      navigated,
      loaded: true,
      pageReady: true,
      waitedMs: readiness.waitedMs,
      background: true,
      tabId: tab.id,
      windowId: tab.windowId,
      url: proofOfOnHoldUrl
    });
  })().catch(error => {
    console.error("POD Checker could not prepare the SPX Proof of On Hold page:", error);
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});

// Dashboard-hosted POD/POOH Checker RPC. The website UI never receives Chrome APIs
// directly; its content-script bridge requests these tightly-scoped operations.
async function podDiscoverWorksheetGidsOnPage() {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const labelOf = el => String(el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const getTabs = () => {
    const selectors = ['.docs-sheet-tab', '[role="tab"]', '[data-sheet-id]', '[data-sheetid]'];
    const raw = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
    const seen = new Set();
    const nodes = raw.filter(el => {
      const target = el.closest('.docs-sheet-tab,[role="tab"]') || el;
      if (seen.has(target)) return false;
      seen.add(target);
      const rect = target.getBoundingClientRect();
      if (rect.height < 8) return false;
      const cls = String(target.className || '');
      const isSheetClass = /docs-sheet-tab/i.test(cls);
      const isBottomRole = target.getAttribute('role') === 'tab' && rect.top > window.innerHeight * 0.55;
      const hasSheetId = target.hasAttribute('data-sheet-id') || target.hasAttribute('data-sheetid');
      if (!isSheetClass && !isBottomRole && !hasSheetId) return false;
      const label = labelOf(target);
      return !!label && label.length < 100;
    });
    if (nodes.length) return nodes;
    return Array.from(document.querySelectorAll('button,[role="button"],[aria-label]')).filter(el => {
      const rect = el.getBoundingClientRect();
      if (rect.height < 8 || rect.top < window.innerHeight * 0.68) return false;
      const label = labelOf(el);
      return !!label && label.length < 70 && !/add sheet|all sheets|explore|keyboard|status|comments|share/i.test(label);
    });
  };
  const gidFromUrl = () => {
    const url = new URL(location.href);
    return url.hash.match(/(?:^|[&#])gid=(\d+)/)?.[1] || url.search.match(/[?&]gid=(\d+)/)?.[1] || '';
  };
  const directGid = el => {
    const values = [el.getAttribute('data-sheet-id'), el.getAttribute('data-sheetid'), el.getAttribute('data-gid')];
    for (const value of values) if (value && /^\d+$/.test(value)) return value;
    const html = String(el.outerHTML || '');
    return html.match(/(?:sheetId|sheet_id|gridId|data-sheet-id|data-sheetid|data-gid)["'\s:=]+(\d+)/i)?.[1] || '';
  };
  const beforeGid = gidFromUrl();
  const initialTabs = getTabs();
  if (!initialTabs.length) return { gids: beforeGid ? [beforeGid] : [], labels: [], activeGid: beforeGid, method: 'url-only', error: 'Google Sheets worksheet tabs were not exposed in the page DOM.' };
  const labels = initialTabs.map(labelOf);
  const direct = initialTabs.map(directGid);
  const inventoryIndex = labels.findIndex(label => /\binventory\b/i.test(label));
  let activeIndex = initialTabs.findIndex(el => el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || /selected|active/i.test(String(el.className || '')));
  if (activeIndex < 0) activeIndex = initialTabs.findIndex(el => el.getAttribute('tabindex') === '0');
  if (activeIndex < 0 && beforeGid) activeIndex = initialTabs.findIndex(el => directGid(el) === beforeGid);
  const gids = new Set(direct.filter(Boolean));
  if (beforeGid) gids.add(beforeGid);
  let inventoryGid = inventoryIndex >= 0 ? (direct[inventoryIndex] || '') : '';
  const order = inventoryIndex >= 0 ? [inventoryIndex] : initialTabs.map((_, index) => index);
  for (const index of order) {
    const current = getTabs();
    const el = current[index];
    if (!el) continue;
    const knownGid = directGid(el);
    if (knownGid) gids.add(knownGid);
    if (index === activeIndex) {
      if (index === inventoryIndex) inventoryGid = beforeGid || knownGid || inventoryGid;
      continue;
    }
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el.click(); } catch (_) { continue; }
    let gid = '';
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(80);
      gid = gidFromUrl();
      if (gid && gid !== beforeGid) break;
    }
    if (!gid) gid = gidFromUrl();
    if (gid) gids.add(gid);
    const now = getTabs()[index];
    const attrGid = now ? directGid(now) : knownGid;
    if (attrGid) gids.add(attrGid);
    if (index === inventoryIndex) inventoryGid = gid || attrGid || inventoryGid;
  }
  const restoreTabs = getTabs();
  let restore = activeIndex >= 0 ? restoreTabs[activeIndex] : null;
  if (!restore && beforeGid) restore = restoreTabs.find(el => directGid(el) === beforeGid) || null;
  if (restore) { try { restore.click(); await sleep(220); } catch (_) {} }
  const restoredGid = gidFromUrl();
  return { gids: [...gids], labels, activeGid: beforeGid || restoredGid, inventoryGid, method: 'tab-strip-scan', restored: !beforeGid || restoredGid === beforeGid };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== "POD_CHECKER_RPC") return false;
  (async () => {
    const args = Array.isArray(message.args) ? message.args : [];
    if (message.method === "tabs.query") return await chrome.tabs.query(args[0] || {});
    if (message.method === "tabs.sendMessage") {
      const tabId = Number(args[0]);
      if (!Number.isInteger(tabId)) throw new Error("Invalid SPX tab ID.");
      return await chrome.tabs.sendMessage(tabId, args[1] || {});
    }
    if (message.method === "scripting.discoverWorksheetGids") {
      const tabId = Number(args[0]);
      if (!Number.isInteger(tabId)) throw new Error("Invalid Google Sheets tab ID.");
      const tab = await chrome.tabs.get(tabId);
      const url = new URL(String(tab.url || ""));
      if (url.protocol !== "https:" || !["docs.google.com", "sheets.google.com"].includes(url.hostname) || !/\/spreadsheets(?:\/|$)/i.test(url.pathname)) {
        throw new Error("Selected tab is not a Google Sheets spreadsheet.");
      }
      const injected = await chrome.scripting.executeScript({ target: { tabId }, world: "ISOLATED", func: podDiscoverWorksheetGidsOnPage });
      const result = injected?.[0]?.result;
      if (!result) throw new Error("The Google Sheets page did not return worksheet information.");
      return result;
    }
    throw new Error(`Unsupported POD Checker RPC method: ${String(message.method || "")}`);
  })().then(result => sendResponse({ ok: true, result })).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});


// ───────── Pickup Info detail lookup (read-only, on demand from the Pickup menu) ─────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "BADOC_PICKUP_LOOKUP") return false;
  const orderId = String(message.orderId || "").trim();
  if (!/^[A-Za-z0-9_-]{6,48}$/.test(orderId)) {
    sendResponse({ ok: false, error: "Invalid Order ID." });
    return false;
  }
  (async () => {
    const tabs = await chrome.tabs.query({ url: "https://spx.shopee.ph/*" });
    const preferredWindowId = sender?.tab?.windowId;
    const usable = tabs.filter(tab => !tab.discarded);
    usable.sort((a, b) => {
      const aw = a.windowId === preferredWindowId ? 1 : 0;
      const bw = b.windowId === preferredWindowId ? 1 : 0;
      if (aw !== bw) return bw - aw;
      return (b.lastAccessed || 0) - (a.lastAccessed || 0);
    });
    const tab = usable[0] || tabs[0];
    if (!tab?.id) throw new Error("Open an SPX page in this browser and sign in, then retry Pickup Info.");

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [orderId],
      func: async id => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const response = await fetch(
            "/api/fleet_order/order/detail/pickup_info?shipment_id=" + encodeURIComponent(id),
            { method:"GET", credentials:"include", cache:"no-store",
              headers:{ "Accept":"application/json, text/plain, */*" }, signal:controller.signal }
          );
          const text = await response.text();
          if (!response.ok) throw new Error("SPX returned HTTP " + response.status + ".");
          let payload;
          try { payload = JSON.parse(text); }
          catch (_) { throw new Error("SPX did not return Pickup Info JSON. Confirm that the SPX tab is signed in."); }
          if (!payload?.data) throw new Error("SPX did not return Pickup Info for this Order ID.");
          const list = Array.isArray(payload.data.pickup_info_list) ? payload.data.pickup_info_list : [];
          if (!list.length) throw new Error("No Pickup Info record was returned for this Order ID.");
          const first = list[0] || {};
          const attempts = [];
          list.forEach(row => {
            (Array.isArray(row.pickup_order_tracking) ? row.pickup_order_tracking : []).forEach(attempt => {
              attempts.push({
                res:attempt.pickup_result||"", t:attempt.ctime||0, task:attempt.pickup_task_id||"",
                drv:attempt.pickup_driver_name||"", drvId:attempt.pickup_driver||"",
                gf:attempt.with_geofence==null?"":String(attempt.with_geofence),
                rm:String(attempt.remark||"").slice(0,90),
                pl:(Array.isArray(attempt.photo_list)?attempt.photo_list:[]).slice(0,6),
                sig:attempt.seller_signature?1:0
              });
            });
          });
          attempts.sort((a,b)=>(Number(b.t)||0)-(Number(a.t)||0));
          return { id, pk:{
            st:first.pickup_status||"", eta:first.eta||0, s0:first.pickup_start_time||0,
            s1:first.pickup_end_time||0, as:first.assigned_time||0, picked:first.pickedup_time||0,
            tag:((first.tag_list||[])[0]||{}).tag_name||"", pp:first.pickup_point_id||"",
            drv:(first.driver_name||[])[0]||"", att:attempts
          }};
        } finally { clearTimeout(timer); }
      }
    });
    const item = injected?.[0]?.result;
    if (!item?.pk) throw new Error("The SPX tab did not return Pickup Info. Reload SPX and retry.");
    sendResponse({ ok:true, item });
  })().catch(error => sendResponse({ ok:false, error:String(error?.message||error).slice(0,220) }));
  return true;
});
