const mongoose = require("mongoose");

const designerStateSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, index: true },
    stream: { type: String, required: true },
    plannerState: { type: mongoose.Schema.Types.Mixed, default: null },
    plannerVersion: { type: Number, default: 0, min: 0 },
    lastPlannerMutationId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DesignerState", designerStateSchema);
