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

  const unplacedCodes = new Set(
    (state.unplaced || []).map((u) => curriculum.byId?.get(u.occurrenceId)?.code).filter(Boolean)
  );
  const completed = new Set(state.completedCourses || []);
  const violationsByInstance = new Map();

  state.semesters.forEach((sem, semesterIndex) => {
    if (!Array.isArray(sem?.courses)) return;

    sem.courses.forEach((course) => {
      const definition = curriculum.byId?.get(course.occurrenceId);
      if (!definition) return;
      const courseCode = definition.code;
      if (courseCode === "COD") return;

      const issues = [];
      const checkedPrereqs = new Set();

      // 1. Hard prerequisites (hp): must be strictly earlier (pos < semesterIndex)
      for (const prereqCode of (definition.hp || [])) {
        if (!prereqCode || !prereqCode.trim() || !curriculum.byCode?.has(prereqCode)) continue;
        checkedPrereqs.add(prereqCode);
        const placements = codePlacements.get(prereqCode) || [];
        const earlierPlacement = placements.find((pos) => pos < semesterIndex);

        if (earlierPlacement === undefined) {
          if (placements.length > 0) {
            let prereqStatus;
            if (placements.includes(semesterIndex)) {
              prereqStatus = `Currently scheduled in same semester (Semester ${semesterIndex + 1})`;
            } else {
              const firstLater = placements.find((pos) => pos > semesterIndex);
              prereqStatus = `Currently scheduled after in Semester ${firstLater + 1}`;
            }
            issues.push({
              prereqCode,
              prereqStatus,
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: true,
            });
          } else if (unplacedCodes.has(prereqCode)) {
            issues.push({
              prereqCode,
              prereqStatus: "Currently unscheduled",
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: true,
            });
          } else if (!completed.has(prereqCode)) {
            issues.push({
              prereqCode,
              prereqStatus: "Not scheduled in any semester",
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: true,
            });
          }
        }
      }

      // 2. Soft prerequisites / Corequisites (sp): can be concurrent (pos <= semesterIndex), but NOT after (pos > semesterIndex)
      for (const spCode of (definition.sp || [])) {
        if (!spCode || !spCode.trim() || checkedPrereqs.has(spCode) || !curriculum.byCode?.has(spCode)) continue;
        checkedPrereqs.add(spCode);
        const placements = codePlacements.get(spCode) || [];
        const validPlacement = placements.find((pos) => pos <= semesterIndex);

        if (validPlacement === undefined) {
          if (placements.length > 0) {
            const firstLater = placements.find((pos) => pos > semesterIndex);
            issues.push({
              prereqCode: spCode,
              prereqStatus: `Currently scheduled after in Semester ${firstLater + 1}`,
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: false,
            });
          } else if (unplacedCodes.has(spCode)) {
            issues.push({
              prereqCode: spCode,
              prereqStatus: "Currently unscheduled",
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: false,
            });
          } else if (!completed.has(spCode)) {
            issues.push({
              prereqCode: spCode,
              prereqStatus: "Not scheduled in any semester",
              courseCode,
              courseSemester: semesterIndex + 1,
              isHard: false,
            });
          }
        }
      }

      if (issues.length > 0) {
        violationsByInstance.set(course.instanceId, issues);
      }
    });
  });

  return violationsByInstance;
}
