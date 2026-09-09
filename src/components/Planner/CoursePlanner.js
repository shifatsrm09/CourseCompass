import React, { useMemo, useState } from "react";
import thesisPlan from "../../data/thesisPlan.json";
import { getSemesterStatus } from "../../engine/plannerState.mjs";
import usePlanner from "../../engine/usePlanner";
import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

export default function CoursePlanner({ user, setUser, curriculum }) {
  const planner = usePlanner({ user, setUser, curriculum });
  const { state, dispatch, blocked, saveStatus } = planner;
  const [completionSemester, setCompletionSemester] = useState(null);
  const [modalContext, setModalContext] = useState(null);

  const slots = useMemo(() => (state?.semesters || []).map((semester) => ({
    ...semester,
    courses: semester.courses.map((instance) => ({
      ...curriculum.byId.get(instance.occurrenceId),
      ...instance,
      completed: curriculum.byId.get(instance.occurrenceId)?.code !== "COD" && state.completedCourses.includes(curriculum.byId.get(instance.occurrenceId)?.code),
    })),
    thesis: thesisPlan.find((item) => item.semester_row === semester.originalRow) || null,
  })), [state, curriculum]);

  const selectedSlot = slots.find((slot) => slot.id === modalContext?.semesterId);
  const modalCourses = useMemo(() => {
    if (!selectedSlot) return [];
    const usedIds = new Set(selectedSlot.courses.map((course) => course.occurrenceId));
    const hasCod = selectedSlot.courses.some((course) => course.code === "COD");
    const frozenIds = new Set(state.semesters.slice(0, state.currentSemester).flatMap((semester) => semester.courses.map((course) => course.occurrenceId)));
    const firstCod = curriculum.byCode.get("COD")?.[0]?.occurrenceId;
    return Array.from(curriculum.byId.values()).filter((course) => {
      if (course.code === "COD") return course.occurrenceId === firstCod && !hasCod;
      return !usedIds.has(course.occurrenceId) && !frozenIds.has(course.occurrenceId) && !state.completedCourses.includes(course.code);
    });
  }, [selectedSlot, curriculum, state]);

  const getStatus = (index) => getSemesterStatus(state, index);
  const canEdit = (index, slot) => !blocked && index >= state.currentSemester && !slot.isTarc;
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
    <div className="mx-auto max-w-3xl px-1 pb-10">
      <h2 className="mb-5 text-center text-2xl font-bold text-neutral-50 sm:text-3xl">Course Planner</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded-lg bg-neutral-800 px-3 py-1.5 text-sm font-semibold text-neutral-200">
          Total Courses: {totalCourses}
        </span>
      </div>

      {planner.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-900/60 bg-red-950/50 px-3.5 py-2.5 text-sm text-red-300">
          {planner.error}
        </p>
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
          onAdd={openAdd}
          onReplace={openReplace}
          onRemove={removeCourse}
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
