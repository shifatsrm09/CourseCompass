// Course Compass — Connect OAuth Bridge (personal-use dev tool)
//
// connect.bracu.ac.bd is the only redirect_uri Keycloak's "slm" client
// currently accepts, and response_mode=fragment means the auth code lands
// in the URL hash — a place only a script running ON that page can read
// (our own app's JS can never see it, since it's a different origin).
//
// This runs at document_start, before Connect's own page finishes loading,
// grabs `code`/`state` out of the hash, and immediately redirects the tab
// to your local app with the same hash — which App.js already knows how to
// read and exchange via POST /api/auth/connect/exchange.
//
// This only fires when `code=` is actually present in the hash, so it's
// inert on every other connect.bracu.ac.bd page you might visit normally.

(function () {
  // Change this if your app isn't running on the default local dev port.
  const APP_URL = "http://localhost:3000";

  const rawHash = window.location.hash;
  if (!rawHash || !rawHash.includes("code=")) return;

  const params = new URLSearchParams(rawHash.replace(/^#/, ""));
  const code = params.get("code");
  const state = params.get("state");
  if (!code) return;

  const target = new URL(APP_URL);
  target.hash = `code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || "")}`;

  window.location.replace(target.toString());
})();
