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
  handleDropCourse,
  user,
  setUser,
  updateUserPlanInState,
  syncPlanToServer,
  onBalance, // NEW
}) {
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    const tarcIndex = semesterSlots.findIndex((s) => s.isTarc);
    if (from !== tarcIndex) return;

    const tarcStatus = getStatus(tarcIndex);
    if (tarcStatus === "completed") return;
    if (to < 2) return;

    const updated = [...semesterSlots];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);

    setSemesterSlots(updated);

    if (typeof updateUserPlanInState === "function") {
      updateUserPlanInState(updated);
    } else if (typeof setUser === "function") {
      const updatedUser = {
        ...user,
        semesterOrder: updated.map((s) => s.originalRow),
      };

      setUser(updatedUser);
      localStorage.setItem(
        "courseCompassUser",
        JSON.stringify({ user: updatedUser })
      );
    }

    if (typeof syncPlanToServer === "function") {
      await syncPlanToServer(updated);
    }

    await fetch(`${API_BASE}/planner/save-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: user.studentId,
        order: updated.map((s) => s.originalRow),
      }),
    });
  };

  return (
    <div className="dark-container">
      {/* BALANCE BUTTON */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button
          onClick={onBalance}
          className="balance-btn"
          style={{
            padding: "8px 14px",
            background: "#3a86ff",
            borderRadius: "6px",
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
        <Droppable droppableId="semesters" direction="vertical">
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
                  isDragDisabled={
                    !slot.isTarc || getStatus(index) === "completed"
                  }
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
                      handleDropCourse={handleDropCourse}
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
