import React, { useState } from "react";
import { STREAM_PDF_LINKS } from "../../data/streamPdfs";

export default function PlannerSidebar({ open, onClose, stream, totalCourses, repeatCount, blocked, onBalance, onSyncGradesheet, onChangePlan, gradesheetPanel }) {
  const [streamPdfOpen, setStreamPdfOpen] = useState(false);
  const [openDepts, setOpenDepts] = useState({ CS: false, CSE: false });

  const toggleDept = (dept) => {
    setOpenDepts((prev) => ({
      ...prev,
      [dept]: !prev[dept],
    }));
  };

  const actionClass = "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800/70 hover:text-white focus-visible:outline focus-visible:outline-indigo-400";
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
        className={`fixed bottom-0 left-0 top-[57px] z-30 flex w-60 flex-col overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-3 transition-transform duration-300 ease-in-out motion-reduce:transition-none sm:top-[73px] ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav aria-label="Planner actions" className="shrink-0 space-y-1">
          <button type="button" onClick={onBalance} disabled={blocked} className={`${actionClass} bg-indigo-500/10 text-indigo-300 disabled:cursor-default disabled:opacity-40`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z" /></svg>
            Auto Balance
          </button>
          <button type="button" onClick={onSyncGradesheet} aria-expanded={Boolean(gradesheetPanel)} aria-controls="sidebar-gradesheet" className={actionClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" /></svg>
            Sync gradesheet
          </button>
          {gradesheetPanel && <div id="sidebar-gradesheet">{gradesheetPanel}</div>}
          <button type="button" onClick={onChangePlan} className={actionClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></svg>
            Change Plan
          </button>

          <div>
            <button
              type="button"
              onClick={() => setStreamPdfOpen((prev) => !prev)}
              aria-expanded={streamPdfOpen}
              aria-controls="sidebar-stream-pdf"
              className={`${actionClass} justify-between`}
            >
              <span className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true">
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
                strokeWidth="2"
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
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800/70 hover:text-white focus-visible:outline focus-visible:outline-indigo-400"
                        >
                          <span className="text-neutral-200">{dept}</span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
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
                                  className="group flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800/80 hover:text-neutral-100 focus-visible:outline focus-visible:outline-indigo-400"
                                >
                                  <span className="truncate">{streamItem.label}</span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3 shrink-0 text-neutral-500 opacity-60 transition-opacity group-hover:opacity-100 group-hover:text-indigo-400"
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
        <section aria-labelledby="sidebar-statistics" className="mt-auto shrink-0 pt-8">
          <h2 id="sidebar-statistics" className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Statistics</h2>
          <dl className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 px-3 py-1 text-xs">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-800/60 py-2.5">
              <dt className="text-neutral-400">Stream</dt>
              <dd className="text-right font-medium text-neutral-200">{stream}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-neutral-800/60 py-2.5">
              <dt className="text-neutral-400">Total Courses</dt>
              <dd className="font-semibold tabular-nums text-neutral-200">{totalCourses}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-neutral-400">Repeat Courses</dt>
              <dd className={`font-semibold tabular-nums ${repeatCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{repeatCount}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </>
  );
}
