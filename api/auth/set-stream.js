// api/auth/set-stream.js
const dbConnect = require("../_db");
const User = require("../models/User");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Method not allowed" });
  }

  try {
    await dbConnect();

    const { studentId, stream } = req.body || {};

    if (!studentId || !stream) {
      res.statusCode = 400;
      return res.json({ error: "studentId and stream required" });
    }

    let user = await User.findOne({ studentId });

    if (!user) {
      // Create new user on first-time stream selection
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
      user,
    });
  } catch (err) {
    console.error("Error in /api/auth/set-stream:", err);
    res.statusCode = 500;
    return res.json({ error: "Internal server error" });
  }
};
