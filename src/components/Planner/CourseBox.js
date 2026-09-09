import React from "react";

export default function CourseBox({ course, isLocked, onReplace, onContextMenu, hideCompletedLabel }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        isLocked
          ? "cursor-default border-neutral-800 bg-neutral-900 text-neutral-200"
          : "cursor-pointer border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 active:bg-neutral-600"
      }`}
      onClick={onReplace}
      onContextMenu={isLocked ? undefined : onContextMenu}
      disabled={isLocked}
      aria-label={isLocked ? course.code : `Edit ${course.code}`}
    >
      <span>{course.code}</span>
      {course.completed && !hideCompletedLabel && (
        <span className="text-[11px] font-bold tracking-wide text-emerald-400">COMPLETED</span>
      )}
    </button>
  );
}
