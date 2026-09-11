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
  const { studentId, stream, startTerm, confirmMigration } = req.body || {};

  if (!validStudentId(studentId) || typeof stream !== "string" || !await getCurriculum(stream)) {
    return res.status(400).json({ error: "studentId and stream required" });
  }

  let user = await User.findOne({ studentId });

  if (!user) {
    if (!validStartTerm(startTerm)) {
      return res.status(400).json({ code: "INVALID_START_TERM", error: "Please select the season and year of your first semester." });
    }

    if (confirmMigration === true) {
      return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found. Log in again." });
    }

    let connectFields = {};
    const connectSync = req.body.connectSync;
    if (connectSync && typeof connectSync === "object") {
      const completedCourses = Array.isArray(connectSync.completedCourses) ? connectSync.completedCourses.filter((code) => typeof code === "string") : null;
      const currentSemester = Number.isInteger(connectSync.currentSemester) && connectSync.currentSemester >= 1 ? connectSync.currentSemester : null;
      if (completedCourses && currentSemester) {
        connectFields = {
          completedCourses,
          currentSemester,
          ...(connectSync.gradesheetImport && typeof connectSync.gradesheetImport === "object" ? { gradesheetImport: connectSync.gradesheetImport } : {}),
        };
      }
    }

    user = new User({
      studentId,
      stream,
      startTerm: { season: startTerm.season, year: startTerm.year },
      firstLogin: false,
      ...connectFields,
    });
  } else if (confirmMigration === true) {
    if (!validStartTerm(startTerm)) {
      return res.status(400).json({ code: "INVALID_START_TERM", error: "Please select the season and year of your first semester." });
    }

    const version = user.plannerVersion ?? 0;
    const versionFilter = version === 0
      ? { $or: [{ plannerVersion: 0 }, { plannerVersion: { $exists: false } }] }
      : { plannerVersion: version };
    user = await User.findOneAndUpdate(
      { studentId, stream: user.stream, ...versionFilter },
      {
        $set: {
          stream,
          startTerm: { season: startTerm.season, year: startTerm.year },
          firstLogin: false,
          currentSemester: 1,
          semesterOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          completedCourses: [],
          currentCourses: [],
          customPlan: null,
          codCount: 0,
          plannerState: null,
          lastPlannerMutationId: null,
          gradesheetImport: null,
        },
        $inc: { plannerVersion: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(409).json({ code: "PLANNER_VERSION_CONFLICT", error: "Your plan changed while restarting. Please retry." });
    }
    return res.json({ success: true, message: "Plan changed successfully", user });
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
