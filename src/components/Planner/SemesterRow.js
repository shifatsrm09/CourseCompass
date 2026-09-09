import React from "react";
import CourseBox from "./CourseBox";

const STATUS_STYLES = {
  completed: "bg-emerald-950/60 text-emerald-400",
  recommended: "bg-amber-950/50 text-amber-300",
  locked: "bg-neutral-800 text-neutral-400",
};

export default function SemesterRow({
  slot,
  index,
  status,
  dragProvided,
  snapshot,
  canDrag,
  canEdit,
  blocked,
  onComplete,
  canUndo,
  onUndoMenu,
  onAdd,
  onReplace,
  onCourseContextMenu,
}) {
  const isCurrent = status === "current";

  return (
    <div
      className={`planner-row relative flex min-w-0 items-start rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-md shadow-black/20 transition-shadow sm:gap-2 sm:p-5 ${
        snapshot.isDragging ? "scale-[1.02] shadow-xl shadow-black/50" : ""
      }`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      aria-label={`Semester ${index + 1}`}
    >
      <div
        className={`h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg text-neutral-500 sm:static sm:flex sm:w-6 sm:pt-0.5 ${
          canDrag ? "absolute left-2 top-3 flex cursor-grab active:cursor-grabbing hover:bg-neutral-800 hover:text-neutral-300" : "hidden opacity-30"
        }`}
        {...(canDrag ? dragProvided.dragHandleProps : {})}
      >
        {canDrag && "☰"}
      </div>
      <div className="flex w-full min-w-0 flex-col">
        <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:mb-3">
          <div className={`flex min-w-0 items-baseline gap-1.5 sm:gap-x-2 ${canDrag ? "pl-8 sm:pl-0" : ""}`}>
            <span className="whitespace-nowrap text-xs font-semibold leading-5 text-neutral-100 sm:text-lg">Semester {index + 1}</span>
            {slot.termLabel && (
              <span className="whitespace-nowrap text-[10px] font-medium leading-4 text-neutral-400 sm:text-xs sm:tracking-wide sm:text-neutral-500">{slot.termLabel}</span>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {slot.isTarc && (
              <span className="whitespace-nowrap rounded-full border border-emerald-800 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 sm:px-2.5 sm:py-1 sm:text-xs">
                TARC
              </span>
            )}
            {isCurrent ? (
              <button
                type="button"
                className="min-h-8 cursor-pointer select-none whitespace-nowrap rounded-full bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-default disabled:opacity-60 sm:min-h-0 sm:px-3.5 sm:text-xs"
                onClick={() => onComplete(slot.id)}
                disabled={blocked}
                aria-label={`Complete Semester ${index + 1}`}
              >
                CURRENT
              </button>
            ) : canUndo ? (
              <button
                type="button"
                onClick={onUndoMenu}
                disabled={blocked}
                aria-label={`Completed Semester ${index + 1} options`}
                aria-haspopup="menu"
                className="min-h-8 cursor-pointer select-none whitespace-nowrap rounded-full bg-emerald-950/60 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-900/60 disabled:cursor-default disabled:opacity-60 sm:min-h-0 sm:px-3.5 sm:text-xs"
              >
                COMPLETED
              </button>
            ) : (
              <span className={`select-none whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-semibold sm:px-3.5 sm:text-xs ${STATUS_STYLES[status] || STATUS_STYLES.locked}`}>
                {status.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className={slot.thesis ? "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" : ""}>
          <div className={`grid w-full min-w-0 ${canEdit ? "grid-cols-5" : "grid-cols-4"} gap-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 ${slot.thesis ? "sm:flex-1" : ""}`}>
            {slot.courses.map((course) => (
              <CourseBox
                key={course.instanceId}
                course={course}
                isLocked={!canEdit || course.completed}
                onReplace={() => onReplace(slot.id, course.instanceId)}
                onContextMenu={(event) => onCourseContextMenu(event, slot.id, course.instanceId, course.code)}
                hideCompletedLabel={status === "completed"}
              />
            ))}
            {canEdit && (
              <button
                type="button"
                className="min-h-9 min-w-0 rounded-md border border-dashed border-neutral-600 bg-neutral-950 px-1 py-1.5 text-[10px] font-medium text-neutral-400 transition-colors hover:border-neutral-500 hover:bg-neutral-900 hover:text-neutral-200 sm:min-h-0 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
                onClick={() => onAdd(slot.id)}
              >
                Add
              </button>
            )}
          </div>
          {slot.thesis && (
            <span className="max-w-full self-start break-words rounded-lg border border-red-800 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-400 sm:px-3 sm:text-sm">
              {slot.thesis.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
