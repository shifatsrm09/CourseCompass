import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DesignerIssuesPanel from "../DesignerIssuesPanel";

describe("DesignerIssuesPanel", () => {
  const mockValidationResult = {
    problems: [
      {
        id: "problem:prereq:1:CSE110",
        type: "PREREQUISITE_VIOLATION",
        severity: "problem",
        title: "Prerequisite violation",
        message: "CSE111 requires CSE110, but CSE110 is scheduled after CSE111.",
        courses: ["CSE111", "CSE110"],
        semesters: [2, 3],
        instanceIds: ["inst-cse111", "inst-cse110"],
        primarySemester: 2,
        primarySemesterId: "sem-2",
      },
      {
        id: "problem:overload:sem-5",
        type: "COURSE_OVERLOAD",
        severity: "problem",
        title: "Course overload",
        message: "Semester 5 contains 6 courses. The maximum recommended load is 5.",
        courses: ["CSE321", "CSE331", "CSE340", "CSE341", "CSE360", "CSE370"],
        semesters: [5],
        instanceIds: ["c1", "c2", "c3", "c4", "c5", "c6"],
        primarySemester: 5,
        primarySemesterId: "sem-5",
      },
    ],
    warnings: [
      {
        id: "warning:lab:sem-4",
        type: "LAB_OVERLOAD",
        severity: "warning",
        title: "Heavy lab load",
        message: "Semester 4 contains 4 lab courses. Recommended maximum is 3.",
        courses: ["CSE110", "CSE111", "CSE220", "PHY111"],
        semesters: [4],
        instanceIds: ["l1", "l2", "l3", "l4"],
        primarySemester: 4,
        primarySemesterId: "sem-4",
      },
    ],
    summary: {
      problemCount: 2,
      warningCount: 1,
      totalCount: 3,
    },
  };

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <DesignerIssuesPanel
        isOpen={false}
        onClose={jest.fn()}
        validationResult={mockValidationResult}
        onLocateIssue={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renders issues and tabs correctly when open", () => {
    render(
      <DesignerIssuesPanel
        isOpen={true}
        onClose={jest.fn()}
        initialTab="problems"
        validationResult={mockValidationResult}
        onLocateIssue={jest.fn()}
      />
    );

    expect(screen.getByText("Workspace Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Problems 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Warnings 1/i })).toBeInTheDocument();

    // Problems tab shows the 2 problems
    expect(screen.getByText("Prerequisite violation")).toBeInTheDocument();
    expect(screen.getByText("Course overload")).toBeInTheDocument();
    expect(screen.getByText(/CSE111 requires CSE110/i)).toBeInTheDocument();
  });

  test("switches between Problems, Warnings, and All tabs", () => {
    render(
      <DesignerIssuesPanel
        isOpen={true}
        onClose={jest.fn()}
        initialTab="problems"
        validationResult={mockValidationResult}
        onLocateIssue={jest.fn()}
      />
    );

    // Click Warnings tab
    fireEvent.click(screen.getByRole("button", { name: /Warnings 1/i }));
    expect(screen.getByText("Heavy lab load")).toBeInTheDocument();
    expect(screen.getByText(/Semester 4 contains 4 lab courses/i)).toBeInTheDocument();
    expect(screen.queryByText("Course overload")).not.toBeInTheDocument();

    // Click All tab
    fireEvent.click(screen.getByRole("button", { name: /All 3/i }));
    expect(screen.getByText("Prerequisite violation")).toBeInTheDocument();
    expect(screen.getByText("Course overload")).toBeInTheDocument();
    expect(screen.getByText("Heavy lab load")).toBeInTheDocument();
  });

  test("clicking View in Planner triggers onLocateIssue", () => {
    const onLocate = jest.fn();
    render(
      <DesignerIssuesPanel
        isOpen={true}
        onClose={jest.fn()}
        initialTab="problems"
        validationResult={mockValidationResult}
        onLocateIssue={onLocate}
      />
    );

    const viewButtons = screen.getAllByRole("button", { name: /View in Planner/i });
    expect(viewButtons.length).toBe(2);

    fireEvent.click(viewButtons[0]);
    expect(onLocate).toHaveBeenCalledWith(mockValidationResult.problems[0]);
  });

  test("clicking close button calls onClose", () => {
    const onClose = jest.fn();
    render(
      <DesignerIssuesPanel
        isOpen={true}
        onClose={onClose}
        initialTab="problems"
        validationResult={mockValidationResult}
        onLocateIssue={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Close panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
