/**
 * Derives prerequisite violations dynamically for a planner state.
 * Returns a Map<string (instanceId), Array<{
 *   prereqCode: string,
 *   prereqStatus: string,
 *   courseCode: string,
 *   courseSemester: number
 * }>>
 */
export function getPrerequisiteViolations(state, curriculum) {
  if (!state || !curriculum || !Array.isArray(state.semesters)) {
    return new Map();
  }

  // Map each course code to the 0-indexed semester positions where it appears
  const codePlacements = new Map();
  state.semesters.forEach((sem, sIdx) => {
    if (!Array.isArray(sem?.courses)) return;
    sem.courses.forEach((c) => {
      const code = curriculum.byId?.get(c.occurrenceId)?.code;
      if (code) {
        if (!codePlacements.has(code)) codePlacements.set(code, []);
        codePlacements.get(code).push(sIdx);
      }
    });
  });

  const completed = new Set(state.completedCourses || []);
  const violationsByInstance = new Map();

  state.semesters.forEach((sem, semesterIndex) => {
    if (!Array.isArray(sem?.courses)) return;

    sem.courses.forEach((course) => {
      const definition = curriculum.byId?.get(course.occurrenceId);
      if (!definition || !Array.isArray(definition.hp) || definition.hp.length === 0) {
        return;
      }

      const courseCode = definition.code;
      // If course is recorded as completed before current semester, it was completed historically
      if (
        courseCode !== "COD" &&
        completed.has(courseCode) &&
        semesterIndex < (state.currentSemester || 1) - 1
      ) {
        return;
      }

      const issues = [];
      for (const prereqCode of definition.hp) {
        if (!prereqCode || prereqCode.trim() === "") continue;
        if (!curriculum.byCode?.has(prereqCode)) continue;

        const isCompleted = completed.has(prereqCode);
        const earlierPlacement = codePlacements.get(prereqCode)?.find((pos) => pos < semesterIndex);

        // If neither completed nor placed in an earlier semester, prerequisite is violated
        if (!isCompleted && earlierPlacement === undefined) {
          const currentPlacements = codePlacements.get(prereqCode) || [];
          let prereqStatus = "Not scheduled in any semester";

          if (currentPlacements.length > 0) {
            const firstSlot = currentPlacements[0];
            if (firstSlot === semesterIndex) {
              prereqStatus = `Currently scheduled in same semester (Semester ${firstSlot + 1})`;
            } else {
              prereqStatus = `Currently scheduled in Semester ${firstSlot + 1}`;
            }
          } else if (
            Array.isArray(state.unplaced) &&
            state.unplaced.some((u) => curriculum.byId?.get(u.occurrenceId)?.code === prereqCode)
          ) {
            prereqStatus = "Currently unscheduled";
          }

          issues.push({
            prereqCode,
            prereqStatus,
            courseCode,
            courseSemester: semesterIndex + 1,
          });
        }
      }

      if (issues.length > 0) {
        violationsByInstance.set(course.instanceId, issues);
      }
    });
  });

  return violationsByInstance;
}
