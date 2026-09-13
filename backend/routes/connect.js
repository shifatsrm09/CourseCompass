const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const User = require("../models/User");

// --- Configuration -----------------------------------------------------
// Confirmed real values (from a captured live OAuth redirect, per the user):
//   SSO base: https://sso.bracu.ac.bd/realms/bracu (Keycloak)
//   client_id: "slm"
//   response_mode=fragment -> the auth code comes back in the URL HASH, not
//   query params, so it can only be read client-side and must be exchanged
//   via a POST from the frontend (browsers never send fragments to servers).
//
// STILL UNCONFIRMED / genuinely unknown:
//   - Whether Keycloak's "slm" client will accept OUR redirect_uri at all
//     (it may be locked to Connect's own official callback URLs — if so,
//     /start will redirect fine but Keycloak will reject with
//     invalid_redirect_uri, or /exchange's token call will fail).
//
// CONFIRMED from live captured network traffic:
//   GET  {CONNECT_BASE}/api/adv/v1/student-courses/portfolios
//     -> [{ id: <studentPortfolioId>, studentId: "24101128",
//           enrolledSessionSemesterId: 20241, currentSessionSemesterId: 20262,
//           cgpa, attemptedCredit, earnedCredit, fullName, ... }]
//   GET  {CONNECT_BASE}/api/adv/v1/student-courses/schedules
//        ?studentPortfolioId=<id>&semesterSessionId=<id>
//     -> [{ courseCode, courseCredit, sectionType, ... }]  (registration data,
//        NOT a transcript — no grade/pass-fail field exists in this response,
//        so "completed" here really means "was registered in a past
//        semester", not "passed". A withdrawn/failed course looks identical.)
//   semesterSessionId encoding: first 4 digits = year, last digit = season
//        (1 = Spring, 2 = Summer, 3 = Fall), e.g. 20252 = Summer 2025.
// The `portfolios` path itself is inferred by pattern-matching the confirmed
// `schedules` path (same feature area, same request sequence) — not
// independently verified character-for-character. If it 404s, check the
// backend console for the warning this logs and correct CONNECT_BASE_URL.
const SSO_BASE = (process.env.CONNECT_SSO_BASE || "https://sso.bracu.ac.bd/realms/bracu").replace(/\/+$/, "");
const CONNECT_AUTHORIZE_URL = `${SSO_BASE}/protocol/openid-connect/auth`;
const CONNECT_TOKEN_URL = `${SSO_BASE}/protocol/openid-connect/token`;
const CONNECT_USERINFO_URL = `${SSO_BASE}/protocol/openid-connect/userinfo`;

const CONNECT_BASE_URL = (process.env.CONNECT_BASE_URL || "https://connect.bracu.ac.bd").replace(/\/+$/, "");
const CONNECT_PORTFOLIOS_URL = `${CONNECT_BASE_URL}/api/adv/v1/student-courses/portfolios`;
const CONNECT_SCHEDULES_URL = `${CONNECT_BASE_URL}/api/adv/v1/student-courses/schedules`;

const CONNECT_CLIENT_ID = process.env.CONNECT_CLIENT_ID || "slm";
const CONNECT_REDIRECT_URI = process.env.CONNECT_REDIRECT_URI; // must be a FRONTEND page (e.g. FRONTEND_URL itself) — Keycloak lands the browser here with #code=...&state=...
const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");

const isConfigured = () => Boolean(CONNECT_REDIRECT_URI && FRONTEND_URL);

const COOKIE_OPTS = {
  httpOnly: true,
  // secure:true cookies are refused by browsers over plain HTTP — local dev
  // runs on http://localhost, so this must be conditional on environment.
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

// Reads claims out of a JWT WITHOUT verifying its signature. This is a
// deliberate simplification: the token was just received directly from
// Keycloak's token endpoint over HTTPS in this same request, so its
// authenticity is already implied by the transport. Proper signature
// verification (fetching Keycloak's JWKS and checking it) would be the
// hardened version of this if/when this goes to real production use.
function decodeJwtClaims(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// semesterSessionId encoding confirmed live: first 4 digits = year, last
// digit = season (1 Spring, 2 Summer, 3 Fall).
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
// Generates every semesterSessionId from `startId` (inclusive) up to `endId`
// (exclusive), following the Spring -> Summer -> Fall -> Spring(+1) rotation.
// Capped at 40 terms as a sanity guard against malformed data.
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
// 1-based ordinal count of terms from `startId` through `endId`, inclusive
// of both ends (e.g. Spring24..Summer26 across the confirmed example = 8).
function countSemestersInclusive(startId, endId) {
  return semesterSessionsBetween(startId, endId).length + 1;
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
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_mode", "fragment");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// The frontend reads `code`/`state` out of window.location.hash after
// Keycloak redirects back, then POSTs them here to finish the login.
router.post("/exchange", async (req, res) => {
  if (!isConfigured()) {
    return res.status(501).json({ code: "CONNECT_NOT_CONFIGURED", error: "Login with Connect isn't set up yet." });
  }

  const { code, state } = req.body || {};
  const cookies = parseCookies(req);
  const verifier = cookies.cc_connect_pkce;
  const expectedState = cookies.cc_connect_state;
  res.clearCookie("cc_connect_pkce", { path: "/" });
  res.clearCookie("cc_connect_state", { path: "/" });

  if (!code || !state || !verifier || state !== expectedState) {
    return res.status(400).json({ code: "INVALID_CALLBACK", error: "The Connect login could not be verified. Please try again." });
  }

  try {
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
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.status(502).json({ code: "TOKEN_EXCHANGE_FAILED", error: "Connect did not return an access token." });

    const idClaims = tokenData.id_token ? decodeJwtClaims(tokenData.id_token) : {};
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Portfolios is the authoritative source for the real BRACU student ID
    // and semester range — confirmed live, much more reliable than the
    // userinfo-claim guess used as a fallback below.
    let portfolio = null;
    try {
      const portfoliosResponse = await fetch(CONNECT_PORTFOLIOS_URL, { headers: authHeader });
      if (portfoliosResponse.ok) {
        const portfolios = await portfoliosResponse.json();
        portfolio = Array.isArray(portfolios) ? portfolios[0] : null;
      } else {
        console.warn("Connect portfolios endpoint returned", portfoliosResponse.status, "(path is inferred, not independently confirmed)");
      }
    } catch (err) {
      console.warn("Connect portfolios fetch failed:", err.message);
    }

    let studentId = portfolio?.studentId;
    if (!studentId) {
      // Fallback: userinfo-based guess, in case the portfolios call failed.
      let userinfo = {};
      try {
        const userinfoResponse = await fetch(CONNECT_USERINFO_URL, { headers: authHeader });
        if (userinfoResponse.ok) userinfo = await userinfoResponse.json();
      } catch (err) {
        console.warn("Connect userinfo fetch failed:", err.message);
      }
      studentId = userinfo.preferred_username || idClaims.preferred_username || userinfo.sub || idClaims.sub;
    }
    if (!studentId || typeof studentId !== "string") {
      return res.status(502).json({ code: "MISSING_STUDENT_ID", error: "Connect didn't return a student ID we recognize. Try gradesheet import instead." });
    }

    // Course history: walk every semester from enrollment up to (not
    // including) the current one, pulling registered courseCodes from each.
    // Best-effort — a failure here never blocks the login itself.
    let completedCourses = [];
    let currentSemester = 1;
    let startTerm = null;
    let gradesheetImport = null;
    if (portfolio && Number.isInteger(portfolio.enrolledSessionSemesterId) && Number.isInteger(portfolio.currentSessionSemesterId)) {
      try {
        startTerm = decodeSemesterSessionId(portfolio.enrolledSessionSemesterId);
        currentSemester = countSemestersInclusive(portfolio.enrolledSessionSemesterId, portfolio.currentSessionSemesterId);
        const pastSemesterIds = semesterSessionsBetween(portfolio.enrolledSessionSemesterId, portfolio.currentSessionSemesterId);

        const records = [];
        for (const semesterSessionId of pastSemesterIds) {
          const term = decodeSemesterSessionId(semesterSessionId);
          const url = `${CONNECT_SCHEDULES_URL}?studentPortfolioId=${portfolio.id}&semesterSessionId=${semesterSessionId}`;
          // Sequential, not parallel — this is a handful of requests during
          // a one-time login, not worth risking rate-limiting Connect for.
          // eslint-disable-next-line no-await-in-loop
          const schedulesResponse = await fetch(url, { headers: authHeader });
          if (!schedulesResponse.ok) {
            console.warn("Connect schedules fetch failed for", semesterSessionId, schedulesResponse.status);
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const courses = await schedulesResponse.json();
          (Array.isArray(courses) ? courses : []).forEach((course, index) => {
            if (!course.courseCode) return;
            records.push({
              id: `connect:${semesterSessionId}:${course.courseCode}:${index}`,
              term,
              code: course.courseCode,
              credits: course.courseCredit ?? null,
            });
          });
        }

        completedCourses = [...new Set(records.map((record) => record.code))];
        gradesheetImport = {
          source: "connect",
          importedAt: new Date().toISOString(),
          records,
          cgpa: portfolio.cgpa ?? null,
          completedCredits: portfolio.earnedCredit ?? null,
          // Registration data has no grade/pass-fail field, so this reflects
          // "was registered in a past semester", not a verified pass.
          note: "Derived from Connect class registrations, not a transcript — no grade data was available to confirm a pass.",
        };
      } catch (err) {
        console.warn("Connect course history fetch failed:", err.message);
      }
    } else {
      console.warn("Connect portfolio missing enrolledSessionSemesterId/currentSessionSemesterId — skipping course history sync.");
    }

    const existing = await User.findOne({ studentId });
    if (existing) {
      if (gradesheetImport) {
        existing.completedCourses = completedCourses;
        existing.currentSemester = currentSemester;
        existing.gradesheetImport = gradesheetImport;
        await existing.save();
      }
      return res.json({ success: true, firstLogin: false, user: existing });
    }

    // New student: stream is required to create the User document, so hand
    // the fetched sync data straight back to the frontend, which carries it
    // through StreamSelect and applies it once a stream is chosen.
    return res.json({
      success: true,
      firstLogin: true,
      studentId,
      pendingSync: gradesheetImport ? { completedCourses, currentSemester, startTerm, gradesheetImport } : null,
    });
  } catch (err) {
    console.error("Connect sync failed:", err);
    return res.status(502).json({ code: "CONNECT_SYNC_FAILED", error: "Syncing with Connect failed. Please try again." });
  }
});

module.exports = router;
