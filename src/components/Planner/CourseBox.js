import React from "react";

export default function CourseBox({ course, isLocked, onReplace }) {
  return (
    <button
      type="button"
      className={`course-box ${isLocked ? "course-box-locked" : ""}`}
      onClick={onReplace}
      disabled={isLocked}
      aria-label={isLocked ? course.code : `Edit ${course.code}`}
    >
      <span className="course-box-main"><span className="course-code">{course.code}</span></span>
      {course.completed && <span className="course-completed-label">COMPLETED</span>}
    </button>
  );
}
