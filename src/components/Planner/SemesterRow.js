import React from "react";
import CourseBox from "./CourseBox";

export default function SemesterRow({
  slot,
  index,
  status,
  dragProvided,
  snapshot,
  canDrag,
  canEdit,
  blocked,
  onComplete,
  onAdd,
  onReplace,
}) {
  const isCurrent = status === "current";

  return (
    <div
      className={`planner-row ${snapshot.isDragging ? "dragging" : ""}`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      aria-label={`Semester ${index + 1}`}
    >
      <div className={`drag-handle ${canDrag ? "" : "drag-disabled"}`} {...(canDrag ? dragProvided.dragHandleProps : {})}>
        {canDrag && "☰"}
      </div>
      <div className="row-main">
        <div className="row-header">
          <div className="semester-col">Semester {index + 1}</div>
          <div className="row-badges">
            {slot.isTarc && <span className="tarc-pill">TARC</span>}
            {isCurrent ? (
              <button
                type="button"
                className="status-col status-current status-clickable"
                onClick={() => onComplete(slot.id)}
                disabled={blocked}
                aria-label={`Complete Semester ${index + 1}`}
              >CURRENT</button>
            ) : <span className={`status-col status-${status}`}>{status.toUpperCase()}</span>}
          </div>
        </div>
        <div className={slot.thesis ? "courses-row-flex" : ""}>
          <div className={`courses-col ${slot.thesis ? "thesis-courses-col" : ""}`}>
            {slot.courses.map((course) => (
              <CourseBox
                key={course.instanceId}
                course={course}
                isLocked={!canEdit || course.completed}
                onReplace={() => onReplace(slot.id, course.instanceId)}
                hideCompletedLabel={status === "completed"}
              />
            ))}
            {canEdit && <button type="button" className="add-course-btn" onClick={() => onAdd(slot.id)}>+ Add Course</button>}
          </div>
          {slot.thesis && <span className="thesis-right-pill">{slot.thesis.title}</span>}
        </div>
      </div>
    </div>
  );
}
