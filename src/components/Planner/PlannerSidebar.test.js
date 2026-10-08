import React from "react";
import { render, screen } from "@testing-library/react";
import PlannerSidebar, { DiagnosticsBadge } from "./PlannerSidebar";

describe("PlannerSidebar diagnostics badges", () => {
  test("does not render diagnostics badge when not in designer mode", () => {
    render(
      <PlannerSidebar
        open={true}
        onClose={jest.fn()}
        stream="CSE"
        totalCourses={40}
        repeatCount={0}
        blocked={false}
        isDesigner={false}
        errorCount={0}
        warningCount={0}
      />
    );

    expect(screen.queryByLabelText(/0 errors, 0 warnings/i)).not.toBeInTheDocument();
  });

  test("renders diagnostics badge on Designer button and in Statistics when in designer mode", () => {
    render(
      <PlannerSidebar
        open={true}
        onClose={jest.fn()}
        stream="CSE"
        totalCourses={40}
        repeatCount={0}
        blocked={false}
        isDesigner={true}
        errorCount={0}
        warningCount={0}
      />
    );

    const badges = screen.getAllByLabelText(/0 errors, 0 warnings/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Badges contain 0 count text
    expect(badges[0]).toHaveTextContent("0");
  });

  test("renders active counts when there are errors and warnings", () => {
    render(
      <PlannerSidebar
        open={true}
        onClose={jest.fn()}
        stream="CSE"
        totalCourses={40}
        repeatCount={1}
        blocked={false}
        isDesigner={true}
        errorCount={1}
        warningCount={2}
        diagnosticsTooltip="1 error, 2 warnings&#10;• Prerequisite warning: CSE251 requires CSE250"
      />
    );

    const badges = screen.getAllByLabelText(/1 errors, 2 warnings/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges[0]).toHaveTextContent("1");
    expect(badges[0]).toHaveTextContent("2");
  });

  test("DiagnosticsBadge displays correct SVG icons and labels", () => {
    const { container } = render(
      <DiagnosticsBadge errorCount={3} warningCount={4} title="3 errors, 4 warnings" />
    );

    expect(container.querySelectorAll("svg").length).toBe(2);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
