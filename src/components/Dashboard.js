/**
 * ---------------------------------------------------------------------
 * Dashboard.js
 * ---------------------------------------------------------------------
 * PURPOSE:
 *  The main entry point after login. Loads course data, builds the
 *  user's academic context, and renders the CoursePlanner component.
 *
 * RESPONSIBILITY:
 *  - Loads stream JSON dynamically based on user.stream.
 *  - Builds the full course list (allCourses) with COD at the top.
 *  - Builds orderedCourses:
 *       › Default BRAC plan (no custom plan)
 *       › Or reconstructed plan from DB (customPlan exists)
 *  - Stores the updated user object into localStorage.
 *  - Renders CoursePlanner with prepared data.
 *
 * HOW IT FITS INTO COURSE COMPASS:
 *  Dashboard is the “root screen” of the planner area.
 *  It prepares and normalizes all data before feeding it into the planner.
 *
 * MAIN JOBS:
 *  1) Load stream course JSON (ENG101-MAT110.json initially)
 *  2) Build unique course list
 *  3) Build semester → course mapping
 *  4) Manage user.currentSemester updates
 *  5) Render CoursePlanner with all required props
 *
 * PROPS:
 *  - user          → logged in student data
 *  - setUser       → update user state
 *  - onLogout      → sign out
 *
 * USED BY:
 *  - App.js (Top-level router)
 * ---------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./Planner/CoursePlanner";

export default function Dashboard({ user, setUser, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);
  const [allCourses, setAllCourses] = useState([]);

  /* ──────────────────────────────────────────────
     LOAD STREAM JSON
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user.stream) return;

    import(`../data/ENG101-MAT110.json`)
      .then((json) => {
        const streamCourses = json.default;

        setCourses(streamCourses);

        // Build unique course list — first appearance wins
        const byCode = {};
        streamCourses.forEach((c) => {
          if (!byCode[c.code]) byCode[c.code] = c;
        });

        // Make COD appear FIRST
        const list = Object.values(byCode);
        const cod = list.find((c) => c.code === "COD");
        const others = list.filter((c) => c.code !== "COD");

        setAllCourses(cod ? [cod, ...others] : others);
      })
      .catch(() => console.error("STREAM JSON IS MISSING"));
  }, [user.stream]);

  /* ──────────────────────────────────────────────
     LOAD ORDERED PLAN
     1) If user.customPlan == null → use default JSON
     2) If user.customPlan != null → convert DB plan to UI plan
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!courses) return;

    // CASE 1: No custom plan → use default JSON-based plan
    if (!user.customPlan) {
      const order =
        user.semesterOrder || [1,2,3,4,5,6,7,8,9,10,11,12];

      const grouped = {};
      courses.forEach((c) => {
        if (!grouped[c.semester_row]) grouped[c.semester_row] = [];
        grouped[c.semester_row].push(c);
      });

      setOrderedCourses(
        order.map((row) => ({
          semester_row: row,
          courses: grouped[row] || [],
        }))
      );

      return;
    }

    // CASE 2: customPlan exists → reconstruct planner from DB
    const planFromDB = user.customPlan;  // [{ semester, courses:[codes] }]

    // map codes → course objects (lookup from allCourses)
    const byCode = {};
    allCourses.forEach((course) => {
      byCode[course.code] = course;
    });

    // Convert DB plan → UI format
    const rebuilt = planFromDB.map((sem) => ({
      semester_row: sem.semester,
      courses: sem.courses
        .map((code) => byCode[code])
        .filter(Boolean), // remove missing ones
    }));

    setOrderedCourses(rebuilt);
  }, [courses, user, allCourses]);

  /* ──────────────────────────────────────────────
     UPDATE CURRENT SEMESTER LOCALLY
  ─────────────────────────────────────────────── */
  const setCurrentSemester = (newVal, updatedUser = null) => {
    const userToStore = updatedUser || { ...user, currentSemester: newVal };

    setUser(userToStore);
    localStorage.setItem(
      "courseCompassUser",
      JSON.stringify({ user: userToStore })
    );
  };

  const safeCurrent = user.currentSemester || 1;

  if (!orderedCourses) return null;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Welcome, {user.studentId}</h2>
          <p className="dashboard-subtitle">Stream: {user.stream}</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

      <CoursePlanner
        user={user}
        setUser = {setUser}
        orderedCourses={orderedCourses}
        currentSemester={safeCurrent}
        setCurrentSemester={setCurrentSemester}
        allCourses={allCourses}
      />
    </div>
  );
}
