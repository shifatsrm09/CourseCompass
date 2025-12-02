// src/components/Planner/CourseBox.js - MINIMAL
import React from "react";

export default function CourseBox({ course, isLocked, onReplace }) {
  return (
    <div
      className={`course-chip ${isLocked ? "course-chip-locked" : ""}`}
      onClick={isLocked ? undefined : onReplace}
      title={course.title || course.code}
    >
      <span className="course-code">{course.code}</span>
    </div>
  );
}