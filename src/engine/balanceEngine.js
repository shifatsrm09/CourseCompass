// engine/balanceEngine.js

import {
  placeCourse,
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";

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
 * MAIN BALANCE ENGINE (with failsafes)
 *
 * Steps:
 * 1. Clone slots
 * 2. Collect all future NON-TARC courses
 * 3. Clear future semesters (NON-TARC only)
 * 4. Repack globally (forward, HP-safe, max 4/sem)
 * 5. Enforce sem 10 & 11: max 3 courses (pull backward, then forward)
 * 6. Trim trailing empty semesters
 * 7. FINAL FAILSAFE: ensure every course from allFuture is present
 */
export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }

  // 0) Clone slots safely (shallow clone for slots and courses; course objects by reference)
  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1;
  if (startBalanceIndex >= slots.length) return slots;

  // 1) Collect all future NON-TARC courses
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // 2) Clear NON-TARC future semesters
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) {
      slots[i].courses = [];
    }
  }

  // 3) GLOBAL repack: fill from earliest → latest
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

  // 4) Sem 10 / 11 → max 3 courses (pull backward, then forward fallback)
  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !SPECIAL.has(slot.originalRow)) continue;

    while (slot.courses.length > 3) {
      const extra = slot.courses.pop();
      if (!extra) break;

      let placed = false;

      // Try placing backward first
      for (let b = i - 1; b >= startBalanceIndex; b--) {
        const backSlot = slots[b];
        if (!backSlot || backSlot.isTarc) continue;
        if (backSlot.courses.length >= 4) continue;

        const done = buildCompletedUpTo(slots, b, completedCourses);
        if (!hardPrereqsSatisfied(extra, done)) continue;

        backSlot.courses.push(extra);
        placed = true;
        break;
      }

      if (!placed) {
        // Fallback: forward using placeCourse (can create new semesters if ever allowed)
        placeCourse({
          slots,
          course: extra,
          startIndex: i + 1,
          completedCourses,
          maxCoursesPerSemester: 4,
          maxCodPerSemester: 1,
        });
      }
    }
  }

  // 5) Trim strictly empty trailing semesters (non-TARC only)
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  // 6) FINAL BALANCE FIX:
  //    If last semester has only 1 course → try to pull one from earlier
  if (slots.length > startBalanceIndex) {
    const lastIndex = slots.length - 1;
    const last = slots[lastIndex];

    if (!last.isTarc && last.courses.length === 1) {
      for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        if (slot.courses.length <= 2) continue; // don't make earlier too thin

        const candidate = slot.courses[slot.courses.length - 1];

        // HP check for placing candidate into last
        const doneLast = buildCompletedUpTo(slots, lastIndex, completedCourses);
        if (!hardPrereqsSatisfied(candidate, doneLast)) continue;

        // Remove from earlier and add to last
        slot.courses.pop();
        last.courses.push(candidate);
        break;
      }
    }
  }

  // 7) ⭐ FINAL FAILSAFE:
  //    Ensure every course from allFuture exists somewhere in slots.
  //    We match by OBJECT IDENTITY (not by code) to preserve multiple COD instances, etc.
  const finalSet = new Set();
  for (const s of slots) {
    if (!s || !Array.isArray(s.courses)) continue;
    for (const c of s.courses) {
      if (c) finalSet.add(c);
    }
  }

  for (const course of allFuture) {
    if (!finalSet.has(course)) {
      // Course was lost during repack → force insert into last non-TARC semester
      for (let i = slots.length - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;

        // As a LAST RESORT, we intentionally skip HP here to avoid
        // permanently losing the course. User can manually fix HP issues later.
        slot.courses.push(course);
        finalSet.add(course);
        break;
      }
    }
  }

  return slots;
}
