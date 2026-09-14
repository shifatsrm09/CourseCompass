export function receiveConnectToken(state) {
  return new Promise((resolve, reject) => {
    const channel = "course-compass-connect";
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
    const receive = event => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== channel || event.data.type !== "TOKEN_RESULT" || event.data.state !== state) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (typeof event.data.accessToken === "string" && event.data.accessToken) resolve(event.data.accessToken);
      else reject(new Error("The Connect extension did not return an access token."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The Connect extension did not respond. Reload the extension and sign in again."));
    }, 15000);
    window.addEventListener("message", receive);
    window.postMessage({ channel, type: "REQUEST_TOKEN", state }, window.location.origin);
  });
}
