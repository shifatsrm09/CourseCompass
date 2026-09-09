import { useMemo } from "react";
import "../styles/dashboard.css";
import CoursePlanner from "./Planner/CoursePlanner";
import streamsConfig from "../data/streamsConfig";
import { buildCurriculum } from "../engine/plannerState.mjs";

export default function Dashboard({ user, setUser, onLogout }) {
  const curriculum = useMemo(() => {
    const stream = streamsConfig[user.stream];
    return stream ? buildCurriculum(stream.plan, user.stream) : null;
  }, [user.stream]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Welcome, {user.studentId}</h2>
          <p className="dashboard-subtitle">Stream: {user.stream}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
      {curriculum ? (
        <CoursePlanner
          key={`${user.studentId}:${user.stream}`}
          user={user}
          setUser={setUser}
          curriculum={curriculum}
        />
      ) : (
        <p role="alert">The curriculum for your saved stream is unavailable. Your saved plan has been preserved.</p>
      )}
    </div>
  );
}
