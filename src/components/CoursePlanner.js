import React, { useState } from "react";
import "../styles/planner.css";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

export default function CoursePlanner({ user, orderedCourses, currentSemester }) {

  const [semesterSlots, setSemesterSlots] = useState(
    orderedCourses.map((row) => ({
      id: `sem-${row.semester_row}`,
      originalRow: row.semester_row,
      courses: row.courses,
      isTarc: row.courses.some((c) => c.is_tarc),
    }))
  );

  const getStatus = (index) => {
    if (index < currentSemester - 1) return "completed";
    if (index === currentSemester - 1) return "current";
    if (index === currentSemester) return "upcoming";
    return "locked";
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    const tarcIndex = semesterSlots.findIndex((s) => s.isTarc);

    if (from !== tarcIndex) return;
    if (to < 2) return;

    const updated = [...semesterSlots];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);

    setSemesterSlots(updated);

    // SAVE TO BACKEND
    const newOrder = updated.map((s) => s.originalRow);

    await fetch(`${process.env.REACT_APP_API_URL}/planner/save-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: user.studentId,
        order: newOrder,
      }),
    });
  };

  return (
    <div className="planner-container">
      <h2 className="planner-title">Course Planner</h2>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="semesters" direction="vertical">
          {(provided) => (
            <div
              className="planner-grid"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {semesterSlots.map((slot, index) => {
                const status = getStatus(index);
                const isTarc = slot.isTarc;

                return (
                  <Draggable
                    key={slot.id}
                    draggableId={slot.id}
                    index={index}
                    isDragDisabled={!isTarc}
                  >
                    {(dragProvided, snapshot) => (
                      <div
                        className={`planner-row ${
                          snapshot.isDragging ? "dragging" : ""
                        }`}
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                      >
                        <div
                          className={`drag-handle ${
                            isTarc ? "" : "drag-disabled"
                          }`}
                          {...(isTarc ? dragProvided.dragHandleProps : {})}
                        >
                          {isTarc ? "☰" : ""}
                        </div>

                        <div className="row-main">
                          <div className="row-header">
                            <div className="semester-col">
                              Semester {index + 1}
                            </div>

                            <div className="row-badges">
                              {isTarc && <span className="tarc-pill">TARC</span>}
                              <div className={`status-col status-${status}`}>
                                {status.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          <div className="courses-col">
                            {slot.courses.map((course) => (
                              <div className="course-box" key={course.code}>
                                {course.code}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
