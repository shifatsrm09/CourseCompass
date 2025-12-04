// api/auth/login.js
const dbConnect = require("../_db");
const User = require("../models/User");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ error: "Method not allowed" });
  }

  try {
    await dbConnect();

    const { studentId } = req.body || {};

    if (!studentId) {
      res.statusCode = 400;
      return res.json({ error: "Student ID required" });
    }

    const user = await User.findOne({ studentId });

    // User does NOT exist → first login → DO NOT CREATE USER YET
    if (!user) {
      return res.json({
        firstLogin: true,
        user: null,
      });
    }

    // User exists → return user
    return res.json({
      firstLogin: false,
      user,
    });
  } catch (err) {
    console.error("Error in /api/auth/login:", err);
    res.statusCode = 500;
    return res.json({ error: "Internal server error" });
  }
};
