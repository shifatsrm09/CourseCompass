import React, { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CoursePlanner from "./CoursePlanner";
import { buildCurriculum } from "../../engine/plannerState.mjs";

const curriculum = buildCurriculum([
  { code: "A", semester_row: 1, hp: [], type: "Program Core" },
  { code: "B", semester_row: 2, hp: ["A"], type: "Program Core" },
  { code: "T", semester_row: 3, hp: [], is_tarc: true, type: "GenEd" },
  { code: "C", semester_row: 4, hp: ["B"], type: "Program Core" },
  { code: "X", semester_row: 4, hp: [], type: "Program Core" },
  { code: "COD", semester_row: 4, hp: [], type: "GenEd" },
  { code: "D", semester_row: 5, hp: ["C"], type: "Program Core" },
  { code: "Y", semester_row: 5, hp: [], type: "Program Core" },
  { code: "COD", semester_row: 5, hp: [], type: "GenEd" },
  { code: "E", semester_row: 6, hp: ["D"], type: "Program Core" },
  { code: "Z", semester_row: 6, hp: [], type: "Program Core" },
], "test");
const user = { studentId: "student", stream: "test", plannerVersion: 0 };
const row = (semester) => screen.getByLabelText(`Semester ${semester}`, { selector: ".planner-row" });
let originalFetch;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  originalFetch = global.fetch;
  global.fetch = jest.fn(async (_url, options) => {
    const body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ success: true, plannerVersion: body.expectedVersion + 1, user: { ...user, plannerVersion: body.expectedVersion + 1, plannerState: body.plannerState } }),
    };
  });
});
afterEach(() => { global.fetch = originalFetch; });
const mount = (savedUser = user) => render(<StrictMode><CoursePlanner user={savedUser} setUser={jest.fn()} curriculum={curriculum} /></StrictMode>);

test("default cards render without saves and protect current and TARC courses", () => {
  mount();
  expect(within(row(1)).getByRole("button", { name: "A" })).toBeDisabled();
  expect(within(row(1)).queryByRole("button", { name: /Add Course/ })).not.toBeInTheDocument();
  expect(within(row(3)).getByRole("button", { name: "T" })).toBeDisabled();
  expect(within(row(3)).queryByRole("button", { name: /Add Course/ })).not.toBeInTheDocument();
  expect(screen.getByText("Total Courses: 11")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("removing a prerequisite updates the complete dependency chain in the visible cards", async () => {
  mount();
  fireEvent.click(within(row(2)).getByRole("button", { name: "Edit B" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Course" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(row(4)).getByRole("button", { name: "Edit B" })).toBeInTheDocument();
  expect(within(row(5)).getByRole("button", { name: "Edit C" })).toBeInTheDocument();
  expect(within(row(6)).getByRole("button", { name: "Edit D" })).toBeInTheDocument();
  expect(within(row(7)).getByRole("button", { name: "Edit E" })).toBeInTheDocument();
  expect(screen.getByText("Total Courses: 11")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("COD search stays compact and selecting it relocates the closest future occurrence", async () => {
  mount();
  fireEvent.click(within(row(2)).getByRole("button", { name: /Add Course/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByPlaceholderText("Search by course code..."), { target: { value: "cOd" } });
  expect(within(dialog).getAllByRole("button", { name: "COD" })).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "COD" }));
  expect(within(row(2)).getByRole("button", { name: "Edit COD" })).toBeInTheDocument();
  expect(within(row(4)).queryByRole("button", { name: "Edit COD" })).not.toBeInTheDocument();
  expect(within(row(5)).getByRole("button", { name: "Edit COD" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Edit COD" })).toHaveLength(2);
  await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
});

test("illegal prerequisite selection keeps the modal and previous plan with a meaningful error", () => {
  mount();
  fireEvent.click(within(row(2)).getByRole("button", { name: /Add Course/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "E HP: D" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(within(dialog).getByRole("alert")).toHaveTextContent(/prerequisite|requires|before/i);
  expect(within(row(6)).getByRole("button", { name: "Edit E" })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("completion updates statuses and protection through the same canonical save", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Complete Semester 1" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, Complete" }));
  expect(within(row(1)).getAllByText("COMPLETED").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Complete Semester 2" })).toBeInTheDocument();
  expect(within(row(2)).getByRole("button", { name: "B" })).toBeDisabled();
  await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
  expect(global.fetch.mock.calls[0][0]).toBe("/api/planner/save-plan");
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).plannerState.completedCourses).toContain("A");
});

test("a previous course error does not leak into a new completion or edit dialog", () => {
  mount();
  fireEvent.click(within(row(2)).getByRole("button", { name: /Add Course/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "E HP: D" }));
  expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Complete Semester 1" }));
  expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  fireEvent.click(within(row(4)).getByRole("button", { name: "Edit X" }));
  expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
});

test("completed courses in future slots stay visible, marked, and unavailable for editing", () => {
  mount({ ...user, completedCourses: ["X"] });
  expect(within(row(4)).getByRole("button", { name: "X" })).toBeDisabled();
  expect(within(row(4)).getByText("COMPLETED")).toBeInTheDocument();
  fireEvent.click(within(row(2)).getByRole("button", { name: /Add Course/ }));
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "X" })).not.toBeInTheDocument();
});
