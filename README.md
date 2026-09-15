# Course Compass

Course Compass is a course planning and advising web application built for BRAC University CSE students.

It helps students visualize their degree plan, track completed courses, and automatically rebalance their future semesters when courses are added, removed, or rearranged.

## Features

- BRAC University CSE course planning
- Stream-based default curriculum
- Personalized course planning
- Hard prerequisite validation
- Automatic course rebalancing
- Course add, remove, and replace
- TARC semester management
- COD course handling
- Current, recommended, locked, and completed semesters
- Persistent user planner data
- MongoDB-based user storage

## Local development

Run `npm start` from the repository root to start both the frontend and backend. Stop any separately running instances first to avoid port conflicts. React refreshes frontend code changes automatically; Node restarts the backend when backend or source files change. Press Ctrl+C to stop both.

Use `npm run start:frontend` or `npm run start:api` when running only one server. No additional development dependencies are required.

