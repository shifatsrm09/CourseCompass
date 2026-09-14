(() => {
  const channel = "course-compass-connect";
  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[href]");
    if (!event.isTrusted || !link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    const allowedApiOrigin = window.location.origin === "http://localhost:3000"
      ? ["http://localhost:3000", "http://localhost:5000"]
      : [window.location.origin];
    if (!allowedApiOrigin.includes(url.origin) || url.pathname !== "/api/auth/connect/start") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    chrome.runtime.sendMessage({ type: "CONNECT_START" }).then(result => {
      if (result?.error) window.alert(result.error);
    }).catch(() => window.alert("Reload the Course Compass extension and this page, then try again."));
  }, true);
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== channel || event.data.type !== "REQUEST_TOKEN" || typeof event.data.state !== "string") return;
    const state = event.data.state;
    chrome.runtime.sendMessage({ type: "CONNECT_DELIVER", state }).then(result => {
      window.postMessage({ channel, type: "TOKEN_RESULT", state, ...result }, window.location.origin);
    }).catch(() => {
      window.postMessage({ channel, type: "TOKEN_RESULT", state, error: "The Connect extension is unavailable. Reload it and sign in again." }, window.location.origin);
    });
  });
})();
