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
  onAdd,
  onReplace,
  onCourseContextMenu,
}) {
  const isCurrent = status === "current";

  return (
    <div
      className={`planner-row flex items-start gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-3.5 shadow-md shadow-black/20 transition-shadow sm:gap-2 sm:p-5 ${
        snapshot.isDragging ? "scale-[1.02] shadow-xl shadow-black/50" : ""
      }`}
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      aria-label={`Semester ${index + 1}`}
    >
      <div
        className={`flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-lg text-neutral-500 sm:pt-0.5 ${
          canDrag ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800 hover:text-neutral-300" : "opacity-30"
        }`}
        {...(canDrag ? dragProvided.dragHandleProps : {})}
      >
        {canDrag && "☰"}
      </div>
      <div className="flex w-full min-w-0 flex-col">
        <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold text-neutral-100 sm:text-lg">Semester {index + 1}</span>
            {slot.termLabel && (
              <span className="text-xs font-medium tracking-wide text-neutral-500">{slot.termLabel}</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {slot.isTarc && (
              <span className="rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                TARC
              </span>
            )}
            {isCurrent ? (
              <button
                type="button"
                className="cursor-pointer select-none rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-default disabled:opacity-60"
                onClick={() => onComplete(slot.id)}
                disabled={blocked}
                aria-label={`Complete Semester ${index + 1}`}
              >
                CURRENT
              </button>
            ) : (
              <span className={`select-none rounded-full px-3.5 py-1.5 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.locked}`}>
                {status.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className={slot.thesis ? "flex w-full items-center gap-3" : ""}>
          <div className={`flex flex-wrap gap-2 ${slot.thesis ? "flex-1" : ""}`}>
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
                className="rounded-lg border border-dashed border-neutral-600 bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                onClick={() => onAdd(slot.id)}
              >
                + Add Course
              </button>
            )}
          </div>
          {slot.thesis && (
            <span className="whitespace-nowrap rounded-lg border border-red-800 bg-red-950/40 px-3 py-1.5 text-sm text-red-400">
              {slot.thesis.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
