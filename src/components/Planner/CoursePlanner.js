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
      PERMISSION HELPERS
  ─────────────────────────────────────────────── */
  const canModify = (index, slot) => {
    const status = getStatus(index);

    if (index === 0) return false; // first semester locked
    if (status === "current" || status === "recommended") return true;
    if (slot.isTarc) return true; // TARC special case
    return false;
  };

  const canRemove = (index, slot) => {
    const status = getStatus(index);
    if (index === 0) return false;
    if (slot.isTarc) return false; // TARC cannot delete
    return status === "current" || status === "recommended";
  };

  /* ──────────────────────────────────────────────
      OPEN ADD MODAL (patched with new rules)
  ─────────────────────────────────────────────── */
  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    const status = getStatus(semesterIndex);

    // 1. Block first semester
    if (semesterIndex === 0) return;

    // 2. Block completed + locked
    if (!(status === "current" || status === "recommended" || slot.isTarc))
      return;

    // 3. Block TARC add if full (>=4)
    if (slot.isTarc && slot.courses.length >= 4) return;

    // 4. Existing original rule was WRONG (it blocked TARC completely)
    const usedCodes = new Set(slot.courses.map((c) => c.code));

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({ mode: "add", semesterIndex, isTarc: slot.isTarc });
    setEditModalVisible(true);
  };

  /* ──────────────────────────────────────────────
      OPEN REPLACE MODAL (patched with rules)
  ─────────────────────────────────────────────── */
  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];

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
      isTarc: slot.isTarc,
    });
    setEditModalVisible(true);
  };

  /* ──────────────────────────────────────────────
      REMOVE COURSE (patched)
  ─────────────────────────────────────────────── */
  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];

    if (!canRemove(semesterIndex, slot)) return;

    setSemesterSlots((prev) => {
      const slots = prev.map((slot) => ({
        ...slot,
        courses: [...slot.courses],
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
      SELECT FROM MODAL (KEEP OLD LOGIC)
  ─────────────────────────────────────────────── */
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex, isTarc } = modalContext;

    // Block add on full TARC
    const slot = semesterSlots[semesterIndex];
    if (slot.isTarc && slot.courses.length >= 4) return;

    // Validation for ADD only
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
        alert(result.reason || "You cannot add this course.");
        return;
      }
    }

    // Apply change
    setSemesterSlots((prev) => {
      const slots = prev.map((slot) => ({
        ...slot,
        courses: [...slot.courses],
      }));

      if (mode === "add") {
        slots[semesterIndex].courses.push(course);
      } else {
        slots[semesterIndex].courses[courseIndex] = course;
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
