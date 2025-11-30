import React, { useState } from "react";
import "../../styles/planner.css";

import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";
import { validateAddCourse } from "../../engine/engine";
import { reinsertRemovedCourse } from "../../engine/removeEngine";

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
     OPEN ADD / REPLACE MODAL
  ─────────────────────────────────────────────── */

  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];

    if (slot.isTarc || slot.courses.length >= 5) return;

    const usedCodes = new Set(slot.courses.map((c) => c.code));

    // COD can be selected even if used elsewhere; per-semester COD check happens in validation.
    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({ mode: "add", semesterIndex });
    setEditModalVisible(true);
  };

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

  /* ──────────────────────────────────────────────
     REMOVE COURSE VIA MODAL ("Remove Course" button)
  ─────────────────────────────────────────────── */

  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;

    setSemesterSlots((prev) => {
      const slots = prev.map((slot) => ({
        ...slot,
        courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
      }));

      const slot = slots[semesterIndex];
      if (!slot) return prev;

      const removedCourse = slot.courses[courseIndex];
      if (!removedCourse) return prev;

      // Remove from that semester first
      slot.courses.splice(courseIndex, 1);

      // Reinsert using the remove engine (handles HP + chain)
      const rebalanced = reinsertRemovedCourse({
        semesterSlots: slots,
        removedCourse,
        fromSemesterIndex: semesterIndex,
        completedCourses: user.completedCourses || [],
        maxCoursesPerSemester: 5,
        maxCodPerSemester: 1,
      });

      return rebalanced;
    });

    closeEditModal();
  };

  /* ──────────────────────────────────────────────
     SELECT COURSE FROM MODAL (ADD or REPLACE)
  ─────────────────────────────────────────────── */

  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const isCod = course.code === "COD";

    // ── VALIDATION for ADD ──
    if (mode === "add") {
      const result = validateAddCourse({
        semesterIndex,
        courseToAdd: course,
        semesterSlots,
        currentSemester,
        completedCourses: user.completedCourses || [],
        maxCoursesPerSemester: 5,
        maxCodAllowed: 5,
      });

      if (!result.ok) {
        alert(result.reason || "You cannot add this course here.");
        return;
      }
    }

    setSemesterSlots((prev) => {
      const slots = prev.map((slot) => ({
        ...slot,
        courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
      }));

      const targetSlot = slots[semesterIndex];
      if (!targetSlot || targetSlot.isTarc) return prev;

      if (mode === "add") {
        // Special COD behavior: pull from closest future semester if possible
        if (isCod) {
          // Ensure target has room (validation already checked, but double safety)
          if (targetSlot.courses.length >= 5) return prev;
          const alreadyHasCod = targetSlot.courses.some(
            (c) => c.code === "COD"
          );
          if (alreadyHasCod) return prev;

          // Find nearest future semester that has a COD to "deduct" from
          let futureIndex = -1;
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            const s = slots[i];
            if ((s.courses || []).some((c) => c.code === "COD")) {
              futureIndex = i;
              break;
            }
          }

          let codToInsert = course;

          if (futureIndex !== -1) {
            // Pull that COD instance from the future semester
            const futureSlot = slots[futureIndex];
            const codPos = futureSlot.courses.findIndex(
              (c) => c.code === "COD"
            );
            if (codPos !== -1) {
              codToInsert = futureSlot.courses[codPos];
              futureSlot.courses.splice(codPos, 1);
            }
          }
          // else: no future COD → this becomes a new COD, but global limit
          // was already handled by validateAddCourse.

          targetSlot.courses.push(codToInsert);
        } else {
          // Normal ADD (non-COD)
          if (targetSlot.courses.length >= 5) return prev;
          targetSlot.courses.push(course);
        }
      } else if (mode === "replace") {
        // REPLACE: no COD pull, just swap
        const slot = slots[semesterIndex];
        if (!slot) return prev;

        const newCourses = [...slot.courses];
        newCourses[courseIndex] = course;
        slot.courses = newCourses;
      }

      return slots;
    });

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
