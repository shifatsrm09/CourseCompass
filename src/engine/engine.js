// engine/engine.js

import { hardPrereqsSatisfied, buildCompletedUpTo } from "./removeEngine";

/**
 * Count how many COD courses exist in the current plan.
 */
function countCodInPlan(semesterSlots) {
  let count = 0;
  semesterSlots.forEach((slot) => {
    (slot.courses || []).forEach((c) => {
      if (c.code === "COD") count++;
    });
  });
  return count;
}

/**
 * Validate whether we can ADD a given course into a given semester.
 *
 * Used by CoursePlanner.handleCourseSelected() when mode === "add".
 *
 * Params:
 *  - semesterIndex: index in semesterSlots
 *  - courseToAdd: full course object (with code, hp, type, etc.)
 *  - semesterSlots: current planner state (array of { courses: [...] })
 *  - currentSemester: user.currentSemester (for future enhancements)
 *  - completedCourses: array of course codes officially completed
 *  - maxCoursesPerSemester: usually 5
 *  - maxCodAllowed: global cap, usually 5
 *
 * Returns:
 *  { ok: boolean, reason?: string }
 */
export function validateAddCourse({
  semesterIndex,
  courseToAdd,
  semesterSlots,
  currentSemester,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
}) {
  const targetSlot = semesterSlots[semesterIndex];
  if (!targetSlot) {
    return { ok: false, reason: "Invalid semester." };
  }

  // 1) Capacity check
  if ((targetSlot.courses || []).length >= maxCoursesPerSemester) {
    return {
      ok: false,
      reason: `You cannot take more than ${maxCoursesPerSemester} courses in one semester.`,
    };
  }

  // 2) Global COD cap check
  if (courseToAdd.code === "COD") {
    const codInPlan = countCodInPlan(semesterSlots);

    // We are about to ADD another COD → this would be +1
    if (codInPlan >= maxCodAllowed) {
      return {
        ok: false,
        reason: `You have already planned ${maxCodAllowed} COD courses in total.`,
      };
    }
  }

  // 3) HP check (only earlier semesters count as completed)
  const completedSet = buildCompletedUpTo(
    semesterSlots,
    semesterIndex,
    completedCourses
  );

  if (!hardPrereqsSatisfied(courseToAdd, completedSet)) {
    // Build a human readable reason
    const hpArray = Array.isArray(courseToAdd.hp) ? courseToAdd.hp : [];
    const missing = hpArray
      .filter((code) => code && code.trim() !== "")
      .filter((code) => !completedSet.has(code));

    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Missing prerequisite(s): ${missing.join(", ")}`,
      };
    }

    return { ok: false, reason: "Prerequisites are not satisfied." };
  }

  // All checks passed
  return { ok: true };
}
