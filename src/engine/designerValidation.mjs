import { getPrerequisiteViolations } from "./prerequisites.mjs";
import { isLabCourse } from "./labs.mjs";

/**
 * Validates a Designer planner state and extracts structured Problems and Warnings.
 *
 * Problems (Severity: problem):
 * - Prerequisite violations
 * - Course overload (>5 courses per semester)
 * - Multiple COD courses per semester (>1) or total (>5)
 * - TARC misplacements
 * - Unscheduled / unplaced courses
 * - Planner engine errors
 *
 * Warnings (Severity: warning):
 * - Heavy lab concentration (>= 4 lab courses in a semester)
 * - Engine/planner advisory warnings
 *
 * @param {object} state - PlannerState
 * @param {object} curriculum - Curriculum definitions
 * @param {object} options - { plannerWarnings: Array, plannerError: string|object }
 * @returns {{ problems: Array, warnings: Array, summary: { problemCount: number, warningCount: number, totalCount: number } }}
 */
export function validateDesignerPlan(state, curriculum, options = {}) {
  const problems = [];
  const warnings = [];

  if (!state || !curriculum || !Array.isArray(state.semesters)) {
    return {
      problems,
      warnings,
      summary: { problemCount: 0, warningCount: 0, totalCount: 0 },
    };
  }

  // 1. Prerequisite Violations (Problem)
  const violationsByInstance = getPrerequisiteViolations(state, curriculum);
  violationsByInstance.forEach((issues, instanceId) => {
    issues.forEach((issue) => {
      const { prereqCode, courseCode, courseSemester, isHard } = issue;
      const isSoft = isHard === false;

      let prereqSemester = null;
      let prereqSemesterId = null;
      let prereqInstanceId = null;

      for (let sIdx = 0; sIdx < state.semesters.length; sIdx++) {
        const sem = state.semesters[sIdx];
        if (!Array.isArray(sem?.courses)) continue;
        const found = sem.courses.find((c) => {
          const code = curriculum.byId?.get(c.occurrenceId)?.code;
          return code === prereqCode;
        });
        if (found) {
          if (prereqSemester === null || (sIdx + 1 >= courseSemester && prereqSemester < courseSemester)) {
            prereqSemester = sIdx + 1;
            prereqSemesterId = sem.id;
            prereqInstanceId = found.instanceId;
          }
        }
      }

      if (!prereqInstanceId && Array.isArray(state.unplaced)) {
        const unplacedFound = state.unplaced.find((c) => {
          const code = curriculum.byId?.get(c.occurrenceId)?.code;
          return code === prereqCode;
        });
        if (unplacedFound) {
          prereqInstanceId = unplacedFound.instanceId;
        }
      }

      const currentSem = state.semesters[courseSemester - 1];
      const courseSemesterId = currentSem?.id;

      let message = "";
      if (prereqSemester !== null) {
        if (prereqSemester > courseSemester) {
          message = `${courseCode} requires ${prereqCode}, but ${prereqCode} is scheduled after ${courseCode} (Semester ${prereqSemester}).`;
        } else if (prereqSemester === courseSemester) {
          message = `${courseCode} requires ${prereqCode}, but both are scheduled in Semester ${courseSemester}.`;
        } else {
          message = `${courseCode} requires ${prereqCode}, but prerequisite is not satisfied.`;
        }
      } else {
        message = `${courseCode} requires ${prereqCode}, but ${prereqCode} is not scheduled in any semester.`;
      }

      problems.push({
        id: `problem:prereq:${instanceId}:${prereqCode}`,
        type: "PREREQUISITE_VIOLATION",
        severity: "problem",
        title: isSoft ? "Prerequisite / Corequisite violation" : "Prerequisite violation",
        message,
        rule: isSoft
          ? "Soft prerequisites / corequisites must be scheduled concurrently or in an earlier semester."
          : "Prerequisites must be completed in an earlier semester before taking advanced courses.",
        courses: prereqCode ? [courseCode, prereqCode] : [courseCode],
        instanceIds: [instanceId, ...(prereqInstanceId ? [prereqInstanceId] : [])],
        semesters: prereqSemester ? [courseSemester, prereqSemester] : [courseSemester],
        semesterIds: [courseSemesterId, ...(prereqSemesterId ? [prereqSemesterId] : [])].filter(Boolean),
        primarySemester: courseSemester,
        primarySemesterId: courseSemesterId,
        primaryCourseCode: courseCode,
        primaryInstanceId: instanceId,
      });
    });
  });

  // 2. Course Overload (> 5 courses in a normal semester) (Problem)
  state.semesters.forEach((semester, index) => {
    if (!semester.isTarc && Array.isArray(semester.courses) && semester.courses.length > 5) {
      const semNum = index + 1;
      const courseCodes = semester.courses.map((c) => curriculum.byId?.get(c.occurrenceId)?.code || c.instanceId);
      problems.push({
        id: `problem:overload:${semester.id}`,
        type: "COURSE_OVERLOAD",
        severity: "problem",
        title: "Course overload",
        message: `Semester ${semNum} contains ${semester.courses.length} courses. The maximum recommended load is 5.`,
        rule: "Standard academic policy recommends at most 5 courses per semester.",
        courses: courseCodes,
        instanceIds: semester.courses.map((c) => c.instanceId),
        semesters: [semNum],
        semesterIds: [semester.id],
        primarySemester: semNum,
        primarySemesterId: semester.id,
      });
    }
  });

  // 3. COD Limits (Problem)
  let totalCod = 0;
  state.semesters.forEach((semester, index) => {
    if (Array.isArray(semester.courses)) {
      const cods = semester.courses.filter((c) => curriculum.byId?.get(c.occurrenceId)?.code === "COD");
      totalCod += cods.length;
      if (cods.length > 1) {
        const semNum = index + 1;
        problems.push({
          id: `problem:cod_multi:${semester.id}`,
          type: "COD_LIMIT",
          severity: "problem",
          title: "Multiple COD courses",
          message: `Semester ${semNum} contains ${cods.length} COD courses. Maximum allowed per semester is 1.`,
          rule: "Students can register for at most 1 Course Outside Department (COD) per semester.",
          courses: ["COD"],
          instanceIds: cods.map((c) => c.instanceId),
          semesters: [semNum],
          semesterIds: [semester.id],
          primarySemester: semNum,
          primarySemesterId: semester.id,
        });
      }
    }
  });

  if (totalCod > 5) {
    problems.push({
      id: "problem:cod_total",
      type: "COD_LIMIT",
      severity: "problem",
      title: "COD limit exceeded",
      message: `The plan contains ${totalCod} COD courses. A degree can contain at most 5 COD occurrences.`,
      rule: "A curriculum permits a maximum of 5 COD courses in total.",
      courses: ["COD"],
      instanceIds: [],
      semesters: [],
      semesterIds: [],
    });
  }

  // 4. TARC Semester Violations (Problem)
  state.semesters.forEach((semester, index) => {
    if (Array.isArray(semester.courses)) {
      const semNum = index + 1;
      if (semester.isTarc) {
        const nonTarc = semester.courses.filter((c) => !curriculum.byId?.get(c.occurrenceId)?.is_tarc);
        if (nonTarc.length > 0) {
          const codes = nonTarc.map((c) => curriculum.byId?.get(c.occurrenceId)?.code || "Non-TARC");
          problems.push({
            id: `problem:tarc_invalid:${semester.id}`,
            type: "TARC_VIOLATION",
            severity: "problem",
            title: "Non-TARC course in TARC",
            message: `Semester ${semNum} (TARC) contains non-TARC course(s): ${codes.join(", ")}.`,
            rule: "Only approved TARC courses can be placed in the TARC semester.",
            courses: codes,
            instanceIds: nonTarc.map((c) => c.instanceId),
            semesters: [semNum],
            semesterIds: [semester.id],
            primarySemester: semNum,
            primarySemesterId: semester.id,
          });
        }
      } else {
        const tarcMisplaced = semester.courses.filter((c) => curriculum.byId?.get(c.occurrenceId)?.is_tarc);
        if (tarcMisplaced.length > 0) {
          const codes = tarcMisplaced.map((c) => curriculum.byId?.get(c.occurrenceId)?.code || "TARC");
          problems.push({
            id: `problem:tarc_misplaced:${semester.id}`,
            type: "TARC_VIOLATION",
            severity: "problem",
            title: "TARC course outside TARC",
            message: `Semester ${semNum} contains TARC course(s): ${codes.join(", ")}. These must be in the TARC semester.`,
            rule: "TARC courses must remain inside the TARC semester.",
            courses: codes,
            instanceIds: tarcMisplaced.map((c) => c.instanceId),
            semesters: [semNum],
            semesterIds: [semester.id],
            primarySemester: semNum,
            primarySemesterId: semester.id,
          });
        }
      }
    }
  });

  // 5. Unplaced Courses (Problem)
  if (Array.isArray(state.unplaced) && state.unplaced.length > 0) {
    const codes = state.unplaced.map((c) => curriculum.byId?.get(c.occurrenceId)?.code || "Unknown");
    problems.push({
      id: "problem:unplaced",
      type: "UNPLACED_COURSES",
      severity: "problem",
      title: "Unscheduled courses",
      message: `${state.unplaced.length} course(s) are awaiting semester placement: ${codes.join(", ")}.`,
      rule: "All required curriculum courses must be placed in a semester.",
      courses: codes,
      instanceIds: state.unplaced.map((c) => c.instanceId),
      semesters: [],
      semesterIds: [],
    });
  }

  // 6. Planner Engine Error if any (Problem)
  if (options.plannerError) {
    const text = typeof options.plannerError === "string" ? options.plannerError : options.plannerError.message || "Planner error";
    problems.unshift({
      id: "problem:engine_error",
      type: "ENGINE_ERROR",
      severity: "problem",
      title: "Planner error",
      message: text,
      rule: "The planner encountered an unexpected error.",
      courses: [],
      instanceIds: [],
      semesters: [],
      semesterIds: [],
    });
  }

  // 7. Heavy Lab Load (>= 4 lab courses in a semester) (Warning)
  state.semesters.forEach((semester, index) => {
    if (Array.isArray(semester.courses)) {
      const labCourses = semester.courses.filter((c) => {
        const code = curriculum.byId?.get(c.occurrenceId)?.code;
        return isLabCourse(code);
      });
      if (labCourses.length >= 4) {
        const semNum = index + 1;
        const labCodes = labCourses.map((c) => curriculum.byId?.get(c.occurrenceId)?.code);
        warnings.push({
          id: `warning:lab_overload:${semester.id}`,
          type: "LAB_OVERLOAD",
          severity: "warning",
          title: "Heavy lab load",
          message: `Semester ${semNum} contains ${labCourses.length} lab courses (${labCodes.join(", ")}). Recommended maximum is 3.`,
          rule: "Taking 4 or more lab courses in one term may result in an unusually heavy practical workload.",
          courses: labCodes,
          instanceIds: labCourses.map((c) => c.instanceId),
          semesters: [semNum],
          semesterIds: [semester.id],
          primarySemester: semNum,
          primarySemesterId: semester.id,
        });
      }
    }
  });

  // 8. Advisory Planner Warnings (Warning)
  if (Array.isArray(options.plannerWarnings) && options.plannerWarnings.length > 0) {
    options.plannerWarnings.forEach((w, idx) => {
      const text = typeof w === "string" ? w : w?.message || "Planner warning";
      warnings.push({
        id: `warning:planner:${idx}`,
        type: "PLANNER_WARNING",
        severity: "warning",
        title: "Planner warning",
        message: text,
        rule: "Advisory note from the planner engine.",
        courses: [],
        instanceIds: [],
        semesters: [],
        semesterIds: [],
      });
    });
  }

  return {
    problems,
    warnings,
    summary: {
      problemCount: problems.length,
      warningCount: warnings.length,
      totalCount: problems.length + warnings.length,
    },
  };
}
