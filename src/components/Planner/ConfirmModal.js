import React from "react";
import "../../styles/modal.css";

export default function ConfirmModal({ visible, onConfirm, onCancel, semester }) {
  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3 className="modal-title">Complete Semester {semester}?</h3>
        <p className="modal-text">
          Are you sure you have completed all courses in this semester?
        </p>

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>

          <button className="modal-btn confirm" onClick={onConfirm}>
            Yes, Complete
          </button>
        </div>
      </div>
    </div>
  );
}
