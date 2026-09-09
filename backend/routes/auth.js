const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { getCurriculum } = require("../plannerState");

const validStudentId = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 100;


router.post("/login", async (req, res) => {
  const { studentId } = req.body || {};

  if (!validStudentId(studentId)) {
    return res.status(400).json({ error: "Student ID required" });
  }

  let user = await User.findOne({ studentId });


  if (!user) {
    return res.json({
      firstLogin: true,
      user: null
    });
  }


  return res.json({
    firstLogin: false,
    user
  });
});


router.post("/set-stream", async (req, res) => {
  const { studentId, stream } = req.body || {};

  if (!validStudentId(studentId) || typeof stream !== "string" || !getCurriculum(stream)) {
    return res.status(400).json({ error: "studentId and stream required" });
  }

  let user = await User.findOne({ studentId });

  if (!user) {

    user = new User({
      studentId,
      stream,
      firstLogin: false,
    });
  } else {
    if (user.stream !== stream) {
      return res.status(409).json({ code: "STREAM_ALREADY_SELECTED", error: "Your saved plan belongs to a different stream. Changing an existing stream requires an explicit plan migration." });
    }
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
