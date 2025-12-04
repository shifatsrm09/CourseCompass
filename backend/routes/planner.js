const express = require("express");
const router = express.Router();
const User = require("../models/User");

// ----------------------------------------------
// Auto-fix missing currentSemester
// ----------------------------------------------
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

  if (!studentId || !Array.isArray(order)) {
    return res.status(400).json({ error: "Invalid semester order payload" });
  }

  const user = await User.findOne({ studentId });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Sanitize
  const cleaned = order
    .map((n) => Number(n))
    .filter((n) => !isNaN(n));

  if (cleaned.length === 0) {
    return res.status(400).json({ error: "Invalid semester order" });
  }

  user.semesterOrder = cleaned;
  await user.save();

  return res.json({
    success: true,
    message: "Semester order saved",
    semesterOrder: cleaned,
    user,
  });
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

  user.currentSemester += 1;
  await user.save();

  res.json({
    success: true,
    message: "Semester marked completed",
    user,
  });
});

// ----------------------------------------------
// SAVE FULL CUSTOM PLAN (ENGINE OUTPUT)
// ----------------------------------------------
router.post("/save-plan", async (req, res) => {
  try {
    const { studentId, plan, codCount, currentCourses } = req.body;

    if (!studentId || !Array.isArray(plan)) {
      return res.status(400).json({
        error: "studentId and plan (array) are required",
      });
    }

    const update = { customPlan: plan };

    if (typeof codCount === "number") update.codCount = codCount;
    if (Array.isArray(currentCourses)) update.currentCourses = currentCourses;

    const user = await User.findOneAndUpdate(
      { studentId },
      { $set: update },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.currentSemester || typeof user.currentSemester !== "number") {
      user.currentSemester = 1;
      await user.save();
    }

    return res.json({
      success: true,
      message: "Plan saved successfully",
      user,
    });
  } catch (err) {
    console.error("Error in save-plan:", err);
    return res.status(500).json({ error: "Failed to save plan" });
  }
});

module.exports = router;
