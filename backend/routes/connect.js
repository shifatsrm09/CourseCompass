const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const User = require("../models/User");
const PendingConnectImport = require("../models/PendingConnectImport");

// --- Configuration -----------------------------------------------------
// NOTHING here has been verified against real BRACU/Connect infrastructure.
// The endpoint shapes are taken from an inferred, unofficial brief (a
// third-party app's reverse-engineered API), not BRACU documentation.
// Until real OAuth client credentials are registered with Connect (and the
// actual response shapes are confirmed), every route below fails fast with
// a clear 501 instead of silently hitting endpoints that likely don't work
// as described.
const CONNECT_AUTHORIZE_URL = process.env.CONNECT_AUTHORIZE_URL || "https://connect.bracu.ac.bd/oauth/authorize";
const CONNECT_TOKEN_URL = process.env.CONNECT_TOKEN_URL || "https://connect.bracu.ac.bd/oauth/token";
const CONNECT_DEGREE_PROGRESS_URL = process.env.CONNECT_DEGREE_PROGRESS_URL || "https://api.preconnect.app/degree-progress";
const CONNECT_CLIENT_ID = process.env.CONNECT_CLIENT_ID;
const CONNECT_CLIENT_SECRET = process.env.CONNECT_CLIENT_SECRET;
const CONNECT_REDIRECT_URI = process.env.CONNECT_REDIRECT_URI;
const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");

const isConfigured = () => Boolean(CONNECT_CLIENT_ID && CONNECT_REDIRECT_URI && FRONTEND_URL);

const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/api/auth/connect" };

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

// "Spring 2024" -> { season: "Spring", year: 2024 }. Falls back gracefully
// since the real field name/format from Connect is unconfirmed.
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
      error: "Login with Connect isn't set up yet — it needs a registered OAuth client from BRAC University IT (CONNECT_CLIENT_ID, CONNECT_REDIRECT_URI, FRONTEND_URL).",
    });
  }

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  res.cookie("cc_connect_pkce", verifier, COOKIE_OPTS);
  res.cookie("cc_connect_state", state, COOKIE_OPTS);

  const url = new URL(CONNECT_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CONNECT_CLIENT_ID);
  url.searchParams.set("redirect_uri", CONNECT_REDIRECT_URI);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

router.get("/callback", async (req, res) => {
  const fail = (code) => res.redirect(`${FRONTEND_URL}/?connectError=${encodeURIComponent(code)}`);
  if (!isConfigured()) return fail("CONNECT_NOT_CONFIGURED");

  const { code, state, error: oauthError } = req.query;
  if (oauthError) return fail(String(oauthError));

  const cookies = parseCookies(req);
  const verifier = cookies.cc_connect_pkce;
  const expectedState = cookies.cc_connect_state;
  res.clearCookie("cc_connect_pkce", { path: "/api/auth/connect" });
  res.clearCookie("cc_connect_state", { path: "/api/auth/connect" });

  if (!code || !verifier || !state || state !== expectedState) return fail("INVALID_CALLBACK");

  try {
    const tokenResponse = await fetch(CONNECT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        code_verifier: verifier,
        grant_type: "authorization_code",
        client_id: CONNECT_CLIENT_ID,
        redirect_uri: CONNECT_REDIRECT_URI,
        ...(CONNECT_CLIENT_SECRET ? { client_secret: CONNECT_CLIENT_SECRET } : {}),
      }),
    });
    if (!tokenResponse.ok) return fail("TOKEN_EXCHANGE_FAILED");
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return fail("TOKEN_EXCHANGE_FAILED");

    const progressResponse = await fetch(CONNECT_DEGREE_PROGRESS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!progressResponse.ok) return fail("DEGREE_PROGRESS_FAILED");
    const progress = await progressResponse.json();

    // The documented OAuth flow does not return a student ID anywhere. Until
    // a real response is inspected, we look for a few plausible field names;
    // if none are present this fails loudly rather than guessing.
    const studentId = progress.studentId || progress.studentID || progress.student_id || tokenData.studentId;
    if (!studentId || typeof studentId !== "string") return fail("MISSING_STUDENT_ID");

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
    const completedCourses = [...new Set(records.map((record) => record.code))];
    const currentSemester = (progress.semesters || []).length + 1;
    const gradesheetImport = {
      source: "connect",
      importedAt: new Date().toISOString(),
      records,
      cgpa: progress.cgpa ?? null,
      completedCredits: progress.completedCredits ?? null,
    };

    const existing = await User.findOne({ studentId });
    if (existing) {
      // Returning user re-syncing: apply directly, stream is already set.
      existing.completedCourses = completedCourses;
      existing.currentSemester = currentSemester;
      existing.gradesheetImport = gradesheetImport;
      await existing.save();
      return res.redirect(`${FRONTEND_URL}/?connectStudentId=${encodeURIComponent(studentId)}`);
    }

    // New student: we can't create their User document yet (stream is
    // required), so park the fetched data and let the normal StreamSelect
    // -> /auth/set-stream flow finish account creation, applying this once
    // the stream is chosen.
    const token = base64url(crypto.randomBytes(24));
    await PendingConnectImport.create({ token, studentId, completedCourses, currentSemester, gradesheetImport });
    return res.redirect(`${FRONTEND_URL}/?connectStudentId=${encodeURIComponent(studentId)}&connectImportToken=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("Connect sync failed:", err.name || err);
    return fail("CONNECT_SYNC_FAILED");
  }
});

module.exports = router;
