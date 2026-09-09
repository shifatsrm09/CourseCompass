import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";
import streamsConfig from "../data/streamsConfig";

const SEASONS = ["Spring", "Summer", "Fall"];

export default function StreamSelect({ studentId, onUpdate, mode = "create", onCancel }) {
  const isChange = mode === "change";
  const [stream, setStream] = useState("");
  const [season, setSeason] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current + 1; y >= current - 6; y -= 1) years.push(y);
    return years;
  }, []);

  const saveStream = async () => {
    if (pending.current) return;
    if (!streamsConfig[stream]) {
      setError("Please select a valid stream.");
      return;
    }
    if (!SEASONS.includes(season) || !year) {
      setError("Please select the season and year of your first semester.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/set-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          stream,
          startTerm: { season, year: Number(year) },
          ...(isChange ? { confirmMigration: true } : {}),
        }),
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
            <h2 className="text-xl font-bold leading-tight text-neutral-50 sm:text-2xl">
              {isChange ? "Change Your Plan" : "Select Your Stream"}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-400">
              {isChange ? "Pick a stream and starting term to restart your plan." : "This sets the default curriculum for your plan."}
            </p>
          </div>
        </div>

        {isChange && (
          <p className="mb-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-200">
            Saving here replaces your current stream and wipes your existing progress and plan, just like a brand-new account. This can't be undone.
          </p>
        )}

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
                style={{ colorScheme: "dark" }}
                className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 pr-9 text-base text-neutral-100 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
              >
                <option value="" disabled hidden>Choose Stream</option>
                {Object.values(streamsConfig).map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">
              Your first semester
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  aria-label="First semester season"
                  value={season}
                  disabled={busy}
                  onChange={(event) => { setSeason(event.target.value); setError(""); }}
                  style={{ colorScheme: "dark" }}
                  className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 pr-9 text-base text-neutral-100 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                >
                  <option value="" disabled hidden>Season</option>
                  {SEASONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
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
              <div className="relative">
                <select
                  aria-label="First semester year"
                  value={year}
                  disabled={busy}
                  onChange={(event) => { setYear(event.target.value); setError(""); }}
                  style={{ colorScheme: "dark" }}
                  className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 pr-9 text-base text-neutral-100 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                >
                  <option value="" disabled hidden>Year</option>
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
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
            <p className="mt-1.5 text-xs text-neutral-500">Used to label each semester card with its real term, e.g. Spring 2024.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={saveStream}
            disabled={!stream || !season || !year || busy}
            className={`mt-1 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-default disabled:opacity-50 ${
              isChange
                ? "bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:hover:bg-red-600"
                : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:hover:bg-indigo-600"
            }`}
          >
            {busy ? "Saving…" : isChange ? "Replace my plan" : "Save Stream"}
          </button>

          {isChange ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-default disabled:opacity-50"
            >
              Cancel
            </button>
          ) : (
            <p className="text-center text-xs text-neutral-500">You can start over with another stream using Change Plan in settings.</p>
          )}
        </div>
      </div>
    </div>
  );
}
