import { validatePlannerState } from "./validator.mjs";

function buildCurriculum(flat, stream = "test") {
  const counts = new Map();
  const byId = new Map();
  const byCode = new Map();
  const occurrences = flat.map((course, priority) => {
    if (!course || typeof course.code !== "string" || !Number.isInteger(course.semester_row) || course.semester_row < 1) {
      throw new Error("Curriculum contains an invalid course or semester row.");
    }
    const key = `${course.code}@${course.semester_row}`;
    const ordinal = (counts.get(key) || 0) + 1;
    counts.set(key, ordinal);
    const occurrence = Object.freeze({
      ...course,
      hp: Object.freeze((course.hp || []).filter(code => typeof code === "string" && code.trim()).map(code => code.trim())),
      sp: Object.freeze((course.sp || []).filter(code => typeof code === "string" && code.trim()).map(code => code.trim())),
      occurrenceId: `${key}:${ordinal}`,
      priority,
    });
    byId.set(occurrence.occurrenceId, occurrence);
    if (!byCode.has(course.code)) byCode.set(course.code, []);
    byCode.get(course.code).push(occurrence);
    return occurrence;
  });
  return { stream, occurrences: Object.freeze(occurrences), byId, byCode };
}

function createInstance(occurrence) {
  return { instanceId: `course:${occurrence.occurrenceId}`, occurrenceId: occurrence.occurrenceId };
}

function createDefaultState(curriculum) {
  const rows = new Map();
  for (const course of curriculum.occurrences) {
    if (!rows.has(course.semester_row)) {
      rows.set(course.semester_row, { id: `sem-${course.semester_row}`, originalRow: course.semester_row, isTarc: false, courses: [] });
    }
    const semester = rows.get(course.semester_row);
    semester.isTarc ||= !!course.is_tarc;
    semester.courses.push(createInstance(course));
  }
  return {
    schemaVersion: 1,
    stream: curriculum.stream,
    currentSemester: 1,
    completedCourses: [],
    personalized: false,
    semesters: [...rows.values()].sort((a, b) => a.originalRow - b.originalRow),
    unplaced: [],
  };
}

function cloneState(state) {
  return {
    ...state,
    completedCourses: [...state.completedCourses],
    semesters: state.semesters.map(semester => ({ ...semester, courses: semester.courses.map(course => ({ ...course })) })),
    unplaced: state.unplaced.map(course => ({ ...course })),
  };
}

function getSemesterStatus(state, index) {
  if (index < state.currentSemester - 1) return "completed";
  if (index === state.currentSemester - 1) return "current";
  if (index === state.currentSemester) return "recommended";
  return "locked";
}

function isCompletedInstance(state, course, curriculum) {
  const definition = curriculum.byId.get(course.occurrenceId);
  return definition?.code !== "COD" && state.completedCourses.includes(definition?.code);
}

function restorePlannerState(user, curriculum) {
  const warnings = [];
  try {
    let state;
    if (user.plannerState != null) {
      const validation = validatePlannerState(user.plannerState, curriculum, { allowUnplaced: true, checkSchedule: false });
      if (!validation.ok) return { ok: false, error: validation.errors[0], warnings: validation.errors };
      state = cloneState(user.plannerState);
    } else {
      state = createDefaultState(curriculum);
      state.currentSemester = user.currentSemester ?? 1;
      state.completedCourses = [...(user.completedCourses || [])];
      if (user.customPlan != null) {
        if (!Array.isArray(user.customPlan) || !user.customPlan.length) throw new Error("The saved course plan is empty or malformed.");
        const used = new Set();
        const requests = [];
        state.semesters = user.customPlan.map(row => {
          if (!Number.isInteger(row.semester) || row.semester < 1 || !Array.isArray(row.courses)) throw new Error("The saved plan has an invalid semester.");
          const semester = { id: `sem-${row.semester}`, originalRow: row.semester, isTarc: false, courses: [] };
          for (const savedCode of row.courses) {
            let code = savedCode;
            if (code === "EMB101" && !curriculum.byCode.has(code) && curriculum.byCode.has("DEV/EMB101")) {
              code = "DEV/EMB101";
              warnings.push({ code: "COURSE_CODE_MIGRATED", message: "The saved EMB101 reference now uses DEV/EMB101 from this stream." });
            }
            if (!curriculum.byCode.has(code)) throw new Error(`Saved course ${String(savedCode)} is not in the selected stream. Its saved data has been preserved.`);
            requests.push({ semester, code });
          }
          return semester;
        });
        for (const request of requests) {
          const match = curriculum.byCode.get(request.code).find(course => course.semester_row === request.semester.originalRow && !used.has(course.occurrenceId));
          if (match) { request.match = match; used.add(match.occurrenceId); }
        }
        for (const request of requests) {
          if (!request.match) {
            request.match = curriculum.byCode.get(request.code).find(course => !used.has(course.occurrenceId));
            if (!request.match) throw new Error(`The saved plan contains extra ${request.code} occurrences. Review is required before editing; no courses have been deleted.`);
            used.add(request.match.occurrenceId);
          }
          request.semester.courses.push(createInstance(request.match));
          request.semester.isTarc ||= !!request.match.is_tarc;
        }
        state.unplaced = curriculum.occurrences.filter(course => !used.has(course.occurrenceId)).map(createInstance);
        state.personalized = true;
        if (state.unplaced.length) warnings.push({ code: "UNPLACED_COURSES", message: `${state.unplaced.length} curriculum course(s) were missing from the saved plan. They are shown as unscheduled; Auto Balance will attempt to place them.` });
      } else if (Array.isArray(user.semesterOrder) && user.semesterOrder.length) {
        const rows = new Map(state.semesters.map(semester => [semester.originalRow, semester]));
        if (user.semesterOrder.length !== rows.size || new Set(user.semesterOrder).size !== rows.size || user.semesterOrder.some(row => !rows.has(row))) throw new Error("The saved semester order does not match this stream.");
        state.semesters = user.semesterOrder.map(row => rows.get(row));
      }
      const completed = state.semesters.slice(0, state.currentSemester - 1).flatMap(semester => semester.courses.map(course => curriculum.byId.get(course.occurrenceId).code));
      state.completedCourses = [...new Set([...state.completedCourses, ...completed])];
    }
    const structural = validatePlannerState(state, curriculum, { allowUnplaced: true, checkSchedule: false });
    if (!structural.ok) return { ok: false, state, error: structural.errors[0], warnings: structural.errors };
    const validation = validatePlannerState(state, curriculum, { allowUnplaced: true });
    warnings.push(...validation.errors);
    return { ok: true, state, warnings };
  } catch (error) {
    return { ok: false, error: { code: "INVALID_SAVED_PLAN", message: error.message }, warnings };
  }
}

export { buildCurriculum, createDefaultState, createInstance, cloneState, getSemesterStatus, isCompletedInstance, restorePlannerState };
