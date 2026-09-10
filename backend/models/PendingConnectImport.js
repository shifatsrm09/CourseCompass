const mongoose = require("mongoose");

// Short-lived holding area for data fetched from Connect during OAuth login,
// before the student has chosen a stream (and therefore before we can create
// their CourseCompass account, since `stream` is required on User).
// Expires automatically 15 minutes after creation via the TTL index below.
const pendingConnectImportSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  completedCourses: { type: [String], default: [] },
  currentSemester: { type: Number, default: 1 },
  gradesheetImport: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, expires: 900 },
});

module.exports = mongoose.model("PendingConnectImport", pendingConnectImportSchema);
