import React, { useState, useEffect } from "react";
import "../../styles/planner.css";

import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

import { validateAddCourse } from "../../engine/engine";
import { reinsertRemovedCourse } from "../../engine/removeEngine";
import { balanceFutureSemesters } from "../../engine/balanceEngine";

const API_BASE = process.env.REACT_APP_API_URL;

export default function CoursePlanner({
  user,
  setUser, // NEW
  orderedCourses,
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  const [showModal, setShowModal] = useState(false);

  // Base plan: from JSON / orderedCourses
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
     HYDRATE FROM DB (customPlan) IF AVAILABLE
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user.customPlan || !Array.isArray(user.customPlan)) return;
    if (!Array.isArray(allCourses) || allCourses.length === 0) return;

    const restored = user.customPlan.map((p) => {
      const rowCourses = allCourses.filter((c) =>
        (p.courses || []).includes(c.code)
      );

      return {
        id: `sem-${p.semester}`,
        originalRow: p.semester,
        courses: rowCourses,
        isTarc: rowCourses.some((c) => c.is_tarc),
      };
    });

    setSemesterSlots(restored);
  }, [user.customPlan, allCourses]);

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
     HELPERS: SYNC PLAN TO SERVER + UPDATE USER
  ─────────────────────────────────────────────── */

  const buildPlanFromSlots = (slots) =>
    slots.map((slot) => ({
      semester: slot.originalRow,
      courses: (slot.courses || []).map((c) => c.code),
    }));

  const updateUserPlanInState = (slots) => {
    if (!setUser) return;

    const newCustomPlan = buildPlanFromSlots(slots);
    const updatedUser = {
      ...user,
      customPlan: newCustomPlan,
      firstLogin: false,
    };

    setUser(updatedUser);

    try {
      localStorage.setItem(
        "courseCompassUser",
        JSON.stringify({ user: updatedUser })
      );
    } catch (e) {
      console.error("Failed to persist user to localStorage:", e);
    }
  };

  const syncPlanToServer = async (slots) => {
    try {
      const plan = buildPlanFromSlots(slots);

      // count CODs globally
      const codCount = plan.reduce(
        (acc, sem) =>
          acc + sem.courses.filter((code) => code === "COD").length,
        0
      );

      // find current semester's courses based on originalRow
      const currentRow = currentSemester || 1;
      const currentSlot = slots.find((s) => s.originalRow === currentRow);
      const currentCourses = currentSlot
        ? (currentSlot.courses || []).map((c) => c.code)
        : [];

      await fetch(`${API_BASE}/planner/save-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user.studentId,
          plan,
          codCount,
          currentCourses,
        }),
      });
    } catch (err) {
      console.error("Failed to sync plan to server:", err);
      // Silent fail: do not annoy user on brief network issue
    }
  };

  /* ──────────────────────────────────────────────
     AUTO BALANCE BUTTON HANDLER
  ─────────────────────────────────────────────── */
  const handleBalance = () => {
    // Block on pure default BRAC layout
    if (!user.customPlan || user.firstLogin) {
      alert(
        "This is the official BRAC sequence.\n" +
          "Auto-balance becomes available after you modify your plan or complete a semester."
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

      const rebalanced = reinsertRemovedCourse({
        semesterSlots: slots,
        removedCourse,
        fromSemesterIndex: semesterIndex,
        completedCourses: user.completedCourses || [],
        maxCoursesPerSemester: 5,
        maxCodPerSemester: 1,
      });

      syncPlanToServer(rebalanced);
      updateUserPlanInState(rebalanced);

      return rebalanced;
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
          // COD special behaviour (pull from future)
          if (targetSlot.courses.length >= 5) return prev;
          const alreadyHasCod = targetSlot.courses.some(
            (c) => c.code === "COD"
          );
          if (alreadyHasCod) return prev;

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
              futureSlot.courses.splice(codPos, 1);
            }
          }

          targetSlot.courses.push(codToInsert);
        } else {
          // Normal course add
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

      syncPlanToServer(slots);
      updateUserPlanInState(slots);

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
  );
}
