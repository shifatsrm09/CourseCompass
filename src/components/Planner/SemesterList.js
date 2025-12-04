import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SemesterRow from "./SemesterRow";

const API_BASE = process.env.REACT_APP_API_URL;

export default function SemesterList({
  semesterSlots,
  setSemesterSlots,
  getStatus,
  openPrompt,
  openAddCourseModal,
  openReplaceCourseModal,
  user,
  onBalance,
}) {
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    const tarcIndex = semesterSlots.findIndex((s) => s.isTarc);
    if (tarcIndex === -1) return;
    if (from !== tarcIndex) return;
    if (getStatus(tarcIndex) === "completed") return;

    if (to < 2) return; // cannot move before SEM 3

    const updated = [...semesterSlots];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);

    // ⬆ Update UI
    setSemesterSlots(updated);

    const newOrder = updated.map((s) => s.originalRow);

    // ⬆ Save to backend
    try {
      const res = await fetch(`${API_BASE}/planner/save-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user.studentId,
          order: newOrder,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        console.error("TARC reorder failed:", data.error);
      } else {
        localStorage.setItem(
          "courseCompassUser",
          JSON.stringify({ user: data.user })
        );
      }
    } catch (err) {
      console.error("Network error save-order:", err);
    }
  };

  return (
    <div className="dark-container">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={onBalance}
          className="balance-btn"
          style={{
            padding: "8px 14px",
            background: "#3a86ff",
            borderRadius: 6,
            border: "none",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ⚖ Auto Balance
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="semesters">
          {(provided) => (
            <div
              className="planner-grid"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {semesterSlots.map((slot, index) => (
                <Draggable
                  key={slot.id}
                  draggableId={slot.id}
                  index={index}
                  isDragDisabled={!slot.isTarc || getStatus(index) === "completed"}
                >
                  {(dragProvided, snapshot) => (
                    <SemesterRow
                      slot={slot}
                      index={index}
                      dragProvided={dragProvided}
                      snapshot={snapshot}
                      getStatus={getStatus}
                      openPrompt={openPrompt}
                      openAddCourseModal={openAddCourseModal}
                      openReplaceCourseModal={openReplaceCourseModal}
                    />
                  )}
                </Draggable>
              ))}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
