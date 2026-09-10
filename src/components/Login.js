import { useEffect, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";

export default function Login({ onLogin, onImportGradesheet, connectNotice, onDismissConnectNotice }) {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const importHelpRef = useRef(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    if (!importHelpOpen) return undefined;
    const dismiss = event => {
      if (!importHelpRef.current?.contains(event.target)) setImportHelpOpen(false);
    };
    const escape = event => { if (event.key === "Escape") setImportHelpOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [importHelpOpen]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim() }),
      });
      const data = await readApiResponse(response);
      if (!mounted.current) return;
      if (!response.ok || (!data.firstLogin && !data.user)) {
        throw new Error(data.error || "Your account could not be loaded. Please retry.");
      }
      onLogin(data, studentId.trim());
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Could not connect to Course Compass. Check your connection and retry.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl shadow-black/40 sm:max-w-md sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/30">
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
              <path d="M22 10 12 5 2 10l10 5 10-5Z" />
              <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight text-neutral-50 sm:text-2xl">Course Compass</h2>
            <p className="mt-0.5 text-sm text-neutral-400">Smart advising for BRAC University students</p>
          </div>
        </div>

        {connectNotice && (
          <p role="alert" className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            <span>{connectNotice}</span>
            <button type="button" onClick={onDismissConnectNotice} aria-label="Dismiss" className="shrink-0 text-red-400 hover:text-red-200">✕</button>
          </p>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div>
            <label htmlFor="student-id" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Student ID
            </label>
            <input
              id="student-id"
              type="text"
              placeholder="Enter Student ID"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              required
              disabled={busy}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-base text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !studentId.trim()}
            className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            {busy ? "Logging in…" : "Login"}
          </button>
        </form>
        <div className="my-3 flex items-center gap-3 text-xs text-neutral-500">
          <span className="h-px flex-1 bg-neutral-800" />
          <span>or</span>
          <span className="h-px flex-1 bg-neutral-800" />
        </div>
        <div className="relative">
        <button type="button" onClick={onImportGradesheet} disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 py-2.5 pl-3 pr-11 text-sm font-semibold text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4" /></svg>
          Import gradesheet to get started
        </button>
          <div ref={importHelpRef} className="absolute inset-y-0 right-1 flex items-center" onMouseEnter={() => setImportHelpOpen(true)} onMouseLeave={() => setImportHelpOpen(false)}>
            <button type="button" aria-label="How gradesheet import works" aria-describedby={importHelpOpen ? "import-help" : undefined}
              onClick={() => setImportHelpOpen(true)} onFocus={() => setImportHelpOpen(true)} onBlur={() => setImportHelpOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[11px] font-bold" aria-hidden="true">?</span>
            </button>
            {importHelpOpen && <div id="import-help" role="tooltip" className="absolute bottom-full right-0 z-10 mb-2 w-56 max-w-[calc(100vw-64px)] rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs leading-5 text-neutral-200 shadow-xl">
              Upload the grade-sheet PDF downloaded from your university portal. We detect your student ID, suggest your stream, and read your completed courses. Review the details before confirming to create or update your account and planner.
            </div>}
          </div>
        </div>
        <a
          href={`${API_BASE}/auth/connect/start`}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 py-2.5 text-sm font-semibold text-neutral-200 hover:bg-neutral-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 12h6M12 9v6" /></svg>
          Login with Connect
        </a>
      </div>
    </div>
  );
}
