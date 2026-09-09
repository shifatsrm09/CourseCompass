const { isDeepStrictEqual } = require("node:util");
const { buildCurriculum } = require("../src/engine/plannerState.mjs");

const plans = {
  "ENG101 + MAT110": require("../src/data/ENG101-MAT110.json"),
  "ENG101 + MAT092": require("../src/data/ENG101-MAT092.json"),
  "ENG102 + MAT110": require("../src/data/ENG102-MAT110.json"),
  "ENG102 + MAT092": require("../src/data/ENG102-MAT092.json"),
  "ENG091 + MAT110": require("../src/data/ENG091-MAT110.json"),
  "ENG091 + MAT092": require("../src/data/ENG091-MAT092.json"),
};
const curricula = new Map();

function getCurriculum(stream) {
  if (!Object.hasOwn(plans, stream)) return null;
  if (!curricula.has(stream)) curricula.set(stream, buildCurriculum(plans[stream], stream));
  return curricula.get(stream);
}

function codesForSemester(semester, curriculum) {
  return (semester?.courses || []).map((course) => curriculum.byId.get(course.occurrenceId).code);
}

function deriveLegacyFields(state, curriculum) {
  const customPlan = state.semesters.map((semester) => ({
    semester: semester.originalRow,
    courses: codesForSemester(semester, curriculum),
  }));
  return {
    customPlan,
    semesterOrder: state.semesters.map((semester) => semester.originalRow),
    currentSemester: state.currentSemester,
    completedCourses: state.completedCourses,
    currentCourses: codesForSemester(state.semesters[state.currentSemester - 1], curriculum),
    codCount: customPlan.reduce((count, semester) => count + semester.courses.filter((code) => code === "COD").length, 0),
    firstLogin: false,
  };
}

module.exports = { getCurriculum, deriveLegacyFields, samePlannerState: isDeepStrictEqual };
