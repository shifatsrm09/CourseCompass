Prompt Title: Continue Course Compass Project (Full Context Provided)


Hi ChatGPT, I am continuing a long project and I want you to load this full context so we can pick up EXACTLY where we left off — without losing any details.

🧠 PROJECT NAME:

Course Compass – BRAC University Smart Advising System

📌 SUMMARY OF THE PROJECT (PLEASE REMEMBER THIS)

We are building a course suggestion + planning web application for BRAC University CSE students.
so student will be  choosing a specific stream given by university and based on that we will load the whole
course sequence thats the default behaviour which the project already does. our goal is to establish a edit functionality for the semester blocks
what is edit functionality? 
BRAC allows maximum of 5 courses minimum 3
there should be a button "Add" in each block to add extra one course or more upto five
every course shows here should be modify-able if we click on a course we can delete it from the semester or we can change the course.

the core logic is if some student may fail in one course they can select that course again in the next semester (it will add up) but after 5 course added student cannot add anymore but they can replace that course if they replace a course ssuppose: STA201 thn the STA201 will move to the next available semester (If the next semester is TARC we dont move it to TARC semester THIS is a locked sequence block)

we will be suggesting course in the consideration of 
-> earlier course done
-> what course they need to complete according to the BRAC given full semester sequence 
-> the current semester whould be our Mark point FLAG to decide we will see what the user has completed by far and whats left from that
    we suggest whats the next available course according to the order and if that meets the prerequisites or not

The system has:

1️⃣ Login System

User logs in using only Student ID.

On first login → system asks them to select their stream
(e.g., ENG101 + MAT110).

After selecting once, login goes directly to dashboard.

2️⃣ Stream-Based Course Plan

Each stream has a JSON file, e.g.:

ENG101-MAT110.json
and 6 more we will add them later


Contains BRAC’s official course sequence:

semester_row (1–12) may increase if user take less thn 4 courses or fails 

HP / SP prerequisites

course type

tarc marking (is_tarc)

3️⃣ TARC Semester Logic

TARC (residential semester) is fixed courses:
HUM103, BNG103, EMB101, ENG102

By default placed in Semester 3

TARC is movable (drag-down to 4 / 5 / 6/ ....)
but cannot be moved to 1st or 2nd semester.

Only TARC can be dragged.
No other semester is draggable.

4️⃣ Semester Status Flow

Each semester has a status:

Current

Completed

Recommended (previously “LOCKED”)

TARC badge if applicable.

These are dynamic based on currentSemester stored in DB.


6️⃣ Planner UI

Shows 12 semester rows

Courses displayed per semester

Status chip on the right

TARC pill on the right of TARC block

Drag handle only for TARC

Smooth vertical-only movement

7️⃣ Current Issue We Were Fixing

    No issues
    we need to add functionality

📂 PROJECT DIRECTORY STRUCTURE (REMEMBER THIS TOO)
COURSE-COMPASS/
│
├─ backend/
│   ├─ models/
│   │   └─ User.js
│   ├─ routes/
│   │   ├─ auth.js
│   │   └─ planner.js
│   ├─ server.js
│   └─ .env
│
├─ src/
│   ├─ components/
│   │   ├─ Login.js
│   │   ├─ StreamSelect.js
│   │   ├─ Dashboard.js
│   │   └─ CoursePlanner.js
│   ├─ data/
│   │   └─ ENG101-MAT110.json
│   ├─ styles/
│   │   ├─ card.css
│   │   ├─ dashboard.css
│   │   ├─ globals.css
│   │   ├─ login.css
│   │   └─ planner.css
│   ├─ App.js
│   ├─ index.js
│   └─ .env
│
└─ package.json

🧩 WHAT WE WERE ABOUT TO WORK ON NEXT

(Please continue from here)



our very step0 will be implement the add-drop-modify functioanlity and save them to the db.

Please load this full context and continue development from the next logical step. and tell me if you understood the logic core and concept of the website

Actual Project Purpose (Restated Clearly)

You want to build a smart advising engine that:

✔ Reads completed semesters + completed courses
✔ Checks remaining courses from the program
✔ Applies prerequisite rules
✔ Suggests the best 4 courses for the next semester
✔ Priority Rules:

Missing required courses from earlier semesters → highest priority

Hard prerequisites must be satisfied

Max 4 courses per semester

1 slot reserved for COD (if COD count < 5)

If no COD allowed → 4 program/core courses

The final sequence may grow to extra semesters if required

✔ Inputs:

Student's completed courses

Entire stream’s JSON (semester, type, HP, SP, COD etc.)

✔ Output:

Next semester’s recommended 4 courses

lets think of the engine as function/method just like in programming language ok?
with some parameter.

for the initial login user will get everything by default (suggested course sequence etc ) our engine dont play any role here yet

student may fail/ want to retake a course/ do the course later when this modificatio or override comes from the user only thn our engine comes to play 

we send data to engine (what semester user are in from the current semester tag, 
what courses they have done till now, the whole courseplan JSON )

then the engine will compute oh ok fine user completed y courses from JSON and in x semester remaining courses are k's ok then engine will start computing it will take what courses arent being completed yet, what needs to be done x semester(Hard Prerequisite maintained) and if cod <5 then we add a cod first if not 4 core courses will be computed

thus engine can return what user should take in next semester recommended

also engine should calculate the upcoming semester plan as well and we visualize everything in the UI 

function generateRecommendations({
  currentSemester,
  completedCourses,
  coursePlanJSON
}) { 
   return { 
      nextSemester: [...4 courses],
      fullFuturePlan: { ...semester: courses } 
   };
}
