import React, { useEffect, useState } from "react";
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
  onRenameCod,
  onRemoveRepeat,
  onMoveTarc,
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const groups = desktop
    ? Array.from({ length: Math.ceil(semesterSlots.length / 3) }, (_, year) => ({ id: `year-${year}`, offset: year * 3, slots: semesterSlots.slice(year * 3, year * 3 + 3) }))
    : [{ id: "semesters", offset: 0, slots: semesterSlots }];
  const [contextMenu, setContextMenu] = useState(null);
  const contextSlotIndex = semesterSlots.findIndex(slot => slot.id === contextMenu?.semesterId);
  const contextSlot = semesterSlots[contextSlotIndex];
  const contextCourse = contextSlot?.courses.find(course => course.instanceId === contextMenu?.instanceId);
  const canEditContextCourse = Boolean(contextCourse && !contextCourse.completed && canEdit(contextSlotIndex, contextSlot));
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
    if (!result.destination || blocked) return;
    const group = groups.find(item => item.id === result.destination.droppableId);
    if (!group) return;
    const destination = Math.min(semesterSlots.length - 1, group.offset + result.destination.index);
    const source = semesterSlots.findIndex(slot => slot.id === result.draggableId);
    if (source !== destination) onMoveTarc(result.draggableId, destination);
  };

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
        {groups.map((group, year) => (
          <section
            key={group.id}
            className="min-w-0"
            style={desktop ? { gridColumn: year < 2 ? 1 : 2, gridRow: year < 2 ? year + 1 : year - 1 } : undefined}
            aria-label={desktop ? `Year ${year + 1}` : "Semesters"}
          >
          {desktop && <h3 className="mb-2 text-base font-semibold text-neutral-300">Year {year + 1}</h3>}
        <Droppable droppableId={group.id} direction="vertical">
          {(provided) => (
            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-3" ref={provided.innerRef} {...provided.droppableProps}>
              {group.slots.map((slot, localIndex) => {
                const index = group.offset + localIndex;
                const status = getStatus(index);
                const canDrag = !blocked && slot.isTarc && ["recommended", "locked"].includes(status);
                return (
                  <React.Fragment key={slot.id}>
                  {!desktop && index % 3 === 0 && (
                    <h3 className={`text-base font-semibold text-neutral-300 ${index > 0 ? "mt-3" : ""}`}>
                      Year {Math.floor(index / 3) + 1}
                    </h3>
                  )}
                  <Draggable key={slot.id} draggableId={slot.id} index={localIndex} isDragDisabled={!canDrag}>
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
                  </React.Fragment>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
          </section>
        ))}
        </div>
      </DragDropContext>
      {contextMenu && !blocked && (
        <CourseContextMenu
          context={contextMenu}
          onClose={() => setContextMenu(null)}
          label={contextMenu.action === "undo" ? "Undo completion" : "Remove course"}
          onRename={contextMenu.code === "COD" && !contextMenu.action ? () => onRenameCod(contextMenu.instanceId) : undefined}
          onReplace={!contextMenu.action && canEditContextCourse ? () => onReplace(contextMenu.semesterId, contextMenu.instanceId) : undefined}
          canRemove={Boolean(contextMenu.action) || canEditContextCourse}
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
