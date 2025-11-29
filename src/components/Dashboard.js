import "../styles/card.css";
import courses from "../data/ENG101-MAT110.json";
import CoursePlanner from "./CoursePlanner";


export default function Dashboard({ user, onLogout }) {
    return (
      <div className="dashboard">
        <h2>Welcome, {user.studentId}</h2>
        <p>Stream: {user.stream}</p>

        <CoursePlanner 
          courses={courses} 
          currentSemester={1} 
        />
      </div>
    );

}
