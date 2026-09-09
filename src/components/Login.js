import { useEffect, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";

export default function Login({ onLogin }) {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
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
      </div>
    </div>
  );
}
