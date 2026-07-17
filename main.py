import json

# Load JSON
with open("ENG101-MAT110.json", "r") as file:
    courses = json.load(file)

# Group courses by semester
semesters = {}

for course in courses:
    sem = course["semester_row"]

    if sem not in semesters:
        semesters[sem] = []

    semesters[sem].append(course["code"])

# Find the maximum number of courses in any semester
max_courses = 0
for sem in semesters:
    if len(semesters[sem]) > max_courses:
        max_courses = len(semesters[sem])

# Fixed column widths
sl_width = 4
course_width = 10

# Top border
print("+" + "-" * (sl_width + 2), end="+")
for i in range(max_courses):
    print("-" * (course_width + 2), end="+")
print()

# Header
print(f"| {'Sl':<{sl_width}} ", end="|")
for i in range(max_courses):
    print(f" {'C'+str(i+1):<{course_width}} ", end="|")
print()

# Middle border
print("+" + "-" * (sl_width + 2), end="+")
for i in range(max_courses):
    print("-" * (course_width + 2), end="+")
print()

# Print semesters
for sem in sorted(semesters):

    print(f"| {sem:<{sl_width}} ", end="|")

    for course in semesters[sem]:
        print(f" {course:<{course_width}} ", end="|")

    # Fill empty cells
    for i in range(max_courses - len(semesters[sem])):
        print(f" {'':<{course_width}} ", end="|")

    print()

# Bottom border
print("+" + "-" * (sl_width + 2), end="+")
for i in range(max_courses):
    print("-" * (course_width + 2), end="+")
print()