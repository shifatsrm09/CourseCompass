/**
 * ---------------------------------------------------------------------
 * ConfirmModal.js
 * ---------------------------------------------------------------------
 * PURPOSE:
 * A small confirmation dialog used when the user attempts
 * to "Complete a Semester".
 *
 * ROLE IN SYSTEM:
 * - Displays a modal overlay with two actions:
 *      ✔ Confirm completion of the semester
 *      ✔ Cancel the action
 *
 * WHY THIS EXISTS:
 * Completing a semester is a critical irreversible action
 * (it updates DB state and moves user to next semester).
 * This modal ensures the user does not click it accidentally.
 *
 * PROPS:
 * - visible       → controls whether modal is rendered
 * - onConfirm     → callback when user confirms
 * - onCancel      → callback when user cancels
 * - semester      → semester number shown in title
 *
 * USED IN:
 * - CoursePlanner (index.js)
 *
 * BEHAVIOR:
 * - When visible = false → returns null (not in DOM)
 * - Shows overlay + box + actions
 * ---------------------------------------------------------------------
 */

import React from "react";
import "../../styles/confirmModal.css";

export default function ConfirmModal({
  visible,
  onConfirm,
  onCancel,
  semester,
}) {
  if (!visible) return null;

  return (
    <div className="confirm-overlay">
      <div className="confirm-box">
        <h3 className="confirm-title">Complete Semester {semester}?</h3>

        <p className="confirm-text">
          Are you sure you have completed all courses in this semester?
        </p>

        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>

          <button className="confirm-btn confirm" onClick={onConfirm}>
            Yes, Complete
          </button>
        </div>
      </div>
    </div>
  );
}
