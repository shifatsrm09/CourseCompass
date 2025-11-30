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
 * Reinsert a removed course into the nearest valid FUTURE semester.
 *
 * Rules:
 * - We do NOT touch any other existing courses.
 * - We start searching from fromSemesterIndex + 1.
 * - Skip TARC semesters completely.
 * - Respect HP (hard prerequisites).
 * - At most `maxCodPerSemester` COD per semester.
 * - At most `maxCoursesPerSemester` total courses per semester.
 * - If no existing semester fits, we create a new extra semester at the end.
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

  // Deep-ish copy: copy slot + its courses array
  const slots = semesterSlots.map((slot) => ({
    ...slot,
    courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
  }));

  const totalSlots = slots.length;

  // Helper: check if a slot already has COD
  const slotHasCod = (slot) =>
    (slot.courses || []).some((c) => c.code === "COD");

  // Try to place into an existing future semester
  for (let idx = fromSemesterIndex + 1; idx < totalSlots; idx++) {
    const slot = slots[idx];

    // Skip TARC blocks completely
    if (slot.isTarc) continue;

    // Enforce capacity
    if ((slot.courses || []).length >= maxCoursesPerSemester) continue;

    // Enforce "1 COD per semester"
    if (removedCourse.code === "COD" && slotHasCod(slot)) {
      continue;
    }

    // Check HP: we build completed set up to this semester
    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    if (!hardPrereqsSatisfied(removedCourse, completedSet)) {
      continue;
    }

    // If we reach here, it's safe to place the course in this semester
    slot.courses.push(removedCourse);
    return slots;
  }

  // If no existing semester is valid, create a new one at the end
  const last = slots[slots.length - 1];
  const newOriginalRow = (last && last.originalRow) ? last.originalRow + 1 : slots.length + 1;

  const completedSetForNew = buildCompletedUpTo(slots, slots.length, completedCourses);
  // If HP are not satisfied even for a new last semester, we still place it there
  // for now so it doesn't vanish from UI. (Later you can add a warning UI.)

  slots.push({
    id: `sem-extra-${slots.length + 1}`,
    originalRow: newOriginalRow,
    courses: [removedCourse],
    isTarc: false,
  });

  return slots;
}
