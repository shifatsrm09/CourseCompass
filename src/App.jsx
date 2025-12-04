import { useEffect, useState } from "react";
import Login from "./components/Login.jsx";
import StreamSelect from "./components/StreamSelect.jsx";
import Dashboard from "./components/Dashboard.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [needsStream, setNeedsStream] = useState(false);
  const [tempStudentId, setTempStudentId] = useState("");

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("courseCompassUser");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.user) {
        setUser(parsed.user);
        setNeedsStream(!parsed.user.stream);
      }
    }
  }, []);

  // Save to storage
  useEffect(() => {
    if (user) {
      localStorage.setItem("courseCompassUser", JSON.stringify({ user }));
    }
  }, [user]);

  // LOGIN
  const handleLogin = (data, studentId) => {
    if (data.firstLogin) {
      setTempStudentId(studentId);
      setNeedsStream(true);
    } else {
      setUser(data.user);
      setNeedsStream(false);
    }
  };

  // STREAM SAVED
  const handleStreamSaved = (savedUser) => {
    setUser(savedUser);
    setNeedsStream(false);

    localStorage.setItem(
      "courseCompassUser",
      JSON.stringify({ user: savedUser })
    );
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("courseCompassUser");
    setUser(null);
    setNeedsStream(false);
    setTempStudentId("");
  };

  // FLOW CONTROL
  if (!user && !needsStream) {
    return <Login onLogin={handleLogin} />;
  }

  if (needsStream) {
    return (
      <StreamSelect
        studentId={tempStudentId}
        onUpdate={handleStreamSaved}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      setUser={setUser}
      onLogout={handleLogout}
    />
  );
}

export default App;
