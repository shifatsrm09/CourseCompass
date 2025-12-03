// src/components/Planner/SemesterRow.js - MINIMAL VERSION
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
  const isTarc = slot.isTarc;
  const hasThesis = !!slot.thesis;
  const semesterNumber = index + 1;

  const canAdd = !hasThesis && (isCurrent || status === "recommended" || (isTarc && slot.courses.length < 4));
  const canReplace = !hasThesis && (isCurrent || status === "recommended" || isTarc);

  return (
    <div
      className={`semester-card ${snapshot.isDragging ? "dragging" : ""} ${
        hasThesis ? "thesis-card" : ""
      }`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
    >
      {/* HEADER */}
      <div className="card-header">
        <div className="semester-info">
          <div className="semester-number">{semesterNumber}</div>
          <div className="semester-title">Semester {semesterNumber}</div>
        </div>

        <div className="badges-container">
          {/* TARC Badge */}
          {isTarc && <span className="badge-tarc">TARC</span>}
          
          {/* Thesis Badge */}
          {hasThesis && (
            <span className="badge-thesis">
              {slot.thesis.title.split(" ")[0]}
            </span>
          )}
          
          {/* Status Badge */}
          {!hasThesis && (
            <div
              className={`status-badge ${status}`}
              onClick={isCurrent ? openPrompt : undefined}
            >
              {status.toUpperCase()}
            </div>
          )}
          
          {/* Drag Handle */}
          <div
            className={`drag-handle ${
              !isTarc || status === "completed" ? "drag-disabled" : ""
            }`}
            {...(!(!isTarc || status === "completed")
              ? dragProvided.dragHandleProps
              : {})}
          >
            {!(!isTarc || status === "completed") && "⋮"}
          </div>
        </div>
      </div>

      {/* COURSES */}
      <div className="courses-container">
        {slot.courses.length > 0 ? (
          <>
            {slot.courses.map((course, cIndex) => (
              <CourseBox
                key={`${course.code}-${cIndex}`}
                course={course}
                isLocked={hasThesis || isTarc}
                onReplace={
                  canReplace
                    ? () => openReplaceCourseModal(index, cIndex)
                    : null
                }
              />
            ))}
            
            {canAdd && index !== 0 && (
              <button
                className="add-course-button"
                onClick={() => openAddCourseModal(index)}
              >
                <span className="add-course-icon">+</span>
                Add
              </button>
            )}
          </>
        ) : (
          <div className="empty-courses">
            {canAdd ? "No courses yet" : "No courses available"}
          </div>
        )}
      </div>
    </div>
  );
}