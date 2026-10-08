import { cloneState, isCompletedInstance } from "./plannerState.mjs";
import { validatePlannerState, allInstances, completedAfterUndo } from "./validator.mjs";
import { scheduleFuture, planningError } from "./scheduler.mjs";

function editableSemester(state, semesterId, options = {}) {
  const index = state.semesters.findIndex(semester => semester.id === semesterId);
  if (index < 0) planningError("SEMESTER_NOT_FOUND", "The selected semester is no longer in this plan.");
  if (!options.isDesigner && index < state.currentSemester - 1) planningError("FROZEN_SEMESTER", "Completed semesters are protected. Undo the most recent completion before editing it.");
  if (state.semesters[index].isTarc) planningError("TARC_NOT_ALLOWED", "Courses cannot be added, replaced, or removed in TARC.");
  return index;
}

function deferCourse(state, index, instanceId, curriculum, notBefore, options = {}) {
  const courses = state.semesters[index].courses;
  const position = courses.findIndex(course => course.instanceId === instanceId);
  if (position < 0) planningError("COURSE_NOT_FOUND", "The selected course is no longer in that semester.");
  const course = courses[position];
  if (!options.isDesigner && isCompletedInstance(state, course, curriculum)) planningError("COMPLETED_COURSE", "Completed courses cannot be moved or removed.");
  courses.splice(position, 1);
  state.unplaced.push(course);
  notBefore.set(course.instanceId, index + 1);
  if (options.isDesigner) {
    const code = curriculum.byId.get(course.occurrenceId)?.code;
    if (code && state.completedCourses?.includes(code)) {
      state.completedCourses = state.completedCourses.filter(c => c !== code);
    }
  }
  return course;
}

function insertCourse(state, index, occurrenceId, curriculum, excludedId, options = {}) {
  const definition = curriculum.byId.get(occurrenceId);
  if (!definition) planningError("COURSE_NOT_FOUND", "Select a course from this stream's curriculum.");
  if (definition.is_tarc) planningError("TARC_NOT_ALLOWED", "TARC courses stay in their TARC semester.");
  const target = state.semesters[index];
  const maxAllowed = options.isDesigner ? 6 : 5;
  if (target.courses.length >= maxAllowed) {
    planningError("SEMESTER_FULL", `Semester ${index + 1} cannot exceed ${maxAllowed} courses.`);
  }
  const codeOf = course => curriculum.byId.get(course.occurrenceId).code;
  if (target.courses.some(course => definition.code === "COD" ? codeOf(course) === "COD" : course.occurrenceId === occurrenceId)) planningError("COURSE_ALREADY_EXISTS", `${definition.code} is already in this semester.`);
  if (!options.isDesigner && definition.code !== "COD" && state.completedCourses.includes(definition.code)) planningError("COMPLETED_COURSE", `${definition.code} has already been completed.`);
  let source;
  let sourceList;
  if (definition.code === "COD") {
    for (const semester of state.semesters.slice(index + 1)) {
      source = semester.courses.find(course => codeOf(course) === "COD" && course.instanceId !== excludedId);
      if (source) { sourceList = semester.courses; break; }
    }
    if (!source) {
      source = state.unplaced.find(course => codeOf(course) === "COD" && course.instanceId !== excludedId);
      sourceList = state.unplaced;
    }
    if (!source) {
      const cod = allInstances(state).filter(course => codeOf(course) === "COD");
      if (cod.length >= 5) planningError("COD_LIMIT_REACHED", "Five COD occurrences are already allocated, and none is available in a later semester.");
      const ids = new Set(cod.map(course => course.instanceId));
      let ordinal = 1;
      while (ids.has(`extra:COD:${ordinal}`)) ordinal++;
      source = { instanceId: `extra:COD:${ordinal}`, occurrenceId };
      sourceList = null;
    }
  } else {
    for (let position = 0; position < state.semesters.length; position++) {
      const semester = state.semesters[position];
      source = semester.courses.find(course => course.occurrenceId === occurrenceId && course.instanceId !== excludedId);
      if (source) {
        if (!options.isDesigner && position < state.currentSemester - 1) planningError("FROZEN_SEMESTER", `${definition.code} is in a completed semester and cannot be moved.`);
        sourceList = semester.courses;
        break;
      }
    }
    if (!source) {
      source = state.unplaced.find(course => course.occurrenceId === occurrenceId && course.instanceId !== excludedId);
      sourceList = state.unplaced;
    }
    if (!source) planningError("COURSE_NOT_FOUND", `${definition.code} has no available course occurrence to move.`);
  }
  if (sourceList) sourceList.splice(sourceList.indexOf(source), 1);
  target.courses.push(source);
  return source;
}

function describeChanges(before, after, curriculum) {
  const positions = state => new Map([
    ...state.semesters.flatMap((semester, index) => semester.courses.map(course => [course.instanceId, { semesterId: semester.id, semester: index + 1 }])),
    ...state.unplaced.map(course => [course.instanceId, { semesterId: null, semester: null }]),
  ]);
  const previous = positions(before);
  const next = positions(after);
  const changes = [];
  for (const course of allInstances(after)) {
    if (JSON.stringify(previous.get(course.instanceId)) !== JSON.stringify(next.get(course.instanceId))) {
      changes.push({ instanceId: course.instanceId, code: curriculum.byId.get(course.occurrenceId).code, from: previous.get(course.instanceId) || null, to: next.get(course.instanceId) });
    }
  }
  if (before.currentSemester !== after.currentSemester) changes.push({ type: after.currentSemester < before.currentSemester ? "UNDO_COMPLETE_SEMESTER" : "COMPLETE_SEMESTER", semester: Math.min(before.currentSemester, after.currentSemester) });
  return changes;
}

function trimTrailingEmptySemesters(state, curriculum) {
  const curriculumLength = Math.max(0, ...curriculum.occurrences.map(course => course.semester_row));
  const finalThesisIndex = state.semesters.findIndex(semester =>
    semester.courses.some(course => curriculum.byId.get(course.occurrenceId)?.code === "CSE400")
  );
  const thesisLength = finalThesisIndex >= curriculumLength ? finalThesisIndex + 2 : 0;
  const keepLength = Math.max(state.currentSemester, curriculumLength, thesisLength);
  while (state.semesters.length > keepLength) {
    const last = state.semesters[state.semesters.length - 1];
    if (last.isTarc || last.courses.length > 0) break;
    state.semesters.pop();
  }
}

function applyAction(state, action, curriculum, options = {}) {
  const isDesigner = options.isDesigner || options.mode === "designer";
  const designerOptions = { ...options, isDesigner };
  const input = validatePlannerState(state, curriculum, { allowUnplaced: true, checkSchedule: false, isDesigner });
  if (!input.ok) return { ok: false, state, error: input.errors[0], warnings: input.errors };
  try {
    const next = cloneState(state);
    if (action?.type === "RENAME_COD") {
      const instance = allInstances(next).find(course => course.instanceId === action.instanceId);
      if (curriculum.byId.get(instance?.occurrenceId)?.code !== "COD" || typeof action.label !== "string") planningError("INVALID_COURSE_LABEL", "Choose a COD course to rename.");
      const label = action.label.trim();
      if (label.length > 40) planningError("INVALID_COURSE_LABEL", "Use at most 40 characters.");
      next.courseLabels = { ...next.courseLabels };
      if (!label) delete next.courseLabels[action.instanceId];
      else next.courseLabels[action.instanceId] = label;
      const validation = validatePlannerState(next, curriculum, { previousState: state, allowUnplaced: true, checkSchedule: false, isDesigner });
      if (!validation.ok) return { ok: false, state, error: validation.errors[0], warnings: validation.errors };
      return { ok: true, state: next, changes: [{ type: "RENAME_COD", instanceId: action.instanceId, label }], warnings: [] };
    }
    const notBefore = new Map();
    const pinned = new Set();
    switch (action?.type) {
      case "ADD_COURSE": {
        const index = editableSemester(next, action.semesterId, designerOptions);
        pinned.add(insertCourse(next, index, action.occurrenceId, curriculum, undefined, designerOptions).instanceId);
        break;
      }
      case "REMOVE_COURSE": {
        const index = editableSemester(next, action.semesterId, designerOptions);
        deferCourse(next, index, action.instanceId, curriculum, notBefore, designerOptions);
        break;
      }
      case "REPLACE_COURSE": {
        const index = editableSemester(next, action.semesterId, designerOptions);
        const old = next.semesters[index].courses.find(course => course.instanceId === action.instanceId);
        if (old?.occurrenceId === action.occurrenceId) planningError("COURSE_ALREADY_EXISTS", "Select a different course to replace this occurrence.");
        const removed = deferCourse(next, index, action.instanceId, curriculum, notBefore, designerOptions);
        pinned.add(insertCourse(next, index, action.occurrenceId, curriculum, removed.instanceId, designerOptions).instanceId);
        break;
      }
      case "MOVE_SEMESTER": {
        const from = next.semesters.findIndex(semester => semester.id === action.semesterId);
        if (from < 0) planningError("SEMESTER_NOT_FOUND", "The selected semester is not found.");
        if (!Number.isInteger(action.toIndex) || action.toIndex < 0 || action.toIndex >= next.semesters.length) {
          planningError("INVALID_DESTINATION", "Destination semester is out of bounds.");
        }
        const [moved] = next.semesters.splice(from, 1);
        next.semesters.splice(action.toIndex, 0, moved);
        break;
      }
      case "MOVE_COURSE": {
        const fromIndex = next.semesters.findIndex(semester => semester.id === action.fromSemesterId);
        if (fromIndex < 0) planningError("SEMESTER_NOT_FOUND", "The source semester is not in this plan.");
        const toIndex = next.semesters.findIndex(semester => semester.id === action.toSemesterId);
        if (toIndex < 0) planningError("SEMESTER_NOT_FOUND", "The destination semester is not in this plan.");

        const fromSem = next.semesters[fromIndex];
        const toSem = next.semesters[toIndex];

        if (!designerOptions.isDesigner && fromIndex < next.currentSemester - 1) {
          planningError("FROZEN_SEMESTER", "Completed semesters cannot be modified.");
        }
        if (!designerOptions.isDesigner && toIndex < next.currentSemester - 1) {
          planningError("FROZEN_SEMESTER", "Courses cannot be moved into completed semesters.");
        }

        if (fromSem.isTarc) planningError("TARC_NOT_ALLOWED", "TARC courses must stay in TARC.");
        if (toSem.isTarc) planningError("TARC_NOT_ALLOWED", "Courses cannot be moved into TARC.");

        const coursePos = fromSem.courses.findIndex(c => c.instanceId === action.instanceId);
        if (coursePos < 0) planningError("COURSE_NOT_FOUND", "The course is no longer in that semester.");

        const maxAllowed = designerOptions.isDesigner ? 6 : 5;
        if (fromIndex !== toIndex && toSem.courses.length >= maxAllowed) {
          planningError("SEMESTER_FULL", `Semester ${toIndex + 1} cannot exceed ${maxAllowed} courses.`);
        }

        const [course] = fromSem.courses.splice(coursePos, 1);
        const destPos = Number.isInteger(action.toIndex) && action.toIndex >= 0 && action.toIndex <= toSem.courses.length
          ? action.toIndex
          : toSem.courses.length;
        toSem.courses.splice(destPos, 0, course);

        pinned.add(course.instanceId);

        if (designerOptions.isDesigner) {
          const code = curriculum.byId.get(course.occurrenceId)?.code;
          if (fromIndex < next.currentSemester - 1 && toIndex >= next.currentSemester - 1) {
            if (code && next.completedCourses?.includes(code)) {
              next.completedCourses = next.completedCourses.filter(c => c !== code);
            }
          }
          if (toIndex < next.currentSemester - 1) {
            if (code && !next.completedCourses?.includes(code) && code !== "COD") {
              next.completedCourses = [...next.completedCourses, code];
            }
          }
        }
        break;
      }
      case "MOVE_TARC": {
        const from = next.semesters.findIndex(semester => semester.id === action.semesterId && semester.isTarc);
        if (from < 0) planningError("TARC_NOT_FOUND", "The selected semester is not TARC.");
        if (isDesigner) {
          if (!Number.isInteger(action.toIndex) || action.toIndex < 0 || action.toIndex >= next.semesters.length) {
            planningError("INVALID_DESTINATION", "Destination semester is out of bounds.");
          }
        } else {
          if (from < next.currentSemester || !Number.isInteger(action.toIndex) || action.toIndex < Math.max(2, next.currentSemester) || action.toIndex >= next.semesters.length) planningError("TARC_NOT_ALLOWED", "TARC must remain after the current semester and cannot move before semester 3.");
        }
        const [tarc] = next.semesters.splice(from, 1);
        next.semesters.splice(action.toIndex, 0, tarc);
        break;
      }
      case "COMPLETE_SEMESTER": {
        const current = next.semesters[next.currentSemester - 1];
        if (!current) planningError("DEGREE_COMPLETED", "All semesters have already been completed.");
        if (current.id !== action.semesterId) planningError("STALE_ACTION", "The current semester changed. Review it before completing it.");
        scheduleFuture(next, curriculum, { isDesigner });
        next.completedCourses = [...new Set([...next.completedCourses, ...current.courses.map(course => curriculum.byId.get(course.occurrenceId).code)])];
        next.currentSemester++;
        break;
      }
      case "UNDO_COMPLETE_SEMESTER": {
        const latest = next.semesters[next.currentSemester - 2];
        if (!latest || latest.id !== action.semesterId) planningError("STALE_ACTION", "Only the most recently completed semester can be undone.");
        next.completedCourses = completedAfterUndo(next, curriculum);
        next.currentSemester--;
        break;
      }
      case "REBALANCE":
        break;
      default:
        planningError("UNKNOWN_ACTION", "This planner action is not supported.");
    }
    if (action.type !== "COMPLETE_SEMESTER" && action.type !== "MOVE_SEMESTER" && !(action.type === "MOVE_COURSE" && action.fromSemesterId === action.toSemesterId)) {
      scheduleFuture(next, curriculum, { notBefore, pinned, isDesigner, allowPrerequisiteOverride: isDesigner });
    }
    trimTrailingEmptySemesters(next, curriculum);
    next.personalized = true;
    const validation = validatePlannerState(next, curriculum, { previousState: state, isDesigner, allowPrerequisiteOverride: isDesigner });
    if (!validation.ok) return { ok: false, state, error: validation.errors[0], warnings: validation.errors };
    const result = { ok: true, state: next, changes: describeChanges(state, next, curriculum), warnings: [] };
    if (process.env.NODE_ENV === "development" && process.env.REACT_APP_ENGINE_DEBUG === "true") console.debug("Course Compass engine", { action, changes: result.changes, validation: "PASS" });
    return result;
  } catch (error) {
    return { ok: false, state, error: { code: error.code || "INVALID_PLANNER_STATE", message: error.message }, warnings: [] };
  }
}

export { applyAction };
