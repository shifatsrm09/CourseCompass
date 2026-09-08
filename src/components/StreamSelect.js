
import { useState } from "react";
import { API_BASE } from "../api";
import "../styles/card.css";


import streamsConfig from "../data/streamsConfig";

export default function StreamSelect({ studentId, onUpdate }) {
  const [stream, setStream] = useState("");
  const [error, setError] = useState("");


  const streamOptions = Object.values(streamsConfig);

  const saveStream = async () => {
    if (!stream) {
      setError("Please select a stream.");
      return;
    }


    if (!streamsConfig[stream]) {
      setError("Invalid stream selected. Please try again.");
      return;
    }

    const res = await fetch(
      `${API_BASE}/auth/set-stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          stream,
        }),
      }
    );

    const data = await res.json();
    if (data.user) {
      onUpdate(data.user);
    } else {
      setError("Could not save stream. Please try again.");
    }
  };

  return (
    <div className="center" style={{ height: "100vh" }}>
      <div className="card">
        <h2>Select Your Stream</h2>

        <select
          value={stream}
          onChange={(e) => {
            setStream(e.target.value);
            setError("");
          }}
        >
          <option value="">Choose Stream</option>

          {streamOptions.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>

        {error && (
          <p
            className="stream-error"
            style={{ color: "#ff6b6b", marginTop: "10px" }}
          >
            {error}
          </p>
        )}

        <button onClick={saveStream} disabled={!stream}>
          Save Stream
        </button>

        <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#aaa" }}>
          Please choose your correct stream.
        </p>
      </div>
    </div>
  );
}
