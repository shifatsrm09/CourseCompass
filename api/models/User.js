// api/models/User.js
const mongoose = require("mongoose");

// One semester entry in the user's custom plan
// This stores ONLY course codes. The metadata (title, hp, type, etc.)
// continues to live in your JSON stream files.
const semesterPlanSchema = new mongoose.Schema({
  semester: { type: Number, required: true },   // 1, 2, 3, ...
  courses: { type: [String], default: [] },     // ["CSE110", "MAT110", ...]
});

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },

  // Stream must be picked via StreamSelect before planning
  stream: { type: String, required: true },

  // Current "active" semester (for UI status: completed/current/recommended/locked)
  currentSemester: {
    type: Number,
    default: 1,
  },

  // Drag-drop order of semesters (for TARC reordering etc.)
  semesterOrder: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },

  // Courses the student has OFFICIALLY completed (for HP checks)
  completedCourses: { type: [String], default: [] },

  // Courses the student is currently taking in the CURRENT semester
  currentCourses: { type: [String], default: [] },

  /**
   * The student's personal, engine-adjusted course plan.
   */
  customPlan: {
    type: [semesterPlanSchema],
    default: null, // NULL = use default JSON; non-null = use this plan
  },

  /**
   * how many COD courses the student has taken/placed in the plan.
   */
  codCount: {
    type: Number,
    default: 0,
  },
});

// Important for serverless: reuse existing model if already compiled
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
