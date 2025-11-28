import { useEffect, useState } from "react";
import Login from "./components/Login";
import StreamSelect from "./components/StreamSelect";
import Dashboard from "./components/Dashboard";

function App() {
  const [userData, setUserData] = useState(null);

  // Load from localStorage on page load
  useEffect(() => {
    const saved = localStorage.getItem("courseCompassUser");
    if (saved) {
      setUserData(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage whenever userData changes
  useEffect(() => {
    if (userData) {
      localStorage.setItem("courseCompassUser", JSON.stringify(userData));
    }
  }, [userData]);

  const handleLogin = (data) => {
    setUserData(data);
  };

  const handleLogout = () => {
    localStorage.removeItem("courseCompassUser");
    setUserData(null);
  };

  if (!userData) return <Login onLogin={handleLogin} />;

  if (userData.firstLogin) {
    return <StreamSelect user={userData.user} onUpdate={setUserData} />;
  }

  return <Dashboard user={userData.user} onLogout={handleLogout} />;
}

export default App;
