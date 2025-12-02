/**
 * =========================================================================
 * PlannerHeader.js
 * =========================================================================
 * PURPOSE:
 *   Displays the top bar of the planner containing:
 *     ✔ Title (“Course Planner”)
 *     ✔ Total course count (compared with expected stream count)
 *
 * RESPONSIBILITY:
 *   - Count total courses across all semester slots
 *   - Compare with streamConfig.expectedCount
 *   - Show a green/red indicator for match/mismatch
 *
 * WHY THIS FILE EXISTS:
 *   The old CoursePlanner.js had UI, logic, sync, and counters all
 *   mixed together. Extracting the header improves readability and keeps
 *   index.js focused on orchestration.
 *
 * INPUT:
 *   - semesterSlots → full planner structure
 *   - streamId      → selected stream
 *
 * OUTPUT:
 *   - JSX block containing planner heading + course counter
 *
 * USED BY:
 *   - CoursePlanner/index.js
 * =========================================================================
 */

// src/components/Planner/CoursePlanner/PlannerHeader.js
import React from "react";
import streamsConfig, { DEFAULT_STREAM_ID } from "../../../data/streamsConfig";

export default function PlannerHeader({ semesterSlots, streamId }) {
  const total = semesterSlots.reduce(
    (sum, sem) => sum + (sem.courses?.length || 0),
    0
  );

  const expected =
    streamsConfig[streamId]?.expectedCount ??
    streamsConfig[DEFAULT_STREAM_ID].expectedCount;

  return (
    <>
      <h2 className="planner-title">Course Planner</h2>
      <div
        style={{
          marginBottom: "12px",
          background: "#222",
          padding: "8px 12px",
          display: "inline-block",
          borderRadius: "6px",
          fontWeight: 600,
          fontSize: "14px",
          color: "#ddd",
        }}
      >
        Total Courses:{" "}
        <span
          style={{
            color: total === expected ? "#4ade80" : "#f87171",
          }}
        >
          {total}
        </span>{" "}
        / {expected}
      </div>{" "}
      Total : 45 (Thesis)
    </>
  );
}
