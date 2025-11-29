import React, { useMemo, useState } from "react";
import "../styles/planner.css";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

export default function CoursePlanner({ courses, currentSemester }) {
  // Build initial semester slots
  const initialSlots = useMemo(() => {
    const byRow = {};
    courses.forEach((course) => {
      if (!byRow[course.semester_row]) {
        byRow[course.semester_row] = [];
      }
      byRow[course.semester_row].push(course);
    });

    const rows = Object.keys(byRow)
      .map((n) => parseInt(n, 10))
      .sort((a, b) => a - b);

    return rows.map((row) => ({
      id: `sem-${row}`,
      originalRow: row,
      courses: byRow[row],
    }));
  }, [courses]);

  const [semesterSlots, setSemesterSlots] = useState(initialSlots);

  const getStatus = (index) => {
    if (index < currentSemester - 1) return "completed";
    if (index === currentSemester - 1) return "current";
    if (index === currentSemester) return "upcoming";
    return "locked";
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const updated = [...semesterSlots];
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);

    setSemesterSlots(updated);
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
                const hasTarc = slot.courses.some((c) => c.is_tarc);

                return (
                  <Draggable
                    key={slot.id}
                    draggableId={slot.id}
                    index={index}
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
                          className="drag-handle"
                          {...dragProvided.dragHandleProps}
                        >
                          ☰
                        </div>

                        <div className="row-main">
                          <div className="row-header">
                            <div className="semester-col">
                              Semester {index + 1}
                            </div>

                            <div className="row-badges">
                              {hasTarc && (
                                <span className="tarc-pill">TARC</span>
                              )}
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
