// engine/removeEngine.js

/**
 * Check hard prerequisites (hp) against a completed set.
 * We ignore empty strings in hp.
 */
function hardPrereqsSatisfied(course, completedSet) {
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
    (s.courses || []).forEach((c) => set.add(c.code));
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
 */
function placeCourse({
  slots,
  course,
  startIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  const totalSlots = slots.length;

  const slotHasCod = (slot) =>
    (slot.courses || []).some((c) => c.code === "COD");

  // Try existing semesters first
  for (let idx = startIndex; idx < totalSlots; idx++) {
    const slot = slots[idx];

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
 *  - Scan all semesters top-down
 *  - If a course appears before its HP are satisfied, remove it
 *  - Then reinsert all removed courses later where HP IS satisfied
 *
 * This gives us:
 *  - no course appears before its prerequisites
 *  - "future chains" automatically move forward if needed
 */
function rebalanceAllPrereqs({
  slots,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  const pending = [];

  // First pass: remove invalid courses
  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx];
    if (!slot.courses || slot.courses.length === 0) continue;

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

  // Second pass: reinsert all invalid courses later
  for (const course of pending) {
    placeCourse({
      slots,
      course,
      startIndex: 0, // can be placed anywhere in the future
      completedCourses,
      maxCoursesPerSemester,
      maxCodPerSemester,
    });
  }

  return slots;
}

/**
 * Main function used by CoursePlanner after a REMOVE.
 *
 * 1) CoursePlanner already removed the course from its old semester.
 * 2) We:
 *    - insert the removed course into its nearest valid FUTURE semester
 *    - then perform a global HP rebalance across all semesters
 */
export function reinsertRemovedCourse({
  semesterSlots,
  removedCourse,
  fromSemesterIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!removedCourse) return semesterSlots;

  // Shallow-clone slots + courses arrays so we don't mutate React state directly
  const slots = semesterSlots.map((slot) => ({
    ...slot,
    courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
  }));

  // 1) Insert removed course in the nearest valid FUTURE semester
  placeCourse({
    slots,
    course: removedCourse,
    startIndex: fromSemesterIndex + 1,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // 2) Rebalance all HP globally so dependent chains naturally move forward
  const rebalanced = rebalanceAllPrereqs({
    slots,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  return rebalanced;
}

// Optionally export helpers if you want them in other engine modules
export { hardPrereqsSatisfied, buildCompletedUpTo };
