// src/components/Planner/CoursePlanner/PlannerHeader.js - MINIMAL
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
    <div className="planner-header-section">
      <h1 className="planner-title">Course Planner</h1>
      <p className="planner-subtitle">
        Plan your academic journey
      </p>
      
      <div className="planner-stats">
        <div className="stat-item">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Taken</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value" style={{
            color: total >= expected ? 'var(--accent-green)' : 'var(--text-primary)'
          }}>
            {expected}
          </div>
          <div className="stat-label">Required</div>
        </div>
      </div>
    </div>
  );
}