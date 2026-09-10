import React from "react";

export default function CourseBox({ course, isLocked, isRepeat, onReplace, onContextMenu, hideCompletedLabel }) {
  const clickable = !isLocked && !isRepeat;
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] font-semibold leading-3 transition-colors sm:min-h-0 sm:flex-row sm:justify-start sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm sm:leading-5 ${
        isLocked
          ? "cursor-default border-neutral-800 bg-neutral-900 text-neutral-200"
          : isRepeat
          ? "cursor-default border-red-900/60 bg-neutral-800 text-neutral-100"
          : "cursor-pointer border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 active:bg-neutral-600"
      }`}
      onClick={clickable ? onReplace : undefined}
      onContextMenu={isLocked ? undefined : onContextMenu}
      disabled={isLocked}
      aria-label={isRepeat ? `${course.code} repeat course` : isLocked ? course.code : `Edit ${course.code}`}
    >
      <span className={`max-w-full break-words ${course.code.length > 8 ? "text-[8px] sm:text-sm" : ""}`}>{course.code}</span>
      {isRepeat ? (
        <span className="text-[7px] font-bold text-red-500 sm:text-[11px] sm:tracking-wide">RT</span>
      ) : (
        course.completed && !hideCompletedLabel && (
          <span className="text-[7px] font-bold text-emerald-400 sm:text-[11px] sm:tracking-wide">COMPLETED</span>
        )
      )}
    </button>
  );
}
