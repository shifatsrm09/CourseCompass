import React, { useState, useEffect } from "react";
import "../../styles/planner.css";
import thesisPlan from "../../data/thesisPlan.json";

import streamsConfig, {
  DEFAULT_STREAM_ID,
} from "../../data/streamsConfig";

import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

import { validateAddCourse } from "../../engine/engine";
import { reinsertRemovedCourse } from "../../engine/removeEngine";
import { balanceFutureSemesters } from "../../engine/balanceEngine";

const API_BASE = process.env.REACT_APP_API_URL;

/* ------------------------------------------------------------------
   STREAM SUPPORT HELPERS
-------------------------------------------------------------------*/

const getBasePlanForStream = (streamId) => {
  const id = streamsConfig[streamId] ? streamId : DEFAULT_STREAM_ID;
  // This is your flat JSON array: [{code, title, semester_row, type, hp, sp, is_tarc?}, ...]
  return streamsConfig[id].plan;
};

/**
 * Build planner slots from flat JSON:
 *    [{ code, semester_row, hp, sp, is_tarc? }, ...]
 */
const buildSlotsFromFlatPlan = (flat = []) => {
  const bySemester = {};

  flat.forEach((course) => {
    const sem = course.semester_row;
    if (sem == null) return;
    if (!bySemester[sem]) bySemester[sem] = [];
    bySemester[sem].push({ ...course }); // clone
  });

  return Object.keys(bySemester)
    .sort((a, b) => Number(a) - Number(b))
    .map((semStr) => {
      const sem = Number(semStr);
      const semesterCourses = bySemester[sem].map((c) => ({ ...c }));
      const thesis = thesisPlan.find((t) => t.semester_row === sem) || null;

      return {
        id: `sem-${sem}`,
        originalRow: sem,
        courses: semesterCourses,
        isTarc: semesterCourses.some((c) => c.is_tarc),
        thesis,
      };
    });
};

/**
 * Build slots from customPlan + allCourses.
 * customPlan: [{ semester, courses: ["CSE110","MAT110",...] }, ...]
 * allCourses: full list of course objects (same shape as your JSON).
 *
 * Returns { slots, matchRatio } where matchRatio = how many codes we
 * successfully resolved to actual course objects.
 */
const buildSlotsFromCustomPlan = (customPlan = [], allCourses = []) => {
  if (!Array.isArray(customPlan) || !Array.isArray(allCourses)) {
    return { slots: [], matchRatio: 0 };
  }

  let totalRequested = 0;
  let totalMatched = 0;

  const slots = customPlan.map((p) => {
    const desiredCodes = Array.isArray(p.courses) ? p.courses : [];
    totalRequested += desiredCodes.length;

    const rowCourses = allCourses.filter((c) => desiredCodes.includes(c.code));
    totalMatched += rowCourses.length;

    const deepCourses = rowCourses.map((c) => ({ ...c }));
    const thesis = thesisPlan.find((t) => t.semester_row === p.semester) || null;

    return {
      id: `sem-${p.semester}`,
      originalRow: p.semester,
      courses: deepCourses,
      isTarc: deepCourses.some((c) => c.is_tarc),
      thesis,
    };
  });

  const matchRatio =
    totalRequested === 0 ? 1 : totalMatched / totalRequested;

  return { slots, matchRatio };
};

/* ------------------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------------------*/

export default function CoursePlanner({
  user,
  setUser,
  orderedCourses, // currently unused
  currentSemester,
  setCurrentSemester,
  allCourses = [], // flat list of course objects for the selected stream
}) {
  const [showModal, setShowModal] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);

  /* ----------------------------------------------------------------
     INITIAL SEMESTER SLOTS
  -----------------------------------------------------------------*/
  const [semesterSlots, setSemesterSlots] = useState(() => {
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      const flat = getBasePlanForStream(user.stream);
      return buildSlotsFromFlatPlan(flat);
    }

    if (!Array.isArray(allCourses) || allCourses.length === 0) {
      // We'll hydrate from customPlan in useEffect once allCourses arrives
      return [];
    }

    const { slots, matchRatio } = buildSlotsFromCustomPlan(
      user.customPlan,
      allCourses
    );

    if (matchRatio < 0.5) {
      // Custom plan seems mismatched → fallback to stream default
      const flat = getBasePlanForStream(user.stream);
      return buildSlotsFromFlatPlan(flat);
    }

    return slots;
  });

  /* ----------------------------------------------------------------
     HYDRATE WHEN customPlan / allCourses / stream CHANGE
  -----------------------------------------------------------------*/
  useEffect(() => {
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) return;
    if (!Array.isArray(allCourses) || allCourses.length === 0) return;

    const { slots, matchRatio } = buildSlotsFromCustomPlan(
      user.customPlan,
      allCourses
    );

    if (matchRatio < 0.5) {
      const flat = getBasePlanForStream(user.stream);
      setSemesterSlots(buildSlotsFromFlatPlan(flat));
      return;
    }

    setSemesterSlots(slots);
  }, [user.customPlan, allCourses, user.stream]);

  /* ----------------------------------------------------------------
     STREAM SWITCH:
     - If user has NO customPlan → reload default for new stream.
     - If user DOES have customPlan → keep as-is (user may expect it).
  -----------------------------------------------------------------*/
  useEffect(() => {
    if (!user.stream) return;

    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      const flat = getBasePlanForStream(user.stream);
      setSemesterSlots(buildSlotsFromFlatPlan(flat));
    }
  }, [user.stream, user.customPlan]);

  /* ----------------------------------------------------------------
     SEMESTER STATUS
  -----------------------------------------------------------------*/
  const getStatus = (index) => {
    const safe = currentSemester || 1;

    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  /* ----------------------------------------------------------------
     SYNC HELPERS
  -----------------------------------------------------------------*/
  const buildPlanFromSlots = (slots) =>
    slots.map((slot) => ({
      semester: slot.originalRow,
      courses: (slot.courses || []).map((c) => c.code),
    }));

  const updateUserPlanInState = (slots) => {
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

      const codCount = plan.reduce(
        (acc, sem) =>
          acc + sem.courses.filter((code) => code === "COD").length,
        0
      );

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
    }
  };

  /* ----------------------------------------------------------------
     AUTO BALANCE
  -----------------------------------------------------------------*/
  const handleBalance = () => {
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

  /* ----------------------------------------------------------------
     MARK SEMESTER COMPLETE
  -----------------------------------------------------------------*/
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

  /* ----------------------------------------------------------------
     PERMISSIONS
  -----------------------------------------------------------------*/
  const canModify = (index, slot) => {
    const status = getStatus(index);
    if (slot.isTarc) return false; // TARC immutable
    return status === "current" || status === "recommended";
  };

  const canRemove = (index, slot) => {
    const status = getStatus(index);
    if (slot.isTarc) return false;
    return status === "current" || status === "recommended";
  };

  /* ----------------------------------------------------------------
     OPEN ADD MODAL
  -----------------------------------------------------------------*/
  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;

    if (!canModify(semesterIndex, slot)) return;

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

  /* ----------------------------------------------------------------
     OPEN REPLACE MODAL
  -----------------------------------------------------------------*/
  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;

    if (!canModify(semesterIndex, slot)) return;

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

  /* ----------------------------------------------------------------
     REMOVE COURSE
  -----------------------------------------------------------------*/
  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;
    if (!canRemove(semesterIndex, slot)) return;

    setSemesterSlots((prev) => {
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

  /* ----------------------------------------------------------------
     ADD / REPLACE APPLY
  -----------------------------------------------------------------*/
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;

    const isCod = course.code === "COD";

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
          if ((targetSlot.courses || []).length >= 5) return prev;
          const alreadyHasCod = (targetSlot.courses || []).some(
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
          if ((targetSlot.courses || []).length >= 5) return prev;
          targetSlot.courses.push(course);

          // Remove duplicates in future semesters, but DON'T touch TARC slots
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            const s = slots[i];
            if (!s || !Array.isArray(s.courses)) continue;
            if (s.isTarc) continue;
            s.courses = s.courses.filter((c) => c.code !== course.code);
          }
        }
      } else if (mode === "replace") {
        const slotToEdit = slots[semesterIndex];
        if (!slotToEdit) return prev;

        const newCourses = [...slotToEdit.courses];
        newCourses[courseIndex] = course;
        slotToEdit.courses = newCourses;

        if (!isCod) {
          for (let i = semesterIndex + 1; i < slots.length; i++) {
            const s = slots[i];
            if (!s || !Array.isArray(s.courses)) continue;
            if (s.isTarc) continue;
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

  /* ----------------------------------------------------------------
     CLOSE EDIT MODAL
  -----------------------------------------------------------------*/
  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  /* ----------------------------------------------------------------
     RENDER
  -----------------------------------------------------------------*/
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
