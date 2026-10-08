const express = require("express");
const User = require("../models/User");
const DesignerState = require("../models/DesignerState");
const { getCurriculum, samePlannerState, deriveLegacyFields } = require("../plannerState");

const router = express.Router();
const validStudentId = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 100;
const versionOf = (designer) => designer?.plannerVersion ?? 0;

function success(res, designer) {
  return res.json({
    success: true,
    designer: {
      plannerState: designer.plannerState,
      plannerVersion: versionOf(designer),
      stream: designer.stream,
    },
    plannerVersion: versionOf(designer),
  });
}

function conflict(res, designer) {
  return res.status(409).json({
    code: "PLANNER_VERSION_CONFLICT",
    error: "Your Designer plan was changed in another session. Please reload to continue.",
    plannerVersion: versionOf(designer),
  });
}

// Get current Designer state
router.all("/state", async (req, res) => {
  const studentId = req.method === "GET" ? req.query?.studentId : req.body?.studentId;
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }

  const user = await User.findOne({ studentId });
  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found." });
  }

  const designer = await DesignerState.findOne({ studentId });
  if (!designer || !designer.plannerState) {
    return res.json({ success: true, exists: false, designer: null });
  }

  return res.json({
    success: true,
    exists: true,
    designer: {
      plannerState: designer.plannerState,
      plannerVersion: versionOf(designer),
      stream: designer.stream,
    },
  });
});

// Sync Designer from Main Planner (creates an independent copy of Main)
router.post("/sync", async (req, res) => {
  const { studentId } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }

  const user = await User.findOne({ studentId });
  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found." });
  }

  const curriculum = await getCurriculum(user.stream);
  if (!curriculum) {
    return res.status(422).json({ code: "UNSUPPORTED_STREAM", error: "The student's stream has no supported curriculum." });
  }

  const { restorePlannerState, createDefaultState } = await import("../../src/engine/plannerState.mjs");
  const restored = restorePlannerState(user, curriculum);
  const baseState = restored.ok ? restored.state : createDefaultState(curriculum);

  // Deep clone to guarantee complete data isolation from Main Planner
  const clonedPlannerState = JSON.parse(JSON.stringify(baseState));
  clonedPlannerState.personalized = true;

  const existing = await DesignerState.findOne({ studentId });
  const nextVersion = (existing?.plannerVersion ?? 0) + 1;

  // IMPORTANT: Main Planner (user) is NEVER modified. Only DesignerState is saved.
  const designer = await DesignerState.findOneAndUpdate(
    { studentId },
    {
      $set: {
        stream: user.stream,
        plannerState: clonedPlannerState,
        lastPlannerMutationId: null,
        plannerVersion: nextVersion,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return success(res, designer);
});

// Save Designer planner changes (modifies DesignerState only, Main Planner is untouched)
router.post("/save-plan", async (req, res) => {
  const { studentId, expectedVersion, mutationId, plannerState } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }
  if (
    !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
    typeof mutationId !== "string" || !mutationId.trim() || mutationId.length > 200 ||
    !plannerState || typeof plannerState !== "object" || Array.isArray(plannerState)
  ) {
    return res.status(400).json({
      code: "INVALID_SAVE_REQUEST",
      error: "A planner state, nonnegative expected version, and unique mutation ID are required.",
    });
  }

  const user = await User.findOne({ studentId });
  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found." });
  }

  const designer = await DesignerState.findOne({ studentId });
  if (!designer || !designer.plannerState) {
    return res.status(404).json({
      code: "DESIGNER_NOT_FOUND",
      error: "Designer workspace not found. Please sync with Main first.",
    });
  }

  if (designer.lastPlannerMutationId === mutationId) {
    if (samePlannerState(designer.plannerState, plannerState)) return success(res, designer);
    return res.status(409).json({ code: "MUTATION_ID_REUSED", error: "This save ID was already used for a different Designer plan." });
  }

  if (versionOf(designer) !== expectedVersion) {
    return conflict(res, designer);
  }

  const stream = designer.stream || user.stream;
  const curriculum = await getCurriculum(stream);
  if (!curriculum) {
    return res.status(422).json({ code: "UNSUPPORTED_STREAM", error: "The saved stream has no supported curriculum." });
  }

  const { restorePlannerState } = await import("../../src/engine/plannerState.mjs");
  const { validatePlannerState } = await import("../../src/engine/validator.mjs");
  const restored = restorePlannerState({ ...user, stream, plannerState: designer.plannerState }, curriculum, { isDesigner: true });

  const validation = validatePlannerState(plannerState, curriculum, {
    previousState: restored.ok ? restored.state : undefined,
    allowUnplaced: true,
    checkSchedule: false,
    isDesigner: true,
    allowPrerequisiteOverride: true,
  });

  if (!validation.ok) {
    const { errors } = validation;
    return res.status(422).json({ code: errors[0].code, error: errors[0].message, details: errors });
  }

  // IMPORTANT: Updates DesignerState ONLY. Main Planner (User) is untouched.
  const saved = await DesignerState.findOneAndUpdate(
    { studentId, plannerVersion: expectedVersion },
    {
      $set: {
        plannerState,
        lastPlannerMutationId: mutationId,
      },
      $inc: { plannerVersion: 1 },
    },
    { new: true, runValidators: true }
  );

  if (saved) return success(res, saved);

  const latest = await DesignerState.findOne({ studentId });
  if (!latest) return res.status(404).json({ code: "DESIGNER_NOT_FOUND", error: "Designer workspace no longer exists." });
  if (latest.lastPlannerMutationId === mutationId && samePlannerState(latest.plannerState, plannerState)) {
    return success(res, latest);
  }
  return conflict(res, latest);
});

// Reset Designer workspace
router.post("/reset", async (req, res) => {
  const { studentId } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }

  await DesignerState.deleteOne({ studentId });
  return res.json({ success: true });
});

// Merge Designer plan into Main Planner
// Blocked if there are problems; allowed if only warnings or clean
router.post("/merge", async (req, res) => {
  const { studentId, plannerState } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }

  const user = await User.findOne({ studentId });
  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found." });
  }

  const designer = await DesignerState.findOne({ studentId });
  if (!designer || (!designer.plannerState && !plannerState)) {
    return res.status(404).json({
      code: "DESIGNER_NOT_FOUND",
      error: "Designer workspace not found. Please sync with Main first.",
    });
  }

  const stateToMerge = plannerState || designer.plannerState;
  const stream = designer?.stream || user.stream;
  const curriculum = await getCurriculum(stream);
  if (!curriculum) {
    return res.status(422).json({ code: "UNSUPPORTED_STREAM", error: "The curriculum could not be found." });
  }

  // Validate Designer plan using validateDesignerPlan
  const { validateDesignerPlan } = await import("../../src/engine/designerValidation.mjs");
  const validation = validateDesignerPlan(stateToMerge, curriculum);

  if (validation.summary.problemCount > 0) {
    return res.status(422).json({
      code: "MERGE_BLOCKED_BY_PROBLEMS",
      error: `Cannot merge with Main Planner: there ${
        validation.summary.problemCount === 1 ? "is 1 problem" : `are ${validation.summary.problemCount} problems`
      } that must be resolved first.`,
      problems: validation.problems,
      warnings: validation.warnings,
      summary: validation.summary,
    });
  }

  // Deep clone to ensure clean state
  const clonedPlannerState = JSON.parse(JSON.stringify(stateToMerge));
  clonedPlannerState.personalized = true;

  const legacyFields = typeof deriveLegacyFields === "function" ? deriveLegacyFields(clonedPlannerState, curriculum) : {};
  const mutationId = `merge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Save into Main Planner (User)
  const updatedUser = await User.findOneAndUpdate(
    { studentId },
    {
      $set: {
        ...legacyFields,
        plannerState: clonedPlannerState,
        lastPlannerMutationId: mutationId,
      },
      $inc: { plannerVersion: 1 },
    },
    { new: true, runValidators: true }
  );

  // Also update DesignerState so it remains consistent
  const updatedDesigner = await DesignerState.findOneAndUpdate(
    { studentId },
    {
      $set: {
        plannerState: clonedPlannerState,
        lastPlannerMutationId: mutationId,
      },
      $inc: { plannerVersion: 1 },
    },
    { new: true }
  );

  return res.json({
    success: true,
    user: updatedUser,
    designer: updatedDesigner ? {
      plannerState: updatedDesigner.plannerState,
      plannerVersion: versionOf(updatedDesigner),
      stream: updatedDesigner.stream,
    } : null,
    message: "Designer plan merged into Main Planner successfully.",
    summary: validation.summary,
  });
});

module.exports = router;
