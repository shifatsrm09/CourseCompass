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

export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }

  // Clone slots safely
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1;
  if (startBalanceIndex >= slots.length) return slots;

  // ------------------------------------------
  // 1. Collect all future courses
  // ------------------------------------------
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // ------------------------------------------
  // 2. Clear future semesters
  // ------------------------------------------
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) slots[i].courses = [];
  }

  // ------------------------------------------
  // 3. GLOBAL repack (fills gaps forward)
  // ------------------------------------------
  for (const course of allFuture) {
    for (let sem = startBalanceIndex; sem < slots.length; sem++) {
      const slot = slots[sem];

      if (slot.isTarc) continue;
      if (slot.courses.length >= 4) continue;

      const done = buildCompletedUpTo(slots, sem, completedCourses);
      if (!hardPrereqsSatisfied(course, done)) continue;

      slot.courses.push(course);
      break;
    }
  }

  // ------------------------------------------
  // 4. Sem 10/11 max 3 courses (pull backwards)
  // ------------------------------------------
  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    if (!SPECIAL.has(slots[i].originalRow)) continue;

    while (slots[i].courses.length > 3) {
      const extra = slots[i].courses.pop();

      let placed = false;

      // Try backward first
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

  // ------------------------------------------
  // 5. Trim strictly empty trailing semesters
  // ------------------------------------------
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  // ------------------------------------------
  // ⭐ 6. FINAL BALANCE FIX:
  //    If last semester has only 1 course → pull from earlier
  // ------------------------------------------
  const lastIndex = slots.length - 1;
  const last = slots[lastIndex];

  if (!last.isTarc && last.courses.length === 1) {
    const targetCourse = last.courses[0];

    for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
      const slot = slots[i];
      if (slot.isTarc) continue;
      if (slot.courses.length <= 2) continue; // avoid making earlier too small

      const candidate = slot.courses[slot.courses.length - 1];

      // HP check for placing candidate into last
      const doneLast = buildCompletedUpTo(slots, lastIndex, completedCourses);
      if (!hardPrereqsSatisfied(candidate, doneLast)) continue;

      // HP check to see if removing candidate breaks earlier semester
      const doneBeforeRemove = buildCompletedUpTo(slots, i, completedCourses);
      // If candidate was required before → skip
      // (simple safeguard: we assume OK if candidate HP is satisfied)
      // More complex chains are rare in BRAC structure
      if (!hardPrereqsSatisfied(candidate, doneBeforeRemove)) continue;

      // Move
      slot.courses.pop();
      last.courses.push(candidate);
      break;
    }
  }

  return slots;
}
