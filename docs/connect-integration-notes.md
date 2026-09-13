# Connect (BRACU SSO) Integration — Reference Notes

> Everything confirmed or inferred about BRACU Connect's OAuth flow and data
> APIs, gathered while building Login with Connect. Implementation lives in
> `backend/routes/connect.js`. This file is documentation only — update it if
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
`id_token` is a JWT; we decode its payload (base64url, no signature verification — see code comment in `connect.js` on why that's an accepted simplification for now) as a fallback source of claims.

### Userinfo (confirmed reachable, exact field names NOT separately confirmed)
```
GET /realms/bracu/protocol/openid-connect/userinfo
Authorization: Bearer <access_token>
```
Used only as a **fallback** if the portfolios call (§2) fails — `preferred_username` / `sub` are guessed field names, not independently verified.

---

## 2. Student data — `connect.bracu.ac.bd/api/adv/v1/student-courses/*`

Confirmed live via DevTools Network tab during a real logged-in session. This is a completely different API surface from SSO — same-origin as the Connect webapp itself, authenticated with the same Bearer token.

### 2a. Portfolios — confirmed
```
GET https://connect.bracu.ac.bd/api/adv/v1/student-courses/portfolios
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
- `cgpa`, `attemptedCredit`, `earnedCredit` — bonus profile data, currently stored but not surfaced in the UI.

**Not independently confirmed:** the exact path `/api/adv/v1/student-courses/portfolios`. It's inferred by pattern-matching the confirmed `schedules` path below (same feature area, same request sequence, same base). If it 404s in practice, `connect.js` logs a specific warning (`"Connect portfolios endpoint returned <status>..."`) — check backend console.

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

Implemented in `connect.js` as `decodeSemesterSessionId`, `encodeSemesterSessionId`, `semesterSessionsBetween`, `countSemestersInclusive`. Mirrors the frontend's independent `src/engine/academicTerm.js` (used for the term-label badges on semester cards) — same rotation logic, different codebase, not currently shared as one module.

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

Lab/theory pairs (e.g. `PHY112` + `PHY112L`, `CSE220` + `CSE220L`) are returned as **separate entries** with distinct `courseCode`s — we don't merge them, they're treated as independent codes matching however the curriculum data models them.

---

## 3. What our implementation actually does (as of now)

`POST /api/auth/connect/exchange`:
1. Exchange `code` for `access_token` (confirmed working)
2. `GET portfolios` → `studentId`, `studentPortfolioId`, `enrolledSessionSemesterId`, `currentSessionSemesterId`, `cgpa`, `earnedCredit`
   - Fallback to `userinfo`/JWT-claim guessing only if this fails
3. Compute every semester from enrollment up to (**excluding**) the current one
4. Sequentially `GET schedules` for each of those semesters, collect all `courseCode`s
5. Build `completedCourses` (deduped course codes) + `currentSemester` (1-based count of elapsed terms) + `startTerm` (decoded from `enrolledSessionSemesterId`)
6. Existing account → applied immediately. New account → handed to the frontend as `pendingSync`, applied once they pick a stream (StreamSelect pre-fills season/year from the detected `startTerm`)

---

## 4. The bridge extension (personal-use only, not a production solution)

Since the code lands on `connect.bracu.ac.bd` (not our domain), nothing in our own app can read it — that's a hard same-origin boundary, not a bug. `tools/connect-oauth-bridge-extension/` is a minimal Chrome MV3 content script that:
- Matches `https://connect.bracu.ac.bd/*`
- Runs at `document_start`, checks `window.location.hash` for `code=`
- If present, redirects the tab to the local app (`http://localhost:3000` — hardcoded in `content.js`, edit if testing elsewhere) with the same hash

This only works for browsers where it's manually installed via `chrome://extensions` → Load unpacked. **It cannot be part of a real public login button** — each user would need to install it themselves. It exists purely to let us validate/use the pipeline before BRACU IT (hopefully) registers a real OAuth client.

---

## 5. Open items / known gaps

- [ ] `portfolios` path unconfirmed character-for-character (pattern-matched guess)
- [ ] `sessions` endpoint exists but is unused (returns incomplete history, not needed given the generate-the-sequence approach)
- [ ] No grade/pass-fail data available anywhere found so far — "completed" = "registered in a past semester" only
- [ ] `id_token` signature is not verified (claims are trusted based on direct-from-Keycloak transport only)
- [ ] Real production redirect_uri still blocked — waiting on BRACU IT (email drafted earlier in this project)
- [ ] Course-data fetch is sequential (one semester at a time) — fine for a one-time login, would need rate-limit awareness if ever made more frequent
