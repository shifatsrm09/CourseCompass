import React, { useState, useEffect } from "react";

export default function DesignerIssuesPanel({
  isOpen,
  onClose,
  initialTab = "problems",
  validationResult,
  onLocateIssue,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const problems = validationResult?.problems || [];
  const warnings = validationResult?.warnings || [];

  const displayedIssues =
    activeTab === "problems"
      ? problems
      : activeTab === "warnings"
      ? warnings
      : [...problems, ...warnings];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="issues-panel-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6">
        <aside
          className="w-screen max-w-md bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col text-neutral-200 animate-slideInRight"
          aria-label="Designer Problems and Warnings"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h2 id="issues-panel-title" className="text-base font-semibold text-neutral-100">
                Workspace Diagnostics
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-5 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("problems")}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === "problems"
                  ? "border-red-500 text-red-300"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="flex h-2 w-2 rounded-full bg-red-400" />
              <span>Problems</span>
              <span className="rounded-md bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                {problems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("warnings")}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === "warnings"
                  ? "border-amber-500 text-amber-300"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="flex h-2 w-2 rounded-full bg-amber-400" />
              <span>Warnings</span>
              <span className="rounded-md bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                {warnings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>All</span>
              <span className="rounded-md bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                {problems.length + warnings.length}
              </span>
            </button>
          </div>

          {/* Issue List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {displayedIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-6 w-6">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  {activeTab === "problems"
                    ? "No problems detected"
                    : activeTab === "warnings"
                    ? "No warnings detected"
                    : "No issues detected"}
                </h3>
                <p className="mt-1 max-w-xs text-xs text-neutral-400 leading-relaxed">
                  {activeTab === "problems"
                    ? "All course placements satisfy academic prerequisite dependencies and capacity constraints."
                    : "Your experimental plan is clean and has no workload or advisor concerns."}
                </p>
              </div>
            ) : (
              displayedIssues.map((issue) => {
                const isProblem = issue.severity === "problem";
                return (
                  <div
                    key={issue.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isProblem
                        ? "border-red-900/50 bg-gradient-to-b from-red-950/30 to-neutral-900/90 shadow-sm"
                        : "border-amber-900/50 bg-gradient-to-b from-amber-950/30 to-neutral-900/90 shadow-sm"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            isProblem
                              ? "bg-red-500/15 text-red-300 border border-red-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {isProblem ? "🔴 Problem" : "⚠️ Warning"}
                        </span>
                        <h4 className="text-xs font-semibold text-neutral-100">
                          {issue.title}
                        </h4>
                      </div>
                    </div>

                    {/* Explanation */}
                    <p className="mt-2 text-xs leading-relaxed text-neutral-300 font-medium">
                      {issue.message}
                    </p>

                    {/* Affected Semesters / Courses breakdown */}
                    {issue.type === "PREREQUISITE_VIOLATION" && issue.courses?.length >= 2 && (
                      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2.5 text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between text-neutral-300">
                          <span className="text-neutral-400">Semester {issue.semesters?.[0]}</span>
                          <span className="font-semibold text-red-300">→ {issue.courses[0]}</span>
                        </div>
                        {issue.semesters?.[1] ? (
                          <div className="flex items-center justify-between text-neutral-300">
                            <span className="text-neutral-400">Semester {issue.semesters[1]}</span>
                            <span className="font-semibold text-amber-300">→ {issue.courses[1]}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                            <span>Prerequisite {issue.courses[1]}</span>
                            <span className="italic text-neutral-500">Unscheduled</span>
                          </div>
                        )}
                      </div>
                    )}

                    {issue.type === "COURSE_OVERLOAD" && (
                      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-neutral-300">
                          <span className="text-neutral-400">Semester {issue.primarySemester}</span>
                          <span className="font-semibold text-red-300">
                            {issue.courses?.length} courses (Max recommended: 5)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {issue.courses?.map((c, i) => (
                            <span
                              key={i}
                              className="rounded bg-neutral-800/90 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300 border border-neutral-700/60"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {issue.type === "LAB_OVERLOAD" && (
                      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-neutral-300">
                          <span className="text-neutral-400">Semester {issue.primarySemester}</span>
                          <span className="font-semibold text-amber-300">
                            {issue.courses?.length} labs (Max recommended: 3)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {issue.courses?.map((c, i) => (
                            <span
                              key={i}
                              className="rounded bg-neutral-800/90 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 border border-neutral-700/60"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rule rationale */}
                    {issue.rule && (
                      <p className="mt-2.5 text-[11px] text-neutral-500 leading-normal italic">
                        Rule: {issue.rule}
                      </p>
                    )}

                    {/* Action button */}
                    <div className="mt-3.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onLocateIssue(issue)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-violet-400">
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>View in Planner</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
