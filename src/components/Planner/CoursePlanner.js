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
     HELPER PERMISSION FUNCTIONS
  ─────────────────────────────────────────────── */

  const canModify = (index, slot) => {
    const status = getStatus(index);

    if (index === 0) return false;
    if (status === "current" || status === "recommended") return true;
    if (slot.isTarc) return true;

    return false;
  };

  const canRemove = (index, slot) => {
    const status = getStatus(index);
    if (index === 0) return false;
    if (slot.isTarc) return false;
    return status === "current" || status === "recommended";
  };

  /* ──────────────────────────────────────────────
     OPEN ADD COURSE MODAL
  ─────────────────────────────────────────────── */
  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    const status = getStatus(semesterIndex);

    if (!canModify(semesterIndex, slot)) return;

    // TARC cannot exceed 4
    if (slot.isTarc && slot.courses.length >= 4) return;

    const usedCodes = new Set(slot.courses.map((c) => c.code));

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);

    // include status & isTarc for modal logic
    setModalContext({
      mode: "add",
      semesterIndex,
      status,
      isTarc: slot.isTarc,
    });

    setEditModalVisible(true);
  };

  /* ──────────────────────────────────────────────
     OPEN REPLACE COURSE MODAL
  ─────────────────────────────────────────────── */
  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];
    const status = getStatus(semesterIndex);

    if (!canModify(semesterIndex, slot)) return;

    const usedCodes = new Set(
      slot.courses.map((c, i) => (i === courseIndex ? null : c.code))
    );

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);

    setModalContext({
      mode: "replace",
      semesterIndex,
      courseIndex,
      status,
      isTarc: slot.isTarc,
    });

    setEditModalVisible(true);
  };

  /* ──────────────────────────────────────────────
     REMOVE COURSE
  ─────────────────────────────────────────────── */
  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];

    if (!canRemove(semesterIndex, slot)) return;

    setSemesterSlots((prev) => {
      const slots = prev.map((slot) => ({
        ...slot,
        courses: Array.isArray(slot.courses) ? [...slot.courses] : [],
      }));

      const removedCourse = slots[semesterIndex].courses[courseIndex];

      slots[semesterIndex].courses.splice(courseIndex, 1);

      return reinsertRemovedCourse({
        semesterSlots: slots,
        removedCourse,
        fromSemesterIndex: semesterIndex,
        completedCourses: user.completedCourses || [],
        maxCoursesPerSemester: 5,
        maxCodPerSemester: 1,
      });
    });

    closeEditModal();
  };

  /* ──────────────────────────────────────────────
     SELECT COURSE FROM MODAL (ADD/REPLACE)
  ─────────────────────────────────────────────── */
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    const isCod = course.code === "COD";

    // TARC cap safeguard
    if (slot.isTarc && slot.courses.length >= 4) return;

    // VALIDATION for ADD
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
      if (!targetSlot) return prev;

      if (mode === "add") {
        if (isCod) {
          // ───────── COD SPECIAL BEHAVIOUR (pull from future) ─────────
          if (targetSlot.courses.length >= 5) return prev;
          const alreadyHasCod = targetSlot.courses.some(
            (c) => c.code === "COD"
          );
          if (alreadyHasCod) return prev;

          // Find nearest future semester that has a COD
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
            const futureSlot = slots[futureIndex];
            const codPos = futureSlot.courses.findIndex(
              (c) => c.code === "COD"
            );
            if (codPos !== -1) {
              codToInsert = futureSlot.courses[codPos];
              futureSlot.courses.splice(codPos, 1); // remove from future semester
            }
          }
          // else: no future COD → this becomes a new COD
          // (global cap already enforced in validateAddCourse)

          targetSlot.courses.push(codToInsert);
        } else {
          // ───────── NORMAL COURSE ADD ─────────
          if (targetSlot.courses.length >= 5) return prev;
          targetSlot.courses.push(course);

          // Remove this course from ALL future semesters
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            const s = slots[i];
            if (!Array.isArray(s.courses)) continue;
            s.courses = s.courses.filter((c) => c.code !== course.code);
          }
        }
      } else if (mode === "replace") {
        const slotToEdit = slots[semesterIndex];
        if (!slotToEdit) return prev;

        const newCourses = [...slotToEdit.courses];
        newCourses[courseIndex] = course;
        slotToEdit.courses = newCourses;

        // For non-COD replace, also remove future duplicates
        if (!isCod) {
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            const s = slots[i];
            if (!Array.isArray(s.courses)) continue;
            s.courses = s.courses.filter((c) => c.code !== course.code);
          }
        }
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
  );
}
