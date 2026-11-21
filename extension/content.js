(() => {
  // One unified extension serves the host BADOC HUB app and its isolated Received Checking iframe.
  // Connect only when an explicit app marker is present; never connect from the temporary SPX tab.
  const receivedCheckingMarker = document.querySelector('meta[name="badoc-received-checking"]');
  const mainBadocMarker = document.querySelector('meta[name="badoc-main-app"]');
  const isReceivedChecking = !!(receivedCheckingMarker && String(receivedCheckingMarker.content || '').trim());
  // The main app marker changes with dashboard releases (for example v70-*).
  // Accept the explicit marker regardless of its app build suffix/version.
  const isMainBadocApp = !!(mainBadocMarker && String(mainBadocMarker.content || '').trim()) ||
    !!document.getElementById('badocSpxBridgeInstallModal') || !!document.getElementById('receivedCheckingFrame');
  if (!isReceivedChecking && !isMainBadocApp) return;

  // about:srcdoc frames inherit their parent origin; validate that the source is an allowed BADOC host.
  let bridgeContextUrl = location.href;
  if (location.protocol === "about:") {
    try { bridgeContextUrl = document.referrer || window.parent.location.href || location.href; }
    catch (_) { bridgeContextUrl = document.referrer || location.href; }
  }
  function isGithubPagesHost(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && (url.hostname === 'github.io' || url.hostname.endsWith('.github.io'));
    } catch (_) { return false; }
  }
  const isAllowedHost =
    bridgeContextUrl.startsWith("file:") ||
    /^(https?:)\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(bridgeContextUrl) ||
    isGithubPagesHost(bridgeContextUrl);
  if (!isAllowedHost) return;
  if (window.__badocSpxBridgeUnifiedV1) return;
  window.__badocSpxBridgeUnifiedV1 = true;

  const PAGE_SOURCE = "BADOC_SPX_BRIDGE";
  const BADOC_SOURCE = "BADOC_PAGE";
  const VERSION = "1";
  const PACKAGE_VERSION = chrome.runtime.getManifest().version;
  let port = null;
  let reconnectTimer = null;
  let shuttingDown = false;

  const emit = (type, data = {}) => window.postMessage({ source: PAGE_SOURCE, type, ...data }, "*");
  const scheduleReconnect = () => {
    if (shuttingDown || reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 750);
  };

  function connect() {
    if (shuttingDown || port) return;
    try {
      port = chrome.runtime.connect({ name: "BADOC_PAGE" });
      port.onMessage.addListener(msg => {
        if (msg?.type === "BADOC_BRIDGE_READY") emit("BADOC_BRIDGE_READY", { version: VERSION, packageVersion: PACKAGE_VERSION });
        else emit(msg.type, msg);
      });
      port.onDisconnect.addListener(() => {
        const reason = chrome.runtime.lastError?.message || "Bridge connection closed.";
        port = null;
        emit("BADOC_BRIDGE_DISCONNECTED", { message: reason });
        scheduleReconnect();
      });
    } catch (error) {
      port = null;
      emit("BADOC_BRIDGE_DISCONNECTED", { message: error?.message || String(error) });
      scheduleReconnect();
    }
  }

  window.addEventListener("message", event => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== BADOC_SOURCE) return;

    if (data.type === "BADOC_BRIDGE_HELLO") {
      if (port) emit("BADOC_BRIDGE_READY", { version: VERSION, packageVersion: PACKAGE_VERSION, connected: true });
      else {
        emit("BADOC_BRIDGE_READY", { version: VERSION, packageVersion: PACKAGE_VERSION, connected: false });
        emit("BADOC_BRIDGE_DISCONNECTED", { message: "Extension version detected; background service is reconnecting…" });
        scheduleReconnect();
      }
      return;
    }

    if (data.type === "BADOC_OPEN_EXTENSIONS") {
      try {
        chrome.runtime.sendMessage({ type: "BADOC_OPEN_EXTENSIONS" }, response => {
          if (chrome.runtime.lastError || !response?.ok) {
            emit("BADOC_SPX_ERROR", { message: chrome.runtime.lastError?.message || response?.message || "Could not open Chrome Extensions." });
            return;
          }
          emit("BADOC_EXTENSIONS_OPENED", {});
        });
      } catch (error) { emit("BADOC_SPX_ERROR", { message: error?.message || String(error) }); }
      return;
    }


    if (data.type === "BADOC_LOOKUP_PICKUP_INFO") {
      const reqId = String(data.reqId || "");
      const orderId = String(data.orderId || "").trim();
      const reply = (ok, item, error) => emit("BADOC_PICKUP_INFO_RESULT", { reqId, ok, item: item || null, error: error || "" });
      if (!/^[A-Za-z0-9_-]{6,48}$/.test(orderId)) {
        reply(false, null, "Invalid Order ID.");
        return;
      }
      try {
        chrome.runtime.sendMessage({ target: "BADOC_PICKUP_LOOKUP", orderId }, response => {
          const lastError = chrome.runtime.lastError;
          if (lastError) reply(false, null, lastError.message || "Pickup Info request failed.");
          else if (!response || !response.ok) reply(false, null, response?.error || "SPX Pickup Info could not be loaded.");
          else reply(true, response.item, "");
        });
      } catch (error) {
        reply(false, null, error?.message || String(error));
      }
      return;
    }

    if (data.type === "BADOC_POD_RPC") {
      const rpcId = String(data.rpcId || "");
      const method = String(data.method || "");
      const args = Array.isArray(data.args) ? data.args : [];
      const reply = (ok, result, error) => emit("BADOC_POD_RPC_RESULT", { rpcId, ok, result, error });
      (async () => {
        try {
          let result;
          if (method === "storage.local.get") result = await chrome.storage.local.get(args[0]);
          else if (method === "storage.local.set") result = await chrome.storage.local.set(args[0] || {});
          else if (method === "storage.local.remove") result = await chrome.storage.local.remove(args[0]);
          else if (method === "runtime.sendMessage") result = await chrome.runtime.sendMessage(args[0] || {});
          else if (method === "tabs.query" || method === "tabs.sendMessage" || method === "scripting.discoverWorksheetGids") {
            result = await chrome.runtime.sendMessage({ target: "POD_CHECKER_RPC", method, args });
            if (!result?.ok) throw new Error(result?.error || "Extension request failed.");
            result = result.result;
          } else {
            throw new Error(`Unsupported POD Checker bridge method: ${method}`);
          }
          reply(true, result, "");
        } catch (error) {
          reply(false, null, error?.message || String(error));
        }
      })();
      return;
    }

    if (data.type === "BADOC_GET_POD_CHECKER_URL") {
      // Serve the checker from this extension's own origin so it can use
      // chrome.tabs, chrome.storage, and chrome.scripting inside the iframe.
      emit("BADOC_POD_CHECKER_URL", {
        url: chrome.runtime.getURL("pod-checker/app.html"),
        checkerVersion: "1.5.57"
      });
      return;
    }

    const supported = new Set([
      "BADOC_START_LINEHAUL_SYNC",
      "BADOC_START_PARCEL_DELIVERY_SYNC",
      "BADOC_START_RIDER_SYNC",
      "BADOC_START_PARCEL_INBOUND_SYNC",
      "BADOC_START_ASSIGNED_ONHOLD_TODAY",
      "BADOC_START_POD_CHECKER_ASSIGNED_TODAY",
      "BADOC_START_POD_CHECKER_ONHOLD",
      "BADOC_START_RECEIVED_CHECKING_INBOUND_SYNC",
      "BADOC_START_PARCEL_SECONDARY_SYNC",
      "BADOC_START_FIRST_MILE_ORDERS_SYNC",
      "BADOC_START_FIRST_MILE_TASKS_SYNC",
      "BADOC_LOOKUP_PICKUP_INFO",
      "BADOC_ABORT_SYNC",    ]);
    if (!supported.has(data.type)) return;
    if (!port) {
      if (data.type === "BADOC_START_POD_CHECKER_ASSIGNED_TODAY" || data.type === "BADOC_START_POD_CHECKER_ONHOLD") {
        const isOnHold = data.type === "BADOC_START_POD_CHECKER_ONHOLD";
        emit(isOnHold ? "BADOC_POD_CHECKER_ONHOLD_ERROR" : "BADOC_POD_CHECKER_ASSIGNED_ERROR", {
          requestId: String(data.requestId || ""),
          message: "Badoc Hub Extension background connection is unavailable. Reload the extension and refresh BADOC HUB."
        });
        return;
      }
      const errorKind =         data.type === "BADOC_START_PARCEL_SECONDARY_SYNC" ? "parcel-secondary" :
        data.type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" ? "first-mile-orders" :
        data.type === "BADOC_START_FIRST_MILE_TASKS_SYNC" ? "first-mile-tasks" :
        data.type === "BADOC_START_PARCEL_DELIVERY_SYNC" ? "parcel-delivery" :
        data.type === "BADOC_START_LINEHAUL_SYNC" ? "linehaul" :
        data.type === "BADOC_START_RIDER_SYNC" ? "rider" : "parcel-inbound";
      emit("BADOC_SPX_ERROR", {
        message: "Badoc Hub Extesion v1 is not connected. Reload the extension and refresh BADOC HUB.",
        kind: errorKind
      });
      return;
    }
    try {
      const payload = { type: data.type };
      if (data.type === "BADOC_LOOKUP_PICKUP_INFO") { payload.reqId=String(data.reqId||""); payload.orderId=String(data.orderId||"").trim(); }
      if (data.type === "BADOC_START_POD_CHECKER_ASSIGNED_TODAY" || data.type === "BADOC_START_POD_CHECKER_ONHOLD") payload.requestId=String(data.requestId||"");
      if (data.type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" || data.type === "BADOC_START_FIRST_MILE_TASKS_SYNC") {
        if (data.selectedDate !== undefined) payload.selectedDate = String(data.selectedDate || "");
      }
      if (data.type === "BADOC_START_RIDER_SYNC") {
        payload.hubId = Number(data.hubId || 0) || 0;
        payload.hubName = String(data.hubName || "").trim();
        payload.hubCode = String(data.hubCode || "").trim();
      }
      if (data.type === "BADOC_START_LINEHAUL_SYNC" || data.type === "BADOC_START_PARCEL_INBOUND_SYNC" || data.type === "BADOC_START_PARCEL_DELIVERY_SYNC") {
        for (const key of ["hubId","hubName","hubCode","trackingStatus","bulkyType","assignedStartUnix","assignedEndUnix","assignedStart","assignedEnd","assignedLabel","createdEndUnix"]) {
          if (data[key] !== undefined) payload[key] = data[key];
        }
      }
      port.postMessage(payload);
      if (data.type === "BADOC_START_ASSIGNED_ONHOLD_TODAY") {
        emit("BADOC_SPX_COMMAND_FORWARDED", {
          kind: "assigned-onhold-today",
          message: "Assigned Today command forwarded to the extension background."
        });
      }
      if (data.type === "BADOC_START_PARCEL_INBOUND_SYNC") {
        emit("BADOC_SPX_COMMAND_FORWARDED", {
          kind: "parcel-inbound",
          message: "Received sync command forwarded to the extension background."
        });
      } else if (data.type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" || data.type === "BADOC_START_FIRST_MILE_TASKS_SYNC") {
        emit("BADOC_SPX_COMMAND_FORWARDED", {
          kind: data.type === "BADOC_START_FIRST_MILE_ORDERS_SYNC" ? "first-mile-orders" : "first-mile-tasks",
          message: "First Mile command forwarded to the extension background."
        });
      }
    } catch (error) {
      emit("BADOC_SPX_ERROR", { message: error?.message || String(error) });
    }
  });

  window.addEventListener("beforeunload", () => {
    shuttingDown = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try { port?.disconnect(); } catch {}
  });
  connect();
})();
