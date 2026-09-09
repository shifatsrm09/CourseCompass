import { useEffect, useState } from "react";
import { API_BASE } from "./api";
import Login from "./components/Login";
import StreamSelect from "./components/StreamSelect";
import Dashboard from "./components/Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [needsStream, setNeedsStream] = useState(false);
  const [tempStudentId, setTempStudentId] = useState("");
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [session, setSession] = useState({ loading: true, error: "" });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const restoreSession = async () => {
      setSession({ loading: true, error: "" });
      try {
        const saved = localStorage.getItem("courseCompassUser");
        if (!saved) {
          if (active) setSession({ loading: false, error: "" });
          return;
        }
        const cached = JSON.parse(saved);
        if (!cached.user?.studentId) throw new Error("The saved session could not be read. Return to login to load your account.");
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: cached.user.studentId }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.user) {
          throw new Error(data.error || "Your saved account could not be loaded. Your local plan has been preserved.");
        }
        if (!active) return;
        setUser(data.user);
        setTempStudentId(data.user.studentId);
        setNeedsStream(!data.user.stream);
        setSession({ loading: false, error: "" });
      } catch (error) {
        const message = error instanceof SyntaxError
          ? "The saved session or server response could not be read. Retry, or return to login to load your account."
          : error.message || "Your account could not be loaded. Check your connection and retry.";
        if (active) setSession({ loading: false, error: message });
      }
    };
    restoreSession();
    return () => { active = false; controller.abort(); };
  }, [refreshAttempt]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem("courseCompassUser", JSON.stringify({ user }));
    } catch {
      return;
    }
  }, [user]);

  const handleLogin = (data, studentId) => {
    setTempStudentId(studentId);
    if (data.firstLogin || !data.user?.stream) {
      setNeedsStream(true);
    } else {
      setUser(data.user);
      setNeedsStream(false);
    }
  };

  const handleStreamSaved = (savedUser) => {
    setUser(savedUser);
    setNeedsStream(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("courseCompassUser");
    setUser(null);
    setNeedsStream(false);
    setTempStudentId("");
    setSession({ loading: false, error: "" });
  };

  if (session.loading) return <div className="center" role="status">Loading your saved plan…</div>;
  if (session.error) return (
    <div className="center">
      <div className="card">
        <p role="alert">{session.error}</p>
        <button type="button" onClick={() => setRefreshAttempt((attempt) => attempt + 1)}>Retry loading</button>
        <button type="button" onClick={handleLogout}>Return to login</button>
      </div>
    </div>
  );
  if (!user && !needsStream) return <Login onLogin={handleLogin} />;
  if (needsStream) return <StreamSelect studentId={tempStudentId} onUpdate={handleStreamSaved} />;
  return <Dashboard user={user} setUser={setUser} onLogout={handleLogout} />;
}

export default App;
