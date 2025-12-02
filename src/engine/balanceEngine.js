// engine/balanceEngine.js

import {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";

/**
 * Collect all future NON-TARC courses from recommended onward.
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
 * A SAFE placement helper for auto-balance:
 * - NEVER creates new semesters
 * - Tries to keep per-semester cap (maxCoursesPerSemester)
 * - Respects HP when possible
 * Returns true if placed, false if no valid slot found.
 */
function safePlaceCourse({
  slots,
  course,
  startIndex,
  completedCourses,
  maxCoursesPerSemester,
}) {
  for (let idx = startIndex; idx < slots.length; idx++) {
    const slot = slots[idx];
    if (!slot || slot.isTarc) continue;

    if ((slot.courses || []).length >= maxCoursesPerSemester) continue;

    const done = buildCompletedUpTo(slots, idx, completedCourses);
    if (!hardPrereqsSatisfied(course, done)) continue;

    slot.courses.push(course);
    return true;
  }

  return false;
}

/**
 * MAIN BALANCE ENGINE
 *
 * Goals:
 *  - Never lose a course.
 *  - Try to keep <=4 courses per normal semester.
 *  - Sem 10 & 11: <=3 courses.
 *  - Never create infinite extra semesters.
 *  - TARC stays untouched.
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }

  // Clone slots shallowly, courses as arrays (course objects by ref)
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1; // recommended semester index

  if (startBalanceIndex >= slots.length) return slots;

  // 1) Collect all future NON-TARC courses
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // 2) Clear NON-TARC future semesters
  for (let i = startBalanceIndex; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && !slot.isTarc) {
      slot.courses = [];
    }
  }

  // 3) First-pass global repack using safePlaceCourse (no new semesters)
  const unplaced = [];

  for (const course of allFuture) {
    const placed = safePlaceCourse({
      slots,
      course,
      startIndex: startBalanceIndex,
      completedCourses,
      maxCoursesPerSemester: 4,
    });

    if (!placed) {
      unplaced.push(course);
    }
  }

  // 4) Special rule: semesters with originalRow 10 & 11 → max 3 courses
  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !SPECIAL.has(slot.originalRow)) continue;

    while ((slot.courses || []).length > 3) {
      const extra = slot.courses.pop();
      if (!extra) break;

      let placed = false;

      // try backward first
      for (let b = i - 1; b >= startBalanceIndex; b--) {
        const back = slots[b];
        if (!back || back.isTarc) continue;
        if ((back.courses || []).length >= 4) continue;

        const done = buildCompletedUpTo(slots, b, completedCourses);
        if (!hardPrereqsSatisfied(extra, done)) continue;

        back.courses.push(extra);
        placed = true;
        break;
      }

      // if still not placed, try forward within existing slots
      if (!placed) {
        const fPlaced = safePlaceCourse({
          slots,
          course: extra,
          startIndex: i + 1,
          completedCourses,
          maxCoursesPerSemester: 4,
        });

        if (!fPlaced) {
          // As an extreme fallback, attach back to this slot.
          // This should be very rare and only in heavily corrupted states.
          slot.courses.push(extra);
          break;
        }
      }
    }
  }

  // 5) Trim strictly empty trailing non-TARC semesters
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  // 6) Last semester single-course fix
  if (slots.length > startBalanceIndex) {
    const lastIndex = slots.length - 1;
    const last = slots[lastIndex];

    if (!last.isTarc && last.courses.length === 1) {
      for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        if (slot.courses.length <= 2) continue; // avoid starving earlier semester

        const candidate = slot.courses[slot.courses.length - 1];

        const doneLast = buildCompletedUpTo(
          slots,
          lastIndex,
          completedCourses
        );
        if (!hardPrereqsSatisfied(candidate, doneLast)) continue;

        slot.courses.pop();
        last.courses.push(candidate);
        break;
      }
    }
  }

  // 7) FINAL FAILSAFE:
  //    Ensure every course from allFuture exists in some future slot.
  //    We match by CODE (not by object identity) to avoid clone issues.
  const existingCodes = new Set();
  for (let i = startBalanceIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;
    for (const c of s.courses) {
      if (c && c.code) existingCodes.add(c.code);
    }
  }

  // First, if some allFuture course is missed entirely, treat it as unplaced.
  for (const c of allFuture) {
    if (!existingCodes.has(c.code)) {
      unplaced.push(c);
    }
  }

  // 8) Insert all unplaced courses, trying to respect the 4-course cap.
  //    If absolutely no slot has space, we allow last non-TARC semester
  //    to overflow past 4 as a last resort rather than losing the course.
  for (const course of unplaced) {
    let placed = false;

    // Try to fit into a future semester with < 4 courses
    for (let i = startBalanceIndex; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot || slot.isTarc) continue;
      if (slot.courses.length >= 4) continue;

      slot.courses.push(course);
      placed = true;
      break;
    }

    if (!placed) {
      // All future non-TARC slots already have ≥ 4 courses.
      // As an extreme, preserve course by putting it in the LAST non-TARC slot.
      for (let i = slots.length - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        slot.courses.push(course);
        placed = true;
        break;
      }
    }
  }

  return slots;
}
