1. Overview

The CoursePlanner module is the core UI + logic layer of the Course Compass application.
It provides a fully interactive semester-by-semester planning system that allows students to:

Browse their mapped BRAC curriculum

Add or replace courses

Track their current & completed semesters

Reorder special semesters (TARC)

Auto-balance future semesters

Sync their custom plan to the backend

This module is the most complex front-end subsystem in Course Compass due to the number of rules, validations, and interactive features.

2. Architecture Diagram (Simplified)
Dashboard.js
    │
    ▼
CoursePlanner (index.js)
    │
    ├─ usePlannerState.js       ← Load stream/custom plan → semesterSlots
    ├─ usePlannerSync.js        ← Sync semesterSlots ↔ server + local
    ├─ usePlannerModals.js      ← Add / Replace / Remove logic
    ├─ plannerUtils.js          ← Plan-building utilities
    ├─ PlannerHeader.js         ← UI summary (course counter)
    │
    └─ SemesterList.js
            └─ SemesterRow.js
                    └─ CourseBox.js
    │
    └─ Modals:
          ├─ CourseEditModal.js
          └─ ConfirmModal.js

3. Core Concepts
Semester Slot

A “slot” represents one semester block in the UI:

{
  "id": "sem-3",
  "originalRow": 3,
  "courses": [{...}, {...}],
  "isTarc": false,
  "thesis": null
}

User Custom Plan

Saved in DB as:

[
  { "semester": 1, "courses": ["ENG101", "MAT110"] },
  { "semester": 2, "courses": ["CSE110", "CSE111"] }
]

Stream Plan

Loaded from JSON (ENG101-MAT110.json) or from streamsConfig.

Used when:

User first logs in

Custom plan becomes invalid

Stream changes

4. Data Flow & State Flow
Dashboard loads stream JSON → allCourses
Dashboard reconstructs initial “orderedCourses”
      ↓
CoursePlanner receives:
  - user
  - currentSemester
  - orderedCourses
  - allCourses
      ↓
usePlannerState builds semesterSlots
      ↓
User edits → usePlannerModals mutates semesterSlots
      ↓
usePlannerSync:
   - updates user.customPlan
   - writes to localStorage
   - POSTs to server (save-plan)
      ↓
UI updates live based on semesterSlots and getStatus()

5. File-by-File Explanation
✔ index.js (CoursePlanner main file)

Central controller of the entire planner system.

Connects all hooks + UI components.

Handles:

Semester completion modal

Auto-balance

Status calculation

Modal interactions

Does not contain heavy logic — all delegated to hooks.

✔ plannerUtils.js

Low-level utilities for building semester slots from:

Default BRAC stream plan

Custom DB plan

Handles:

Mapping flat course lists → grouped semester structures

Matching DB-stored plan with real course objects

Fallback logic when custom plan becomes invalid

Used only for transforming raw data → UI-ready format.

✔ usePlannerState.js

React hook that loads and manages semesterSlots.

Watches for changes in:

user.stream

user.customPlan

allCourses

Automatically rebuilds the planner when needed.

Ensures:

Valid plan

Correct stream

No corrupted custom plans

This is the “initialization + hydration” system for planner state.

✔ usePlannerSync.js

Handles all synchronization:

1. Local Updates

Updates React user state

Updates localStorage for persistence

2. Server Updates

POST to:

POST /planner/save-plan


Sends:

Full semester → courses mapping

COD count

Current semester’s courses

This ensures your plan is permanently stored and accessible across devices.

✔ usePlannerModals.js

The logic system for:

Add Course

Replace Course

Remove Course

This is where the planner’s most complex rule engine lives.

Includes:

COD movement logic

TARC edit restrictions

First-semester delete restrictions

HP prerequisite validation

Removal cascading (removing course from future semesters)

Deep cloning for safe state mutation

This hook is the “heart” of all editing behavior.

✔ PlannerHeader.js

Simple UI component that shows:

“Course Planner” title

Course count

Expected total courses from streamConfig

Helps visually verify that user’s custom plan is complete.

✔ SemesterList.js

Renders the list of semesters

Provides TARC drag-and-drop via @hello-pangea/dnd

Saves new TARC positions to server:

POST /planner/save-order


Displays the ⚖ Auto Balance button

✔ SemesterRow.js

Represents one semester in UI.

Handles:

Displaying course boxes

Showing current/recommended/completed badges

Showing TARC/Thesis badges

Add Course button logic

Replace Course click triggers

Draggable handle for TARC

It converts raw semesterSlot objects → human-friendly interface.

✔ CourseBox.js

Small UI element representing a single course.

Features:

Clickable when replaceable

Locked when course is not editable

Displays course code

✔ CourseEditModal.js

The modal where users:

Search for courses

View grouped courses (Core, Elective, COD, TARC)

View HP prerequisites

Select a course

Remove course (under rules)

✔ ConfirmModal.js

Simple confirmation dialog for semester completion.

6. Planner Logic Flow
Add Course Flow
openAddCourseModal()
    ↓
validateAddCourse()
    ↓
apply addition
    ↓
remove course duplicates from future semesters
    ↓
syncPlanToServer()
updateUserPlanInState()
    ↓
UI rerenders

Replace Course Flow
openReplaceCourseModal()
    ↓
validateCourseForSemester()
    ↓
meta logic:
   - if COD: special movement to/from future semesters
   - if normal course: cleanup future duplicates
    ↓
syncPlanToServer()
updateUserPlanInState()

Remove Course Flow
handleRemoveCourse()
    ↓
reinsertRemovedCourse algorithm (removeEngine)
    ↓
syncPlanToServer()
updateUserPlanInState()

7. Validation & Rules Overview
✔ Course Addition Rules

Max 5 courses per semester

Only 1 COD allowed

COD in future → pulled back if needed

Completed semesters locked

First semester cannot remove

✔ Replace Course Rules

Handled via validateCourseForSemester:

HP prerequisites

COD rules

TARC edit permissions

No duplicate courses allowed

✔ TARC Movement Rules

Only TARC semester can be dragged

Cannot move before semester 3

Cannot drag completed semester

Saves new order to backend

8. API Communication
Save Plan
POST /planner/save-plan
{
    studentId,
    plan: [{semester, courses}],
    codCount,
    currentCourses
}

Complete Semester
POST /planner/complete-semester

Save TARC Order
POST /planner/save-order

9. Extending the Planner (Developer Guide)

To safely add features:

✔ Add new UI features in separate component files

Avoid bloating index.js.

✔ Never mutate semesterSlots directly

Always deep clone inside setState.

✔ All validation belongs in engine/

Never hardcode validation in UI.

✔ Sync local + server together

Any change must call both:

syncPlanToServer

updateUserPlanInState

✔ Keep modal logic in usePlannerModals

Don’t move modal logic to index.js ever.

10. Known Edge Cases & Notes

COD movement is special: only 1 per semester

Thesis semester is fully locked

TARC may contain fewer courses (≤ 4)

First semester: delete disabled

matchRatio < 0.5 → fallback to default plan

Course disappearing from stream JSON → auto-sanitized