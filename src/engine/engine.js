// src/engine/engine.js

/**
 * Count how many times COD is used in completed + planned semesters.
 */
function countCodUsages(semesterSlots, completedCourses = []) {
  let count = 0;

  // COD that are already completed (from DB)
  for (const code of completedCourses) {
    if (code === "COD") count++;
  }

  // COD in current plan (all semesters)
  for (const slot of semesterSlots) {
    for (const c of slot.courses || []) {
      if (c.code === "COD") count++;
    }
  }

  return count;
}

/**
 * Check if all hard prerequisites (hp) are satisfied.
 * We treat empty strings and empty arrays as "no HP".
 */
function hardPrereqsSatisfied(course, completedSet) {
  const hp = Array.isArray(course.hp) ? course.hp : [];

  // ignore blank strings
  const cleanHp = hp.filter((code) => code && code.trim() !== "");

  if (cleanHp.length === 0) return true;

  return cleanHp.every((code) => completedSet.has(code));
}

/**
 * Build a Set of completed course codes.
 * We trust user.completedCourses from the backend,
 * and ALSO include all courses in semesters that are fully "completed"
 * based on currentSemester index.
 *
 * currentSemester is 1-based in your app.
 */
function buildCompletedSet(semesterSlots, currentSemester, completedCoursesFromUser = []) {
  const completed = new Set(completedCoursesFromUser || []);

  // Add courses from visually completed semesters (index < currentSemester - 1)
  semesterSlots.forEach((slot, index) => {
    if (index < (currentSemester || 1) - 1) {
      (slot.courses || []).forEach((c) => completed.add(c.code));
    }
  });

  return completed;
}

/**
 * VALIDATION FUNCTION for adding a course to a semester.
 *
 * It does NOT mutate anything. It only answers:
 * - Is this add allowed under HP & COD rules?
 * - If not, why?
 */
export function validateAddCourse({
  semesterIndex,
  courseToAdd,
  semesterSlots,
  currentSemester,
  completedCourses, // from user.completedCourses
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
}) {
  if (
    semesterIndex == null ||
    !semesterSlots ||
    !semesterSlots[semesterIndex] ||
    !courseToAdd
  ) {
    return {
      ok: false,
      reason: "Invalid data passed to engine.",
    };
  }

  const slot = semesterSlots[semesterIndex];

  // 1) TARC semesters are not editable
  if (slot.isTarc) {
    return {
      ok: false,
      reason: "You cannot add courses to the TARC semester.",
    };
  }

  // 2) Max courses per semester check
  if ((slot.courses || []).length >= maxCoursesPerSemester) {
    return {
      ok: false,
      reason: `You cannot take more than ${maxCoursesPerSemester} courses in a semester.`,
    };
  }

  // 3) Build completed set (DB + visually completed semesters)
  const completedSet = buildCompletedSet(
    semesterSlots,
    currentSemester,
    completedCourses
  );

  // 4) Hard prerequisite check
  if (!hardPrereqsSatisfied(courseToAdd, completedSet)) {
    const hp = (courseToAdd.hp || []).filter((h) => h && h.trim() !== "");
    return {
      ok: false,
      reason:
        hp.length > 0
          ? `You must complete [${hp.join(
              ", "
            )}] before taking ${courseToAdd.code}.`
          : `Prerequisites for ${courseToAdd.code} are not satisfied.`,
    };
  }

  // 5) COD limit check
  if (courseToAdd.code === "COD") {
    const codUsed = countCodUsages(semesterSlots, completedCourses);

    if (codUsed >= maxCodAllowed) {
      return {
        ok: false,
        reason: `You have already taken the maximum allowed COD courses (${maxCodAllowed}).`,
      };
    }
  }

  // If we reach here, everything is valid
  return {
    ok: true,
    reason: null,
  };
}
