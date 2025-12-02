// engine/balanceEngine.js

import { placeCourse, hardPrereqsSatisfied, buildCompletedUpTo } from "./removeEngine";

/**
 * Flatten all future NON-TARC courses from recommended onward
 */
function collectFutureCourses(slots, startIndex) {
  const list = [];

  for (let i = startIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;
    if (s.isTarc) continue;

    for (const c of s.courses) {
      if (c) list.push(c);
    }
  }

  return list;
}

/**
 * Completely NEW auto-balance:
 * 1. Treat CURRENT semester as completed
 * 2. Extract all future NON-TARC courses
 * 3. Clear all NON-TARC future semesters
 * 4. Repack globally:
 *      → HP-safe
 *      → max 4 per semester
 *      → fills earlier gaps first (pulling backward)
 * 5. Apply special rule (sem 10 & 11 max 3)
 * 6. Trim trailing empty semesters
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }

  // Clone array safely
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1;

  if (startBalanceIndex >= slots.length) return slots;

  // -----------------------------------------------
  // 1. Collect all future NON-TARC courses
  // -----------------------------------------------
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // -----------------------------------------------
  // 2. Clear future NON-TARC semesters
  // -----------------------------------------------
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) {
      slots[i].courses = [];
    }
  }

  // -----------------------------------------------
  // 3. GLOBAL repack: fill semesters from earliest to latest
  // -----------------------------------------------
  for (const course of allFuture) {
    for (let sem = startBalanceIndex; sem < slots.length; sem++) {
      const slot = slots[sem];

      // Skip TARC
      if (slot.isTarc) continue;

      // Capacity (max 4)
      if (slot.courses.length >= 4) continue;

      // HP check
      const completedSet = buildCompletedUpTo(slots, sem, completedCourses);
      if (!hardPrereqsSatisfied(course, completedSet)) continue;

      // Valid → insert
      slot.courses.push(course);
      break;
    }
  }

  // -----------------------------------------------
  // 4. Enforce max 3 courses on semesters 10 & 11
  //    BUT we now PULL backward instead of only pushing forward
  // -----------------------------------------------
  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    if (!SPECIAL.has(slots[i].originalRow)) continue;

    while (slots[i].courses.length > 3) {
      const extra = slots[i].courses.pop();

      // Try placing backward first (pull)
      let placed = false;
      for (let b = i - 1; b >= startBalanceIndex; b--) {
        if (slots[b].isTarc) continue;
        if (slots[b].courses.length >= 4) continue;

        const done = buildCompletedUpTo(slots, b, completedCourses);
        if (!hardPrereqsSatisfied(extra, done)) continue;

        slots[b].courses.push(extra);
        placed = true;
        break;
      }

      if (!placed) {
        // fallback: place forward
        placeCourse({
          slots,
          course: extra,
          startIndex: i + 1,
          completedCourses,
          maxCoursesPerSemester: 4,
        });
      }
    }
  }

  // -----------------------------------------------
  // 5. Trim trailing empty semesters
  // -----------------------------------------------
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  return slots;
}
