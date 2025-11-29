import { useEffect, useState } from "react";
import Login from "./components/Login";
import StreamSelect from "./components/StreamSelect";
import Dashboard from "./components/Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [firstLogin, setFirstLogin] = useState(false);
  const [tempStudentId, setTempStudentId] = useState("");

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("courseCompassUser");
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed.user);
      setFirstLogin(false);
    }
  }, []);

  // Save to storage
  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "courseCompassUser",
        JSON.stringify({ user })
      );
    }
  }, [user]);

  // LOGIN
  const handleLogin = (data, studentId) => {
    if (data.firstLogin) {
      setTempStudentId(studentId);
      setFirstLogin(true);
    } else {
      setUser(data.user);
      setFirstLogin(false);
    }
  };

  // STREAM SAVED
  const handleStreamSaved = (savedUser) => {
    setUser(savedUser);
    setFirstLogin(false);
    localStorage.setItem("courseCompassUser", JSON.stringify({ user: savedUser }));
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("courseCompassUser");
    setUser(null);
    setFirstLogin(false);
    setTempStudentId("");
  };

  // RENDER LOGIC
  if (!user && !firstLogin) {
    return <Login onLogin={handleLogin} />;
  }

  if (firstLogin) {
    return (
      <StreamSelect
        studentId={tempStudentId}
        onUpdate={handleStreamSaved}
      />
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
