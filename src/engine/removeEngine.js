// engine/removeEngine.js

/**
 * Check hard prerequisites (hp) against a completed set.
 * We ignore empty strings in hp.
 */
function hardPrereqsSatisfied(course, completedSet) {
  if (!course) return true;

  const hpArray = Array.isArray(course.hp) ? course.hp : [];
  const cleanHp = hpArray.filter((code) => code && code.trim() !== "");
  if (cleanHp.length === 0) return true;

  return cleanHp.every((code) => completedSet.has(code));
}

/**
 * Build a "completed" set up to (but not including) index `uptoIndex`.
 * Includes:
 * - completedCourses from DB
 * - all course codes in slots[0..uptoIndex-1]
 */
function buildCompletedUpTo(slots, uptoIndex, completedCourses = []) {
  const set = new Set(completedCourses || []);

  for (let i = 0; i < uptoIndex; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;

    s.courses.forEach((c) => {
      if (c && c.code) set.add(c.code);
    });
  }

  return set;
}

/**
 * Try to place a single course into the earliest valid semester,
 * starting from `startIndex`.
 *
 * Rules:
 * - Skip TARC semesters.
 * - Max `maxCoursesPerSemester` per semester.
 * - Max 1 COD per semester.
 * - Respect HP (based on completed + earlier semesters).
 * - If no semester works, create a new extra semester at the end.
 *
 * NOTE: This mutates `slots` in place.
 * Always call it on a cloned array from React.
 */
function placeCourse({
  slots,
  course,
  startIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1, // reserved for future use
}) {
  if (!course || !Array.isArray(slots)) return;

  const totalSlots = slots.length;

  const slotHasCod = (slot) =>
    (slot.courses || []).some((c) => c.code === "COD");

  // Try existing semesters first
  for (let idx = startIndex; idx < totalSlots; idx++) {
    const slot = slots[idx];
    if (!slot) continue;

    // Skip TARC
    if (slot.isTarc) continue;

    // Capacity check
    if ((slot.courses || []).length >= maxCoursesPerSemester) continue;

    // COD per-semester check
    if (course.code === "COD" && slotHasCod(slot)) continue;

    // HP check (only earlier semesters count)
    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    if (!hardPrereqsSatisfied(course, completedSet)) continue;

    // Valid spot found
    slot.courses.push(course);
    return;
  }

  // No spot found in existing semesters → create new semester at the end.
  const last = slots[slots.length - 1];
  const newOriginalRow =
    last && typeof last.originalRow === "number"
      ? last.originalRow + 1
      : slots.length + 1;

  slots.push({
    id: `sem-extra-${slots.length + 1}`,
    originalRow: newOriginalRow,
    courses: [course],
    isTarc: false,
  });
}

/**
 * Global HP rebalance:
 * Ensures all HP chains remain valid after reinsertion.
 *
 *  - Scan all semesters top-down
 *  - If a course appears before its HP are satisfied, remove it
 *  - Then reinsert all removed courses later where HP IS satisfied
 */
function rebalanceAllPrereqs({
  slots,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!Array.isArray(slots)) return slots;

  const pending = [];

  // First pass: remove invalid courses
  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx];
    if (!slot || !Array.isArray(slot.courses) || slot.courses.length === 0)
      continue;

    // TARC courses are fixed, but they still contribute to completedSet
    if (slot.isTarc) continue;

    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    const keep = [];

    for (const course of slot.courses) {
      if (hardPrereqsSatisfied(course, completedSet)) {
        keep.push(course);
      } else {
        pending.push(course);
      }
    }

    slot.courses = keep;
  }

  // Second pass: reinsert all invalid courses later, HP-safe
  for (const course of pending) {
    placeCourse({
      slots,
      course,
      startIndex: 0,
      completedCourses,
      maxCoursesPerSemester,
      maxCodPerSemester,
    });
  }

  return slots;
}

/**
 * Trim trailing empty, non-TARC semesters.
 * This prevents long chains of empty 15,16,17,... after rebalancing.
 */
function trimTrailingEmptySemesters(slots) {
  if (!Array.isArray(slots)) return slots;

  let end = slots.length;

  while (end > 0) {
    const slot = slots[end - 1];
    if (!slot) {
      end--;
      continue;
    }

    const hasCourses =
      Array.isArray(slot.courses) && slot.courses.length > 0;

    // Stop trimming if:
    //  - slot has courses, OR
    //  - this is a TARC semester (never remove)
    if (hasCourses || slot.isTarc) break;

    end--;
  }

  if (end === slots.length) return slots;
  return slots.slice(0, end);
}

/**
 * Main Remove Logic (used by CoursePlanner after a REMOVE).
 *
 * Behavior:
 * - If a course was completed earlier:
 *      → DO NOT REINSERT IT
 *      → JUST REMOVE
 *
 * - If not completed earlier:
 *      → Insert into nearest valid FUTURE semester
 *      → Then run global HP rebalance
 *
 * NEW: Hard failsafe so removedCourse is never lost.
 */
export function reinsertRemovedCourse({
  semesterSlots,
  removedCourse,
  fromSemesterIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!removedCourse || !Array.isArray(semesterSlots)) {
    return semesterSlots;
  }

  // Shallow-clone slots + courses arrays so we don't mutate React state directly
  const slots = semesterSlots.map((slot) => ({
    ...slot,
    courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
  }));

  // 1) Check whether this course was already completed earlier.
  const completedSet = buildCompletedUpTo(
    slots,
    fromSemesterIndex,
    completedCourses
  );
  const completedEarlier = completedSet.has(removedCourse.code);

  // If completed earlier → DO NOT reinsert → return "clean" slots
  if (completedEarlier) {
    return trimTrailingEmptySemesters(slots);
  }

  // 2) Place removed course in the nearest valid FUTURE semester
  placeCourse({
    slots,
    course: removedCourse,
    startIndex: fromSemesterIndex + 1,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // 3) Rebalance all HP chains
  let rebalanced = rebalanceAllPrereqs({
    slots,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // 4) Clean up trailing empty semesters
  rebalanced = trimTrailingEmptySemesters(rebalanced);

  // 5) ⭐ HARD FAILSAFE:
  //    Ensure the specific removedCourse object still exists somewhere.
  //    We compare by OBJECT IDENTITY (===), not by code.
  let found = false;
  for (const s of rebalanced) {
    if (!s || !Array.isArray(s.courses)) continue;
    if (s.courses.includes(removedCourse)) {
      found = true;
      break;
    }
  }

  if (!found) {
    // As a last resort, append it to the last non-TARC semester.
    let inserted = false;
    for (let i = rebalanced.length - 1; i >= 0; i--) {
      const slot = rebalanced[i];
      if (!slot || slot.isTarc) continue;

      if (!Array.isArray(slot.courses)) slot.courses = [];
      slot.courses.push(removedCourse);
      inserted = true;
      break;
    }

    // If somehow all were TARC (shouldn't happen), create a new semester.
    if (!inserted) {
      const last = rebalanced[rebalanced.length - 1];
      const newOriginalRow =
        last && typeof last.originalRow === "number"
          ? last.originalRow + 1
          : rebalanced.length + 1;

      rebalanced.push({
        id: `sem-extra-${rebalanced.length + 1}`,
        originalRow: newOriginalRow,
        courses: [removedCourse],
        isTarc: false,
      });
    }
  }

  return rebalanced;
}

// Export helpers for other engine modules
export {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
  placeCourse,
  trimTrailingEmptySemesters,
};
