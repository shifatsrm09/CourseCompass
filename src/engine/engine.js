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
  currentSemester, // currently unused but kept for future rules
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
}) {
  if (
    !Array.isArray(semesterSlots) ||
    semesterIndex < 0 ||
    semesterIndex >= semesterSlots.length
  ) {
    return { ok: false, reason: "Invalid semester." };
  }

  if (!courseToAdd || !courseToAdd.code) {
    return { ok: false, reason: "Invalid course selection." };
  }

  const targetSlot = semesterSlots[semesterIndex];
  if (!targetSlot) {
    return { ok: false, reason: "Invalid semester." };
  }

  // 🔐 Extra safety: TARC semester should not be modified via ADD
  if (targetSlot.isTarc) {
    return {
      ok: false,
      reason: "You cannot modify courses in the TARC semester.",
    };
  }

  const isCod = courseToAdd.code === "COD";

  // 🔹 SPECIAL CAP: semesters 10 & 11 → at most 3 normal courses
  // We rely on originalRow if present; otherwise fall back to the global cap.
  let effectiveMax = maxCoursesPerSemester;
  const row =
    typeof targetSlot.originalRow === "number" ? targetSlot.originalRow : null;

  if (row === 10 || row === 11) {
    // User wants at most 3 of our suggested courses in those semesters
    effectiveMax = Math.min(effectiveMax, 3);
  }

  // 1) Capacity check per semester
  if ((targetSlot.courses || []).length >= effectiveMax) {
    return {
      ok: false,
      reason: `You cannot take more than ${effectiveMax} courses in this semester.`,
    };
  }

  // 2) Per-semester COD check
  if (isCod) {
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

  // 3) Global COD cap check — but allow "pull from future" if possible
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
  //    (COD typically does not have HP, but we keep this generic.)
  const completedSet = buildCompletedUpTo(
    semesterSlots,
    semesterIndex,
    completedCourses
  );

  if (!hardPrereqsSatisfied(courseToAdd, completedSet)) {
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
