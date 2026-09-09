import { useEffect, useState } from "react";
import { API_BASE, readApiResponse } from "./api";
import Login from "./components/Login";
import StreamSelect from "./components/StreamSelect";
import Dashboard from "./components/Dashboard";
import { draftKey } from "./engine/plannerPersistence";
import GradesheetSync from "./components/GradesheetSync";

function App() {
  const [user, setUser] = useState(null);
  const [needsStream, setNeedsStream] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [importingGradesheet, setImportingGradesheet] = useState(false);
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
        const data = await readApiResponse(response);
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
    if (changingPlan) sessionStorage.removeItem(draftKey(savedUser.studentId));
    setUser(savedUser);
    setNeedsStream(false);
    setChangingPlan(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("courseCompassUser");
    setUser(null);
    setNeedsStream(false);
    setChangingPlan(false);
    setTempStudentId("");
    setSession({ loading: false, error: "" });
  };

  if (session.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4" role="status">
        <p className="text-sm font-medium text-neutral-400">Loading your saved plan…</p>
      </div>
    );
  }
  if (session.error) return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl shadow-black/40 sm:max-w-md sm:p-8">
        <p role="alert" className="mb-4 rounded-lg border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">{session.error}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setRefreshAttempt((attempt) => attempt + 1)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            Retry loading
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-700"
          >
            Return to login
          </button>
        </div>
      </div>
    </div>
  );
  if (importingGradesheet) return <GradesheetSync onCancel={() => setImportingGradesheet(false)} onImported={savedUser => {
    try { sessionStorage.removeItem(draftKey(savedUser.studentId)); } catch {}
    setUser(savedUser);
    setNeedsStream(false);
    setImportingGradesheet(false);
  }} />;
  if (!user && !needsStream) return <Login onLogin={handleLogin} onImportGradesheet={() => setImportingGradesheet(true)} />;
  if (needsStream || changingPlan) return (
    <StreamSelect
      studentId={changingPlan ? user.studentId : tempStudentId}
      mode={changingPlan ? "change" : "create"}
      onUpdate={handleStreamSaved}
      onCancel={() => setChangingPlan(false)}
    />
  );
  return <Dashboard user={user} setUser={setUser} onLogout={handleLogout} onChangePlan={() => setChangingPlan(true)} />;
}

export default App;
