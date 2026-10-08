import { validateDesignerPlan } from "../designerValidation.mjs";
import { buildCurriculum, createDefaultState } from "../plannerState.mjs";

describe("validateDesignerPlan", () => {
  const curriculum = buildCurriculum([
    { code: "CSE110", semester_row: 1, hp: [], type: "Program Core" },
    { code: "CSE111", semester_row: 2, hp: ["CSE110"], type: "Program Core" },
    { code: "CSE220", semester_row: 3, hp: ["CSE111"], type: "Program Core" },
    { code: "PHY111", semester_row: 1, hp: [], type: "Basic Science" },
    { code: "PHY112", semester_row: 2, hp: ["PHY111"], type: "Basic Science" },
    { code: "MAT120", semester_row: 3, hp: [], type: "Basic Science" },
    { code: "CSE250", semester_row: 4, hp: [], type: "Program Core" },
    { code: "CSE251", semester_row: 5, hp: ["CSE250"], type: "Program Core" },
    { code: "CSE321", semester_row: 4, hp: [], type: "Program Core" },
    { code: "CSE370", semester_row: 4, hp: [], type: "Program Core" },
    { code: "COD", semester_row: 4, hp: [], type: "GenEd" },
  ], "test");

  test("1. Valid plan has 0 Problems and 0 Warnings", () => {
    const state = createDefaultState(curriculum);
    const result = validateDesignerPlan(state, curriculum);

    expect(result.summary.problemCount).toBe(0);
    expect(result.summary.warningCount).toBe(0);
    expect(result.problems).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test("2. CSE111 before CSE110 triggers 1 prerequisite Problem", () => {
    const state = createDefaultState(curriculum);
    // Find CSE110 in sem 1 and CSE111 in sem 2, and swap them
    const cse110Idx = state.semesters[0].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE110");
    const cse111Idx = state.semesters[1].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE111");

    const [cse110] = state.semesters[0].courses.splice(cse110Idx, 1);
    const [cse111] = state.semesters[1].courses.splice(cse111Idx, 1);

    state.semesters[0].courses.push(cse111);
    state.semesters[1].courses.push(cse110);

    const result = validateDesignerPlan(state, curriculum);

    expect(result.summary.problemCount).toBe(1);
    expect(result.problems[0].type).toBe("PREREQUISITE_VIOLATION");
    expect(result.problems[0].courses).toContain("CSE111");
    expect(result.problems[0].courses).toContain("CSE110");
    expect(result.problems[0].message).toContain("CSE111 requires CSE110");
  });

  test("3. Fixing the prerequisite order clears the Problem", () => {
    const state = createDefaultState(curriculum);
    // Break order
    const cse110Idx = state.semesters[0].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE110");
    const cse111Idx = state.semesters[1].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE111");
    const [cse110] = state.semesters[0].courses.splice(cse110Idx, 1);
    const [cse111] = state.semesters[1].courses.splice(cse111Idx, 1);
    state.semesters[0].courses.push(cse111);
    state.semesters[1].courses.push(cse110);

    expect(validateDesignerPlan(state, curriculum).summary.problemCount).toBe(1);

    // Swap back
    state.semesters[0].courses.pop();
    state.semesters[1].courses.pop();
    state.semesters[0].courses.push(cse110);
    state.semesters[1].courses.push(cse111);

    const result = validateDesignerPlan(state, curriculum);
    expect(result.summary.problemCount).toBe(0);
  });

  test("4 & 5. 6th course generates course overload Problem, and removing it clears it", () => {
    const state = createDefaultState(curriculum);
    const sem4 = state.semesters[3];

    // Ensure sem 4 has 6 courses
    while (sem4.courses.length < 6) {
      sem4.courses.push({
        instanceId: `test:extra:${sem4.courses.length}`,
        occurrenceId: curriculum.occurrences[0].occurrenceId,
      });
    }

    const resultWith6 = validateDesignerPlan(state, curriculum);
    const overloadProblems = resultWith6.problems.filter(p => p.type === "COURSE_OVERLOAD");
    expect(overloadProblems.length).toBeGreaterThanOrEqual(1);
    expect(overloadProblems[0].message).toContain("contains 6 courses");

    // Remove 6th course
    sem4.courses.pop();
    const resultWith5 = validateDesignerPlan(state, curriculum);
    const overloadAfter = resultWith5.problems.filter(p => p.type === "COURSE_OVERLOAD");
    expect(overloadAfter).toHaveLength(0);
  });

  test("6 & 7. 4th lab course generates lab-load Warning, and removing it clears it", () => {
    const state = createDefaultState(curriculum);
    // Put 4 lab courses in semester 4: CSE110, CSE111, CSE220, PHY111
    const sem4 = state.semesters[3];
    sem4.courses = [
      { instanceId: "l1", occurrenceId: curriculum.byCode.get("CSE110")[0].occurrenceId },
      { instanceId: "l2", occurrenceId: curriculum.byCode.get("CSE111")[0].occurrenceId },
      { instanceId: "l3", occurrenceId: curriculum.byCode.get("CSE220")[0].occurrenceId },
      { instanceId: "l4", occurrenceId: curriculum.byCode.get("PHY111")[0].occurrenceId },
    ];

    const resultWith4Labs = validateDesignerPlan(state, curriculum);
    const labWarnings = resultWith4Labs.warnings.filter(w => w.type === "LAB_OVERLOAD");
    expect(labWarnings).toHaveLength(1);
    expect(labWarnings[0].message).toContain("contains 4 lab courses");

    // Remove 4th lab
    sem4.courses.pop();
    const resultWith3Labs = validateDesignerPlan(state, curriculum);
    const labWarningsAfter = resultWith3Labs.warnings.filter(w => w.type === "LAB_OVERLOAD");
    expect(labWarningsAfter).toHaveLength(0);
  });

  test("8 & 9. Multiple violations are listed separately and fixing one leaves the other", () => {
    const state = createDefaultState(curriculum);

    // Cause prerequisite problem: CSE111 before CSE110
    const cse110Idx = state.semesters[0].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE110");
    const cse111Idx = state.semesters[1].courses.findIndex(c => curriculum.byId.get(c.occurrenceId).code === "CSE111");
    const [cse110] = state.semesters[0].courses.splice(cse110Idx, 1);
    const [cse111] = state.semesters[1].courses.splice(cse111Idx, 1);
    state.semesters[0].courses.push(cse111);
    state.semesters[1].courses.push(cse110);

    // Cause course overload in sem 3 (6 courses)
    const sem3 = state.semesters[2];
    while (sem3.courses.length < 6) {
      sem3.courses.push({ instanceId: `overload:${sem3.courses.length}`, occurrenceId: curriculum.occurrences[0].occurrenceId });
    }

    const multi = validateDesignerPlan(state, curriculum);
    expect(multi.problems.some(p => p.type === "PREREQUISITE_VIOLATION")).toBe(true);
    expect(multi.problems.some(p => p.type === "COURSE_OVERLOAD")).toBe(true);

    // Fix overload only
    while (sem3.courses.length > 3) sem3.courses.pop();
    const fixedOverload = validateDesignerPlan(state, curriculum);
    expect(fixedOverload.problems.some(p => p.type === "COURSE_OVERLOAD")).toBe(false);
    expect(fixedOverload.problems.some(p => p.type === "PREREQUISITE_VIOLATION")).toBe(true);
  });
});
