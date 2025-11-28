export function getCourseState(course, completed, inProgress) {
  if (completed.includes(course.code)) return "completed";
  if (inProgress.includes(course.code)) return "inProgress";
  if (course.hp.every(req => completed.includes(req))) return "available";
  return "locked";
}
