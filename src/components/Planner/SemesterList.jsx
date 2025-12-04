
/**
 * ---------------------------------------------------------------------
 * SemesterList.js
 * ---------------------------------------------------------------------
 * PURPOSE:
 *  Displays the list of semesters in order, along with:
 *   - Drag & drop functionality for moving TARC semester
 *   - Rendering each semester using <SemesterRow>
 *   - Auto-Balance button
 *
 * RESPONSIBILITY:
 *  - Hosts the entire vertical list of semester rows.
 *  - Implements drag-and-drop using @hello-pangea/dnd.
 *  - Enforces TARC movement rules:
 *       › Only TARC semester can move
 *       › Cannot move into completed zone
 *       › Cannot be placed before semester 3
 *
 * HOW IT FITS INTO COURSE COMPASS:
 *  The planner view is a list of semesters.
 *  This component manages the visual list + reordering logic.
 *
 * SERVER SYNC:
 *  When user drags TARC to a new position, the updated order is saved to DB.
 *
 * KEY PROPS:
 *  - semesterSlots       → array of semester objects
 *  - setSemesterSlots    → update state
 *  - getStatus           → current/completed/recommended/locked
 *  - openPrompt          → open “complete semester” modal
 *  - openAddCourseModal  → open add-course modal
 *  - openReplaceCourseModal → open replace modal
 *  - onBalance           → triggers Auto-Balance engine
 *  - user                → needed for saving drag order
 *
 * USED BY:
 *  - CoursePlanner/index.js
 * ---------------------------------------------------------------------
 */
import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SemesterRow from "./SemesterRow";

const API_BASE = import.meta.env.VITE_API_URL;

export default function SemesterList({
  semesterSlots,
  setSemesterSlots,
  getStatus,
  openPrompt,
  openAddCourseModal,
  openReplaceCourseModal,
  handleDropCourse,
  user,
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
      
      <div className="balance-section">
        <button
          onClick={onBalance}
          className="balance-button"
        >
          <span className="balance-icon">⚖</span>
          Balance Engine
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
