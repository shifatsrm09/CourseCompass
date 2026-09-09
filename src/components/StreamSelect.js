import { useEffect, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";
import "../styles/card.css";
import streamsConfig from "../data/streamsConfig";

export default function StreamSelect({ studentId, onUpdate }) {
  const [stream, setStream] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const saveStream = async () => {
    if (pending.current) return;
    if (!streamsConfig[stream]) {
      setError("Please select a valid stream.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/set-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, stream }),
      });
      const data = await readApiResponse(response);
      if (!mounted.current) return;
      if (response.ok && data.user) onUpdate(data.user);
      else setError(data.error || "Could not save stream. Please try again.");
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Could not connect to Course Compass. Please retry.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="center" style={{ height: "100vh" }}>
      <div className="card">
        <h2>Select Your Stream</h2>
        <select
          value={stream}
          disabled={busy}
          onChange={(event) => { setStream(event.target.value); setError(""); }}
        >
          <option value="">Choose Stream</option>
          {Object.values(streamsConfig).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        {error && <p role="alert" className="stream-error" style={{ color: "#ff6b6b", marginTop: "10px" }}>{error}</p>}
        <button onClick={saveStream} disabled={!stream || busy}>{busy ? "Saving…" : "Save Stream"}</button>
        <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#aaa" }}>Please choose your correct stream.</p>
      </div>
    </div>
  );
}
