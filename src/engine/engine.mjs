import { cloneState, isCompletedInstance } from "./plannerState.mjs";
import { validatePlannerState, allInstances } from "./validator.mjs";
import { scheduleFuture, planningError } from "./scheduler.mjs";

function editableSemester(state, semesterId) {
  const index = state.semesters.findIndex(semester => semester.id === semesterId);
  if (index < 0) planningError("SEMESTER_NOT_FOUND", "The selected semester is no longer in this plan.");
  if (index < state.currentSemester) planningError("FROZEN_SEMESTER", "Current and completed semesters are protected. Edit an upcoming semester instead.");
  if (state.semesters[index].isTarc) planningError("TARC_NOT_ALLOWED", "Courses cannot be added, replaced, or removed in TARC.");
  return index;
}

function deferCourse(state, index, instanceId, curriculum, notBefore) {
  const courses = state.semesters[index].courses;
  const position = courses.findIndex(course => course.instanceId === instanceId);
  if (position < 0) planningError("COURSE_NOT_FOUND", "The selected course is no longer in that semester.");
  const course = courses[position];
  if (isCompletedInstance(state, course, curriculum)) planningError("COMPLETED_COURSE", "Completed courses cannot be moved or removed.");
  courses.splice(position, 1);
  state.unplaced.push(course);
  notBefore.set(course.instanceId, index + 1);
  return course;
}

function insertCourse(state, index, occurrenceId, curriculum, excludedId) {
  const definition = curriculum.byId.get(occurrenceId);
  if (!definition) planningError("COURSE_NOT_FOUND", "Select a course from this stream's curriculum.");
  if (definition.is_tarc) planningError("TARC_NOT_ALLOWED", "TARC courses stay in their TARC semester.");
  const target = state.semesters[index];
  const codeOf = course => curriculum.byId.get(course.occurrenceId).code;
  if (target.courses.some(course => definition.code === "COD" ? codeOf(course) === "COD" : course.occurrenceId === occurrenceId)) planningError("COURSE_ALREADY_EXISTS", `${definition.code} is already in this semester.`);
  if (definition.code !== "COD" && state.completedCourses.includes(definition.code)) planningError("COMPLETED_COURSE", `${definition.code} has already been completed.`);
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
        if (position < state.currentSemester) planningError("FROZEN_SEMESTER", `${definition.code} is in a current or completed semester and cannot be moved.`);
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
  if (before.currentSemester !== after.currentSemester) changes.push({ type: "COMPLETE_SEMESTER", semester: before.currentSemester });
  return changes;
}

function applyAction(state, action, curriculum) {
  const input = validatePlannerState(state, curriculum, { allowUnplaced: true, checkSchedule: false });
  if (!input.ok) return { ok: false, state, error: input.errors[0], warnings: input.errors };
  try {
    const next = cloneState(state);
    const notBefore = new Map();
    const pinned = new Set();
    switch (action?.type) {
      case "ADD_COURSE": {
        const index = editableSemester(next, action.semesterId);
        pinned.add(insertCourse(next, index, action.occurrenceId, curriculum).instanceId);
        break;
      }
      case "REMOVE_COURSE": {
        const index = editableSemester(next, action.semesterId);
        deferCourse(next, index, action.instanceId, curriculum, notBefore);
        break;
      }
      case "REPLACE_COURSE": {
        const index = editableSemester(next, action.semesterId);
        const old = next.semesters[index].courses.find(course => course.instanceId === action.instanceId);
        if (old?.occurrenceId === action.occurrenceId) planningError("COURSE_ALREADY_EXISTS", "Select a different course to replace this occurrence.");
        const removed = deferCourse(next, index, action.instanceId, curriculum, notBefore);
        pinned.add(insertCourse(next, index, action.occurrenceId, curriculum, removed.instanceId).instanceId);
        break;
      }
      case "MOVE_TARC": {
        const from = next.semesters.findIndex(semester => semester.id === action.semesterId && semester.isTarc);
        if (from < 0) planningError("TARC_NOT_FOUND", "The selected semester is not TARC.");
        if (from < next.currentSemester || !Number.isInteger(action.toIndex) || action.toIndex < Math.max(2, next.currentSemester) || action.toIndex >= next.semesters.length) planningError("TARC_NOT_ALLOWED", "TARC must remain after the current semester and cannot move before semester 3.");
        const [tarc] = next.semesters.splice(from, 1);
        next.semesters.splice(action.toIndex, 0, tarc);
        break;
      }
      case "COMPLETE_SEMESTER": {
        const current = next.semesters[next.currentSemester - 1];
        if (!current) planningError("DEGREE_COMPLETED", "All semesters have already been completed.");
        if (current.id !== action.semesterId) planningError("STALE_ACTION", "The current semester changed. Review it before completing it.");
        scheduleFuture(next, curriculum);
        next.completedCourses = [...new Set([...next.completedCourses, ...current.courses.map(course => curriculum.byId.get(course.occurrenceId).code)])];
        next.currentSemester++;
        break;
      }
      case "REBALANCE":
        break;
      default:
        planningError("UNKNOWN_ACTION", "This planner action is not supported.");
    }
    if (action.type !== "COMPLETE_SEMESTER") scheduleFuture(next, curriculum, { notBefore, pinned });
    next.personalized = true;
    const validation = validatePlannerState(next, curriculum, { previousState: state });
    if (!validation.ok) return { ok: false, state, error: validation.errors[0], warnings: validation.errors };
    const result = { ok: true, state: next, changes: describeChanges(state, next, curriculum), warnings: [] };
    if (process.env.NODE_ENV === "development" && process.env.REACT_APP_ENGINE_DEBUG === "true") console.debug("Course Compass engine", { action, changes: result.changes, validation: "PASS" });
    return result;
  } catch (error) {
    return { ok: false, state, error: { code: error.code || "INVALID_PLANNER_STATE", message: error.message }, warnings: [] };
  }
}

export { applyAction };
