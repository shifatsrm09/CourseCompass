const express = require("express");
const router = express.Router();
const User = require("../models/User");

// LOGIN — check if user exists only
router.post("/login", async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "Student ID required" });
  }

  let user = await User.findOne({ studentId });

  // User does NOT exist → first login → DO NOT CREATE USER YET
  if (!user) {
    return res.json({
      firstLogin: true,
      user: null
    });
  }

  // User exists → return user
  return res.json({
    firstLogin: false,
    user
  });
});

// SET STREAM — create user OR update existing one
router.post("/set-stream", async (req, res) => {
  const { studentId, stream } = req.body;

  if (!studentId || !stream) {
    return res.status(400).json({ error: "studentId and stream required" });
  }

  let user = await User.findOne({ studentId });

  if (!user) {
    // Create new user on first-time stream selection
    user = new User({
      studentId,
      stream,
      firstLogin: false,
    });
  } else {
    user.stream = stream;
    user.firstLogin = false;
  }

  await user.save();

  return res.json({
    success: true,
    message: "Stream saved successfully",
    user
  });
});

module.exports = router;
