import React, { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { buildCurriculum, createDefaultState } from "./plannerState.mjs";
import usePlanner from "./usePlanner";
import { draftKey } from "./plannerPersistence";

const catalog = [
  { code: "A", semester_row: 1, hp: [], sp: [] },
  { code: "B", semester_row: 2, hp: ["A"], sp: [] },
  { code: "C", semester_row: 3, hp: ["B"], sp: [] },
  { code: "D", semester_row: 4, hp: [], sp: [] },
];
const curriculum = buildCurriculum(catalog, "test");
const user = { studentId: "student", stream: "test", plannerVersion: 0 };
let originalFetch;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); originalFetch = global.fetch; });
afterEach(() => { global.fetch = originalFetch; });
const savedResponse = (version, plannerState) => ({
  ok: true,
  json: async () => ({ success: true, plannerVersion: version, user: { ...user, plannerVersion: version, plannerState } }),
});
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
};

test("StrictMode preserves the default without generating a save", () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }), {
    wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
  });
  expect(result.current.state).toEqual(createDefaultState(curriculum));
  expect(global.fetch).not.toHaveBeenCalled();
});

test("rapid actions use the newest canonical state while saves remain serialized", async () => {
  const first = deferred();
  const second = deferred();
  global.fetch = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const setUser = jest.fn();
  const { result } = renderHook(() => usePlanner({ user, setUser, curriculum }));
  const b = result.current.state.semesters[1].courses[0].instanceId;
  act(() => {
    expect(result.current.dispatch({ type: "REMOVE_COURSE", semesterId: "sem-2", instanceId: b })).toBe(true);
    expect(result.current.dispatch({ type: "COMPLETE_SEMESTER", semesterId: "sem-1" })).toBe(true);
  });
  expect(result.current.state.currentSemester).toBe(2);
  expect(result.current.state.semesters[2].courses.some((course) => course.instanceId === b)).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const current = result.current.state;
  const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
  await act(async () => { first.resolve(savedResponse(1, firstBody.plannerState)); });
  expect(result.current.state).toEqual(current);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
  expect(secondBody.plannerState).toEqual(current);
  await act(async () => { second.resolve(savedResponse(2, current)); });
  expect(setUser).toHaveBeenLastCalledWith(expect.objectContaining({ plannerState: current, plannerVersion: 2 }));
  expect(sessionStorage.getItem(draftKey(user.studentId))).toBeNull();
});

test("a failed action preserves state and performs no persistence", () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
  const before = result.current.state;
  act(() => {
    expect(result.current.dispatch({ type: "REMOVE_COURSE", semesterId: "sem-1", instanceId: before.semesters[0].courses[0].instanceId })).toBe(false);
  });
  expect(result.current.state).toBe(before);
  expect(result.current.error).toMatch(/protected/i);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("failed saves remain visible, survive remount, and retry with the same identity", async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error("Offline"));
  const first = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
  act(() => { first.result.current.dispatch({ type: "COMPLETE_SEMESTER", semesterId: "sem-1" }); });
  await waitFor(() => expect(first.result.current.saveStatus.kind).toBe("error"));
  const pendingState = first.result.current.state;
  const originalBody = global.fetch.mock.calls[0][1].body;
  expect(first.result.current.blocked).toBe(true);
  first.unmount();
  global.fetch.mockResolvedValueOnce(savedResponse(1, pendingState));
  const second = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
  expect(second.result.current.state).toEqual(pendingState);
  expect(second.result.current.saveStatus.kind).toBe("pending");
  act(() => { second.result.current.retrySave(); });
  await waitFor(() => expect(second.result.current.saveStatus.kind).toBe("idle"));
  expect(global.fetch.mock.calls[1][1].body).toBe(originalBody);
});

test("conflicts preserve local changes until the user loads the authoritative saved plan", async () => {
  const saved = createDefaultState(curriculum);
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "Changed in another session" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { ...user, plannerVersion: 8, plannerState: saved } }) });
  const { result } = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
  act(() => { result.current.dispatch({ type: "COMPLETE_SEMESTER", semesterId: "sem-1" }); });
  await waitFor(() => expect(result.current.saveStatus.kind).toBe("conflict"));
  expect(result.current.state.currentSemester).toBe(2);
  await act(async () => { await result.current.reloadSavedPlan(); });
  expect(result.current.state).toEqual(saved);
  expect(result.current.blocked).toBe(false);
  expect(sessionStorage.getItem(draftKey(user.studentId))).toBeNull();
});

test("personalized plan reload remains exact without an engine action or save", () => {
  const saved = createDefaultState(curriculum);
  saved.personalized = true;
  saved.semesters[3].courses.unshift(saved.semesters[1].courses.pop());
  global.fetch = jest.fn();
  const { result } = renderHook(() => usePlanner({ user: { ...user, plannerState: saved }, setUser: jest.fn(), curriculum }));
  expect(result.current.state).toEqual(saved);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a malformed pending draft is preserved and blocks edits until explicit recovery", () => {
  sessionStorage.setItem(draftKey(user.studentId), "invalid-json");
  global.fetch = jest.fn();
  const { result } = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
  expect(result.current.blocked).toBe(true);
  expect(result.current.error).toMatch(/draft is unreadable/);
  act(() => { expect(result.current.dispatch({ type: "REBALANCE" })).toBe(false); });
  expect(sessionStorage.getItem(draftKey(user.studentId))).toBe("invalid-json");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("storage failures remain visible while an unsaved action is pending", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage quota exceeded"); });
  try {
    const { result } = renderHook(() => usePlanner({ user, setUser: jest.fn(), curriculum }));
    act(() => { result.current.dispatch({ type: "COMPLETE_SEMESTER", semesterId: "sem-1" }); });
    expect(result.current.warnings).toContainEqual(expect.objectContaining({ code: "DRAFT_STORAGE_UNAVAILABLE" }));
    expect(result.current.state.currentSemester).toBe(2);
  } finally {
    storage.mockRestore();
  }
});
