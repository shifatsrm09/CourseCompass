const { getCurriculum, deriveLegacyFields } = require("./plannerState");

async function prepareConnectPlan(sync, stream) {
  const curriculum = await getCurriculum(stream);
  const { defaultMappings, prepareGradesheetImport, termNumber, seasons } = await import("../src/engine/gradesheet.mjs");
  const validTerm = term => seasons.includes(term?.season) && Number.isInteger(term.year) && term.year >= 2000 && term.year <= 2100;
  if (!curriculum || !validTerm(sync?.startTerm) || !validTerm(sync?.currentTerm) || !Array.isArray(sync?.terms) || sync.terms.length > 40) {
    throw new Error("Connect did not provide a valid semester history. Please sign in again.");
  }
  const elapsed = termNumber(sync.currentTerm) - termNumber(sync.startTerm);
  if (elapsed < 0 || elapsed !== sync.terms.length) throw new Error("Connect semester history is incomplete.");
  const missingTerms = [];
  const terms = sync.terms.map((term, index) => {
    if (!validTerm(term) || termNumber(term) !== termNumber(sync.startTerm) + index || !Array.isArray(term.records) || term.records.length > 30) {
      throw new Error("Connect semester history is incomplete.");
    }
    if (term.unavailable || !term.records.length) missingTerms.push({ season: term.season, year: term.year });
    const seen = new Set();
    const records = term.records.filter(record => {
      if (!record || typeof record.code !== "string" || !/^[A-Z]{2,4}\d{3}[A-Z]?$/.test(record.code) || !Number.isFinite(record.credits) || record.credits < 0 || record.credits > 30) {
        throw new Error("Connect returned an invalid course record.");
      }
      const parent = term.records.find(other => other.sectionId != null && other.sectionId === record.parentSectionId);
      if (record.courseType === "LAB" && record.credits === 0 && parent && !curriculum.byCode.has(record.code)) return false;
      if (seen.has(record.code)) return false;
      seen.add(record.code);
      return true;
    }).map((record, recordIndex) => ({ id: `connect:${index}:${recordIndex}`, code: record.code, credits: record.credits, grade: null, passed: true }));
    return { season: term.season, year: term.year, records };
  });
  let result;
  if (!elapsed) {
    const { createDefaultState } = await import("../src/engine/plannerState.mjs");
    result = { plannerState: createDefaultState(curriculum), records: [] };
  } else {
    if (!terms.some(term => term.records.length)) throw new Error("Connect returned no past courses. Your plan was preserved; try importing your grade sheet.");
    const report = { terms };
    result = prepareGradesheetImport(report, defaultMappings(report, curriculum), sync.currentTerm, curriculum);
  }
  return {
    ...deriveLegacyFields(result.plannerState, curriculum),
    plannerState: result.plannerState,
    startTerm: { season: sync.startTerm.season, year: sync.startTerm.year },
    gradesheetImport: {
      source: "connect",
      importedAt: new Date().toISOString(),
      records: result.records.map(record => ({ ...record, passed: null })),
      missingTerms,
      note: "Past Connect registrations are treated as completed for planning. Connect does not provide grades or confirm passes. Current-semester courses are recommendations, not synced registrations.",
    },
    lastPlannerMutationId: null,
  };
}

module.exports = { prepareConnectPlan };
