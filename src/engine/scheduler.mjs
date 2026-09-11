import { isCompletedInstance } from "./plannerState.mjs";

function planningError(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function validateDependencyGraph(state, curriculum) {
  const satisfied = new Set(state.completedCourses);
  state.semesters.slice(0, state.currentSemester).forEach(semester => semester.courses.forEach(course => satisfied.add(curriculum.byId.get(course.occurrenceId).code)));
  const future = [...state.semesters.slice(state.currentSemester).flatMap(semester => semester.courses), ...state.unplaced];
  const availableCodes = new Set([...satisfied, ...future.map(course => curriculum.byId.get(course.occurrenceId).code)]);
  const missingByInstance = new Map();
  const waitingByCode = new Map();
  const providers = new Map();
  const ready = [];
  for (const course of future) {
    const definition = curriculum.byId.get(course.occurrenceId);
    const missing = new Set(isCompletedInstance(state, course, curriculum) ? [] : definition.hp.filter(code => !satisfied.has(code)));
    missingByInstance.set(course.instanceId, missing);
    if (!missing.size) ready.push(course);
    for (const prerequisite of missing) {
      if (!availableCodes.has(prerequisite)) planningError("PREREQUISITE_NOT_FOUND", `Hard prerequisite ${prerequisite} is neither completed nor present in the plan.`);
      if (!waitingByCode.has(prerequisite)) waitingByCode.set(prerequisite, []);
      waitingByCode.get(prerequisite).push(course);
    }
  }
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const course = ready[cursor];
    missingByInstance.delete(course.instanceId);
    const code = curriculum.byId.get(course.occurrenceId).code;
    if (satisfied.has(code)) continue;
    satisfied.add(code);
    providers.set(code, course);
    for (const dependent of waitingByCode.get(code) || []) {
      const missing = missingByInstance.get(dependent.instanceId);
      if (missing?.delete(code) && !missing.size) ready.push(dependent);
    }
  }
  if (missingByInstance.size) {
    const blocked = future.filter(course => missingByInstance.has(course.instanceId)).map(course => curriculum.byId.get(course.occurrenceId).code);
    planningError("PREREQUISITE_CYCLE", `Hard-prerequisite cycle prevents scheduling: ${[...new Set(blocked)].join(", ")}.`);
  }
  return providers;
}

function fixedPrerequisiteDeadlines(state, curriculum, pinned, providers, notBefore) {
  const deadlines = new Map();
  const positions = new Map();
  const anchors = [];
  state.semesters.forEach((semester, index) => semester.courses.forEach(course => {
    positions.set(course.instanceId, index);
    if (index >= state.currentSemester && (semester.isTarc || pinned.has(course.instanceId))) anchors.push({ course, index });
  }));
  for (let cursor = 0; cursor < anchors.length; cursor++) {
    const { course, index } = anchors[cursor];
    if (isCompletedInstance(state, course, curriculum)) continue;
    for (const code of curriculum.byId.get(course.occurrenceId).hp) {
      const provider = providers.get(code);
      if (!provider) continue;
      const latest = index - 1;
      const previousDeadline = deadlines.get(provider.instanceId) ?? Infinity;
      if (latest >= previousDeadline) continue;
      if (latest < Math.max(state.currentSemester, notBefore.get(provider.instanceId) ?? state.currentSemester)) planningError("PREREQUISITE_NOT_SATISFIED", `${code} is required before semester ${index + 1}, which conflicts with its allowed placement. Move the dependent course or TARC first.`);
      deadlines.set(provider.instanceId, latest);
      anchors.push({ course: provider, index: latest });
    }
  }
  for (const [instanceId, deadline] of deadlines) {
    const position = positions.get(instanceId);
    if (position == null || position <= deadline) continue;
    const semester = state.semesters[position];
    if (semester.isTarc) planningError("PREREQUISITE_NOT_SATISFIED", "A required TARC course is scheduled too late. Move the whole TARC semester first.");
    const courseIndex = semester.courses.findIndex(course => course.instanceId === instanceId);
    state.unplaced.push(...semester.courses.splice(courseIndex, 1));
    notBefore.set(instanceId, deadline);
  }
  return deadlines;
}

function scheduleFuture(state, curriculum, { notBefore = new Map(), pinned = new Set() } = {}) {
  for (const course of state.unplaced) {
    if (isCompletedInstance(state, course, curriculum)) planningError("COMPLETED_COURSE_UNPLACED", `${curriculum.byId.get(course.occurrenceId).code} is recorded as completed but its historical placement is missing. Restore that record before changing the plan.`);
  }
  const providers = validateDependencyGraph(state, curriculum);
  const deadlines = fixedPrerequisiteDeadlines(state, curriculum, pinned, providers, notBefore);
  const completed = new Set(state.completedCourses);
  state.semesters.slice(0, state.currentSemester).forEach(semester => semester.courses.forEach(course => completed.add(curriculum.byId.get(course.occurrenceId).code)));
  let pending = state.unplaced.map(course => ({ course, start: notBefore.get(course.instanceId) ?? state.currentSemester }));
  state.unplaced = [];
  const compare = (a, b) => {
    const first = curriculum.byId.get(a.occurrenceId);
    const second = curriculum.byId.get(b.occurrenceId);
    return first.semester_row - second.semester_row || first.priority - second.priority || a.instanceId.localeCompare(b.instanceId, "en");
  };
  const protectedCourse = course => pinned.has(course.instanceId) || isCompletedInstance(state, course, curriculum);
  let index = state.currentSemester;
  while (index < state.semesters.length || pending.length) {
    if (index >= 300) planningError("NO_VALID_FUTURE_SEMESTER", "The plan exceeds 300 semesters. Check its prerequisite data before continuing.");
    if (index >= state.semesters.length) {
      const originalRow = Math.max(...state.semesters.map(semester => semester.originalRow)) + 1;
      state.semesters.push({ id: `sem-${originalRow}`, originalRow, isTarc: false, courses: [] });
    }
    const semester = state.semesters[index];
    if (semester.isTarc) {
      for (const course of semester.courses) {
        const definition = curriculum.byId.get(course.occurrenceId);
        if (!isCompletedInstance(state, course, curriculum) && !definition.hp.every(code => completed.has(code))) {
          planningError("PREREQUISITE_NOT_SATISFIED", `TARC course ${definition.code} requires ${definition.hp.filter(code => !completed.has(code)).join(", ")} before semester ${index + 1}.`);
        }
      }
    } else {
      const currentIndex = index;
      const incoming = pending.filter(entry => entry.start <= currentIndex).map(entry => entry.course);
      pending = pending.filter(entry => entry.start > currentIndex);
      const candidates = [...semester.courses, ...incoming];
      const existingCod = semester.courses.find(course => curriculum.byId.get(course.occurrenceId).code === "COD");
      const eligible = [];
      for (const course of candidates) {
        const definition = curriculum.byId.get(course.occurrenceId);
        if (definition.is_tarc) planningError("INVALID_TARC", "Unscheduled TARC courses require their original TARC semester to be restored together.");
        const ready = isCompletedInstance(state, course, curriculum) || definition.hp.every(code => completed.has(code));
        if (!ready && pinned.has(course.instanceId)) planningError("PREREQUISITE_NOT_SATISFIED", `${definition.code} requires ${definition.hp.filter(code => !completed.has(code)).join(", ")} in an earlier semester.`);
        if (definition.code === "COD" && existingCod && incoming.includes(course) && !pinned.has(course.instanceId)) pending.push({ course, start: index + 1 });
        else if (ready) eligible.push(course);
        else pending.push({ course, start: index + 1 });
      }
      eligible.sort((a, b) => Number(protectedCourse(b)) - Number(protectedCourse(a)) || Number((deadlines.get(b.instanceId) ?? Infinity) <= currentIndex) - Number((deadlines.get(a.instanceId) ?? Infinity) <= currentIndex) || compare(a, b));
      const selected = new Set();
      let codPlaced = false;
      // The engine's own placement decisions (auto balance, rebalancing after an
      // edit, filling future semesters) always target 4 courses per semester.
      // A 5th slot is only ever available when the user explicitly pinned a
      // course into this semester in the current action (ADD_COURSE / REPLACE_COURSE) -
      // that is what "protectedCourse" pinning represents here. The engine itself
      // will never grow a semester to 5 on its own.
      const hasProtected = eligible.some((course) => protectedCourse(course));
      const cap = hasProtected ? 5 : 4;
      for (const course of eligible) {
        const isCod = curriculum.byId.get(course.occurrenceId).code === "COD";
        if (selected.size < cap && !(isCod && codPlaced)) {
          selected.add(course.instanceId);
          codPlaced ||= isCod;
        } else {
          if (protectedCourse(course)) planningError(isCod ? "COD_SEMESTER_LIMIT" : "SEMESTER_FULL", `Semester ${index + 1} cannot fit this request without moving a protected course.`);
          pending.push({ course, start: index + 1 });
        }
      }
      semester.courses = [
        ...semester.courses.filter(course => selected.has(course.instanceId)),
        ...incoming.filter(course => selected.has(course.instanceId)).sort(compare),
      ];
    }
    for (const course of semester.courses) completed.add(curriculum.byId.get(course.occurrenceId).code);
    index++;
  }
  return state;
}

export { scheduleFuture, planningError };
