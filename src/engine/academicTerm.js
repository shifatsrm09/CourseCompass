const TERM_ORDER = ["Spring", "Summer", "Fall"];

export function isValidStartTerm(startTerm) {
  return Boolean(
    startTerm
    && TERM_ORDER.includes(startTerm.season)
    && Number.isInteger(startTerm.year)
  );
}

/**
 * Given the student's first registered term and a zero-based semester
 * offset (0 = their first semester), returns the { season, year } for
 * that semester. Terms rotate Spring -> Summer -> Fall -> Spring...
 */
export function advanceTerm(startTerm, offset) {
  if (!isValidStartTerm(startTerm) || !Number.isInteger(offset) || offset < 0) return null;
  const startIndex = TERM_ORDER.indexOf(startTerm.season);
  const totalIndex = startIndex + offset;
  const season = TERM_ORDER[totalIndex % TERM_ORDER.length];
  const year = startTerm.year + Math.floor(totalIndex / TERM_ORDER.length);
  return { season, year };
}

export function formatTermLabel(term) {
  if (!term) return "";
  return `${term.season.toUpperCase()} ${term.year}`;
}
