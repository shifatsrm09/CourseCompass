import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Global CSS (optional)
import "./styles/globals.css";
import "./index.css"; // only keep if this file actually exists

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
