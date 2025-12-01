const express = require("express");
const router = express.Router();
const User = require("../models/User");

// auto-fix missing currentSemester
async function ensureCurrentSemester(user) {
  if (!user.currentSemester || typeof user.currentSemester !== "number") {
    user.currentSemester = 1;
    await user.save();
  }
}

// ----------------------------------------------
// SAVE SEMESTER ORDER (TARC DRAG)
// ----------------------------------------------
router.post("/save-order", async (req, res) => {
  const { studentId, order } = req.body;

  if (!studentId || !order)
    return res.status(400).json({ error: "Required fields missing" });

  const user = await User.findOne({ studentId });
  if (!user) return res.status(404).json({ error: "User not found" });

  await ensureCurrentSemester(user);

  user.semesterOrder = order;
  await user.save();

  res.json({ success: true, user });
});

// ----------------------------------------------
// MARK CURRENT SEMESTER COMPLETED
// ----------------------------------------------
router.post("/complete-semester", async (req, res) => {
  const { studentId } = req.body;

  if (!studentId)
    return res.status(400).json({ error: "studentId required" });

  const user = await User.findOne({ studentId });
  if (!user) return res.status(404).json({ error: "User not found" });

  await ensureCurrentSemester(user);

  const maxSemesters = user.semesterOrder.length || 12;

  if (user.currentSemester >= maxSemesters) {
    return res.status(400).json({ error: "Already at final semester" });
  }

  // move to next semester
  user.currentSemester += 1;
  await user.save();

  res.json({
    success: true,
    message: "Semester marked completed",
    user, // send full updated user back
  });
});

// ----------------------------------------------
// SAVE FULL CUSTOM PLAN (ENGINE OUTPUT)
// ----------------------------------------------
//
// Body:
// {
//   studentId: string,
//   plan: [
//     { semester: Number, courses: [ "CSE110", "MAT110", ... ] },
//     ...
//   ],
//   codCount: Number,
//   currentCourses: [String]
// }
//
router.post("/save-plan", async (req, res) => {
  try {
    const { studentId, plan, codCount, currentCourses } = req.body;

    if (!studentId || !Array.isArray(plan)) {
      return res
        .status(400)
        .json({ error: "studentId and plan (array) are required" });
    }

    // Build $set object dynamically so we don't overwrite with undefined
    const update = {
      customPlan: plan,
    };

    if (typeof codCount === "number") {
      update.codCount = codCount;
    }

    if (Array.isArray(currentCourses)) {
      update.currentCourses = currentCourses;
    }

    // Use findOneAndUpdate to avoid VersionError on concurrent saves
    const user = await User.findOneAndUpdate(
      { studentId },
      { $set: update },
      { new: true } // return updated document
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Ensure currentSemester exists for safety (rare edge-case)
    if (!user.currentSemester || typeof user.currentSemester !== "number") {
      user.currentSemester = 1;
      await user.save(); // this is a cheap, single save
    }

    return res.json({
      success: true,
      message: "Plan saved successfully",
      user,
    });
  } catch (err) {
    console.error("Error in /planner/save-plan:", err);
    return res.status(500).json({ error: "Failed to save plan" });
  }
});

module.exports = router;
