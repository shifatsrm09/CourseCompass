import React, { useMemo, useState } from "react";
import "../../styles/planner.css";
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

  const removeCourse = () => {
    if (modalContext && dispatch({
      type: "REMOVE_COURSE",
      semesterId: modalContext.semesterId,
      instanceId: modalContext.instanceId,
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
    <div className="planner-container dark-container">
      <h2 className="planner-title">Course Planner</h2>
      <div className="planner-summary">Total Courses: {totalCourses}</div>
      {planner.error && <p role="alert" className="planner-error">{planner.error}</p>}
      {planner.warnings.length > 0 && (
        <div className="planner-notice" role="status">
          {planner.warnings.map((warning, index) => <p key={index}>{typeof warning === "string" ? warning : warning.message}</p>)}
        </div>
      )}
      <div className="planner-save-state" role={recoveryNeeded ? "alert" : "status"} aria-live="polite">
        {saveStatus.message && <span>{saveStatus.message}</span>}
        {["error", "pending"].includes(saveStatus.kind) && (
          <button type="button" className="cancel-btn" onClick={planner.retrySave}>Retry save</button>
        )}
        {(recoveryNeeded || (blocked && !planner.reloadBusy)) && (
          <button type="button" className="cancel-btn" onClick={planner.reloadSavedPlan} disabled={planner.reloadBusy}>
            Load saved plan (discard unsaved changes)
          </button>
        )}
        {planner.reloadBusy && <span>Loading saved plan…</span>}
      </div>
      {state?.unplaced?.length > 0 && (
        <div className="planner-notice" role="status">
          <p>Courses awaiting a valid semester. Use Auto Balance to place them.</p>
          <div className="courses-col">
            {state.unplaced.map((instance) => <span className="course-box" key={instance.instanceId}>
              {curriculum.byId.get(instance.occurrenceId)?.code || instance.occurrenceId}
            </span>)}
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
        onRemove={removeCourse}
        courses={modalCourses}
        modalContext={modalContext}
        disabled={blocked}
        error={planner.error}
        title={modalContext?.mode === "add" ? "Add a course" : `Replace ${modalContext?.code || "course"}`}
      />
    </div>
  );
}
