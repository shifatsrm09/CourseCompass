// api/planner/save-plan.js
const dbConnect = require("../_db");
const User = require("../models/User");

async function ensureCurrentSemester(user) {
  if (!user.currentSemester || typeof user.currentSemester !== "number") {
    user.currentSemester = 1;
    await user.save();
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Method not allowed" });
  }

  try {
    await dbConnect();

    const { studentId, plan, codCount, currentCourses } = req.body || {};

    if (!studentId || !Array.isArray(plan)) {
      res.statusCode = 400;
      return res.json({
        error: "studentId and plan (array) are required",
      });
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

    const user = await User.findOneAndUpdate(
      { studentId },
      { $set: update },
      { new: true }
    );

    if (!user) {
      res.statusCode = 404;
      return res.json({ error: "User not found" });
    }

    await ensureCurrentSemester(user);

    return res.json({
      success: true,
      message: "Plan saved successfully",
      user,
    });
  } catch (err) {
    console.error("Error in /api/planner/save-plan:", err);
    res.statusCode = 500;
    return res.json({ error: "Failed to save plan" });
  }
};
