const { applyAction } = require("../engine.mjs");
const { validatePlannerState } = require("../validator.mjs");
const {
  buildCurriculum,
  createDefaultState,
  restorePlannerState,
  getSemesterStatus,
} = require("../plannerState.mjs");

const catalogs = {
  "ENG091-MAT092": require("../../data/ENG091-MAT092.json"),
  "ENG091-MAT110": require("../../data/ENG091-MAT110.json"),
  "ENG101-MAT092": require("../../data/ENG101-MAT092.json"),
  "ENG101-MAT110": require("../../data/ENG101-MAT110.json"),
  "ENG102-MAT092": require("../../data/ENG102-MAT092.json"),
  "ENG102-MAT110": require("../../data/ENG102-MAT110.json"),
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const course = (code, semester_row, hp = [], extra = {}) => ({
  code, title: code, semester_row, hp, sp: [], type: "Program Core", ...extra,
});

function freeze(value) {
  if (value instanceof Map) {
    value.forEach(freeze);
  } else if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
  }
  return value && typeof value === "object" ? Object.freeze(value) : value;
}

function setup(raw, stream = "test") {
  const curriculum = buildCurriculum(raw, stream);
  return { curriculum, state: createDefaultState(curriculum) };
}

function occurrence(curriculum, code, number = 0) {
  return curriculum.byCode.get(code)[number].occurrenceId;
}

function findCourse(state, curriculum, code, number = 0) {
  const id = occurrence(curriculum, code, number);
  for (let index = 0; index < state.semesters.length; index += 1) {
    const semester = state.semesters[index];
    const instance = semester.courses.find((item) => item.occurrenceId === id);
    if (instance) return { semester, index, instance };
  }
  return null;
}

function allInstances(state) {
  return [...state.semesters.flatMap((semester) => semester.courses), ...state.unplaced];
}

function assertInvariants(before, after, curriculum) {
  const instances = allInstances(after);
  expect(instances.map((item) => item.instanceId).sort()).toEqual(
    allInstances(before).map((item) => item.instanceId).sort()
  );
  expect(instances.map((item) => item.occurrenceId).sort()).toEqual(
    curriculum.occurrences.map((item) => item.occurrenceId).sort()
  );
  expect(new Set(instances.map((item) => item.instanceId)).size).toBe(instances.length);
  expect(new Set(instances.map((item) => item.occurrenceId)).size).toBe(instances.length);
  expect(after.unplaced).toEqual([]);
  expect(after.semesters.slice(0, before.currentSemester)).toEqual(
    before.semesters.slice(0, before.currentSemester)
  );
  expect(new Set(after.semesters.map((semester) => semester.id)).size).toBe(after.semesters.length);
  let codCount = 0;
  const completed = new Set(after.completedCourses);
  after.semesters.forEach((semester, index) => {
    const definitions = semester.courses.map((item) => curriculum.byId.get(item.occurrenceId));
    expect(definitions.every(Boolean)).toBe(true);
    if (!semester.isTarc) expect(definitions.length).toBeLessThanOrEqual(4);
    const cod = definitions.filter((item) => item.code === "COD").length;
    expect(cod).toBeLessThanOrEqual(1);
    codCount += cod;
    definitions.forEach((definition) => {
      expect(Boolean(definition.is_tarc)).toBe(semester.isTarc);
      if (index >= after.currentSemester) {
        definition.hp.filter((code) => code.trim()).forEach((prerequisite) => {
          expect(completed.has(prerequisite)).toBe(true);
        });
      }
    });
    definitions.forEach((definition) => completed.add(definition.code));
  });
  expect(codCount).toBeLessThanOrEqual(5);
  const validation = validatePlannerState(after, curriculum, { previousState: before });
  expect(validation.errors).toEqual([]);
  expect(validation.ok).toBe(true);
}

function succeed(state, action, curriculum) {
  const before = clone(state);
  const result = applyAction(freeze(state), freeze(action), freeze(curriculum));
  expect(result.error || null).toBeNull();
  expect(result.ok).toBe(true);
  expect(Array.isArray(result.changes)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);
  expect(state).toEqual(before);
  assertInvariants(before, result.state, curriculum);
  return result.state;
}

function reject(state, action, curriculum) {
  const before = clone(state);
  const result = applyAction(freeze(state), freeze(action), freeze(curriculum));
  expect(result.ok).toBe(false);
  expect(result.error.code).toEqual(expect.any(String));
  expect(result.error.message).toEqual(expect.any(String));
  expect(result.state).toEqual(before);
  expect(state).toEqual(before);
  return result;
}

function removeAction(state, curriculum, code, number = 0) {
  const found = findCourse(state, curriculum, code, number);
  return {
    type: "REMOVE_COURSE", semesterId: found.semester.id, instanceId: found.instance.instanceId,
  };
}

function addAction(curriculum, semesterId, code, number = 0) {
  return { type: "ADD_COURSE", semesterId, occurrenceId: occurrence(curriculum, code, number) };
}

describe("curriculum identity and initial state", () => {
  test.each(Object.entries(catalogs))("%s preserves the exact default sequence and all COD occurrences", (stream, raw) => {
    const snapshot = clone(raw);
    const { curriculum, state } = setup(freeze(raw), stream);
    expect(state.personalized).toBe(false);
    expect(state.currentSemester).toBe(1);
    expect(state.stream).toBe(stream);
    expect(state.semesters).toHaveLength(12);
    state.semesters.forEach((semester) => {
      expect(semester.courses.map((item) => curriculum.byId.get(item.occurrenceId).code)).toEqual(
        raw.filter((item) => item.semester_row === semester.originalRow).map((item) => item.code)
      );
    });
    expect(curriculum.byCode.get("COD")).toHaveLength(5);
    assertInvariants(state, state, curriculum);
    expect(createDefaultState(buildCurriculum(raw, stream))).toEqual(state);
    expect(raw).toEqual(snapshot);
  });

  test("normalizing a curriculum never changes its arrays or blank prerequisites", () => {
    const raw = freeze([course("A", 1), course("COD", 2, [""]), course("COD", 3, [])]);
    const snapshot = clone(raw);
    const { curriculum, state } = setup(raw);
    succeed(state, { type: "REBALANCE" }, curriculum);
    expect(raw).toEqual(snapshot);
  });

  test("rebalancing a valid default preserves every placement", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    const result = succeed(state, { type: "REBALANCE" }, curriculum);
    expect(result.semesters).toEqual(state.semesters);
    expect(result.personalized).toBe(true);
  });
});

describe("add, remove and replace scheduling", () => {
  test("adding relocates an existing normal occurrence into the requested semester", () => {
    const { state, curriculum } = setup([course("CURRENT", 1), course("A", 2), course("B", 3)]);
    const result = succeed(state, addAction(curriculum, "sem-2", "B"), curriculum);
    expect(findCourse(result, curriculum, "B").semester.id).toBe("sem-2");
    expect(findCourse(result, curriculum, "A").semester.id).toBe("sem-2");
    expect(result.personalized).toBe(true);
  });

  test("a current-semester course satisfies a future hard prerequisite", () => {
    const { state, curriculum } = setup([course("A", 1), course("FILL", 2), course("B", 3, ["A"])]);
    const result = succeed(state, addAction(curriculum, "sem-2", "B"), curriculum);
    expect(findCourse(result, curriculum, "B").index).toBe(1);
  });

  test("a hard prerequisite in the same requested semester is insufficient", () => {
    const { state, curriculum } = setup([course("CURRENT", 1), course("A", 2), course("B", 3, ["A"])]);
    reject(state, addAction(curriculum, "sem-2", "B"), curriculum);
  });

  test("CSE423 can move to its earliest valid semester without duplication", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    const result = succeed(state, addAction(curriculum, "sem-6", "CSE423"), curriculum);
    expect(findCourse(result, curriculum, "CSE423").semester.id).toBe("sem-6");
    expect(result.semesters.find((semester) => semester.id === "sem-6").courses).toHaveLength(4);
  });

  test("removal postpones to the earliest future slot and skips TARC", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("A", 2), course("TARC", 3, [], { is_tarc: true }), course("B", 4),
    ]);
    const result = succeed(state, removeAction(state, curriculum, "A"), curriculum);
    expect(findCourse(result, curriculum, "A").semester.id).toBe("sem-4");
  });

  test("CSE250 removal propagates actual hard dependencies while leaving soft prerequisites optional", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    const result = succeed(state, removeAction(state, curriculum, "CSE250"), curriculum);
    expect(findCourse(result, curriculum, "CSE250").index).toBe(4);
    expect(findCourse(result, curriculum, "CSE251").index).toBe(5);
    expect(findCourse(result, curriculum, "CSE260").index).toBe(6);
    expect(curriculum.byCode.get("CSE340")[0].hp).toEqual([]);
    expect(result.semesters.slice(0, 3)).toEqual(state.semesters.slice(0, 3));
  });

  test("removal propagates an eighteen-level hard dependency chain", () => {
    const raw = [course("CURRENT", 1)];
    for (let level = 0; level < 18; level += 1) {
      raw.push(course(`CHAIN${level}`, level + 2, level ? [`CHAIN${level - 1}`] : []));
    }
    const { state, curriculum } = setup(raw);
    const result = succeed(state, removeAction(state, curriculum, "CHAIN0"), curriculum);
    for (let level = 0; level < 18; level += 1) {
      expect(findCourse(result, curriculum, `CHAIN${level}`).index).toBe(level + 2);
    }
  });

  test("replacement preserves and postpones the outgoing course and repairs its dependents", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("A", 2), course("B", 3, ["A"]), course("REPLACEMENT", 4),
    ]);
    const source = findCourse(state, curriculum, "A");
    const result = succeed(state, {
      type: "REPLACE_COURSE", semesterId: source.semester.id,
      instanceId: source.instance.instanceId, occurrenceId: occurrence(curriculum, "REPLACEMENT"),
    }, curriculum);
    expect(findCourse(result, curriculum, "REPLACEMENT").index).toBe(1);
    expect(findCourse(result, curriculum, "A").index).toBe(2);
    expect(findCourse(result, curriculum, "B").index).toBe(3);
  });

  test("full semesters cascade overflow using original course priority", () => {
    const raw = [course("CURRENT", 1)];
    ["A", "B", "C", "D"].forEach((code) => raw.push(course(code, 2)));
    ["E", "F", "G", "H"].forEach((code) => raw.push(course(code, 3)));
    raw.push(course("REQUESTED", 4));
    const { state, curriculum } = setup(raw);
    const result = succeed(state, addAction(curriculum, "sem-2", "REQUESTED"), curriculum);
    expect(findCourse(result, curriculum, "REQUESTED").index).toBe(1);
    expect(result.semesters[1].courses).toHaveLength(4);
    expect(result.semesters[2].courses).toHaveLength(4);
    expect(result.semesters).toHaveLength(4);
    expect(findCourse(result, curriculum, "D").index).toBe(2);
    expect(findCourse(result, curriculum, "H").index).toBe(3);
  });

  test("removing from the last semester creates a future semester with fewer than four courses", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), ...["A", "B", "C", "D"].map((code) => course(code, 2)),
    ]);
    const result = succeed(state, removeAction(state, curriculum, "A"), curriculum);
    expect(result.semesters).toHaveLength(3);
    expect(result.semesters[2].courses).toHaveLength(1);
    expect(findCourse(result, curriculum, "A").index).toBe(2);
  });

  test("existing spare capacity is used before a new semester is added", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("A", 2), ...["B", "C", "D"].map((code) => course(code, 3)),
    ]);
    const result = succeed(state, removeAction(state, curriculum, "A"), curriculum);
    expect(result.semesters).toHaveLength(3);
    expect(result.semesters[2].courses).toHaveLength(4);
  });

  test("a failed replacement cannot delete its source course", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("SOURCE", 2), course("PRE", 3), course("TARGET", 4, ["PRE"]),
    ]);
    const source = findCourse(state, curriculum, "SOURCE");
    reject(state, {
      type: "REPLACE_COURSE", semesterId: source.semester.id,
      instanceId: source.instance.instanceId, occurrenceId: occurrence(curriculum, "TARGET"),
    }, curriculum);
  });
});

describe("COD occurrence rules", () => {
  function codSetup() {
    return setup([
      course("CURRENT", 1), course("TARGET", 2),
      ...[3, 4, 5, 6, 7].map((row) => course("COD", row)), course("LAST", 8),
    ]);
  }

  test("adding COD moves the closest future occurrence even if a later occurrence is requested", () => {
    const { state, curriculum } = codSetup();
    const closest = findCourse(state, curriculum, "COD", 0).instance;
    const result = succeed(state, addAction(curriculum, "sem-2", "COD", 4), curriculum);
    expect(result.semesters[1].courses).toContainEqual(closest);
    expect(result.semesters[2].courses).not.toContainEqual(closest);
    expect(findCourse(result, curriculum, "COD", 4).index).toBe(6);
  });

  test("a second COD in the same semester is rejected", () => {
    const { state, curriculum } = codSetup();
    reject(state, addAction(curriculum, "sem-3", "COD", 1), curriculum);
  });

  test("five CODs and no future occurrence produces an atomic failure", () => {
    const { state, curriculum } = codSetup();
    reject(state, addAction(curriculum, "sem-8", "COD"), curriculum);
  });

  test("removing COD skips occupied COD semesters without losing any occurrence", () => {
    const { state, curriculum } = codSetup();
    const result = succeed(state, removeAction(state, curriculum, "COD"), curriculum);
    expect(findCourse(result, curriculum, "COD").index).toBe(7);
  });
});

describe("TARC, completed and current semesters", () => {
  test("TARC can move from third to fifth position with its instances intact", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    const tarc = clone(state.semesters[2]);
    const result = succeed(state, { type: "MOVE_TARC", semesterId: tarc.id, toIndex: 4 }, curriculum);
    expect(result.semesters[4]).toEqual(tarc);
    expect(result.semesters.filter((semester) => semester.isTarc)).toHaveLength(1);
  });

  test("normal courses cannot be added to TARC and TARC courses cannot be removed", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    reject(state, addAction(curriculum, "sem-3", "CSE250"), curriculum);
    reject(state, removeAction(state, curriculum, "ENG102"), curriculum);
  });

  test("TARC cannot cross into the frozen current semester", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    reject(state, { type: "MOVE_TARC", semesterId: "sem-3", toIndex: 0 }, curriculum);
  });

  test("completed and current courses are protected against direct edits and auto-balancing", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    state.currentSemester = 4;
    state.completedCourses = state.semesters.slice(0, 3).flatMap((semester) =>
      semester.courses.map((instance) => curriculum.byId.get(instance.occurrenceId).code)
    );
    reject(state, removeAction(state, curriculum, "CSE110"), curriculum);
    reject(state, removeAction(state, curriculum, "CSE250"), curriculum);
    reject(state, addAction(curriculum, "sem-4", "CSE423"), curriculum);
    reject(state, addAction(curriculum, "sem-5", "CSE110"), curriculum);
    const result = succeed(state, removeAction(state, curriculum, "CSE251"), curriculum);
    expect(result.semesters.slice(0, 4)).toEqual(state.semesters.slice(0, 4));
  });

  test("explicit completed prerequisites satisfy future placement without modifying the catalog", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("FILL", 2), course("B", 3, ["EXTERNAL"]),
    ]);
    state.completedCourses = ["EXTERNAL"];
    const result = succeed(state, addAction(curriculum, "sem-2", "B"), curriculum);
    expect(findCourse(result, curriculum, "B").index).toBe(1);
    expect(result.completedCourses).toEqual(["EXTERNAL"]);
  });

  test("completing the current semester updates course completion and derived statuses", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    expect(getSemesterStatus(state, 0)).toBe("current");
    expect(getSemesterStatus(state, 1)).toBe("recommended");
    const result = succeed(state, { type: "COMPLETE_SEMESTER", semesterId: "sem-1" }, curriculum);
    expect(result.currentSemester).toBe(2);
    expect(result.completedCourses).toEqual(expect.arrayContaining(["CSE110", "MAT110", "ENG101", "PHY111"]));
    expect(getSemesterStatus(result, 0)).toBe("completed");
    expect(getSemesterStatus(result, 1)).toBe("current");
    expect(getSemesterStatus(result, 3)).toBe("locked");
    expect(result.semesters).toEqual(state.semesters);
  });

  test("an unrelated future semester cannot be marked complete", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    reject(state, { type: "COMPLETE_SEMESTER", semesterId: "sem-4" }, curriculum);
  });
});

describe("validation, rollback and exact restoration", () => {
  const validRaw = [course("CURRENT", 1), course("A", 2), course("B", 3, ["A"])];

  test.each([
    ["missing occurrence", (state) => { state.semesters[2].courses = []; }],
    ["duplicate instance", (state) => { state.semesters[2].courses.push(clone(state.semesters[1].courses[0])); }],
    ["unknown occurrence", (state) => { state.semesters[2].courses[0].occurrenceId = "unknown"; }],
    ["malformed instance", (state) => { state.semesters[2].courses[0] = null; }],
    ["duplicate semester identity", (state) => { state.semesters[2].id = state.semesters[1].id; }],
    ["invalid current semester", (state) => { state.currentSemester = 0; }],
    ["hard prerequisite in the same semester", (state) => {
      state.semesters[1].courses.push(state.semesters[2].courses.pop());
    }],
  ])("validator rejects %s without throwing", (name, corrupt) => {
    const { state, curriculum } = setup(validRaw);
    corrupt(state);
    const result = validatePlannerState(state, curriculum);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("validator detects a fifth normal course", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), ...["A", "B", "C", "D"].map((code) => course(code, 2)), course("E", 3),
    ]);
    state.semesters[1].courses.push(state.semesters[2].courses.pop());
    expect(validatePlannerState(state, curriculum).ok).toBe(false);
  });

  test("validator detects normal courses placed inside TARC", () => {
    const { state, curriculum } = setup([
      course("CURRENT", 1), course("A", 2), course("TARC", 3, [], { is_tarc: true }),
    ]);
    state.semesters[2].courses.push(state.semesters[1].courses.pop());
    expect(validatePlannerState(state, curriculum).ok).toBe(false);
  });

  test("validator detects multiple CODs in one semester and excessive global COD count", () => {
    const five = setup([course("CURRENT", 1), ...[2, 3, 4, 5, 6].map((row) => course("COD", row))]);
    five.state.semesters[1].courses.push(five.state.semesters[2].courses.pop());
    expect(validatePlannerState(five.state, five.curriculum).ok).toBe(false);
    const six = setup([course("CURRENT", 1), ...[2, 3, 4, 5, 6, 7].map((row) => course("COD", row))]);
    expect(validatePlannerState(six.state, six.curriculum).ok).toBe(false);
  });

  test("validator detects changes to the frozen historical region", () => {
    const { state, curriculum } = setup(validRaw);
    const changed = clone(state);
    const current = changed.semesters[0].courses[0];
    changed.semesters[0].courses[0] = changed.semesters[1].courses[0];
    changed.semesters[1].courses[0] = current;
    expect(validatePlannerState(changed, curriculum, { previousState: state }).ok).toBe(false);
  });

  test.each([
    ["missing prerequisite", [course("CURRENT", 1), course("A", 2, ["MISSING"])]],
    ["dependency cycle", [course("CURRENT", 1), course("A", 2, ["B"]), course("B", 3, ["A"])]],
  ])("%s returns a structured failure while preserving all courses", (name, raw) => {
    const { state, curriculum } = setup(raw);
    reject(state, { type: "REBALANCE" }, curriculum);
  });

  test("unknown course, semester and action produce atomic failures", () => {
    const { state, curriculum } = setup(validRaw);
    reject(state, { type: "ADD_COURSE", semesterId: "sem-2", occurrenceId: "unknown" }, curriculum);
    reject(state, addAction(curriculum, "missing-semester", "B"), curriculum);
    reject(state, { type: "NOT_AN_ACTION" }, curriculum);
  });

  test("same frozen input and action produce exactly the same result", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"]);
    const action = freeze(removeAction(state, curriculum, "CSE250"));
    freeze(state);
    freeze(curriculum);
    expect(applyAction(state, action, curriculum)).toEqual(applyAction(state, action, curriculum));
  });

  test("save and reload retain every personalized placement and occurrence identity exactly", () => {
    const { state, curriculum } = setup(catalogs["ENG101-MAT110"], "ENG101-MAT110");
    const changed = succeed(state, removeAction(state, curriculum, "CSE250"), curriculum);
    const stored = clone({ stream: "ENG101-MAT110", plannerState: changed });
    const restored = restorePlannerState(stored, curriculum);
    expect(restored.ok).toBe(true);
    expect(restored.state).toEqual(changed);
    expect(restorePlannerState(clone(stored), curriculum).state).toEqual(changed);
  });

  test("legacy missing courses are recovered as explicit unplaced instances before balancing", () => {
    const { curriculum } = setup(validRaw);
    const stored = freeze({
      stream: "test", currentSemester: 1,
      customPlan: [
        { semester: 1, courses: ["CURRENT"] },
        { semester: 2, courses: ["A"] },
        { semester: 3, courses: [] },
      ],
    });
    const restored = restorePlannerState(stored, curriculum);
    expect(restored.ok).toBe(true);
    expect(restored.state.unplaced).toHaveLength(1);
    expect(restored.state.unplaced[0].occurrenceId).toBe(occurrence(curriculum, "B"));
    expect(restored.warnings.length).toBeGreaterThan(0);
    const balanced = succeed(restored.state, { type: "REBALANCE" }, curriculum);
    expect(findCourse(balanced, curriculum, "B").index).toBe(2);
  });

  test("legacy restoration reports invalid prerequisites without secretly reordering the saved plan", () => {
    const { curriculum } = setup(validRaw);
    const stored = freeze({
      stream: "test", currentSemester: 1,
      customPlan: [
        { semester: 1, courses: ["CURRENT"] },
        { semester: 2, courses: ["B"] },
        { semester: 3, courses: ["A"] },
      ],
    });
    const restored = restorePlannerState(stored, curriculum);
    expect(restored.ok).toBe(true);
    expect(findCourse(restored.state, curriculum, "B").index).toBe(1);
    expect(findCourse(restored.state, curriculum, "A").index).toBe(2);
    expect(restored.warnings.length).toBeGreaterThan(0);
    const balanced = succeed(restored.state, { type: "REBALANCE" }, curriculum);
    expect(findCourse(balanced, curriculum, "B").index).toBeGreaterThan(findCourse(balanced, curriculum, "A").index);
  });

  test.each(["UNKNOWN", "A"])("legacy extra %s is reported without filtering or mutating saved data", (extra) => {
    const { curriculum } = setup(validRaw);
    const stored = freeze({
      stream: "test", currentSemester: 1,
      customPlan: [
        { semester: 1, courses: ["CURRENT"] },
        { semester: 2, courses: ["A"] },
        { semester: 3, courses: ["B", extra] },
      ],
    });
    const before = clone(stored);
    const restored = restorePlannerState(stored, curriculum);
    expect(restored.ok).toBe(false);
    expect(restored.error.message).toEqual(expect.any(String));
    expect(stored).toEqual(before);
  });
});

describe("seeded action sequences", () => {
  function generator(seed) {
    let value = seed >>> 0;
    return (limit) => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value % limit;
    };
  }

  function randomCurriculum(random) {
    const raw = [];
    for (let row = 1; row <= 10; row += 1) {
      if (row === 3) {
        raw.push(course("TARC_A", row, [], { is_tarc: true }), course("TARC_B", row, [], { is_tarc: true }));
      } else {
        const earlier = raw.filter((item) => item.semester_row < row && !item.is_tarc && item.code !== "COD");
        for (let position = 0; position < 3; position += 1) {
          const hp = earlier.length && random(3) === 0 ? [earlier[random(earlier.length)].code] : [];
          raw.push(course(`R${row}C${position}`, row, hp));
        }
        if (row >= 4 && row <= 8) raw.push(course("COD", row));
      }
    }
    return raw;
  }

  test.each(Array.from({ length: 12 }, (_, index) => index + 1))("seed %i preserves invariants across sixty rapid actions", (seed) => {
    const random = generator(seed);
    const { curriculum, state: initial } = setup(randomCurriculum(random), `seed-${seed}`);
    let state = initial;
    let successful = 0;
    for (let step = 0; step < 60; step += 1) {
      const future = state.semesters.slice(state.currentSemester).filter((semester) => !semester.isTarc);
      const targets = future.length ? future : state.semesters;
      const target = targets[random(targets.length)];
      const selected = curriculum.occurrences[random(curriculum.occurrences.length)];
      const type = random(6);
      let action;
      if (type === 0) {
        action = { type: "ADD_COURSE", semesterId: target.id, occurrenceId: selected.occurrenceId };
      } else if (type === 1 || type === 2) {
        const source = target.courses[random(target.courses.length)] || { instanceId: "missing" };
        action = {
          type: type === 1 ? "REMOVE_COURSE" : "REPLACE_COURSE", semesterId: target.id,
          instanceId: source.instanceId, occurrenceId: selected.occurrenceId,
        };
      } else if (type === 3) {
        const tarc = state.semesters.find((semester) => semester.isTarc);
        action = { type: "MOVE_TARC", semesterId: tarc.id, toIndex: random(state.semesters.length) };
      } else if (type === 4 && step % 13 === 0) {
        const current = state.semesters[state.currentSemester - 1];
        action = { type: "COMPLETE_SEMESTER", semesterId: current ? current.id : "missing" };
      } else {
        action = { type: "REBALANCE" };
      }
      const before = clone(state);
      const result = applyAction(freeze(state), freeze(action), freeze(curriculum));
      expect(applyAction(state, action, curriculum)).toEqual(result);
      expect(state).toEqual(before);
      if (result.ok) {
        successful += 1;
        assertInvariants(before, result.state, curriculum);
        state = result.state;
      } else {
        expect(result.state).toEqual(before);
        expect(result.error.code).toEqual(expect.any(String));
      }
    }
    expect(successful).toBeGreaterThan(10);
  });
});
