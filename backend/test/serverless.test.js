const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const database = require("../db");
const User = require("../models/User");
const app = require("../../api");

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => mock.method(database, "connectDatabase", async () => {}));
afterEach(() => mock.restoreAll());

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("the serverless entry retains all five existing API routes", async () => {
  for (const path of [
    "/api/auth/login",
    "/api/auth/set-stream",
    "/api/planner/save-plan",
    "/api/planner/save-order",
    "/api/planner/complete-semester",
  ]) {
    const response = await post(path, {});
    assert.equal(response.status, 400, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok((await response.json()).error);
  }
});

test("first login and stream selection retain the default-plan behavior", async () => {
  mock.method(User, "findOne", async () => null);
  mock.method(User.prototype, "save", async function () { return this; });
  const login = await post("/api/auth/login", { studentId: "test-student" });
  assert.deepEqual(await login.json(), { firstLogin: true, user: null });

  const selection = await post("/api/auth/set-stream", {
    studentId: "test-student",
    stream: "ENG101 + MAT110",
  });
  const result = await selection.json();
  assert.equal(selection.status, 200);
  assert.equal(result.user.stream, "ENG101 + MAT110");
  assert.equal(result.user.customPlan, null);
  assert.equal(result.user.currentSemester, 1);
});

test("a saved personalized plan is returned on a later login", async () => {
  const user = { studentId: "test-student", currentSemester: 2, customPlan: null };
  mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { studentId: user.studentId });
    Object.assign(user, update.$set);
    return user;
  });
  mock.method(User, "findOne", async () => user);
  const plan = [{ semester: 1, courses: ["CSE110"] }, { semester: 2, courses: ["COD"] }];
  const saved = await post("/api/planner/save-plan", {
    studentId: user.studentId, plan, codCount: 1, currentCourses: ["COD"],
  });
  assert.equal(saved.status, 200);
  const login = await post("/api/auth/login", { studentId: user.studentId });
  const result = await login.json();
  assert.deepEqual(result.user.customPlan, plan);
  assert.equal(result.user.codCount, 1);
  assert.deepEqual(result.user.currentCourses, ["COD"]);
});

test("database failures return retryable JSON without querying user data", async () => {
  mock.method(database, "connectDatabase", async () => { throw new Error("private details"); });
  mock.method(console, "error", () => {});
  const find = mock.method(User, "findOne", async () => null);
  const response = await post("/api/auth/login", { studentId: "test-student" });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Database unavailable/);
  assert.equal(find.mock.callCount(), 0);
});

test("malformed request bodies return JSON errors before database access", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON request body" });
  assert.equal(database.connectDatabase.mock.callCount(), 0);
});

test("unexpected route errors remain JSON responses", async () => {
  mock.method(User, "findOne", async () => { throw new Error("private details"); });
  mock.method(console, "error", () => {});
  const response = await post("/api/auth/login", { studentId: "test-student" });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Request failed. Please try again." });
});

test("unknown API paths return JSON instead of the frontend page", async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "API route not found" });
  assert.equal(database.connectDatabase.mock.callCount(), 0);
});
