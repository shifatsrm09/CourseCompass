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
