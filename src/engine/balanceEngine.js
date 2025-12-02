// engine/balanceEngine.js

import {
  placeCourse,
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";

// ====================================================
// Collect all future NON-TARC courses
// ====================================================
function collectFutureCourses(slots, startIndex) {
  const list = [];

  for (let i = startIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;
    if (s.isTarc) continue;

    for (const c of s.courses) if (c) list.push(c);
  }
  return list;
}

// ====================================================
// MAIN BALANCE ENGINE (with NEW global rebalance pass)
// ====================================================
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

  // ====================================================
  // 1) Collect all future NON-TARC courses
  // ====================================================
  const allFuture = collectFutureCourses(slots, startBalanceIndex);

  // ====================================================
  // 2) Clear NON-TARC future semesters
  // ====================================================
  for (let i = startBalanceIndex; i < slots.length; i++) {
    if (!slots[i].isTarc) slots[i].courses = [];
  }

  // ====================================================
  // 3) GLOBAL repack (forward, HP-safe, max 4)
  // ====================================================
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

  // ====================================================
  // 4) Enforce special_sem(10/11) max 3 (pull backward)
  // ====================================================
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

      // fallback
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

  // ====================================================
  // 5) Trim trailing empty non-TARC semesters
  // ====================================================
  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }

  // ====================================================
  // 6) Last semester single-course fix
  // ====================================================
  if (slots.length > startBalanceIndex) {
    const lastIndex = slots.length - 1;
    const last = slots[lastIndex];

    if (!last.isTarc && last.courses.length === 1) {
      for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        if (slot.courses.length <= 2) continue;

        const candidate = slot.courses[slot.courses.length - 1];

        const doneLast = buildCompletedUpTo(slots, lastIndex, completedCourses);
        if (!hardPrereqsSatisfied(candidate, doneLast)) continue;

        slot.courses.pop();
        last.courses.push(candidate);
        break;
      }
    }
  }

  // ====================================================
  // 7) FAILSAFE – ensure allFuture courses exist
  // ====================================================
  const finalSet = new Set();
  for (const s of slots)
    if (s?.courses) for (const c of s.courses) if (c) finalSet.add(c);

  for (const course of allFuture) {
    if (!finalSet.has(course)) {
      // force insert into last safe slot
      for (let i = slots.length - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        slot.courses.push(course);
        finalSet.add(course);
        break;
      }
    }
  }

  // ====================================================
  // ⭐ 8) GLOBAL LOAD BALANCING (NEW)
  // ====================================================
  // Try to make future semesters have 2–3 courses each

  for (let i = startBalanceIndex; i < slots.length - 1; i++) {
    const current = slots[i];
    if (current.isTarc) continue;

    // If this semester has 4 and next has <=2 → move one forward
    if (current.courses.length > 3) {
      const next = slots[i + 1];
      if (next && !next.isTarc && next.courses.length < 3) {
        const candidate = current.courses[current.courses.length - 1];

        const doneNext = buildCompletedUpTo(slots, i + 1, completedCourses);
        if (hardPrereqsSatisfied(candidate, doneNext)) {
          current.courses.pop();
          next.courses.push(candidate);
        }
      }
    }
  }

  // Pass 2: pull backward if very imbalanced
  for (let i = slots.length - 1; i > startBalanceIndex; i--) {
    const slot = slots[i];
    if (!slot || slot.isTarc) continue;

    if (slot.courses.length < 2) {
      // pull from the nearest earlier slot with >3
      for (let b = i - 1; b >= startBalanceIndex; b--) {
        const donor = slots[b];
        if (!donor || donor.isTarc) continue;
        if (donor.courses.length <= 3) continue;

        const candidate = donor.courses[donor.courses.length - 1];

        const doneHere = buildCompletedUpTo(slots, i, completedCourses);
        if (!hardPrereqsSatisfied(candidate, doneHere)) continue;

        donor.courses.pop();
        slot.courses.push(candidate);
        break;
      }
    }
  }

  return slots;
}
