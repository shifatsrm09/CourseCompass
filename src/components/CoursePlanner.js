import React, { useState } from "react";
import "../styles/planner.css";
import ConfirmModal from "./ConfirmModal";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CourseEditModal from "./CourseEditModal";

const API_BASE = process.env.REACT_APP_API_URL;

export default function CoursePlanner({
  user,
  orderedCourses,
  currentSemester,
  setCurrentSemester,
  allCourses = [],
}) {
  const [showModal, setShowModal] = useState(false);

  const [semesterSlots, setSemesterSlots] = useState(
    orderedCourses.map((row) => ({
      id: `sem-${row.semester_row}`,
      originalRow: row.semester_row,
      courses: row.courses,
      isTarc: row.courses.some((c) => c.is_tarc),
    }))
  );

  // state for add / replace modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalCourses, setModalCourses] = useState([]);
  const [modalContext, setModalContext] = useState(null);
  // modalContext: { mode: "add" | "replace", semesterIndex: number, courseIndex?: number }

  const getStatus = (index) => {
    const safe = currentSemester || 1;

    if (index < safe - 1) return "completed";
    if (index === safe - 1) return "current";
    if (index === safe) return "recommended";
    return "locked";
  };

  const openPrompt = () => {
    setShowModal(true);
  };

  const cancelComplete = () => {
    setShowModal(false);
  };

  const confirmComplete = async () => {
    setShowModal(false);

    try {
      const res = await fetch(`${API_BASE}/planner/complete-semester`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.studentId }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        const raw = await res.text();
        console.error("Unexpected backend response:", raw);
        alert("Unexpected server response.");
        return;
      }

      if (!data.success) {
        alert("Error: " + data.error);
        return;
      }

      setCurrentSemester(data.user.currentSemester, data.user);
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error contacting server.");
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    const tarcIndex = semesterSlots.findIndex((s) => s.isTarc);

    // TARC can only be moved when NOT completed
    if (from !== tarcIndex) return;

    const tarcStatus = getStatus(tarcIndex);

    if (tarcStatus === "completed") return; // LOCKED FOREVER

    // must stay ≥ 3rd position in UI
    if (to < 2) return;

    const updated = [...semesterSlots];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSemesterSlots(updated);

    const newOrder = updated.map((s) => s.originalRow);

    await fetch(`${API_BASE}/planner/save-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: user.studentId,
        order: newOrder,
      }),
    });
  };

  // ---- Add / Drop / Modify helpers ----

  const handleDropCourse = (semesterIndex, courseIndex) => {
    setSemesterSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== semesterIndex) return slot;
        // don't allow editing TARC courses
        if (slot.isTarc) return slot;

        const newCourses = slot.courses.filter((_, i) => i !== courseIndex);
        return { ...slot, courses: newCourses };
      })
    );
  };

  const openAddCourseModal = (semesterIndex) => {
    const slot = semesterSlots[semesterIndex];

    if (slot.isTarc) return;
    if (slot.courses.length >= 5) return;

    const usedCodes = new Set(slot.courses.map((c) => c.code));
    const selectable = allCourses.filter((c) => !usedCodes.has(c.code));

    setModalCourses(selectable);
    setModalContext({ mode: "add", semesterIndex });
    setEditModalVisible(true);
  };

  const openReplaceCourseModal = (semesterIndex, courseIndex) => {
    const slot = semesterSlots[semesterIndex];

    if (slot.isTarc) return;

    const usedCodes = new Set(
      slot.courses.map((c, i) => (i === courseIndex ? null : c.code))
    );
    const selectable = allCourses.filter((c) => !usedCodes.has(c.code));

    setModalCourses(selectable);
    setModalContext({ mode: "replace", semesterIndex, courseIndex });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalContext(null);
    setModalCourses([]);
  };

  const handleCourseSelected = (course) => {
    if (!modalContext) return;

    const { mode, semesterIndex, courseIndex } = modalContext;

    setSemesterSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== semesterIndex) return slot;
        if (slot.isTarc) return slot;

        const newCourses = [...slot.courses];

        if (mode === "add") {
          if (newCourses.length >= 5) return slot;
          newCourses.push(course);
        } else if (mode === "replace" && courseIndex != null) {
          newCourses[courseIndex] = course;
        }

        return { ...slot, courses: newCourses };
      })
    );

    closeEditModal();
  };

  return (
    <div className="planner-container">
      <h2 className="planner-title">Course Planner</h2>

      <ConfirmModal
        visible={showModal}
        onConfirm={confirmComplete}
        onCancel={cancelComplete}
        semester={currentSemester || 1}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="semesters" direction="vertical">
          {(provided) => (
            <div
              className="planner-grid"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {semesterSlots.map((slot, index) => {
                const status = getStatus(index);
                const isCurrent = status === "current";

                // Disable dragging ONLY when TARC itself is COMPLETED
                const disableDrag =
                  !slot.isTarc || status === "completed";

                return (
                  <Draggable
                    key={slot.id}
                    draggableId={slot.id}
                    index={index}
                    isDragDisabled={disableDrag}
                  >
                    {(dragProvided, snapshot) => (
                      <div
                        className={`planner-row ${
                          snapshot.isDragging ? "dragging" : ""
                        }`}
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                      >
                        <div
                          className={`drag-handle ${
                            disableDrag ? "drag-disabled" : ""
                          }`}
                          {...(!disableDrag
                            ? dragProvided.dragHandleProps
                            : {})}
                        >
                          {!disableDrag && slot.isTarc ? "☰" : ""}
                        </div>

                        <div className="row-main">
                          <div className="row-header">
                            <div className="semester-col">
                              Semester {index + 1}
                            </div>

                            <div className="row-badges">
                              {slot.isTarc && (
                                <span className="tarc-pill">TARC</span>
                              )}

                              <div
                                className={`status-col status-${status} ${
                                  isCurrent ? "status-clickable" : ""
                                }`}
                                onClick={isCurrent ? openPrompt : undefined}
                              >
                                {status.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          <div className="courses-col">
                            {slot.courses.map((course, cIndex) => (
                              <div
                                className={`course-box ${
                                  slot.isTarc ? "course-box-locked" : ""
                                }`}
                                key={`${course.code}-${cIndex}`}
                                onClick={
                                  slot.isTarc
                                    ? undefined
                                    : () =>
                                        openReplaceCourseModal(
                                          index,
                                          cIndex
                                        )
                                }
                              >
                                <div className="course-box-main">
                                  <span className="course-code">
                                    {course.code}
                                  </span>
                                </div>

                                {!slot.isTarc && (
                                  <button
                                    className="course-drop-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDropCourse(index, cIndex);
                                    }}
                                    title="Remove course from semester"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}

                          {/* Add button: only for non-TARC, non-semester-1, and <5 courses */}
                            {!slot.isTarc && index !== 0 && slot.courses.length < 5 && (
                              <button
                                className="add-course-btn"
                                onClick={() => openAddCourseModal(index)}
                              >
                                + Add Course
                              </button>
                            )}

                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <CourseEditModal
        visible={editModalVisible}
        onClose={closeEditModal}
        onSelect={handleCourseSelected}
        courses={modalCourses}
        title={
          modalContext?.mode === "add"
            ? "Add a course to this semester"
            : "Replace this course"
        }
      />
    </div>
  );
}
