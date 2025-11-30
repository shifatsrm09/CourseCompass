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
