import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../api";
import { applyAction } from "./engine.mjs";
import { restorePlannerState } from "./plannerState.mjs";
import { createPlannerPersistence, draftKey } from "./plannerPersistence";

function loadInitial(user, curriculum) {
  const restored = restorePlannerState(user, curriculum);
  if (!restored.ok) return restored;
  try {
    const stored = sessionStorage.getItem(draftKey(user.studentId));
    if (!stored) return restored;
    const draft = JSON.parse(stored);
    if (draft.stream !== user.stream || !Number.isInteger(draft.version) ||
      draft.version < 0 || !Array.isArray(draft.pending) || !draft.pending.length) {
      throw new Error("The pending local draft could not be read. Load the saved plan to continue.");
    }
    let last;
    for (const item of draft.pending) {
      if (typeof item.mutationId !== "string" || !item.mutationId) {
        throw new Error("The pending local draft has no save identity. Load the saved plan to continue.");
      }
      last = restorePlannerState({ ...user, plannerState: item.plannerState }, curriculum);
      if (!last.ok) throw new Error(last.error?.message || "The pending local draft is invalid.");
    }
    return { ...last, draft };
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "The pending local draft is unreadable. Load the saved plan to continue; your draft has been preserved."
      : error.message;
    return { ok: false, state: restored.state, error: { message } };
  }
}

export default function usePlanner({ user, setUser, curriculum }) {
  const [initial] = useState(() => loadInitial(user, curriculum));
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(initial.state);
  const [error, setError] = useState(initial.ok ? "" : initial.error?.message || "Your saved plan could not be restored.");
  const [warnings, setWarnings] = useState(initial.warnings || []);
  const [storageError, setStorageError] = useState("");
  const [saveStatus, setSaveStatus] = useState(initial.draft
    ? { kind: "pending", message: "Your unsaved local plan has been recovered. Retry saving to continue." }
    : { kind: "idle", message: "" });
  const [reloadBusy, setReloadBusy] = useState(false);
  const [restoreBlocked, setRestoreBlocked] = useState(!initial.ok);
  const queueRef = useRef(null);
  const mounted = useRef(false);
  const initialUser = useRef(user);
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  const makeQueue = (savedUser, draft) => createPlannerPersistence({
    studentId: savedUser.studentId,
    stream: savedUser.stream,
    version: draft?.version ?? savedUser.plannerVersion ?? 0,
    pending: draft?.pending || [],
    onSaved: (updatedUser) => { if (mounted.current) setUserRef.current(updatedUser); },
    onStatus: (status) => { if (mounted.current) setSaveStatus(status); },
    onDraft: (draftValue) => {
      try {
        if (draftValue) sessionStorage.setItem(draftKey(savedUser.studentId), JSON.stringify(draftValue));
        else sessionStorage.removeItem(draftKey(savedUser.studentId));
        if (mounted.current) setStorageError("");
      } catch {
        if (mounted.current) setStorageError("Browser storage is unavailable. Keep this page open until your plan is saved.");
      }
    },
  });
  const makeQueueRef = useRef(makeQueue);
  makeQueueRef.current = makeQueue;

  useEffect(() => {
    mounted.current = true;
    queueRef.current = makeQueueRef.current(initialUser.current, initial.draft);
    return () => {
      mounted.current = false;
      queueRef.current?.dispose();
    };
  }, [initial.draft]);

  const blocked = restoreBlocked || reloadBusy || ["error", "conflict", "pending"].includes(saveStatus.kind);

  const dispatch = (action) => {
    if (blocked || !stateRef.current || !queueRef.current) return false;
    const result = applyAction(stateRef.current, action, curriculum);
    if (!result.ok) {
      setError(result.error?.message || "This change cannot be applied to your plan.");
      return false;
    }
    if (result.state === stateRef.current) {
      setError("");
      return true;
    }
    if (!queueRef.current.enqueue(result.state)) return false;
    stateRef.current = result.state;
    setState(result.state);
    setWarnings(result.warnings || []);
    setError("");
    return true;
  };

  const reloadSavedPlan = async () => {
    if (saveStatus.kind === "saving" || reloadBusy) return;
    setReloadBusy(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });
      const data = await response.json();
      if (!response.ok || !data.user) throw new Error(data.error || "Your saved account could not be loaded.");
      if (data.user.stream !== user.stream) throw new Error("Your stream changed in another session. Log out and log in again to load it.");
      const restored = restorePlannerState(data.user, curriculum);
      if (!restored.ok) throw new Error(restored.error?.message || "The database plan could not be restored.");
      if (!mounted.current) return;
      queueRef.current?.dispose();
      queueRef.current = makeQueue(data.user);
      sessionStorage.removeItem(draftKey(user.studentId));
      stateRef.current = restored.state;
      setState(restored.state);
      setWarnings(restored.warnings || []);
      setUserRef.current(data.user);
      setSaveStatus({ kind: "idle", message: "Saved plan loaded" });
      setRestoreBlocked(false);
      setError("");
    } catch (failure) {
      if (mounted.current) setError(failure.message || "The saved plan could not be loaded. Your local plan is unchanged.");
    } finally {
      if (mounted.current) setReloadBusy(false);
    }
  };

  return {
    state,
    error,
    warnings: storageError ? [...warnings, { code: "DRAFT_STORAGE_UNAVAILABLE", message: storageError }] : warnings,
    blocked,
    saveStatus,
    reloadBusy,
    dispatch,
    clearError: () => setError(""),
    retrySave: () => queueRef.current?.retry(),
    reloadSavedPlan,
  };
}
