const express = require("express");
const User = require("../models/User");
const { getCurriculum, deriveLegacyFields, samePlannerState } = require("../plannerState");

const router = express.Router();
const validStudentId = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 100;
const versionOf = (user) => user.plannerVersion ?? 0;

function upgradeRequired(res) {
  return res.status(409).json({
    code: "PLANNER_UPGRADE_REQUIRED",
    error: "This planner version can no longer save changes. Reload Course Compass to use the updated planner.",
  });
}

function success(res, user) {
  return res.json({ success: true, user, plannerVersion: versionOf(user) });
}

function conflict(res, user) {
  return res.status(409).json({
    code: "PLANNER_VERSION_CONFLICT",
    error: "Your plan was changed in another session. Load the saved plan before making more changes.",
    plannerVersion: versionOf(user),
  });
}

for (const path of ["/save-order", "/complete-semester"]) {
  router.post(path, (req, res) => {
    if (!validStudentId(req.body?.studentId)) {
      return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
    }
    return upgradeRequired(res);
  });
}

router.post("/save-plan", async (req, res) => {
  const { studentId, expectedVersion, mutationId, plannerState, plan } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }
  if (Array.isArray(plan) && !plannerState) return upgradeRequired(res);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      typeof mutationId !== "string" || !mutationId.trim() || mutationId.length > 200 ||
      !plannerState || typeof plannerState !== "object" || Array.isArray(plannerState)) {
    return res.status(400).json({ code: "INVALID_SAVE_REQUEST", error: "A planner state, nonnegative expected version, and unique mutation ID are required." });
  }

  const user = await User.findOne({ studentId });
  if (!user) return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found. Log in again." });
  if (user.lastPlannerMutationId === mutationId) {
    if (samePlannerState(user.plannerState, plannerState)) return success(res, user);
    return res.status(409).json({ code: "MUTATION_ID_REUSED", error: "This save ID was already used for a different plan. Reload the saved plan." });
  }
  if (versionOf(user) !== expectedVersion) return conflict(res, user);

  const curriculum = await getCurriculum(user.stream);
  if (!curriculum) {
    return res.status(422).json({ code: "UNSUPPORTED_STREAM", error: "The saved stream has no supported curriculum. Your existing plan has been preserved." });
  }
  const { restorePlannerState } = await import("../../src/engine/plannerState.mjs");
  const { validatePlannerState } = await import("../../src/engine/validator.mjs");
  const restored = restorePlannerState(user, curriculum);
  if (!restored.ok) {
    return res.status(422).json({ code: "INVALID_SAVED_PLAN", error: restored.error?.message || "The saved plan cannot be restored safely. Existing data has been preserved." });
  }
  const validation = validatePlannerState(plannerState, curriculum, { previousState: restored.state });
  if (!validation.ok) {
    const { errors } = validation;
    return res.status(422).json({ code: errors[0].code, error: errors[0].message, details: errors });
  }

  const versionFilter = expectedVersion === 0
    ? { $or: [{ plannerVersion: 0 }, { plannerVersion: { $exists: false } }] }
    : { plannerVersion: expectedVersion };
  const saved = await User.findOneAndUpdate(
    { studentId, stream: user.stream, ...versionFilter },
    {
      $set: {
        ...deriveLegacyFields(plannerState, curriculum),
        plannerState,
        lastPlannerMutationId: mutationId,
      },
      $inc: { plannerVersion: 1 },
    },
    { new: true, runValidators: true }
  );
  if (saved) return success(res, saved);

  const latest = await User.findOne({ studentId });
  if (!latest) return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account no longer exists." });
  if (latest.lastPlannerMutationId === mutationId && samePlannerState(latest.plannerState, plannerState)) {
    return success(res, latest);
  }
  return conflict(res, latest);
});

router.post("/import-gradesheet", async (req, res) => {
  const { studentId, expectedVersion, mutationId, plannerState, startTerm, records, currentTerm, createAccount, stream } = req.body || {};
  if (!validStudentId(studentId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || typeof mutationId !== "string" || !mutationId.trim() || mutationId.length > 200) {
    return res.status(400).json({ error: "Invalid grade-sheet save request." });
  }
  const user = await User.findOne({ studentId });
  if (!user && createAccount !== true) return res.status(404).json({ error: "Student account not found. Log in again." });
  if (user?.lastPlannerMutationId === mutationId) {
    if (samePlannerState(user.plannerState, plannerState) && samePlannerState(user.gradesheetImport?.records, records) && samePlannerState(user.startTerm?.toObject?.() || user.startTerm, startTerm)) return success(res, user);
    return res.status(409).json({ error: "This import ID has already been used. Reopen the importer." });
  }
  if (user && createAccount === true) return res.status(409).json({ error: "This account was created in another session. Reload and import into the existing account." });
  if (!user && (expectedVersion !== 0 || typeof stream !== "string")) return res.status(400).json({ error: "Choose a starting stream for the new account." });
  if (user && versionOf(user) !== expectedVersion) return conflict(res, user);
  const curriculum = await getCurriculum(user ? user.stream : stream);
  if (!curriculum) return res.status(422).json({ error: "Choose a supported stream before importing." });
  let normalized;
  try {
    const { validateGradesheetImport } = await import("../../src/engine/gradesheet.mjs");
    normalized = validateGradesheetImport({ plannerState, startTerm, records, currentTerm }, curriculum);
  } catch (error) {
    return res.status(422).json({ error: error.message || "Invalid grade-sheet data." });
  }
  if (!user) {
    try {
      const created = await User.create({ studentId, stream, ...deriveLegacyFields(plannerState, curriculum),
        plannerState, startTerm: normalized.startTerm, gradesheetImport: { records: normalized.records },
        lastPlannerMutationId: mutationId, plannerVersion: 1 });
      return success(res, created);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await User.findOne({ studentId });
      if (existing?.lastPlannerMutationId === mutationId && samePlannerState(existing.plannerState, plannerState) && samePlannerState(existing.gradesheetImport?.records, normalized.records)) return success(res, existing);
      return res.status(409).json({ error: "This account now exists. Reload before importing again." });
    }
  }
  const versionFilter = expectedVersion === 0
    ? { $or: [{ plannerVersion: 0 }, { plannerVersion: { $exists: false } }] }
    : { plannerVersion: expectedVersion };
  const saved = await User.findOneAndUpdate(
    { studentId, stream: user.stream, ...versionFilter },
    { $set: { ...deriveLegacyFields(plannerState, curriculum), plannerState, startTerm: normalized.startTerm,
      gradesheetImport: { records: normalized.records }, lastPlannerMutationId: mutationId }, $inc: { plannerVersion: 1 } },
    { new: true, runValidators: true }
  );
  if (saved) return success(res, saved);
  const latest = await User.findOne({ studentId });
  if (!latest) return res.status(404).json({ error: "Student account no longer exists." });
  if (latest.lastPlannerMutationId === mutationId && samePlannerState(latest.plannerState, plannerState) && samePlannerState(latest.gradesheetImport?.records, normalized.records)) return success(res, latest);
  return conflict(res, latest);
});

router.post("/reset", async (req, res) => {
  const { studentId } = req.body || {};
  if (!validStudentId(studentId)) {
    return res.status(400).json({ code: "INVALID_STUDENT_ID", error: "A student ID is required." });
  }

  const user = await User.findOne({ studentId });
  if (!user) return res.status(404).json({ code: "USER_NOT_FOUND", error: "Student account not found. Log in again." });

  user.currentSemester = 1;
  user.semesterOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  user.completedCourses = [];
  user.currentCourses = [];
  user.customPlan = null;
  user.codCount = 0;
  user.plannerState = null;
  user.plannerVersion = 0;
  user.lastPlannerMutationId = null;
  user.gradesheetImport = null;

  await user.save();
  return res.json({ success: true, user });
});

module.exports = router;
