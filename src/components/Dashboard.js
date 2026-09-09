import { useEffect, useMemo, useRef, useState } from "react";
import CoursePlanner from "./Planner/CoursePlanner";
import streamsConfig from "../data/streamsConfig";
import { buildCurriculum } from "../engine/plannerState.mjs";
import { API_BASE, readApiResponse } from "../api";
import { draftKey } from "../engine/plannerPersistence";

export default function Dashboard({ user, setUser, onLogout, onChangePlan }) {
  const curriculum = useMemo(() => {
    const stream = streamsConfig[user.stream];
    return stream ? buildCurriculum(stream.plan, user.stream) : null;
  }, [user.stream]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const gearButtonRef = useRef(null);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetToken, setResetToken] = useState(0);
  const resetPending = useRef(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deletePending = useRef(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !gearButtonRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const handleReset = async () => {
    if (resetPending.current) return;
    resetPending.current = true;
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
      resetPending.current = false;
      setResetBusy(false);
    }
  };

  const handleDelete = async () => {
    if (deletePending.current) return;
    deletePending.current = true;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const response = await fetch(`${API_BASE}/auth/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Your account could not be deleted. Please retry.");
      }
      sessionStorage.removeItem(draftKey(user.studentId));
      onLogout();
    } catch (failure) {
      setDeleteError(failure.message || "Could not connect to Course Compass. Please retry.");
    } finally {
      deletePending.current = false;
      setDeleteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
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
            </div>
          </div>

          <span className="inline-flex max-w-full items-center truncate rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300 ring-1 ring-inset ring-neutral-700 sm:text-[11px]">
            {user.stream}
          </span>

          <div className="relative justify-self-end">
            <button
              type="button"
              ref={gearButtonRef}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account settings"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors sm:h-10 sm:w-10 ${
                menuOpen ? "bg-neutral-700 text-neutral-100 ring-neutral-600" : "bg-neutral-800 text-neutral-300 ring-neutral-700 hover:bg-neutral-700"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>

            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="Account settings menu"
                className="absolute right-0 top-full z-30 mt-2 w-48 animate-fadeIn rounded-xl border border-neutral-800 bg-neutral-900 p-1.5 shadow-xl shadow-black/50"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onChangePlan(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
                  </svg>
                  Change Plan
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setResetError(""); setConfirmingReset(true); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                  Reset account
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setDeleteError(""); setConfirmingDelete(true); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-950/40"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  Delete account
                </button>
                <div className="my-1.5 h-px bg-neutral-800" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17 21 12 16 7" />
                    <path d="M21 12H9" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
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

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4"
          onClick={(event) => { if (event.target === event.currentTarget && !deleteBusy) setConfirmingDelete(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-sm animate-fadeIn rounded-xl border border-red-900/60 bg-neutral-900 p-5 shadow-xl"
          >
            <h3 id="delete-account-title" className="text-base font-semibold text-neutral-50">
              Delete your account?
            </h3>
            <p className="mt-2 text-sm text-neutral-400">
              This permanently deletes your account and everything tied to it — your stream, plan, and progress — from our database. This cannot be undone.
            </p>
            {deleteError && <p role="alert" className="mt-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">{deleteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteBusy}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deleteBusy ? "Deleting…" : "Yes, delete my account"}
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
