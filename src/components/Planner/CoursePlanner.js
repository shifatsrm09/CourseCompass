import React, { useEffect, useMemo, useState } from "react";
import thesisPlan from "../../data/thesisPlan.json";
import { getSemesterStatus } from "../../engine/plannerState.mjs";
import usePlanner from "../../engine/usePlanner";
import { advanceTerm, formatTermLabel } from "../../engine/academicTerm";
import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

export default function CoursePlanner({ user, setUser, curriculum }) {
  const planner = usePlanner({ user, setUser, curriculum });
  const { state, dispatch, blocked, saveStatus } = planner;
  const [completionSemester, setCompletionSemester] = useState(null);
  const [modalContext, setModalContext] = useState(null);

  // Repeat/retake course labels are a purely cosmetic UI layer kept outside the
  // planner engine entirely. They are never dispatched to the engine, never
  // validated by it, and never affect scheduling, balancing, or completion
  // logic in any way — they are just a tag rendered on top of the plan.
  const repeatStorageKey = `courseCompass:repeatCourses:${user?.studentId || "anon"}:${curriculum?.stream || "default"}`;
  const [repeatCourses, setRepeatCourses] = useState(() => {
    try {
      const stored = window.localStorage.getItem(repeatStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(repeatStorageKey, JSON.stringify(repeatCourses));
    } catch {
      // Best-effort only; repeat labels are cosmetic and never block the plan.
    }
  }, [repeatCourses, repeatStorageKey]);

  const addRepeatCourse = (semesterId, code) => {
    setRepeatCourses((previous) => [
      ...previous,
      { id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, semesterId, code },
    ]);
  };
  const removeRepeatCourse = (semesterId, repeatId) => {
    setRepeatCourses((previous) => previous.filter((entry) => !(entry.semesterId === semesterId && entry.id === repeatId)));
  };

  const slots = useMemo(() => (state?.semesters || []).map((semester, index) => ({
    ...semester,
    courses: semester.courses.map((instance) => ({
      ...curriculum.byId.get(instance.occurrenceId),
      ...instance,
      completed: curriculum.byId.get(instance.occurrenceId)?.code !== "COD" && state.completedCourses.includes(curriculum.byId.get(instance.occurrenceId)?.code),
    })),
    repeats: repeatCourses.filter((entry) => entry.semesterId === semester.id),
    thesis: thesisPlan.find((item) => item.semester_row === semester.originalRow) || null,
    termLabel: formatTermLabel(advanceTerm(user.startTerm, index)),
  })), [state, curriculum, user.startTerm, repeatCourses]);

  const selectedSlot = slots.find((slot) => slot.id === modalContext?.semesterId);
  const modalCourses = useMemo(() => {
    if (!selectedSlot) return [];
    const usedIds = new Set(selectedSlot.courses.map((course) => course.occurrenceId));
    const hasCod = selectedSlot.courses.some((course) => course.code === "COD");
    const frozenIds = new Set(state.semesters.slice(0, state.currentSemester - 1).flatMap((semester) => semester.courses.map((course) => course.occurrenceId)));
    const firstCod = curriculum.byCode.get("COD")?.[0]?.occurrenceId;
    const available = Array.from(curriculum.byId.values()).filter((course) => {
      if (course.code === "COD") return course.occurrenceId === firstCod && !hasCod;
      return !usedIds.has(course.occurrenceId) && !frozenIds.has(course.occurrenceId) && !state.completedCourses.includes(course.code);
    });
    if (modalContext?.mode !== "add") return available;
    // Retake candidates: completed courses, offered as cosmetic "RT" picks only.
    // Selecting one never touches the engine — see selectCourse below.
    const existingRepeatCodes = new Set(repeatCourses.filter((entry) => entry.semesterId === modalContext.semesterId).map((entry) => entry.code));
    const repeatCandidates = state.completedCourses
      .filter((code) => code !== "COD" && !existingRepeatCodes.has(code))
      .map((code) => curriculum.byCode.get(code)?.[0])
      .filter(Boolean)
      .map((course) => ({ ...course, isRepeat: true }));
    return [...available, ...repeatCandidates];
  }, [selectedSlot, curriculum, state, modalContext, repeatCourses]);

  const getStatus = (index) => getSemesterStatus(state, index);
  const canEdit = (index, slot) => !blocked && index >= state.currentSemester - 1 && !slot.isTarc;
  const closeEditModal = () => setModalContext(null);

  const openAdd = (semesterId) => {
    const index = slots.findIndex((slot) => slot.id === semesterId);
    if (index < 0 || !canEdit(index, slots[index])) return;
    planner.clearError();
    setModalContext({ mode: "add", semesterId, canRemove: false });
  };

  const openReplace = (semesterId, instanceId) => {
    const index = slots.findIndex((slot) => slot.id === semesterId);
    if (index < 0 || !canEdit(index, slots[index])) return;
    const course = slots[index].courses.find((item) => item.instanceId === instanceId);
    if (!course || course.completed) return;
    planner.clearError();
    setModalContext({ mode: "replace", semesterId, instanceId, code: course.code, canRemove: true });
  };

  const selectCourse = (course) => {
    if (!modalContext) return;
    if (modalContext.mode === "add" && course.isRepeat) {
      addRepeatCourse(modalContext.semesterId, course.code);
      closeEditModal();
      return;
    }
    if (dispatch({
      type: modalContext.mode === "add" ? "ADD_COURSE" : "REPLACE_COURSE",
      semesterId: modalContext.semesterId,
      instanceId: modalContext.instanceId,
      occurrenceId: course.occurrenceId,
    })) closeEditModal();
  };

  const removeCourse = (semesterId, instanceId) => {
    if (!semesterId || !instanceId) return;
    if (dispatch({
      type: "REMOVE_COURSE",
      semesterId,
      instanceId,
    })) closeEditModal();
  };

  const completeSemester = () => {
    if (dispatch({ type: "COMPLETE_SEMESTER", semesterId: completionSemester })) {
      setCompletionSemester(null);
    }
  };

  const recoveryNeeded = ["error", "conflict", "pending"].includes(saveStatus.kind);
  const totalCourses = slots.reduce((sum, slot) => sum + slot.courses.length, 0) + (state?.unplaced?.length || 0);

  return (
    <div className="mx-auto min-w-0 max-w-3xl px-0 pb-10 sm:px-1">
      <h2 className="mb-4 text-center text-xl font-bold text-neutral-50 sm:mb-5 sm:text-3xl">CSE Course Planner</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 sm:px-3 sm:text-sm">
          Total Courses: {totalCourses}
        </span>
        <span className="inline-block rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-xs font-semibold text-red-300 sm:px-3 sm:text-sm">
          Repeat Courses: {repeatCourses.length}
        </span>
      </div>

      {planner.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3.5 py-2.5 text-sm text-red-300">
          {planner.error}
        </p>
      )}

      {user.gradesheetImport?.records?.length > 0 && (
        <details className="mb-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-400">
          <summary className="cursor-pointer font-medium text-neutral-200">Imported grade history</summary>
          <p className="mt-2">Original grades are retained here. Planner edits and undoing completion do not change the uploaded academic record.</p>
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {user.gradesheetImport.records.map(record => (
              <li key={record.id} className="flex flex-wrap justify-between gap-x-2">
                <span>{record.term.season} {record.term.year} · {record.code}{record.occurrenceId && curriculum.byId.get(record.occurrenceId)?.code === "COD" ? " → COD" : ""}</span>
                <span>{record.grade} · {record.credits} credits</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {planner.warnings.length > 0 && (
        <div role="status" className="mb-3 space-y-1 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3.5 py-2.5 text-sm text-amber-200">
          {planner.warnings.map((warning, index) => (
            <p key={index}>{typeof warning === "string" ? warning : warning.message}</p>
          ))}
        </div>
      )}

      <div
        role={recoveryNeeded ? "alert" : "status"}
        aria-live="polite"
        className="mb-3 flex flex-wrap items-center gap-2.5 text-sm text-neutral-400"
      >
        {saveStatus.message && <span>{saveStatus.message}</span>}
        {["error", "pending"].includes(saveStatus.kind) && (
          <button
            type="button"
            onClick={planner.retrySave}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700"
          >
            Retry save
          </button>
        )}
        {(recoveryNeeded || (blocked && !planner.reloadBusy)) && (
          <button
            type="button"
            onClick={planner.reloadSavedPlan}
            disabled={planner.reloadBusy}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-default disabled:opacity-50"
          >
            Load saved plan (discard unsaved changes)
          </button>
        )}
        {planner.reloadBusy && <span>Loading saved plan…</span>}
      </div>

      {state?.unplaced?.length > 0 && (
        <div role="status" className="mb-3 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3.5 py-2.5 text-sm text-amber-200">
          <p className="mb-2">Courses awaiting a valid semester. Use Auto Balance to place them.</p>
          <div className="flex flex-wrap gap-2">
            {state.unplaced.map((instance) => (
              <span
                key={instance.instanceId}
                className="inline-flex items-center rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-semibold text-neutral-100"
              >
                {curriculum.byId.get(instance.occurrenceId)?.code || instance.occurrenceId}
              </span>
            ))}
          </div>
        </div>
      )}

      {state && (
        <SemesterList
          semesterSlots={slots}
          getStatus={getStatus}
          canEdit={canEdit}
          blocked={blocked}
          onComplete={(semesterId) => { planner.clearError(); setCompletionSemester(semesterId); }}
          onUndoComplete={(semesterId) => dispatch({ type: "UNDO_COMPLETE_SEMESTER", semesterId })}
          onAdd={openAdd}
          onReplace={openReplace}
          onRemove={removeCourse}
          onRemoveRepeat={removeRepeatCourse}
          onMoveTarc={(semesterId, toIndex) => dispatch({ type: "MOVE_TARC", semesterId, toIndex })}
          onBalance={() => dispatch({ type: "REBALANCE" })}
        />
      )}

      <ConfirmModal
        visible={Boolean(completionSemester)}
        onConfirm={completeSemester}
        onCancel={() => setCompletionSemester(null)}
        semester={slots.findIndex((slot) => slot.id === completionSemester) + 1}
        disabled={blocked}
        error={planner.error}
      />
      <CourseEditModal
        visible={Boolean(modalContext)}
        onClose={closeEditModal}
        onSelect={selectCourse}
        onRemove={() => removeCourse(modalContext?.semesterId, modalContext?.instanceId)}
        courses={modalCourses}
        modalContext={modalContext}
        disabled={blocked}
        error={planner.error}
        title={modalContext?.mode === "add" ? "Add a course" : `Replace ${modalContext?.code || "course"}`}
      />
    </div>
  );
}
