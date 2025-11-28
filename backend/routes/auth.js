const express = require("express");
const router = express.Router();
const User = require("../models/User");

// LOGIN (first login or returning)
router.post("/login", async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "Student ID required" });
  }

  // 1. Look for existing user
  let user = await User.findOne({ studentId });

  // 2. If not found → first login → create new user
  if (!user) {
    user = await User.create({ studentId });
  }

  // 3. Return user + firstLogin flag
  return res.json({
    firstLogin: user.firstLogin,
    user
  });
});

// SET STREAM (only for first login)
router.post("/set-stream", async (req, res) => {
  const { studentId, stream } = req.body;

  const user = await User.findOne({ studentId });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Save stream and disable firstLogin
  user.stream = stream;
  user.firstLogin = false;

  await user.save();

  return res.json({
    message: "Stream saved",
    user
  });
});

module.exports = router;
