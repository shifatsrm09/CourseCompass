import React, { useState } from "react";
import { STREAM_PDF_LINKS } from "../../data/streamPdfs";

export default function PlannerSidebar({
  open,
  onClose,
  stream,
  totalCourses,
  repeatCount,
  blocked,
  onBalance,
  onSyncGradesheet,
  onChangePlan,
  gradesheetPanel,
  activeView = "planner",
  onSwitchView,
  routineCatalog,
}) {
  const [streamPdfOpen, setStreamPdfOpen] = useState(false);
  const [openDepts, setOpenDepts] = useState({ CS: false, CSE: false });

  const toggleDept = (dept) => {
    setOpenDepts((prev) => ({
      ...prev,
      [dept]: !prev[dept],
    }));
  };

  const actionClass = "flex w-full items-center min-h-9 gap-2 rounded-md px-3 py-2 text-left text-sm font-normal text-neutral-300 transition-colors hover:bg-neutral-800/70 hover:text-white focus-visible:outline focus-visible:outline-neutral-400";
  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-x-0 bottom-0 top-[57px] z-20 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none sm:top-[73px] lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        id="planner-sidebar"
        aria-label="Planner tools and statistics"
        aria-hidden={!open}
        inert={!open}
        className={`fixed bottom-0 left-0 top-[57px] z-30 flex w-60 flex-col overflow-y-auto border-r border-[#2b2a28] bg-[#171717] p-3 transition-transform duration-300 ease-in-out motion-reduce:transition-none sm:top-[73px] ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav aria-label="Planner actions" className="shrink-0 space-y-0.5">
          <button
            type="button"
            onClick={() => onSwitchView?.("planner")}
            aria-current={activeView === "planner" ? "page" : undefined}
            className={`${actionClass} ${
              activeView === "planner"
                ? "bg-neutral-800/80 text-neutral-50 font-medium"
                : "text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-neutral-400"
              aria-hidden="true"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
            Course Planner
          </button>

          <button
            type="button"
            onClick={() => onSwitchView?.("routine")}
            aria-current={activeView === "routine" ? "page" : undefined}
            className={`${actionClass} ${
              activeView === "routine"
                ? "bg-neutral-800/80 text-neutral-50 font-medium"
                : "text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-neutral-400"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
            Routine Khichuri
          </button>

          <div className="my-4 border-t border-neutral-800/80" role="separator" />

          <button type="button" onClick={onBalance} disabled={blocked} className={`${actionClass} disabled:cursor-default disabled:opacity-40`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z" /></svg>
            Auto balance
          </button>
          <button type="button" onClick={onSyncGradesheet} aria-expanded={Boolean(gradesheetPanel)} aria-controls="sidebar-gradesheet" className={actionClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" /></svg>
            Sync gradesheet
          </button>
          {gradesheetPanel && <div id="sidebar-gradesheet">{gradesheetPanel}</div>}
          <button type="button" onClick={onChangePlan} className={actionClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></svg>
            Change plan
          </button>

          <div>
            <button
              type="button"
              onClick={() => setStreamPdfOpen((prev) => !prev)}
              aria-expanded={streamPdfOpen}
              aria-controls="sidebar-stream-pdf"
              className={`${actionClass} justify-between`}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15h6M9 11h6" />
                </svg>
                Stream PDF
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 motion-reduce:transition-none ${streamPdfOpen ? "rotate-180 text-white" : ""}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              id="sidebar-stream-pdf"
              className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-in-out motion-reduce:transition-none ${
                streamPdfOpen ? "grid-rows-[1fr] opacity-100 visible mt-1" : "grid-rows-[0fr] opacity-0 invisible"
              }`}
            >
              <div className="overflow-hidden">
                <div className="ml-3 space-y-1.5 border-l border-neutral-800/80 py-1 pl-2.5">
                  {Object.entries(STREAM_PDF_LINKS).map(([dept, links]) => {
                    const isDeptOpen = openDepts[dept];
                    return (
                      <div key={dept} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleDept(dept)}
                          aria-expanded={isDeptOpen}
                          aria-controls={`stream-pdf-dept-${dept}`}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800/70 hover:text-white focus-visible:outline focus-visible:outline-neutral-400"
                        >
                          <span className="text-neutral-200">{dept}</span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 motion-reduce:transition-none ${isDeptOpen ? "rotate-180 text-white" : ""}`}
                            aria-hidden="true"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        <div
                          id={`stream-pdf-dept-${dept}`}
                          className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-in-out motion-reduce:transition-none ${
                            isDeptOpen ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-2 space-y-0.5 border-l border-neutral-800/60 py-0.5 pl-2">
                              {links.map((streamItem) => (
                                <a
                                  key={streamItem.label}
                                  href={streamItem.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800/80 hover:text-neutral-100 focus-visible:outline focus-visible:outline-neutral-400"
                                >
                                  <span className="truncate">{streamItem.label}</span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3 shrink-0 text-neutral-500 opacity-60 transition-opacity group-hover:opacity-100 group-hover:text-neutral-200"
                                    aria-hidden="true"
                                  >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </nav>
        <section aria-labelledby="sidebar-statistics" className="mt-auto shrink-0 px-3 pt-8 pb-2">
          <h2 id="sidebar-statistics" className="mb-3 border-t border-neutral-800/70 pt-4 text-xs font-medium text-neutral-400">{activeView === "routine" ? "Course catalog" : "Your degree"}</h2>
          {activeView === "routine" ? (
            <dl className="space-y-3 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-neutral-400">Available courses</dt>
                <dd className="font-medium tabular-nums text-neutral-200">{routineCatalog?.loading || !routineCatalog ? "Loading…" : routineCatalog.courseCount}</dd>
              </div>
              {[["Catalog updated", routineCatalog?.updatedAt], ["Last checked", routineCatalog?.checkedAt]].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-neutral-400">{label}</dt>
                  <dd className="mt-1 tabular-nums text-neutral-200">{value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable"}</dd>
                </div>
              ))}
            </dl>
          ) : (
          <dl className="space-y-2 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-400">Stream</dt>
              <dd className="text-right font-medium text-neutral-200">{stream}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-400">Total courses</dt>
              <dd className="font-semibold tabular-nums text-neutral-200">{totalCourses}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-400">Repeat courses</dt>
              <dd className={`font-semibold tabular-nums ${repeatCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{repeatCount}</dd>
            </div>
          </dl>
          )}
        </section>
      </aside>
    </>
  );
}
