/**
 * =========================================================================
 * usePlannerState.js
 * =========================================================================
 * PURPOSE:
 *   React hook responsible for:
 *     - Loading initial semesterSlots from stream/custom plan
 *     - Reactively updating slots when stream/customPlan/allCourses change
 *
 * RESPONSIBILITY:
 *   - Detect whether user has a custom plan
 *   - If not → load default plan from the selected stream (streamsConfig)
 *   - If yes → rebuild UI plan from DB saved plan
 *   - Automatically fall back to default plan if the custom plan
 *     becomes invalid or incomplete
 *   - Automatically rebuild slots when:
 *       user.stream changes
 *       user.customPlan changes
 *       allCourses are loaded
 *
 * WHY THIS FILE EXISTS:
 *   The logic for correctly building semesterSlots is non-trivial
 *   and used in many places. This hook centralizes it to ensure:
 *     - Consistency
 *     - Correct fallbacks
 *     - Clean component code in index.js
 *
 * INPUT:
 *   { user, allCourses }
 *
 * OUTPUT:
 *   {
 *     semesterSlots,     // array of semester objects
 *     setSemesterSlots   // state setter used elsewhere
 *   }
 *
 * USED BY:
 *   - CoursePlanner/index.js
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/usePlannerState.js
import { useState, useEffect } from "react";
import {
  getBasePlanForStream,
  buildSlotsFromFlatPlan,
  buildSlotsFromCustomPlan,
} from "./plannerUtils";

export default function usePlannerState({ user, allCourses }) {
  const [semesterSlots, setSemesterSlots] = useState(() => {
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      return buildSlotsFromFlatPlan(getBasePlanForStream(user.stream));
    }

    if (!Array.isArray(allCourses) || allCourses.length === 0) {
      return [];
    }

    const { slots, matchRatio } = buildSlotsFromCustomPlan(
      user.customPlan,
      allCourses
    );

    if (matchRatio < 0.5) {
      return buildSlotsFromFlatPlan(getBasePlanForStream(user.stream));
    }

    return slots;
  });

  useEffect(() => {
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) return;
    if (!Array.isArray(allCourses) || allCourses.length === 0) return;

    const { slots, matchRatio } = buildSlotsFromCustomPlan(
      user.customPlan,
      allCourses
    );

    if (matchRatio < 0.5) {
      setSemesterSlots(buildSlotsFromFlatPlan(getBasePlanForStream(user.stream)));
      return;
    }

    setSemesterSlots(slots);
  }, [user.customPlan, allCourses, user.stream]);

  useEffect(() => {
    if (!user.stream) return;
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      setSemesterSlots(buildSlotsFromFlatPlan(getBasePlanForStream(user.stream)));
    }
  }, [user.stream, user.customPlan]);

  return { semesterSlots, setSemesterSlots };
}
