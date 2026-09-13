# Connect (BRACU SSO) Integration — Reference Notes

> Everything confirmed or inferred about BRACU Connect's OAuth flow and data
> APIs, gathered while building Login with Connect. Implementation lives in
> `backend/routes/connect.js` and `backend/connectPlan.js`. This file is documentation only — update it if
> new endpoints/fields get confirmed or existing guesses turn out wrong.

---

## 1. Identity / SSO — Keycloak

Confirmed live (captured from an actual OAuth redirect + working token exchange).

| Field | Value |
|---|---|
| Realm | `bracu` |
| SSO base | `https://sso.bracu.ac.bd/realms/bracu` |
| `client_id` | `slm` (Connect's own client — not one we registered) |
| Flow | Authorization Code + PKCE (S256) |
| Scope | `openid` |
| `response_mode` | `fragment` — **the auth code comes back in the URL hash (`#code=...`), never query params.** Browsers never send fragments to a server, so the code can only be read by JS running in the browser, then POSTed to our backend. This is why the flow needed restructuring away from a simple GET-redirect callback. |

### Endpoints
```
Authorize:  https://sso.bracu.ac.bd/realms/bracu/protocol/openid-connect/auth
Token:      https://sso.bracu.ac.bd/realms/bracu/protocol/openid-connect/token
Userinfo:   https://sso.bracu.ac.bd/realms/bracu/protocol/openid-connect/userinfo
Discovery:  https://sso.bracu.ac.bd/realms/bracu/.well-known/openid-configuration
```
(Discovery URL itself was never fetched successfully — blocked by `robots.txt` for Claude's own fetch tool specifically; untested whether a real server-side Node `fetch` would succeed.)

### The redirect_uri problem (unresolved for production use)
`client_id=slm` is Connect's **own** client, registered for Connect's own callback URLs — not ours. Two things confirmed by testing:
- Using our own app URL (`http://localhost:3000`) → Keycloak rejects with **`Invalid parameter: redirect_uri`**.
- Using Connect's own confirmed redirect URI, `https://connect.bracu.ac.bd/` (exact match, trailing slash), **is accepted** — token exchange succeeds, `access_token` returned.

**Consequence:** the auth code lands on `connect.bracu.ac.bd`, a domain we don't control and can't run JS on — except via a browser extension content script. See §4.

**Real fix, not yet done:** BRACU IT needs to register a proper OAuth client with our own redirect URI. Until then this only works for whoever has the bridge extension installed — it is not a viable public "Login with Connect" button.

### Token response shape (confirmed)
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 300,
  "id_token": "..."
}
```
The token exchange supplies the access token used for the portfolio and schedules requests. The route no longer decodes the ID token as an identity-only fallback.

### Userinfo (confirmed reachable, exact field names NOT separately confirmed)
```
GET /realms/bracu/protocol/openid-connect/userinfo
Authorization: Bearer <access_token>
```
Not used by the current integration. Portfolio/history failures now return an explicit error instead of falling back to an ID-only login.

---

## 2. Student data — `connect.bracu.ac.bd/api/adv/v1/student-courses/*`

Confirmed live via DevTools Network tab during a real logged-in session. This is a completely different API surface from SSO — same-origin as the Connect webapp itself, authenticated with the same Bearer token.

### 2a. Portfolios — exact URL confirmed by the user on 2026-09-13
```
GET https://connect.bracu.ac.bd/api/mds/v1/portfolios
Authorization: Bearer <access_token>
```
Returns an array (one entry seen, presumably one per program/degree):
```json
[{
  "id": 50177,
  "studentId": "24101128",
  "fullName": "Dewan Sifat Rahman",
  "studentEmail": "dewan.sifat.rahman@g.bracu.ac.bd",
  "departmentName": "Department of Computer Science & Engineering",
  "programOrCourse": "Bachelor of Science in Computer Science and Engineering",
  "shortCode": "CSE",
  "academicType": "UNDERGRADUATE",
  "enrolledSemester": "SPRING 2024",
  "enrolledSessionSemesterId": 20241,
  "currentSemester": "SUMMER 2026",
  "currentSessionSemesterId": 20262,
  "cgpa": 3.64,
  "attemptedCredit": 84,
  "earnedCredit": 84,
  "hasCompleted": false,
  "isEligibleForDegreeCompletionRequest": false
}]
```
**This is the single most useful call** — it gives us, in one request:
- `studentId` — the real BRACU-format ID (matches our app's `studentId` field exactly). More reliable than any userinfo/JWT-claim guess.
- `id` — the `studentPortfolioId` needed for every other call below.
- `enrolledSessionSemesterId` / `currentSessionSemesterId` — exact start term and current term, encoded (see §2c). No more asking the user to manually type in their starting season/year.
- `cgpa`, `attemptedCredit`, `earnedCredit` — additional profile data; the planner currently imports course registrations.

The previous `/api/adv/v1/student-courses/portfolios` path was wrong. The implementation now uses the confirmed `/api/mds/v1/portfolios` URL.

### 2b. Sessions — confirmed, but **incomplete / not useful for full history**
```
GET https://connect.bracu.ac.bd/api/adv/v1/student-courses/sessions?studentPortfolioId=50177
```
Real response for a student enrolled since Spring 2024 (8 semesters ago):
```json
[
  {"semesterSessionId":20252,"description":"SUMMER 2025"},
  {"semesterSessionId":20253,"description":"FALL 2025"},
  {"semesterSessionId":20251,"description":"SPRING 2025"},
  {"semesterSessionId":20262,"description":"SUMMER 2026"},
  {"semesterSessionId":20261,"description":"SPRING 2026"}
]
```
**Important finding:** this only returned 5 entries — missing Spring/Summer/Fall 2024, their actual first three semesters. This looks like a "recent semesters" list for a UI dropdown, **not full enrollment history**. Do not rely on it to enumerate every past semester.

**What we do instead:** generate the full semester sequence ourselves between `enrolledSessionSemesterId` and `currentSessionSemesterId` using the confirmed ID encoding, and query `schedules` (§2d) for each one directly. This endpoint currently isn't called by our implementation at all.

### 2c. `semesterSessionId` encoding — confirmed
```
First 4 digits = year
Last digit      = season: 1 = Spring, 2 = Summer, 3 = Fall
```
Examples confirmed against real data: `20241` = Spring 2024, `20252` = Summer 2025, `20253` = Fall 2025, `20262` = Summer 2026.

Rotation order for generating a sequence: **Spring → Summer → Fall → Spring (next year)**.

Implemented in `connect.js` as `decodeSemesterSessionId`, `encodeSemesterSessionId`, and `semesterSessionsBetween`. Mirrors the frontend's independent `src/engine/academicTerm.js` (used for the term-label badges on semester cards) — same rotation logic, different codebase, not currently shared as one module.

### 2d. Schedules — confirmed, real sample response
```
GET https://connect.bracu.ac.bd/api/adv/v1/student-courses/schedules
    ?studentPortfolioId=50177&semesterSessionId=20252
```
```json
[
  {
    "courseCode": "PHY112",
    "courseCredit": 3,
    "courseType": "THEORY",
    "sectionType": "OTHER",
    "sectionId": 177947,
    "sectionName": "03",
    "faculties": "TKT",
    "roomName": "10F-29C",
    "prerequisiteCourses": "(PHY111)",
    "capacity": 40,
    "consumedSeat": 39,
    "sectionSchedule": "{...stringified JSON: exam dates, class days/times...}",
    "studentPortfolioId": 50177,
    "semesterSessionId": 20252
  },
  { "courseCode": "PHY112L", "courseCredit": 0, "courseType": "LAB", "parentSectionId": 177947, "..." : "..." }
]
```
**Critical limitation, confirmed by inspecting the full raw response: there is no grade, pass/fail, or completion-status field anywhere in this payload.** It's pure registration/schedule data (room, exam timing, section, seat counts) — the same shape as "what classes am I taking," not a transcript.

**Consequence for our "completed courses" sync:** we can only say *"this course code was registered in a semester before the student's current one."* We cannot distinguish a passed course from a withdrawn or failed one. This is stored verbatim in the `gradesheetImport.note` field so it's never silently presented as more authoritative than it is.

Lab/theory pairs are separate entries. An unknown zero-credit LAB linked through `parentSectionId` to a returned theory entry is excluded from planner slots so it does not consume a COD slot. Other unmatched courses map to COD using the grade-sheet importer.

---

## 3. What our implementation actually does (as of now)

`POST /api/auth/connect/exchange`:
1. Exchange the authorization code for an access token.
2. Fetch the confirmed portfolios URL and select a single CSE undergraduate portfolio (or the only portfolio).
3. Generate every term from enrollment up to, excluding, the current term; fetch its schedules sequentially.
4. A schedule HTTP 404 marks that term unavailable and fetching continues. Authentication failures, other HTTP errors, and malformed responses still stop the import. If every past term returns 404, show an endpoint/history error instead of creating an empty import. Empty arrays and unavailable terms are recorded in `gradesheetImport.missingTerms`; visible warnings identify these gaps before stream confirmation and in the planner. Only returned courses are assumed completed; missing courses remain in future recommendations. The user explicitly chose partial imports on 2026-09-13.
5. Pass semester-grouped records through `prepareConnectPlan`, which reuses the existing grade-sheet mapping and planning engine. Preserve recorded semesters, map unknown courses to COD, and rebalance remaining courses. No grades are invented: imported records retain null grades and pass status; prior registrations are assumed completed for planning only.
6. Existing accounts: save canonical `plannerState`, derived legacy fields, start term, and import history together with a planner-version check/increment.
7. New accounts: return `pendingSync` with terms/start/current term. StreamSelect prefills the stream when the first term identifies English and math, then imports the canonical plan through `/api/auth/set-stream` on confirmation.
8. The UI clears stale local planner drafts after a successful sync and shows the registration-data limitation in imported history. Partial imports also show a persistent missing-history warning outside the collapsed history panel.

Current-semester registrations are not imported by this flow. Its current semester is generated by the planner, just as with grade-sheet import. The existing TARC/COD/capacity validation remains in force; unsupported histories fail explicitly rather than dropping courses.

---

## 4. The bridge extension (personal-use only, not a production solution)

Since the code lands on `connect.bracu.ac.bd` (not our domain), nothing in our own app can read it — that's a hard same-origin boundary, not a bug. `tools/connect-oauth-bridge-extension/` is a minimal Chrome MV3 content script that:
- Matches `https://connect.bracu.ac.bd/*`
- Runs at `document_start`, checks `window.location.hash` for `code=`
- If present, redirects the tab to the local app (`http://localhost:3000` — hardcoded in `content.js`, edit if testing elsewhere) with the same hash

This only works for browsers where it's manually installed via `chrome://extensions` → Load unpacked. **It cannot be part of a real public login button** — each user would need to install it themselves. It exists purely to let us validate/use the pipeline before BRACU IT (hopefully) registers a real OAuth client.

---

## 5. Open items / known gaps

- [x] Correct portfolios path confirmed and applied: `/api/mds/v1/portfolios`
- [ ] `sessions` endpoint exists but is unused (returns incomplete history, not needed given the generate-the-sequence approach)
- [ ] No grade/pass-fail data available anywhere found so far — "completed" = "registered in a past semester" only
- [x] Removed unverified ID-token claim fallback; failed portfolio requests no longer produce an ID-only success
- [ ] Real production redirect_uri still blocked — waiting on BRACU IT (email drafted earlier in this project)
- [ ] Course-data fetch is sequential (one semester at a time) — fine for a one-time login, would need rate-limit awareness if ever made more frequent
