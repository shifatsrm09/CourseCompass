import { useEffect, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";
import streamsConfig from "../data/streamsConfig";

export default function StreamSelect({ studentId, onUpdate }) {
  const [stream, setStream] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const saveStream = async () => {
    if (pending.current) return;
    if (!streamsConfig[stream]) {
      setError("Please select a valid stream.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/set-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, stream }),
      });
      const data = await readApiResponse(response);
      if (!mounted.current) return;
      if (response.ok && data.user) onUpdate(data.user);
      else setError(data.error || "Could not save stream. Please try again.");
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Could not connect to Course Compass. Please retry.");
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
              <path d="M9 3v18" />
              <path d="M3 9h18" />
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight text-neutral-50 sm:text-2xl">Select Your Stream</h2>
            <p className="mt-0.5 text-sm text-neutral-400">This sets the default curriculum for your plan.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="stream-select" className="mb-1.5 block text-sm font-medium text-neutral-300">
              Stream
            </label>
            <div className="relative">
              <select
                id="stream-select"
                value={stream}
                disabled={busy}
                onChange={(event) => { setStream(event.target.value); setError(""); }}
                className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 pr-9 text-base text-neutral-100 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              >
                <option value="">Choose Stream</option>
                {Object.values(streamsConfig).map((option) => (
                  <option key={option.id} value={option.id} style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}>{option.label}</option>
                ))}
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              >
                <path d="m5 7.5 5 5 5-5" />
              </svg>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={saveStream}
            disabled={!stream || busy}
            className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            {busy ? "Saving…" : "Save Stream"}
          </button>

          <p className="text-center text-xs text-neutral-500">Please choose your correct stream. This can only be changed with a plan migration later.</p>
        </div>
      </div>
    </div>
  );
}
