

import {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";




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











export function balanceFutureSemesters({
  semesterSlots,
  currentSemester,
  completedCourses = [],
}) {
  if (!Array.isArray(semesterSlots) || semesterSlots.length === 0) {
    return semesterSlots;
  }


  const slots = semesterSlots.map((s) => ({
    ...s,
    courses: Array.isArray(s.courses) ? [...s.courses] : [],
  }));

  const safeCurrent = currentSemester || 1;
  const currentIndex = safeCurrent - 1;
  const startBalanceIndex = currentIndex + 1;

  if (startBalanceIndex >= slots.length) return slots;


  const allFuture = collectFutureCourses(slots, startBalanceIndex);


  for (let i = startBalanceIndex; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && !slot.isTarc) {
      slot.courses = [];
    }
  }


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


  const SPECIAL = new Set([10, 11]);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !SPECIAL.has(slot.originalRow)) continue;

    while ((slot.courses || []).length > 3) {
      const extra = slot.courses.pop();
      if (!extra) break;

      let placed = false;


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


      if (!placed) {
        const fPlaced = safePlaceCourse({
          slots,
          course: extra,
          startIndex: i + 1,
          completedCourses,
          maxCoursesPerSemester: 4,
        });

        if (!fPlaced) {


          slot.courses.push(extra);
          break;
        }
      }
    }
  }


  while (
    slots.length > startBalanceIndex &&
    slots[slots.length - 1].courses.length === 0 &&
    !slots[slots.length - 1].isTarc
  ) {
    slots.pop();
  }


  if (slots.length > startBalanceIndex) {
    const lastIndex = slots.length - 1;
    const last = slots[lastIndex];

    if (!last.isTarc && last.courses.length === 1) {
      for (let i = lastIndex - 1; i >= startBalanceIndex; i--) {
        const slot = slots[i];
        if (!slot || slot.isTarc) continue;
        if (slot.courses.length <= 2) continue;

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




  const existingCodes = new Set();
  for (let i = startBalanceIndex; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;
    for (const c of s.courses) {
      if (c && c.code) existingCodes.add(c.code);
    }
  }


  for (const c of allFuture) {
    if (!existingCodes.has(c.code)) {
      unplaced.push(c);
    }
  }




  for (const course of unplaced) {
    let placed = false;


    for (let i = startBalanceIndex; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot || slot.isTarc) continue;
      if (slot.courses.length >= 4) continue;

      slot.courses.push(course);
      placed = true;
      break;
    }

    if (!placed) {


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
