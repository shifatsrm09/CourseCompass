const express = require("express");
const cors = require("cors");
const database = require("./db");
const authRoutes = require("./routes/auth");
const plannerRoutes = require("./routes/planner");

const app = express();

app.use(cors());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json());

async function requireDatabase(req, res, next) {
  try {
    await database.connectDatabase();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.name);
    res.status(503).json({ error: "Database unavailable. Please try again shortly." });
  }
}

app.use("/api/auth", requireDatabase, authRoutes);
app.use("/api/planner", requireDatabase, plannerRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON request body" });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  console.error("API request failed:", error.name);
  res.status(500).json({ error: "Request failed. Please try again." });
});

module.exports = app;
