(() => {
  // One unified extension serves the host BADOC HUB app and its isolated Received Checking iframe.
  // Connect only when an explicit app marker is present; never connect from the temporary SPX tab.
  const isReceivedChecking = !!document.querySelector('meta[name="badoc-received-checking"][content="v69"]');
  const isMainBadocApp = !!document.querySelector('meta[name="badoc-main-app"][content="v69"]') ||
    !!document.getElementById('badocSpxBridgeInstallModal') || !!document.getElementById('receivedCheckingFrame');
  if (!isReceivedChecking && !isMainBadocApp) return;

  // about:srcdoc frames inherit their parent origin; validate that the source is an allowed BADOC host.
  let bridgeContextUrl = location.href;
  if (location.protocol === "about:") {
    try { bridgeContextUrl = document.referrer || window.parent.location.href || location.href; }
    catch (_) { bridgeContextUrl = document.referrer || location.href; }
  }
  const isAllowedHost =
    bridgeContextUrl.startsWith("file:") ||
    /^(https?:)\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(bridgeContextUrl) ||
    /^(https:)\/\/(?:[^./]+\.)+github\.io(?::\d+)?\//i.test(bridgeContextUrl);
  if (!isAllowedHost) return;
  if (window.__badocSpxBridgeUnifiedV69) return;
  window.__badocSpxBridgeUnifiedV69 = true;

  const PAGE_SOURCE = "BADOC_SPX_BRIDGE";
  const BADOC_SOURCE = "BADOC_PAGE";
  const VERSION = "69";
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
      port.onMessage.addListener(msg => emit(msg.type, msg));
      port.onDisconnect.addListener(() => {
        const reason = chrome.runtime.lastError?.message || "Bridge connection closed.";
        port = null;
        emit("BADOC_BRIDGE_DISCONNECTED", { message: reason });
        scheduleReconnect();
      });
      emit("BADOC_BRIDGE_READY", { version: VERSION });
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
      emit("BADOC_BRIDGE_READY", { version: VERSION });
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

    const supported = new Set([
      "BADOC_START_LINEHAUL_SYNC",
      "BADOC_START_DELIVERING_RECONCILE",
      "BADOC_START_PARCEL_DELIVERY_SYNC",
      "BADOC_START_RIDER_SYNC",
      "BADOC_START_PARCEL_INBOUND_SYNC",
      "BADOC_START_RECEIVED_CHECKING_INBOUND_SYNC",
      "BADOC_START_PARCEL_SECONDARY_SYNC",
      "BADOC_ABORT_SYNC"
    ]);
    if (!supported.has(data.type)) return;
    if (!port) {
      emit("BADOC_SPX_ERROR", {
        message: "SPX BRIDGE v69 is not connected. Reload the extension and refresh BADOC HUB.",
        kind: data.type === "BADOC_START_PARCEL_SECONDARY_SYNC" ? "parcel-secondary" : data.type === "BADOC_START_PARCEL_DELIVERY_SYNC" ? "parcel-delivery" : "parcel-inbound"
      });
      return;
    }
    try {
      const payload = { type: data.type };
      if (data.type === "BADOC_START_DELIVERING_RECONCILE") payload.trackingNumbers = Array.isArray(data.trackingNumbers) ? data.trackingNumbers.map(v => String(v || "").trim()).filter(Boolean) : [];
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
