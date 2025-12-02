/**
 * ---------------------------------------------------------------------
 * CourseBox.js
 * ---------------------------------------------------------------------
 * PURPOSE:
 * A small rectangular UI element that displays a single course.
 *
 * ROLE IN SYSTEM:
 * - Used inside SemesterRow.js to list each course
 * - Acts as a clickable button when replacing a course
 * - Shows course code, and applies locked styles when needed
 *
 * BEHAVIOR:
 * - If isLocked = true       → cannot click (no replace allowed)
 * - If isLocked = false      → click triggers onReplace()
 *
 * PROPS:
 * - course   → { code, hp, type, ... }
 * - isLocked → whether course can be replaced
 * - onReplace → called when user clicks a course
 *
 * VISUAL:
 * - Uses .course-box and .course-box-locked classes
 *
 * USED IN:
 * - SemesterRow.js
 * ---------------------------------------------------------------------
 */

import React from "react";

export default function CourseBox({ course, isLocked, onReplace }) {
  return (
    <div
      className={`course-box ${isLocked ? "course-box-locked" : ""}`}
      onClick={isLocked ? undefined : onReplace}
    >
      <div className="course-box-main">
        <span className="course-code">{course.code}</span>
      </div>
    </div>
  );
}
