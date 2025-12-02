// engine/engine.js

import {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";

/**
 * Count how many COD courses exist in the current plan.
 */
function countCodInPlan(semesterSlots) {
  let count = 0;

  (semesterSlots || []).forEach((slot) => {
    (slot?.courses || []).forEach((c) => {
      if (c && c.code === "COD") count++;
    });
  });

  return count;
}

/**
 * Internal helper: validate placing a course into a semester.
 *
 * Used by:
 *  - validateAddCourse (mode = "add")
 *  - CoursePlanner "replace" flow (mode = "replace")
 *
 * mode:
 *  - "add"     → enforce capacity limit
 *  - "replace" → skip capacity (since count doesn't change)
 */
function validateCourseForSemester({
  semesterIndex,
  course,
  semesterSlots,
  currentSemester, // currently unused but reserved
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
  mode = "add", // "add" | "replace"
}) {
  if (
    !Array.isArray(semesterSlots) ||
    semesterIndex < 0 ||
    semesterIndex >= semesterSlots.length
  ) {
    return { ok: false, reason: "Invalid semester." };
  }

  if (!course || !course.code) {
    return { ok: false, reason: "Invalid course selection." };
  }

  const targetSlot = semesterSlots[semesterIndex];
  if (!targetSlot) {
    return { ok: false, reason: "Invalid semester." };
  }

  // 🔐 Extra safety: TARC semesters must not be edited by the engine
  if (targetSlot.isTarc) {
    return {
      ok: false,
      reason: "You cannot modify courses in the TARC semester.",
    };
  }

  const isCod = course.code === "COD";

  // 🔹 SPECIAL CAP: semesters 10 & 11 → at most 3 normal courses
  let effectiveMax = maxCoursesPerSemester;
  const row =
    typeof targetSlot.originalRow === "number" ? targetSlot.originalRow : null;

  if (row === 10 || row === 11) {
    effectiveMax = Math.min(effectiveMax, 3);
  }

  // 1) Capacity check per semester
  //    Only matters when we're ADDING a new course.
  if (
    mode === "add" &&
    (targetSlot.courses || []).length >= effectiveMax
  ) {
    return {
      ok: false,
      reason: `You cannot take more than ${effectiveMax} courses in this semester.`,
    };
  }

  // 2) Per-semester COD check (for ADD; replace already avoids duplicates via UI)
  if (isCod && mode === "add") {
    const alreadyHasCod = (targetSlot.courses || []).some(
      (c) => c.code === "COD"
    );
    if (alreadyHasCod) {
      return {
        ok: false,
        reason: "You already have a COD course in this semester.",
      };
    }
  }

  // 3) Global COD cap check — applies to both add and replace, because
  //    replacing a non-COD with COD could otherwise exceed the limit.
  if (isCod) {
    const codInPlan = countCodInPlan(semesterSlots);

    if (codInPlan >= maxCodAllowed) {
      // See if there is a future COD we can "pull" from
      let futureHasCod = false;

      for (let i = semesterIndex + 1; i < semesterSlots.length; i++) {
        const slot = semesterSlots[i];
        if ((slot?.courses || []).some((c) => c.code === "COD")) {
          futureHasCod = true;
          break;
        }
      }

      if (!futureHasCod) {
        return {
          ok: false,
          reason: `You have already planned ${maxCodAllowed} COD courses in total.`,
        };
      }
      // If futureHasCod === true, we allow it because we will pull that COD forward
      // instead of creating a brand-new one.
    }
  }

  // 4) HP check (only earlier semesters count as completed)
  //    This is the critical part preventing CSE250 + CSE251 in the same semester.
  const completedSet = buildCompletedUpTo(
    semesterSlots,
    semesterIndex,
    completedCourses
  );

  if (!hardPrereqsSatisfied(course, completedSet)) {
    const hpArray = Array.isArray(course.hp) ? course.hp : [];
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

/**
 * Validate whether we can ADD a given course into a given semester.
 *
 * This is the public API used by CoursePlanner when mode === "add".
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
  return validateCourseForSemester({
    semesterIndex,
    course: courseToAdd,
    semesterSlots,
    currentSemester,
    completedCourses,
    maxCoursesPerSemester,
    maxCodAllowed,
    mode: "add",
  });
}

// Export the generic validator so "replace" can also use HP rules.
export { validateCourseForSemester };
