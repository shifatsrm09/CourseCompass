export default function PlannerSidebar({ open, onClose, stream, totalCourses, repeatCount, blocked, onBalance, onSyncGradesheet, onChangePlan, gradesheetPanel }) {
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
