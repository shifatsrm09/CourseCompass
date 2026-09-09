import React, { useEffect } from "react";
import "../../styles/confirmModal.css";

export default function ConfirmModal({ visible, onConfirm, onCancel, semester, disabled = false, error = "" }) {
  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [visible, onCancel]);

  if (!visible) return null;
  return (
    <div className="confirm-overlay" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="complete-semester-title">
        <h3 className="confirm-title" id="complete-semester-title">Complete Semester {semester}?</h3>
        <p className="confirm-text">Are you sure you have completed all courses in this semester?</p>
        {error && <p role="alert" className="planner-error">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm-btn confirm" onClick={onConfirm} disabled={disabled}>Yes, Complete</button>
        </div>
      </div>
    </div>
  );
}
