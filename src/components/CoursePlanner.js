import React, { useState } from "react";
import "../styles/planner.css";
import ConfirmModal from "./ConfirmModal";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

const API_BASE = process.env.REACT_APP_API_URL;

export default function CoursePlanner({
  user,
  orderedCourses,
  currentSemester,
  setCurrentSemester,
}) {
  const [showModal, setShowModal] = useState(false);

  const [semesterSlots, setSemesterSlots] = useState(
    orderedCourses.map((row) => ({
      id: `sem-${row.semester_row}`,
      originalRow: row.semester_row,
      courses: row.courses,
      isTarc: row.courses.some((c) => c.is_tarc),
    }))
  );

  const getStatus = (index) => {
    const safe = currentSemester || 1;

    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  const openPrompt = () => {
    setShowModal(true);
  };

  const cancelComplete = () => {
    setShowModal(false);
  };

  const confirmComplete = async () => {
    setShowModal(false);

    try {
      const res = await fetch(`${API_BASE}/planner/complete-semester`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        const raw = await res.text();
        console.error("Unexpected backend response:", raw);
        alert("Unexpected server response.");
        return;
      }

      if (!data.success) {
        alert("Error: " + data.error);
        return;
      }

      setCurrentSemester(data.user.currentSemester, data.user);

    } catch (err) {
      console.error("Network error:", err);
      alert("Network error contacting server.");
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    const tarcIndex = semesterSlots.findIndex((s) => s.isTarc);

    // TARC can only be moved when NOT completed
    if (from !== tarcIndex) return;

    const tarcStatus = getStatus(tarcIndex);

    if (tarcStatus === "completed") return; // LOCKED FOREVER

    // must stay ≥ 3rd position in UI
    if (to < 2) return;

    const updated = [...semesterSlots];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSemesterSlots(updated);

    const newOrder = updated.map((s) => s.originalRow);

    await fetch(`${API_BASE}/planner/save-order`, {
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

      <ConfirmModal
        visible={showModal}
        onConfirm={confirmComplete}
        onCancel={cancelComplete}
        semester={currentSemester || 1}
      />

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
                const isCurrent = status === "current";

                // NEW: Disable dragging TARC after completed
               // Disable dragging ONLY when TARC itself is COMPLETED
                const disableDrag =
                !slot.isTarc || status === "completed";


                return (
                  <Draggable
                    key={slot.id}
                    draggableId={slot.id}
                    index={index}
                    isDragDisabled={disableDrag}
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
                            disableDrag ? "drag-disabled" : ""
                          }`}
                          {...(!disableDrag
                            ? dragProvided.dragHandleProps
                            : {})}
                        >
                          {!disableDrag && slot.isTarc ? "☰" : ""}
                        </div>

                        <div className="row-main">
                          <div className="row-header">
                            <div className="semester-col">
                              Semester {index + 1}
                            </div>

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
