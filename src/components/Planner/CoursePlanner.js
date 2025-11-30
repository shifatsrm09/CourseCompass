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

  const getStatus = (index) => {
    const safe = currentSemester || 1;
    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

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
    } catch (err) {
      alert("Network error contacting server.");
    }
  };

  const handleDropCourse = (semesterIndex, courseIndex) => {
    setSemesterSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== semesterIndex || slot.isTarc) return slot;
        return {
          ...slot,
          courses: slot.courses.filter((_, i) => i !== courseIndex),
        };
      })
    );
  };

  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    if (slot.isTarc || slot.courses.length >= 5) return;

    const usedCodes = new Set(slot.courses.map((c) => c.code));
    const selectable = allCourses.filter((c) => !usedCodes.has(c.code));

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
    const selectable = allCourses.filter((c) => !usedCodes.has(c.code));

    setModalCourses(selectable);
    setModalContext({ mode: "replace", semesterIndex, courseIndex });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;

    setSemesterSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== semesterIndex || slot.isTarc) return slot;

        const newCourses = [...slot.courses];

        if (mode === "add") {
          if (newCourses.length < 5) newCourses.push(course);
        } else if (mode === "replace") {
          newCourses[courseIndex] = course;
        }

        return { ...slot, courses: newCourses };
      })
    );

    closeEditModal();
  };

  return (
    <div className="planner-container">
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
        handleDropCourse={handleDropCourse}
        currentSemester={currentSemester}
        user={user}
      />

      <CourseEditModal
        visible={editModalVisible}
        onClose={closeEditModal}
        onSelect={handleCourseSelected}
        courses={modalCourses}
        title={
          modalContext?.mode === "add" ? "Add a course" : "Replace course"
        }
      />
    </div>
  );
}
