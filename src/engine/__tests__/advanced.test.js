const { applyAction } = require("../engine.mjs");
const { validatePlannerState } = require("../validator.mjs");
const { buildCurriculum, createDefaultState, getSemesterStatus, restorePlannerState } = require("../plannerState.mjs");

const clone = (value) => JSON.parse(JSON.stringify(value));
const course = (code, semester_row, hp = [], extra = {}) => ({ code, semester_row, hp, sp: [], ...extra });
const all = (state) => [...state.semesters.flatMap((semester) => semester.courses), ...state.unplaced];

function setup(raw) {
  const curriculum = buildCurriculum(raw);
  return { curriculum, state: createDefaultState(curriculum) };
}

function id(curriculum, code) {
  return curriculum.byCode.get(code)[0].occurrenceId;
}

function act(state, action, curriculum, expected = true) {
  const before = clone(state);
  const result = applyAction(state, action, curriculum);
  expect(result).toEqual(applyAction(state, action, curriculum));
  expect(state).toEqual(before);
  expect(result.ok).toBe(expected);
  if (result.ok) {
    const checked = validatePlannerState(result.state, curriculum, { previousState: state });
    expect(checked.errors).toEqual([]);
    expect(checked.ok).toBe(true);
    expect(new Set(all(result.state).map((item) => item.instanceId)).size).toBe(all(result.state).length);
    const after = new Map(all(result.state).map((item) => [item.instanceId, item.occurrenceId]));
    all(state).forEach((item) => expect(after.get(item.instanceId)).toBe(item.occurrenceId));
  } else {
    expect(result.state).toEqual(before);
    expect(result.error.code).toEqual(expect.any(String));
    expect(result.error.message.length).toBeGreaterThan(0);
  }
  return result;
}

test("distinct definitions sharing a code do not collapse their dependency graph", () => {
  const { curriculum, state } = setup([
    course("CURRENT", 1), course("A", 2), course("B", 3, ["A"]), course("A", 4, ["B"]),
  ]);
  const result = act(state, { type: "REBALANCE" }, curriculum);
  expect(result.state.semesters).toEqual(state.semesters);
  expect(curriculum.byCode.get("A")).toHaveLength(2);
});

test("original semester priority wins even when JSON entries are not sorted by semester", () => {
  const { curriculum, state } = setup([
    course("CURRENT", 1), course("LATE1", 3), course("LATE2", 3), course("LATE3", 3), course("LATE4", 3), course("EARLY", 2),
  ]);
  const source = state.semesters[1].courses[0];
  const result = act(state, { type: "REMOVE_COURSE", semesterId: "sem-2", instanceId: source.instanceId }, curriculum);
  expect(result.state.semesters[2].courses).toContainEqual(source);
  expect(result.state.semesters[2].courses).toHaveLength(4);
});

test("overflow protects prerequisites with fixed TARC deadlines", () => {
  const raw = require("../../data/ENG091-MAT110.json");
  const { curriculum, state } = setup(raw);
  const result = act(state, { type: "ADD_COURSE", semesterId: "sem-2", occurrenceId: id(curriculum, "COD") }, curriculum);
  const codes = result.state.semesters[1].courses.map(instance => curriculum.byId.get(instance.occurrenceId).code);
  expect(codes).toContain("ENG101");
  expect(codes).toContain("COD");
  expect(codes).toHaveLength(4);
  expect(result.state.semesters[2]).toEqual(state.semesters[2]);
});

test("moving TARC earlier can advance its prerequisite chain into available future space", () => {
  const { curriculum, state } = setup([
    course("CURRENT", 1), course("FILL", 2), course("A", 3), course("B", 4, ["A"]), course("T", 5, ["B"], { is_tarc: true }),
  ]);
  const result = act(state, { type: "MOVE_TARC", semesterId: "sem-5", toIndex: 3 }, curriculum);
  expect(result.state.semesters[3].isTarc).toBe(true);
  const location = code => result.state.semesters.findIndex(semester => semester.courses.some(instance => curriculum.byId.get(instance.occurrenceId).code === code));
  expect(location("A")).toBe(1);
  expect(location("B")).toBe(2);
});

test("unscheduled courses after degree completion produce a recovery error", () => {
  const { curriculum, state } = setup([course("CURRENT", 1), course("A", 2)]);
  state.currentSemester = 3;
  state.unplaced.push(state.semesters[1].courses.pop());
  const result = act(state, { type: "REBALANCE" }, curriculum, false);
  expect(result.error.code).toBe("UNPLACED_AFTER_COMPLETION");
});

describe("additional COD occurrences", () => {
  function codSetup() {
    return setup([
      course("CURRENT", 1), course("A", 2), course("COD", 3),
      ...[4, 5, 6, 7, 8].map((row) => course(`F${row}`, row)),
    ]);
  }

  test("an explicit COD addition can create an instance when fewer than five exist and none is in the future", () => {
    const { curriculum, state } = codSetup();
    const result = act(state, { type: "ADD_COURSE", semesterId: "sem-4", occurrenceId: id(curriculum, "COD") }, curriculum);
    expect(all(result.state)).toHaveLength(all(state).length + 1);
    expect(result.state.semesters[2].courses).toEqual(state.semesters[2].courses);
    const extra = result.state.semesters[3].courses.find((item) => item.instanceId.startsWith("extra:COD:"));
    expect(extra).toBeDefined();
    expect(extra.occurrenceId).toBe(id(curriculum, "COD"));
    expect(restorePlannerState({ plannerState: clone(result.state) }, curriculum).state).toEqual(result.state);
  });

  test("extra COD instances count toward the five-course global maximum", () => {
    const { curriculum, state: initial } = codSetup();
    let state = initial;
    for (let row = 4; row <= 7; row += 1) {
      state = act(state, { type: "ADD_COURSE", semesterId: `sem-${row}`, occurrenceId: id(curriculum, "COD") }, curriculum).state;
    }
    expect(all(state).filter((item) => curriculum.byId.get(item.occurrenceId).code === "COD")).toHaveLength(5);
    act(state, { type: "ADD_COURSE", semesterId: "sem-8", occurrenceId: id(curriculum, "COD") }, curriculum, false);
  });

  test("a canonical COD remains valid when an extra instance using its metadata appears earlier", () => {
    const { curriculum, state } = codSetup();
    const added = act(state, { type: "ADD_COURSE", semesterId: "sem-4", occurrenceId: id(curriculum, "COD") }, curriculum).state;
    const canonical = added.semesters[2].courses[0];
    const moved = act(added, { type: "REMOVE_COURSE", semesterId: "sem-3", instanceId: canonical.instanceId }, curriculum).state;
    expect(moved.semesters[4].courses).toContainEqual(canonical);
    expect(moved.semesters[3].courses.some((item) => item.instanceId.startsWith("extra:COD:"))).toBe(true);
  });
});

describe("completed course protection and progression", () => {
  test("a completed course recorded in a future semester stays fixed when a full semester overflows", () => {
    const { curriculum, state } = setup([
      course("CURRENT", 1),
      ...["A", "B", "C", "DONE"].map((code) => course(code, 2)), course("REQUESTED", 3),
    ]);
    state.completedCourses = ["DONE"];
    const completed = state.semesters[1].courses[3];
    const result = act(state, { type: "ADD_COURSE", semesterId: "sem-2", occurrenceId: id(curriculum, "REQUESTED") }, curriculum).state;
    expect(result.semesters[1].courses).toContainEqual(completed);
    act(state, { type: "REMOVE_COURSE", semesterId: "sem-2", instanceId: completed.instanceId }, curriculum, false);
  });

  test("a request cannot displace any of four completed courses", () => {
    const { curriculum, state } = setup([
      course("CURRENT", 1), ...["A", "B", "C", "D"].map((code) => course(code, 2)), course("REQUESTED", 3),
    ]);
    state.completedCourses = ["A", "B", "C", "D"];
    act(state, { type: "ADD_COURSE", semesterId: "sem-2", occurrenceId: id(curriculum, "REQUESTED") }, curriculum, false);
  });

  test("an unplaced completed course requires historical recovery instead of being scheduled again", () => {
    const { curriculum, state } = setup([course("CURRENT", 1), course("DONE", 2)]);
    state.completedCourses = ["DONE"];
    state.unplaced.push(state.semesters[1].courses.pop());
    act(state, { type: "REBALANCE" }, curriculum, false);
  });

  test("completing the final semester finishes the degree and rejects stale repeated completion", () => {
    const { curriculum, state } = setup([course("A", 1), course("B", 2, ["A"])]);
    const second = act(state, { type: "COMPLETE_SEMESTER", semesterId: "sem-1" }, curriculum).state;
    act(second, { type: "COMPLETE_SEMESTER", semesterId: "sem-1" }, curriculum, false);
    const finished = act(second, { type: "COMPLETE_SEMESTER", semesterId: "sem-2" }, curriculum).state;
    expect(finished.currentSemester).toBe(3);
    expect(finished.completedCourses).toEqual(["A", "B"]);
    expect(finished.semesters.map((_, index) => getSemesterStatus(finished, index))).toEqual(["completed", "completed"]);
    act(finished, { type: "COMPLETE_SEMESTER", semesterId: "sem-2" }, curriculum, false);
    expect(act(finished, { type: "REBALANCE" }, curriculum).state.semesters).toEqual(finished.semesters);
  });

  test("moving TARC cannot shift a recorded completed course to another chronological semester", () => {
    const { curriculum, state } = setup([
      course("CURRENT", 1), course("A", 2), course("TARC", 3, [], { is_tarc: true }),
      course("DONE", 4), course("B", 5),
    ]);
    state.completedCourses = ["DONE"];
    act(state, { type: "MOVE_TARC", semesterId: "sem-3", toIndex: 4 }, curriculum, false);
  });

  test("TARC already completed or current cannot be moved", () => {
    const { curriculum, state } = setup([
      course("A", 1), course("B", 2), course("TARC", 3, [], { is_tarc: true }), course("C", 4),
    ]);
    state.currentSemester = 3;
    act(state, { type: "MOVE_TARC", semesterId: "sem-3", toIndex: 3 }, curriculum, false);
    state.currentSemester = 4;
    act(state, { type: "MOVE_TARC", semesterId: "sem-3", toIndex: 3 }, curriculum, false);
  });

  test("moving TARC earlier than its prerequisite chain can fit returns an atomic error", () => {
    const { curriculum, state } = setup([
      course("CURRENT", 1), course("A", 2), course("B", 3, ["A"]), course("PRE", 4, ["B"]),
      course("TARC", 5, ["PRE"], { is_tarc: true }),
    ]);
    act(state, { type: "MOVE_TARC", semesterId: "sem-5", toIndex: 2 }, curriculum, false);
  });
});

describe("defensive state and dependency validation", () => {
  test.each([
    null, undefined, false, 12, "state", [], {},
  ])("malformed planner value %p produces structured validation and action errors", (bad) => {
    const { curriculum } = setup([course("A", 1)]);
    expect(validatePlannerState(bad, curriculum).ok).toBe(false);
    expect(applyAction(bad, { type: "REBALANCE" }, curriculum).ok).toBe(false);
  });

  test.each([
    ["null semester", (state) => { state.semesters[0] = null; }],
    ["null course list", (state) => { state.semesters[0].courses = null; }],
    ["primitive course", (state) => { state.semesters[0].courses[0] = 5; }],
    ["null unplaced instance", (state) => { state.unplaced.push(null); }],
    ["invalid completed value", (state) => { state.completedCourses.push(null); }],
    ["invalid original row", (state) => { state.semesters[0].originalRow = -1; }],
    ["noninteger current semester", (state) => { state.currentSemester = 1.5; }],
    ["wrong stream", (state) => { state.stream = "wrong"; }],
  ])("validator and engine do not throw for %s", (name, corrupt) => {
    const { curriculum, state } = setup([course("A", 1)]);
    corrupt(state);
    expect(validatePlannerState(state, curriculum).ok).toBe(false);
    expect(applyAction(state, { type: "REBALANCE" }, curriculum).ok).toBe(false);
  });

  test("malformed prior state is rejected without a transition-validator exception", () => {
    const { curriculum, state } = setup([course("A", 1)]);
    const result = validatePlannerState(state, curriculum, { previousState: {} });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("a missing prerequisite deep in a chain reports the missing course and preserves every instance", () => {
    const raw = [course("CURRENT", 1)];
    for (let index = 0; index < 24; index += 1) {
      raw.push(course(`D${index}`, index + 2, index ? [`D${index - 1}`] : ["ABSENT"]));
    }
    const { curriculum, state } = setup(raw);
    const result = act(state, { type: "REBALANCE" }, curriculum, false);
    expect(result.error.message).toContain("ABSENT");
  });
});

describe("actions against every production stream", () => {
  const streams = ["ENG091-MAT092", "ENG091-MAT110", "ENG101-MAT092", "ENG101-MAT110", "ENG102-MAT092", "ENG102-MAT110"];

  test.each(streams)("%s remains valid across a reproducible sequence of sixty actions", (stream) => {
    const raw = require(`../../data/${stream}.json`);
    const rawBefore = clone(raw);
    const curriculum = buildCurriculum(raw, stream);
    let state = createDefaultState(curriculum);
    const count = all(state).length;
    let accepted = 0;
    for (let step = 0; step < 60; step += 1) {
      const future = state.semesters.slice(state.currentSemester).filter((semester) => !semester.isTarc);
      const semester = future[(step * 17 + 3) % future.length] || state.semesters[state.semesters.length - 1];
      const occurrence = curriculum.occurrences[(step * 19 + 7) % curriculum.occurrences.length];
      const source = semester.courses[(step * 3) % semester.courses.length];
      const tarc = state.semesters.find((item) => item.isTarc);
      const actions = [
        { type: "ADD_COURSE", semesterId: semester.id, occurrenceId: occurrence.occurrenceId },
        { type: "REMOVE_COURSE", semesterId: semester.id, instanceId: source?.instanceId },
        { type: "REPLACE_COURSE", semesterId: semester.id, instanceId: source?.instanceId, occurrenceId: occurrence.occurrenceId },
        { type: "MOVE_TARC", semesterId: tarc.id, toIndex: 2 + step % 5 },
        { type: "REBALANCE" },
      ];
      const action = actions[step % actions.length];
      const before = clone(state);
      const result = applyAction(state, action, curriculum);
      expect(result).toEqual(applyAction(state, action, curriculum));
      expect(state).toEqual(before);
      if (result.ok) {
        accepted += 1;
        expect(validatePlannerState(result.state, curriculum, { previousState: state }).errors).toEqual([]);
        expect(all(result.state)).toHaveLength(count);
        expect(all(result.state).map((item) => item.instanceId).sort()).toEqual(all(state).map((item) => item.instanceId).sort());
        expect(result.state.semesters[0]).toEqual(state.semesters[0]);
        state = result.state;
        expect(restorePlannerState({ plannerState: clone(state) }, curriculum).state).toEqual(state);
      } else {
        expect(result.state).toEqual(before);
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    }
    expect(accepted).toBeGreaterThan(15);
    expect(raw).toEqual(rawBefore);
  });
});
