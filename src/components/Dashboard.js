import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./CoursePlanner";

export default function Dashboard({ user, setUser, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);
  const [allCourses, setAllCourses] = useState([]);

  useEffect(() => {
    if (!user.stream) return;

    // We assume stream is ALWAYS valid because StreamSelect ensured that
    import(`../data/ENG101-MAT110.json`)
      .then((json) => {
        const streamCourses = json.default;

        setCourses(streamCourses);

        // build unique course list for modal
        const byCode = {};
        streamCourses.forEach((c) => {
          if (!byCode[c.code]) byCode[c.code] = c;
        });

        setAllCourses(Object.values(byCode));
      })
      .catch(() => {
        console.error("STREAM JSON IS MISSING");
      });
  }, [user.stream]);

  // Reorder semesters based on user order (if exists)
  useEffect(() => {
    if (!courses) return;

    const order =
      user.semesterOrder || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const grouped = {};
    courses.forEach((c) => {
      if (!grouped[c.semester_row]) grouped[c.semester_row] = [];
      grouped[c.semester_row].push(c);
    });

    const reordered = order.map((row) => ({
      semester_row: row,
      courses: grouped[row] || [],
    }));

    setOrderedCourses(reordered);
  }, [courses, user]);

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
        orderedCourses={orderedCourses}
        currentSemester={safeCurrent}
        setCurrentSemester={setCurrentSemester}
        allCourses={allCourses}
      />
    </div>
  );
}
