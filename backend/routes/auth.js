const express = require("express");
const router = express.Router();
const User = require("../models/User");


router.post("/login", async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
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
  const { studentId, stream } = req.body;

  if (!studentId || !stream) {
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
