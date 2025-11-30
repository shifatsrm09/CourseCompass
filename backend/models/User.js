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
   * NEW: The student's personal, engine-adjusted course plan.
   *
   * IMPORTANT LOGIC:
   * - On first login + stream selection, this stays NULL.
   *   That means "show default JSON BRAC sequence" on the frontend.
   *
   * - As soon as the user makes a modification (add/remove/replace/complete),
   *   the engine computes a new plan and we SAVE it here.
   *
   * - From that point on, the planner should load from `customPlan`
   *   instead of regenerating from JSON, so the user sees the SAME plan
   *   each login.
   */
  customPlan: {
    type: [semesterPlanSchema],
    default: null, // <-- NULL = use default JSON; non-null = use this plan
  },

  /**
   * NEW: how many COD courses the student has taken/placed in the plan.
   * We enforce "at most 5 COD total" using this.
   */
  codCount: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("User", userSchema);
