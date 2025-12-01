// engine/balanceEngine.js

import { placeCourse } from "./removeEngine";

/**
 * Helper: flatten all courses after CURRENT semester.
 * We exclude TARC courses so they never get duplicated.
 */
function collectFutureCourses(slots, startIndex) {
  const list = [];

  for (let i = startIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;

    for (const c of s.courses) {
      if (!c) continue;

      // Never include TARC-only marker courses (if any)
      if (c.is_tarc) continue;

      list.push(c);
    }
  }

  return list;
}

/**
 * MAIN BALANCE ENGINE
 *
 * BASE RULES (same spirit as old stable engine):
 * - Treat CURRENT semester as COMPLETED (HP sees it as done).
 * - Remove all courses from recommended → last semester.
 * - Reinsert them with max 4 per semester using placeCourse().
 * - Never modify TARC semesters.
 * - Always respect HP rules (delegated to placeCourse).
 * - placeCourse MAY create new semesters at the end if needed.
 *
 * EXTRA RULE (new, but minimal):
 * - After normal balance, enforce:
 *      semester_row 10 and 11 → max 3 normal courses.
 *   Any extra course is pushed FORWARD using placeCourse again
 *   (starting from the next semester index).
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }

  // Clone slots and course arrays for safe mutation
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1; // recommended semester index

  if (startBalanceIndex >= slots.length) {
    // No future semesters to balance
    return slots;
  }

  // 1) Collect all future (non-TARC) courses from recommended → end
  const futureCourses = collectFutureCourses(slots, startBalanceIndex);

  // 2) Wipe future semesters (recommended → end), but keep TARC untouched
  for (let i = startBalanceIndex; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;

    if (!slot.isTarc) {
      slot.courses = [];
    }
  }

  // 3) Reinsert all courses using shared placeCourse:
  //    - starting from recommended semester index
  //    - max 4 per semester (your original balance target)
  //    - HP-safe placement, can create new semesters at the end
  for (const course of futureCourses) {
    placeCourse({
      slots,
      course,
      startIndex: startBalanceIndex,
      completedCourses,
      maxCoursesPerSemester: 4,
      maxCodPerSemester: 1,
    });
  }

  // 4) EXTRA: enforce thesis-friendly caps on semesters 10 and 11
  //    → at most 3 normal courses (thesis is not in courses array)
  const SPECIAL_ROWS = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;

    const row = slot.originalRow;
    if (!SPECIAL_ROWS.has(row)) continue;

    // While more than 3 normal courses → push the last one forward
    while ((slot.courses || []).length > 3) {
      const movedCourse = slot.courses.pop();
      if (!movedCourse) break;

      // Reinsert starting from *next* semester index
      placeCourse({
        slots,
        course: movedCourse,
        startIndex: i + 1,
        completedCourses,
        maxCoursesPerSemester: 4,
        maxCodPerSemester: 1,
      });
    }
  }

  return slots;
}
