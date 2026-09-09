const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const database = require("../db");
const User = require("../models/User");
const app = require("../../api");
const { createDefaultState } = require("../../src/engine/plannerState.mjs");
const { getCurriculum, deriveLegacyFields } = require("../plannerState");

const stream = "ENG101 + MAT110";
const curriculum = getCurriculum(stream);
const clone = (value) => JSON.parse(JSON.stringify(value));
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

function defaultUser() {
  return { studentId: "planner-test", stream, currentSemester: 1, completedCourses: [], customPlan: null, plannerVersion: 0 };
}

function defaultPlan() {
  return { ...createDefaultState(curriculum), personalized: true };
}

function storeUser(initial = defaultUser(), staleInitialReads = 0) {
  let stored = clone(initial);
  let readCount = 0;
  const writes = [];
  mock.method(User, "findOne", async () => clone(readCount++ < staleInitialReads ? initial : stored));
  mock.method(User, "findOneAndUpdate", async (filter, update, options) => {
    writes.push({ filter: clone(filter), update: clone(update), options });
    assert.equal(options.runValidators, true);
    const expected = filter.$or ? 0 : filter.plannerVersion;
    if (expected !== (stored.plannerVersion ?? 0) || filter.stream !== stored.stream) return null;
    stored = { ...stored, ...clone(update.$set), plannerVersion: (stored.plannerVersion ?? 0) + update.$inc.plannerVersion };
    return clone(stored);
  });
  return { read: () => clone(stored), writes };
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function save(plannerState = defaultPlan(), expectedVersion = 0, mutationId = "save-1") {
  return post("planner/save-plan", { studentId: "planner-test", expectedVersion, mutationId, plannerState });
}

function moveCourse(state, code, destinationIndex) {
  const source = state.semesters.find((semester) => semester.courses.some((course) => curriculum.byId.get(course.occurrenceId).code === code));
  const index = source.courses.findIndex((course) => curriculum.byId.get(course.occurrenceId).code === code);
  const [course] = source.courses.splice(index, 1);
  state.semesters[destinationIndex].courses.push(course);
  return state;
}

test("first save migrates an unversioned user atomically and login returns the exact canonical plan", async () => {
  const initial = defaultUser();
  delete initial.plannerVersion;
  const storage = storeUser(initial);
  const state = moveCourse(defaultPlan(), "CSE423", 11);
  state.semesters[11].courses.reverse();
  const result = await save(state);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.plannerVersion, 1);
  assert.deepEqual(result.body.user.plannerState, state);
  assert.deepEqual(storage.writes[0].filter.$or, [{ plannerVersion: 0 }, { plannerVersion: { $exists: false } }]);
  const restored = await post("auth/login", { studentId: initial.studentId });
  assert.deepEqual(restored.body.user.plannerState, state);
  assert.equal(restored.body.user.codCount, 5);
  assert.deepEqual(restored.body.user.customPlan, deriveLegacyFields(state, curriculum).customPlan);
});

test("stale versions cannot overwrite a newer plan", async () => {
  const storage = storeUser();
  await save();
  const snapshot = storage.read();
  const result = await save(moveCourse(defaultPlan(), "CSE423", 11), 0, "stale");
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "PLANNER_VERSION_CONFLICT");
  assert.deepEqual(storage.read(), snapshot);
  assert.equal(storage.writes.length, 1);
});

test("retry after a lost response returns success without writing twice", async () => {
  const storage = storeUser();
  const state = defaultPlan();
  const first = await save(state);
  const reorderedKeys = Object.fromEntries(Object.entries(state).reverse());
  const retry = await save(reorderedKeys);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.plannerVersion, 1);
  assert.equal(storage.writes.length, 1);
});

test("a mutation ID cannot be reused for different content", async () => {
  const storage = storeUser();
  await save();
  const result = await save(moveCourse(defaultPlan(), "CSE423", 11), 1);
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "MUTATION_ID_REUSED");
  assert.equal(storage.writes.length, 1);
});

test("concurrent saves with the same base version permit exactly one atomic write", async () => {
  const storage = storeUser(defaultUser(), 2);
  const results = await Promise.all([
    save(defaultPlan(), 0, "concurrent-a"),
    save(moveCourse(defaultPlan(), "CSE423", 11), 0, "concurrent-b"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(storage.read().plannerVersion, 1);
  assert.equal(storage.writes.length, 2);
});

test("concurrent identical retries both succeed while incrementing the version once", async () => {
  const storage = storeUser(defaultUser(), 2);
  const results = await Promise.all([save(), save()]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(storage.read().plannerVersion, 1);
});

test("consecutive actions preserve the complete latest snapshot", async () => {
  const storage = storeUser();
  const first = moveCourse(defaultPlan(), "CSE423", 11);
  const saved = await save(first);
  const second = moveCourse(clone(first), "CSE421", 11);
  const final = await save(second, saved.body.plannerVersion, "save-2");
  assert.equal(final.status, 200, JSON.stringify(final.body));
  assert.equal(storage.read().plannerVersion, 2);
  assert.deepEqual(storage.read().plannerState, second);
});

for (const [name, mutate] of [
  ["missing course", (state) => state.semesters[11].courses.pop()],
  ["duplicate instance", (state) => state.semesters[11].courses.push(clone(state.semesters[10].courses[0]))],
  ["unknown occurrence", (state) => { state.semesters[11].courses[0].occurrenceId = "unknown"; }],
  ["invalid prerequisite", (state) => moveCourse(state, "CSE423", 1)],
  ["capacity overflow", (state) => { moveCourse(state, "CSE423", 3); moveCourse(state, "CSE421", 3); }],
  ["normal course in TARC", (state) => moveCourse(state, "CSE423", 2)],
  ["current semester modification", (state) => state.semesters[0].courses.reverse()],
  ["invented completion", (state) => state.completedCourses.push("CSE423")],
  ["skipped completion", (state) => { state.currentSemester = 3; }],
  ["wrong stream", (state) => { state.stream = "ENG091 + MAT092"; }],
  ["unplaced course", (state) => state.unplaced.push(state.semesters[11].courses.pop())],
  ["malformed semester", (state) => { state.semesters[4] = null; }],
  ["embedded curriculum metadata", (state) => { state.curriculum = { courses: [{ code: "FAKE", hp: [] }] }; }],
  ["unknown semester metadata", (state) => { state.semesters[11].unexpected = { completed: true }; }],
  ["client-supplied prerequisite metadata", (state) => { state.semesters[11].courses[0].hp = []; }],
  ["replaced TARC identity", (state) => { state.semesters[2].id = "renamed-tarc"; }],
  ["TARC moved before semester three", (state) => { const [tarc] = state.semesters.splice(2, 1); state.semesters.splice(1, 0, tarc); }],
]) {
  test(`invalid save preserves stored data: ${name}`, async () => {
    const storage = storeUser();
    const original = storage.read();
    const state = defaultPlan();
    mutate(state);
    const result = await save(state);
    assert.equal(result.status, 422, JSON.stringify(result.body));
    assert.ok(result.body.code);
    assert.ok(result.body.error);
    assert.deepEqual(storage.read(), original);
    assert.equal(storage.writes.length, 0);
  });
}

test("completion persists courses and advances the current position in one save", async () => {
  const storage = storeUser();
  const state = defaultPlan();
  state.currentSemester = 2;
  state.completedCourses = state.semesters[0].courses.map((course) => curriculum.byId.get(course.occurrenceId).code);
  const result = await save(state);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(storage.read().completedCourses, state.completedCourses);
  assert.deepEqual(storage.read().currentCourses, ["CSE111", "CSE230", "STA201", "PHY112"]);
});

test("completion cannot omit completed course records", async () => {
  const storage = storeUser();
  const state = defaultPlan();
  state.currentSemester = 2;
  const result = await save(state);
  assert.equal(result.status, 422);
  assert.equal(result.body.code, "INVALID_COMPLETION");
  assert.equal(storage.writes.length, 0);
});

test("current courses use chronological position after TARC is moved", async () => {
  const state = defaultPlan();
  const [tarc] = state.semesters.splice(2, 1);
  state.semesters.splice(4, 0, tarc);
  state.currentSemester = 4;
  state.completedCourses = state.semesters.slice(0, 3).flatMap((semester) => semester.courses.map((course) => curriculum.byId.get(course.occurrenceId).code));
  const user = { ...defaultUser(), ...deriveLegacyFields(state, curriculum), plannerState: state };
  const storage = storeUser(user);
  const next = moveCourse(clone(state), "CSE423", 11);
  const result = await save(next);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(storage.read().currentCourses, ["CSE221", "MAT216", "CSE251", "COD"]);
  assert.deepEqual(storage.read().semesterOrder, state.semesters.map((semester) => semester.originalRow));
});

test("corrupt legacy plans remain untouched instead of being reset to defaults", async () => {
  const storage = storeUser({ ...defaultUser(), customPlan: [{ semester: 1, courses: ["UNKNOWN"] }] });
  const snapshot = storage.read();
  const result = await save();
  assert.equal(result.status, 422);
  assert.equal(result.body.code, "INVALID_SAVED_PLAN");
  assert.deepEqual(storage.read(), snapshot);
});

test("legacy mutation endpoints cannot bypass canonical validation", async () => {
  const storage = storeUser();
  for (const [path, body] of [
    ["save-plan", { plan: [] }],
    ["save-order", { order: [3, 1, 2] }],
    ["complete-semester", {}],
  ]) {
    const result = await post(`planner/${path}`, { studentId: "planner-test", ...body });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "PLANNER_UPGRADE_REQUIRED");
  }
  assert.equal(storage.writes.length, 0);
});

test("malformed save protocol is rejected before user queries", async () => {
  const find = mock.method(User, "findOne", async () => null);
  for (const changes of [
    { studentId: { $ne: null } }, { expectedVersion: -1 }, { expectedVersion: 0.5 },
    { mutationId: "" }, { mutationId: null }, { plannerState: [] }, { plannerState: null },
  ]) {
    const result = await post("planner/save-plan", { studentId: "planner-test", expectedVersion: 0, mutationId: "valid-id", plannerState: defaultPlan(), ...changes });
    assert.equal(result.status, 400);
  }
  assert.equal(find.mock.callCount(), 0);
});

test("existing canonical plans cannot be invalidated through stream selection", async () => {
  const storage = storeUser({ ...defaultUser(), plannerState: defaultPlan() });
  const snapshot = storage.read();
  const result = await post("auth/set-stream", { studentId: "planner-test", stream: "ENG091 + MAT092" });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "STREAM_ALREADY_SELECTED");
  assert.deepEqual(storage.read(), snapshot);
});

test("new schema fields are additive and do not create a personalized plan", () => {
  const user = new User({ studentId: "new-student", stream });
  assert.equal(user.plannerState, null);
  assert.equal(user.plannerVersion, 0);
  assert.equal(user.lastPlannerMutationId, null);
  assert.equal(user.customPlan, null);
});

test("oversized planner requests are rejected before database access", async () => {
  const find = mock.method(User, "findOne", async () => null);
  const result = await post("planner/save-plan", {
    studentId: "planner-test", expectedVersion: 0, mutationId: "oversized", plannerState: defaultPlan(), padding: "x".repeat(110000),
  });
  assert.equal(result.status, 413);
  assert.equal(find.mock.callCount(), 0);
  assert.equal(database.connectDatabase.mock.callCount(), 0);
});
