import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../api";
import "../styles/login.css";
import "../styles/card.css";

export default function Login({ onLogin }) {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim() }),
      });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok || (!data.firstLogin && !data.user)) {
        throw new Error(data.error || "Your account could not be loaded. Please retry.");
      }
      onLogin(data, studentId.trim());
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Could not connect to Course Compass. Check your connection and retry.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="login-wrapper center">
      <div className="card">
        <h2 className="login-title">Course Compass</h2>
        <p className="login-subtitle">Smart advising assistant for BRAC University students</p>
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Enter Student ID" value={studentId} onChange={(event) => setStudentId(event.target.value)} required disabled={busy} />
          {error && <p role="alert" className="planner-error">{error}</p>}
          <button type="submit" disabled={busy || !studentId.trim()}>{busy ? "Logging in…" : "Login"}</button>
        </form>
      </div>
    </div>
  );
}
