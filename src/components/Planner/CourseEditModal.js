import React, { useState, useEffect, useMemo } from "react";
import "../../styles/courseEditModal.css";

// ✅ FIX: GROUP_ORDER moved below imports but still outside component
const GROUP_ORDER = [
  "COD",
  "TARC",
  "Program Core",
  "School Core",
  "GenEd",
  "Program Elective",
  "Elective",
  "Internship",
  "Others",
];

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

  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (visible) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [visible, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      onClose();
    }
  };

  /* ──────────────────────────────────────────────
     REMOVE BUTTON LOGIC
  ─────────────────────────────────────────────── */
  const disableRemove =
    modalContext?.isTarc || // TARC cannot delete
    modalContext?.semesterIndex === 0 || // first semester cannot delete
    !(
      modalContext?.status === "current" ||
      modalContext?.status === "recommended"
    ); // completed/locked cannot delete

  /* ──────────────────────────────────────────────
     GROUPING & SEARCH
  ─────────────────────────────────────────────── */

  const groupLabelFromCourse = (course) => {
    if (course.code === "COD") return "COD";
    if (course.is_tarc) return "TARC";

    const t = (course.type || "").toLowerCase();

    if (t.includes("core") && t.includes("program")) return "Program Core";
    if (t.includes("core") && t.includes("school")) return "School Core";
    if (t.startsWith("gened")) return "GenEd";
    if (t.includes("elective") && t.includes("program"))
      return "Program Elective";
    if (t.includes("elective")) return "Elective";
    if (t === "internship") return "Internship";

    return "Others";
  };

  const groupedCourses = useMemo(() => {
    const groups = {};

    courses.forEach((course) => {
      const g = groupLabelFromCourse(course);
      if (!groups[g]) groups[g] = [];
      groups[g].push(course);
    });

    Object.keys(groups).forEach((g) =>
      groups[g].sort((a, b) => a.code.localeCompare(b.code))
    );

    return GROUP_ORDER.filter((g) => groups[g]).map((g) => ({
      label: g,
      courses: groups[g],
    }));
  }, [courses]);

  const filteredGroups = groupedCourses
    .map((group) => ({
      ...group,
      courses: group.courses.filter((c) =>
        c.code.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.courses.length > 0);

  /* ──────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────── */
  return !visible ? null : (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-panel">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>

        <input
          className="course-search"
          placeholder="Search by course code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="modal-body scrollable">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div key={group.label} className="course-group">
                <div className="course-group-title">{group.label}</div>

                {group.courses.map((course) => (
                  <button
                    key={course.code}
                    className="course-select-btn"
                    onClick={() => onSelect(course)}
                  >
                    <span className="course-select-code">{course.code}</span>

                    {course.hp &&
                      course.hp.length > 0 &&
                      course.hp[0] !== "" && (
                        <span className="course-prereq">
                          HP: {course.hp.join(", ")}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="modal-empty-text">No matching courses.</p>
          )}
        </div>

        <div className="modal-footer">
          {modalContext?.mode === "replace" && !disableRemove && (
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
