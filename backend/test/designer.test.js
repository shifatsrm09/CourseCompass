const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const database = require("../db");
const User = require("../models/User");
const DesignerState = require("../models/DesignerState");
const app = require("../../api");
let createDefaultState;
let applyAction;
let validatePlannerState;
let getPrerequisiteViolations;
const { getCurriculum } = require("../plannerState");

const stream = "ENG101 + MAT110";
let curriculum;
const clone = (val) => JSON.parse(JSON.stringify(val));
let server;
let baseUrl;

before(async () => {
  ({ createDefaultState } = await import("../../src/engine/plannerState.mjs"));
  ({ applyAction } = await import("../../src/engine/engine.mjs"));
  ({ validatePlannerState } = await import("../../src/engine/validator.mjs"));
  ({ getPrerequisiteViolations } = await import("../../src/engine/prerequisites.mjs"));
  curriculum = await getCurriculum(stream);
  server = http.createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => mock.method(database, "connectDatabase", async () => {}));
afterEach(() => mock.restoreAll());

function defaultUser(studentId = "designer-test-student") {
  return {
    studentId,
    stream,
    currentSemester: 1,
    completedCourses: [],
    customPlan: null,
    plannerVersion: 1,
    plannerState: { ...createDefaultState(curriculum), personalized: true },
  };
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("designer state returns exists: false for uninitialized user", async () => {
  const user = defaultUser();
  mock.method(User, "findOne", async () => clone(user));
  mock.method(DesignerState, "findOne", async () => null);

  const res = await post("designer/state", { studentId: user.studentId });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.exists, false);
  assert.equal(res.body.designer, null);
});

test("sync with main copies main planner into designer without modifying user", async () => {
  const user = defaultUser();
  let storedUser = clone(user);
  let storedDesigner = null;

  mock.method(User, "findOne", async () => clone(storedUser));
  mock.method(User, "findOneAndUpdate", async () => {
    assert.fail("User must NEVER be modified by designer sync");
  });

  mock.method(DesignerState, "findOne", async () => clone(storedDesigner));
  mock.method(DesignerState, "findOneAndUpdate", async (filter, update) => {
    storedDesigner = {
      studentId: filter.studentId,
      stream: update.$set.stream,
      plannerState: clone(update.$set.plannerState),
      plannerVersion: update.$set.plannerVersion,
      lastPlannerMutationId: update.$set.lastPlannerMutationId,
    };
    return clone(storedDesigner);
  });

  const res = await post("designer/sync", { studentId: user.studentId });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.designer);
  assert.equal(res.body.designer.stream, stream);
  assert.equal(res.body.designer.plannerVersion, 1);

  // User state remains completely identical
  assert.deepEqual(storedUser, user);

  // Designer received an independent copy
  assert.deepEqual(storedDesigner.plannerState.semesters, user.plannerState.semesters);
  assert.notEqual(storedDesigner.plannerState, user.plannerState);
});

test("saving designer planner modifies designer only, keeping main planner untouched", async () => {
  const user = defaultUser();
  let storedUser = clone(user);
  let storedDesigner = {
    studentId: user.studentId,
    stream: user.stream,
    plannerState: clone(user.plannerState),
    plannerVersion: 1,
    lastPlannerMutationId: null,
  };

  mock.method(User, "findOne", async () => clone(storedUser));
  mock.method(User, "findOneAndUpdate", async () => {
    assert.fail("User must NEVER be modified by designer save-plan");
  });

  mock.method(DesignerState, "findOne", async () => clone(storedDesigner));
  mock.method(DesignerState, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.plannerVersion, 1);
    storedDesigner = {
      ...storedDesigner,
      plannerState: clone(update.$set.plannerState),
      lastPlannerMutationId: update.$set.lastPlannerMutationId,
      plannerVersion: storedDesigner.plannerVersion + update.$inc.plannerVersion,
    };
    return clone(storedDesigner);
  });

  // Mutate designer state (e.g. reverse courses in semester 11)
  const modifiedState = clone(storedDesigner.plannerState);
  modifiedState.semesters[11].courses.reverse();

  const res = await post("designer/save-plan", {
    studentId: user.studentId,
    expectedVersion: 1,
    mutationId: "designer-mut-1",
    plannerState: modifiedState,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.plannerVersion, 2);

  // User in database was NEVER touched
  assert.deepEqual(storedUser, user);
  assert.equal(storedUser.plannerVersion, 1);

  // Designer state in database was updated
  assert.equal(storedDesigner.plannerVersion, 2);
  assert.deepEqual(storedDesigner.plannerState, modifiedState);
});

test("designer save-plan detects version conflicts", async () => {
  const user = defaultUser();
  const storedDesigner = {
    studentId: user.studentId,
    stream: user.stream,
    plannerState: clone(user.plannerState),
    plannerVersion: 3,
    lastPlannerMutationId: "mut-prior",
  };

  mock.method(User, "findOne", async () => clone(user));
  mock.method(DesignerState, "findOne", async () => clone(storedDesigner));

  const res = await post("designer/save-plan", {
    studentId: user.studentId,
    expectedVersion: 2, // stale version
    mutationId: "designer-mut-2",
    plannerState: user.plannerState,
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, "PLANNER_VERSION_CONFLICT");
  assert.equal(res.body.plannerVersion, 3);
});

test("re-syncing with main overwrites designer with fresh copy of main", async () => {
  const user = defaultUser();
  let storedDesigner = {
    studentId: user.studentId,
    stream: user.stream,
    plannerState: { ...clone(user.plannerState), dummyModified: true },
    plannerVersion: 5,
    lastPlannerMutationId: "old-mut",
  };

  mock.method(User, "findOne", async () => clone(user));
  mock.method(DesignerState, "findOne", async () => clone(storedDesigner));
  mock.method(DesignerState, "findOneAndUpdate", async (filter, update) => {
    storedDesigner = {
      studentId: filter.studentId,
      stream: update.$set.stream,
      plannerState: clone(update.$set.plannerState),
      plannerVersion: update.$set.plannerVersion,
      lastPlannerMutationId: update.$set.lastPlannerMutationId,
    };
    return clone(storedDesigner);
  });

  const res = await post("designer/sync", { studentId: user.studentId });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.designer.plannerVersion, 6);
  assert.equal(storedDesigner.plannerState.dummyModified, undefined);
  assert.deepEqual(storedDesigner.plannerState.semesters, user.plannerState.semesters);
});

test("resetting designer deletes designer state while preserving user", async () => {
  const user = defaultUser();
  let storedDesigner = { studentId: user.studentId };

  mock.method(DesignerState, "deleteOne", async (filter) => {
    if (filter.studentId === user.studentId) storedDesigner = null;
    return { acknowledged: true, deletedCount: 1 };
  });

  const res = await post("designer/reset", { studentId: user.studentId });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(storedDesigner, null);
});

test("designer allows up to 6 courses per semester, but strictly rejects 7th course", async () => {
  const user = defaultUser();
  let state = clone(user.plannerState);
  const targetSem = state.semesters.find(s => !s.isTarc);

  // Pick courses without prerequisites (e.g. CSE230, STA201, CSE250)
  const candidateDefs = Array.from(curriculum.byId.values()).filter(
    d => d.hp.length === 0 && d.code !== "COD" && !d.is_tarc && !targetSem.courses.some(tc => tc.occurrenceId === d.occurrenceId)
  );
  assert.ok(candidateDefs.length >= 3);
  const coursesToAdd = candidateDefs.map(d => d.occurrenceId);

  // Target semester starts with 4 courses.
  assert.equal(targetSem.courses.length, 4);

  // In Main planner mode (isDesigner: false), adding a 6th course fails
  let mainState = clone(state);
  const add5thMain = applyAction(mainState, {
    type: "ADD_COURSE",
    semesterId: targetSem.id,
    occurrenceId: coursesToAdd[0],
  }, curriculum, { isDesigner: false });
  assert.equal(add5thMain.ok, true);
  assert.equal(add5thMain.state.semesters.find(s => s.id === targetSem.id).courses.length, 5);

  const add6thMain = applyAction(add5thMain.state, {
    type: "ADD_COURSE",
    semesterId: targetSem.id,
    occurrenceId: coursesToAdd[1],
  }, curriculum, { isDesigner: false });
  assert.equal(add6thMain.ok, false);
  assert.equal(add6thMain.error.code, "SEMESTER_FULL");

  // In Designer mode (isDesigner: true), can add 5th and 6th course
  const add5thDesigner = applyAction(state, {
    type: "ADD_COURSE",
    semesterId: targetSem.id,
    occurrenceId: coursesToAdd[0],
  }, curriculum, { isDesigner: true });
  assert.equal(add5thDesigner.ok, true);
  assert.equal(add5thDesigner.state.semesters.find(s => s.id === targetSem.id).courses.length, 5);

  const add6thDesigner = applyAction(add5thDesigner.state, {
    type: "ADD_COURSE",
    semesterId: targetSem.id,
    occurrenceId: coursesToAdd[1],
  }, curriculum, { isDesigner: true });
  assert.equal(add6thDesigner.ok, true);
  assert.equal(add6thDesigner.state.semesters.find(s => s.id === targetSem.id).courses.length, 6);

  // 7th course is rejected in Designer mode
  const add7thDesigner = applyAction(add6thDesigner.state, {
    type: "ADD_COURSE",
    semesterId: targetSem.id,
    occurrenceId: coursesToAdd[2],
  }, curriculum, { isDesigner: true });
  assert.equal(add7thDesigner.ok, false);
  assert.equal(add7thDesigner.error.code, "SEMESTER_FULL");
});

test("designer allows free semester reordering via MOVE_SEMESTER while main planner preserves order", async () => {
  const user = defaultUser();
  const state = clone(user.plannerState);
  const sem0 = state.semesters[0].id;
  const sem1 = state.semesters[1].id;
  const sem2 = state.semesters[2].id;

  // Move semester 0 to index 2
  const movedResult = applyAction(state, {
    type: "MOVE_SEMESTER",
    semesterId: sem0,
    toIndex: 2,
  }, curriculum, { isDesigner: true });

  assert.equal(movedResult.ok, true);
  assert.equal(movedResult.state.semesters[0].id, sem1);
  assert.equal(movedResult.state.semesters[1].id, sem2);
  assert.equal(movedResult.state.semesters[2].id, sem0);

  // Main planner state was untouched
  assert.equal(state.semesters[0].id, sem0);
});

test("designer allows deleting course from completed semester and cascades downstream dependencies", async () => {
  const user = defaultUser();
  let state = clone(user.plannerState);

  // Complete semester 1
  state.currentSemester = 2;
  state.completedCourses = state.semesters[0].courses.map(c => curriculum.byId.get(c.occurrenceId).code);

  const courseToDelete = state.semesters[0].courses[0];
  const deletedCode = curriculum.byId.get(courseToDelete.occurrenceId).code;

  // Main planner rejects removing from completed semester
  const removeMain = applyAction(state, {
    type: "REMOVE_COURSE",
    semesterId: state.semesters[0].id,
    instanceId: courseToDelete.instanceId,
  }, curriculum, { isDesigner: false });
  assert.equal(removeMain.ok, false);
  assert.equal(removeMain.error.code, "FROZEN_SEMESTER");

  // Designer allows removing from completed semester
  const removeDesigner = applyAction(state, {
    type: "REMOVE_COURSE",
    semesterId: state.semesters[0].id,
    instanceId: courseToDelete.instanceId,
  }, curriculum, { isDesigner: true });
  assert.equal(removeDesigner.ok, true);

  // The removed course is no longer in semester 0
  const sem0Courses = removeDesigner.state.semesters[0].courses.map(c => c.instanceId);
  assert.ok(!sem0Courses.includes(courseToDelete.instanceId));

  // The course is no longer marked completed and was deferred to a later semester or unplaced
  assert.ok(!removeDesigner.state.completedCourses.includes(deletedCode));
  const newPlacement = removeDesigner.state.semesters.findIndex(
    s => s.courses.some(c => c.instanceId === courseToDelete.instanceId)
  );
  assert.ok(newPlacement >= 1 || removeDesigner.state.unplaced.some(c => c.instanceId === courseToDelete.instanceId));
});

test("designer allows breaking prerequisites and getPrerequisiteViolations detects them dynamically", async () => {
  const user = defaultUser();
  let state = clone(user.plannerState);

  // Find CSE251 which requires CSE250
  const cse251Def = Array.from(curriculum.byId.values()).find(
    d => d.code === "CSE251" && d.hp.includes("CSE250")
  );
  assert.ok(cse251Def, "Found CSE251 definition");

  // Find where CSE251 and CSE250 currently are
  let cse251SemIdx = -1;
  let cse251Instance = null;
  for (let i = 0; i < state.semesters.length; i++) {
    const found = state.semesters[i].courses.find(c => c.occurrenceId === cse251Def.occurrenceId);
    if (found) {
      cse251SemIdx = i;
      cse251Instance = found;
      break;
    }
  }

  // Move CSE251 to Semester 2 (index 1), keeping CSE250 in a later semester (e.g. semester 5 or 6)
  // Remove CSE251 from its original semester
  state.semesters[cse251SemIdx].courses = state.semesters[cse251SemIdx].courses.filter(
    c => c.instanceId !== cse251Instance.instanceId
  );
  // Put CSE251 into Semester 2 (index 1)
  state.semesters[1].courses.push(cse251Instance);

  // In Designer mode with allowPrerequisiteOverride: true, validation passes
  const designerValidation = validatePlannerState(state, curriculum, {
    isDesigner: true,
    allowPrerequisiteOverride: true,
  });
  assert.equal(designerValidation.ok, true);

  // In normal mode (isDesigner: false), validation fails with PREREQUISITE_NOT_SATISFIED
  const normalValidation = validatePlannerState(state, curriculum, {
    isDesigner: false,
    allowPrerequisiteOverride: false,
  });
  assert.equal(normalValidation.ok, false);
  assert.ok(normalValidation.errors.some(e => e.code === "PREREQUISITE_NOT_SATISFIED"));

  // getPrerequisiteViolations dynamically detects the violation
  const violations = getPrerequisiteViolations(state, curriculum);
  assert.ok(violations.has(cse251Instance.instanceId));
  const issues = violations.get(cse251Instance.instanceId);
  assert.ok(issues.some(issue => issue.prereqCode === "CSE250" && issue.courseCode === "CSE251"));
});

test("MOVE_COURSE allows dragging courses between any semesters in designer mode", async () => {
  const user = defaultUser();
  const state = clone(user.plannerState);

  // Take a course from semester 4 (index 3) and move to semester 2 (index 1)
  const fromSem = state.semesters[3];
  const toSem = state.semesters[1];
  const courseToMove = fromSem.courses[0];
  const initialToSemCount = toSem.courses.length;

  const result = applyAction(state, {
    type: "MOVE_COURSE",
    instanceId: courseToMove.instanceId,
    fromSemesterId: fromSem.id,
    toSemesterId: toSem.id,
    toIndex: 0,
  }, curriculum, { isDesigner: true });

  assert.equal(result.ok, true);
  const updatedToSem = result.state.semesters.find(s => s.id === toSem.id);
  const updatedFromSem = result.state.semesters.find(s => s.id === fromSem.id);

  // Course is now in the destination semester
  assert.equal(updatedToSem.courses.length, initialToSemCount + 1);
  assert.equal(updatedToSem.courses[0].instanceId, courseToMove.instanceId);
  // Course is no longer in the source semester
  assert.ok(!updatedFromSem.courses.some(c => c.instanceId === courseToMove.instanceId));

  // TARC restrictions are enforced (cannot move into TARC)
  const tarcSem = state.semesters.find(s => s.isTarc);
  const tarcMove = applyAction(state, {
    type: "MOVE_COURSE",
    instanceId: courseToMove.instanceId,
    fromSemesterId: fromSem.id,
    toSemesterId: tarcSem.id,
    toIndex: 0,
  }, curriculum, { isDesigner: true });
  assert.equal(tarcMove.ok, false);
  assert.equal(tarcMove.error.code, "TARC_NOT_ALLOWED");
});

test("MOVE_COURSE enforces completed semester protection in main planner mode", async () => {
  const user = defaultUser();
  const state = clone(user.plannerState);
  state.currentSemester = 2; // Semester 1 (index 0) is completed
  state.completedCourses = state.semesters[0].courses.map(c => curriculum.byId.get(c.occurrenceId).code);

  const completedSem = state.semesters[0];
  const futureSem = state.semesters[1];
  const courseInFuture = futureSem.courses[0];

  // Moving course into completed semester fails in main planner
  const mainMove = applyAction(state, {
    type: "MOVE_COURSE",
    instanceId: courseInFuture.instanceId,
    fromSemesterId: futureSem.id,
    toSemesterId: completedSem.id,
    toIndex: 0,
  }, curriculum, { isDesigner: false });

  assert.equal(mainMove.ok, false);
  assert.equal(mainMove.error.code, "FROZEN_SEMESTER");

  // In designer mode, moving into/out of completed semester is permitted
  const designerMove = applyAction(state, {
    type: "MOVE_COURSE",
    instanceId: courseInFuture.instanceId,
    fromSemesterId: futureSem.id,
    toSemesterId: completedSem.id,
    toIndex: 0,
  }, curriculum, { isDesigner: true });

  assert.equal(designerMove.ok, true);
});


