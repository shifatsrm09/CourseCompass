import { API_BASE } from "../api";

export const draftKey = (studentId) => `courseCompassDraft:${studentId}`;

const makeMutationId = () => window.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createPlannerPersistence({
  studentId,
  stream,
  version = 0,
  pending = [],
  timeoutMs = 30000,
  request = (...args) => fetch(...args),
  onSaved = () => {},
  onStatus = () => {},
  onDraft = () => {},
}) {
  let acknowledgedVersion = version;
  let queue = pending.map((item) => ({ ...item }));
  let running = false;
  let disposed = false;
  let blocked = queue.length > 0;
  let conflict = false;
  let activeRequest = null;

  const status = (kind, message = "") => {
    if (!disposed) onStatus({ kind, message, pendingCount: queue.length });
  };

  const writeDraft = () => onDraft(queue.length ? {
    stream,
    version: acknowledgedVersion,
    pending: queue,
  } : null);

  const pump = async () => {
    if (disposed || running || blocked || queue.length === 0) return;
    running = true;
    status("saving", "Saving your plan…");
    while (queue.length && !disposed && !blocked) {
      const item = queue[0];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      activeRequest = { controller, timer };
      try {
        const response = await request(`${API_BASE}/planner/save-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            studentId,
            expectedVersion: acknowledgedVersion,
            mutationId: item.mutationId,
            plannerState: item.plannerState,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.user) {
          const failure = new Error(data.error || "The server could not save this plan. Your changes are still visible.");
          failure.conflict = response.status === 409;
          throw failure;
        }
        const nextVersion = data.plannerVersion ?? data.user.plannerVersion;
        if (!Number.isInteger(nextVersion) || nextVersion <= acknowledgedVersion) {
          throw new Error("The server returned an invalid save version. Retry to confirm whether your plan was saved.");
        }
        acknowledgedVersion = nextVersion;
        queue.shift();
        if (!disposed) {
          writeDraft();
          onSaved(data.user);
        }
      } catch (error) {
        blocked = true;
        conflict = Boolean(error.conflict);
        status(conflict ? "conflict" : "error", controller.signal.aborted
          ? "Saving timed out. Your changes are preserved; retry to confirm the save."
          : error.message || "Your plan could not be saved. Check your connection and retry.");
      } finally {
        clearTimeout(timer);
        activeRequest = null;
      }
    }
    running = false;
    if (!blocked && queue.length === 0) status("idle", "All changes saved");
  };

  return {
    enqueue(plannerState) {
      if (disposed || blocked) return false;
      queue.push({ mutationId: makeMutationId(), plannerState });
      writeDraft();
      pump();
      return true;
    },
    retry() {
      if (disposed || conflict) return;
      blocked = false;
      pump();
    },
    dispose() {
      disposed = true;
      if (activeRequest) {
        clearTimeout(activeRequest.timer);
        activeRequest.controller.abort();
      }
    },
    getSnapshot() {
      return { version: acknowledgedVersion, pending: queue.map((item) => ({ ...item })) };
    },
  };
}
