const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },
  stream: { type: String, required: true},
  completedCourses: { type: [String], default: [] },
  currentCourses: { type: [String], default: [] },
});

module.exports = mongoose.model("User", userSchema);
