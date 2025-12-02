/**
 * =========================================================================
 * CoursePlanner/index.js - PATCHED WITH MAIN CONTENT
 * =========================================================================
 * PURPOSE:
 *   This is the MAIN orchestrator component of the entire planner system.
 *   It brings together all custom hooks, UI components, and business logic
 *   to render the interactive semester-by-semester Course Planner UI.
 *
 * RESPONSIBILITY:
 *   - Initialize and manage semester slots (via usePlannerState)
 *   - Sync plan updates to both:
 *        › Local user state/localStorage (via usePlannerSync)
 *        › Server API (via usePlannerSync)
 *   - Handle:
 *        › Completing a semester
 *        › Auto-Balancing future semesters
 *        › Opening course editing modals
 *        › Status calculation (current, completed, recommended, locked)
 *   - Render:
 *        › ConfirmModal (complete semester)
 *        › SemesterList (all semesters + drag/drop)
 *        › CourseEditModal (add/replace course dialog)
 *
 * WHY THIS FILE EXISTS:
 *   The old CoursePlanner.js reached ~600 lines and became unmaintainable.
 *   This refactored version delegates logic into small, focused hooks:
 *
 *      usePlannerState      → loading & hydrating semester plan
 *      usePlannerSync       → server/local syncing
 *      usePlannerModals     → add/replace/remove course UI logic
 *      plannerUtils         → building slots from stream/custom plan
 *
 * HOW IT FITS INTO COURSE COMPASS:
 *   This is the core engine of the front-end planning experience.
 *   All user interactions flow through this component.
 *
 * INPUT PROPS:
 *   - user               → current logged-in user data
 *   - setUser            → update user globally
 *   - orderedCourses     → stream courses grouped by semester
 *   - currentSemester    → active semester number
 *   - setCurrentSemester → update semester in Dashboard
 *   - allCourses         → unique list of all selectable courses
 *
 * EXPORTS:
 *   <CoursePlanner /> used by Dashboard.js
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/index.js
import React, { useState } from "react";
import "../../../styles/planner.css";

import usePlannerState from "./usePlannerState";
import usePlannerSync from "./usePlannerSync";
import usePlannerModals from "./usePlannerModals";
// REMOVED: PlannerHeader import - navbar now handles this

import ConfirmModal from "../ConfirmModal";
import CourseEditModal from "../CourseEditModal";
import SemesterList from "../SemesterList";

import { balanceFutureSemesters } from "../../../engine/balanceEngine";

const API_BASE = process.env.REACT_APP_API_URL;

export default function CoursePlanner({
  user,
  setUser,
  orderedCourses,
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  // Slots & initial plan loading
  const { semesterSlots, setSemesterSlots } = usePlannerState({
    user,
    allCourses,
  });

  // Sync helpers (local user + server)
  const { updateUserPlanInState, syncPlanToServer } = usePlannerSync({
    user,
    setUser,
    currentSemester,
  });

  // Complete-semester modal
  const [showModal, setShowModal] = useState(false);

  // Status helper (completed / current / recommended / locked)
  const getStatus = (index) => {
    const safe = currentSemester || 1;
    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  // Add / Replace / Remove course modals & logic
  const {
    editModalVisible,
    modalCourses,
    modalContext,
    openAddCourseModal,
    openReplaceCourseModal,
    handleCourseSelected,
    handleRemoveCourse,
    closeEditModal,
  } = usePlannerModals({
    semesterSlots,
    setSemesterSlots,
    allCourses,
    user,
    currentSemester,
    syncPlanToServer,
    updateUserPlanInState,
    getStatus,
  });

  // Auto-balance future semesters
  const handleBalance = () => {
    if (!user.customPlan || user.firstLogin) {
      alert(
        "This is the official BRAC sequence.\nAuto-balance becomes available after any edit or completing a semester."
      );
      return;
    }

    setSemesterSlots((prev) => {
      const balanced = balanceFutureSemesters({
        semesterSlots: prev,
        currentSemester,
        completedCourses: user.completedCourses || [],
      });

      syncPlanToServer(balanced);
      updateUserPlanInState(balanced);
      return balanced;
    });
  };

  // Complete semester flow
  const openPrompt = () => setShowModal(true);
  const cancelComplete = () => setShowModal(false);

  const confirmComplete = async () => {
    setShowModal(false);

    const res = await fetch(`${API_BASE}/planner/complete-semester`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: user.studentId }),
    });

    const data = await res.json();
    if (!data.success) {
      alert("Error: " + data.error);
      return;
    }

    setCurrentSemester(data.user.currentSemester, data.user);
  };

  return (
    <div className="planner-container dark-container">
      {/* MAIN CONTENT WRAPPER */}
      <div className="main-content">
        {/* Title Section */}
        <h2 className="planner-title">Course Planner</h2>
        <p className="planner-subtitle">Plan your academic journey</p>

        {/* Complete Semester Modal */}
        <ConfirmModal
          visible={showModal}
          onConfirm={confirmComplete}
          onCancel={cancelComplete}
          semester={currentSemester || 1}
        />

        {/* Semester List with Auto-Balance */}
        <SemesterList
          semesterSlots={semesterSlots}
          setSemesterSlots={setSemesterSlots}
          getStatus={getStatus}
          openPrompt={openPrompt}
          openAddCourseModal={openAddCourseModal}
          openReplaceCourseModal={openReplaceCourseModal}
          currentSemester={currentSemester}
          user={user}
          onBalance={handleBalance}
        />

        {/* Course Edit Modal */}
        <CourseEditModal
          visible={editModalVisible}
          onClose={closeEditModal}
          onSelect={handleCourseSelected}
          onRemove={handleRemoveCourse}
          courses={modalCourses}
          modalContext={modalContext}
          title={
            modalContext?.mode === "add" ? "Add a course" : "Replace course"
          }
        />
      </div>
    </div>
  );
}