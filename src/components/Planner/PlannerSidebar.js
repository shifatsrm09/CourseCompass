export function DiagnosticsBadge({ errorCount = 0, warningCount = 0, title, onOpenDiagnostics }) {
  const errorActive = errorCount > 0;
  const warningActive = warningCount > 0;

  const handleOpen = (e, tab) => {
    if (onOpenDiagnostics) {
      e.stopPropagation();
      e.preventDefault();
      onOpenDiagnostics(tab);
    }
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded bg-[#252526] px-1.5 py-0.5 text-xs font-mono border border-neutral-700/60 shadow-sm select-none ${
        onOpenDiagnostics ? "hover:border-neutral-500 hover:bg-[#2d2d2d] cursor-pointer" : ""
      }`}
      onClick={(e) => handleOpen(e, errorActive ? "problems" : warningActive ? "warnings" : "problems")}
      title={title || `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`}
      aria-label={`${errorCount} errors, ${warningCount} warnings`}
      role={onOpenDiagnostics ? "button" : undefined}
      tabIndex={onOpenDiagnostics ? 0 : undefined}
    >
      <span
        className={`inline-flex items-center gap-1 ${errorActive ? "text-red-400 font-semibold" : "text-neutral-200"}`}
        onClick={(e) => handleOpen(e, "problems")}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" strokeWidth="1.3" />
          <line x1="5.6" y1="5.6" x2="10.4" y2="10.4" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="10.4" y1="5.6" x2="5.6" y2="10.4" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span className="tabular-nums text-[11px] leading-none">{errorCount}</span>
      </span>

      <span
        className={`inline-flex items-center gap-1 ${warningActive ? "text-amber-400 font-semibold" : "text-neutral-200"}`}
        onClick={(e) => handleOpen(e, "warnings")}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <path
            d="M7.13 2.76a1 1 0 0 1 1.74 0l5.3 9.2A1 1 0 0 1 13.3 13.5H2.7a1 1 0 0 1-.87-1.54l5.3-9.2Z"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <line x1="8" y1="6.2" x2="8" y2="9.2" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="0.65" fill="currentColor" stroke="none" />
        </svg>
        <span className="tabular-nums text-[11px] leading-none">{warningCount}</span>
      </span>
    </span>
  );
}

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
  isDesigner = false,
  onNavigateDesigner,
  onNavigateMain,
  onSyncWithMain,
  errorCount = 0,
  warningCount = 0,
  diagnosticsTooltip,
  onOpenDiagnostics,
}) {
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
          {/* Main Planner navigation item */}
          <button
            type="button"
            onClick={onNavigateMain}
            className={`${actionClass} ${!isDesigner ? "bg-neutral-800/80 text-white font-semibold" : ""}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Main Planner
          </button>

          {/* Designer navigation item */}
          <button
            type="button"
            onClick={onNavigateDesigner}
            className={`${actionClass} ${isDesigner ? "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30 font-semibold" : ""}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="flex-1 text-left">Designer</span>
            {isDesigner && (
              <DiagnosticsBadge
                errorCount={errorCount}
                warningCount={warningCount}
                title={diagnosticsTooltip}
                onOpenDiagnostics={onOpenDiagnostics}
              />
            )}
          </button>

          {/* Auto Balance */}
          <button
            type="button"
            onClick={onBalance}
            disabled={blocked || !onBalance}
            className={`${actionClass} bg-indigo-500/10 text-indigo-300 disabled:cursor-default disabled:opacity-40`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
              <path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z" />
            </svg>
            Auto Balance
          </button>

          {/* Sync gradesheet */}
          {onSyncGradesheet && (
            <button
              type="button"
              onClick={onSyncGradesheet}
              aria-expanded={Boolean(gradesheetPanel)}
              aria-controls="sidebar-gradesheet"
              className={actionClass}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
              </svg>
              Sync gradesheet
            </button>
          )}
          {gradesheetPanel && <div id="sidebar-gradesheet">{gradesheetPanel}</div>}

          {/* Change Plan */}
          {onChangePlan && (
            <button
              type="button"
              onClick={onChangePlan}
              className={actionClass}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
              </svg>
              Change Plan
            </button>
          )}
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
              <span className="sr-only">Total Courses: {totalCourses}</span>
            </div>
            <div className={`flex items-center justify-between gap-3 ${isDesigner ? "border-b border-neutral-800/60" : ""} py-2.5`}>
              <dt className="text-neutral-400">Repeat Courses</dt>
              <dd className={`font-semibold tabular-nums ${repeatCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{repeatCount}</dd>
            </div>
            {isDesigner && (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-400">Diagnostics</dt>
                <dd>
                  <DiagnosticsBadge
                    errorCount={errorCount}
                    warningCount={warningCount}
                    title={diagnosticsTooltip}
                    onOpenDiagnostics={onOpenDiagnostics}
                  />
                </dd>
              </div>
            )}
          </dl>
        </section>
      </aside>
    </>
  );
}
