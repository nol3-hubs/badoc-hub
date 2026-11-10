(() => {
  // Re-injection is expected when the background worker repairs an already-open
  // SPX tab. Remove the previous listeners first so extension reloads cannot
  // leave a stale isolated-world receiver behind.
  const INSTALL_KEY = "__POOD_CHECKER_CONTENT_RUNTIME_V19__";
  const previous = window[INSTALL_KEY];
  if (previous) {
    try { window.removeEventListener("message", previous.onWindowMessage); } catch (_) {}
    try { chrome.runtime.onMessage.removeListener(previous.onRuntimeMessage); } catch (_) {}
    try {
      for (const item of previous.pending?.values?.() || []) clearTimeout(item.timer);
    } catch (_) {}
  }

  const pending = new Map();
  let seq = 1;

  function onWindowMessage(event) {
    if (event.source !== window || event.origin !== location.origin || !event.data ||
        event.data.source !== "POOD_CHECKER_PAGE_BRIDGE_V19") return;
    const data = event.data;
    if (!data.requestId || !pending.has(data.requestId)) return;
    const item = pending.get(data.requestId);
    item.finish(data.payload);
  }

  function onRuntimeMessage(msg, sender, sendResponse) {
    if (!msg || msg.target !== "pood-page-v19") return false;

    const requestId = `ext-${Date.now()}-${seq++}`;
    let settled = false;
    const finish = payload => {
      if (settled) return;
      settled = true;
      const item = pending.get(requestId);
      if (item) clearTimeout(item.timer);
      pending.delete(requestId);
      try { sendResponse(payload); } catch (_) {}
    };

    const timeoutMs = msg.command === "PING" ? 2500 :
      msg.command === "WAIT_FMS_READY" ? 32000 :
      msg.command === "REPLAY" ? 30000 : 5000;
    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: msg.command === "PING"
          ? "The SPX page bridge did not return its readiness response within 2.5 seconds. The extension will attempt to reconnect."
          : `The SPX POD page bridge did not answer ${String(msg.command || "the request")} within ${Math.round(timeoutMs / 1000)} seconds.`
      });
    }, timeoutMs);

    pending.set(requestId, { timer, finish });
    try {
      window.postMessage({
        source: "POOD_CHECKER_EXTENSION_V19",
        requestId,
        command: msg.command,
        data: msg.data || {}
      }, location.origin);
    } catch (error) {
      finish({ ok: false, error: error?.message || String(error) });
    }
    return true;
  }

  window.addEventListener("message", onWindowMessage);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  window[INSTALL_KEY] = { onWindowMessage, onRuntimeMessage, pending };
})();
