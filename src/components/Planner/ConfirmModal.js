import React, { useEffect } from "react";

export default function ConfirmModal({ visible, onConfirm, onCancel, semester, disabled = false, error = "" }) {
  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [visible, onCancel]);

  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-semester-title"
        className="w-full max-w-sm animate-fadeIn rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl"
      >
        <h3 id="complete-semester-title" className="text-base font-semibold text-neutral-50">
          Complete Semester {semester}?
        </h3>
        <p className="mt-2 text-sm text-neutral-400">
          Are you sure you have completed all courses in this semester?
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-default disabled:opacity-60"
          >
            Yes, Complete
          </button>
        </div>
      </div>
    </div>
  );
}
