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
const ASSIGNMENT_TASK_MEDIA_ID_WAIT_MS = 30 * 1000;
const ASSIGNMENT_TASK_MEDIA_ID_POLL_MS = 4000;
const LINEHAUL_POLL_MS = 2000;
const MAX_WAIT_MS = 25 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;
const PARCEL_ORDER_TRACKING_ROUTE = "#/orderTracking";
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
  "assigned-onhold-today": new Set(["parcel-inbound", "first-mile-orders", "first-mile-tasks", "linehaul"])
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
    const station = String(row[stationIndex] ?? "").trim().toLowerCase().replace(/\\s+/g, " ");
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
      if(complete)return {task,source:located.source};
      if(failed)throw new Error(task?.failed_reason||(label+" SPX export task "+taskId+" failed ("+(statusText||status)+")."));
      const elapsed=Math.floor((Date.now()-job.startedAt)/1000);
      message=label+" export task "+taskId+" is processing"+(queue?" · queue "+queue:"")+" · "+(located.source||"default")+" queue · elapsed "+String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0")+"…";
      if(status!==lastStatus||queue!==lastQueue||Date.now()-lastMessageAt>=5000){lastStatus=status;lastQueue=queue;lastMessageAt=Date.now();}else message="";
    }else{
      const elapsed=Math.floor((Date.now()-job.startedAt)/1000);
      message="SPX accepted "+label+" task "+taskId+"; searching FMS, FM, and default queues (including unfiltered task rows) · elapsed "+String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0")+"…";
      if(Date.now()-lastMessageAt<5000)message="";else lastMessageAt=Date.now();
    }
    if(message){
      if(job.kind==="assignment-task"){
        sendToPort(job.ownerPort,"BADOC_SPX_ASSIGNMENT_TASK_PROGRESS",{taskId,selectedDate:job.selectedDate,message});
      }else if(job.kind==="batch-search-result"){
        sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
          kind:"batch-search-result",message,selectedDate:job.selectedDate||""
        });
      }else{
        progress(message,{phase:"pod-assigned-task",kind:job.kind,taskId,source:label});
        notifyPodCheckerAssignedProgress(message);
      }
    }
    await sleep(4000);
  }
  const diagnostic=lastStatus!==null?" Last task status: "+String(lastStatus)+(lastQueue?", queue "+lastQueue:"")+".":" The task ID was not found in returned task rows."+(lastTaskPreview?" Recent task rows: "+lastTaskPreview+".":"");
  const errors=lookupErrors.length?" Lookup errors: "+[...new Set(lookupErrors)].slice(0,3).join("; ")+".":"";
  throw new Error(label+" task "+taskId+" was accepted by SPX but did not become downloadable within 4 minutes."+diagnostic+errors+" Open the SPX export task monitor to confirm its state.");
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

async function createDedicatedSpxTab() {
  // Batch Search is part of Order Management → Order Tracking.
  // Open that route directly so the SPA does not remain on TO List when a
  // hash-only route change fails to trigger tabs.onUpdated(status=complete).
  const tab = await chrome.tabs.create({
    url: `${SPX_ORIGIN}${PARCEL_ORDER_TRACKING_ROUTE}`,
    // Bring SPX Order Tracking to the foreground. The SPX SPA does not always
    // render its controls reliably while the temporary tab is throttled in background.
    active: true
  });

  if (!tab?.id) {
    throw new Error("Could not create the temporary SPX tab.");
  }

  progress("Opened SPX Order Tracking in a new foreground tab. Waiting for the page to load…", { phase: "tab", tabId: tab.id });

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
      if (updatedTabId !== tab.id) return;
      const url = String(updatedTab?.url || "");
      if (changeInfo.status === "complete" && /https:\/\/spx\.shopee\.ph\/#\/orderTracking/i.test(url)) {
        finish();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    timer = setTimeout(() => fail(new Error("Timed out opening the temporary SPX TO List tab.")), 30000);

    chrome.tabs.get(tab.id).then(current => {
      const url = String(current?.url || "");
      if (current?.status === "complete" && /https:\/\/spx\.shopee\.ph\/#\/orderTracking/i.test(url)) finish();
    }).catch(fail);
  });

  await sleep(2200);
  await updateSpxBatchSearchNotice(tab.id,"SPX Order Tracking opened. Preparing the Batch Search controls…","working");
  return tab.id;
}

async function ensureParcelOrderTrackingRoute(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = String(tab?.url || "");
  if (/^https:\/\/spx\.shopee\.ph\/#\/orderTracking(?:[/?#]|$)/i.test(currentUrl)) {
    progress("SPX is on Order Management → Order Tracking.", { phase: "route" });
    return;
  }

  progress("Opening SPX Order Management → Order Tracking automatically…", { phase: "route" });

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
      if (changeInfo.status === "complete" && /https:\/\/spx\.shopee\.ph\/#\/orderTracking/i.test(url)) finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    timer = setTimeout(() => fail(new Error("Timed out opening SPX Order Tracking.")), 20000);
    chrome.tabs.update(tabId, { url: `${SPX_ORIGIN}/${PARCEL_ORDER_TRACKING_ROUTE}` }).catch(fail);
  });

  await sleep(2200);
}


const BATCH_SEARCH_FILE_CAPTURE_KEY = "__badocHubBatchSearchDownloadCapture";

async function installBatchSearchFileCapture(tabId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [BATCH_SEARCH_FILE_CAPTURE_KEY],
    func: key => {
      if (window[key]?.installed) {
        const current=window[key];
        current.installedAt=Date.now();
        current.blobs?.clear?.();
        current.links.length=0;
        current.files.length=0;
        current.errors.length=0;
        current.events ||= [];
        current.events.splice(0);
        return { installed: true, reused: true, reset: true };
      }
      const state = { installed: true, installedAt: Date.now(), blobs: new Map(), links: [], files: [], errors: [], events: [] };
      Object.defineProperty(window, key, { configurable: true, value: state });

      const fileLike = (url, type, disposition) => {
        const u = String(url || "");
        const t = String(type || "").toLowerCase();
        const d = String(disposition || "").toLowerCase();
        if (/(?:application|text)\/(?:json|html)/i.test(t)) return false;
        return /attachment|filename\s*=/.test(d) ||
          /(text\/csv|spreadsheetml|ms-excel|application\/csv)/.test(t) ||
          /\.(?:csv|xlsx?|xlsm)(?:[?#]|$)/i.test(u) ||
          (/application\/octet-stream/.test(t) && /(export|download|batch|search)/i.test(u));
      };
      const filenameFrom = (url, disposition, fallback) => {
        const match = String(disposition || "").match(/filename\*?=(?:UTF-8''|")?([^;"\r\n]+)/i);
        if (match?.[1]) {
          try { return decodeURIComponent(match[1].trim()); } catch { return match[1].trim(); }
        }
        if (fallback) return String(fallback);
        try { return decodeURIComponent(new URL(url, location.href).pathname.split("/").pop() || ""); } catch { return "spx_batch_search_result"; }
      };
      const bytesToBase64 = buffer => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return btoa(binary);
      };
      const storeBlob = async (blob, meta = {}) => {
        try {
          if (!(blob instanceof Blob)) return;
          if (blob.size > 40 * 1024 * 1024) {
            state.errors.push("SPX export file exceeded the 40 MB capture limit.");
            return;
          }
          const inspectText = await blob.slice(0, Math.min(blob.size, 100000)).text();
          const trimmed = inspectText.replace(/^\uFEFF/, "").trimStart();
          const structured = /^(?:\{|\[|<!doctype|<html)/i.test(trimmed) ||
            /(?:application|text)\/(?:json|html)/i.test(String(meta.contentType || blob.type || ""));
          if (structured) {
            state.events.push({
              url: String(meta.url || ""),
              method: String(meta.method || "GET"),
              status: Number(meta.status || 0),
              contentType: String(meta.contentType || blob.type || ""),
              disposition: String(meta.disposition || ""),
              payload: inspectText.slice(0, 100000),
              at: Date.now(),
              source: String(meta.source || "file-response-metadata")
            });
            state.errors.push("Ignored an SPX JSON/HTML response that was not a downloaded result file.");
            return;
          }
          const buffer = await blob.arrayBuffer();
          state.files.push({
            url: String(meta.url || ""),
            fileName: filenameFrom(meta.url, meta.disposition, meta.fileName || blob.name || ""),
            contentType: String(meta.contentType || blob.type || ""),
            size: blob.size,
            base64: bytesToBase64(buffer),
            capturedAt: Date.now(),
            source: String(meta.source || "download")
          });
        } catch (error) {
          state.errors.push("Could not read SPX download payload: " + String(error?.message || error));
        }
      };
      const recordLink = (url, fileName, source) => {
        const href = String(url || "").trim();
        if (!href || href === "#" || /^javascript:/i.test(href)) return;
        state.links.push({ url: href, fileName: String(fileName || ""), source: String(source || "anchor"), at: Date.now() });
      };

      try {
        const originalCreate = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function(object) {
          const url = originalCreate(object);
          if (object instanceof Blob) state.blobs.set(url, object);
          return url;
        };
      } catch (error) { state.errors.push("Could not monitor SPX file blobs: " + String(error?.message || error)); }

      try {
        const originalClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function(...args) {
          recordLink(this.href || this.getAttribute("href"), this.download, "anchor.click");
          return originalClick.apply(this, args);
        };
        document.addEventListener("click", event => {
          const anchor = (event.composedPath?.() || []).find(node => node instanceof HTMLAnchorElement);
          if (anchor) recordLink(anchor.href || anchor.getAttribute("href"), anchor.download, "click-event");
        }, true);
      } catch (error) { state.errors.push("Could not monitor SPX download links: " + String(error?.message || error)); }

      try {
        const originalOpen = window.open;
        window.open = function(url, ...args) {
          recordLink(url, "", "window.open");
          return originalOpen.call(this, url, ...args);
        };
      } catch {}

      try {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          return originalFetch.apply(this, args).then(response => {
            try {
              const url = String(response.url || args[0]?.url || args[0] || "");
              const type = response.headers.get("content-type") || "";
              const disposition = response.headers.get("content-disposition") || "";
              if (fileLike(url, type, disposition)) {
                const clone = response.clone();
                void clone.blob().then(blob => storeBlob(blob, {
                  url, contentType: type, disposition,
                  fileName: filenameFrom(url, disposition, ""),
                  method:String(args[1]?.method || "GET"), status:Number(response.status || 0),
                  source: "file-response"
                }));
              } else if (/json|text\/plain/i.test(type)) {
                const clone=response.clone();
                void clone.text().then(payload=>{
                  const hasTaskId=/"(?:task_id|taskId|export_task_id|exportTaskId)"\s*:\s*"?\d+/i.test(payload);
                  const isExportResponse=/(export|download|batch.?search|search.?result)/i.test(url);
                  if((hasTaskId||isExportResponse)&&payload&&payload.length<=100000){
                    state.events.push({
                      url,method:String(args[1]?.method||"GET"),
                      status:Number(response.status||0),contentType:type,
                      disposition,payload,at:Date.now(),source:"fetch-api-response"
                    });
                  }
                });
              }
            } catch (error) { state.errors.push("Could not inspect SPX file response: " + String(error?.message || error)); }
            return response;
          });
        };
      } catch (error) { state.errors.push("Could not monitor SPX file responses: " + String(error?.message || error)); }

      try {
        // SPX pages commonly use Axios, which is backed by XMLHttpRequest.
        // Capture file payloads from XHR as well as fetch/blob download links.
        const xhrOpen = XMLHttpRequest.prototype.open;
        const xhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__badocBatchUrl = String(url || "");
          this.__badocBatchMethod = String(method || "GET");
          return xhrOpen.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function(...args) {
          this.addEventListener("loadend", () => {
            try {
              const url = String(this.responseURL || this.__badocBatchUrl || "");
              const type = String(this.getResponseHeader("content-type") || "");
              const disposition = String(this.getResponseHeader("content-disposition") || "");
              const binaryResponse=this.responseType==="blob"||this.responseType==="arraybuffer";
              const textPayload=typeof this.responseText==="string"?this.responseText:"";
              let responsePayload=textPayload;
              if(!responsePayload&&this.response&&typeof this.response==="object"){
                try{responsePayload=JSON.stringify(this.response)||"";}catch{}
              }
              const taskResponseLike=/"(?:task_id|taskId|export_task_id|exportTaskId)"\s*:\s*"?\d+/i.test(responsePayload);
              const trimmedTextPayload=textPayload.replace(/^\uFEFF/,"").trimStart();
              const firstTextLine=trimmedTextPayload.split(/\r?\n/,1)[0]||"";
              const structuredPayload=/^(?:\{|\[|<!doctype|<html)/i.test(trimmedTextPayload)||
                /(?:application|text)\/(?:json|html)/i.test(type);
              const csvHeaderLike=!structuredPayload&&
                /tracking|awb|order(?:\s|_)?(?:id|sn|number)|parcel|shipment|status/i.test(firstTextLine.slice(0,2000))&&
                /[,\t;]/.test(firstTextLine);
              const exportRequest=/(export|download|batch.?search|search.?result)/i.test(url);
              if (!fileLike(url, type, disposition) && !(binaryResponse && exportRequest) && !csvHeaderLike) {
                if (exportRequest||taskResponseLike) {
                  const payload=responsePayload;
                  state.events.push({
                    url, method:this.__badocBatchMethod || "GET",
                    status:Number(this.status || 0), contentType:type,
                    disposition, responseType:this.responseType||"",
                    payload:payload.length<=100000?payload:payload.slice(0,100000),
                    at:Date.now(),source:"xhr-api-response"
                  });
                }
                return;
              }
              let blob = null;
              if (this.response instanceof Blob) blob = this.response;
              else if (this.response instanceof ArrayBuffer) blob = new Blob([this.response], {type});
              else if (ArrayBuffer.isView(this.response)) blob = new Blob([this.response], {type});
              else if (typeof this.responseText === "string") blob = new Blob([this.responseText], {type:type || "text/csv"});
              if (blob) void storeBlob(blob, {
                url, contentType:type, disposition,
                fileName:filenameFrom(url, disposition, ""),
                method:this.__badocBatchMethod || "GET", status:Number(this.status || 0),
                source:"xhr-file-response"
              });
            } catch(error) {
              try { state.errors.push("Could not inspect SPX XHR download: "+String(error?.message||error)); } catch {}
            }
          }, {once:true});
          return xhrSend.apply(this,args);
        };
      } catch (error) { state.errors.push("Could not monitor SPX XHR file responses: "+String(error?.message||error)); }

      return { installed: true, reused: false };
    }
  });
  if (!injected?.length || !injected[0]?.result?.installed) {
    throw new Error("Could not install the SPX downloaded-file capture in the temporary tab.");
  }
  return true;
}

async function readBatchSearchCapturedFile(tabId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [BATCH_SEARCH_FILE_CAPTURE_KEY],
    func: async key => {
      const state = window[key];
      if (!state?.installed) return { ready: false, reason: "Download capture is not installed." };
      const latest = state.files.slice().sort((a,b) => b.capturedAt - a.capturedAt)[0];
      if (latest?.base64) return {
        ready: true, file: latest, linkCount: state.links.length,
        events: state.events?.slice(-20) || []
      };

      const link = state.links.slice().sort((a,b) => b.at - a.at)[0];
      if (!link) return {
        ready: false, linkCount: 0, fileCount: state.files.length,
        errors: state.errors.slice(-4),
        events: state.events?.slice(-20) || []
      };

      try {
        let blob = state.blobs.get(link.url) || null;
        if (!blob) {
          const response = await fetch(link.url, { credentials: "include", cache: "no-store" });
          if (!response.ok) throw new Error("SPX downloaded file URL returned HTTP " + response.status + ".");
          blob = await response.blob();
        }
        if (blob.size > 40 * 1024 * 1024) throw new Error("SPX export file exceeded the 40 MB capture limit.");
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        const file = {
          url: link.url,
          fileName: link.fileName || (() => {
            try { return decodeURIComponent(new URL(link.url, location.href).pathname.split("/").pop() || "spx_batch_search_result"); }
            catch { return "spx_batch_search_result"; }
          })(),
          contentType: blob.type || "",
          size: blob.size,
          base64: btoa(binary),
          capturedAt: Date.now(),
          source: link.source || "download-link"
        };
        state.files.push(file);
        return { ready: true, file, linkCount: state.links.length };
      } catch (error) {
        return {
          ready: false, linkCount: state.links.length, fileCount: state.files.length,
          directUrl: link.url, directFileName: link.fileName,
          errors: [...state.errors.slice(-3), String(error?.message || error)],
          events: state.events?.slice(-20) || []
        };
      }
    }
  });
  return injected?.[0]?.result || { ready: false, reason: "The SPX tab returned no downloaded-file data." };
}

async function clickBatchSearchDownloadControl(tabId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [],
    func: async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const norm = value => String(value || "").normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
      const textOf = el => String(el?.innerText || el?.textContent || "")
        .replace(/\s+/g, " ").trim();
      const attrValues = el => [
        el?.getAttribute?.("aria-label"), el?.getAttribute?.("title"),
        el?.getAttribute?.("data-testid"), el?.getAttribute?.("data-test"),
        el?.getAttribute?.("data-tooltip"), el?.getAttribute?.("aria-description")
      ].filter(Boolean).map(String);
      const labelsOf = el => [textOf(el), ...attrValues(el)].filter(Boolean);
      const isExportLabel = el => labelsOf(el).some(value => {
        const key = norm(value);
        return /^(?:export|exportmenu|exportdropdown|exportoptions|exportbutton|exporttrigger|exportcaret)$/.test(key);
      });
      const disabled = el => !!el?.disabled ||
        el?.getAttribute?.("aria-disabled") === "true" ||
        el?.getAttribute?.("disabled") !== null ||
        /(^|\s)(disabled|is-disabled)(\s|$)/i.test(String(el?.className || ""));
      const visible = el => {
        if (!el || el.isConnected === false) return false;
        const rect = el.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return false;
        const doc = el.ownerDocument || document;
        const view = doc.defaultView || window;
        for (let node = el; node && node !== doc.documentElement; node = node.parentElement) {
          const style = view.getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden" ||
              Number(style.opacity) === 0 || node.hidden ||
              node.getAttribute?.("aria-hidden") === "true") return false;
        }
        return true;
      };
      const allElements = () => {
        const roots = [document];
        for (const frame of document.querySelectorAll("iframe")) {
          try { if (frame.contentDocument) roots.push(frame.contentDocument); } catch (_) {}
        }
        const out = [], seen = new Set();
        const walk = root => {
          if (!root?.querySelectorAll) return;
          for (const el of root.querySelectorAll("*")) {
            if (seen.has(el)) continue;
            seen.add(el);
            out.push(el);
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        roots.forEach(walk);
        return out;
      };
      const elements = allElements();
      const actionable = el => {
        if (!el) return false;
        const tag = String(el.tagName || "").toLowerCase();
        const role = String(el.getAttribute?.("role") || "");
        const cls = String(el.className || "");
        const style = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
        return tag === "button" || tag === "a" || role === "button" ||
          role === "menuitem" || el.hasAttribute?.("tabindex") ||
          el.hasAttribute?.("aria-haspopup") || el.hasAttribute?.("aria-controls") ||
          typeof el.onclick === "function" ||
          /button|dropdown|caret|trigger|action|menu-item/i.test(cls) ||
          style.cursor === "pointer";
      };
      const menuTextMatches = el => {
        const value = norm(textOf(el));
        return /^(?:export)?batchsearchresults?$/.test(value) ||
          /^batchsearchresult(?:s)?export$/.test(value);
      };
      const menuNodes = () => allElements().filter(el => menuTextMatches(el));
      const menuOptions = () => menuNodes().filter(el => visible(el) && !disabled(el))
        .sort((a,b) => {
          const depth = el => { let n=0; for(let x=el;x&&x!==document.body;x=x.parentElement)n++; return n; };
          return depth(b)-depth(a) || textOf(a).length-textOf(b).length;
        });
      const menuDiagnostics = () => {
        const out = [];
        for (const el of allElements()) {
          if (!visible(el)) continue;
          const role = String(el.getAttribute?.("role") || "");
          const cls = String(el.className || "");
          if (!/menu|dropdown|popover|popper|overlay/i.test(role + " " + cls)) continue;
          const value = textOf(el);
          if (value) out.push(value.slice(0, 200));
        }
        return [...new Set(out)].slice(0, 20);
      };
      const clickTarget = el => {
        let best = el;
        const initial = norm(textOf(el));
        for (let node=el; node && node !== (el.ownerDocument || document).body; node=node.parentElement) {
          const role = String(node.getAttribute?.("role") || "");
          if (role === "menuitem" || role === "option") { best=node; break; }
          const parentText = norm(textOf(node));
          if (parentText && initial && parentText !== initial) break;
          if (actionable(node)) { best=node; break; }
          best=node;
        }
        try { best.scrollIntoView({block:"center",inline:"nearest"}); } catch (_) {}
        best.click();
        return best;
      };
      const dispatchHover = target => {
        if (!target || !target.isConnected) return;
        const doc=target.ownerDocument||document, view=doc.defaultView||window;
        const rect=target.getBoundingClientRect();
        const init={
          bubbles:true,cancelable:true,composed:true,view,
          clientX:rect.left+Math.max(1,rect.width/2),
          clientY:rect.top+Math.max(1,rect.height/2),
          button:0,buttons:0
        };
        try {
          if (view.PointerEvent) {
            target.dispatchEvent(new view.PointerEvent("pointerover",{...init,pointerType:"mouse",isPrimary:true}));
            target.dispatchEvent(new view.PointerEvent("pointerenter",{...init,bubbles:false,pointerType:"mouse",isPrimary:true}));
          }
          target.dispatchEvent(new view.MouseEvent("mouseover",init));
          target.dispatchEvent(new view.MouseEvent("mouseenter",{...init,bubbles:false}));
        } catch (_) {}
      };
      const exportTextNodes = elements.filter(el =>
        visible(el) && !disabled(el) && isExportLabel(el)
      );
      const nearbyExportDiagnostics = elements.filter(el =>
        labelsOf(el).some(value => /export/i.test(value)) && visible(el)
      ).slice(0,35).map(el=>({
        tag:String(el.tagName||"").toLowerCase(),text:textOf(el).slice(0,90),
        aria:String(el.getAttribute?.("aria-label")||""),title:String(el.getAttribute?.("title")||""),
        testid:String(el.getAttribute?.("data-testid")||""),role:String(el.getAttribute?.("role")||""),
        className:String(el.className||"").slice(0,120)
      }));

      // Hidden menu nodes are only used as a locator. Do not click them while
      // their dropdown is closed; open the Export parent first, then click the
      // visible menu item so SPX receives the normal component interaction.

      const candidates=new Map();
      for (const textNode of exportTextNodes) {
        let wrapper=null;
        for (let node=textNode; node&&node!==document.body; node=node.parentElement) {
          const cls=String(node.className||"");
          if (/el-dropdown|ant-dropdown|dropdown|button.?group|el-button-group|ant-btn-group/i.test(cls) ||
              node.hasAttribute?.("aria-haspopup") || node.hasAttribute?.("aria-controls")) {
            wrapper=node; break;
          }
          if (textOf(node).length>100) break;
        }
        if (!wrapper) {
          for (let node=textNode; node&&node!==document.body; node=node.parentElement) {
            if (node.querySelectorAll?.("button,[role='button'],[aria-haspopup],[aria-controls]")?.length) {
              wrapper=node; break;
            }
          }
        }
        if (!wrapper) wrapper=textNode.parentElement||textNode;

        const handles=[wrapper,...(wrapper.querySelectorAll?[...wrapper.querySelectorAll(
          "button,a,[role='button'],[tabindex],[aria-haspopup],[aria-controls],[class*='caret'],[class*='dropdown'],[class*='trigger']"
        )]:[])];
        const hoverTargets=[];
        for(let node=wrapper,depth=0;node&&node!==document.body&&depth<5;node=node.parentElement,depth++) {
          hoverTargets.push(node);
          if(/el-dropdown|ant-dropdown|dropdown/i.test(String(node.className||"")))break;
        }
        if(!hoverTargets.includes(textNode))hoverTargets.push(textNode);

        for(const handle of handles) {
          if(!visible(handle)||disabled(handle)||!actionable(handle))continue;
          const cls=String(handle.className||"");
          const tag=String(handle.tagName||"").toLowerCase();
          const handleText=norm(textOf(handle));
          const handleAttrs=attrValues(handle).map(norm);
          const caret=/caret|dropdown|drop-down|more-options/i.test(cls) ||
            /menu|listbox/i.test(handle.getAttribute?.("aria-haspopup")||"") ||
            handle.hasAttribute?.("aria-controls") ||
            (handle.hasAttribute?.("aria-haspopup")&&handle.getAttribute?.("role")!=="menuitem");
          const directExport=handleText==="export"||handleAttrs.includes("export")||isExportLabel(handle);
          if(!caret&&!directExport&&handle!==wrapper)continue;
          let score=caret?300:100;
          if(handle.hasAttribute("aria-haspopup"))score+=65;
          if(handle.hasAttribute("aria-controls"))score+=55;
          if(tag==="button")score+=25;
          if(/caret|dropdown/i.test(cls))score+=50;
          if(/primary/i.test(cls))score-=35;
          const item={
            element:handle,hoverTargets,label:textOf(handle)||attrValues(handle)[0]||"Export dropdown",
            tag,score,className:cls.slice(0,120),
            ariaHaspopup:handle.getAttribute("aria-haspopup")||"",
            ariaControls:handle.getAttribute("aria-controls")||"",
            wrapper:String(wrapper.className||"").slice(0,120)
          };
          const prior=candidates.get(handle);
          if(!prior||item.score>prior.score)candidates.set(handle,item);
        }
      }

      // If SPX renders a split button, explicitly include the adjacent caret
      // control rather than only clicking the visible Export text segment.
      for(const textNode of exportTextNodes) {
        const parent=textNode.parentElement;
        if(!parent)continue;
        const siblings=[parent,...parent.querySelectorAll(
          "button,[role='button'],[tabindex],[aria-haspopup],[aria-controls],[class*='caret'],[class*='dropdown']"
        )];
        for(const handle of siblings) {
          if(!visible(handle)||disabled(handle)||!actionable(handle))continue;
          const cls=String(handle.className||"");
          if(!/caret|dropdown/i.test(cls)&&!handle.hasAttribute("aria-haspopup")&&!handle.hasAttribute("aria-controls"))continue;
          if(candidates.has(handle))continue;
          const hoverTargets=[parent,parent.parentElement].filter(Boolean);
          candidates.set(handle,{
            element:handle,hoverTargets,label:textOf(handle)||"Export dropdown",
            tag:String(handle.tagName||"").toLowerCase(),score:340,
            className:cls.slice(0,120),
            ariaHaspopup:handle.getAttribute("aria-haspopup")||"",
            ariaControls:handle.getAttribute("aria-controls")||"",
            wrapper:String(parent.className||"").slice(0,120)
          });
        }
      }

      if(!candidates.size) {
        for(const textNode of exportTextNodes) {
          let target=textNode;
          for(let node=textNode;node&&node!==document.body;node=node.parentElement) {
            if(actionable(node)){target=node;break;}
          }
          if(!visible(target)||disabled(target))continue;
          candidates.set(target,{
            element:target,hoverTargets:[target.parentElement,target].filter(Boolean),
            label:textOf(target)||"Export",tag:String(target.tagName||"").toLowerCase(),
            score:100,className:String(target.className||"").slice(0,120),
            ariaHaspopup:target.getAttribute("aria-haspopup")||"",
            ariaControls:target.getAttribute("aria-controls")||"",wrapper:"single Export control"
          });
        }
      }

      const triggerList=[...candidates.values()].sort((a,b)=>b.score-a.score);
      const waitForMenu=async timeout=>{
        const deadline=Date.now()+timeout;
        while(Date.now()<deadline) {
          const option=menuOptions()[0];
          if(option)return option;
          await sleep(100);
        }
        return menuOptions()[0]||null;
      };
      const attempts=[];
      let chosen=menuOptions()[0]||null;
      let usedTrigger="";
      if(!chosen) {
        for(const item of triggerList.slice(0,10)) {
          const handle=item.element;
          usedTrigger=item.label;
          attempts.push({
            label:item.label,tag:item.tag,score:item.score,className:item.className,
            wrapper:item.wrapper,ariaHaspopup:item.ariaHaspopup,ariaControls:item.ariaControls
          });
          try { handle.scrollIntoView({block:"center",inline:"nearest"}); } catch (_) {}
          try { handle.focus?.({preventScroll:true}); } catch (_) {}

          // SPX uses a hover-triggered dropdown in this layout. Dispatch the
          // enter events on the dropdown wrapper itself (not just the label),
          // so its framework listener opens the menu without user input.
          for(const target of [...(item.hoverTargets||[]),handle])dispatchHover(target);
          chosen=await waitForMenu(1800);
          if(chosen)break;

          try { handle.click(); } catch (_) {}
          chosen=await waitForMenu(item.ariaHaspopup||item.ariaControls?4500:2600);
          if(chosen)break;

          try {
            const view=handle.ownerDocument?.defaultView||window;
            for(const [key,code] of [["Enter","Enter"],[" ","Space"],["ArrowDown","ArrowDown"]]) {
              handle.dispatchEvent(new view.KeyboardEvent("keydown",{key,code,bubbles:true,cancelable:true}));
              handle.dispatchEvent(new view.KeyboardEvent("keyup",{key,code,bubbles:true,cancelable:true}));
              chosen=await waitForMenu(650);
              if(chosen)break;
            }
          } catch (_) {}
          if(chosen)break;
        }
      }
      if(!chosen) {
        const visibleText=String(document.body?.innerText||"").replace(/\s+/g," ").slice(-1800);
        return {
          clicked:false,menuOpened:false,menuItem:"",trigger:usedTrigger,
          reason:exportTextNodes.length
            ?"SPX Export dropdown did not open after automatic wrapper mouse-enter, click, and keyboard activation."
            :"SPX Export control could not be matched in the Order Tracking page.",
          menuText:visibleText,menuCandidates:menuDiagnostics(),
          triggerCandidates:attempts,nearbyExportElements:nearbyExportDiagnostics,
          exportLabelCount:exportTextNodes.length,url:String(location.href||""),
          title:String(document.title||"")
        };
      }
      const selectedText=textOf(chosen).slice(0,180);
      clickTarget(chosen);
      return {
        clicked:true,menuOpened:true,trigger:usedTrigger||"Export",
        menuItem:selectedText,method:"automatic-wrapper-hover-or-click",
        clickedAt:Date.now(),url:String(location.href||"")
      };
    }
  });
  return injected?.[0]?.result||{
    clicked:false,menuOpened:false,menuItem:"",
    reason:"SPX did not return an Export menu result."
  };
}
function parseBatchSearchDelimitedRows(source) {
  const input = String(source || "").replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] || "";
  const countDelimiter = delimiter => {
    let count = 0, quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"' && firstLine[i + 1] === '"') { i++; continue; }
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === delimiter) count++;
    }
    return count;
  };
  const delimiter = [",","\t",";"].sort((a,b) => countDelimiter(b) - countDelimiter(a))[0];
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
    else if (ch === delimiter) { row.push(field); field = ""; }
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

function batchHeaderIndex(headers, aliases) {
  const normalized = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  const wanted = new Set(aliases.map(normalized));
  return headers.findIndex(value => wanted.has(normalized(value)));
}

async function parseDownloadedBatchSearchFile(file, requestedTns) {
  const base64=String(file?.base64||"");
  if(!base64)throw new Error("SPX download capture returned no file bytes.");
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  if(!bytes.length)throw new Error("SPX Batch Search downloaded an empty file.");

  let rows=[];
  if(bytes.length>3&&bytes[0]===0x50&&bytes[1]===0x4b) {
    rows=await xlsxToRows(bytes.buffer);
  } else {
    const text=new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/,"");
    const trimmed=text.trim();
    if(!trimmed)throw new Error("SPX Batch Search downloaded an empty CSV file.");
    if(/^(?:\{|\[|<!doctype|<html)/i.test(trimmed)) {
      throw new Error("SPX Batch Search download was JSON/HTML, not a CSV or Excel result file.");
    }
    rows=parseBatchSearchDelimitedRows(text);
  }
  rows=rows.filter(row=>Array.isArray(row)&&row.some(value=>String(value??"").trim()));
  if(rows.length<2)throw new Error("SPX downloaded file contains no result rows.");

  const headerRowIndex=rows.findIndex(row=>row.some(cell=>{
    const header=String(cell||"").trim().replace(/[^a-z0-9]/gi,"").toLowerCase();
    return /trackingnumber|trackingno|trackingnum|spxtn|slstn|3pltracking|awb|ordernumber|orderid|^status$|orderstatus|parcelstatus/.test(header);
  }));
  if(headerRowIndex<0)throw new Error("SPX downloaded file has no recognizable tracking-number/status header. File: "+String(file.fileName||"unknown"));
  const headers=rows[headerRowIndex].map(value=>String(value??"").trim());
  const rawDataRows=rows.slice(headerRowIndex+1);
  const dataRows=rawDataRows.filter(row=>!isBatchSearchRepeatedHeaderRow(headers,row));
  const wanted=new Set((requestedTns||[]).map(normalizeBatchSearchTn).filter(Boolean));
  const findHeader=(aliases,pattern)=>{
    const exact=batchHeaderIndex(headers,aliases);
    if(exact>=0)return exact;
    if(pattern){
      const matches=headers.findIndex(value=>pattern.test(String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"")));
      return matches;
    }
    return -1;
  };
  const spxIndex=findHeader(
    ["SPX Tracking Number","SPX TN","Tracking Number","Tracking No","Tracking Number (SPX)"],
    /^(?:spx)?tracking(?:number|no|num)$/
  );
  const slsIndex=findHeader(
    ["SLS Tracking Number","SLS TN","Shopee Tracking Number"],
    /^(?:sls|shopee)tracking(?:number|no|num)$/
  );
  const thirdIndex=findHeader(
    ["3PL Tracking Number","3PL TN","Third TN","Third Tracking Number","Third Party Tracking Number","Third Party TN","Shipment ID"],
    /^(?:3pl|third(?:party)?)tracking(?:number|no|num|tn)$/
  );
  const matchedIndex=findHeader(
    ["Matched Tracking Number","Input Tracking Number","Input TN","Search Tracking Number"],
    /^(?:matched|input|search)tracking(?:number|no|num)$/
  );
  const statusIndex=findHeader(
    ["Status","Order Status","Parcel Status","Tracking Status","Parcel Order Status","Current Status"],
    /^(?:order|parcel|tracking|current)?status$/
  );
  const resultIndex=findHeader(headers,["Search Result","Result","Match Result","Search Status"],/^(?:search|match)?result$/);
  const results=new Map();
  const sourceRows=[];
  const candidateIndexes=[matchedIndex,spxIndex,slsIndex,thirdIndex].filter((value,index,array)=>value>=0&&array.indexOf(value)===index);
  const inputByKey=new Map((requestedTns||[]).map(value=>[normalizeBatchSearchTn(value),String(value??"").trim()]));
  for(const row of dataRows) {
    const values=headers.map((_,index)=>String(row[index]??"").trim());
    // Prefer the named tracking-number columns, but always scan the rest of
    // the downloaded row as well. SPX can place SPEPH/input aliases in a
    // column whose header is not one of the known labels; ignoring those cells
    // left valid Assignment Task TNs with blank result fields.
    const preferredValues=candidateIndexes.map(index=>values[index]||"");
    const candidateValues=[...preferredValues,...values.filter(value=>value&&!preferredValues.includes(value))];
    const keys=[...new Set(candidateValues.map(normalizeBatchSearchTn).filter(value=>value&&wanted.has(value)))];
    const resultText=(resultIndex>=0?String(values[resultIndex]||""):"")+" "+
      (statusIndex>=0?String(values[statusIndex]||""):"");
    const explicitlyNotFound=/not[\s_-]*found|no[\s_-]*(?:match|record|result)|unmatched|no data/i.test(resultText);
    const sourceFields={};
    headers.forEach((header,index)=>{sourceFields[header]=values[index]??"";});
    // Preserve the row and its tracking-number key even when the downloaded
    // SPX result explicitly marks it Not Found. The final output is based on
    // Assignment Task rows, not on the number of rows returned by SPX.
    const record={sourceFields,matchedKeys:keys,explicitlyNotFound};
    sourceRows.push(record);
    if(explicitlyNotFound)continue;
    for(const key of keys) {
      results.set(key,{
        tn:inputByKey.get(key)||key,
        matchedTN:key,
        spxTN:spxIndex>=0?values[spxIndex]:"",
        slsTN:slsIndex>=0?values[slsIndex]:"",
        thirdTN:thirdIndex>=0?values[thirdIndex]:"",
        status:statusIndex>=0?values[statusIndex]:"",
        sourceFields
      });
    }
  }
  return {
    results:[...results.values()],
    sourceHeaders:headers,
    sourceRows,
    fileName:String(file.fileName||"spx_batch_search_result.csv"),
    fileRowCount:dataRows.length,
    headerCount:headers.length,
    source:"SPX downloaded file"
  };
}
function batchSearchBase64FromText(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function resolveBatchSearchExportPayload(file, tabId, job) {
  const binary = atob(String(file?.base64 || ""));
  if (!binary) throw new Error("SPX Export returned an empty response.");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const isXlsx = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const text = isXlsx ? "" : new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  const trimmed = text.trim();
  let json = null;
  if (trimmed && /^[\[{]/.test(trimmed)) {
    try { json = JSON.parse(trimmed); } catch {}
  }
  const isHtml = /^<!doctype|^<html/i.test(trimmed) || /text\/html/i.test(String(file?.contentType || ""));
  if (isHtml) {
    throw new Error("SPX Export returned its HTML page instead of an export file or export-task response. The SPX tab was left open.");
  }

  let taskId = json ? getExportTaskId(json) : 0;
  const directUrl = String(
    json?.data?.download_url || json?.data?.url || json?.download_url || json?.url || ""
  ).trim();

  if (directUrl) {
    sendBatchSearchFileProgress("SPX returned a direct export URL. Downloading the actual CSV/Excel file…");
    const response = await extensionFetchBuffer(directUrl, {
      headers: {
        "Accept": "text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*",
        "Referer": SPX_ORIGIN + "/"
      }
    });
    if (!response.ok) throw new Error("SPX Batch Search direct file download failed (HTTP " + response.status + ").");
    const converted = await firstMileBufferToCsv(
      response.buffer,
      String(json?.data?.file_name || json?.file_name || "spx_batch_search_result.csv"),
      response.contentDisposition
    );
    return {
      base64: batchSearchBase64FromText(converted.text),
      fileName: converted.fileName,
      contentType: "text/csv",
      size: new TextEncoder().encode(converted.text).length,
      source: "SPX direct export URL"
    };
  }

  if (taskId) {
    sendBatchSearchFileProgress("SPX accepted the Export request as task " + taskId + ". Waiting for SPX to finish generating the file…");
    const startSec = Math.max(0, Math.floor(((job?.startedAt || Date.now()) - 10 * 60 * 1000) / 1000));
    let completed = await waitForAssignedTodayExportTask(taskId, startSec, job, "Batch Search");
    let task = completed.task || {};
    let source = completed.source || "fms";
    let mediaId = getExportMediaId(task) || getExportMediaId(json);

    if (!mediaId) {
      const recovered = await waitForAssignmentTaskMediaId(
        taskId, { task, source }, job, "Batch Search"
      );
      task = recovered.task || task;
      source = recovered.source || source;
      mediaId = recovered.mediaId || getExportMediaId(task) || getExportMediaId(json);
    }
    if (!mediaId) {
      throw new Error("SPX Batch Search export task " + taskId + " completed, but no media_id or downloadable file path was available.");
    }

    sendBatchSearchFileProgress("SPX Batch Search export task " + taskId + " completed. Requesting its signed download URL…");
    const signedUrl = await getSignedDownloadUrl(taskId, source, mediaId);
    const converted = await downloadFirstMileExportFile(
      signedUrl, String(task.file_name || "spx_batch_search_result.csv")
    );
    return {
      base64: batchSearchBase64FromText(converted.text),
      fileName: converted.fileName,
      contentType: "text/csv",
      size: new TextEncoder().encode(converted.text).length,
      source: "SPX export task " + taskId + " signed download"
    };
  }

  if (isXlsx || (trimmed && !/^(?:\{|\[|<!doctype|<html)/i.test(trimmed))) return file;
  const preview = trimmed.replace(/\s+/g, " ").slice(0, 260);
  throw new Error(
    "SPX Export returned JSON/HTML metadata but no export task ID or direct download URL was found. " +
    (preview ? "Response: " + preview : "The response was empty.") +
    " The SPX tab was left open for inspection."
  );
}


function findBatchSearchExportTaskResponse(events) {
  const list=Array.isArray(events)?events.slice().sort((a,b)=>Number(b?.at||0)-Number(a?.at||0)):[];
  for(const event of list){
    const payload=String(event?.payload||"").trim();
    if(!payload)continue;
    let json=null;
    try{json=JSON.parse(payload);}catch{continue;}
    // Search/list responses contain a data.list array with pagination metadata.
    // They are not export-task receipts, even when a route name contains "export".
    const isPagedOrderList=Array.isArray(json?.data?.list)&&
      (Object.prototype.hasOwnProperty.call(json.data,"page_no")||
       Object.prototype.hasOwnProperty.call(json.data,"total"));
    if(isPagedOrderList)continue;
    const explicitTaskId=/"(?:task_id|taskId|export_task_id|exportTaskId)"\s*:/i.test(payload);
    const exportEndpoint=/(?:export_task|exporttask|signed_download_url|get_signed_download_url)/i.test(String(event?.url||""));
    if(!explicitTaskId&&!exportEndpoint)continue;
    const taskId=getExportTaskId(json);
    if(taskId>0){
      return {
        taskId,
        json,
        payload,
        url:String(event?.url||""),
        status:Number(event?.status||0),
        source:String(event?.source||"api-response")
      };
    }
  }
  return null;
}

function isBatchSearchOrderListMetadata(file) {
  const base64=String(file?.base64 || "");
  if(!base64)return false;
  try {
    const binary=atob(base64);
    if(binary.length>=2&&binary.charCodeAt(0)===0x50&&binary.charCodeAt(1)===0x4b)return false;
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const text=new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/,"").trim();
    if(!text||!/^\{/.test(text))return false;
    const json=JSON.parse(text);
    const data=json?.data;
    return Number(json?.retcode)===0 &&
      Array.isArray(data?.list) &&
      (Object.prototype.hasOwnProperty.call(data,"page_no") ||
       Object.prototype.hasOwnProperty.call(data,"total")) &&
      !String(data?.download_url||data?.url||json?.download_url||json?.url||"").trim();
  }catch(_){return false;}
}

function discardBatchSearchOrderListCapture(capture) {
  if(!capture?.ready||!capture?.file?.base64||!isBatchSearchOrderListMetadata(capture.file))return capture;
  const taskResponse=capture.exportTaskResponse||findBatchSearchExportTaskResponse(capture.events);
  const error="Ignored SPX's paginated Order Tracking list JSON (page_no/count/total/list); it is not the Batch Search export file.";
  return {
    ...capture,ready:false,file:null,
    errors:[...(capture.errors||[]),error],
    ...(taskResponse?{exportTaskResponse:taskResponse}:{})
  };
}

function batchSearchTaskCreatedAt(task) {
  for (const key of ["ctime","create_time","createTime","created_at","createdAt","task_create_time","start_time","submit_time"]) {
    const raw=Number(task?.[key]||0);
    if(Number.isFinite(raw)&&raw>0)return raw>100000000000?Math.floor(raw/1000):Math.floor(raw);
  }
  return 0;
}

async function discoverNewBatchSearchExportTask(submittedAtSec, job) {
  const sources=["fms","fm",""];
  const deadline=Date.now()+4*60*1000;
  let lastProgressAt=0;
  let lastPreview="";
  const excluded=/feeder_assignment_task|assignment_task|spx_driver|inbound_to_from_spx|pickup_task_export/i;
  while(Date.now()<deadline) {
    if(job?.cancelled)throw new Error("Batch Search export task lookup cancelled.");
    const requests=sources.flatMap(source=>[
      {source,omitStartTime:false},
      // SPX sometimes delays applying start_time to the portal task list.
      // Also inspect the unfiltered first page, but still require a fresh ctime.
      {source,omitStartTime:true}
    ]);
    const settled=await Promise.allSettled(
      requests.map(item=>listTasks(Math.max(0,submittedAtSec-90),item.source,1,item.omitStartTime,0))
    );
    const candidates=[];
    const errors=[];
    const seen=new Set();
    for(let i=0;i<settled.length;i++) {
      const result=settled[i];
      const source=requests[i].source;
      if(result.status!=="fulfilled") {
        errors.push((source||"default")+(requests[i].omitStartTime?" unfiltered":" recent")+": "+(result.reason?.message||String(result.reason)));
        continue;
      }
      for(const task of result.value||[]) {
        const taskId=getExportTaskId(task);
        if(!taskId)continue;
        const createdAt=batchSearchTaskCreatedAt(task);
        // Require a creation timestamp close to the actual Export-menu click;
        // this prevents accidentally downloading an older task in Latest Task.
        if(!createdAt||createdAt<submittedAtSec-90||createdAt>Math.floor(Date.now()/1000)+60)continue;
        const taskName=String(task?.export_name||task?.task_name||task?.name||"");
        if(excluded.test(taskName))continue;
        const uniqueKey=source+":"+taskId;
        if(seen.has(uniqueKey))continue;
        seen.add(uniqueKey);
        candidates.push({task,source,taskId,createdAt});
      }
    }
    candidates.sort((a,b)=>b.createdAt-a.createdAt||b.taskId-a.taskId);
    if(candidates.length) {
      const found=candidates[0];
      sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
        kind:"batch-search-result",
        message:"Found the new SPX Batch Search export task "+found.taskId+" in the "+(found.source||"default")+" task list. Waiting for its download…",
        selectedDate:job.selectedDate||""
      });
      return {task:found.task,source:found.source,taskId:found.taskId,createdAt:found.createdAt};
    }
    lastPreview=settled.map((r,i)=>r.status==="fulfilled"
      ?(sources[i]||"default")+": "+(r.value||[]).slice(0,4).map(t=>"#"+getExportTaskId(t)+" "+String(t?.export_name||t?.biz_name||t?.status||"")).join(", ")
      :(sources[i]||"default")+": "+(r.reason?.message||"lookup failed")
    ).join(" | ");
    if(Date.now()-lastProgressAt>=8000) {
      sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
        kind:"batch-search-result",
        message:"Export was submitted. Checking the SPX Latest Task export queue for the new Batch Search file…",
        selectedDate:job.selectedDate||""
      });
      lastProgressAt=Date.now();
    }
    await sleep(2500);
  }
  throw new Error("SPX Export Batch-Search Results was selected, but no new export task appeared in the Latest Task queue. "+(lastPreview?"Task queue check: "+lastPreview:""));
}

async function downloadDiscoveredBatchSearchTask(found, submittedAtSec, job) {
  const taskId=Number(found?.taskId||getExportTaskId(found?.task)||0);
  if(!taskId)throw new Error("The new SPX Batch Search export task did not include a task ID.");
  const waitStartSec=Math.max(0,submittedAtSec-90);
  const completedInfo=await waitForAssignedTodayExportTask(taskId,waitStartSec,job,"Batch Search");
  let task=completedInfo.task||found.task||{};
  let source=completedInfo.source||found.source||"fms";
  let mediaId=getExportMediaId(task)||getExportMediaId(found.task);
  if(!mediaId) {
    const recovered=await waitForAssignmentTaskMediaId(taskId,{task,source},job,"Batch Search");
    task=recovered.task||task;
    source=recovered.source||source;
    mediaId=recovered.mediaId||getExportMediaId(task);
  }
  sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
    kind:"batch-search-result",
    message:"SPX Batch Search export task "+taskId+" succeeded. Downloading the generated result file…",
    selectedDate:job.selectedDate||""
  });
  const signedUrl=await getSignedDownloadUrl(taskId,source,mediaId);
  const converted=await downloadFirstMileExportFile(
    signedUrl,String(task.file_name||task.filename||"spx_batch_search_result.csv")
  );
  return {
    base64:batchSearchBase64FromText(converted.text),
    fileName:converted.fileName,
    contentType:"text/csv",
    size:new TextEncoder().encode(converted.text).length,
    source:"SPX Batch Search task "+taskId+" signed download"
  };
}

async function executeSpxBatchSearch(tabId, trackingNumbers, job = null) {
  await installBatchSearchFileCapture(tabId);
  let injectionResults;
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      args: [trackingNumbers],
      func: async tns => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const visible = el => {
          if(!el||!document.documentElement.contains(el))return false;
          const rect=el.getBoundingClientRect();
          if(!(rect.width>0&&rect.height>0))return false;
          for(let node=el;node&&node!==document.documentElement;node=node.parentElement){
            const style=getComputedStyle(node);
            if(style.display==="none"||style.visibility==="hidden"||Number(style.opacity)===0)return false;
          }
          return true;
        };
        const clean = value => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
        let stage = "initialize";
        const reportStage = message => {
          try {
            if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
              const pending = chrome.runtime.sendMessage({ type: "BADOC_BATCH_SEARCH_STAGE", message: String(message || "") });
              if (pending?.catch) pending.catch(() => {});
            }
          } catch {}
        };
        const label = el => [
          el?.innerText,el?.textContent,el?.getAttribute?.("aria-label"),
          el?.getAttribute?.("title"),el?.getAttribute?.("data-testid")
        ].filter(Boolean).join(" ").normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,"").replace(/[^a-z0-9]+/g,"");
        const clickables = () => [...document.querySelectorAll(
          "button,[role='button'],a,[tabindex],.el-button,.ant-btn,.ssc-button,[class*='button']"
        )].filter(visible);
        const downloadControls = () => clickables().filter(el => {
          const text=label(el);
          return /download|export|csv|excel|spreadsheet/.test(text) &&
            !/template|sample|instruction|import|upload/.test(text) &&
            !el.disabled && el.getAttribute("aria-disabled")!=="true";
        });
        const findAction = action => {
          const controls=clickables();
          return controls.find(el => label(el).includes(action) && !el.disabled && el.getAttribute("aria-disabled")!=="true") || null;
        };
        const findTextarea = () => [...document.querySelectorAll("textarea")].find(el =>
          /SPX Tracking Number/i.test(el.placeholder || "") && visible(el)
        );
        const busy = () => [...document.querySelectorAll(
          ".el-loading-mask,.el-loading-spinner,.ant-spin-spinning,.ssc-loading,[aria-busy=true],[data-loading=true]"
        )].some(visible);
        const tableRowCount = () => [...document.querySelectorAll("table tbody")].reduce((sum,tbody)=>sum+tbody.querySelectorAll("tr").length,0);
        const diagnostics = () => ({
          url:String(location.href||""),
          title:String(document.title||""),
          readyState:document.readyState,
          visibleTextareas:[...document.querySelectorAll("textarea")].filter(visible).map(el=>String(el.placeholder||"").slice(0,120)),
          visibleButtons:clickables().map(el=>String(el.innerText||el.textContent||el.getAttribute("aria-label")||el.title||"").trim()).filter(Boolean).slice(0,60),
          downloadControls:downloadControls().map(el=>({label:String(el.innerText||el.textContent||el.getAttribute("aria-label")||el.title||"").trim(),className:String(el.className||"").slice(0,100)})).slice(0,20),
          resultTableRows:tableRowCount()
        });

        try {
          stage="validate tracking numbers";
          const wanted=[...new Set((tns||[]).map(clean).filter(Boolean))];
          if(!wanted.length)throw new Error("No usable tracking numbers were supplied.");
          stage="find or open Batch Search dialog";
          reportStage("SPX Order Tracking loaded. Opening Batch Search…");
          let input=findTextarea();
          if(!input){
            const deadline=Date.now()+20000;
            let button=null;
            while(Date.now()<deadline&&!button){
              button=findAction("batchsearch");
              if(!button)await sleep(250);
            }
            if(!button)throw new Error("Could not find the Batch Search control on SPX Order Tracking.");
            try{button.scrollIntoView({block:"center",inline:"nearest"});}catch{}
            button.click();
            const inputDeadline=Date.now()+15000;
            while(Date.now()<inputDeadline&&!input){await sleep(250);input=findTextarea();}
          }
          if(!input)throw new Error("The Batch Search tracking-number input did not open.");
          stage="populate Batch Search textarea";
          const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value")?.set;
          if(setter)setter.call(input,wanted.join("\n"));else input.value=wanted.join("\n");
          input.dispatchEvent(new Event("input",{bubbles:true}));
          input.dispatchEvent(new Event("change",{bubbles:true}));
          await sleep(300);
          if(!String(input.value||"").trim())throw new Error("Tracking numbers did not remain in the Batch Search input.");

          stage="locate Submit button";
          let submit=null;
          for(let ancestor=input.parentElement;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
            submit=[...ancestor.querySelectorAll("button,[role='button'],.ssc-button,[class*='button']")]
              .find(el=>visible(el)&&label(el)==="submit"&&!el.disabled) || null;
            if(submit)break;
          }
          if(!submit)submit=findAction("submit");
          if(!submit)throw new Error("Could not locate the Submit button in Batch Search.");

          const initialRows=tableRowCount();
          const initialBusy=busy();
          const initialDownloadControls=downloadControls().length;
          stage="submit Batch Search and wait for SPX export";
          reportStage("Submitting "+wanted.length.toLocaleString()+" tracking number(s) to SPX…");
          submit.click();
          let sawBusy=initialBusy,lastRows=initialRows,rowsStableSince=Date.now();
          let successNoticeSince=0;
          let ready=false,lastNotice=0;
          const deadline=Date.now()+90000;
          while(Date.now()<deadline){
            await sleep(350);
            const isBusy=busy();
            const rows=tableRowCount();
            const controls=downloadControls();
            const currentBodyText=String(document.body?.innerText||"").replace(/\s+/g," ");
            const successMatch=currentBodyText.match(/all\s+[\d,]+\s+orders?\s+have been found/i);
            // SPX can keep the same green success-banner text from the initial
            // Order Tracking load. Treat it as confirmation only after Submit,
            // once the Batch Search textarea has closed and the banner is stable.
            const successNotice=successMatch?successMatch[0]:"";
            if(successNotice){if(!successNoticeSince)successNoticeSince=Date.now();}
            else successNoticeSince=0;
            const successNoticeStable=!!successNotice&&Date.now()-successNoticeSince>=1800;
            const batchSearchInputClosed=!visible(input);
            if(isBusy)sawBusy=true;
            if(rows!==lastRows){lastRows=rows;rowsStableSince=Date.now();}
            const elapsed=Date.now()-(deadline-90000);
            // A closed dialog is useful corroboration, but SPX can leave a
            // hidden textarea mounted with layout dimensions. The stable
            // success banner itself is authoritative after Submit and a short
            // settling window, even when the framework keeps that node around.
            const confirmedBatchSearch=successNoticeStable&&elapsed>=8000&&(!isBusy);
            if(elapsed-lastNotice>=5000){
              reportStage("Waiting for SPX to finish Batch Search and prepare its downloaded file… "+Math.floor(elapsed/1000)+"s elapsed.");
              lastNotice=elapsed;
            }
            const resultTableChanged=rows!==initialRows&&Date.now()-rowsStableSince>=1800&&!isBusy;
            const loadingCompleted=sawBusy&&!isBusy&&elapsed>=2500;
            const exportControlAppeared=controls.length>initialDownloadControls&&elapsed>=2500&&!isBusy;
            const explicitEmpty=/no (?:matching )?(?:data|records|results|orders)|no result found|0 (?:records|results)/i.test(String(document.body?.innerText||""));
            if(elapsed>=4000&&!isBusy&&(confirmedBatchSearch||resultTableChanged||loadingCompleted||exportControlAppeared||explicitEmpty)){
              if(confirmedBatchSearch)reportStage(successNotice+" · Batch Search completed; opening Export → Export Batch-Search Results…");
              ready=true;break;
            }
          }
          if(!ready)throw new Error("SPX did not finish Batch Search or expose an export state within 90 seconds. The downloaded file was not produced, so no Not Found results will be generated.");
          stage="wait for SPX downloaded result file";
          reportStage("SPX search finished. Waiting for the actual downloaded CSV/Excel result file…");
          return {submitted:true,requestedCount:wanted.length,diagnostics:diagnostics()};
        }catch(error){
          return {__spxBatchSearchError:true,stage,error:String(error?.message||error),stack:String(error?.stack||"").slice(0,1200),diagnostics:diagnostics()};
        }
      }
    });
  }catch(error){
    throw new Error("Chrome could not submit SPX Batch Search: "+String(error?.message||error));
  }

  const submitted=injectionResults?.[0]?.result;
  if(!submitted)throw new Error("SPX Batch Search returned no submission status.");
  if(submitted.__spxBatchSearchError){
    const detail=submitted.diagnostics||{};
    throw new Error("Stage: "+submitted.stage+". "+submitted.error+
      " Visible download controls: "+(detail.downloadControls||[]).map(item=>item.label).join(" | ")+
      ". Visible SPX buttons: "+(detail.visibleButtons||[]).join(" | "));
  }
  if(submitted.submitted!==true)throw new Error("SPX did not confirm that the Batch Search request was submitted.");

  const pollFile=async(durationMs)=>{
    const until=Date.now()+durationMs;
    let last={ready:false};
    while(Date.now()<until){
      try{
        last=await readBatchSearchCapturedFile(tabId);
        if(last?.ready&&last.file?.base64)return last;
        const exportTask=findBatchSearchExportTaskResponse(last?.events);
        if(exportTask)return {...last,exportTaskResponse:exportTask};
      }catch(error){last={ready:false,errors:[String(error?.message||error)]};}
      await sleep(650);
    }
    return last;
  };

  sendBatchSearchFileProgress("SPX Batch Search completed. Selecting Export → Export Batch-Search Results…");
  let capture=discardBatchSearchOrderListCapture(await pollFile(2500));
  let exportAction=null;
  let exportSubmittedAtSec=0;
  if(!capture?.ready){
    exportAction=await clickBatchSearchDownloadControl(tabId);
    if(!exportAction?.clicked||!exportAction?.menuItem){
      throw new Error(
        "SPX Batch Search finished, but Badoc Hub could not select Export Batch-Search Results. "+
        String(exportAction?.reason||exportAction?.menuText||"The SPX export option was not found.")+
        (exportAction?.menuText?" Menu: "+exportAction.menuText:"")+
        (Array.isArray(exportAction?.menuCandidates)&&exportAction.menuCandidates.length?" Dropdowns: "+exportAction.menuCandidates.join(" | "):"")+
        (Number(exportAction?.exportLabelCount)>=0?" Export labels matched: "+Number(exportAction?.exportLabelCount||0):"")+
        (Array.isArray(exportAction?.triggerCandidates)&&exportAction.triggerCandidates.length?" Export controls: "+exportAction.triggerCandidates.map(item=>item.label+" ["+item.tag+", "+item.className+"]").join(" | "):"")+
        (Array.isArray(exportAction?.nearbyExportElements)&&exportAction.nearbyExportElements.length?" Export DOM: "+exportAction.nearbyExportElements.map(item=>item.tag+" text="+item.text+" aria="+item.aria+" title="+item.title+" testid="+item.testid+" class="+item.className).join(" | "):"")+
        (Array.isArray(exportAction?.nearbyExportElements)&&exportAction.nearbyExportElements.length?" Export DOM: "+exportAction.nearbyExportElements.map(item=>item.tag+" text="+item.text+" aria="+item.aria+" title="+item.title+" testid="+item.testid+" class="+item.className).join(" | "):"")
      );
    }
    exportSubmittedAtSec=Math.max(0,Math.floor((Number(exportAction.clickedAt)||Date.now())/1000));
    job.batchSearchExportSubmittedAtSec=exportSubmittedAtSec;
    sendBatchSearchFileProgress(
      "Selected SPX Export → "+exportAction.menuItem+". Waiting for the new Latest Task export to finish…"
    );
    capture=discardBatchSearchOrderListCapture(await pollFile(10000));
  }
  if(!capture?.ready&&capture?.directUrl&&!/^blob:/i.test(capture.directUrl)){
    const response=await extensionFetchBuffer(capture.directUrl,{
      headers:{ "Accept":"text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream,*/*" }
    });
    if(!response.ok)throw new Error("SPX result file download failed (HTTP "+response.status+").");
    const bytes=new Uint8Array(response.buffer);
    let binary="";
    for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
    const disposition=response.contentDisposition||"";
    const filenameMatch=disposition.match(/filename\*?=(?:UTF-8''|")?([^;"\r\n]+)/i);
    capture={ready:true,file:{
      url:capture.directUrl,
      fileName:filenameMatch?.[1]?filenameMatch[1].replace(/^"|"$/g,""):(capture.directFileName||"spx_batch_search_result.csv"),
      contentType:response.contentType||"",
      size:bytes.length,
      base64:btoa(binary),
      capturedAt:Date.now(),
      source:"authenticated-file-download"
    }};
    capture=discardBatchSearchOrderListCapture(capture);
  }
  if(!capture?.ready&&capture?.exportTaskResponse?.payload){
    const payload=String(capture.exportTaskResponse.payload);
    capture={
      ready:true,
      file:{
        fileName:"spx_batch_search_export_response.json",
        contentType:"application/json",
        size:new TextEncoder().encode(payload).length,
        base64:batchSearchBase64FromText(payload),
        capturedAt:Date.now(),
        source:"SPX export-task API response"
      }
    };
  }
  capture=discardBatchSearchOrderListCapture(capture);
  let resolvedFile=null;
  if(!capture?.ready&&!capture?.exportTaskResponse&&exportSubmittedAtSec){
    sendBatchSearchFileProgress("No direct file response was exposed. Checking SPX Latest Task and retrieving the newly created export…");
    const foundTask=await discoverNewBatchSearchExportTask(exportSubmittedAtSec,job);
    resolvedFile=await downloadDiscoveredBatchSearchTask(foundTask,exportSubmittedAtSec,job);
  }else if(capture?.ready&&capture.file?.base64){
    resolvedFile=await resolveBatchSearchExportPayload(capture.file,tabId,job);
  }else{
    const detail=(capture?.errors||[]).join(" | ")||"No CSV/Excel download or export-task response was captured.";
    const controls=(exportAction?.menuOptions||exportAction?.controls||[]).join(" | ")||
      exportAction?.note||"No visible Export/Download menu option was found.";
    const events=(capture?.events||[]).map(item=>
      String(item.method||"GET")+" "+String(item.status||"")+" "+String(item.url||"").slice(0,180)+" ["+String(item.contentType||"")+"]"
    ).join(" ; ");
    throw new Error("SPX Batch Search completed, but its downloaded result file could not be read. "+detail+
      " Export control: "+String(exportAction?.trigger||exportAction?.reason||"not identified")+
      ". Export menu: "+controls+
      (events?". SPX export requests: "+events:""));
  }
  sendBatchSearchFileProgress("Downloaded "+String(resolvedFile.fileName||"SPX result file")+" · reading the actual file contents…");
  return await parseDownloadedBatchSearchFile(resolvedFile,trackingNumbers);
}

async function updateSpxBatchSearchNotice(tabId, message, state = "working") {
  const id=Number(tabId)||0;
  if(!id||!chrome.scripting)return;
  const text=String(message||"Working on SPX Batch Search…").slice(0,500);
  const safeState=["working","success","error"].includes(state)?state:"working";
  try {
    await chrome.scripting.executeScript({
      target:{tabId:id},
      world:"MAIN",
      args:[text,safeState],
      func:(message,status)=>{
        const KEY="__badocHubBatchSearchNoticeV1";
        let memory=window[KEY];
        if(!memory||typeof memory!=="object") {
          memory={entries:[],collapsed:false};
          try{Object.defineProperty(window,KEY,{configurable:true,value:memory});}
          catch(_){window[KEY]=memory;}
        }
        memory.entries ||= [];
        if(memory.entries[memory.entries.length-1]?.message!==message) {
          memory.entries.push({message,at:new Date().toLocaleTimeString([],{
            hour:"2-digit",minute:"2-digit",second:"2-digit"
          })});
          memory.entries=memory.entries.slice(-5);
        }
        memory.status=status;
        let host=document.getElementById("badoc-spx-batch-search-notice");
        if(!host) {
          host=document.createElement("div");
          host.id="badoc-spx-batch-search-notice";
          host.style.cssText="all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;display:block;width:350px;max-width:calc(100vw - 28px);font-family:Arial,Helvetica,sans-serif;color:#eef5fc;pointer-events:auto;";
          (document.body||document.documentElement).appendChild(host);
        }
        const root=host.shadowRoot||host.attachShadow({mode:"open"});
        root.innerHTML="";
        const css=[
          ":host{all:initial}*{box-sizing:border-box}",
          ".card{background:#101a27;border:1px solid #38516a;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.38);overflow:hidden;color:#eef5fc}",
          ".head{display:flex;align-items:center;gap:10px;padding:11px 13px;background:#162536;border-bottom:1px solid #2b4055}",
          ".mark{width:9px;height:9px;border-radius:50%;background:#38bdf8;box-shadow:0 0 0 4px rgba(56,189,248,.12);flex:none}",
          ".mark.success{background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.12)}",
          ".mark.error{background:#fb7185;box-shadow:0 0 0 4px rgba(251,113,133,.12)}",
          ".brand{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#a9bfd3;flex:1}",
          ".state{font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:4px 7px;border:1px solid #38516a;border-radius:999px;color:#7dd3fc}",
          ".state.success{color:#86efac;border-color:#25664d}.state.error{color:#fda4af;border-color:#813e50}",
          ".toggle{border:0;background:transparent;color:#b8c9d9;font-size:18px;line-height:1;padding:1px 3px;cursor:pointer}",
          ".body{padding:12px 14px 13px}.current{font-size:13px;line-height:1.45;font-weight:700;color:#f4f8fc;overflow-wrap:anywhere}",
          ".history{margin-top:9px;border-top:1px solid #293d51;padding-top:8px;display:grid;gap:5px}",
          ".entry{display:flex;gap:8px;font-size:10px;line-height:1.35;color:#a9bfd3}",
          ".time{color:#6f91ad;white-space:nowrap;font-variant-numeric:tabular-nums}",
          ".collapsed .body{display:none}",
          "@media(max-width:600px){:host{right:10px;bottom:10px;width:calc(100vw - 20px)}}"
        ].join("");
        const style=document.createElement("style");style.textContent=css;root.appendChild(style);
        const card=document.createElement("section");card.className="card"+(memory.collapsed?" collapsed":"");
        const head=document.createElement("header");head.className="head";
        const mark=document.createElement("span");mark.className="mark "+status;
        const brand=document.createElement("span");brand.className="brand";brand.textContent="Badoc Hub · Batch Search";
        const badge=document.createElement("span");badge.className="state "+status;badge.textContent=status==="success"?"Done":status==="error"?"Needs attention":"Working";
        const toggle=document.createElement("button");toggle.type="button";toggle.className="toggle";toggle.textContent=memory.collapsed?"+":"−";
        toggle.setAttribute("aria-label",memory.collapsed?"Expand Batch Search notifications":"Collapse Batch Search notifications");
        toggle.addEventListener("click",()=>{
          memory.collapsed=!memory.collapsed;
          card.classList.toggle("collapsed",memory.collapsed);
          toggle.textContent=memory.collapsed?"+":"−";
          toggle.setAttribute("aria-label",memory.collapsed?"Expand Batch Search notifications":"Collapse Batch Search notifications");
        });
        head.append(mark,brand,badge,toggle);
        const body=document.createElement("div");body.className="body";
        const current=document.createElement("div");current.className="current";current.textContent=message;
        const history=document.createElement("div");history.className="history";
        for(const item of memory.entries.slice(-4).reverse()){
          const line=document.createElement("div");line.className="entry";
          const time=document.createElement("span");time.className="time";time.textContent=item.at;
          const label=document.createElement("span");label.textContent=item.message;
          line.append(time,label);history.appendChild(line);
        }
        body.append(current,history);card.append(head,body);root.appendChild(card);
      }
    });
  } catch(error) {
    console.warn("Could not update the SPX Batch Search notification panel:",error);
  }
}

function sendBatchSearchFileProgress(message){
  try{
    for(const job of activeJobs.values()){
      if(job.kind==="batch-search-result"&&job.spxTabId){
        const text=String(message||"Reading SPX downloaded file…");
        sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
          kind:"batch-search-result",message:text,selectedDate:job.selectedDate||""
        });
        void updateSpxBatchSearchNotice(job.spxTabId,text,/\b(failed|error|could not)\b/i.test(text)?"error":"working");
      }
    }
  }catch{}
}

const SPX_BATCH_SEARCH_SIZE = 3000;

function normalizeBatchSearchTn(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, "").toUpperCase();
}


const BATCH_SEARCH_RESULT_HEADERS = Object.freeze(["Order ID","SLS Tracking Number","Shopee Order SN","Sort Code Name","Town Name","Location Type","Driver ID","Driver Name","Driver Phone","Received Time","Current Station Received Time","Delivering Time","Delivered Time","OnHold Time","OnHoldReason","Reschedule Date","Status","Reject remark","COD Amount","Manifest Number","Order Account","Original ASF","Rounding ASF","Total of On Hold Times","Reschedule Time","Delivery Attempts","Bulky Type","SLA Target Date","Time to SLA","Payment Method","Current Station","Shop ID","Shop Category","Zone ID","Zone","Destination Station","Next Station","Pickup Station","Ros","Driver Contract Type","Pick Up Time","Collected Time","Transported to sp time","SLA Tag","High Value","Specical Dg Type","Damaged Tag","Return Destination","Chargeable Weight","Cache Type","Size Type"]);
function normalizeBatchSearchHeader(value) {
  return String(value ?? "").normalize("NFKC").trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}
const BATCH_SEARCH_HEADER_MAP = new Map();
for (const header of BATCH_SEARCH_RESULT_HEADERS) {
  BATCH_SEARCH_HEADER_MAP.set(normalizeBatchSearchHeader(header), header);
}
// Small, explicit aliases for SPX label variations. Extra Batch Search,
// Assignment Task, Search Result and Error columns are intentionally ignored.
for (const [alias, target] of [
  ["oid", "Order ID"],
  ["order no", "Order ID"],
  ["order number", "Order ID"],
  ["sls tn", "SLS Tracking Number"],
  ["sls tracking no", "SLS Tracking Number"],
  ["shopee order serial number", "Shopee Order SN"],
  ["special dg type", "Specical Dg Type"]
]) {
  BATCH_SEARCH_HEADER_MAP.set(normalizeBatchSearchHeader(alias), target);
}
const BATCH_SEARCH_RESULT_HEADER_KEYS = new Set(
  BATCH_SEARCH_RESULT_HEADERS.map(normalizeBatchSearchHeader)
);
const BATCH_SEARCH_DATE_HEADER_KEYS = new Set([
  "receivedtime", "currentstationreceivedtime", "deliveringtime",
  "deliveredtime", "onholdtime", "rescheduledate", "rescheduletime",
  "slatargetdate", "pickuptime", "collectedtime", "transportedtosp time".replace(/[^a-z0-9]/g, "")
]);
function batchSearchFormatDateValue(value, header) {
  const text = String(value ?? "").trim();
  if (!text || !BATCH_SEARCH_DATE_HEADER_KEYS.has(normalizeBatchSearchHeader(header))) return text;
  const serial = Number(text);
  if (/^\d{4,6}(?:\.\d+)?$/.test(text) && Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
    if (!Number.isNaN(date.getTime())) {
      const pad = number => String(number).padStart(2, "0");
      const dateText = pad(date.getUTCMonth() + 1) + "/" + pad(date.getUTCDate()) + "/" + date.getUTCFullYear();
      const hasTime = Math.abs(serial - Math.floor(serial)) > 0.0000001;
      return hasTime ? dateText + " " + pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) : dateText;
    }
  }
  const formatParts = (year, month, day, hour, minute, hasTime) => {
    const pad = number => String(number).padStart(2, "0");
    const dateText = pad(month) + "/" + pad(day) + "/" + year;
    return hasTime ? dateText + " " + pad(hour) + ":" + pad(minute) : dateText;
  };
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (match) return formatParts(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), match[4] != null);
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (match) return formatParts(Number(match[3]), Number(match[1]), Number(match[2]), Number(match[4] || 0), Number(match[5] || 0), match[4] != null);
  return text;
}
function batchSearchCanonicalSourceFields(sourceFields) {
  const source = sourceFields && typeof sourceFields === "object" ? sourceFields : {};
  const output = Object.fromEntries(BATCH_SEARCH_RESULT_HEADERS.map(header => [header, ""]));
  const entries = Object.entries(source);
  // Exact canonical SPX headings take precedence over aliases, independent of
  // the order in which source columns arrive in each 3,000-TN chunk.
  for (const exactPass of [true, false]) {
    for (const [sourceHeader, rawValue] of entries) {
      const normalized = normalizeBatchSearchHeader(sourceHeader);
      const target = BATCH_SEARCH_HEADER_MAP.get(normalized);
      if (!target) continue;
      const isExact = normalized === normalizeBatchSearchHeader(target);
      if (isExact !== exactPass) continue;
      const value = String(rawValue ?? "").trim();
      if (!value) continue;
      if (exactPass || !output[target]) {
        output[target] = batchSearchFormatDateValue(value, target);
      }
    }
  }
  return output;
}
function isBatchSearchRepeatedHeaderRow(headers, row) {
  if (!Array.isArray(row)) return false;
  const known = new Set([
    ...BATCH_SEARCH_RESULT_HEADERS.map(normalizeBatchSearchHeader),
    ...(Array.isArray(headers) ? headers.map(normalizeBatchSearchHeader) : [])
  ]);
  const values = row.map(value => normalizeBatchSearchHeader(value)).filter(Boolean);
  if (values.length < 8) return false;
  const hits = values.reduce((count, value) => count + (known.has(value) ? 1 : 0), 0);
  return hits >= 8 && hits / values.length >= 0.45;
}
function batchSearchCsv(rows) {
  const columns = BATCH_SEARCH_RESULT_HEADERS;
  const cell = value => {
    const text = String(value ?? "");
    return /[",\\r\\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return [columns, ...(Array.isArray(rows) ? rows : []).map(row => columns.map(header => row?.[header] ?? ""))]
    .map(row => row.map(cell).join(",")).join("\\r\\n");
}
async function runBatchSearchExportJob(job) {
  let tabId=null;
  const failedByTn=new Map();
  const downloadedFileNames=[];
  const downloadedRecords=[];
  let downloadedFileRows=0;
  const rawTns=Array.isArray(job.trackingNumbers)?job.trackingNumbers:[];
  // Master list: preserve every Assignment Task TN row, including duplicates.
  const inputRows=rawTns.map(value=>String(value??"").normalize("NFKC").trim().replace(/\s+/g,"")).filter(Boolean);
  const inputByKey=new Map();
  const uniqueSearchTns=new Map();
  for(const inputTn of inputRows) {
    const key=normalizeBatchSearchTn(inputTn);
    if(!inputByKey.has(key))inputByKey.set(key,inputTn);
    if(!/^[A-Z0-9_-]{6,60}$/.test(key)) {
      if(!failedByTn.has(key))failedByTn.set(key,"Tracking number is not in a supported SPX format.");
      continue;
    }
    if(!uniqueSearchTns.has(key))uniqueSearchTns.set(key,inputTn);
  }
  const tns=[...uniqueSearchTns.values()];
  const sendProgress=(message,state="working")=>{
    const text=String(message||"Batch Search is running…");
    sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
      kind:"batch-search-result",message:text,selectedDate:job.selectedDate||""
    });
    if(tabId)void updateSpxBatchSearchNotice(tabId,text,state);
  };

  try {
    if(!inputRows.length)throw new Error("The Assignment Task SPX Tracking Number column contains no non-empty rows.");
    if(tns.length>50000)throw new Error("Batch Search is limited to 50,000 unique tracking numbers per run. The Assignment Task rows have been retained; split the input into smaller runs.");
    sendProgress(
      "Loaded "+inputRows.length.toLocaleString()+" Assignment Task tracking-number row(s) · "+
      tns.length.toLocaleString()+" unique valid SPX lookup(s)"+(failedByTn.size?" · "+failedByTn.size.toLocaleString()+" invalid row(s) will be retained as Search Failed":"")+"."
    );

    if(tns.length) {
      job.startedAt=Date.now();
      sendProgress("Opening SPX Order Tracking for "+tns.length.toLocaleString()+" unique tracking number(s)…");
      tabId=await createDedicatedSpxTab();
      job.spxTabId=tabId;
      await ensureParcelOrderTrackingRoute(tabId);

      const batches=[];
      for(let i=0;i<tns.length;i+=SPX_BATCH_SEARCH_SIZE)batches.push(tns.slice(i,i+SPX_BATCH_SEARCH_SIZE));
      for(let i=0;i<batches.length;i++) {
        if(job.cancelled)throw new Error("Batch Search was cancelled.");
        const batch=batches[i];
        const batchKeys=new Set(batch.map(normalizeBatchSearchTn));
        sendProgress(
          "SPX Batch Search "+(i+1)+"/"+batches.length+" · searching "+
          batch.length.toLocaleString()+" unique TN(s) from the Assignment Task master list…"
        );
        try {
          const response=await executeSpxBatchSearch(tabId,batch,job);
          if(!response||!Array.isArray(response.results)||!Array.isArray(response.sourceRows)) {
            throw new Error("SPX downloaded Batch Search file returned an invalid result payload.");
          }
          if(response.fileName)downloadedFileNames.push(String(response.fileName));
          downloadedFileRows+=Math.max(0,Number(response.fileRowCount||0));
          for(const row of response.sourceRows) {
            downloadedRecords.push({
              sourceFields:row?.sourceFields&&typeof row.sourceFields==="object"?row.sourceFields:{},
              matchedKeys:Array.isArray(row?.matchedKeys)
                ?[...new Set(row.matchedKeys.map(normalizeBatchSearchTn).filter(key=>batchKeys.has(key)))]
                :[],
              explicitlyNotFound:row?.explicitlyNotFound===true
            });
          }
          const foundInBatch=response.results.length;
          sendProgress(
            "Batch "+(i+1)+"/"+batches.length+" complete · read "+
            Number(response.fileRowCount||0).toLocaleString()+" downloaded row(s) from "+
            String(response.fileName||"SPX export")+" · "+foundInBatch.toLocaleString()+
            " matched result key(s)."
          );
        } catch(error) {
          const message=String(error?.message||error);
          for(const pendingBatch of batches.slice(i)) {
            for(const value of pendingBatch)failedByTn.set(normalizeBatchSearchTn(value),message);
          }
          job.keepSpxTabOpen=true;
          console.error("SPX Batch Search chunk failed:",error);
          sendProgress("Batch "+(i+1)+"/"+batches.length+" failed · "+message+" · SPX tab left open for inspection.","error");
          break;
        }
      }
    } else {
      sendProgress("No valid tracking numbers to submit to SPX. Keeping every non-empty Assignment Task row in the result as Search Failed.");
    }

    // Map each downloaded SPX record to every Assignment Task tracking number
    // it identifies (matched, SPX, SLS, or 3PL). The input list controls output
    // row count and order; SPX cannot add or remove master-list rows.
    const recordByKey=new Map();
    for(const record of downloadedRecords) {
      for(const key of record.matchedKeys||[]) {
        if(!recordByKey.has(key))recordByKey.set(key,record);
      }
    }

    const outputHeaders=BATCH_SEARCH_RESULT_HEADERS;
    const outputRows=[];
    let matchedCount=0,notFoundCount=0,failedCount=0;

    // Copy only real parcel records. Not Found and Search Failed totals are
    // reported separately by Badoc Hub; they must not create fake parcel rows
    // or add non-SPX columns to the canonical 51-column export.
    for(const inputTn of inputRows) {
      const key=normalizeBatchSearchTn(inputTn);
      const error=failedByTn.get(key)||"";
      if(error) { failedCount++; continue; }
      const record=recordByKey.get(key)||null;
      if(!record||record.explicitlyNotFound) { notFoundCount++; continue; }
      outputRows.push(batchSearchCanonicalSourceFields(record.sourceFields));
      matchedCount++;
    }
    sendProgress("SPX export read successfully · "+downloadedFileRows.toLocaleString()+" downloaded row(s) checked · preparing "+outputRows.length.toLocaleString()+" Assignment Task rows.","success");
    sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_CSV",{
      selectedDate:String(job.selectedDate||""),
      sourceTaskId:String(job.sourceTaskId||""),
      csvText:batchSearchCsv(outputRows),
      fileName:"batch_search_result.csv",
      inputCount:inputRows.length,
      uniqueInputCount:tns.length,
      duplicateInputCount:inputRows.length-new Set(inputRows.map(normalizeBatchSearchTn)).size,
      invalidInputCount:[...new Set(inputRows.map(normalizeBatchSearchTn))].filter(key=>failedByTn.has(key)).length,
      chunkCount:tns.length?Math.ceil(tns.length/SPX_BATCH_SEARCH_SIZE):0,
      downloadedFileName:downloadedFileNames.join(" | "),
      downloadedFileRows,
      rowCount:outputRows.length,
      matchedCount,
      notFoundCount,
      failedCount,
      failedBatchCount:failedByTn.size?[...new Set([...failedByTn.keys()])].filter(key=>tns.some(value=>normalizeBatchSearchTn(value)===key)).length:0
    });
  } catch(error) {
    if(tabId)job.keepSpxTabOpen=true;
    console.error("SPX Batch Search export failed:",error);
    sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_ERROR",{
      kind:"batch-search-result",
      message:(error?.message||String(error))+(tabId?" · SPX tab left open for inspection.":"")
    });
  } finally {
    if(tabId&&job.keepSpxTabOpen) {
      try {
        const spxTab=await chrome.tabs.get(tabId);
        if(spxTab?.windowId)await chrome.windows.update(spxTab.windowId,{focused:true});
        await chrome.tabs.update(tabId,{active:true});
      } catch(error) {
        console.warn("Could not keep SPX Batch Search tab open for inspection:",error);
      }
    } else if(tabId) {
      try { await chrome.tabs.remove(tabId); }
      catch(error) { console.warn("Could not close temporary SPX Batch Search tab:",error); }
      const dashboardTabId=Number(job.dashboardTabId)||0;
      if(dashboardTabId) {
        try {
          const dashboardTab=await chrome.tabs.get(dashboardTabId);
          const dashboardWindowId=Number(job.dashboardWindowId||dashboardTab?.windowId)||0;
          if(dashboardWindowId)await chrome.windows.update(dashboardWindowId,{focused:true});
          await chrome.tabs.update(dashboardTabId,{active:true});
        } catch(error) {
          console.warn("Could not return to the Badoc Hub dashboard tab after Batch Search:",error);
        }
      }
    }
    releaseActiveJob(job);
  }
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
      const message = "SPX marked " + label + " task " + taskId + " as Succeeded. Waiting for its file media_id to appear in the full task record… (" + elapsed + "s)";
      if(job?.kind==="batch-search-result"){
        sendToPort(job.ownerPort,"BADOC_SPX_BATCH_SEARCH_PROGRESS",{
          kind:"batch-search-result",message,selectedDate:job.selectedDate||""
        });
      }else{
        sendToPort(job?.ownerPort, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", { message });
      }
      lastProgressAt = now;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await sleep(Math.min(ASSIGNMENT_TASK_MEDIA_ID_POLL_MS, remaining));
  }

  return { task: bestTask, source: bestSource, mediaId: "", lookupErrors };
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

    if (type === "BADOC_START_ASSIGNMENT_TASK_EXPORT") {
      const selectedDate = String(message?.selectedDate || "").trim();
      sendToPort(port, "BADOC_SPX_ASSIGNMENT_TASK_PROGRESS", {
        stage: "command-received", selectedDate,
        message: "Extension background received the Assignment Task command. Preparing the direct SPX export…"
      });
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
        stage: "job-accepted", selectedDate: job.selectedDate,
        message: "Extension accepted the Assignment Task export request…"
      });
      void runAssignmentTaskExportJob(job);
      return;
    }

    if (type === "BADOC_START_BATCH_SEARCH_EXPORT") {
      const trackingNumbers = (Array.isArray(message?.trackingNumbers) ? message.trackingNumbers : [])
        .map(value => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, ""))
        .filter(Boolean);
      if (!trackingNumbers.length) {
        sendToPort(port, "BADOC_SPX_BATCH_SEARCH_ERROR", {
          kind: "batch-search-result",
          message: "No usable SPX Tracking Numbers were received from Reports. Run Assignment Task first and check its SPX Tracking Number column."
        });
        return;
      }
      const job = reserveActiveJob("batch-search-result", port, {
        trackingNumbers,
        selectedDate: String(message?.selectedDate || "").trim(),
        sourceTaskId: String(message?.sourceTaskId || "").trim(),
        // Remember the exact Badoc Hub tab that requested this search so cleanup
        // can return the user there after the foreground SPX tab is closed.
        dashboardTabId: Number(port.sender?.tab?.id) || null,
        dashboardWindowId: Number(port.sender?.tab?.windowId) || null
      });
      if (!job) {
        sendToPort(port, "BADOC_SPX_BATCH_SEARCH_ERROR", {
          kind: "batch-search-result",
          message: "Another SPX export is currently running. Wait for it to finish, then retry Batch Search Result."
        });
        return;
      }
      void runBatchSearchExportJob(job);
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
  if (message?.type === "BADOC_BATCH_SEARCH_STAGE") {
    const tabId = Number(sender?.tab?.id) || 0;
    const job = [...activeJobs.values()].find(item =>
      item.kind === "batch-search-result" && Number(item.spxTabId) === tabId
    );
    if (job) {
      const stageText=String(message.message || "Running SPX Batch Search…");
      sendToPort(job.ownerPort, "BADOC_SPX_BATCH_SEARCH_PROGRESS", {
        kind: "batch-search-result",
        message: stageText,
        selectedDate: job.selectedDate || ""
      });
      void updateSpxBatchSearchNotice(tabId,stageText,"working");
    }
    return false;
  }
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
