const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },
  stream: { type: String, required: true },

  // FULL 12-SEMESTER ORDER
  semesterOrder: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },

  completedCourses: { type: [String], default: [] },
  currentCourses: { type: [String], default: [] },
});

module.exports = mongoose.model("User", userSchema);
