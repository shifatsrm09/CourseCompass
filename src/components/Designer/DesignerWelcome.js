import React from "react";

export default function DesignerWelcome({ onSync, syncing = false, error = "" }) {
  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-md sm:p-12">
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-600/25 to-indigo-600/0 blur-3xl"
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Badge & Icon */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Designer Workspace
          </div>

          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/30 shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>

          {/* Heading and Subtitle as specified */}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
            Welcome to Designer
          </h1>
          <p className="mt-2 text-base font-medium text-neutral-400 sm:text-lg">
            Modify your planner with more elevated permission
          </p>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            Designer is a completely private, isolated sandbox where you can freely test custom course arrangements, move semesters, and simulate alternative paths without affecting your official Main Planner.
          </p>

          {/* Error Message */}
          {error && (
            <div role="alert" className="mt-5 w-full rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Action Button & Caption as specified */}
          <div className="mt-8 flex w-full flex-col items-center">
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="inline-flex w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-violet-500 hover:to-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Syncing with Main…</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                    <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
                  </svg>
                  <span>Sync with Main</span>
                </>
              )}
            </button>
            <p className="mt-2.5 text-xs font-medium text-neutral-400">
              Current planner to start with
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="mt-10 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-3.5">
              <div className="text-xs font-semibold text-violet-300">Protected Main</div>
              <div className="mt-1 text-[11px] text-neutral-400 leading-normal">
                Your official plan remains untouched no matter what you change here.
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-3.5">
              <div className="text-xs font-semibold text-indigo-300">Independent Storage</div>
              <div className="mt-1 text-[11px] text-neutral-400 leading-normal">
                Persisted separately in MongoDB so your experiments are always waiting for you.
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 p-3.5">
              <div className="text-xs font-semibold text-emerald-300">Fresh Sync Anytime</div>
              <div className="mt-1 text-[11px] text-neutral-400 leading-normal">
                Re-sync at any time to reset your Designer workspace to your latest Main Planner.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
