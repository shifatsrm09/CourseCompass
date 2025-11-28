import "../styles/card.css";

export default function Dashboard({ user, onLogout }) {
  return (
    <div className="center" style={{ height: "100vh" }}>
      <div className="card">
        <h2>Welcome, {user.studentId}</h2>
        <p>Stream: {user.stream}</p>

        <button onClick={onLogout}>Logout</button>
        
            <p style={{ marginTop: "50px" }}>
        Brain ekhono banai nai bhai, banabo
        </p>

      </div>
    </div>
  );
}
