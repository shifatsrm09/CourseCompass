const mongoose = require("mongoose");

const semesterPlanSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  courses: { type: [String], default: [] }  // list of course codes
});

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },
  stream: { type: String, required: true },

  // Current referring semester
  currentSemester: {
    type: Number,
    default: 1,
  },

  // User-reordered semester order (drag-drop)
  semesterOrder: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },

  // Courses the user has officially completed
  completedCourses: { type: [String], default: [] },

  // Active courses in the CURRENT semester
  currentCourses: { type: [String], default: [] },

  // NEW: Store full original stream JSON in DB
  originalPlan: { type: Array, default: [] },

  // NEW: Store modified/engine-balanced course plan
  plannedCourses: { type: [semesterPlanSchema], default: [] },

  // NEW: Count how many COD taken (max 5)
  codCount: { type: Number, default: 0 },
});

module.exports = mongoose.model("User", userSchema);
