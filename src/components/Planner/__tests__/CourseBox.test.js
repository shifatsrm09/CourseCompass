import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CourseBox from "../CourseBox";

describe("CourseBox problem (red) vs warning (yellow)", () => {
  const baseCourse = {
    code: "CSE111",
    displayName: "CSE111",
    occurrenceId: "CSE111@2:1",
    instanceId: "course:CSE111@2:1",
  };

  test("renders in yellow (amber) when only soft prerequisite issues (warnings) exist", () => {
    const softIssue = [
      {
        prereqCode: "MAT110",
        courseSemester: 2,
        prereqStatus: "MAT110 is scheduled in Semester 3",
        isHard: false,
      },
    ];

    render(
      <CourseBox
        course={baseCourse}
        isDesigner={true}
        prerequisiteIssues={softIssue}
      />
    );

    const button = screen.getByRole("button", { name: /CSE111 \(prerequisite warning\)/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("border-amber-500/80");
    expect(button.className).toContain("text-amber-200");

    const icon = screen.getByLabelText("Prerequisite warning");
    expect(icon).toBeInTheDocument();
    expect(icon.className).toContain("text-amber-400");

    // Open tooltip
    fireEvent.click(icon);
    expect(screen.getByText("Soft prerequisite warning")).toBeInTheDocument();
    expect(screen.getByText("Soft prerequisite warning").parentElement.className).toContain("text-amber-400");
  });

  test("renders in red when a hard prerequisite issue (problem) exists", () => {
    const hardIssue = [
      {
        prereqCode: "CSE110",
        courseSemester: 1,
        prereqStatus: "CSE110 is scheduled in Semester 2 (after this course)",
        isHard: true,
      },
    ];

    render(
      <CourseBox
        course={baseCourse}
        isDesigner={true}
        prerequisiteIssues={hardIssue}
      />
    );

    const button = screen.getByRole("button", { name: /CSE111 \(prerequisite problem\)/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("border-red-500/80");
    expect(button.className).toContain("text-red-200");

    const icon = screen.getByLabelText("Prerequisite problem");
    expect(icon).toBeInTheDocument();
    expect(icon.className).toContain("text-red-400");

    // Open tooltip
    fireEvent.click(icon);
    expect(screen.getByText("Prerequisite not satisfied")).toBeInTheDocument();
    expect(screen.getByText("Prerequisite not satisfied").parentElement.className).toContain("text-red-400");
  });
});
