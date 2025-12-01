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

  const canAdd =
    (isCurrent || isRecommended) ||
    (isTarc && slot.courses.length < 4);

  const canReplace = isCurrent || isRecommended || isTarc;

  return (
    <div
      className={`planner-row ${snapshot.isDragging ? "dragging" : ""}`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
    >
      <div
        className={`drag-handle ${
          !slot.isTarc || status === "completed" ? "drag-disabled" : ""
        }`}
        {...(!(!slot.isTarc || status === "completed")
          ? dragProvided.dragHandleProps
          : {})}
      >
        {!(!slot.isTarc || status === "completed") && "☰"}
      </div>

      <div className="row-main">
        <div className="row-header">
          <div className="semester-col">Semester {index + 1}</div>

          <div className="row-badges">
            {slot.isTarc && <span className="tarc-pill">TARC</span>}

            <div
              className={`status-col status-${status} ${
                isCurrent ? "status-clickable" : ""
              }`}
              onClick={isCurrent ? openPrompt : undefined}
            >
              {status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="courses-col">
          {slot.courses.map((course, cIndex) => (
            <CourseBox
              key={`${course.code}-${cIndex}`}
              course={course}
              isLocked={isTarc}
              onReplace={
                canReplace ? () => openReplaceCourseModal(index, cIndex) : null
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
      </div>
    </div>
  );
}
