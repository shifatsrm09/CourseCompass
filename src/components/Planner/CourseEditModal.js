import React, { useState, useEffect } from "react";
import "../../styles/courseEditModal.css";

export default function CourseEditModal({
  visible,
  onClose,
  onSelect,
  onRemove,
  courses = [],
  modalContext,
  title = "Select a course",
}) {
  const [search, setSearch] = useState("");

  // Reset search when modal opens
  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (visible) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [visible, onClose]);

  // Click outside to close
  const handleBackdropClick = (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      onClose();
    }
  };

  // Deduplicate & sort with COD on top
  const cod = courses.find((c) => c.code === "COD");
  const others = courses
    .filter((c) => c.code !== "COD")
    .sort((a, b) => a.code.localeCompare(b.code));

  const finalList = cod ? [cod, ...others] : others;

  // Apply search filter (code only)
  const filtered = finalList.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return !visible ? null : (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-panel">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>

        {/* Search Bar */}
        <input
          className="course-search"
          placeholder="Search by course code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* COURSE LIST */}
        <div className="modal-body scrollable">
          {filtered.length > 0 ? (
            <ul className="course-select-list">
              {filtered.map((course) => (
                <li key={course.code}>
                  <button
                    className="course-select-btn"
                    onClick={() => onSelect(course)}
                  >
                    <span className="course-select-code">{course.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="modal-empty-text">No matching courses.</p>
          )}
        </div>

        {/* FOOTER BUTTONS */}
        <div className="modal-footer">
          {modalContext?.mode === "replace" && (
            <button className="remove-btn" onClick={onRemove}>
              Remove Course
            </button>
          )}

          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
