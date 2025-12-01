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

  for (let idx = startIndex; idx < totalSlots; idx++) {
    const slot = slots[idx];

    // Skip TARC
    if (slot.isTarc) continue;

    // Capacity check
    if ((slot.courses || []).length >= maxCoursesPerSemester) continue;

    // COD per-semester check
    if (course.code === "COD" && slotHasCod(slot)) continue;

    // HP check
    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    if (!hardPrereqsSatisfied(course, completedSet)) continue;

    // Valid spot found
    slot.courses.push(course);
    return;
  }

  // No spot found → create new semester at end
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
 */
function rebalanceAllPrereqs({
  slots,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  const pending = [];

  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx];

    if (!slot.courses || slot.courses.length === 0) continue;

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

  // Reinsert all invalid courses
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
 * Main Remove Logic
 *
 * PATCHED:
 * If a course was completed earlier:
 *   → DO NOT REINSERT IT
 *   → JUST REMOVE
 *
 * If not completed earlier:
 *   → Use original chain-moving logic
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

  // Clone slots safely
  const slots = semesterSlots.map((slot) => ({
    ...slot,
    courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
  }));

  // ============================================================
  // NEW FIX:
  // Detect whether this course was completed earlier by using:
  // - DB completed courses
  // - All semesters before fromSemesterIndex
  // ============================================================
  const completedSet = buildCompletedUpTo(
    slots,
    fromSemesterIndex,
    completedCourses
  );

  const completedEarlier = completedSet.has(removedCourse.code);

  // If completed earlier → DO NOT reinsert → return "clean" slots
  if (completedEarlier) {
    return slots;
  }

  // ============================================================
  // ORIGINAL CHAIN BEHAVIOR FOR NON-COMPLETED COURSES
  // ============================================================

  // Step 1: Place in nearest valid future semester
  placeCourse({
    slots,
    course: removedCourse,
    startIndex: fromSemesterIndex + 1,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // Step 2: Rebalance all HP chains
  const rebalanced = rebalanceAllPrereqs({
    slots,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  return rebalanced;
}

export { hardPrereqsSatisfied, buildCompletedUpTo };
