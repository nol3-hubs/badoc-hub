const SPX_ORIGIN = "https://spx.shopee.ph";
const TASK_LIST_PATH = "/spxdata/api/export_platform/export_task/list_for_portal";
const SIGNED_URL_PATH = "/spxdata/api/export_platform/export_task/get_signed_download_url";
const EXPORT_NAME = "inbound_to_from_spx";
const STATION_ID = 3061; // legacy Badoc fallback only; not used to validate hub-aware jobs
const VERSION = "69";
const RIDER_EXPORT_PATH = "/api/driverservice/admin/driver/export";
const RIDER_TASK_LIST_PATH = "/spxdata/api/export_platform/export_task/list_for_portal";
const RIDER_EXPORT_NAME = "spx_driver";
const RIDER_EXPORT_BIZ_NAME = "driver";


const POLL_MS = 3000;
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
let activeJob = null;

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

function sendToBadoc(type, data = {}) {
  // Every sync stays attached to the page/frame that started it.
  if (activeJob?.ownerPort) return sendToPort(activeJob.ownerPort, type, data);
  let sent = false;
  for (const port of badocPorts) {
    if (sendToPort(port, type, data)) sent = true;
  }
  return sent;
}

function progress(message, extra = {}) {
  sendToBadoc("BADOC_SPX_PROGRESS", { message, ...extra });
}

function riderProgress(message, extra = {}) {
  sendToBadoc("BADOC_SPX_RIDER_PROGRESS", { message, ...extra, kind: "riders" });
}


async function createDedicatedSpxTab() {
  // Batch Search is part of Order Management → Order Tracking.
  // Open that route directly so the SPA does not remain on TO List when a
  // hash-only route change fails to trigger tabs.onUpdated(status=complete).
  const tab = await chrome.tabs.create({
    url: `${SPX_ORIGIN}${PARCEL_ORDER_TRACKING_ROUTE}`,
    active: false
  });

  if (!tab?.id) {
    throw new Error("Could not create the temporary SPX tab.");
  }

  progress("Created a dedicated temporary SPX tab…", { phase: "tab", tabId: tab.id });

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
  return tab.id;
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
  return await withTimeout(
    fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      ...init,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        ...(init.headers || {})
      }
    }),
    FETCH_TIMEOUT_MS,
    "SPX request"
  ).then(async response => {
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type") || "",
      contentDisposition: response.headers.get("content-disposition") || "",
      text
    };
  });
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

async function listTasks(startSec) {
  const url = `${SPX_ORIGIN}${TASK_LIST_PATH}?start_time=${encodeURIComponent(startSec)}&count=100&pageno=1`;
  const response = await extensionFetchText(url);
  const json = parseJsonResponse("SPX export task list", response);
  if (Number(json?.retcode) !== 0) {
    throw new Error(json?.message || "SPX task list request failed.");
  }
  return Array.isArray(json?.data?.task_list) ? json.data.task_list : [];
}

async function getSignedDownloadUrl(taskId) {
  const url = `${SPX_ORIGIN}${SIGNED_URL_PATH}?source=fms&task_id=${encodeURIComponent(taskId)}`;
  const response = await extensionFetchText(url);
  const json = parseJsonResponse("SPX signed download URL", response);
  if (Number(json?.retcode) !== 0) {
    throw new Error(json?.message || "SPX did not return a signed download URL.");
  }
  const signedUrl = String(json?.data?.download_url || "");
  if (!signedUrl) throw new Error("SPX returned no signed download URL.");
  return signedUrl;
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
  return setsEqual(
    trackingStatus.split(",").map(x => x.trim()).filter(Boolean),
    PARCEL_DELIVERY_STATUS_IDS
  );
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
  const body = {
    tracking_status: PARCEL_DELIVERY_STATUS_IDS.join(","),
    bulky_type: "1,0,2",
    ctime: `${range.createdStartSec},${range.createdEndSec}`,
    pick_up_time: `${range.assignedStartSec},${range.assignedEndSec}`,
    format_condition:
      `Status Log= ${PARCEL_DELIVERY_STATUS_NAMES.join(",")}; ` +
      `Bulky Type= Bulky,N/A,Non-Bulky; ` +
      `Created Date= ${range.createdStartDate} 00:00:00,${range.todayDate} 00:00:00; ` +
      `Assigned Time= ${range.todayDate} 00:00:00,${range.todayDate} 23:59:59; ` +
      `Driver= All`
  };

  progress(
    `Submitting direct SPX Delivering / Delivered / On-Hold export for ${range.todayDate}…`,
    { phase: "parcel-delivery-api-export", dateStart: range.todayDate, dateEnd: range.todayDate }
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

  const json = parseJsonResponse("SPX Delivering / Delivered / On-Hold export", response);
  if (!response.ok || Number(json?.retcode) !== 0) {
    throw new Error(
      json?.message ||
      `SPX Delivering / Delivered / On-Hold export failed (HTTP ${response.status}).`
    );
  }

  const taskId = Number(json?.data?.task_id || json?.task_id || 0);
  if (!taskId) {
    throw new Error("SPX accepted the delivery export request but returned no task ID.");
  }

  progress(`SPX delivery export task ${taskId} created directly.`, {
    phase: "parcel-delivery-task",
    taskId,
    dateStart: range.todayDate,
    dateEnd: range.todayDate
  });

  return { taskId, range, requestBody: body, apiResult: json };
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
    activeJob = null;
  }
}

async function executeSpxBatchSearch(tabId, trackingNumbers) {
  let injectionResults;
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      args: [trackingNumbers],
      func: async (tns) => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const visible = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const clean = value => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
        let stage = "initialize";
        const normalizeTextForDiagnostics = value => String(value || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const diagnostics = () => ({
          url: String(location.href || ""),
          title: String(document.title || ""),
          readyState: document.readyState,
          textareaCount: document.querySelectorAll("textarea").length,
          visibleTextareas: [...document.querySelectorAll("textarea")].filter(visible).map(el => String(el.placeholder || "").slice(0, 160)),
          visibleButtons: [...document.querySelectorAll("button,[role='button'],.ssc-button,[class*=\'ssc-button\']")].filter(visible).map(el => String(el.innerText || el.textContent || "").trim()).filter(Boolean).slice(0, 60),
          batchSearchCandidates: [...document.querySelectorAll("button,[role='button'],a,[tabindex],.ssc-button,[class*=\'ssc-button\'],span,div")].filter(el => visible(el) && normalizeTextForDiagnostics(el.innerText || el.textContent).includes("batchsearch")).slice(0, 10).map(el => ({tag:el.tagName, text:String(el.innerText || el.textContent || "").trim().slice(0,100), className:String(el.className || "").slice(0,120), outerHTML:String(el.outerHTML || "").slice(0,250)})),
          tables: [...document.querySelectorAll("table")].map((table, i) => ({
            index: i,
            headers: [...table.querySelectorAll("thead th")].map(th => String(th.innerText || "").trim()).filter(Boolean).slice(0, 70),
            rows: table.querySelectorAll("tbody tr").length
          })).slice(0, 10)
        });

        try {
          stage = "validate tracking numbers";
          const wanted = new Set((tns || []).map(clean).filter(Boolean));
          if (!wanted.size) return { results: [], message: "No TNs in batch.", diagnostics: diagnostics() };

          const normalizeActionLabel = value => String(value || "")
          .normalize("NFKC")
          .replace(/[\u200B-\u200D\uFEFF]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
        const labelVariants = el => [
          el?.innerText,
          el?.textContent,
          el?.getAttribute?.("aria-label"),
          el?.getAttribute?.("title")
        ].map(normalizeActionLabel).filter(Boolean);
        const exactAction = (el, action) => visible(el) && labelVariants(el).includes(action);
        // Prefer exact labels, then use a substring fallback for SPX variants that
        // append icons, hidden labels, or a count to the Batch Search button.
        const containsAction = (el, action) => visible(el) && labelVariants(el).some(label => label.includes(action));
        const isClickableCandidate = el => /^(BUTTON|A)$/.test(el.tagName) ||
          el.getAttribute?.("role") === "button" || /(^|\s)(ssc-button|ssc-btn|el-button|ant-btn)(\s|$)/i.test(String(el.className || "")) ||
          el.hasAttribute?.("tabindex");
        const findActionControl = (action) => {
          const selector = "button,[role='button'],a.el-button,.el-button,.ant-btn,[tabindex],.ssc-button,[class*=\'ssc-button\']";
          const candidates = [...document.querySelectorAll(selector)].filter(visible);
          const exact = candidates.filter(el => exactAction(el, action));
          if (exact.length) {
            exact.sort((a,b) => (isClickableCandidate(b) ? 1 : 0) - (isClickableCandidate(a) ? 1 : 0));
            return exact[0];
          }
          const partial = candidates.filter(el => isClickableCandidate(el) && containsAction(el, action));
          partial.sort((a,b) => {
            const la = labelVariants(a).filter(v => v.includes(action)).map(v => v.length);
            const lb = labelVariants(b).filter(v => v.includes(action)).map(v => v.length);
            return (Math.min(...la, 9999)) - (Math.min(...lb, 9999));
          });
          if (partial.length) return partial[0];
          const labelNodes = [...document.querySelectorAll("span,div,a")].filter(el =>
            visible(el) && normalizeActionLabel(el.innerText || el.textContent) === action
          );
          for (const node of labelNodes) {
            const target = node.closest("button,[role='button'],a.el-button,.el-button,.ant-btn,[tabindex],.ssc-button,[class*=\'ssc-button\']");
            if (target && visible(target)) return target;
            if (typeof node.click === "function") return node;
          }
          return null;
        };
        const findTextarea = () => [...document.querySelectorAll("textarea")]
            .find(el => /SPX Tracking Number/i.test(el.placeholder || "") && visible(el));
          stage = "find or open Batch Search dialog";
          let textarea = findTextarea();
          if (!textarea) {
            const buttonDeadline = Date.now() + 15000;
            let batchButton = null;
            const buttonSelectors = "button,[role='button'],a.el-button,.el-button,.ant-btn,[tabindex],.ssc-button,[class*=\'ssc-button\']";
            // SPX Order Tracking uses this dedicated class on its Batch Search control.
            // Target it first; generic label matching is only a fallback.
            const directSelector = "button.batch-search-button, .batch-search-button";
            const findDirectBatchSearchControl = () => {
              const direct = [...document.querySelectorAll(directSelector)];
              // Never click a hidden placeholder. Only accept an actually visible,
              // enabled control and reject aria-disabled controls.
              return direct.find(el => visible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true") || null;
            };
            const findBatchByVisibleLabel = () => {
              const candidates = [...document.querySelectorAll(buttonSelectors)].filter(visible);
              return candidates.find(el => !el.disabled && el.getAttribute("aria-disabled") !== "true" &&
                labelVariants(el).some(label => label.includes("batch") && label.includes("search"))) || null;
            };
            while (Date.now() < buttonDeadline && !batchButton) {
              batchButton = findDirectBatchSearchControl() || findBatchByVisibleLabel() || findActionControl("batchsearch");
              if (!batchButton) await sleep(250);
            }
            if (!batchButton) {
              const observed = [...document.querySelectorAll(buttonSelectors)]
                .filter(visible)
                .map(el => ({ text: String(el.innerText || el.textContent || "").trim().slice(0, 100), normalized: labelVariants(el), tag: el.tagName, className: String(el.className || "").slice(0, 100), outerHTML: String(el.outerHTML || "").slice(0, 220) }))
                .filter(x => x.text).slice(0, 35);
              const directControls = [...document.querySelectorAll(directSelector)].map(el => ({
                visible: visible(el), disabled: !!el.disabled, ariaDisabled: el.getAttribute("aria-disabled"),
                text: String(el.innerText || el.textContent || "").trim().slice(0, 100),
                className: String(el.className || "").slice(0, 160),
                outerHTML: String(el.outerHTML || "").slice(0, 320)
              })).slice(0, 8);
              throw new Error("Could not find a visible, enabled Batch Search control. Page URL=" + String(location.href || "") +
                "; title=" + String(document.title || "") + "; direct controls=" + JSON.stringify(directControls) +
                "; visible controls=" + JSON.stringify(observed));
            }
            try { batchButton.scrollIntoView({ block: "center", inline: "nearest" }); } catch {}
            batchButton.click();
            const textareaDeadline = Date.now() + 15000;
            while (Date.now() < textareaDeadline && !textarea) {
              await sleep(250);
              textarea = findTextarea();
            }
          }
          if (!textarea) throw new Error("The Batch Search tracking-number textarea did not open in the temporary SPX tab.");

          stage = "populate Batch Search textarea";
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
          if (setter) setter.call(textarea, tns.join("\n")); else textarea.value = tns.join("\n");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          textarea.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(250);
          if (!String(textarea.value || "").trim()) throw new Error("TN list did not remain in the Batch Search textarea after input events.");

          stage = "locate Submit button";
          let submitButton = null;
          for (let ancestor = textarea.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            submitButton = [...ancestor.querySelectorAll("button,[role='button'],.ssc-button,[class*=\'ssc-button\']")]
              .find(el => exactAction(el, "submit")) || null;
            if (submitButton) break;
          }
          if (!submitButton) submitButton = findActionControl("submit");
          if (!submitButton) throw new Error("Could not locate the visible Submit button for Batch Search.");

          const getPage = () => [...document.querySelectorAll("table tbody tr")].flatMap(tr => {
            const cells = [...tr.querySelectorAll("td")];
            const spxTN = String(cells[1]?.innerText || "").trim();
            const slsTN = String(cells[2]?.innerText || "").trim();
            const thirdTN = String(cells[3]?.innerText || "").trim();
            // Header-based status lookup when headers exist; observed SPX grid fallback is cell 51.
            const table = tr.closest("table");
            const headers = [...(table?.querySelectorAll("thead th") || [])].map(th => String(th.innerText || "").trim().toUpperCase());
            let statusIndex = headers.findIndex(h => /ORDER STATUS|PARCEL STATUS/.test(h));
            if (statusIndex < 0 || statusIndex >= cells.length) statusIndex = 51;
            const status = String(cells[statusIndex]?.innerText || "").trim();
            const identifiers = [spxTN, slsTN, thirdTN].filter(v => v && v !== "-");
            const matches = [...new Set(identifiers.filter(v => wanted.has(clean(v))))];
            return matches.map(matchedTN => ({ tn: matchedTN, matchedTN, spxTN, slsTN, thirdTN, status }));
          }).filter(r => r.matchedTN && r.status && r.status !== "-" && r.status.toUpperCase() !== "VIEW");
          const signature = () => [...document.querySelectorAll("table tbody tr")]
            .map(tr => String(tr.innerText || "").replace(/\s+/g, " ").trim()).join("\n");
          const before = signature();
          const started = Date.now();
          stage = "submit Batch Search and wait for results";
          submitButton.click();
          let lastSig = before, stableSince = Date.now(), latestRows = [];
          const deadline = Date.now() + 45000;
          while (Date.now() < deadline) {
            await sleep(350);
            const sig = signature();
            if (sig !== lastSig) { lastSig = sig; stableSince = Date.now(); }
            latestRows = getPage();
            const hadFreshResults = latestRows.length > 0 || (sig !== before && Date.now() - started > 1800);
            if (Date.now() - started >= 2200 && hadFreshResults && Date.now() - stableSince >= 1200) break;
          }
          if (Date.now() >= deadline) throw new Error("Timed out after 45 seconds waiting for the result table to refresh after Submit.");

          stage = "read current results page";
          const output = new Map();
          const addCurrentPage = () => {
            for (const item of getPage()) output.set(clean(item.matchedTN || item.tn), item);
          };
          addCurrentPage();
          for (let page = 0; page < 400; page++) {
            const candidates = [
              document.querySelector(".el-pagination button.btn-next"),
              document.querySelector(".el-pagination .btn-next"),
              document.querySelector(".ant-pagination-next"),
              document.querySelector("button[aria-label='Next page']"),
              document.querySelector("[aria-label='Next page']")
            ].filter(Boolean);
            const next = candidates.find(el => visible(el));
            if (!next) break;
            const disabled = next.disabled || next.getAttribute("aria-disabled") === "true" || /disabled/.test(String(next.className || "")) || next.closest("li")?.classList?.contains("disabled");
            if (disabled) break;
            stage = `paginate results page ${page + 2}`;
            const beforePage = signature();
            next.click();
            let changed = false;
            for (let wait = 0; wait < 40; wait++) {
              await sleep(250);
              if (signature() !== beforePage) { changed = true; break; }
            }
            if (!changed) break;
            addCurrentPage();
          }
          return { results: [...output.values()], requestedCount: tns.length, capturedAt: new Date().toISOString(), diagnostics: diagnostics() };
        } catch (error) {
          return {
            __spxBatchSearchError: true,
            stage,
            error: String(error?.message || error),
            stack: String(error?.stack || "").slice(0, 1200),
            diagnostics: diagnostics()
          };
        }
      }
    });
  } catch (error) {
    throw new Error(`Chrome could not execute the SPX Batch Search script: ${error?.message || error}`);
  }

  const result = injectionResults?.[0]?.result;
  if (!injectionResults?.length) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    throw new Error(`Chrome injected no result frame. SPX tab URL: ${tab?.url || "unknown"}; status: ${tab?.status || "unknown"}.`);
  }
  if (!result) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    throw new Error(`The SPX script returned no value (frame ${injectionResults[0]?.frameId ?? "unknown"}). Tab URL: ${tab?.url || "unknown"}; status: ${tab?.status || "unknown"}. Check the SPX tab console for a script exception.`);
  }
  if (result.__spxBatchSearchError) {
    const d = result.diagnostics || {};
    const candidates = d.batchSearchCandidates?.length ? JSON.stringify(d.batchSearchCandidates).slice(0, 800) : "none detected";
    const details = `Stage: ${result.stage}. ${result.error}. Batch Search text candidates: ${candidates}. URL: ${d.url || "unknown"}; page: ${d.title || "unknown"}; readyState: ${d.readyState || "unknown"}; visible textarea(s): ${(d.visibleTextareas || []).join(" | ") || "none"}; visible buttons: ${(d.visibleButtons || []).join(" | ") || "none"}; tables: ${(d.tables || []).map(t => `#${t.index} ${t.rows} row(s)`).join(", ") || "none"}.`;
    throw new Error(details.slice(0, 2500));
  }
  return result;
}

async function runDeliveringReconcileJob(job) {
  let tabId = null;
  const allResults = new Map();
  const failedTNSet = new Set();
  const failedBatchErrors = [];
  const tns = [...new Set((job.trackingNumbers || []).map(v => String(v || "").trim()).filter(Boolean))];
  const batchSize = 3000;
  try {
    if (!tns.length) throw new Error("NOL3 sent no Delivering TNs to reconcile.");
    job.startedAt = Date.now();
    sendToBadoc("BADOC_SPX_DELIVERING_RECONCILE_PROGRESS", { message: `Opening SPX Batch Search for ${tns.length.toLocaleString()} Delivering TNs…` });
    tabId = await createDedicatedSpxTab();
    job.spxTabId = tabId;
    await ensureParcelOrderTrackingRoute(tabId);

    const batches = [];
    for (let i = 0; i < tns.length; i += batchSize) batches.push(tns.slice(i, i + batchSize));
    for (let i = 0; i < batches.length; i++) {
      if (job.cancelled) throw new Error("Reconciliation was cancelled.");
      const batch = batches[i];
      sendToBadoc("BADOC_SPX_DELIVERING_RECONCILE_PROGRESS", {
        message: `SPX Batch Search: batch ${i + 1}/${batches.length} (${batch.length.toLocaleString()} TNs)…`
      });
      try {
        const response = await executeSpxBatchSearch(tabId, batch);
        for (const item of (response.results || [])) {
          const key = String(item.matchedTN || item.tn || "").trim().toUpperCase().replace(/\s+/g, "");
          if (key && batch.some(tn => String(tn).trim().toUpperCase().replace(/\s+/g, "") === key)) {
            allResults.set(key, {
              tn: String(item.matchedTN || item.tn).trim(),
              spxTN: String(item.spxTN || "").trim(),
              slsTN: String(item.slsTN || "").trim(),
              thirdTN: String(item.thirdTN || "").trim(),
              status: String(item.status || "").trim()
            });
          }
        }
        const missing = batch.filter(tn => !allResults.has(String(tn).trim().toUpperCase().replace(/\s+/g, ""))).length;
        sendToBadoc("BADOC_SPX_DELIVERING_RECONCILE_PROGRESS", {
          message: `Batch ${i + 1}/${batches.length} complete · ${response.results?.length || 0} result(s) read${missing ? ` · ${missing} TN(s) not returned` : ""}.`
        });
      } catch (error) {
        batch.forEach(tn => failedTNSet.add(String(tn).trim().toUpperCase().replace(/\s+/g, "")));
        console.error("SPX Batch Search batch failed:", error);
        failedBatchErrors.push(String(error?.message || error));
        sendToBadoc("BADOC_SPX_DELIVERING_RECONCILE_PROGRESS", {
          message: `Batch ${i + 1}/${batches.length} failed; those TNs will remain unchanged. ${error?.message || error}`
        });
      }
    }
    sendToBadoc("BADOC_SPX_DELIVERING_RECONCILE_RESULTS", {
      results: [...allResults.values()],
      requestedCount: tns.length,
      returnedCount: allResults.size,
      failedTNCount: failedTNSet.size,
      failedTNs: [...failedTNSet],
      failedBatchErrors
    });
  } catch (error) {
    console.error("SPX Batch Search Delivering reconciliation failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", {
      message: error?.message || String(error),
      kind: "delivering-reconcile"
    });
  } finally {
    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
    activeJob = null;
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
      throw new Error("The completed SPX task does not match the expected Delivering / Delivered / On-Hold export.");
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
      fileName: csv.fileName || "export_forward_order_delivery.csv",
      csvText: csv.text
    });
  } catch (error) {
    console.error("BADOC SPX direct Parcel delivery sync failed:", error);
    sendToBadoc("BADOC_SPX_ERROR", {
      message: error?.message || String(error),
      kind: "parcel-delivery"
    });
  } finally {
    activeJob = null;
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
    activeJob = null;
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
    activeJob = null;
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

async function waitForCompletion(taskId, startSec, job) {
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

    await sleep(POLL_MS);
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

    const completed = await waitForCompletion(taskId, waitStartSec, job);

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
    activeJob = null;
  }
}

function isBadocPageUrl(url) {
  const u = String(url || "");
  return u.startsWith("file://") ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(u) ||
    /^https:\/\/(?:[^./]+\.)+github\.io(?::\d+)?\//i.test(u);
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
    console.warn("SPX BRIDGE rejected BADOC page origin:", senderUrl);
    try { port.disconnect(); } catch {}
    return;
  }

  badocPorts.add(port);
  sendToPort(port, "BADOC_BRIDGE_READY", { version: VERSION });

  port.onMessage.addListener(message => {
    const type = message?.type;
    const failBusy = (kind, text = "A BADOC SPX sync is already running.") =>
      sendToPort(port, "BADOC_SPX_ERROR", { message: text, ...(kind ? { kind } : {}) });

    if (type === "BADOC_START_PARCEL_SECONDARY_SYNC") {
      if (activeJob) { failBusy("parcel-secondary"); return; }
      activeJob = { kind: "parcel-secondary", ownerPort: port, startedAt: 0, spxTabId: null, cancelled: false };
      void runParcelSecondaryJob(activeJob);
      return;
    }

    if (type === "BADOC_START_RECEIVED_CHECKING_INBOUND_SYNC") {
      if (activeJob) { failBusy("parcel-inbound"); return; }
      activeJob = {
        kind: "parcel-inbound", ownerPort: port, receivedChecking: true,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runParcelInboundJob(activeJob);
      return;
    }

    if (type === "BADOC_START_RIDER_SYNC") {
      if (activeJob) { failBusy("riders"); return; }
      activeJob = {
        kind: "riders", ownerPort: port,
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runRiderJob(activeJob);
      return;
    }

    if (type === "BADOC_START_LINEHAUL_SYNC") {
      if (activeJob) { failBusy("linehaul"); return; }
      activeJob = {
        kind: "linehaul", ownerPort: port,
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runJob(activeJob);
      return;
    }

    if (type === "BADOC_START_DELIVERING_RECONCILE") {
      if (activeJob) { failBusy("delivering-reconcile", "Another SPX Bridge job is already running."); return; }
      const trackingNumbers = [...new Set((Array.isArray(message.trackingNumbers) ? message.trackingNumbers : [])
        .map(v => String(v || "").trim()).filter(Boolean))];
      if (!trackingNumbers.length) {
        sendToPort(port, "BADOC_SPX_ERROR", {
          message: "No Delivering tracking numbers were received from NOL3.",
          kind: "delivering-reconcile"
        });
        return;
      }
      activeJob = {
        kind: "delivering-reconcile", ownerPort: port, trackingNumbers,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runDeliveringReconcileJob(activeJob);
      return;
    }

    if (type === "BADOC_START_PARCEL_DELIVERY_SYNC") {
      if (activeJob) { failBusy("parcel-delivery"); return; }
      activeJob = {
        kind: "parcel-delivery", ownerPort: port,
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
        createdEndUnix: message?.createdEndUnix,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runParcelDeliveryJob(activeJob);
      return;
    }

    if (type === "BADOC_START_PARCEL_INBOUND_SYNC") {
      if (activeJob) { failBusy("parcel-inbound"); return; }
      activeJob = {
        kind: "parcel-inbound", ownerPort: port,
        hubName: String(message?.hubName || "").trim(),
        hubCode: String(message?.hubCode || "").trim(),
        hubId: Number(message?.hubId || 0) || 0,
        startedAt: 0, spxTabId: null, cancelled: false
      };
      void runParcelInboundJob(activeJob);
      return;
    }

    if (type === "BADOC_ABORT_SYNC" && activeJob?.ownerPort === port) {
      activeJob.cancelled = true;
    }
  });

  port.onDisconnect.addListener(() => {
    badocPorts.delete(port);
    if (activeJob?.ownerPort === port) activeJob.cancelled = true;
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
    active: Boolean(activeJob)
  });
});
