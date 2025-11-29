import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./CoursePlanner";

export default function Dashboard({ user, setUser, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStreamCourses(user.stream);
  }, [user.stream]);

  function loadStreamCourses(stream) {
    const files = {
      "ENG101 + MAT110": "ENG101-MAT110.json",
      "ENG101 + MAT092": "ENG101-MAT092.json",
      "ENG102 + MAT110": "ENG102-MAT110.json",
      "ENG102 + MAT092": "ENG102-MAT092.json",
      "ENG091 + MAT110": "ENG091-MAT110.json",
      "ENG091 + MAT092": "ENG091-MAT092.json",
    };

    const fileName = files[stream];

    if (!fileName) {
      setError("Invalid stream stored in database");
      return;
    }

    import(`../data/${fileName}`)
      .then((json) => {
        const streamCourses = json.default;
        setCourses(streamCourses);
        setError(null);

        // build unique course list by code for the add/replace modal
        const byCode = {};
        streamCourses.forEach((c) => {
          if (!byCode[c.code]) {
            byCode[c.code] = c;
          }
        });
        setAllCourses(Object.values(byCode));
      })
      .catch(() => {
        setCourses(null);
        setAllCourses([]);
        setError("This stream is not configured yet.");
      });
  }

  useEffect(() => {
    if (!courses) return;

    const order = user.semesterOrder || [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ];

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

  // store updated user state and persist it
  const setCurrentSemester = (newVal, updatedUser = null) => {
    const userToStore = updatedUser || { ...user, currentSemester: newVal };

    setUser(userToStore);

    localStorage.setItem(
      "courseCompassUser",
      JSON.stringify({ user: userToStore })
    );
  };

  const safeCurrent = user.currentSemester || 1;

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

      {error && (
        <div className="not-configured">
          <h3>{error}</h3>
          <p>Your selected stream has no course plan.</p>
        </div>
      )}

      {!error && orderedCourses && (
        <CoursePlanner
          user={user}
          orderedCourses={orderedCourses}
          currentSemester={safeCurrent}
          setCurrentSemester={setCurrentSemester}
          allCourses={allCourses}
        />
      )}
    </div>
  );
}
