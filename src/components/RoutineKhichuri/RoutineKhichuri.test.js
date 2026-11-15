import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoutineKhichuri from "./RoutineKhichuri";

// Mock fetch
beforeEach(() => {
  global.fetch = jest.fn((url, options) => {
    const urlString = String(url);
    if (urlString.includes("/api/course-codes")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalCodes: 3, courseCodes: ["CSE111", "MAT120", "PHY112"] }),
      });
    }
    if (urlString.includes("/api/health")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            sourceMetadataLastUpdated: "2026-11-15T12:00:00Z",
            lastRefreshCompletedAt: "2026-11-15T12:05:00Z",
          }),
      });
    }
    if (urlString.includes("/api/course-faculties")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ facultiesByCourse: { CSE111: ["DHD", "TBA"] } }),
      });
    }
    if (urlString.includes("/api/course-sections")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            sectionsByCourse: {
              CSE111: [
                {
                  sectionId: "1",
                  sectionName: "01",
                  faculties: "DHD",
                  remainingSeats: 5,
                  sectionSchedule: {
                    classSchedules: [{ day: "SUNDAY", startTime: "08:00:00", endTime: "09:20:00" }],
                    labSchedules: [{ day: "TUESDAY", startTime: "08:00:00", endTime: "10:50:00" }],
                  },
                },
              ],
            },
          }),
      });
    }
    if (urlString.includes("/api/generate-routine")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            routines: [
              {
                sections: [
                  {
                    courseCode: "CSE111",
                    sectionName: "01",
                    faculties: "DHD",
                    remainingSeats: 5,
                    sectionSchedule: {
                      classSchedules: [{ day: "SUNDAY", startTime: "08:00:00", endTime: "09:20:00" }],
                      labSchedules: [],
                    },
                  },
                ],
                metrics: { score: 95, totalDays: 2, avgDailyHours: 1.5 },
                exams: [{ type: "MID", courseCode: "CSE111", date: "2026-12-01", startTime: "09:00:00", endTime: "11:00:00" }],
                examClashes: [],
              },
            ],
            stats: { generatedRoutines: 1, totalCombinations: 1 },
          }),
      });
    }
    return Promise.reject(new Error("Unknown URL: " + urlString));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RoutineKhichuri Component", () => {
  test("renders hero header, course selection and scheduling settings", async () => {
    const onBackToPlanner = jest.fn();
    render(<RoutineKhichuri onBackToPlanner={onBackToPlanner} suggestedCourses={["CSE111"]} currentSemesterLabel="Fall 2026" />);

    expect(screen.getByText("ROUTINER KHICHURI")).toBeInTheDocument();
    expect(screen.getByText("Aj prochur routine banabo.")).toBeInTheDocument();

    const backBtn = screen.getByRole("button", { name: /back to planner/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBackToPlanner).toHaveBeenCalled();

    // Import suggested courses button
    const importBtn = screen.getByRole("button", { name: /\+ import from fall 2026/i });
    expect(importBtn).toBeInTheDocument();

    // Course selection search input
    const input = screen.getByPlaceholderText(/search course code/i);
    expect(input).toBeInTheDocument();

    // Wait for course codes to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/course-codes"));
    });
  });

  test("adds a course code, toggles preferences, and generates routine", async () => {
    render(<RoutineKhichuri />);

    const input = screen.getByPlaceholderText(/search course code/i);
    fireEvent.change(input, { target: { value: "CSE111" } });

    const addBtn = screen.getByRole("button", { name: "Add" });
    fireEvent.click(addBtn);

    // Course chip should appear
    expect(screen.getAllByText("CSE111").length).toBeGreaterThan(0);

    // Wait for faculty options
    await waitFor(() => {
      expect(screen.getByText("Faculty Preferences")).toBeInTheDocument();
    });

    // Generate routine
    const generateBtn = screen.getByRole("button", { name: /generate routine/i });
    expect(generateBtn).not.toBeDisabled();
    fireEvent.click(generateBtn);

    // Should call /api/generate-routine and render result
    await waitFor(() => {
      expect(screen.getByText(/routine #1/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/download routine/i)).toBeInTheDocument();
  });
});
