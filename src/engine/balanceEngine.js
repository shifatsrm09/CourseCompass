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
 * Safe placer — never creates new semesters, never touches TARC.
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
 * MAIN BALANCE ENGINE (TARC safe)
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
  semesterOrder = [], // <- NEW
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0)
    return semesterSlots;

  // Clone shallowly
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1;

  if (startBalanceIndex >= slots.length) return slots;

  // --------------------------------------------------------
  // 1. Collect all FUTURE NON-TARC courses
  // --------------------------------------------------------
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // --------------------------------------------------------
  // 2. Clear future NON-TARC semesters only
  // --------------------------------------------------------
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) slots[i].courses = [];
  }

  // --------------------------------------------------------
  // 3. First-pass repack
  // --------------------------------------------------------
  const unplaced = [];

  for (const c of allFuture) {
    const ok = safePlaceCourse({
      slots,
      course: c,
      startIndex: startBalanceIndex,
      completedCourses,
      maxCoursesPerSemester: 4,
    });
    if (!ok) unplaced.push(c);
  }

  // --------------------------------------------------------
  // 4. Special case: SEM 10/11 max 3
  // --------------------------------------------------------
  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !SPECIAL.has(slot.originalRow)) continue;

    while (slot.courses.length > 3) {
      const extra = slot.courses.pop();
      if (!extra) break;

      let placed = false;

      // backward first
      for (let b = i - 1; b >= startBalanceIndex; b--) {
        const back = slots[b];
        if (!back || back.isTarc) continue;
        if (back.courses.length >= 4) continue;

        const done = buildCompletedUpTo(slots, b, completedCourses);
        if (!hardPrereqsSatisfied(extra, done)) continue;

        back.courses.push(extra);
        placed = true;
        break;
      }

      if (!placed) {
        const f = safePlaceCourse({
          slots,
          course: extra,
          startIndex: i + 1,
          completedCourses,
          maxCoursesPerSemester: 4,
        });

        if (!f) {
          slot.courses.push(extra);
          break;
        }
      }
    }
  }

  // --------------------------------------------------------
  // 5. Trim trailing empty non-TARC semesters
  // --------------------------------------------------------
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  // --------------------------------------------------------
  // 6. Last semester single-course fix (does not touch TARC)
  // --------------------------------------------------------
  if (slots.length > startBalanceIndex) {
    const lastIndex = slots.length - 1;
    const last = slots[lastIndex];

    if (!last.isTarc && last.courses.length === 1) {
      for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot.isTarc && slot.courses.length > 2) {
          const cand = slot.courses[slot.courses.length - 1];
          const done = buildCompletedUpTo(slots, lastIndex, completedCourses);

          if (hardPrereqsSatisfied(cand, done)) {
            slot.courses.pop();
            last.courses.push(cand);
            break;
          }
        }
      }
    }
  }

  // --------------------------------------------------------
  // 7. FAILSAFE: ensure all missing courses are placed
  // --------------------------------------------------------
  const existing = new Set();

  for (let i = startBalanceIndex; i < slots.length; i++) {
    for (const c of slots[i].courses) {
      if (c?.code) existing.add(c.code);
    }
  }

  for (const c of allFuture) {
    if (!existing.has(c.code)) unplaced.push(c);
  }

  for (const c of unplaced) {
    let placed = false;

    for (let i = startBalanceIndex; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.isTarc) continue;
      if (slot.courses.length < 4) {
        slot.courses.push(c);
        placed = true;
        break;
      }
    }

    if (!placed) {
      for (let i = slots.length - 1; i >= startBalanceIndex; i--) {
        if (!slots[i].isTarc) {
          slots[i].courses.push(c);
          break;
        }
      }
    }
  }

  // --------------------------------------------------------
  // 8. 🔒 FINAL STEP — REAPPLY USER SEMESTER ORDER
  // --------------------------------------------------------
  if (Array.isArray(semesterOrder) && semesterOrder.length > 0) {
    const map = new Map();
    slots.forEach((s) => map.set(s.originalRow, s));

    const ordered = [];

    semesterOrder.forEach((row) => {
      if (map.has(row)) {
        ordered.push(map.get(row));
        map.delete(row);
      }
    });

    map.forEach((s) => ordered.push(s));

    return ordered;
  }

  return slots;
}
