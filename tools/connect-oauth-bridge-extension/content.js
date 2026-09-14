(() => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const state = params.get("state");
  if (!state || (!params.has("code") && !params.has("error"))) return;
  chrome.runtime.sendMessage({ type: "CONNECT_CALLBACK", state, code: params.get("code"), error: params.get("error") }).catch(() => {});
})();
