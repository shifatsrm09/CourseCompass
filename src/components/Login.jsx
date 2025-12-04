import { useState } from "react";
import "../styles/login.css";
import "../styles/card.css";

export default function Login({ onLogin }) {
  const [studentId, setStudentId] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      }
    );

    const data = await response.json();
    onLogin(data, studentId);
  };

  return (
    <div className="login-wrapper center">
      <div className="card">
        <h2 className="login-title">Course Compass</h2>
        <p className="login-subtitle">
          Smart advising assistant for BRAC University students
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Enter Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          />

          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
