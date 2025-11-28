const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },
  stream: { type: String, default: null },
  completedCourses: { type: [String], default: [] },
  currentCourses: { type: [String], default: [] },
});

module.exports = mongoose.model("User", userSchema);
