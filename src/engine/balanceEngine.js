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

      // Never include TARC courses in balance (avoid duplication)
      if (c.is_tarc) continue;

      list.push(c);
    }
  }

  return list;
}

/**
 * MAIN BALANCE ENGINE
 *
 * RULES:
 * - Treat CURRENT semester as COMPLETED (HP sees it as done).
 * - Remove all courses from recommended → last semester.
 * - Reinsert them with max 4 per semester.
 * - Never modify TARC semester contents.
 * - Always respect HP rules (delegated to placeCourse).
 * - If needed, can create NEW semesters at the end (Mode B).
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
  //    - max 4 per semester (your balance target)
  //    - HP-safe placement, can create new semesters at the end (Mode B)
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

  return slots;
}
