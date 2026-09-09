import { createDefaultState, createInstance } from "./plannerState.mjs";
import { scheduleFuture } from "./scheduler.mjs";
import { validatePlannerState } from "./validator.mjs";

export const seasons = ["Spring", "Summer", "Fall"];
export const termNumber = term => term.year * 3 + seasons.indexOf(term.season);
export const termFromNumber = number => ({ season: seasons[number % 3], year: Math.floor(number / 3) });
export const termName = term => `${term.season} ${term.year}`;
const passing = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|P|S)$/;
const knownGrade = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|I|W|P|S|U|R|WIP|IP|AW)$/;

export function parseGradesheet(lines, studentId) {
  const text = lines.join("\n");
  if (!/BRAC\s+University/i.test(text) || !/GRADE\s+SHEET/i.test(text)) throw new Error("Please choose the original BRAC University grade-sheet PDF.");
  const ids = [...text.matchAll(/Student\s*ID\s*:?\s*(\d+)/gi)].map(match => match[1]);
  if (!ids.length || ids.some(id => id !== ids[0])) throw new Error("The grade sheet has a missing or inconsistent student ID.");
  if (!/COMPUTER\s+SCIENCE\s+AND\s+ENGINEERING/i.test(text.replace(/\s+/g, " "))) throw new Error("This importer supports the CSE grade sheet.");
  const terms = [];
  let current;
  for (const line of lines) {
    const term = line.match(/SEMESTER\s*:\s*(SPRING|SUMMER|FALL)\s+(20\d{2})/i);
    if (term) {
      const season = seasons.find(value => value.toUpperCase() === term[1].toUpperCase());
      current = { season, year: Number(term[2]), records: [] };
      const currentNumber = termNumber(current);
      if (terms.some(value => termNumber(value) >= currentNumber)) throw new Error("Semester order in this PDF is ambiguous. Import was stopped.");
      terms.push(current);
      continue;
    }
    const code = line.match(/^([A-Z]{2,4}\d{3}[A-Z]?)\b/);
    if (!code) continue;
    const result = line.match(/\s(\d+(?:\.\d+)?)\s+([A-Z][+-]?|WIP|IP|AW)\s+(-|\d+(?:\.\d+)?)\s*$/);
    if (!current || !result || !knownGrade.test(result[2])) throw new Error(`Could not read the grade for ${code[1]}. Nothing has been imported.`);
    const credits = Number(result[1]);
    const grade = result[2];
    current.records.push({ id: `${termNumber(current)}:${current.records.length}`, code: code[1], grade, credits, passed: passing.test(grade) });
  }
  if (!terms.length || terms.some(term => !term.records.length)) throw new Error("No complete semester records were found. Scanned PDFs are not supported; download the original PDF from the portal.");
  if (terms.length > 60 || terms.some(term => term.records.length > 30)) throw new Error("This grade sheet exceeds the supported size.");
  const report = { studentId: ids[0], terms };
  if (studentId && ids[0] !== studentId.trim()) {
    const error = new Error("The grade-sheet student ID does not match your logged-in account.");
    error.code = "STUDENT_ID_MISMATCH";
    error.report = report;
    throw error;
  }
  return report;
}

export function defaultMappings(report, curriculum) {
  return Object.fromEntries(report.terms.flatMap(term => term.records.map(record => {
    const code = record.code === "EMB101" && curriculum.byCode.has("DEV/EMB101") ? "DEV/EMB101" : record.code;
    return [record.id, curriculum.byCode.has(code) ? code : "COD"];
  })));
}

export function prepareGradesheetImport(report, mappings, currentTerm, curriculum) {
  const first = termNumber(report.terms[0]);
  const last = termNumber(report.terms[report.terms.length - 1]);
  if (!seasons.includes(currentTerm?.season) || !Number.isInteger(currentTerm?.year)) throw new Error("Choose your current term.");
  const currentIndex = termNumber(currentTerm) - first;
  if (currentIndex <= last - first || currentIndex > 80) throw new Error("The current term must be after the last graded semester.");
  const records = report.terms.flatMap(term => term.records.map(record => ({ ...record, term: { season: term.season, year: term.year }, occurrenceId: null })));
  const used = new Set();
  const latestPass = new Map();
  for (const record of records) if (record.passed) latestPass.set(record.code, record.id);
  for (const record of records) {
    if (!record.passed || latestPass.get(record.code) !== record.id) continue;
    const mapped = mappings[record.id];
    if (!mapped) throw new Error(`Choose a planner slot for ${record.code} before syncing.`);
    const occurrence = curriculum.byCode.get(mapped)?.find(course => !used.has(course.occurrenceId));
    if (!occurrence) throw new Error(`No unused ${mapped} slot is available for ${record.code}. Check the selected stream and mappings.`);
    used.add(occurrence.occurrenceId);
    record.occurrenceId = occurrence.occurrenceId;
  }
  const state = createDefaultState(curriculum);
  state.semesters = Array.from({ length: Math.max(12, currentIndex + 2) }, (_, index) => ({ id: `sem-${index + 1}`, originalRow: index + 1, isTarc: false, courses: [] }));
  state.completedCourses = [];
  for (const record of records) {
    if (!record.occurrenceId) continue;
    const definition = curriculum.byId.get(record.occurrenceId);
    const slot = state.semesters[termNumber(record.term) - first];
    slot.courses.push(createInstance(definition));
    state.completedCourses.push(definition.code);
  }
  state.completedCourses = [...new Set(state.completedCourses)];
  const tarc = curriculum.occurrences.filter(course => course.is_tarc);
  const passedTarc = tarc.filter(course => used.has(course.occurrenceId));
  if (passedTarc.length && passedTarc.length !== tarc.length) throw new Error("Only part of TARC was matched. Match all TARC courses before syncing.");
  let tarcIndex;
  if (passedTarc.length) {
    const positions = state.semesters.map((slot, index) => slot.courses.some(course => tarc.some(value => value.occurrenceId === course.occurrenceId)) ? index : -1).filter(index => index >= 0);
    if (positions.length !== 1 || state.semesters[positions[0]].courses.length !== tarc.length) throw new Error("TARC must be a complete semester. Check the TARC course mappings.");
    tarcIndex = positions[0];
  } else {
    tarcIndex = Math.max(currentIndex + 1, 2);
    state.semesters[tarcIndex].courses = tarc.map(createInstance);
  }
  if (tarc.length) {
    state.semesters[tarcIndex].isTarc = true;
    if (tarcIndex !== 2) [state.semesters[2].originalRow, state.semesters[tarcIndex].originalRow] = [state.semesters[tarcIndex].originalRow, state.semesters[2].originalRow];
  }
  state.unplaced = curriculum.occurrences.filter(course => !used.has(course.occurrenceId) && !course.is_tarc).map(createInstance);
  state.currentSemester = currentIndex;
  state.personalized = true;
  scheduleFuture(state, curriculum);
  state.currentSemester = currentIndex + 1;
  const validation = validatePlannerState(state, curriculum);
  if (!validation.ok) throw new Error(validation.errors[0].message);
  return { plannerState: state, startTerm: { season: report.terms[0].season, year: report.terms[0].year }, records, currentTerm };
}

export function validateGradesheetImport(payload, curriculum) {
  const { plannerState, startTerm, records, currentTerm } = payload || {};
  const validTerm = term => seasons.includes(term?.season) && Number.isInteger(term.year) && term.year >= 2000 && term.year <= 2100;
  if (!validTerm(startTerm) || !validTerm(currentTerm) || !Array.isArray(records) || !records.length || records.length > 500) throw new Error("Invalid grade-sheet import.");
  const validation = validatePlannerState(plannerState, curriculum);
  if (!validation.ok) throw new Error(validation.errors[0].message);
  if (termNumber(currentTerm) - termNumber(startTerm) !== plannerState.currentSemester - 1) throw new Error("The current semester does not match the selected term.");
  const ids = new Set();
  const mapped = new Set();
  const completed = new Set();
  for (const record of records) {
    if (!record || typeof record.id !== "string" || record.id.length > 80 || ids.has(record.id) || !/^[A-Z]{2,4}\d{3}[A-Z]?$/.test(record.code) || !knownGrade.test(record.grade) || record.passed !== passing.test(record.grade) || !Number.isFinite(record.credits) || record.credits < 0 || record.credits > 30 || !validTerm(record.term)) throw new Error("An imported course record is invalid.");
    ids.add(record.id);
    const index = termNumber(record.term) - termNumber(startTerm);
    if (index < 0 || index >= plannerState.currentSemester - 1) throw new Error("Imported grades must precede the current term.");
    if (record.occurrenceId === null) {
      if (record.passed && !records.some(other => other.code === record.code && other.passed && other.occurrenceId && termNumber(other.term) >= termNumber(record.term))) throw new Error(`The passed course ${record.code} has no planner slot.`);
      continue;
    }
    const definition = curriculum.byId.get(record.occurrenceId);
    const code = record.code === "EMB101" && curriculum.byCode.has("DEV/EMB101") ? "DEV/EMB101" : record.code;
    const expectedCode = curriculum.byCode.has(code) ? code : "COD";
    if (!record.passed || !definition || definition.code !== expectedCode || mapped.has(record.occurrenceId)) throw new Error(`Invalid planner mapping for ${record.code}.`);
    mapped.add(record.occurrenceId);
    completed.add(definition.code);
    if (!plannerState.semesters[index].courses.some(course => course.occurrenceId === record.occurrenceId)) throw new Error(`${record.code} is not in its recorded semester.`);
  }
  for (const semester of plannerState.semesters.slice(0, plannerState.currentSemester - 1)) {
    for (const course of semester.courses) if (!mapped.has(course.occurrenceId)) throw new Error("The plan contains a historical course missing from the grade sheet.");
  }
  if (completed.size !== plannerState.completedCourses.length || plannerState.completedCourses.some(code => !completed.has(code))) throw new Error("Completed courses do not match the imported grades.");
  return {
    startTerm: { season: startTerm.season, year: startTerm.year },
    records: records.map(({ id, code, grade, credits, passed, term, occurrenceId }) => ({ id, code, grade, credits, passed, term: { season: term.season, year: term.year }, occurrenceId })),
  };
}
