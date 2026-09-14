const SSO = "https://sso.bracu.ac.bd/realms/bracu/protocol/openid-connect";
const REDIRECT = "https://connect.bracu.ac.bd/";
const APP_ORIGINS = new Set(["http://localhost:3000", "https://compass-bracu.vercel.app"]);
const locks = new Set();
const originLocks = new Set();
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));

async function tokenRequest(parameters) {
  const response = await fetch(`${SSO}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "slm", ...parameters }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") {
    const error = new Error(`Connect token request failed (HTTP ${response.status}). Please sign in again.`);
    error.invalidGrant = data.error === "invalid_grant";
    throw error;
  }
  return data;
}

async function remember(origin, tokens, previousRefresh) {
  await storageReady;
  const refreshToken = tokens.refresh_token || previousRefresh;
  if (refreshToken) await chrome.storage.local.set({ [`refresh:${origin}`]: refreshToken });
}

async function returnToApp(tabId, flow, result) {
  const key = `flow:${tabId}`;
  await chrome.storage.session.set({ [key]: {
    origin: flow.origin, state: flow.state, expiresAt: Date.now() + 120000, stage: "ready", result,
  } });
  await chrome.tabs.update(tabId, { url: `${flow.origin}/#connect_bridge=${encodeURIComponent(flow.state)}` });
}

async function start(tabId, origin) {
  await storageReady;
  const key = `flow:${tabId}`;
  const refreshKey = `refresh:${origin}`;
  const flow = { origin, state: random(), verifier: random(), expiresAt: Date.now() + 600000, stage: "login" };
  await chrome.storage.session.set({ [key]: flow });
  const saved = (await chrome.storage.local.get(refreshKey))[refreshKey];
  if (saved) {
    try {
      const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: saved });
      await remember(origin, tokens, saved);
      await returnToApp(tabId, flow, { accessToken: tokens.access_token });
      return {};
    } catch (error) {
      if (!error.invalidGrant) throw error;
      await chrome.storage.local.remove(refreshKey);
    }
  }
  const challenge = encode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(flow.verifier)));
  const url = new URL(`${SSO}/auth`);
  url.search = new URLSearchParams({
    client_id: "slm", redirect_uri: REDIRECT, response_type: "code", response_mode: "fragment",
    scope: "openid offline_access", state: flow.state, nonce: random(),
    code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  await chrome.tabs.update(tabId, { url: url.toString() });
  return {};
}

async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)) throw new Error("Invalid extension request.");
  const tabId = sender.tab.id;
  const origin = new URL(sender.url).origin;
  const key = `flow:${tabId}`;
  if (message.type === "CONNECT_START") {
    if (!APP_ORIGINS.has(origin)) throw new Error("Unsupported Course Compass origin.");
    if (originLocks.has(origin)) throw new Error("Another Connect sign-in is in progress.");
    originLocks.add(origin);
    try { return await start(tabId, origin); }
    finally { originLocks.delete(origin); }
  }
  const flow = (await chrome.storage.session.get(key))[key];
  if (!flow || flow.state !== message.state || flow.expiresAt < Date.now()) {
    if (message.type === "CONNECT_CALLBACK") return {};
    throw new Error("This Connect login has expired. Please sign in again.");
  }
  if (message.type === "CONNECT_CALLBACK") {
    if (origin !== new URL(REDIRECT).origin || flow.stage !== "login") return {};
    await chrome.storage.session.set({ [key]: { ...flow, stage: "exchanging" } });
    try {
      await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("callback.html") });
      if (message.error || typeof message.code !== "string" || !message.code) throw new Error("Connect login was cancelled or denied.");
      const tokens = await tokenRequest({ grant_type: "authorization_code", code: message.code, redirect_uri: REDIRECT, code_verifier: flow.verifier });
      await remember(flow.origin, tokens);
      await returnToApp(tabId, flow, { accessToken: tokens.access_token });
    } catch (error) {
      await returnToApp(tabId, flow, { error: error.message });
    }
    return {};
  }
  if (message.type === "CONNECT_DELIVER") {
    if (!APP_ORIGINS.has(origin) || origin !== flow.origin || flow.stage !== "ready") throw new Error("Invalid Connect token handoff.");
    await chrome.storage.session.remove(key);
    return flow.result;
  }
  throw new Error("Unsupported extension request.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["CONNECT_START", "CONNECT_CALLBACK", "CONNECT_DELIVER"].includes(message?.type)) return false;
  const tabId = sender.tab?.id;
  if (locks.has(tabId)) {
    sendResponse({ error: "Connect login is already in progress." });
    return false;
  }
  locks.add(tabId);
  handle(message, sender).then(sendResponse, error => sendResponse({ error: error.message || "Connect login could not finish. Please try again." })).finally(() => locks.delete(tabId));
  return true;
});

chrome.tabs.onRemoved.addListener(tabId => { chrome.storage.session.remove(`flow:${tabId}`); });
