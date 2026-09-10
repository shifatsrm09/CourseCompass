const validText = value => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasOnlyKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

function allInstances(state) {
  return [...state.semesters.flatMap(semester => semester.courses), ...state.unplaced];
}

function completedAfterUndo(state, curriculum) {
  const latest = state.semesters[state.currentSemester - 2];
  const undoneCodes = new Set((latest?.courses || []).map(course => curriculum.byId.get(course.occurrenceId).code));
  const earlierCodes = new Set(state.semesters.slice(0, Math.max(0, state.currentSemester - 2)).flatMap(semester => semester.courses.map(course => curriculum.byId.get(course.occurrenceId).code)));
  return state.completedCourses.filter(code => !undoneCodes.has(code) || earlierCodes.has(code));
}

function validateTransition(state, previous, curriculum, errors) {
  const add = (code, message) => errors.push({ code, message });
  const before = new Map(allInstances(previous).map(course => [course.instanceId, course.occurrenceId]));
  const after = new Map(allInstances(state).map(course => [course.instanceId, course.occurrenceId]));
  for (const [id, occurrenceId] of before) {
    if (after.get(id) !== occurrenceId) add("COURSE_LOST", `Course instance ${id} was removed or changed identity.`);
  }
  for (const course of allInstances(state)) {
    if (!before.has(course.instanceId) && (curriculum.byId.get(course.occurrenceId)?.code !== "COD" || !course.instanceId.startsWith("extra:COD:"))) {
      add("UNEXPECTED_COURSE", `An unexpected course instance ${course.instanceId} was added.`);
    }
  }
  const frozenCount = previous.currentSemester - (state.currentSemester > previous.currentSemester ? 0 : 1);
  for (let index = 0; index < Math.min(frozenCount, previous.semesters.length); index++) {
    if (!same(previous.semesters[index], state.semesters[index])) add("FROZEN_SEMESTER", `Semester ${index + 1} is completed and cannot be rearranged.`);
  }
  const currentIndex = previous.currentSemester - 1;
  const oldCurrent = previous.semesters[currentIndex];
  const newCurrent = state.semesters[currentIndex];
  if (oldCurrent && (!newCurrent || oldCurrent.id !== newCurrent.id || oldCurrent.originalRow !== newCurrent.originalRow || oldCurrent.isTarc !== newCurrent.isTarc)) {
    add("FROZEN_SEMESTER", "The current semester cannot be reordered.");
  }
  if (state.currentSemester === previous.currentSemester && oldCurrent && newCurrent) {
    const existing = new Set(oldCurrent.courses.map(course => course.instanceId));
    const available = new Set(previous.completedCourses);
    state.semesters.slice(0, currentIndex).forEach(semester => semester.courses.forEach(course => available.add(curriculum.byId.get(course.occurrenceId).code)));
    for (const course of newCurrent.courses) {
      if (existing.has(course.instanceId)) continue;
      const definition = curriculum.byId.get(course.occurrenceId);
      if (!definition.hp.every(code => available.has(code))) add("PREREQUISITE_NOT_SATISFIED", `${definition.code} requires ${definition.hp.filter(code => !available.has(code)).join(", ")} before the current semester.`);
    }
  }
  const afterLocations = new Map(state.semesters.flatMap((semester, index) => semester.courses.map(course => [course.instanceId, { semester, index }])));
  previous.semesters.forEach((semester, index) => semester.courses.forEach(course => {
    const code = curriculum.byId.get(course.occurrenceId)?.code;
    if (code !== "COD" && previous.completedCourses.includes(code)) {
      const location = afterLocations.get(course.instanceId);
      if (!location || location.semester.id !== semester.id || location.index !== index) add("COMPLETED_COURSE_MOVED", `${code} is completed and must remain in its recorded semester.`);
    }
  }));
  const oldTarc = previous.semesters.find(semester => semester.isTarc);
  if (oldTarc) {
    const nextIndex = state.semesters.findIndex(semester => semester.isTarc);
    if (!same(oldTarc, state.semesters[nextIndex])) add("INVALID_TARC", "TARC must move as one unchanged semester with all its courses.");
    if (nextIndex < 2 && nextIndex !== previous.semesters.indexOf(oldTarc)) add("TARC_NOT_ALLOWED", "TARC cannot move before semester 3.");
  }
  if (![previous.currentSemester - 1, previous.currentSemester, previous.currentSemester + 1].includes(state.currentSemester)) add("INVALID_PROGRESSION", "Complete or undo only one semester at a time.");
  const expectedCompleted = new Set(state.currentSemester === previous.currentSemester - 1 ? completedAfterUndo(previous, curriculum) : previous.completedCourses);
  if (state.currentSemester === previous.currentSemester + 1) {
    const current = previous.semesters[previous.currentSemester - 1];
    if (!current) add("DEGREE_COMPLETED", "Every semester has already been completed.");
    for (const course of current?.courses || []) expectedCompleted.add(curriculum.byId.get(course.occurrenceId).code);
  }
  if (state.completedCourses.length !== expectedCompleted.size || state.completedCourses.some(code => !expectedCompleted.has(code))) add("INVALID_COMPLETION", "Completed courses must match the recorded semester completion.");
}

function validatePlannerState(state, curriculum, options = {}) {
  const errors = [];
  const add = (code, message, details = {}) => errors.push({ code, message, ...details });
  if (!hasOnlyKeys(state, ["schemaVersion", "stream", "semesters", "currentSemester", "completedCourses", "personalized", "unplaced"]) || state.schemaVersion !== 1 || state.stream !== curriculum.stream || !Array.isArray(state.semesters) || !state.semesters.length || state.semesters.length > 300 || !Array.isArray(state.unplaced) || !Array.isArray(state.completedCourses) || typeof state.personalized !== "boolean") {
    return { ok: false, errors: [{ code: "INVALID_PLANNER_STATE", message: "Planner state has an unsupported schema, stream, or semester list." }] };
  }
  if (!Number.isInteger(state.currentSemester) || state.currentSemester < 1 || state.currentSemester > state.semesters.length + 1) add("INVALID_SEMESTER", "Current semester must be a chronological position within the plan.");
  if (state.currentSemester === state.semesters.length + 1 && state.unplaced.length) add("UNPLACED_AFTER_COMPLETION", "A completed degree still has unscheduled courses. Restore their historical records before continuing.");
  if (state.completedCourses.some(code => !validText(code)) || new Set(state.completedCourses).size !== state.completedCourses.length) add("INVALID_COMPLETION", "Completed course codes must be unique nonempty strings.");
  const ids = new Set();
  const rows = new Set();
  const instances = new Set();
  const occurrences = new Set();
  const placements = new Map();
  const tarcIds = new Set();
  let codTotal = 0;
  const inspect = (course, index, semester) => {
    if (!hasOnlyKeys(course, ["instanceId", "occurrenceId"]) || !validText(course.instanceId) || !validText(course.occurrenceId) || !curriculum.byId.has(course.occurrenceId)) {
      add("MALFORMED_COURSE", "A planned course has an invalid instance or curriculum reference.");
      return;
    }
    const definition = curriculum.byId.get(course.occurrenceId);
    if (instances.has(course.instanceId)) add("DUPLICATE_COURSE_INSTANCE", `Course instance ${course.instanceId} appears more than once.`);
    instances.add(course.instanceId);
    const extraCod = definition.code === "COD" && /^extra:COD:[1-9]\d*$/.test(course.instanceId);
    if (occurrences.has(course.occurrenceId) && !extraCod) add("DUPLICATE_COURSE_OCCURRENCE", `Curriculum occurrence ${course.occurrenceId} appears more than once.`);
    if (!extraCod) occurrences.add(course.occurrenceId);
    if (definition.code === "COD") codTotal++;
    if (semester) {
      if (!!definition.is_tarc !== semester.isTarc) add("TARC_NOT_ALLOWED", `${definition.code} is in the wrong semester type.`);
      if (definition.is_tarc) tarcIds.add(semester.id);
      if (!placements.has(definition.code)) placements.set(definition.code, []);
      placements.get(definition.code).push(index);
    }
  };
  state.semesters.forEach((semester, index) => {
    if (!hasOnlyKeys(semester, ["id", "originalRow", "isTarc", "courses"]) || !validText(semester.id) || !Number.isInteger(semester.originalRow) || semester.originalRow < 1 || typeof semester.isTarc !== "boolean" || !Array.isArray(semester.courses)) {
      add("INVALID_SEMESTER", `Semester ${index + 1} is malformed.`);
      return;
    }
    if (ids.has(semester.id) || rows.has(semester.originalRow)) add("INVALID_SEMESTER_ORDER", "Semester identities and original rows must be unique.");
    ids.add(semester.id);
    rows.add(semester.originalRow);
    if (options.checkSchedule !== false && !semester.isTarc && semester.courses.length > 5) add("SEMESTER_FULL", `Semester ${index + 1} exceeds the five-course maximum.`);
    let codCount = 0;
    for (const course of semester.courses) {
      inspect(course, index, semester);
      if (curriculum.byId.get(course?.occurrenceId)?.code === "COD") codCount++;
    }
    if (options.checkSchedule !== false && codCount > 1) add("COD_SEMESTER_LIMIT", `Semester ${index + 1} contains more than one COD.`);
  });
  state.unplaced.forEach(course => inspect(course, -1, null));
  if (codTotal > 5) add("COD_LIMIT_REACHED", "A degree can contain at most five COD occurrences.");
  if (tarcIds.size > 1 || state.semesters.filter(semester => semester?.isTarc).length > 1) add("INVALID_TARC", "All TARC courses must stay together in one semester.");
  for (const course of curriculum.occurrences) {
    if (!occurrences.has(course.occurrenceId)) add("MISSING_COURSE", `Curriculum occurrence ${course.occurrenceId} has no planned or unscheduled instance.`);
  }
  if (!options.allowUnplaced && state.unplaced.length) add("UNPLACED_COURSES", `${state.unplaced.length} course(s) still need valid future placements.`);
  if (errors.length) return { ok: false, errors };
  if (options.checkSchedule !== false) {
    const completed = new Set(state.completedCourses);
    state.semesters.forEach((semester, index) => semester.courses.forEach(course => {
      const definition = curriculum.byId.get(course.occurrenceId);
      if (index < state.currentSemester || (definition.code !== "COD" && completed.has(definition.code))) return;
      for (const prerequisite of definition.hp) {
        if (completed.has(prerequisite) || placements.get(prerequisite)?.some(position => position < index)) continue;
        add("PREREQUISITE_NOT_SATISFIED", `${definition.code} in semester ${index + 1} requires ${prerequisite} in an earlier semester.`, { instanceId: course.instanceId, prerequisite });
      }
    }));
  }
  if (options.previousState) {
    const previous = validatePlannerState(options.previousState, curriculum, { allowUnplaced: true, checkSchedule: false });
    if (!previous.ok) add("INVALID_PREVIOUS_STATE", "The previous planner state is malformed; no transition can be validated.");
    else validateTransition(state, options.previousState, curriculum, errors);
  }
  return { ok: errors.length === 0, errors };
}

export { validatePlannerState, allInstances, completedAfterUndo };
