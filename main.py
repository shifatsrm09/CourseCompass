import json
from pathlib import Path

json_file = Path(__file__).parent / "ENG101-MAT110.json"

with open(json_file, "r", encoding="utf-8") as f:
    courses = json.load(f)

# Group courses by semester
semesters = {}
for course in courses:
    sem = course["semester_row"]
    semesters.setdefault(sem, []).append(course["code"])

semester_list = sorted(semesters.keys())

# Maximum number of courses in any semester
max_courses = max(len(v) for v in semesters.values())

sl_width = 4
course_width = 10

def border():
    print("+" + "-" * (sl_width + 2), end="+")
    for _ in range(max_courses):
        print("-" * (course_width + 2), end="+")
    print()

# Header
border()
print(f"| {'Sl':<{sl_width}} ", end="|")
for i in range(max_courses):
    print(f" {'C'+str(i+1):<{course_width}} ", end="|")
print()
border()

# Rows
for sem in semester_list:
    print(f"| {sem:<{sl_width}} ", end="|")
    for code in semesters[sem]:
        print(f" {code:<{course_width}} ", end="|")

    # Fill remaining empty cells
    for _ in range(max_courses - len(semesters[sem])):
        print(f" {'':<{course_width}} ", end="|")

    print()

border()