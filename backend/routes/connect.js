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
//   - The course-data endpoints (schedule / degree-progress). These are
//     best-effort only: if they fail, login still succeeds using whatever
//     `userinfo` returns, just without auto-filled completed courses.
const SSO_BASE = (process.env.CONNECT_SSO_BASE || "https://sso.bracu.ac.bd/realms/bracu").replace(/\/+$/, "");
const CONNECT_AUTHORIZE_URL = `${SSO_BASE}/protocol/openid-connect/auth`;
const CONNECT_TOKEN_URL = `${SSO_BASE}/protocol/openid-connect/token`;
const CONNECT_USERINFO_URL = `${SSO_BASE}/protocol/openid-connect/userinfo`;
const CONNECT_DEGREE_PROGRESS_URL = process.env.CONNECT_DEGREE_PROGRESS_URL || "https://connect.bracu.ac.bd/api/student/degree-progress";

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

function parseSemesterName(name) {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/i.exec(String(name || "").trim());
  if (!match) return { season: "Unknown", year: null };
  const season = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return { season, year: Number(match[2]) };
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

    let userinfo = {};
    try {
      const userinfoResponse = await fetch(CONNECT_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (userinfoResponse.ok) userinfo = await userinfoResponse.json();
    } catch (err) {
      console.warn("Connect userinfo fetch failed:", err.message);
    }

    const studentId = userinfo.preferred_username || idClaims.preferred_username || userinfo.sub || idClaims.sub;
    if (!studentId || typeof studentId !== "string") {
      return res.status(502).json({ code: "MISSING_STUDENT_ID", error: "Connect didn't return a student ID we recognize. Try gradesheet import instead." });
    }

    // Course-data endpoint is an unconfirmed guess — best-effort only, never
    // blocks the login itself.
    let completedCourses = [];
    let currentSemester = 1;
    let gradesheetImport = null;
    try {
      const progressResponse = await fetch(CONNECT_DEGREE_PROGRESS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        const records = [];
        (progress.semesters || []).forEach((semesterEntry) => {
          const term = parseSemesterName(semesterEntry.semesterName);
          (semesterEntry.courses || []).forEach((course, index) => {
            records.push({
              id: `connect:${semesterEntry.semesterName}:${course.courseCode}:${index}`,
              term,
              code: course.courseCode,
              grade: course.grade,
              credits: course.credits,
            });
          });
        });
        completedCourses = [...new Set(records.map((record) => record.code))];
        currentSemester = (progress.semesters || []).length + 1;
        gradesheetImport = {
          source: "connect",
          importedAt: new Date().toISOString(),
          records,
          cgpa: progress.cgpa ?? null,
          completedCredits: progress.completedCredits ?? null,
        };
      } else {
        console.warn("Connect degree-progress endpoint returned", progressResponse.status, "(unconfirmed endpoint — this is expected until the real path is found)");
      }
    } catch (err) {
      console.warn("Connect degree-progress fetch failed (endpoint unconfirmed):", err.message);
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
      pendingSync: gradesheetImport ? { completedCourses, currentSemester, gradesheetImport } : null,
    });
  } catch (err) {
    console.error("Connect sync failed:", err);
    return res.status(502).json({ code: "CONNECT_SYNC_FAILED", error: "Syncing with Connect failed. Please try again." });
  }
});

module.exports = router;
