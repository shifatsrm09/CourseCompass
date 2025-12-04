// api/planner/save-order.js
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

    const { studentId, order } = req.body || {};

    if (!studentId || !order) {
      res.statusCode = 400;
      return res.json({ error: "Required fields missing" });
    }

    const user = await User.findOne({ studentId });
    if (!user) {
      res.statusCode = 404;
      return res.json({ error: "User not found" });
    }

    await ensureCurrentSemester(user);

    user.semesterOrder = order;
    await user.save();

    return res.json({ success: true, user });
  } catch (err) {
    console.error("Error in /api/planner/save-order:", err);
    res.statusCode = 500;
    return res.json({ error: "Internal server error" });
  }
};
