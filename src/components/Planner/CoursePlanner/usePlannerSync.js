/**
 * =========================================================================
 * usePlannerSync.js
 * =========================================================================
 * PURPOSE:
 *   Handles all synchronization between the planner UI and:
 *     ✔ Local React state
 *     ✔ localStorage
 *     ✔ Server API endpoints
 *
 * RESPONSIBILITY:
 *   1. buildPlanFromSlots()
 *        → Converts UI slot structure back to raw plan
 *          [{ semester, courses:[codes...] }]
 *
 *   2. updateUserPlanInState()
 *        → Updates user.customPlan
 *        → Sets firstLogin = false
 *        → Saves updated user to React + localStorage
 *
 *   3. syncPlanToServer()
 *        → Posts updated plan to server:
 *            /planner/save-plan
 *          including:
 *            - Semester course lists
 *            - COD counts
 *            - Active semester’s course list
 *
 * WHY THIS FILE EXISTS:
 *   Planner edits happen frequently (add, replace, remove),
 *   and every edit must update:
 *     - Local state (immediate UI reaction)
 *     - Local storage (persistent session)
 *     - The server (persistent DB storage)
 *
 *   Centralizing these makes it simple and avoids duplicated code.
 *
 * INPUT:
 *   { user, setUser, currentSemester }
 *
 * OUTPUT:
 *   {
 *     updateUserPlanInState,
 *     syncPlanToServer
 *   }
 *
 * USED BY:
 *   - CoursePlanner/index.js
 *   - usePlannerModals.js
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/usePlannerSync.js
const API_BASE = process.env.REACT_APP_API_URL;

export default function usePlannerSync({
  user,
  setUser,
  currentSemester,
}) {
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
      (a, sem) => a + sem.courses.filter((code) => code === "COD").length,
      0
    );

    const currentRow = currentSemester || 1;
    const currentSlot = slots.find((s) => s.originalRow === currentRow);
    const currentCourses = currentSlot
      ? currentSlot.courses.map((c) => c.code)
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

  return { updateUserPlanInState, syncPlanToServer };
}
