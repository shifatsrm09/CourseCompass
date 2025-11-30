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
  handleDropCourse,
}) {
  const status = getStatus(index);
  const isCurrent = status === "current";
  const disableDrag = !slot.isTarc || status === "completed";

  return (
    <div
      className={`planner-row ${snapshot.isDragging ? "dragging" : ""}`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
    >
      <div
        className={`drag-handle ${disableDrag ? "drag-disabled" : ""}`}
        {...(!disableDrag ? dragProvided.dragHandleProps : {})}
      >
        {!disableDrag && slot.isTarc ? "☰" : ""}
      </div>

      <div className="row-main">
        <div className="row-header">
          {/* LEFT: Semester title */}
          <div className="semester-col">Semester {index + 1}</div>

          {/* RIGHT: Badges (aligned to the right again) */}
          <div className="row-badges" style={{ marginLeft: "auto" }}>
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
              isLocked={slot.isTarc}
              onDrop={() => handleDropCourse(index, cIndex)}
              onReplace={() => openReplaceCourseModal(index, cIndex)}
            />
          ))}

          {!slot.isTarc && index !== 0 && slot.courses.length < 5 && (
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
