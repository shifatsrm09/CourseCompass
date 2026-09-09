import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, readApiResponse } from "../api";
import { readGradesheet } from "../engine/readGradesheet";
import { defaultMappings, prepareGradesheetImport, termNumber, termFromNumber, termName } from "../engine/gradesheet.mjs";
import streamsConfig from "../data/streamsConfig";
import { buildCurriculum } from "../engine/plannerState.mjs";

export default function GradesheetSync({ user: accountUser, curriculum: accountCurriculum, onCancel, onImported }) {
  const [detectedUser, setDetectedUser] = useState(null);
  const [selectedStream, setSelectedStream] = useState("");
  const [newAccount, setNewAccount] = useState(false);
  const user = accountUser || detectedUser;
  const stream = accountUser?.stream || (newAccount ? selectedStream : detectedUser?.stream);
  const curriculum = useMemo(() => accountCurriculum || (streamsConfig[stream] ? buildCurriculum(streamsConfig[stream].plan, stream) : null), [accountCurriculum, stream]);
  const [report, setReport] = useState(null);
  const [mismatchedReport, setMismatchedReport] = useState(null);
  const [filename, setFilename] = useState("");
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(null);
  const active = useRef(null);
  const operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.abort(); };
  }, []);
  const mappings = useMemo(() => report && curriculum ? defaultMappings(report, curriculum) : {}, [report, curriculum]);
  const preview = useMemo(() => {
    if (!report || !current || !curriculum) return {};
    try { return { data: prepareGradesheetImport(report, mappings, termFromNumber(current), curriculum) }; }
    catch (failure) { return { error: failure.message }; }
  }, [report, current, mappings, curriculum]);

  const chooseFile = async event => {
    const file = event.target.files?.[0];
    if (!file || operation.current) return;
    operation.current = true;
    setBusy("Reading PDF…");
    setError("");
    setReport(null);
    if (!accountUser) { setDetectedUser(null); setNewAccount(false); setSelectedStream(""); }
    setMismatchedReport(null);
    setFilename(file.name);
    pending.current = null;
    try {
      const parsed = await readGradesheet(file, accountUser?.studentId);
      if (!mounted.current) return;
      if (!accountUser) {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: parsed.studentId }),
        });
        const data = await readApiResponse(response);
        if (!mounted.current) return;
        if (!response.ok || (!data.firstLogin && !data.user)) throw new Error(data.error || "Could not check the detected account. Please retry.");
        setNewAccount(!data.user);
        setDetectedUser(data.user || { studentId: parsed.studentId, plannerVersion: 0 });
        const codes = parsed.terms.flatMap(term => term.records.map(record => record.code));
        const english = codes.find(code => ["ENG091", "ENG101", "ENG102"].includes(code));
        const math = codes.find(code => ["MAT092", "MAT110"].includes(code));
        setSelectedStream(english && math ? `${english} + ${math}` : "");
      }
      if (!mounted.current) return;
      setReport(parsed);
      setFilename(file.name);
      setCurrent(termNumber(parsed.terms[parsed.terms.length - 1]) + 1);
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || "This PDF could not be read. Choose the original portal download.");
        if (failure.code === "STUDENT_ID_MISMATCH") setMismatchedReport(failure.report);
      }
    } finally {
      operation.current = false;
      if (mounted.current) setBusy("");
    }
  };

  const save = async () => {
    if (operation.current || !preview.data || conflict) return;
    operation.current = true;
    setBusy("Syncing plan…");
    setError("");
    if (!pending.current) pending.current = { ...preview.data, studentId: user.studentId,
      expectedVersion: user.plannerVersion ?? 0, mutationId: window.crypto.randomUUID(),
      ...(!accountUser && newAccount ? { createAccount: true, stream } : {}) };
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/planner/import-gradesheet`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal, body: JSON.stringify(pending.current),
      });
      const data = await readApiResponse(response);
      if (!mounted.current) return;
      if (!response.ok || !data.user) {
        if (response.status === 409) setConflict(true);
        throw new Error(data.error || "The import could not be saved. Please retry.");
      }
      onImported(data.user);
    } catch (failure) {
      if (mounted.current) setError(failure.name === "AbortError" ? "Saving timed out. Retry to confirm the same import." : failure.message);
    } finally {
      clearTimeout(timeout);
      active.current = null;
      operation.current = false;
      if (mounted.current) setBusy("");
    }
  };

  const firstCurrent = report ? termNumber(report.terms[report.terms.length - 1]) + 1 : 0;
  const inputStyle = "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 disabled:opacity-50";
  return (
    <main className="min-h-screen bg-neutral-950 px-3 py-6 text-neutral-100 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
        <h1 className="text-xl font-bold">Sync gradesheet</h1>
        <p className="mt-2 text-sm text-neutral-400">Choose the original CSE grade-sheet PDF from the portal. The PDF is read on your device; only the extracted records and confirmed plan are saved.</p>
        <label className="mt-5 block text-sm font-medium" htmlFor="gradesheet-file">Grade-sheet PDF</label>
        <input id="gradesheet-file" type="file" accept=".pdf,application/pdf" onChange={chooseFile} disabled={Boolean(busy || pending.current || conflict)} className={`${inputStyle} mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-100`} />
        {busy && <p role="status" className="mt-3 text-sm text-neutral-300">{busy}</p>}
        {!accountUser && report && (
          <div className="mt-4 text-sm text-neutral-300">
            <p>Detected student ID: <strong>{report.studentId}</strong></p>
            {newAccount ? (
              <>
                <label htmlFor="import-stream" className="mt-3 block font-medium">Starting stream</label>
                <select id="import-stream" value={selectedStream} onChange={event => setSelectedStream(event.target.value)} disabled={Boolean(busy || pending.current)} className={`${inputStyle} mt-2`}>
                  <option value="">Choose your starting stream</option>
                  {Object.values(streamsConfig).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <p className="mt-2 text-xs text-neutral-400">Selected from the earliest English and math courses in your grade sheet. Check this if your record omits admission or waived courses. Your account and imported plan will be created together when you confirm.</p>
              </>
            ) : <p className="mt-2">Your existing account was found. Importing will update its {user.stream} plan after confirmation.</p>}
          </div>
        )}
        {report && (
          <>
            <p className="mt-4 break-words text-xs text-neutral-400">{filename} · Student {report.studentId} · {report.terms.length} graded semesters</p>
            <label htmlFor="gradesheet-current" className="mt-4 block text-sm font-medium">Your current term</label>
            <select id="gradesheet-current" value={current} onChange={event => setCurrent(Number(event.target.value))} disabled={Boolean(busy || pending.current)} className={`${inputStyle} mt-2`}>
              {Array.from({ length: 13 }, (_, offset) => firstCurrent + offset).map(value => <option key={value} value={value}>{termName(termFromNumber(value))}</option>)}
            </select>
            <p className="mt-2 text-xs text-neutral-400">The PDF shows graded history, not current enrollment. Current and future courses below are generated suggestions. Choose the correct term and edit those courses after syncing.</p>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-neutral-800 p-3">
              {report.terms.map(term => (
                <section key={termNumber(term)}>
                  <h2 className="text-sm font-semibold text-neutral-200">{termName(term)}</h2>
                  <ul className="mt-1 space-y-1 text-xs text-neutral-400">
                    {term.records.map(record => <li key={record.id} className="flex flex-wrap justify-between gap-x-2">
                      <span>{record.code}{mappings[record.id] && mappings[record.id] !== record.code && record.passed ? ` → ${mappings[record.id]}` : ""}</span>
                      <span>{record.grade} · {record.credits} credits{!record.passed ? " · not marked completed" : ""}</span>
                    </li>)}
                  </ul>
                </section>
              ))}
            </div>
            {preview.data && (
              <div className="mt-4 text-sm text-neutral-300">
                <p>Start: {termName(preview.data.startTerm)} · Current: Semester {preview.data.plannerState.currentSemester}</p>
                <p className="mt-1">Suggested current courses: {preview.data.plannerState.semesters[preview.data.plannerState.currentSemester - 1]?.courses.map(course => curriculum.byId.get(course.occurrenceId).code).join(", ") || "None"}</p>
              </div>
            )}
            <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 p-3 text-sm text-amber-200">{newAccount ? "Confirming creates your account and personalized plan." : "Syncing replaces your existing progress and course placements."} Unmatched passed courses use COD slots. Failed, withdrawn, and earlier repeated attempts stay in the imported history and do not count twice.</p>
          </>
        )}
        {(error || preview.error) && <p role="alert" className="mt-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error || preview.error}{conflict ? " Reload the page to load the latest saved plan before importing again." : ""}</p>}
        {mismatchedReport && (
          <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/40 p-3 text-sm text-amber-200">
            <p>This PDF belongs to {mismatchedReport.studentId}. Continuing will prepare it for import into your logged-in account, {user.studentId}. Nothing is saved until you confirm the preview.</p>
            <button type="button" disabled={Boolean(busy)} onClick={() => {
              setReport(mismatchedReport);
              setCurrent(termNumber(mismatchedReport.terms[mismatchedReport.terms.length - 1]) + 1);
              setMismatchedReport(null);
              setError("");
            }} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 font-semibold hover:bg-amber-900/40 disabled:opacity-50">Continue anyway</button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy === "Syncing plan…"} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={!preview.data || Boolean(busy) || conflict} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{pending.current ? "Retry sync" : "Confirm and sync"}</button>
        </div>
      </div>
    </main>
  );
}
