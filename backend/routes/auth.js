const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { getCurriculum } = require("../plannerState");

const validStudentId = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 100;
const VALID_SEASONS = ["Spring", "Summer", "Fall"];
const validStartTerm = (value) => (
  value
  && typeof value === "object"
  && VALID_SEASONS.includes(value.season)
  && Number.isInteger(value.year)
  && value.year >= 2000
  && value.year <= 2100
);


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
  const { studentId, stream, startTerm } = req.body || {};

  if (!validStudentId(studentId) || typeof stream !== "string" || !await getCurriculum(stream)) {
    return res.status(400).json({ error: "studentId and stream required" });
  }

  let user = await User.findOne({ studentId });

  if (!user) {
    if (!validStartTerm(startTerm)) {
      return res.status(400).json({ code: "INVALID_START_TERM", error: "Please select the season and year of your first semester." });
    }

    user = new User({
      studentId,
      stream,
      startTerm: { season: startTerm.season, year: startTerm.year },
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

router.post("/delete-account", async (req, res) => {
  const { studentId } = req.body || {};

  if (!validStudentId(studentId)) {
    return res.status(400).json({ error: "Student ID required" });
  }

  const result = await User.deleteOne({ studentId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found." });
  }

  return res.json({ success: true });
});

module.exports = router;
