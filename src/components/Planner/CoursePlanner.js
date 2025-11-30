import React, { useState } from "react";
import "../../styles/planner.css";

import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

const API_BASE = process.env.REACT_APP_API_URL;

export default function CoursePlanner({
  user,
  orderedCourses,
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  const [showModal, setShowModal] = useState(false);

  const [semesterSlots, setSemesterSlots] = useState(
    orderedCourses.map((row) => ({
      id: `sem-${row.semester_row}`,
      originalRow: row.semester_row,
      courses: row.courses,
      isTarc: row.courses.some((c) => c.is_tarc),
    }))
  );

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);

  /* ──────────────────────────────────────────────
     SEMESTER STATUS
  ─────────────────────────────────────────────── */
  const getStatus = (index) => {
    const safe = currentSemester || 1;

    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  /* ──────────────────────────────────────────────
     MARK SEMESTER COMPLETE
  ─────────────────────────────────────────────── */
  const openPrompt = () => setShowModal(true);
  const cancelComplete = () => setShowModal(false);

  const confirmComplete = async () => {
    setShowModal(false);

    try {
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
    } catch {
      alert("Network error contacting server.");
    }
  };

  /* ──────────────────────────────────────────────
     COURSE EDITING LOGIC
  ─────────────────────────────────────────────── */

  // Add a course
  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];

    if (slot.isTarc || slot.courses.length >= 5) return;

    const usedCodes = new Set(slot.courses.map((c) => c.code));

    // COD is ALWAYS allowed
    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({ mode: "add", semesterIndex });
    setEditModalVisible(true);
  };

  // Replace a course
  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];

    if (slot.isTarc) return;

    const usedCodes = new Set(
      slot.courses.map((c, i) => (i === courseIndex ? null : c.code))
    );

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({ mode: "replace", semesterIndex, courseIndex });
    setEditModalVisible(true);
  };

  // Remove course from semester
  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;

    setSemesterSlots((prev) =>
      prev.map((slot, idx) =>
        idx === semesterIndex
          ? {
              ...slot,
              courses: slot.courses.filter((_, i) => i !== courseIndex),
            }
          : slot
      )
    );

    closeEditModal();
  };

  // Select course from modal
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;

    setSemesterSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== semesterIndex || slot.isTarc) return slot;

        const newCourses = [...slot.courses];

        if (mode === "add" && newCourses.length < 5) {
          newCourses.push(course);
        } else if (mode === "replace") {
          newCourses[courseIndex] = course;
        }

        return { ...slot, courses: newCourses };
      })
    );

    closeEditModal();
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  /* ──────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────── */
  return (
    <div className="planner-container dark-container">
      <h2 className="planner-title">Course Planner</h2>

      {/* Confirm Complete Modal */}
      <ConfirmModal
        visible={showModal}
        onConfirm={confirmComplete}
        onCancel={cancelComplete}
        semester={currentSemester || 1}
      />

      {/* Semester List */}
      <SemesterList
        semesterSlots={semesterSlots}
        setSemesterSlots={setSemesterSlots}
        getStatus={getStatus}
        openPrompt={openPrompt}
        openAddCourseModal={openAddCourseModal}
        openReplaceCourseModal={openReplaceCourseModal}
        currentSemester={currentSemester}
        user={user}
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
  );
}
