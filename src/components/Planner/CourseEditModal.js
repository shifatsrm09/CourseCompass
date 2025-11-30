import React from "react";
import "../../styles/planner.css";

export default function CourseEditModal({
  visible,
  onClose,
  onSelect,
  courses,
  title = "Select a course",
}) {
  if (!visible) return null;

  const hasCourses = courses && courses.length > 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <div className="modal-header">
          <h3 style={{ color: "#f0f0f0" }}>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {hasCourses ? (
            <ul className="course-select-list">
              {courses.map((course) => (
                <li key={course.code}>
                  <button
                    className="course-select-btn"
                    onClick={() => onSelect(course)}
                  >
                    <span className="course-select-code">{course.code}</span>
                    {course.title || course.course_title ? (
                      <span className="course-select-title">
                        {course.title || course.course_title}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="modal-empty-text"
              style={{ color: "#aaa", textAlign: "center" }}
            >
              No available courses.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
