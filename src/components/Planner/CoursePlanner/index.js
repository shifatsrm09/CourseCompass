import React, { useState } from "react";
import "../../../styles/planner.css";

import usePlannerState from "./usePlannerState";
import usePlannerSync from "./usePlannerSync";
import usePlannerModals from "./usePlannerModals";

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
  // ------------------------------
  // Load semester state
  // ------------------------------
  const { semesterSlots, setSemesterSlots } = usePlannerState({
    user,
    allCourses,
  });

  // ------------------------------
  // Sync helpers (local + server)
  // ------------------------------
  const { updateUserPlanInState, syncPlanToServer } = usePlannerSync({
    user,
    setUser,
    currentSemester,
  });

  // ------------------------------
  // Modal for completing a semester
  // ------------------------------
  const [showModal, setShowModal] = useState(false);

  const getStatus = (index) => {
    const safe = currentSemester || 1;
    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  // ------------------------------
  // Add / Replace / Remove Course Modals
  // ------------------------------
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

  // ------------------------------
  // Auto-Balance Handler
  // ------------------------------
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
        semesterOrder: user.semesterOrder || [], // <-- TARC LOCK
      });

      syncPlanToServer(balanced);
      updateUserPlanInState(balanced);
      return balanced;
    });
  };

  // ------------------------------
  // Semester Completion
  // ------------------------------
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

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="planner-container dark-container">
      <div className="main-content">
        <h2 className="planner-title">Course Compass</h2>

        <ConfirmModal
          visible={showModal}
          onConfirm={confirmComplete}
          onCancel={cancelComplete}
          semester={currentSemester || 1}
        />

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
