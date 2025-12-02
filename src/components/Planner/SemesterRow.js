/**
 * ---------------------------------------------------------------------
 * SemesterRow.js
 * ---------------------------------------------------------------------
 * PURPOSE:
 *  Renders one semester block in the planner grid.
 *
 * RESPONSIBILITY:
 *  - Shows semester label, status pill, TARC badge, thesis badge.
 *  - Renders all courses as <CourseBox>.
 *  - Shows +Add Course button when rules allow.
 *  - Provides drag handle for the TARC semester.
 *
 * HOW IT FITS INTO COURSE COMPASS:
 *  Each semester is rendered as one row.
 *  This component takes raw semester data and converts it to UI.
 *
 * SEMESTER LOGIC:
 *  Status:
 *   - completed
 *   - current
 *   - recommended
 *   - locked
 *
 *  Add/Replace Permissions:
 *   - TARC: partially editable
 *   - Thesis semester: locked, no editing
 *   - First semester: no deletes
 *
 * KEY PROPS:
 *  - slot              → semester object (courses, TARC, thesis)
 *  - index             → semester index
 *  - dragProvided      → DnD helpers
 *  - snapshot          → DnD state
 *  - getStatus         → determines semester status
 *  - openPrompt        → complete-semester modal
 *  - openAddCourseModal → add course modal
 *  - openReplaceCourseModal → replace modal
 *
 * USED BY:
 *  - SemesterList.js
 * ---------------------------------------------------------------------
 */


// src/components/Planner/SemesterRow.js
import React from "react";
import CourseBox from "./CourseBox";

export default function SemesterRow({
  slot,
  index,
  dragProvided,
  snapshot,
  getStatus,
  openPrompt,
  openAddCourseModal,
  openReplaceCourseModal,
}) {
  const status = getStatus(index);
  const isCurrent = status === "current";
  const isRecommended = status === "recommended";
  const isTarc = slot.isTarc;
  const hasThesis = !!slot.thesis;

  const canAdd =
    !hasThesis &&
    ((isCurrent || isRecommended) || (isTarc && slot.courses.length < 4));

  const canReplace = !hasThesis && (isCurrent || isRecommended || isTarc);

  return (
    <div
      className={`planner-row ${snapshot.isDragging ? "dragging" : ""}`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
    >
      {/* DRAG HANDLE */}
      <div
        className={`drag-handle ${
          !isTarc || status === "completed" ? "drag-disabled" : ""
        }`}
        {...(!(!isTarc || status === "completed")
          ? dragProvided.dragHandleProps
          : {})}
      >
        {!(!isTarc || status === "completed") && "☰"}
      </div>

      <div className="row-main">
        {/* HEADER */}
        <div className="row-header">
          <div className="semester-col">Semester {index + 1}</div>

          <div className="row-badges">
            {isTarc && <span className="tarc-pill">TARC</span>}

            {/* Status pill (non-thesis only) */}
            {!hasThesis && (
              <div
                className={`status-col status-${status} ${
                  isCurrent ? "status-clickable" : ""
                }`}
                onClick={isCurrent ? openPrompt : undefined}
              >
                {status.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        {hasThesis ? (
          <div className="courses-row-flex">
            {/* Courses left */}
            <div className="courses-col thesis-courses-col">
              {slot.courses.map((course, cIndex) => (
                <CourseBox
                  key={`${course.code}-${cIndex}`}
                  course={course}
                  isLocked={true}
                  onReplace={null}
                />
              ))}
            </div>

            {/* Thesis badge */}
            <span className="thesis-right-pill">
              {slot.thesis.title}
            </span>

            {/* Right LOCKED pill */}
            <div className={`status-col status-${status} lock-pill-right`}>
              {status.toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="courses-col">
            {slot.courses.map((course, cIndex) => (
              <CourseBox
                key={`${course.code}-${cIndex}`}
                course={course}
                isLocked={isTarc}
                onReplace={
                  canReplace
                    ? () => openReplaceCourseModal(index, cIndex)
                    : null
                }
              />
            ))}

            {canAdd && index !== 0 && (
              <button
                className="add-course-btn"
                onClick={() => openAddCourseModal(index)}
              >
                + Add Course
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
