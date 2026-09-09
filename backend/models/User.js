const mongoose = require("mongoose");




const semesterPlanSchema = new mongoose.Schema({
  semester: { type: Number, required: true },
  courses: { type: [String], default: [] },
});

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  firstLogin: { type: Boolean, default: true },


  stream: { type: String, required: true },


  startTerm: {
    type: new mongoose.Schema({
      season: { type: String, enum: ["Spring", "Summer", "Fall"], required: true },
      year: { type: Number, required: true, min: 2000, max: 2100 },
    }, { _id: false }),
    default: null,
  },


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
  plannerState: { type: mongoose.Schema.Types.Mixed, default: null },
  plannerVersion: { type: Number, default: 0, min: 0 },
  lastPlannerMutationId: { type: String, default: null },
});

module.exports = mongoose.model("User", userSchema);
