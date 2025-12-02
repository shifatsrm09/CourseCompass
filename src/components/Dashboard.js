/**
 * ---------------------------------------------------------------------
 * Dashboard.js - MODERN MINIMALISTIC NAVBAR (COMPACT)
 * ---------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./Planner/CoursePlanner";

export default function Dashboard({ user, setUser, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* ──────────────────────────────────────────────
     LOAD STREAM JSON
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user.stream) return;

    setLoading(true);
    setError(false);

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
        setLoading(false);
      })
      .catch((err) => {
        console.error("STREAM JSON IS MISSING", err);
        setError(true);
        setLoading(false);
      });
  }, [user.stream]);

  /* ──────────────────────────────────────────────
     LOAD ORDERED PLAN
  ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!courses || loading) return;

    // CASE 1: No custom plan → use default JSON-based plan
    if (!user.customPlan || user.customPlan.length === 0) {
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
  }, [courses, user, allCourses, loading]);

  /* ──────────────────────────────────────────────
     UPDATE CURRENT SEMESTER LOCALLY
  ────────────────────────────────────────────── */
  const setCurrentSemester = (newVal, updatedUser = null) => {
    const userToStore = updatedUser || { ...user, currentSemester: newVal };

    setUser(userToStore);
    localStorage.setItem(
      "courseCompassUser",
      JSON.stringify({ user: userToStore })
    );
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      onLogout();
    }
  };

  const safeCurrent = user.currentSemester || 1;

  // Calculate total courses
  const totalCourses = orderedCourses ? 
    orderedCourses.reduce((sum, sem) => sum + (sem.courses?.length || 0), 0) : 0;

  // Expected courses count
  const expectedCourses = 44; // From streamsConfig

  // Loading state
  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Preparing your academic plan</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <p>Failed to load course data. Please refresh or contact support.</p>
        </div>
      </div>
    );
  }

  // Main render
  if (!orderedCourses) return null;

  return (
    <div className="dashboard-container">
      {/* MODERN MINIMALISTIC NAVBAR - COMPACT VERSION */}
      <nav className="modern-navbar">
        {/* LEFT: Brand & Student Info */}
        <div className="navbar-brand">
          <div className="brand-content">
            <h1 className="app-name">Course Compass</h1>
            <div className="student-info-compact">
              <span className="student-id">{user.studentId}</span>
              <span className="separator">•</span>
              <span className="stream-name">{user.stream}</span>
            </div>
          </div>
        </div>

        {/* CENTER: Progress Stats - Desktop Only */}
        <div className="navbar-stats desktop-only">
          <div className="progress-indicator">
            <div className="progress-numbers">
              <span className="current-count">{totalCourses}</span>
              <span className="divider">/</span>
              <span className="total-count">{expectedCourses}</span>
            </div>
            <div className="progress-label">Courses</div>
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="navbar-actions">
          {/* Mobile Stats - Show in Logout Button Area */}
          <div className="mobile-stats">
            <span className="mobile-count">{totalCourses}</span>
            <span className="mobile-divider">/</span>
            <span className="mobile-total">{expectedCourses}</span>
          </div>
          
          <button className="logout-btn" onClick={handleLogout}>
            <span className="logout-icon">↩</span>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </nav>

      {/* COURSE PLANNER */}
      <CoursePlanner
        user={user}
        setUser={setUser}
        orderedCourses={orderedCourses}
        currentSemester={safeCurrent}
        setCurrentSemester={setCurrentSemester}
        allCourses={allCourses}
      />
    </div>
  );
}