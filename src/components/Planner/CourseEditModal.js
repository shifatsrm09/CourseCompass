import React, { useState, useEffect, useMemo } from "react";

const GROUP_ORDER = [
  "COD",
  "TARC",
  "Program Core",
  "School Core",
  "GenEd",
  "Program Elective",
  "Elective",
  "Internship",
  "Others",
];

export default function CourseEditModal({
  visible,
  onClose,
  onSelect,
  onRemove,
  courses = [],
  modalContext,
  disabled = false,
  error = "",
  title = "Select a course",
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (visible) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [visible, onClose]);

  const disableRemove = disabled || !modalContext?.canRemove;

  const groupLabelFromCourse = (course) => {
    if (course.code === "COD") return "COD";
    if (course.is_tarc) return "TARC";

    const t = (course.type || "").toLowerCase();

    if (t.includes("core") && t.includes("program")) return "Program Core";
    if (t.includes("core") && t.includes("school")) return "School Core";
    if (t.startsWith("gened")) return "GenEd";
    if (t.includes("elective") && t.includes("program"))
      return "Program Elective";
    if (t.includes("elective")) return "Elective";
    if (t === "internship") return "Internship";

    return "Others";
  };

  const groupedCourses = useMemo(() => {
    const groups = {};

    courses.forEach((course) => {
      const g = groupLabelFromCourse(course);
      if (!groups[g]) groups[g] = [];
      groups[g].push(course);
    });

    Object.keys(groups).forEach((g) =>
      groups[g].sort((a, b) => a.code.localeCompare(b.code))
    );

    return GROUP_ORDER.filter((g) => groups[g]).map((g) => ({
      label: g,
      courses: groups[g],
    }));
  }, [courses]);

  const filteredGroups = groupedCourses
    .map((group) => ({
      ...group,
      courses: group.courses.filter((c) =>
        c.code.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.courses.length > 0);

  return !visible ? null : (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-edit-title"
        className="flex max-h-[85vh] w-full max-w-lg animate-fadeIn flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl shadow-black/50 sm:p-5"
      >
        <div className="mb-3">
          <h3 id="course-edit-title" className="text-lg font-bold text-neutral-100 sm:text-xl">
            {title}
          </h3>
        </div>

        <input
          className="mb-3.5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-base text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          placeholder="Search by course code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1.5">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-indigo-300/90">
                  {group.label}
                </div>

                <div className="flex flex-col gap-1.5">
                  {group.courses.map((course) => (
                    <button
                      key={course.occurrenceId}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-neutral-800 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-neutral-800/60"
                      onClick={() => onSelect(course)}
                      disabled={disabled || course.is_tarc}
                    >
                      <span className="font-semibold">{course.code}</span>
                      {course.isRepeat && (
                        <span className="ml-2 text-xs font-bold text-red-500">
                          RT (retake)
                        </span>
                      )}
                      {course.hp && course.hp.length > 0 && course.hp[0] !== "" && (
                        <span className="ml-2 text-xs font-semibold text-red-400">
                          HP: {course.hp.join(", ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-neutral-500">No matching courses.</p>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          {modalContext?.mode === "replace" && !disableRemove ? (
            <button
              type="button"
              className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/70"
              onClick={onRemove}
            >
              Remove Course
            </button>
          ) : <span />}

          <button
            type="button"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-700"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
