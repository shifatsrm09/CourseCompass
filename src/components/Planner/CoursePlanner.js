import React, { useState, useEffect } from "react";
import "../../styles/planner.css";
import thesisPlan from "../../data/thesisPlan.json";

// 🔵 STREAM SUPPORT
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

// 🔵 STREAM SUPPORT: helper
const getBasePlanForStream = (streamId) => {
  const id = streamsConfig[streamId] ? streamId : DEFAULT_STREAM_ID;
  return streamsConfig[id].plan; // JSON course layout
};

export default function CoursePlanner({
  user,
  setUser,
  orderedCourses, // IGNORE this old prop if switching to stream-based plan
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  const [showModal, setShowModal] = useState(false);

  /* 
  -----------------------------------------------------------
  INITIAL PLAN LOADING (from stream or DB)
  ----------------------------------------------------------- 
  🔵 STREAM SUPPORT:
  1. If DB customPlan exists → restore it.
  2. Else → load stream-specific default JSON plan.
  */

/* 
-----------------------------------------------------------
INITIAL PLAN LOADING (from stream or DB)
----------------------------------------------------------- 
🔵 STREAM SUPPORT (FLAT JSON FORMAT):
1. Stream JSON is a flat list of course objects.
2. We group them by semester_row dynamically.
*/

// Convert flat JSON stream → grouped semester blocks
const loadDefaultStreamPlan = () => {
  const flat = getBasePlanForStream(user.stream); 
  // flat = [{ code, title, semester_row, hp, sp, ... }, ...]

  const bySemester = {};

  // group courses by semester_row
  flat.forEach((course) => {
    const sem = course.semester_row;
    if (!bySemester[sem]) bySemester[sem] = [];
    bySemester[sem].push(course);
  });

  // build planner-compatible structure
  return Object.keys(bySemester)
    .sort((a, b) => Number(a) - Number(b))
    .map((sem) => {
      const semesterCourses = bySemester[sem];

      const thesis = thesisPlan.find(
        (t) => t.semester_row === Number(sem)
      );

      return {
        id: `sem-${sem}`,
        originalRow: Number(sem),
        courses: semesterCourses,
        isTarc: semesterCourses.some((c) => c.is_tarc),
        thesis: thesis || null,
      };
    });
};

// INITIALIZE SEMESTER SLOTS -------------------------
const [semesterSlots, setSemesterSlots] = useState(() => {
  // CASE 1 — No custom plan → load default stream layout
  if (!user.customPlan || !Array.isArray(user.customPlan)) {
    return loadDefaultStreamPlan();
  }

  // CASE 2 — Hydrate from DB customPlan
  return user.customPlan.map((p) => {
    const rowCourses = allCourses.filter((c) =>
      (p.courses || []).includes(c.code)
    );

    const thesis = thesisPlan.find(
      (t) => t.semester_row === p.semester
    );

    return {
      id: `sem-${p.semester}`,
      originalRow: p.semester,
      courses: rowCourses,
      isTarc: rowCourses.some((c) => c.is_tarc),
      thesis: thesis || null,
    };
  });
});


  /* 
  -----------------------------------------------------------
  HYDRATE FROM DB WHEN USER.customPlan ARRIVES LATER
  ----------------------------------------------------------- 
  */
  useEffect(() => {
    if (!user.customPlan || !Array.isArray(user.customPlan)) return;
    if (!Array.isArray(allCourses) || allCourses.length === 0) return;

    const restored = user.customPlan.map((p) => {
      const rowCourses = allCourses.filter((c) =>
        (p.courses || []).includes(c.code)
      );

      const thesis = thesisPlan.find(
        (t) => t.semester_row === p.semester
      );

      return {
        id: `sem-${p.semester}`,
        originalRow: p.semester,
        courses: rowCourses,
        isTarc: rowCourses.some((c) => c.is_tarc),
        thesis: thesis || null,
      };
    });

    setSemesterSlots(restored);
  }, [user.customPlan, allCourses]);

  /* 
  -----------------------------------------------------------
  RELOAD PLAN IF STREAM CHANGES
  ----------------------------------------------------------- 
  🔵 STREAM SUPPORT:
  Very important: When user chooses a different stream,
  planner resets to the new stream’s default unless they
  already have a custom plan.
  */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user.stream) return;

    // If user has already edited → never overwrite customPlan
    if (user.customPlan && user.customPlan.length > 0) return;

    // Otherwise: load NEW stream's default
    setSemesterSlots(loadDefaultStreamPlan());
  }, [user.stream]);

  /* ---------------------------------------------------- */
  /* SEMESTER STATUS HELPERS                              */
  /* ---------------------------------------------------- */
  const getStatus = (index) => {
    const safe = currentSemester || 1;

    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  /* ---------------------------------------------------- */
  /* SYNC HELPERS: SAVE PLAN LOCALLY & SERVER             */
  /* ---------------------------------------------------- */

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

  /* ---------------------------------------------------- */
  /* AUTO BALANCE                                         */
  /* ---------------------------------------------------- */

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

  /* ---------------------------------------------------- */
  /* MARK SEMESTER COMPLETE                               */
  /* ---------------------------------------------------- */
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

  /* ---------------------------------------------------- */
  /* MODIFY PERMISSIONS                                   */
  /* ---------------------------------------------------- */
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

  /* ---------------------------------------------------- */
  /* ADD / REPLACE COURSE                                 */
  /* ---------------------------------------------------- */

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);

  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];
    const status = getStatus(semesterIndex);

    if (!canModify(semesterIndex, slot)) return;

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

  /* ---------------------------------------------------- */
  /* REMOVE COURSE                                         */
  /* ---------------------------------------------------- */

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

  /* ---------------------------------------------------- */
  /* ADD / REPLACE APPLY                                  */
  /* ---------------------------------------------------- */

  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    const isCod = course.code === "COD";

    if (slot.isTarc && slot.courses.length >= 4) return;

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
          if (targetSlot.courses.length >= 5) return prev;
          targetSlot.courses.push(course);

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

  /* ---------------------------------------------------- */
  /* RENDER                                               */
  /* ---------------------------------------------------- */
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
