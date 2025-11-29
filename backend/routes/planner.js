const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Save semester order
router.post("/save-order", async (req, res) => {
  const { studentId, order } = req.body;

  if (!studentId || !order) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const user = await User.findOne({ studentId });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.semesterOrder = order;
  await user.save();

  res.json({ success: true, user });
});

module.exports = router;
