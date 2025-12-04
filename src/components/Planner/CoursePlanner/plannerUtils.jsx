/**
 * =========================================================================
 * plannerUtils.js
 * =========================================================================
 * PURPOSE:
 *   Utility functions for building semester slot structures from either:
 *     - The official default stream plan
 *     - A user-customized DB plan
 *
 * RESPONSIBILITY:
 *   1. getBasePlanForStream(streamId)
 *        → Returns the JSON plan associated with a specific stream
 *
 *   2. buildSlotsFromFlatPlan(flatPlan)
 *        → Converts a flat JSON list into structured semester “slots”
 *        → Used when user has no custom plan
 *
 *   3. buildSlotsFromCustomPlan(customPlan, allCourses)
 *        → Converts the DB’s saved plan into UI-friendly semester slots
 *        → Checks matchRatio (missing/invalid courses)
 *        → Falls back to official plan if corrupted (<50% match)
 *
 * WHY THIS FILE EXISTS:
 *   Building “semesterSlots” is shared logic used in:
 *      - initial loading
 *      - stream switching
 *      - DB hydration
 *
 *   Keeping this here avoids rewriting deep, complex transformation code.
 *
 * FITS INTO:
 *   - Used by usePlannerState for initial and reactive plan building.
 *
 * OUTPUT:
 *   Returns an array of `slot` objects:
 *      {
 *        id: "sem-3",
 *        originalRow: 3,
 *        courses: [...],
 *        thesis: {...} | null,
 *        isTarc: boolean
 *      }
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/plannerUtils.js
import thesisPlan from "../../../data/thesisPlan.json";
import streamsConfig, { DEFAULT_STREAM_ID } from "../../../data/streamsConfig";

export const getBasePlanForStream = (streamId) => {
  const id = streamsConfig[streamId] ? streamId : DEFAULT_STREAM_ID;
  return streamsConfig[id].plan;
};

export const buildSlotsFromFlatPlan = (flat = []) => {
  const bySemester = {};
  flat.forEach((course) => {
    const sem = course.semester_row;
    if (sem == null) return;
    if (!bySemester[sem]) bySemester[sem] = [];
    bySemester[sem].push({ ...course });
  });

  return Object.keys(bySemester)
    .sort((a, b) => Number(a) - Number(b))
    .map((semStr) => {
      const sem = Number(semStr);
      const semesterCourses = bySemester[sem].map((c) => ({ ...c }));
      const thesis = thesisPlan.find((t) => t.semester_row === sem) || null;

      return {
        id: `sem-${sem}`,
        originalRow: sem,
        courses: semesterCourses,
        isTarc: semesterCourses.some((c) => c.is_tarc),
        thesis,
      };
    });
};

export const buildSlotsFromCustomPlan = (customPlan = [], allCourses = []) => {
  if (!Array.isArray(customPlan) || !Array.isArray(allCourses)) {
    return { slots: [], matchRatio: 0 };
  }

  let totalRequested = 0;
  let totalMatched = 0;

  const slots = customPlan.map((p) => {
    const desiredCodes = Array.isArray(p.courses) ? p.courses : [];
    totalRequested += desiredCodes.length;

    const rowCourses = allCourses.filter((c) => desiredCodes.includes(c.code));
    totalMatched += rowCourses.length;

    const deepCourses = rowCourses.map((c) => ({ ...c }));
    const thesis = thesisPlan.find((t) => t.semester_row === p.semester) || null;

    return {
      id: `sem-${p.semester}`,
      originalRow: p.semester,
      courses: deepCourses,
      isTarc: deepCourses.some((c) => c.is_tarc),
      thesis,
    };
  });

  const matchRatio =
    totalRequested === 0 ? 1 : totalMatched / totalRequested;

  return { slots, matchRatio };
};
