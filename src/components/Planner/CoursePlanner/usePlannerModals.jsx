/**
 * =========================================================================
 * usePlannerModals.js
 * =========================================================================
 * PURPOSE:
 *   Centralized logic for all modal-driven planner interactions:
 *     ✔ Add Course
 *     ✔ Replace Course
 *     ✔ Remove Course
 *
 * RESPONSIBILITY:
 *   Contains UI-facing logic such as:
 *     - Selecting which courses can be added/replaced
 *     - Determining if a semester/course is editable
 *     - Running validation checks (via engine)
 *     - Mutating semesterSlots safely
 *     - Removing COD from future semesters when necessary
 *     - Reinserting removed courses intelligently
 *
 * KEY OPERATIONS:
 *   - openAddCourseModal()
 *   - openReplaceCourseModal()
 *   - handleCourseSelected()
 *   - handleRemoveCourse()
 *   - closeEditModal()
 *
 * WHY THIS FILE EXISTS:
 *   Course editing rules are some of the most complex logic in the app:
 *     - TARC restrictions
 *     - COD movement rules
 *     - Max courses per semester
 *     - HP prerequisites
 *     - Removing from future semesters
 *
 *   Moving all this away from index.js:
 *     - Keeps UI clean
 *     - Creates reusable, testable logic
 *
 * INPUT:
 *   {
 *     semesterSlots,
 *     setSemesterSlots,
 *     allCourses,
 *     user,
 *     currentSemester,
 *     syncPlanToServer,
 *     updateUserPlanInState,
 *     getStatus
 *   }
 *
 * OUTPUT:
 *   {
 *     editModalVisible,
 *     modalCourses,
 *     modalContext,
 *     openAddCourseModal,
 *     openReplaceCourseModal,
 *     handleCourseSelected,
 *     handleRemoveCourse,
 *     closeEditModal,
 *   }
 *
 * USED BY:
 *   - CoursePlanner/index.js
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/usePlannerModals.js
import { useState } from "react";

import {
  validateAddCourse,
  validateCourseForSemester,
} from "../../../engine/engine";

import { reinsertRemovedCourse } from "../../../engine/removeEngine";

export default function usePlannerModals({
  semesterSlots,
  setSemesterSlots,
  allCourses,
  user,
  currentSemester,
  syncPlanToServer,
  updateUserPlanInState,
  getStatus,
}) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);

  /* ---------------------------------------------------------------
     PERMISSIONS
  ----------------------------------------------------------------*/
  const canModify = (index, slot) => {
    const status = getStatus(index);
    if (slot.isTarc) return false;
    return status === "current" || status === "recommended";
  };

  const canRemove = (index, slot) => {
    const status = getStatus(index);
    if (slot.isTarc) return false;
    return status === "current" || status === "recommended";
  };

  /* ---------------------------------------------------------------
     OPEN MODALS
  ----------------------------------------------------------------*/
  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    if (!slot || !canModify(semesterIndex, slot)) return;

    const usedCodes = new Set((slot.courses || []).map((c) => c.code));

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({
      mode: "add",
      semesterIndex,
      status: getStatus(semesterIndex),
      isTarc: slot.isTarc,
    });
    setEditModalVisible(true);
  };

  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];
    if (!slot || !canModify(semesterIndex, slot)) return;

    const usedCodes = new Set(
      (slot.courses || []).map((c, i) => (i === courseIndex ? null : c.code))
    );

    const selectable = allCourses.filter(
      (c) => c.code === "COD" || !usedCodes.has(c.code)
    );

    setModalCourses(selectable);
    setModalContext({
      mode: "replace",
      semesterIndex,
      courseIndex,
      status: getStatus(semesterIndex),
      isTarc: slot.isTarc,
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  /* ---------------------------------------------------------------
     REMOVE COURSE
  ----------------------------------------------------------------*/
  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];

    if (!slot || !canRemove(semesterIndex, slot)) return;

    setSemesterSlots((prev) => {
      // deep clone to avoid mutating prev
      const slots = prev.map((s) => ({
        ...s,
        courses: Array.isArray(s.courses)
          ? s.courses.map((c) => ({ ...c }))
          : [],
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

  /* ---------------------------------------------------------------
     ADD / REPLACE COURSE (SELECTION)
  ----------------------------------------------------------------*/
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;

    const isCod = course.code === "COD";

    // ---------- VALIDATE ADD ----------
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

    // ---------- VALIDATE REPLACE ----------
    if (mode === "replace") {
      const result = validateCourseForSemester({
        semesterIndex,
        course,
        semesterSlots,
        currentSemester,
        completedCourses: user.completedCourses || [],
        maxCoursesPerSemester: 5,
        maxCodAllowed: 5,
        mode: "replace",
      });

      if (!result.ok) {
        alert(result.reason || "You cannot place this course here.");
        return;
      }
    }

    // ---------- MUTATE PLAN ----------
    setSemesterSlots((prev) => {
      const slots = prev.map((s) => ({
        ...s,
        courses: Array.isArray(s.courses)
          ? s.courses.map((c) => ({ ...c }))
          : [],
      }));

      const targetSlot = slots[semesterIndex];
      if (!targetSlot) return prev;

      if (mode === "add") {
        if (isCod) {
          // COD rules: max 5 courses, max 1 COD per semester, move COD from future if exists
          if ((targetSlot.courses || []).length >= 5) return prev;

          const hasCOD = (targetSlot.courses || []).some(
            (c) => c.code === "COD"
          );
          if (hasCOD) return prev;

          let futureIndex = -1;
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            if ((slots[i].courses || []).some((c) => c.code === "COD")) {
              futureIndex = i;
              break;
            }
          }

          let codToInsert = course;
          if (futureIndex !== -1) {
            const pos = slots[futureIndex].courses.findIndex(
              (c) => c.code === "COD"
            );
            codToInsert = slots[futureIndex].courses[pos];
            slots[futureIndex].courses.splice(pos, 1);
          }

          targetSlot.courses.push(codToInsert);
        } else {
          if ((targetSlot.courses || []).length >= 5) return prev;
          targetSlot.courses.push(course);

          // remove this course from future non-TARC semesters
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            if (!slots[i].isTarc) {
              slots[i].courses = slots[i].courses.filter(
                (c) => c.code !== course.code
              );
            }
          }
        }
      } else if (mode === "replace") {
        const updated = [...targetSlot.courses];
        updated[courseIndex] = course;
        targetSlot.courses = updated;

        if (!isCod) {
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            if (!slots[i].isTarc) {
              slots[i].courses = slots[i].courses.filter(
                (c) => c.code !== course.code
              );
            }
          }
        }
      }

      syncPlanToServer(slots);
      updateUserPlanInState(slots);
      return slots;
    });

    closeEditModal();
  };

  return {
    editModalVisible,
    modalCourses,
    modalContext,
    openAddCourseModal,
    openReplaceCourseModal,
    handleCourseSelected,
    handleRemoveCourse,
    closeEditModal,
  };
}
