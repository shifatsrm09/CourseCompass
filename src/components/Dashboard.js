import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./CoursePlanner";

export default function Dashboard({ user, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);

  useEffect(() => {
    loadStreamCourses(user.stream);
  }, [user.stream]);

  function loadStreamCourses(stream) {
    let fileName = "";

    if (stream === "ENG101 + MAT110") fileName = "ENG101-MAT110.json";
    else if (stream === "ENG101 + MAT092") fileName = "ENG101-MAT092.json";
    else if (stream === "ENG102 + MAT110") fileName = "ENG102-MAT110.json";
    else if (stream === "ENG102 + MAT092") fileName = "ENG102-MAT092.json";
    else if (stream === "ENG091 + MAT110") fileName = "ENG091-MAT110.json";
    else if (stream === "ENG091 + MAT092") fileName = "ENG091-MAT092.json";
    else {
      setError("Invalid stream stored in database");
      return;
    }

    import(`../data/${fileName}`)
      .then((json) => {
        setCourses(json.default);
        setError(null);
      })
      .catch(() => {
        setCourses(null);
        setError("This stream is not configured yet.");
      });
  }

  // APPLY SAVED ORDER ONCE COURSES LOAD
  useEffect(() => {
    if (!courses) return;

    const order = user.semesterOrder || [1, 2, 3, 4, 5, 6];

    const grouped = {};
    courses.forEach((c) => {
      if (!grouped[c.semester_row]) grouped[c.semester_row] = [];
      grouped[c.semester_row].push(c);
    });

    const reordered = order.map((row) => ({
      semester_row: row,
      courses: grouped[row] || []
    }));

    setOrderedCourses(reordered);
  }, [courses, user]);

  return (
    <div className="dashboard-container">

      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Welcome, {user.studentId}</h2>
          <p className="dashboard-subtitle">Stream: {user.stream}</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {error && (
        <div className="not-configured">
          <h3>{error}</h3>
          <p>Your selected stream has no course plan yet.</p>
        </div>
      )}

      {!error && orderedCourses && (
        <CoursePlanner
          user={user}
          orderedCourses={orderedCourses}
          currentSemester={1}
        />
      )}
    </div>
  );
}
