// engine/removeEngine.js

/**
 * Strict HP:
 * A prerequisite counts as satisfied ONLY if it appears
 * in a STRICTLY EARLIER semester — not the same semester.
 */
function hardPrereqsSatisfied(course, completedSet) {
  if (!course) return true;

  const hpArray = Array.isArray(course.hp) ? course.hp : [];
  const cleanHp = hpArray.filter((code) => code && code.trim() !== "");
  if (cleanHp.length === 0) return true;

  return cleanHp.every((code) => completedSet.has(code));
}

/**
 * Build a strict completed set up to index `uptoIndex`.
 * Count ONLY courses in strictly earlier semesters.
 */
function buildCompletedUpTo(slots, uptoIndex, completedCourses = []) {
  const set = new Set(completedCourses || []);

  // earlier semesters only
  for (let i = 0; i < uptoIndex; i++) {
    const s = slots[i];
    if (!s || !Array.isArray(s.courses)) continue;

    for (const c of s.courses) {
      if (c && c.code) set.add(c.code);
    }
  }

  return set;
}

/**
 * True if placing `course` into the SAME semester violates HP.
 * i.e., if course.hp includes a code also inside slot.courses.
 */
function violatesSameSemesterHP(course, slot) {
  if (!course || !slot || !Array.isArray(slot.courses)) return false;

  const hpArray = Array.isArray(course.hp) ? course.hp : [];
  const cleanHp = hpArray.filter((hp) => hp && hp.trim() !== "");
  if (cleanHp.length === 0) return false;

  const codesInSameSem = new Set(slot.courses.map((c) => c.code));

  return cleanHp.some((needed) => codesInSameSem.has(needed));
}

/**
 * Try placing a course into earliest valid semester.
 * Now prevents SAME-semester HP violations.
 */
function placeCourse({
  slots,
  course,
  startIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!course || !Array.isArray(slots)) return;

  const totalSlots = slots.length;

  const slotHasCod = (slot) =>
    (slot.courses || []).some((c) => c.code === "COD");

  for (let idx = startIndex; idx < totalSlots; idx++) {
    const slot = slots[idx];
    if (!slot) continue;

    if (slot.isTarc) continue;
    if ((slot.courses || []).length >= maxCoursesPerSemester) continue;

    // block COD duplicate
    if (course.code === "COD" && slotHasCod(slot)) continue;

    // ❌ STRICT same-semester HP block
    if (violatesSameSemesterHP(course, slot)) continue;

    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    if (!hardPrereqsSatisfied(course, completedSet)) continue;

    slot.courses.push(course);
    return;
  }

  // No spot found → create new semester at end
  const last = slots[slots.length - 1];
  const newOriginalRow =
    last && typeof last.originalRow === "number"
      ? last.originalRow + 1
      : slots.length + 1;

  slots.push({
    id: `sem-extra-${slots.length + 1}`,
    originalRow: newOriginalRow,
    courses: [course],
    isTarc: false,
  });
}

/**
 * Rebalance invalid HP while respecting strict same-semester rules.
 */
function rebalanceAllPrereqs({
  slots,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!Array.isArray(slots)) return slots;

  const pending = [];

  // 1) Remove invalid courses
  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx];
    if (!slot || !Array.isArray(slot.courses) || slot.courses.length === 0)
      continue;

    if (slot.isTarc) continue;

    const completedSet = buildCompletedUpTo(slots, idx, completedCourses);
    const keep = [];

    for (const course of slot.courses) {
      const violatesSameRow = violatesSameSemesterHP(course, slot);

      if (violatesSameRow) {
        pending.push(course);
        continue;
      }

      if (!hardPrereqsSatisfied(course, completedSet)) {
        pending.push(course);
      } else {
        keep.push(course);
      }
    }

    slot.courses = keep;
  }

  // 2) Reinsert pending courses
  for (const course of pending) {
    placeCourse({
      slots,
      course,
      startIndex: 0,
      completedCourses,
      maxCoursesPerSemester,
      maxCodPerSemester,
    });
  }

  return slots;
}

/**
 * Trim empty semesters.
 */
function trimTrailingEmptySemesters(slots) {
  if (!Array.isArray(slots)) return slots;

  let end = slots.length;

  while (end > 0) {
    const slot = slots[end - 1];
    if (!slot) {
      end--;
      continue;
    }

    const hasCourses =
      Array.isArray(slot.courses) && slot.courses.length > 0;

    if (hasCourses || slot.isTarc) break;

    end--;
  }

  return slots.slice(0, end);
}

/**
 * Reinsertion after REMOVE.
 */
export function reinsertRemovedCourse({
  semesterSlots,
  removedCourse,
  fromSemesterIndex,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodPerSemester = 1,
}) {
  if (!removedCourse || !Array.isArray(semesterSlots)) {
    return semesterSlots;
  }

  const slots = semesterSlots.map((slot) => ({
    ...slot,
    courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
  }));

  const completedSet = buildCompletedUpTo(
    slots,
    fromSemesterIndex,
    completedCourses
  );
  const completedEarlier = completedSet.has(removedCourse.code);

  if (completedEarlier) {
    return trimTrailingEmptySemesters(slots);
  }

  // 1) Try place into future
  placeCourse({
    slots,
    course: removedCourse,
    startIndex: fromSemesterIndex + 1,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // 2) Rebalance HP fully
  let rebalanced = rebalanceAllPrereqs({
    slots,
    completedCourses,
    maxCoursesPerSemester,
    maxCodPerSemester,
  });

  // 3) Trim empty rows
  rebalanced = trimTrailingEmptySemesters(rebalanced);

  // 4) HARD failsafe: course must exist by reference
  let found = false;
  for (const s of rebalanced) {
    if (s.courses.includes(removedCourse)) {
      found = true;
      break;
    }
  }

  if (!found) {
    for (let i = rebalanced.length - 1; i >= 0; i--) {
      const slot = rebalanced[i];
      if (!slot || slot.isTarc) continue;
      slot.courses.push(removedCourse);
      found = true;
      break;
    }

    if (!found) {
      const last = rebalanced[rebalanced.length - 1];
      const newOriginalRow =
        last.originalRow + 1 || rebalanced.length + 1;

      rebalanced.push({
        id: `sem-extra-${rebalanced.length + 1}`,
        originalRow: newOriginalRow,
        courses: [removedCourse],
        isTarc: false,
      });
    }
  }

  return rebalanced;
}

export {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
  placeCourse,
  trimTrailingEmptySemesters,
};
