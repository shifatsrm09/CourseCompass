import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SemesterRow from "./SemesterRow";

export default function SemesterList({
  semesterSlots,
  getStatus,
  canEdit,
  blocked,
  onComplete,
  onAdd,
  onReplace,
  onMoveTarc,
  onBalance,
}) {
  const onDragEnd = (result) => {
    if (!result.destination || blocked || result.source.index === result.destination.index) return;
    onMoveTarc(result.draggableId, result.destination.index);
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onBalance}
          disabled={blocked}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-default disabled:opacity-50"
        >
          ⚖ Auto Balance
        </button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="semesters" direction="vertical">
          {(provided) => (
            <div className="flex flex-col gap-3 sm:gap-4" ref={provided.innerRef} {...provided.droppableProps}>
              {semesterSlots.map((slot, index) => {
                const status = getStatus(index);
                const canDrag = !blocked && slot.isTarc && ["recommended", "locked"].includes(status);
                return (
                  <Draggable key={slot.id} draggableId={slot.id} index={index} isDragDisabled={!canDrag}>
                    {(dragProvided, snapshot) => (
                      <SemesterRow
                        slot={slot}
                        index={index}
                        status={status}
                        dragProvided={dragProvided}
                        snapshot={snapshot}
                        canDrag={canDrag}
                        canEdit={canEdit(index, slot)}
                        blocked={blocked}
                        onComplete={onComplete}
                        onAdd={onAdd}
                        onReplace={onReplace}
                      />
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
