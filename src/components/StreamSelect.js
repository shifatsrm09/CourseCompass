import { useState } from "react";
import "../styles/card.css";

export default function StreamSelect({ studentId, onUpdate }) {
  const [stream, setStream] = useState("");
  const [error, setError] = useState("");

  // Only ENG101 + MAT110 is configured
  const allowedStreams = ["ENG101 + MAT110"];

  const saveStream = async () => {
    if (!allowedStreams.includes(stream)) {
      setError("This stream is not configured yet.");
      return;
    }

    const res = await fetch(
      `${process.env.REACT_APP_API_URL}/auth/set-stream`,
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
    onUpdate(data.user);
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

          {/* Configured Streams */}
          <option value="ENG101 + MAT110">ENG101 + MAT110</option>

          {/* Unconfigured Streams */}
          <option value="ENG101 + MAT092">ENG101 + MAT092</option>
          <option value="ENG102 + MAT110">ENG102 + MAT110</option>
          <option value="ENG102 + MAT092">ENG102 + MAT092</option>
          <option value="ENG091 + MAT110">ENG091 + MAT110</option>
          <option value="ENG091 + MAT092">ENG091 + MAT092</option>
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
          Only ENG101 + MAT110 is currently available.
        </p>
      </div>
    </div>
  );
}
