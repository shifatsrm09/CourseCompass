import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SemesterRow from "./SemesterRow";
import CourseContextMenu from "./CourseContextMenu";

export default function SemesterList({
  semesterSlots,
  getStatus,
  canEdit,
  blocked,
  onComplete,
  onUndoComplete,
  onAdd,
  onReplace,
  onRemove,
  onRemoveRepeat,
  onMoveTarc,
  onBalance,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const openContextMenu = (event, semesterId, instanceId, code, action) => {
    event.preventDefault();
    event.stopPropagation();
    if (blocked) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    setContextMenu({ semesterId, instanceId, code, action, target,
      x: event.clientX || rect.left,
      y: event.clientY || rect.bottom,
    });
  };
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
                        canUndo={status === "completed" && (index === semesterSlots.length - 1 || getStatus(index + 1) !== "completed")}
                        onUndoMenu={(event) => {
                          const target = event.currentTarget;
                          const rect = target.getBoundingClientRect();
                          setContextMenu({ action: "undo", semesterId: slot.id, code: `Semester ${index + 1}`, target, x: rect.left, y: rect.bottom + 6 });
                        }}
                        onAdd={onAdd}
                        onReplace={onReplace}
                        onCourseContextMenu={openContextMenu}
                        onRepeatContextMenu={(event, semesterId, instanceId, code) => openContextMenu(event, semesterId, instanceId, code, "removeRepeat")}
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
      {contextMenu && !blocked && (
        <CourseContextMenu
          context={contextMenu}
          onClose={() => setContextMenu(null)}
          label={contextMenu.action === "undo" ? "Undo completion" : "Remove course"}
          onRemove={() => {
            if (contextMenu.action === "undo") onUndoComplete(contextMenu.semesterId);
            else if (contextMenu.action === "removeRepeat") onRemoveRepeat(contextMenu.semesterId, contextMenu.instanceId);
            else onRemove(contextMenu.semesterId, contextMenu.instanceId);
          }}
        />
      )}
    </div>
  );
}
