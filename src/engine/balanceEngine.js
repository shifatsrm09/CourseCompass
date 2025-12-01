// engine/balanceEngine.js

import { hardPrereqsSatisfied, buildCompletedUpTo } from "./removeEngine";

/**
 * Helper: flatten all courses after CURRENT semester
 */
function collectFutureCourses(slots, startIndex) {
  const list = [];
  for (let i = startIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!Array.isArray(s.courses)) continue;

    for (const c of s.courses) {
      // 🔥 FIX: never include TARC courses in balance
      if (c.is_tarc) continue;

      list.push(c);
    }
  }
  return list;
}


/**
 * Try placing ONE course into balanced slots using HP rules.
 * This is similar to placeCourse() but with MAX 4 and no creation of new semesters.
 */
function tryPlaceBalanced({
  slots,
  course,
  startIndex,
  completedCourses,
  maxPerSem = 4,
}) {
  for (let i = startIndex; i < slots.length; i++) {
    const slot = slots[i];

    // Skip TARC
    if (slot.isTarc) continue;

    // Max 4 cap
    if ((slot.courses || []).length >= maxPerSem) continue;

    // One COD per semester
    const alreadyHasCod = (slot.courses || []).some(
      (c) => c.code === "COD"
    );
    if (course.code === "COD" && alreadyHasCod) continue;

    // HP check
    const completedSet = buildCompletedUpTo(slots, i, completedCourses);
    if (!hardPrereqsSatisfied(course, completedSet)) continue;

    slot.courses.push(course);
    return true;
  }

  return false; // failed to place (rare)
}

/**
 * MAIN BALANCE ENGINE
 *
 * RULES:
 * - Treat CURRENT semester as COMPLETED.
 * - Remove all courses from recommended → last semester.
 * - Reinsert them with max 4 per semester.
 * - Never modify TARC semester.
 * - Always respect HP rules.
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const currentIndex = currentSemester - 1;
  const startBalanceIndex = currentIndex + 1; // recommended semester

  // 1) Collect all future courses
  const futureCourses = collectFutureCourses(slots, startBalanceIndex);

  // 2) Wipe future semesters (recommended → end)
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) {
      slots[i].courses = [];
    }
  }

  // 3) Reinsert all courses using HP & max-4 logic
  for (const course of futureCourses) {
    tryPlaceBalanced({
      slots,
      course,
      startIndex: startBalanceIndex,
      completedCourses,
      maxPerSem: 4,
    });
  }

  return slots;
}
