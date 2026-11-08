
(() => {
  // chrome.scripting.executeScript may re-run this file in an already-open
  // SPX tab. Keep exactly one message listener in the isolated world.
  if (window.__POOD_CHECKER_CONTENT_INSTALLED__) return;
  window.__POOD_CHECKER_CONTENT_INSTALLED__ = true;
  const pending = new Map();
  let seq = 1;
  window.addEventListener("message", event => {
    if (event.source !== window || !event.data || event.data.source !== "POOD_CHECKER_PAGE_BRIDGE") return;
    const data = event.data;
    if (data.requestId && pending.has(data.requestId)) {
      const callback = pending.get(data.requestId);
      pending.delete(data.requestId);
      callback(data.payload);
    }
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== "pood-page") return false;
    const requestId = `ext-${Date.now()}-${seq++}`;
    const timer = setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        sendResponse({ok:false,error:"No response from the SPX page. Reload the SPX tab and try again."});
      }
    }, msg.command === "WAIT_FMS_READY" ? 32000 : (msg.command === "REPLAY" ? 30000 : 5000));
    pending.set(requestId, payload => {
      clearTimeout(timer);
      sendResponse(payload);
    });
    window.postMessage({
      source:"POOD_CHECKER_EXTENSION", requestId, command:msg.command, data:msg.data || {}
    }, location.origin);
    return true;
  });
})();
