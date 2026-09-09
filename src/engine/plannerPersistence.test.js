import { createPlannerPersistence } from "./plannerPersistence";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const response = (plannerVersion, plannerState) => ({
  ok: true,
  json: async () => ({ success: true, plannerVersion, user: { studentId: "student", plannerVersion, plannerState } }),
});

test("rapid changes save serially with the last acknowledged version", async () => {
  const first = deferred();
  const second = deferred();
  const request = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const onSaved = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", stream: "stream", version: 7, request, onSaved });
  const one = { plan: 1 };
  const two = { plan: 2 };
  queue.enqueue(one);
  queue.enqueue(two);
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ expectedVersion: 7, plannerState: one });
  first.resolve(response(8, one));
  await settle();
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ expectedVersion: 8, plannerState: two });
  second.resolve(response(9, two));
  await settle();
  expect(onSaved.mock.calls.map(([user]) => user.plannerState)).toEqual([one, two]);
  expect(queue.getSnapshot()).toEqual({ version: 9, pending: [] });
});

test("an uncertain save retries the exact payload and keeps later changes queued", async () => {
  const request = jest.fn().mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(response(1, { plan: 1 }))
    .mockResolvedValueOnce(response(2, { plan: 2 }));
  const onStatus = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", request, onStatus });
  queue.enqueue({ plan: 1 });
  queue.enqueue({ plan: 2 });
  await settle();
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "error", message: "Offline" }));
  expect(queue.getSnapshot().pending).toHaveLength(2);
  queue.retry();
  await settle();
  await settle();
  expect(request.mock.calls[1][1].body).toBe(request.mock.calls[0][1].body);
  expect(queue.getSnapshot().pending).toEqual([]);
});

test("version conflicts block further writes and preserve the pending plan", async () => {
  const request = jest.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Saved elsewhere" }) });
  const onStatus = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", request, onStatus });
  queue.enqueue({ plan: 1 });
  await settle();
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "conflict" }));
  queue.retry();
  expect(queue.enqueue({ plan: 2 })).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  expect(queue.getSnapshot().pending).toHaveLength(1);
});

test("a disposed request cannot remove a newer session's local draft or update its UI", async () => {
  const first = deferred();
  const onDraft = jest.fn();
  const onSaved = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", request: () => first.promise, onDraft, onSaved });
  queue.enqueue({ plan: 1 });
  expect(onDraft).toHaveBeenCalledTimes(1);
  queue.dispose();
  first.resolve(response(1, { plan: 1 }));
  await settle();
  expect(onDraft).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
});

test("recovered drafts wait for retry and reuse their stored mutation identity", async () => {
  const request = jest.fn().mockResolvedValue(response(4, { plan: 1 }));
  const queue = createPlannerPersistence({
    studentId: "student", version: 3,
    pending: [{ mutationId: "known-save", plannerState: { plan: 1 } }], request,
  });
  expect(request).not.toHaveBeenCalled();
  queue.retry();
  await settle();
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
    studentId: "student", expectedVersion: 3, mutationId: "known-save", plannerState: { plan: 1 },
  });
  expect(queue.getSnapshot()).toEqual({ version: 4, pending: [] });
});

test("an invalid acknowledgement never marks an unsaved plan as saved", async () => {
  const onSaved = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", request: async () => response(0, {}), onSaved });
  queue.enqueue({ plan: 1 });
  await settle();
  expect(queue.getSnapshot().pending).toHaveLength(1);
  expect(onSaved).not.toHaveBeenCalled();
});

test("a timed-out save preserves its identity and can be retried safely", async () => {
  jest.useFakeTimers();
  const request = jest.fn()
    .mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Aborted")));
    }))
    .mockResolvedValueOnce(response(1, { plan: 1 }));
  const onStatus = jest.fn();
  const queue = createPlannerPersistence({ studentId: "student", request, onStatus, timeoutMs: 100 });
  try {
    queue.enqueue({ plan: 1 });
    const sent = request.mock.calls[0][1].body;
    jest.advanceTimersByTime(100);
    await settle();
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "error", message: expect.stringContaining("timed out") }));
    expect(queue.getSnapshot().pending).toHaveLength(1);
    queue.retry();
    await settle();
    expect(request.mock.calls[1][1].body).toBe(sent);
    expect(queue.getSnapshot().pending).toEqual([]);
  } finally {
    queue.dispose();
    jest.useRealTimers();
  }
});
