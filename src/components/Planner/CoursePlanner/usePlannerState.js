import { useState, useEffect } from "react";
import thesisPlan from "../../../data/thesisPlan.json";
import streamsConfig, { DEFAULT_STREAM_ID } from "../../../data/streamsConfig";

const getBasePlanForStream = (streamId) => {
  const id = streamsConfig[streamId] ? streamId : DEFAULT_STREAM_ID;
  return streamsConfig[id].plan || [];
};

const buildSlotsFromFlatPlan = (flat = []) => {
  const bySem = {};

  flat.forEach((course) => {
    const row = course.semester_row;
    if (row == null) return;
    if (!bySem[row]) bySem[row] = [];
    bySem[row].push({ ...course });
  });

  return Object.keys(bySem)
    .sort((a, b) => a - b)
    .map((row) => {
      const sem = Number(row);
      const courses = bySem[row].map((c) => ({ ...c }));
      return {
        id: `sem-${sem}`,
        originalRow: sem,
        courses,
        isTarc: courses.some((c) => c.is_tarc),
        thesis: thesisPlan.find((t) => t.semester_row === sem) || null,
      };
    });
};

const buildSlotsFromCustomPlan = (customPlan = [], allCourses) => {
  let desired = 0,
    matched = 0;

  const slots = customPlan.map((p) => {
    const codes = Array.isArray(p.courses) ? p.courses : [];
    desired += codes.length;

    const rowCourses = allCourses.filter((c) => codes.includes(c.code));
    matched += rowCourses.length;

    return {
      id: `sem-${p.semester}`,
      originalRow: p.semester,
      courses: rowCourses.map((c) => ({ ...c })),
      isTarc: rowCourses.some((c) => c.is_tarc),
      thesis: thesisPlan.find((t) => t.semester_row === p.semester) || null,
    };
  });

  return { slots, matchRatio: desired === 0 ? 1 : matched / desired };
};

const applySemesterOrder = (slots, semesterOrder) => {
  if (!Array.isArray(semesterOrder) || !semesterOrder.length) return slots;

  const map = new Map();
  slots.forEach((s) => map.set(s.originalRow, s));

  const ordered = [];

  semesterOrder.forEach((row) => {
    if (map.has(row)) {
      ordered.push(map.get(row));
      map.delete(row);
    }
  });

  map.forEach((s) => ordered.push(s));

  return ordered;
};

export default function usePlannerState({ user, allCourses }) {
  const [semesterSlots, setSemesterSlots] = useState([]);

  const stream = user?.stream;
  const customPlan = user?.customPlan;
  const semesterOrder = user?.semesterOrder;

  useEffect(() => {
    if (!stream) {
      setSemesterSlots([]);
      return;
    }

    const hasCustom = Array.isArray(customPlan) && customPlan.length > 0;

    let baseSlots = [];

    if (!hasCustom) {
      // first login
      baseSlots = buildSlotsFromFlatPlan(getBasePlanForStream(stream));
    } else {
      if (!Array.isArray(allCourses) || allCourses.length === 0) return;

      const { slots, matchRatio } = buildSlotsFromCustomPlan(
        customPlan,
        allCourses
      );

      baseSlots =
        matchRatio < 0.5
          ? buildSlotsFromFlatPlan(getBasePlanForStream(stream))
          : slots;
    }

    const finalSlots = applySemesterOrder(baseSlots, semesterOrder);
    setSemesterSlots(finalSlots);
  }, [stream, customPlan, semesterOrder, allCourses]);

  return { semesterSlots, setSemesterSlots };
}
