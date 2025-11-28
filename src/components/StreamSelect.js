import { useState } from "react";
import "../styles/card.css";

export default function StreamSelect({ user, onUpdate }) {
  const [stream, setStream] = useState("");

  const saveStream = async () => {
    const res = await fetch(
      `${process.env.REACT_APP_API_URL}/auth/set-stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user.studentId,
          stream,
        }),
      }
    );

    const data = await res.json();

    // Update global state → goes directly to dashboard
    onUpdate({
      firstLogin: false,
      user: data.user,
    });
  };

  return (
    <div className="center" style={{ height: "100vh" }}>
      <div className="card">
        <h2>Select Your Stream</h2>

        <select
          value={stream}
          onChange={(e) => setStream(e.target.value)}
        >
          <option value="">Choose Stream</option>
          <option value="ENG102 + MAT110">ENG102 + MAT110</option>
          <option value="ENG102 + MAT092">ENG102 + MAT092</option>
          <option value="ENG101 + MAT110">ENG101 + MAT110</option>
          <option value="ENG101 + MAT092">ENG101 + MAT092</option>
          <option value="ENG091 + MAT110">ENG091 + MAT110</option>
          <option value="ENG091 + MAT092">ENG091 + MAT092</option>
        </select>

        <button onClick={saveStream} disabled={!stream}>
          Save Stream
        </button>
      </div>
    </div>
  );
}
