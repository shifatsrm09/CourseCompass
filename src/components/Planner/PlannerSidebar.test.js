import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PlannerSidebar from "./PlannerSidebar";
import { STREAM_PDF_LINKS } from "../../data/streamPdfs";

describe("PlannerSidebar - Stream PDF dropdown", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    stream: "ENG101 + MAT110",
    totalCourses: 40,
    repeatCount: 0,
    blocked: false,
    onBalance: jest.fn(),
    onSyncGradesheet: jest.fn(),
    onChangePlan: jest.fn(),
    gradesheetPanel: null,
  };

  test("renders Stream PDF button in sidebar", () => {
    render(<PlannerSidebar {...defaultProps} />);
    const streamPdfBtn = screen.getByRole("button", { name: /stream pdf/i });
    expect(streamPdfBtn).toBeInTheDocument();
    expect(streamPdfBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking Stream PDF expands CS and CSE buttons with smooth animation", () => {
    render(<PlannerSidebar {...defaultProps} />);
    const streamPdfBtn = screen.getByRole("button", { name: /stream pdf/i });

    // Initially collapsed
    const dropdown = document.getElementById("sidebar-stream-pdf");
    expect(dropdown).toHaveClass("grid-rows-[0fr]");

    // Click to expand
    fireEvent.click(streamPdfBtn);
    expect(streamPdfBtn).toHaveAttribute("aria-expanded", "true");
    expect(dropdown).toHaveClass("grid-rows-[1fr]");

    // CS and CSE buttons are present
    const csBtn = screen.getByRole("button", { name: /^cs\b/i });
    const cseBtn = screen.getByRole("button", { name: /^cse\b/i });
    expect(csBtn).toBeInTheDocument();
    expect(cseBtn).toBeInTheDocument();
    expect(csBtn).toHaveAttribute("aria-expanded", "false");
    expect(cseBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking CS expands CS stream links pointing to correct Drive files", () => {
    render(<PlannerSidebar {...defaultProps} />);
    const streamPdfBtn = screen.getByRole("button", { name: /stream pdf/i });
    fireEvent.click(streamPdfBtn);

    const csBtn = screen.getByRole("button", { name: /^cs\b/i });
    const csDropdown = document.getElementById("stream-pdf-dept-CS");
    expect(csDropdown).toHaveClass("grid-rows-[0fr]");

    fireEvent.click(csBtn);
    expect(csBtn).toHaveAttribute("aria-expanded", "true");
    expect(csDropdown).toHaveClass("grid-rows-[1fr]");

    const csContainer = within(csDropdown);
    for (const item of STREAM_PDF_LINKS.CS) {
      const link = csContainer.getByRole("link", { name: new RegExp(item.label.replace("+", "\\+")) });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", item.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("clicking CSE expands CSE stream links pointing to correct Drive files", () => {
    render(<PlannerSidebar {...defaultProps} />);
    const streamPdfBtn = screen.getByRole("button", { name: /stream pdf/i });
    fireEvent.click(streamPdfBtn);

    const cseBtn = screen.getByRole("button", { name: /^cse\b/i });
    const cseDropdown = document.getElementById("stream-pdf-dept-CSE");
    expect(cseDropdown).toHaveClass("grid-rows-[0fr]");

    fireEvent.click(cseBtn);
    expect(cseBtn).toHaveAttribute("aria-expanded", "true");
    expect(cseDropdown).toHaveClass("grid-rows-[1fr]");

    const cseContainer = within(cseDropdown);
    for (const item of STREAM_PDF_LINKS.CSE) {
      const link = cseContainer.getByRole("link", { name: new RegExp(item.label.replace("+", "\\+")) });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", item.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("clicking Stream PDF again collapses the menu", () => {
    render(<PlannerSidebar {...defaultProps} />);
    const streamPdfBtn = screen.getByRole("button", { name: /stream pdf/i });
    fireEvent.click(streamPdfBtn);
    expect(streamPdfBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(streamPdfBtn);
    expect(streamPdfBtn).toHaveAttribute("aria-expanded", "false");
    const dropdown = document.getElementById("sidebar-stream-pdf");
    expect(dropdown).toHaveClass("grid-rows-[0fr]");
  });
});
