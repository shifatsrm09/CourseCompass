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

module.exports = router;
