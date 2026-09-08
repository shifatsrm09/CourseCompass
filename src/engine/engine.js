

import {
  hardPrereqsSatisfied,
  buildCompletedUpTo,
} from "./removeEngine";




function countCodInPlan(semesterSlots) {
  let count = 0;

  (semesterSlots || []).forEach((slot) => {
    (slot?.courses || []).forEach((c) => {
      if (c && c.code === "COD") count++;
    });
  });

  return count;
}












function validateCourseForSemester({
  semesterIndex,
  course,
  semesterSlots,
  currentSemester,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
  mode = "add",
}) {
  if (
    !Array.isArray(semesterSlots) ||
    semesterIndex < 0 ||
    semesterIndex >= semesterSlots.length
  ) {
    return { ok: false, reason: "Invalid semester." };
  }

  if (!course || !course.code) {
    return { ok: false, reason: "Invalid course selection." };
  }

  const targetSlot = semesterSlots[semesterIndex];
  if (!targetSlot) {
    return { ok: false, reason: "Invalid semester." };
  }


  if (targetSlot.isTarc) {
    return {
      ok: false,
      reason: "You cannot modify courses in the TARC semester.",
    };
  }

  const isCod = course.code === "COD";


  let effectiveMax = maxCoursesPerSemester;
  const row =
    typeof targetSlot.originalRow === "number" ? targetSlot.originalRow : null;

  if (row === 10 || row === 11) {
    effectiveMax = Math.min(effectiveMax, 3);
  }



  if (
    mode === "add" &&
    (targetSlot.courses || []).length >= effectiveMax
  ) {
    return {
      ok: false,
      reason: `You cannot take more than ${effectiveMax} courses in this semester.`,
    };
  }


  if (isCod && mode === "add") {
    const alreadyHasCod = (targetSlot.courses || []).some(
      (c) => c.code === "COD"
    );
    if (alreadyHasCod) {
      return {
        ok: false,
        reason: "You already have a COD course in this semester.",
      };
    }
  }



  if (isCod) {
    const codInPlan = countCodInPlan(semesterSlots);

    if (codInPlan >= maxCodAllowed) {

      let futureHasCod = false;

      for (let i = semesterIndex + 1; i < semesterSlots.length; i++) {
        const slot = semesterSlots[i];
        if ((slot?.courses || []).some((c) => c.code === "COD")) {
          futureHasCod = true;
          break;
        }
      }

      if (!futureHasCod) {
        return {
          ok: false,
          reason: `You have already planned ${maxCodAllowed} COD courses in total.`,
        };
      }


    }
  }



  const completedSet = buildCompletedUpTo(
    semesterSlots,
    semesterIndex,
    completedCourses
  );

  if (!hardPrereqsSatisfied(course, completedSet)) {
    const hpArray = Array.isArray(course.hp) ? course.hp : [];
    const missing = hpArray
      .filter((code) => code && code.trim() !== "")
      .filter((code) => !completedSet.has(code));

    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Missing prerequisite(s): ${missing.join(", ")}`,
      };
    }

    return { ok: false, reason: "Prerequisites are not satisfied." };
  }


  return { ok: true };
}






export function validateAddCourse({
  semesterIndex,
  courseToAdd,
  semesterSlots,
  currentSemester,
  completedCourses = [],
  maxCoursesPerSemester = 5,
  maxCodAllowed = 5,
}) {
  return validateCourseForSemester({
    semesterIndex,
    course: courseToAdd,
    semesterSlots,
    currentSemester,
    completedCourses,
    maxCoursesPerSemester,
    maxCodAllowed,
    mode: "add",
  });
}


export { validateCourseForSemester };
