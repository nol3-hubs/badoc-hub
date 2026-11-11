(() => {
  // Prefer Firefox's Promise-based WebExtensions namespace, with Chrome fallback.
  const extApi = globalThis.browser || globalThis.chrome;
  if (!extApi?.runtime?.connect) return;

  // One unified extension serves the host BADOC HUB app and its isolated Received Checking iframe.
  // Connect only when an explicit app marker is present; never connect from the temporary SPX tab.
  const receivedCheckingMarker = document.querySelector('meta[name="badoc-received-checking"]');
  const mainBadocMarker = document.querySelector('meta[name="badoc-main-app"]');
  const isReceivedChecking = !!(receivedCheckingMarker && String(receivedCheckingMarker.content || '').trim());
  // The main app marker changes with dashboard releases (for example v70-*).
  // Accept the explicit marker regardless of its app build suffix/version.
  const isBadocGithubPagesApp = (() => {
    try {
      const url = new URL(location.href);
      return url.hostname === "nol3-hubs.github.io" &&
        /^\/badoc-hub(?:\/|$)/i.test(url.pathname);
    } catch (_) { return false; }
  })();
  // This content script is only injected on the explicitly permitted
  // nol3-hubs.github.io host from manifest.json. Do not require a DOM marker:
  // Firefox can run document_idle before the dashboard finishes rendering.
  const isMainBadocApp = isBadocGithubPagesApp ||
    (!!(mainBadocMarker && String(mainBadocMarker.content || '').trim())) ||
    !!document.getElementById('badocSpxBridgeInstallModal') ||
    !!document.getElementById('receivedCheckingFrame');
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
  const VERSION = "1"; // Dashboard bridge protocol version; do not use the add-on package version here.
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
      port = extApi.runtime.connect({ name: "BADOC_PAGE" });
      port.onMessage.addListener(msg => emit(msg.type, msg));
      port.onDisconnect.addListener(() => {
        const reason = extApi.runtime.lastError?.message || "Bridge connection closed.";
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
        extApi.runtime.sendMessage({ type: "BADOC_OPEN_EXTENSIONS" })
          .then(response => {
            if (!response?.ok) {
              emit("BADOC_SPX_ERROR", { message: response?.message || "Could not open Firefox Add-ons." });
              return;
            }
            emit("BADOC_EXTENSIONS_OPENED", {});
          })
          .catch(error => emit("BADOC_SPX_ERROR", { message: error?.message || String(error) }));
      } catch (error) { emit("BADOC_SPX_ERROR", { message: error?.message || String(error) }); }
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
          if (method === "storage.local.get") result = await extApi.storage.local.get(args[0]);
          else if (method === "storage.local.set") result = await extApi.storage.local.set(args[0] || {});
          else if (method === "storage.local.remove") result = await extApi.storage.local.remove(args[0]);
          else if (method === "runtime.sendMessage") result = await extApi.runtime.sendMessage(args[0] || {});
          else if (method === "tabs.query" || method === "tabs.sendMessage" || method === "scripting.discoverWorksheetGids") {
            result = await extApi.runtime.sendMessage({ target: "POD_CHECKER_RPC", method, args });
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
      // extApi.tabs, extApi.storage, and extApi.scripting inside the iframe.
      emit("BADOC_POD_CHECKER_URL", {
        url: extApi.runtime.getURL("pod-checker/app.html"),
        checkerVersion: "1.5.47"
      });
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
      "BADOC_ABORT_SYNC",
      "BADOC_LOOKUP_RECIPIENT_NAMES"
    ]);
    if (!supported.has(data.type)) return;
    if (!port) {
      const errorKind = data.type === "BADOC_LOOKUP_RECIPIENT_NAMES" ? "recipient-names" :
        data.type === "BADOC_START_DELIVERING_RECONCILE" ? "delivering-reconcile" :
        data.type === "BADOC_START_PARCEL_SECONDARY_SYNC" ? "parcel-secondary" :
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
      if (data.type === "BADOC_LOOKUP_RECIPIENT_NAMES") {
        payload.shipmentIds = Array.isArray(data.shipmentIds)
          ? [...new Set(data.shipmentIds.map(v => String(v || "").trim()).filter(v => /^[A-Za-z0-9_-]{6,80}$/.test(v)))].slice(0, 2000)
          : [];
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
