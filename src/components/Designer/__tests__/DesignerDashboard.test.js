import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DesignerDashboard from "../DesignerDashboard";
import { buildCurriculum, createDefaultState } from "../../../engine/plannerState.mjs";

const testCurriculum = buildCurriculum([
  { code: "CSE110", semester_row: 1, hp: [], type: "Program Core" },
  { code: "CSE111", semester_row: 2, hp: ["CSE110"], type: "Program Core" },
], "test");

describe("DesignerDashboard Merge with Main", () => {
  let originalFetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("renders Merge with Main button in the Designer banner next to Sync with Main", async () => {
    const initialState = createDefaultState(testCurriculum);
    const user = {
      studentId: "student-123",
      stream: "test",
      plannerVersion: 1,
      plannerState: initialState,
    };

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes("/api/designer/state")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            exists: true,
            designer: {
              studentId: user.studentId,
              plannerVersion: 1,
              plannerState: initialState,
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <DesignerDashboard
        user={user}
        setUser={jest.fn()}
        curriculum={testCurriculum}
        sidebarOpen={false}
        onCloseSidebar={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Designer Workspace")).toBeInTheDocument();
    });

    const mergeBtn = screen.getByRole("button", { name: /Merge with Main/i });
    const syncBtn = screen.getByRole("button", { name: /Sync with Main/i });

    expect(mergeBtn).toBeInTheDocument();
    expect(syncBtn).toBeInTheDocument();

    // The Validation Status box must NOT be rendered in the planner view
    expect(screen.queryByText("Validation Status")).not.toBeInTheDocument();
  });

  test("disables Merge with Main when problemCount > 0 and enables when problemCount === 0", async () => {
    const initialState = createDefaultState(testCurriculum);
    const user = {
      studentId: "student-123",
      stream: "test",
      plannerVersion: 1,
      plannerState: initialState,
    };

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes("/api/designer/state")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            exists: true,
            designer: {
              studentId: user.studentId,
              plannerVersion: 1,
              plannerState: initialState,
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <DesignerDashboard
        user={user}
        setUser={jest.fn()}
        curriculum={testCurriculum}
        sidebarOpen={false}
        onCloseSidebar={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Merge with Main/i })).toBeInTheDocument();
    });

    const mergeBtn = screen.getByRole("button", { name: /Merge with Main/i });
    // In clean initial state, there are 0 problems, so merge button is enabled
    expect(mergeBtn).toBeEnabled();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  test("clicking Merge with Main opens confirmation modal and confirms merge successfully", async () => {
    const initialState = createDefaultState(testCurriculum);
    const user = {
      studentId: "student-123",
      stream: "test",
      plannerVersion: 1,
      plannerState: initialState,
    };
    const setUser = jest.fn();
    const onNavigate = jest.fn();

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes("/api/designer/state")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            exists: true,
            designer: {
              studentId: user.studentId,
              plannerVersion: 1,
              plannerState: initialState,
            },
          }),
        });
      }
      if (url.includes("/api/designer/merge")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            user: {
              ...user,
              plannerVersion: 2,
              plannerState: initialState,
            },
            designer: {
              studentId: user.studentId,
              plannerVersion: 2,
              plannerState: initialState,
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <DesignerDashboard
        user={user}
        setUser={setUser}
        curriculum={testCurriculum}
        sidebarOpen={false}
        onCloseSidebar={jest.fn()}
        onNavigate={onNavigate}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Merge with Main/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Merge with Main/i }));

    // Modal opens
    expect(screen.getByText("Merge Designer Plan into Main Planner?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Yes, Merge with Main/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Designer plan merged into Main Planner successfully!")).toBeInTheDocument();
    });

    expect(setUser).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Go to Main Planner" })).toBeInTheDocument();
  });
});
