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
  );
}
