import { useMemo, useRef, useState } from "react";
import CoursePlanner from "./Planner/CoursePlanner";
import streamsConfig from "../data/streamsConfig";
import { buildCurriculum } from "../engine/plannerState.mjs";
import { API_BASE, readApiResponse } from "../api";
import { draftKey } from "../engine/plannerPersistence";

export default function Dashboard({ user, setUser, onLogout }) {
  const curriculum = useMemo(() => {
    const stream = streamsConfig[user.stream];
    return stream ? buildCurriculum(stream.plan, user.stream) : null;
  }, [user.stream]);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetToken, setResetToken] = useState(0);
  const pending = useRef(false);

  const handleReset = async () => {
    if (pending.current) return;
    pending.current = true;
    setResetBusy(true);
    setResetError("");
    try {
      const response = await fetch(`${API_BASE}/planner/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.user) {
        throw new Error(data.error || "Your plan could not be reset. Please try again.");
      }
      sessionStorage.removeItem(draftKey(user.studentId));
      setUser(data.user);
      setResetToken((token) => token + 1);
      setConfirmingReset(false);
    } catch (failure) {
      setResetError(failure.message || "Could not connect to Course Compass. Please retry.");
    } finally {
      pending.current = false;
      setResetBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/30 sm:h-10 sm:w-10 sm:rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 sm:h-5 sm:w-5"
                aria-hidden="true"
              >
                <path d="M22 10 12 5 2 10l10 5 10-5Z" />
                <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
              </svg>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-neutral-50 sm:text-lg">
                <span className="hidden sm:inline">Welcome, </span>
                {user.studentId}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-neutral-400 sm:text-sm">
                <span className="inline-flex max-w-full items-center truncate rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300 ring-1 ring-inset ring-neutral-700 sm:text-[11px]">
                  {user.stream}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => { setResetError(""); setConfirmingReset(true); }}
              aria-label="Reset plan"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-neutral-800 px-2.5 py-2 text-sm font-semibold text-neutral-200 ring-1 ring-inset ring-neutral-700 transition-colors hover:bg-neutral-700 sm:px-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 active:bg-red-800 sm:px-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17 21 12 16 7" />
                <path d="M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {confirmingReset && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4"
          onClick={(event) => { if (event.target === event.currentTarget && !resetBusy) setConfirmingReset(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-plan-title"
            className="w-full max-w-sm animate-fadeIn rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl"
          >
            <h3 id="reset-plan-title" className="text-base font-semibold text-neutral-50">
              Reset your plan?
            </h3>
            <p className="mt-2 text-sm text-neutral-400">
              This clears your progress and personalized plan and starts over from the default curriculum, just like a brand-new account. Your stream ({user.stream}) will stay the same. This can't be undone.
            </p>
            {resetError && <p role="alert" className="mt-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">{resetError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                disabled={resetBusy}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetBusy}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {resetBusy ? "Resetting…" : "Yes, reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
        {curriculum ? (
          <CoursePlanner
            key={`${user.studentId}:${user.stream}:${resetToken}`}
            user={user}
            setUser={setUser}
            curriculum={curriculum}
          />
        ) : (
          <p role="alert" className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-4 text-center text-sm font-medium text-amber-200">
            The curriculum for your saved stream is unavailable. Your saved plan has been preserved.
          </p>
        )}
      </div>
    </div>
  );
}
