import { useEffect, useState } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./Planner/CoursePlanner";

export default function Dashboard({ user, setUser, onLogout }) {
  const [courses, setCourses] = useState(null);
  const [orderedCourses, setOrderedCourses] = useState(null);
  const [allCourses, setAllCourses] = useState([]);




  useEffect(() => {
    if (!user.stream) return;

    import(`../data/ENG101-MAT110.json`)
      .then((json) => {
        const streamCourses = json.default;

        setCourses(streamCourses);


        const byCode = {};
        streamCourses.forEach((c) => {
          if (!byCode[c.code]) byCode[c.code] = c;
        });


        const list = Object.values(byCode);
        const cod = list.find((c) => c.code === "COD");
        const others = list.filter((c) => c.code !== "COD");

        setAllCourses(cod ? [cod, ...others] : others);
      })
      .catch(() => console.error("STREAM JSON IS MISSING"));
  }, [user.stream]);






  useEffect(() => {
    if (!courses) return;


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


    const planFromDB = user.customPlan;


    const byCode = {};
    allCourses.forEach((course) => {
      byCode[course.code] = course;
    });


    const rebuilt = planFromDB.map((sem) => ({
      semester_row: sem.semester,
      courses: sem.courses
        .map((code) => byCode[code])
        .filter(Boolean),
    }));

    setOrderedCourses(rebuilt);
  }, [courses, user, allCourses]);




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
