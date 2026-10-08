import React, { useState } from "react";
import { displayCourseCode } from "../../engine/labs.mjs";

export default function CourseBox({
  course,
  isLocked,
  isRepeat,
  onReplace,
  onContextMenu,
  hideCompletedLabel,
  isDesigner = false,
  prerequisiteIssues = [],
  isHighlighted = false,
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const name = course.displayName || course.displayCode || displayCourseCode(course.code);
  const clickable = !isLocked && !isRepeat;
  const hasPrereqIssues = isDesigner && prerequisiteIssues && prerequisiteIssues.length > 0;

  const tooltipText = hasPrereqIssues
    ? prerequisiteIssues
        .map(
          (issue) =>
            `Prerequisite not satisfied\nRequired: ${issue.prereqCode}\n${issue.prereqStatus}\nCourse scheduled in: Semester ${issue.courseSemester}`
        )
        .join("\n\n")
    : "";

  return (
    <div
      id={course?.instanceId ? `course-box-${course.instanceId}` : undefined}
      className={`relative inline-flex min-w-0 transition-transform ${isHighlighted ? "z-20 scale-105" : ""}`}
    >
      <button
        type="button"
        disabled={isLocked && !onContextMenu}
        className={`inline-flex min-h-9 min-w-0 w-full sm:w-auto flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] font-semibold leading-3 transition-colors sm:min-h-0 sm:flex-row sm:justify-start sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm sm:leading-5 select-none ${
          isHighlighted
            ? "border-violet-400 bg-violet-950/80 text-violet-100 ring-2 ring-violet-400 ring-offset-2 ring-offset-neutral-900 shadow-xl shadow-violet-500/50 animate-pulse cursor-grab active:cursor-grabbing"
            : hasPrereqIssues
            ? "border-amber-500/80 bg-neutral-800 text-amber-200 hover:bg-neutral-700/90 active:bg-neutral-600 ring-1 ring-amber-500/30 cursor-grab active:cursor-grabbing"
            : isLocked
            ? "cursor-default border-neutral-800 bg-neutral-900 text-neutral-200"
            : isRepeat
            ? "cursor-default border-red-900/60 bg-neutral-800 text-neutral-100"
            : "cursor-grab active:cursor-grabbing border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 active:bg-neutral-600"
        }`}
        onClick={clickable ? onReplace : undefined}
        onContextMenu={onContextMenu}
        aria-label={
          isRepeat
            ? `${name} repeat course`
            : hasPrereqIssues
            ? `${name} (prerequisite warning)`
            : isLocked
            ? name
            : `Edit ${name}`
        }
      >
        {hasPrereqIssues && (
          <span
            className="flex items-center text-amber-400 font-bold text-xs sm:text-sm hover:scale-110 transition-transform cursor-help"
            title={tooltipText}
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip((prev) => !prev);
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Prerequisite warning"
          >
            ⚠
          </span>
        )}
        <span className={`max-w-full break-words ${name.length > 8 ? "text-[8px] sm:text-sm" : ""}`}>{name}</span>
        {isRepeat ? (
          <span className="text-[7px] font-bold text-red-500 sm:text-[11px] sm:tracking-wide">RT</span>
        ) : (
          course.completed && !hideCompletedLabel && (
            <span className="text-[7px] font-bold text-emerald-400 sm:text-[11px] sm:tracking-wide">COMPLETED</span>
          )
        )}
      </button>

      {hasPrereqIssues && showTooltip && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 min-w-[210px] max-w-xs rounded-lg border border-amber-600/70 bg-neutral-900/95 backdrop-blur-sm p-2.5 text-left text-xs shadow-2xl text-neutral-200 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
            <span>⚠</span>
            <span>Prerequisite not satisfied</span>
          </div>
          {prerequisiteIssues.map((issue, idx) => (
            <div
              key={idx}
              className={`space-y-0.5 text-[11px] ${
                idx > 0 ? "border-t border-neutral-800 pt-1.5 mt-1.5" : ""
              }`}
            >
              <div>
                <span className="text-neutral-400">Required: </span>
                <span className="font-semibold text-neutral-100">{issue.prereqCode}</span>
              </div>
              <div className="text-amber-200/90 font-medium">{issue.prereqStatus}</div>
              <div>
                <span className="text-neutral-400">Course scheduled in: </span>
                <span className="text-neutral-200">Semester {issue.courseSemester}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
