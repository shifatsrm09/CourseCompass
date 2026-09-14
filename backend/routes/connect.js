const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const User = require("../models/User");
const { prepareConnectPlan } = require("../connectPlan");

const SSO_BASE = (process.env.CONNECT_SSO_BASE || "https://sso.bracu.ac.bd/realms/bracu").replace(/\/+$/, "");
const CONNECT_AUTHORIZE_URL = `${SSO_BASE}/protocol/openid-connect/auth`;
const CONNECT_TOKEN_URL = `${SSO_BASE}/protocol/openid-connect/token`;

const CONNECT_BASE_URL = (process.env.CONNECT_BASE_URL || "https://connect.bracu.ac.bd").replace(/\/+$/, "");
const CONNECT_PORTFOLIOS_URL = `${CONNECT_BASE_URL}/api/mds/v1/portfolios`;
const CONNECT_SCHEDULES_URL = `${CONNECT_BASE_URL}/api/adv/v1/student-courses/schedules`;

const CONNECT_CLIENT_ID = process.env.CONNECT_CLIENT_ID || "slm";
const CONNECT_REDIRECT_URI = process.env.CONNECT_REDIRECT_URI;
const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");

const isConfigured = () => Boolean(CONNECT_REDIRECT_URI && FRONTEND_URL);

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 10 * 60 * 1000,
  path: "/",
};

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((pair) => {
      const index = pair.indexOf("=");
      if (index < 0) return [pair.trim(), ""];
      return [decodeURIComponent(pair.slice(0, index).trim()), decodeURIComponent(pair.slice(index + 1).trim())];
    })
  );
}

const SEASON_ORDER = ["Spring", "Summer", "Fall"];
function decodeSemesterSessionId(id) {
  if (!Number.isInteger(id)) return null;
  const year = Math.floor(id / 10);
  const season = SEASON_ORDER[(id % 10) - 1];
  return season ? { year, season } : null;
}
function encodeSemesterSessionId(year, season) {
  return year * 10 + (SEASON_ORDER.indexOf(season) + 1);
}
function semesterSessionsBetween(startId, endId) {
  const start = decodeSemesterSessionId(startId);
  if (!start || !Number.isInteger(endId)) return [];
  const ids = [];
  let year = start.year;
  let seasonIndex = SEASON_ORDER.indexOf(start.season);
  for (let i = 0; i < 40; i++) {
    const id = encodeSemesterSessionId(year, SEASON_ORDER[seasonIndex]);
    if (id === endId) break;
    ids.push(id);
    seasonIndex += 1;
    if (seasonIndex >= SEASON_ORDER.length) { seasonIndex = 0; year += 1; }
  }
  return ids;
}
router.get("/start", (req, res) => {
  if (!isConfigured()) {
    return res.status(501).json({
      code: "CONNECT_NOT_CONFIGURED",
      error: "Login with Connect isn't set up yet (needs CONNECT_REDIRECT_URI and FRONTEND_URL configured on the backend).",
    });
  }

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));
  const nonce = base64url(crypto.randomBytes(16));

  res.cookie("cc_connect_pkce", verifier, COOKIE_OPTS);
  res.cookie("cc_connect_state", state, COOKIE_OPTS);

  const url = new URL(CONNECT_AUTHORIZE_URL);
  url.searchParams.set("client_id", CONNECT_CLIENT_ID);
  url.searchParams.set("redirect_uri", CONNECT_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid offline_access");
  url.searchParams.set("response_mode", "fragment");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

router.post("/exchange", async (req, res) => {
  if (!isConfigured()) {
    return res.status(501).json({ code: "CONNECT_NOT_CONFIGURED", error: "Login with Connect isn't set up yet." });
  }

  const { code, state, accessToken: extensionToken } = req.body || {};
  const fromExtension = typeof extensionToken === "string" && extensionToken.length > 0 && extensionToken.length <= 16384;
  const cookies = parseCookies(req);
  const verifier = cookies.cc_connect_pkce;
  const expectedState = cookies.cc_connect_state;
  if (!fromExtension) {
    res.clearCookie("cc_connect_pkce", { path: "/" });
    res.clearCookie("cc_connect_state", { path: "/" });
  }

  if (!fromExtension && (!code || !state || !verifier || state !== expectedState)) {
    return res.status(400).json({ code: "INVALID_CALLBACK", error: "The Connect login could not be verified. Please try again." });
  }

  try {
    let accessToken = extensionToken;
    if (!fromExtension) {
      const tokenResponse = await fetch(CONNECT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CONNECT_CLIENT_ID,
          code: String(code),
          redirect_uri: CONNECT_REDIRECT_URI,
          code_verifier: verifier,
        }),
      });
      if (!tokenResponse.ok) {
        const detail = await tokenResponse.text().catch(() => "");
        console.error("Connect token exchange failed:", tokenResponse.status, detail);
        return res.status(502).json({
          code: "TOKEN_EXCHANGE_FAILED",
          error: "Connect rejected the login. This commonly means our redirect URI isn't registered with BRACU's SSO client — a real client registration from BRACU IT may be required.",
        });
      }
      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      if (!accessToken) return res.status(502).json({ code: "TOKEN_EXCHANGE_FAILED", error: "Connect did not return an access token." });
    }

    const authHeader = { Authorization: `Bearer ${accessToken}` };
    const fetchData = async (url, label, allowMissing = false) => {
      const response = await fetch(url, { headers: authHeader, signal: AbortSignal.timeout(15000) });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}. No plan was changed.`);
      const data = await response.json().catch(() => { throw new Error(`${label} did not return JSON. No plan was changed.`); });
      if (!Array.isArray(data)) throw new Error(`${label} returned an unexpected response. No plan was changed.`);
      return data;
    };
    const portfolios = await fetchData(CONNECT_PORTFOLIOS_URL, "Connect portfolios");
    const candidates = portfolios.filter(item => item.shortCode === "CSE" && item.academicType === "UNDERGRADUATE");
    const portfolio = candidates.length === 1 ? candidates[0] : portfolios.length === 1 ? portfolios[0] : null;
    if (!portfolio?.studentId || portfolio.id == null) throw new Error("Connect did not identify a single student portfolio. No plan was changed.");
    const studentId = String(portfolio.studentId);
    const startId = Number(portfolio.enrolledSessionSemesterId);
    const currentId = Number(portfolio.currentSessionSemesterId);
    const startTerm = decodeSemesterSessionId(startId);
    const currentTerm = decodeSemesterSessionId(currentId);
    if (!startTerm || !currentTerm || currentId < startId || startTerm.year < 2000 || currentTerm.year > 2100) {
      throw new Error("Connect did not provide a valid enrollment and current semester. No plan was changed.");
    }
    const pastSemesterIds = semesterSessionsBetween(startId, currentId);
    if (pastSemesterIds.length >= 40) throw new Error("The Connect semester range exceeds the supported history size.");
    const existing = await User.findOne({ studentId });
    const terms = [];
    for (const semesterSessionId of pastSemesterIds) {
      const query = new URLSearchParams({ studentPortfolioId: String(portfolio.id), semesterSessionId: String(semesterSessionId) });
      const courses = await fetchData(`${CONNECT_SCHEDULES_URL}?${query}`, `Connect schedules for ${semesterSessionId}`, true);
      terms.push({
        ...decodeSemesterSessionId(semesterSessionId),
        unavailable: courses === null,
        records: (courses || []).map(course => ({
          code: typeof course.courseCode === "string" ? course.courseCode.trim().toUpperCase() : "",
          credits: Number(course.courseCredit),
          courseType: course.courseType,
          sectionId: course.sectionId,
          parentSectionId: course.parentSectionId,
        })),
      });
    }
    if (terms.length && terms.every(term => term.unavailable)) {
      return res.status(502).json({ code: "CONNECT_SCHEDULES_UNAVAILABLE", error: "Connect returned 404 for every past semester. No history was imported. Check whether the same schedule requests work inside Connect, or import your grade-sheet PDF." });
    }
    const pendingSync = { startTerm, currentTerm, terms };
    if (existing) {
      const fields = await prepareConnectPlan(pendingSync, existing.stream);
      const version = existing.plannerVersion ?? 0;
      const versionFilter = version === 0
        ? { $or: [{ plannerVersion: 0 }, { plannerVersion: { $exists: false } }] }
        : { plannerVersion: version };
      const saved = await User.findOneAndUpdate(
        { studentId, stream: existing.stream, ...versionFilter },
        { $set: fields, $inc: { plannerVersion: 1 } },
        { new: true, runValidators: true }
      );
      if (!saved) return res.status(409).json({ error: "Your plan changed during Connect sync. Please sign in again." });
      return res.json({ success: true, firstLogin: false, user: saved });
    }
    return res.json({ success: true, firstLogin: true, studentId, pendingSync });
  } catch (err) {
    console.error("Connect sync failed:", err);
    return res.status(502).json({ code: "CONNECT_SYNC_FAILED", error: err.message || "Syncing with Connect failed. Please try again." });
  }
});

module.exports = router;
