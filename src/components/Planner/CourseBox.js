import React from "react";

export default function CourseBox({ course, isLocked, onDrop, onReplace }) {
  return (
    <div
      className={`course-box ${isLocked ? "course-box-locked" : ""}`}
      onClick={isLocked ? undefined : onReplace}
    >
      <div className="course-box-main">
        <span className="course-code">{course.code}</span>
      </div>

      {!isLocked && (
        <button
          className="course-drop-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDrop();
          }}
          title="Remove course"
        >
          ×
        </button>
      )}
    </div>
  );
}
