const mongoose = require("mongoose");




const semesterPlanSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  courses: { type: [String], default: [] },
});

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },


  stream: { type: String, required: true },


  currentSemester: {
    type: Number,
    default: 1,
  },


  semesterOrder: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },


  completedCourses: { type: [String], default: [] },


  currentCourses: { type: [String], default: [] },















  customPlan: {
    type: [semesterPlanSchema],
    default: null,
  },





  codCount: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("User", userSchema);
