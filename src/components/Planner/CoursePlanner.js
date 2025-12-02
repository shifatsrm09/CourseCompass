// src/components/Planner/CoursePlanner.js
import React, { useState, useEffect } from "react";
import "../../styles/planner.css";
import thesisPlan from "../../data/thesisPlan.json";

import streamsConfig, {
  DEFAULT_STREAM_ID,
} from "../../data/streamsConfig";

import ConfirmModal from "./ConfirmModal";
import CourseEditModal from "./CourseEditModal";
import SemesterList from "./SemesterList";

import {
  validateAddCourse,
  validateCourseForSemester,   // ✅ NEW IMPORT
} from "../../engine/engine";

import { reinsertRemovedCourse } from "../../engine/removeEngine";
import { balanceFutureSemesters } from "../../engine/balanceEngine";

const API_BASE = process.env.REACT_APP_API_URL;

/* ------------------------------------------------------------------
   STREAM SUPPORT HELPERS
-------------------------------------------------------------------*/

const getBasePlanForStream = (streamId) => {
  const id = streamsConfig[streamId] ? streamId : DEFAULT_STREAM_ID;
  return streamsConfig[id].plan;
};

/* Group flat JSON into semester slots */
const buildSlotsFromFlatPlan = (flat = []) => {
  const bySemester = {};

  flat.forEach((course) => {
    const sem = course.semester_row;
    if (sem == null) return;
    if (!bySemester[sem]) bySemester[sem] = [];
    bySemester[sem].push({ ...course });
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

/* Build slots from customPlan + allCourses */
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
  orderedCourses,
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  const [showModal, setShowModal] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);

  /* ----------------------------------------------------------------
     INITIAL LOAD
  -----------------------------------------------------------------*/
  const [semesterSlots, setSemesterSlots] = useState(() => {
    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      return buildSlotsFromFlatPlan(getBasePlanForStream(user.stream));
    }

    if (!Array.isArray(allCourses) || allCourses.length === 0) {
      return [];
    }

    const { slots, matchRatio } = buildSlotsFromCustomPlan(
      user.customPlan,
      allCourses
    );

    if (matchRatio < 0.5) {
      return buildSlotsFromFlatPlan(getBasePlanForStream(user.stream));
    }

    return slots;
  });

  /* ----------------------------------------------------------------
     HYDRATE WHEN customPlan/allCourses/stream CHANGES
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
      setSemesterSlots(buildSlotsFromFlatPlan(getBasePlanForStream(user.stream)));
      return;
    }

    setSemesterSlots(slots);
  }, [user.customPlan, allCourses, user.stream]);

  /* ----------------------------------------------------------------
     STREAM SWITCH
  -----------------------------------------------------------------*/
  useEffect(() => {
    if (!user.stream) return;

    const hasCustom =
      Array.isArray(user.customPlan) && user.customPlan.length > 0;

    if (!hasCustom) {
      setSemesterSlots(buildSlotsFromFlatPlan(getBasePlanForStream(user.stream)));
    }
  }, [user.stream, user.customPlan]);

  /* ----------------------------------------------------------------
     STATUS
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

    localStorage.setItem(
      "courseCompassUser",
      JSON.stringify({ user: updatedUser })
    );
  };

  const syncPlanToServer = async (slots) => {
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
  };

  /* ----------------------------------------------------------------
     AUTO BALANCE
  -----------------------------------------------------------------*/
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
      });

      syncPlanToServer(balanced);
      updateUserPlanInState(balanced);
      return balanced;
    });
  };

  /* ----------------------------------------------------------------
     COMPLETE SEMESTER
  -----------------------------------------------------------------*/
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

  /* ----------------------------------------------------------------
     MODIFICATION RULES
  -----------------------------------------------------------------*/
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

  /* ----------------------------------------------------------------
     MODALS (ADD / REPLACE / REMOVE)
  -----------------------------------------------------------------*/

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

  const handleRemoveCourse = () => {
    if (!modalContext) return;

    const { semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];

    if (!slot || !canRemove(semesterIndex, slot)) return;

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
     ADD / REPLACE (SELECTION APPLY)
  -----------------------------------------------------------------*/
  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;
    const slot = semesterSlots[semesterIndex];
    if (!slot) return;

    const isCod = course.code === "COD";

    // ---------------------------------------------
    // VALIDATE ADD
    // ---------------------------------------------
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

    // ---------------------------------------------
    // ✅ NEW: VALIDATE REPLACE (HP + COD + rules)
    // ---------------------------------------------
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

    // ---------------------------------------------
    // MUTATE PLAN
    // ---------------------------------------------
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

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  /* ----------------------------------------------------------------
     COURSE COUNTER DEBUGGER (NEW)
  -----------------------------------------------------------------*/

  const totalCoursesDisplayed = semesterSlots.reduce(
    (sum, sem) => sum + (sem.courses?.length || 0),
    0
  );

  const expectedCount =
    streamsConfig[user.stream]?.expectedCount ??
    streamsConfig[DEFAULT_STREAM_ID].expectedCount;

  /* ----------------------------------------------------------------
     RENDER
  -----------------------------------------------------------------*/
  return (
    <div className="planner-container dark-container">
      <h2 className="planner-title">Course Planner</h2>

      {/* ----------------------------------------------- */}
      {/* COURSE COUNTER BLOCK (NEW) */}
      {/* ----------------------------------------------- */}
      <div
        style={{
          marginBottom: "12px",
          background: "#222",
          padding: "8px 12px",
          display: "inline-block",
          borderRadius: "6px",
          fontWeight: 600,
          fontSize: "14px",
          color: "#ddd",
        }}
      >
        Total Courses:{" "}
        <span
          style={{
            color:
              totalCoursesDisplayed === expectedCount
                ? "#4ade80"
                : "#f87171",
          }}
        >
          {totalCoursesDisplayed}
        </span>{" "}
        / {expectedCount}
      </div>{" "}
      Total : 45 (Thesis)

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
