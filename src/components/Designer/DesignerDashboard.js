import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, readApiResponse } from "../../api";
import { designerDraftKey } from "../../engine/plannerPersistence";
import DesignerWelcome from "./DesignerWelcome";
import CoursePlanner from "../Planner/CoursePlanner";
import PlannerSidebar from "../Planner/PlannerSidebar";

export default function DesignerDashboard({
  user,
  setUser,
  curriculum,
  sidebarOpen,
  onCloseSidebar,
  onNavigate,
  onSyncGradesheet,
  gradesheetPanel,
  onChangePlan,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [designer, setDesigner] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmingResync, setConfirmingResync] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  // Statistics for sidebar before designer planner is loaded
  const totalCourses = useMemo(() => {
    if (user?.plannerState?.semesters) {
      return (
        user.plannerState.semesters.reduce((sum, s) => sum + (s.courses?.length || 0), 0) +
        (user.plannerState.unplaced?.length || 0)
      );
    }
    return curriculum?.occurrences?.length || 0;
  }, [user, curriculum]);

  const repeatCount = useMemo(() => {
    try {
      const stored = window.localStorage.getItem(
        `courseCompass:repeatCourses:${user?.studentId || "anon"}:${curriculum?.stream || "default"}`
      );
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [user, curriculum]);

  // Fetch initial Designer state on mount
  useEffect(() => {
    let active = true;
    const fetchDesignerState = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/designer/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: user.studentId }),
        });
        const data = await readApiResponse(response);
        if (!active) return;
        if (!response.ok) {
          throw new Error(data.error || "Could not check Designer workspace state.");
        }
        if (data.exists && data.designer?.plannerState) {
          setDesigner(data.designer);
        } else {
          setDesigner(null);
        }
      } catch (failure) {
        if (active) setError(failure.message || "Failed to load Designer workspace.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDesignerState();
    return () => {
      active = false;
    };
  }, [user.studentId]);

  // Sync Designer from current Main Planner
  const handleSyncWithMain = async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/designer/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.success || !data.designer) {
        throw new Error(data.error || "Could not sync Designer from Main Planner.");
      }
      // Clear any pending Designer draft in sessionStorage
      try {
        sessionStorage.removeItem(designerDraftKey(user.studentId));
      } catch {}

      setDesigner(data.designer);
      setResetToken((t) => t + 1);
      setConfirmingResync(false);
    } catch (failure) {
      setError(failure.message || "Failed to sync with Main Planner.");
    } finally {
      setSyncing(false);
    }
  };

  const handleReloadSavedDesigner = async () => {
    const response = await fetch(`${API_BASE}/designer/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: user.studentId }),
    });
    const data = await readApiResponse(response);
    return {
      ok: response.ok && data.success && Boolean(data.designer),
      designer: data.designer,
      error: data.error,
    };
  };

  if (loading) {
    return (
      <div className="mx-auto min-w-0 max-w-3xl px-0 pb-10 sm:px-1 lg:max-w-none lg:pb-0">
        <PlannerSidebar
          open={sidebarOpen}
          onClose={onCloseSidebar}
          stream={user.stream}
          totalCourses={totalCourses}
          repeatCount={repeatCount}
          blocked={true}
          onBalance={() => {}}
          onSyncGradesheet={onSyncGradesheet}
          onChangePlan={onChangePlan}
          gradesheetPanel={gradesheetPanel}
          isDesigner={true}
          onNavigateDesigner={() => onNavigate?.("/designer")}
          onNavigateMain={() => onNavigate?.("/")}
          onSyncWithMain={undefined}
          errorCount={0}
          warningCount={0}
        />
        <div className="flex min-h-[50vh] items-center justify-center" role="status">
          <div className="flex flex-col items-center gap-3 text-neutral-400">
            <svg className="h-7 w-7 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm font-medium">Checking Designer workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  // First-time visit: no Designer state exists
  if (!designer || !designer.plannerState) {
    return (
      <div className="mx-auto min-w-0 max-w-3xl px-0 pb-10 sm:px-1 lg:max-w-none lg:pb-0">
        <PlannerSidebar
          open={sidebarOpen}
          onClose={onCloseSidebar}
          stream={user.stream}
          totalCourses={totalCourses}
          repeatCount={repeatCount}
          blocked={syncing}
          onBalance={handleSyncWithMain}
          onSyncGradesheet={onSyncGradesheet}
          onChangePlan={onChangePlan}
          gradesheetPanel={gradesheetPanel}
          isDesigner={true}
          onNavigateDesigner={() => onNavigate?.("/designer")}
          onNavigateMain={() => onNavigate?.("/")}
          onSyncWithMain={handleSyncWithMain}
          errorCount={0}
          warningCount={0}
        />
        <DesignerWelcome
          onSync={handleSyncWithMain}
          syncing={syncing}
          error={error}
        />
      </div>
    );
  }

  // Existing Designer state: render Designer Planner
  return (
    <div className="relative">
      {/* Designer Workspace Banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-neutral-900/60 to-indigo-950/40 p-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-inset ring-violet-500/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-100">Designer Workspace</span>
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                Sandbox
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Changes here are completely isolated and never affect your Main Planner.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmingResync(true)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
            </svg>
            Sync with Main
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Confirmation Modal when re-syncing an existing Designer */}
      {confirmingResync && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(event) => { if (event.target === event.currentTarget && !syncing) setConfirmingResync(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resync-dialog-title"
            className="w-full max-w-sm animate-fadeIn rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
          >
            <h3 id="resync-dialog-title" className="text-base font-semibold text-neutral-50">
              Reset Designer to Main Planner?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              This will overwrite your current Designer workspace with a fresh copy of your official Main Planner. Your Main Planner will not be modified.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingResync(false)}
                disabled={syncing}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSyncWithMain}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Yes, Sync with Main"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CoursePlanner loaded with Designer state */}
      <CoursePlanner
        key={`designer:${user.studentId}:${resetToken}`}
        user={user}
        setUser={setUser}
        curriculum={curriculum}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={onCloseSidebar}
        isDesigner={true}
        designerState={designer.plannerState}
        designerVersion={designer.plannerVersion}
        onDesignerSaved={(savedDesigner) => setDesigner(savedDesigner)}
        reloadSavedPlanFn={handleReloadSavedDesigner}
        onNavigateMain={() => onNavigate("/")}
        onNavigateDesigner={() => onNavigate("/designer")}
        onSyncWithMain={() => setConfirmingResync(true)}
        onSyncGradesheet={onSyncGradesheet}
        gradesheetPanel={gradesheetPanel}
        onChangePlan={onChangePlan}
      />
    </div>
  );
}
