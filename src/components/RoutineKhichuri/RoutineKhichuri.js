import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./RoutineKhichuri.css";

const API_BASE_URL = "https://routiner-khichuri-backend.onrender.com";
const DAY_ORDER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const TIME_SLOTS = [
  { label: "08:00 AM-09:20 AM", startTime: "08:00:00", endTime: "09:20:00" },
  { label: "09:30 AM-10:50 AM", startTime: "09:30:00", endTime: "10:50:00" },
  { label: "11:00 AM-12:20 PM", startTime: "11:00:00", endTime: "12:20:00" },
  { label: "12:30 PM-01:50 PM", startTime: "12:30:00", endTime: "13:50:00" },
  { label: "02:00 PM-03:20 PM", startTime: "14:00:00", endTime: "15:20:00" },
  { label: "03:30 PM-04:50 PM", startTime: "15:30:00", endTime: "16:50:00" },
  { label: "05:00 PM-06:20 PM", startTime: "17:00:00", endTime: "18:20:00" },
];

const QUOTES = [
  "It's dangerous to go alone, take this semester seriously.",
  "Finish the fight.",
  "Hard work is the real power-up.",
  "Every season is exam season. Prepare accordingly.",
  "You were born to be the very best, like no one ever was.",
  "Failure doesn't mean defeat, just a checkpoint.",
  "The cake may be a lie, but your potential isn't.",
  "The only choice you have is how good you WILL do in your test. We always have a choice. Make the right choice.",
  "Even the smallest person can change the course of CGPA.",
  "Believe in the me that believes in you!",
  "You have the power to rewrite your story.",
  "Study. Rest. Sir ek mark dile grade bare. Repeat.",
  "No matter the odds, you keep going. That's your superpower.",
  "Academic success is forged in fire and coffee.",
  "The Force will be with you, always.",
  "You can do this all day.",
  "Not all those who wander are lost, some are just changing majors.",
  "Push the payload. Pass the semester.",
  "A hero is someone who gets up, even when CGPA says no.",
  "Nothing is true, everything is permitted, except plag.",
  "You don't need a Senzu bean. You just need a plan.",
  "When life gives you fetch quests, turn them into achievements.",
  "FUS RO PASS!",
  "You are more than your save files.",
  "This semester... we ride.",
  "SHINZOU WO SASAGEYO",
  "Tatakae.",
];

function toMinutes(value) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatHoursAsHourMinute(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0 hours 0 minutes";
  }

  const roundedToThirtyMinutes = Math.round((numeric * 60) / 30) * 30;
  const hours = Math.floor(roundedToThirtyMinutes / 60);
  const minutes = roundedToThirtyMinutes % 60;
  return `${hours} hours ${minutes} minutes`;
}

function normalizeMeetingsFromSections(sections) {
  return sections.flatMap((section, sectionIndex) => {
    const schedule = section.sectionSchedule || {};
    const classSchedules = Array.isArray(schedule.classSchedules) ? schedule.classSchedules : [];
    const nestedLabSchedules = Array.isArray(schedule.labSchedules) ? schedule.labSchedules : [];
    const rootLabSchedules = Array.isArray(section.labSchedules) ? section.labSchedules : [];
    const labSchedules = [...nestedLabSchedules, ...rootLabSchedules];

    const classMeetings = classSchedules.map((meeting) => ({
      ...meeting,
      meetingType: "THEORY",
    }));

    const labMeetings = labSchedules.map((meeting) => ({
      ...meeting,
      meetingType: "LAB",
    }));

    return [...classMeetings, ...labMeetings].map((meeting, meetingIndex) => ({
      day: String(meeting.day || "").toUpperCase(),
      startMinutes: toMinutes(meeting.startTime),
      endMinutes: toMinutes(meeting.endTime),
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      meetingType: meeting.meetingType || "THEORY",
      courseCode: section.courseCode,
      sectionName: section.sectionName,
      faculty: section.faculties,
      remainingSeats:
        Number.isFinite(Number(section.remainingSeats))
          ? Number(section.remainingSeats)
          : null,
      meetingKey: `${section.courseCode}-${section.sectionName}-${meeting.day}-${meeting.startTime}-${meeting.endTime}-${meeting.meetingType}-${sectionIndex}-${meetingIndex}`,
    }));
  });
}

const COURSE_PALETTE = [
  { bg: "#fdf3d5", border: "#d09f1f", text: "#4f3500" },
  { bg: "#def8e8", border: "#329e62", text: "#0e4929" },
  { bg: "#dff1ff", border: "#2f83c6", text: "#0d3960" },
  { bg: "#fbe6e3", border: "#cc604f", text: "#5d1f16" },
  { bg: "#ece8ff", border: "#7267ce", text: "#2f286f" },
  { bg: "#ffe6f6", border: "#bb4c9a", text: "#5b1d48" },
  { bg: "#e7f6f2", border: "#2d9f93", text: "#0f4f48" },
  { bg: "#fff1e2", border: "#ce7f2d", text: "#613605" },
];

function buildCourseColorMap(sections) {
  const uniqueCodes = [...new Set(sections.map((section) => String(section.courseCode || "")))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const colorMap = new Map();
  uniqueCodes.forEach((code, index) => {
    colorMap.set(code, COURSE_PALETTE[index % COURSE_PALETTE.length]);
  });

  return colorMap;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function formatMeetingLabel(meeting) {
  const day = String(meeting?.day || "").toUpperCase();
  const dayLabel = day ? day.charAt(0) + day.slice(1).toLowerCase() : "Day";
  return `${dayLabel} ${meeting?.startTime || "TBA"}-${meeting?.endTime || "TBA"}`;
}

function formatTime12Hour(time24) {
  if (!time24) return time24;
  const [hours, minutes] = String(time24).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time24;

  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeRange12Hour(rangeValue) {
  if (!rangeValue || !String(rangeValue).includes("-")) {
    return rangeValue || "TBA";
  }

  const [start, end] = String(rangeValue).split("-");
  return `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`;
}

function getSectionTimingGroups(section) {
  const schedule = section?.sectionSchedule || {};
  const classSchedules = Array.isArray(schedule.classSchedules) ? schedule.classSchedules : [];
  const labSchedules = Array.isArray(schedule.labSchedules) ? schedule.labSchedules : [];

  return {
    classLines: classSchedules.map(formatMeetingLabel),
    labLines: labSchedules.map(formatMeetingLabel),
  };
}

function isTbaFacultyLabel(value) {
  const normalized = String(value || "").toUpperCase().trim();
  return normalized === "TBA" || normalized === "TO BE ANNOUNCED";
}

function WeeklyCalendar({ sections }) {
  const meetings = useMemo(() => normalizeMeetingsFromSections(sections), [sections]);
  const courseColorMap = useMemo(() => buildCourseColorMap(sections), [sections]);

  const slotMap = useMemo(() => {
    const map = new Map();

    DAY_ORDER.forEach((day) => {
      const dayMeetings = meetings.filter((meeting) => meeting.day === day);

      TIME_SLOTS.forEach((slot, slotIndex) => {
        const slotStart = toMinutes(slot.startTime);
        const slotEnd = toMinutes(slot.endTime);

        const matchedMeetings = dayMeetings.filter((meeting) =>
          overlaps(meeting.startMinutes, meeting.endMinutes, slotStart, slotEnd),
        );

        map.set(`${day}-${slotIndex}`, matchedMeetings);
      });
    });

    return map;
  }, [meetings]);

  if (meetings.length === 0) {
    return <div className="calendar-empty">No class meetings found for this routine.</div>;
  }

  return (
    <div className="calendar-wrapper">
      <div className="calendar-legend">
        <div className="legend-types">
          <span className="type-pill theory">Theory</span>
          <span className="type-pill lab">Lab</span>
        </div>
        <div className="legend-courses">
          {[...courseColorMap.entries()].map(([courseCode, color]) => (
            <div key={courseCode} className="course-legend-item">
              <span
                className="course-legend-swatch"
                style={{
                  backgroundColor: color.bg,
                  borderColor: color.border,
                }}
              />
              <span>{courseCode}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-scroll">
        <table className="slot-table">
          <thead>
            <tr>
              <th>Time/Day</th>
              {DAY_ORDER.map((day) => (
                <th key={day}>{day.charAt(0) + day.slice(1).toLowerCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, slotIndex) => (
              <tr key={slot.label}>
                <td className="slot-label">{slot.label}</td>
                {DAY_ORDER.map((day) => {
                  const items = slotMap.get(`${day}-${slotIndex}`) || [];
                  return (
                    <td key={`${day}-${slot.label}`} className="slot-cell">
                      <div className="slot-events">
                        {items.map((meeting) => (
                          <div
                            key={`${meeting.courseCode}-${meeting.day}-${meeting.startTime}-${meeting.sectionName}-${meeting.meetingType}`}
                            className={`slot-event-card ${meeting.meetingType === "LAB" ? "is-lab" : "is-theory"}`}
                            style={{
                              "--event-bg": courseColorMap.get(meeting.courseCode)?.bg || "#e7f6f2",
                              "--event-border": courseColorMap.get(meeting.courseCode)?.border || "#2d9f93",
                              "--event-text": courseColorMap.get(meeting.courseCode)?.text || "#0f4f48",
                            }}
                          >
                            <div className="slot-event-title">{meeting.courseCode}</div>
                            <div className="slot-event-type">{meeting.meetingType}</div>
                            <div className="slot-event-meta">
                              {meeting.sectionName} | {meeting.faculty}
                            </div>
                            <div className="slot-event-seats">
                              Remaining seats: {meeting.remainingSeats == null ? "N/A" : meeting.remainingSeats}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamSchedule({ exams, defaultExpanded = false, forceExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const effectiveExpanded = forceExpanded || isExpanded;

  if (!exams || exams.length === 0) {
    return <div className="exams-empty">No exam schedule information available.</div>;
  }

  const sortedExams = [...exams].sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

  const midExams = sortedExams.filter((exam) => String(exam.type || "").toUpperCase() === "MID");
  const finalExams = sortedExams.filter((exam) => String(exam.type || "").toUpperCase() === "FINAL");

  function renderExamRows(items, emptyMessage) {
    if (items.length === 0) {
      return <div className="exam-type-empty">{emptyMessage}</div>;
    }

    return items.map((exam, idx) => (
      <div key={`${exam.type}-${exam.courseCode}-${exam.date}-${idx}`} className="exam-item">
        <span className="exam-course">{exam.courseCode}</span>
        <span className="exam-date-inline">
          {new Date(exam.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="exam-time">
          {formatTime12Hour(exam.startTime)} - {formatTime12Hour(exam.endTime)}
        </span>
      </div>
    ));
  }

  return (
    <div className="exams-schedule">
      <button
        type="button"
        className="exams-expand-btn"
        onClick={() => setIsExpanded((previous) => !previous)}
      >
        <span className="expand-icon" aria-hidden="true">{effectiveExpanded ? "▼" : "▶"}</span>
        <span className="exams-title">Exam Schedule</span>
        <span className="exams-count">{exams.length} exams</span>
      </button>

      {effectiveExpanded && (
        <div className="exams-list">
          <div className="exam-type-grid">
            <section className="exam-type-box mid-box">
              <div className="exam-type-header">MID Exams</div>
              <div className="exams-for-type">
                {renderExamRows(midExams, "No mid exams in this routine.")}
              </div>
            </section>

            <section className="exam-type-box final-box">
              <div className="exam-type-header">Final Exams</div>
              <div className="exams-for-type">
                {renderExamRows(finalExams, "No final exams in this routine.")}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamClashWarning({ clashes }) {
  if (!clashes || clashes.length === 0) {
    return <div className="clash-none">✅ No exam clashes detected!</div>;
  }

  return (
    <div className="exam-clashes-warning">
      <h4>⚠️ Exam Clashes Detected!</h4>
      <div className="clashes-list">
        {clashes.map((clash, idx) => (
          <div key={`clash-${idx}`} className="clash-item">
            <div className="clash-message">
              <strong>{clash.exam1.courseCode}</strong> ({clash.exam1.type}) 
              <span className="clash-vs"> vs </span>
              <strong>{clash.exam2.courseCode}</strong> ({clash.exam2.type})
            </div>
            <div className="clash-details">
              Date: {new Date(clash.date).toLocaleDateString()} | Time: {formatTimeRange12Hour(clash.exam1.time)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoutineKhichuri({
  onBackToPlanner,
  suggestedCourses = [],
  currentSemesterLabel = "Current Semester",
}) {
  const ROUTINES_PER_PAGE = 5;

  const [allCodes, setAllCodes] = useState([]);
  const [codeQuery, setCodeQuery] = useState("");
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [allowedDays, setAllowedDays] = useState([...DAY_ORDER]);

  const [maxDaysPerWeek, setMaxDaysPerWeek] = useState(4);
  const [priority, setPriority] = useState("MIN_DAYS");

  const [facultyPrefsByCourse, setFacultyPrefsByCourse] = useState({});
  const [facultyOptionsByCourse, setFacultyOptionsByCourse] = useState({});
  const [sectionOptionsByCourse, setSectionOptionsByCourse] = useState({});
  const [preferredSectionsByCourse, setPreferredSectionsByCourse] = useState({});
  const [activePreferenceTab, setActivePreferenceTab] = useState("FACULTY");

  const [preferBreaks, setPreferBreaks] = useState(false);
  const [ignoreFilledSections, setIgnoreFilledSections] = useState(true);
  const [ignoredSlotLabels, setIgnoredSlotLabels] = useState([]);

  const [loadingCodes, setLoadingCodes] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [routineStats, setRoutineStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [sourceLastUpdated, setSourceLastUpdated] = useState(null);
  const [backendLastCheckedAt, setBackendLastCheckedAt] = useState(null);
  const [downloadingRoutineKey, setDownloadingRoutineKey] = useState("");
  const [exportRoutineKey, setExportRoutineKey] = useState("");
  const routineCardRefs = useRef({});
  const resultsPanelRef = useRef(null);
  const shouldScrollAfterPageChangeRef = useRef(false);
  const lastQuoteBackendCheckRef = useRef(null);

  useEffect(() => {
    async function fetchCourseCodes() {
      try {
        setLoadingCodes(true);
        const response = await fetch(`${API_BASE_URL}/api/course-codes`);
        const data = await response.json();
        setAllCodes(data.courseCodes || []);
      } catch (error) {
        setErrorMessage("Could not load course codes from backend.");
      } finally {
        setLoadingCodes(false);
      }
    }

    fetchCourseCodes();
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Course Compass | Routine Khichuri";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (!backendLastCheckedAt) {
      return;
    }

    if (!lastQuoteBackendCheckRef.current) {
      lastQuoteBackendCheckRef.current = backendLastCheckedAt;
      return;
    }

    if (lastQuoteBackendCheckRef.current === backendLastCheckedAt) {
      return;
    }

    lastQuoteBackendCheckRef.current = backendLastCheckedAt;
    setQuoteIndex((previous) => (previous + 1) % QUOTES.length);
  }, [backendLastCheckedAt]);

  useEffect(() => {
    const VISIBLE_INTERVAL_MS = 15000;
    const HIDDEN_INTERVAL_MS = 60000;
    const MAX_BACKOFF_MS = 120000;
    const JITTER_RATIO = 0.2;

    let isMounted = true;
    let timeoutId = null;
    let consecutiveFailures = 0;

    function getBaseIntervalMs() {
      return document.visibilityState === "hidden" ? HIDDEN_INTERVAL_MS : VISIBLE_INTERVAL_MS;
    }

    function applyJitter(ms) {
      const jitterFactor = 1 + (Math.random() * 2 - 1) * JITTER_RATIO;
      return Math.max(1000, Math.round(ms * jitterFactor));
    }

    function getNextDelayMs() {
      const baseMs = getBaseIntervalMs();
      const backedOffMs = Math.min(MAX_BACKOFF_MS, baseMs * (2 ** consecutiveFailures));
      return Math.min(MAX_BACKOFF_MS, applyJitter(backedOffMs));
    }

    function clearPollTimer() {
      if (!timeoutId) {
        return;
      }

      clearTimeout(timeoutId);
      timeoutId = null;
    }

    function scheduleNextPoll() {
      clearPollTimer();
      timeoutId = setTimeout(() => {
        fetchHealthStatus();
      }, getNextDelayMs());
    }

    async function fetchHealthStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        if (!isMounted) return;
        setSourceLastUpdated(data?.sourceMetadataLastUpdated || null);
        setBackendLastCheckedAt(
          data?.lastRefreshCompletedAt || data?.lastRefreshAttemptAt || null,
        );
        consecutiveFailures = 0;
      } catch {
        if (!isMounted) return;
        setSourceLastUpdated(null);
        setBackendLastCheckedAt(null);
        consecutiveFailures += 1;
      } finally {
        if (!isMounted) return;
        scheduleNextPoll();
      }
    }

    function handleVisibilityChange() {
      if (!isMounted) return;
      scheduleNextPoll();
    }

    fetchHealthStatus();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearPollTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event) {
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const filteredSuggestions = useMemo(() => {
    const query = codeQuery.trim().toUpperCase();
    if (!query) return [];

    return allCodes
      .filter((code) => code.includes(query) && !selectedCodes.includes(code))
      .slice(0, 12);
  }, [allCodes, codeQuery, selectedCodes]);

  function getOrderedFacultyOptions(courseCode) {
    const options = Array.isArray(facultyOptionsByCourse[courseCode])
      ? [...facultyOptionsByCourse[courseCode]]
      : [];

    return options.sort((a, b) => {
      const aIsTba = isTbaFacultyLabel(a);
      const bIsTba = isTbaFacultyLabel(b);

      if (aIsTba && !bIsTba) return 1;
      if (!aIsTba && bIsTba) return -1;
      return String(a).localeCompare(String(b));
    });
  }

  function addCourseCode(code) {
    const normalized = String(code || "").toUpperCase().trim();
    if (!normalized || selectedCodes.includes(normalized)) return;
    setSelectedCodes((previous) => [...previous, normalized]);
    setFacultyPrefsByCourse((previous) => ({
      ...previous,
      [normalized]: { preferredList: [], avoidList: [] },
    }));
    setCodeQuery("");
  }

  function removeCourseCode(code) {
    setSelectedCodes((previous) => previous.filter((value) => value !== code));
    setFacultyPrefsByCourse((previous) => {
      const next = { ...previous };
      delete next[code];
      return next;
    });
    setPreferredSectionsByCourse((previous) => {
      const next = { ...previous };
      delete next[code];
      return next;
    });
    setSectionOptionsByCourse((previous) => {
      const next = { ...previous };
      delete next[code];
      return next;
    });
  }

  function toggleAllowedDay(day) {
    setAllowedDays((previous) => {
      if (previous.includes(day)) {
        if (previous.length === 1) return previous;
        return previous.filter((value) => value !== day);
      }
      return [...previous, day];
    });
  }

  function toggleFacultyPreference(courseCode, field, faculty) {
    setFacultyPrefsByCourse((previous) => {
      const current = previous[courseCode] || { preferredList: [], avoidList: [] };
      const existing = Array.isArray(current[field]) ? current[field] : [];
      const normalizedFaculty = String(faculty || "").toUpperCase();
      const otherField = field === "preferredList" ? "avoidList" : "preferredList";
      const otherExisting = Array.isArray(current[otherField]) ? current[otherField] : [];
      const nextValues = existing.includes(normalizedFaculty)
        ? existing.filter((value) => value !== normalizedFaculty)
        : [...existing, normalizedFaculty];

      const nextOtherValues = nextValues.includes(normalizedFaculty)
        ? otherExisting.filter((value) => value !== normalizedFaculty)
        : otherExisting;

      return {
        ...previous,
        [courseCode]: {
          preferredList: current.preferredList || [],
          avoidList: current.avoidList || [],
          [field]: nextValues,
          [otherField]: nextOtherValues,
        },
      };
    });
  }

  function togglePreferredSection(courseCode, sectionName) {
    const normalizedSection = String(sectionName || "").toUpperCase().trim();
    if (!normalizedSection) return;

    setPreferredSectionsByCourse((previous) => {
      const existing = Array.isArray(previous[courseCode]) ? previous[courseCode] : [];
      const nextValues = existing.includes(normalizedSection)
        ? existing.filter((value) => value !== normalizedSection)
        : [...existing, normalizedSection];

      return {
        ...previous,
        [courseCode]: nextValues,
      };
    });
  }

  function toggleIgnoredSlot(slotLabel) {
    setIgnoredSlotLabels((previous) => {
      if (previous.includes(slotLabel)) {
        return previous.filter((label) => label !== slotLabel);
      }

      return [...previous, slotLabel];
    });
  }

  function registerRoutineCardRef(routineKey, node) {
    if (node) {
      routineCardRefs.current[routineKey] = node;
      return;
    }

    delete routineCardRefs.current[routineKey];
  }

  async function downloadRoutineImage(routineKey, routineNumber) {
    const cardNode = routineCardRefs.current[routineKey];
    if (!cardNode) {
      setErrorMessage("Could not find this routine card to download.");
      return;
    }

    function waitForFrame() {
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    }

    function downloadBlob(blob, fileName) {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    async function downloadDataUrlAsBlob(dataUrl, fileName) {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      downloadBlob(blob, fileName);
    }

    try {
      setDownloadingRoutineKey(routineKey);
      setExportRoutineKey(routineKey);
      cardNode.classList.add("is-exporting");
      await waitForFrame();

      const sourceNode = routineCardRefs.current[routineKey] || cardNode;
      const exportRoot = document.createElement("div");
      exportRoot.className = "routine-export-root";
      document.body.appendChild(exportRoot);

      const exportNode = sourceNode.cloneNode(true);
      exportNode.classList.add("is-export-clone");
      exportRoot.appendChild(exportNode);
      await waitForFrame();

      try {
        const imageModule = await import("html-to-image");
        const toBlob = imageModule?.toBlob;
        const toPng = imageModule?.toPng;

        if (typeof toBlob !== "function" && typeof toPng !== "function") {
          throw new Error("Image export function is unavailable");
        }

        const fileName = `routine-${routineNumber}.png`;
        const blob = typeof toBlob === "function"
          ? await toBlob(exportNode, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: "#ffffff",
            filter: (node) => {
              if (node instanceof HTMLElement && node.classList.contains("download-routine-button")) {
                return false;
              }

              return true;
            },
            style: {
              animation: "none",
              transform: "none",
              opacity: "1",
            },
          })
          : null;

        if (blob) {
          downloadBlob(blob, fileName);
          return;
        }

        const dataUrl = await toPng(exportNode, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          filter: (node) => {
            if (node instanceof HTMLElement && node.classList.contains("download-routine-button")) {
              return false;
            }

            return true;
          },
          style: {
            animation: "none",
            transform: "none",
            opacity: "1",
          },
        });

        await downloadDataUrlAsBlob(dataUrl, fileName);
      } catch (innerErr) {
        console.error("html-to-image export error:", innerErr);
        throw innerErr;
      }
    } catch (error) {
      console.error("Routine image download failed", error);
      setErrorMessage("Could not download this routine image right now.");
    } finally {
      cardNode.classList.remove("is-exporting");
      setDownloadingRoutineKey("");
      setExportRoutineKey("");
      document.querySelectorAll(".routine-export-root").forEach((node) => {
        node.remove();
      });
    }
  }

  useEffect(() => {
    async function fetchFacultyOptions() {
      if (selectedCodes.length === 0) {
        setFacultyOptionsByCourse({});
        return;
      }

      try {
        const query = encodeURIComponent(selectedCodes.join(","));
        const response = await fetch(`${API_BASE_URL}/api/course-faculties?courseCodes=${query}`);
        const data = await response.json();
        setFacultyOptionsByCourse(data.facultiesByCourse || {});
      } catch {
        setFacultyOptionsByCourse({});
      }
    }

    fetchFacultyOptions();
  }, [selectedCodes]);

  useEffect(() => {
    async function fetchSectionOptions() {
      if (selectedCodes.length === 0) {
        setSectionOptionsByCourse({});
        return;
      }

      try {
        const query = encodeURIComponent(selectedCodes.join(","));
        const response = await fetch(
          `${API_BASE_URL}/api/course-sections?courseCodes=${query}&ignoreFilledSections=${ignoreFilledSections}`,
        );
        const data = await response.json();
        const nextSectionsByCourse = data.sectionsByCourse || {};
        setSectionOptionsByCourse(nextSectionsByCourse);

        setPreferredSectionsByCourse((previous) => {
          const next = { ...previous };

          selectedCodes.forEach((code) => {
            const validNames = new Set(
              (nextSectionsByCourse[code] || [])
                .map((section) => String(section.sectionName || "").toUpperCase().trim())
                .filter(Boolean),
            );

            const existing = Array.isArray(next[code]) ? next[code] : [];
            next[code] = existing.filter((value) => validNames.has(value));
          });

          return next;
        });
      } catch {
        setSectionOptionsByCourse({});
      }
    }

    fetchSectionOptions();
  }, [selectedCodes, ignoreFilledSections]);

  async function generateRoutine() {
    queueResultsScroll();

    try {
      setErrorMessage("");
      setIsGenerating(true);

      const mustHaveByCourse = {};
      const avoidByCourse = {};
      const selectedSectionsByCourse = {};

      selectedCodes.forEach((code) => {
        const prefs = facultyPrefsByCourse[code] || {};
        const mustHave = Array.isArray(prefs.preferredList)
          ? prefs.preferredList.map((value) => String(value || "").toUpperCase()).filter(Boolean)
          : [];
        const avoid = Array.isArray(prefs.avoidList)
          ? prefs.avoidList.map((value) => String(value || "").toUpperCase()).filter(Boolean)
          : [];

        if (mustHave.length > 0) {
          mustHaveByCourse[code] = mustHave;
        }

        if (avoid.length > 0) {
          avoidByCourse[code] = avoid;
        }

        const preferredSections = Array.isArray(preferredSectionsByCourse[code])
          ? preferredSectionsByCourse[code].map((value) => String(value || "").toUpperCase()).filter(Boolean)
          : [];

        if (preferredSections.length > 0) {
          selectedSectionsByCourse[code] = preferredSections;
        }
      });

      const payload = {
        courseCodes: selectedCodes,
        preferences: {
          maxDaysPerWeek,
          allowedDays,
          priority,
          ignoredTimeSlots: TIME_SLOTS.filter((slot) => ignoredSlotLabels.includes(slot.label)).map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
          facultyPreference: {
            mustHaveByCourse,
            avoidByCourse,
          },
          preferredSectionsByCourse: selectedSectionsByCourse,
          breakPreference: {
            enabled: preferBreaks,
          },
          ignoreFilledSections,
        },
      };

      const response = await fetch(`${API_BASE_URL}/api/generate-routine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot generate schedule with these constraints");
      }
      const sorted = [...(data.routines || [])].sort(
        (a, b) => (b.metrics?.score || 0) - (a.metrics?.score || 0),
      );
      setRoutines(sorted);
      setRoutineStats(data.stats || null);
      setCurrentPage(1);

      if (sorted.length === 0) {
        setErrorMessage(
          data?.stats?.failureReason ||
            "No routine could be generated for the selected constraints.",
        );
      }

      queueResultsScroll();
    } catch (error) {
      setRoutines([]);
      setRoutineStats(null);
      const message =
        error?.message || "Cannot generate schedule with these constraints";
      setErrorMessage(message);
      queueResultsScroll();
    } finally {
      setIsGenerating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(routines.length / ROUTINES_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * ROUTINES_PER_PAGE;
  const pageRoutines = routines.slice(pageStartIndex, pageStartIndex + ROUTINES_PER_PAGE);

  function scrollToResultsTop() {
    if (!resultsPanelRef.current) {
      return;
    }

    try {
      const targetTop = resultsPanelRef.current.getBoundingClientRect().top + window.scrollY - 10;
      if (typeof window.scrollTo === "function") {
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
    } catch {
    }
  }

  function queueResultsScroll() {
    requestAnimationFrame(() => {
      scrollToResultsTop();
    });
  }

  function changePage(nextPage) {
    if (nextPage === currentPage) {
      return;
    }

    shouldScrollAfterPageChangeRef.current = true;
    setCurrentPage(nextPage);
  }

  useEffect(() => {
    if (!shouldScrollAfterPageChangeRef.current) {
      return;
    }

    shouldScrollAfterPageChangeRef.current = false;
    queueResultsScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  function renderPaginationControls(positionClassName) {
    if (routines.length <= ROUTINES_PER_PAGE) {
      return null;
    }

    return (
      <div className={`results-pagination ${positionClassName}`}>
        <button
          type="button"
          className="page-btn"
          disabled={currentPage === 1}
          onClick={() => {
            changePage(Math.max(1, currentPage - 1));
          }}
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            type="button"
            className={`page-btn page-number ${page === currentPage ? "is-active" : ""}`}
            onClick={() => {
              changePage(page);
            }}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          className="page-btn"
          disabled={currentPage === totalPages}
          onClick={() => {
            changePage(Math.min(totalPages, currentPage + 1));
          }}
        >
          Next
        </button>
      </div>
    );
  }

  function importPlanCourses() {
    if (!suggestedCourses || suggestedCourses.length === 0) return;
    suggestedCourses.forEach((code) => {
      addCourseCode(code);
    });
  }

  const unaddedSuggestedCourses = suggestedCourses.filter(
    (code) => !selectedCodes.includes(String(code).toUpperCase().trim())
  );

  return (
    <div className="routine-khichuri-app">
      <div className="app-shell">
      <div className="ambient-bg" aria-hidden="true">
        <div className="wave wave-a" />
        <div className="wave wave-b" />
        <div className="wave wave-c" />
      </div>

      <header className="hero-header">
        <div className="hero-header-main">
          <div className="hero-header-top" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            {onBackToPlanner && (
              <button
                type="button"
                onClick={onBackToPlanner}
                className="back-to-planner-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                  transition: "background 0.2s ease"
                }}
              >
                ← Back to Planner
              </button>
            )}
            <span className="hero-brand-pill">Course Compass Integration</span>
          </div>
          <h1>ROUTINER KHICHURI</h1>
          <p>Aj prochur routine banabo.</p>
        </div>
        <div className="hero-header-status">
          <p className="source-last-updated-text">
            Source last updated at: {sourceLastUpdated ? new Date(sourceLastUpdated).toLocaleString() : "Unavailable"}
          </p>
          <p className="source-last-updated-text">
            Source last checked at: {backendLastCheckedAt ? new Date(backendLastCheckedAt).toLocaleString() : "Unavailable"}
          </p>
        </div>
      </header>

      <div className="setup-grid">
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h2 style={{ margin: 0 }}>Course Selection</h2>
            {suggestedCourses.length > 0 && unaddedSuggestedCourses.length > 0 && (
              <button
                type="button"
                onClick={importPlanCourses}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "#4338ca",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                + Import from {currentSemesterLabel} ({unaddedSuggestedCourses.length})
              </button>
            )}
          </div>
          <div className="course-search-area">
            <input
              value={codeQuery}
              onChange={(event) => setCodeQuery(event.target.value)}
              placeholder="Search course code (e.g., CSE111)"
            />
            <button type="button" onClick={() => addCourseCode(codeQuery)}>
              Add
            </button>
          </div>

          {loadingCodes && <p className="hint-text">Loading course list...</p>}

          {filteredSuggestions.length > 0 && (
            <div className="suggestion-row">
              {filteredSuggestions.map((code) => (
                <button key={code} type="button" className="suggestion-pill" onClick={() => addCourseCode(code)}>
                  {code}
                </button>
              ))}
            </div>
          )}

          <div className="chip-row">
            {selectedCodes.map((code) => (
              <span key={code} className="code-chip">
                {code}
                <button type="button" onClick={() => removeCourseCode(code)}>
                  x
                </button>
              </span>
            ))}
          </div>

          {selectedCodes.length > 0 && (
            <div className="preference-tab-wrap">
              <div className="preference-tab-row">
                <button
                  type="button"
                  className={`preference-tab-btn ${activePreferenceTab === "FACULTY" ? "is-active" : ""}`}
                  onClick={() => setActivePreferenceTab("FACULTY")}
                >
                  Faculty Preferences
                </button>
                <button
                  type="button"
                  className={`preference-tab-btn ${activePreferenceTab === "SECTION" ? "is-active" : ""}`}
                  onClick={() => setActivePreferenceTab("SECTION")}
                >
                  Preferred Sections
                </button>
              </div>

              {activePreferenceTab === "FACULTY" ? (
                <div className="course-pref-grid">
                  <div className="course-pref-head">Course</div>
                  <div className="course-pref-head">Preferred Faculties</div>
                  <div className="course-pref-head">Faculties To Avoid</div>

                  {selectedCodes.map((code) => (
                    <Fragment key={code}>
                      <div className="course-pref-code">{code}</div>

                      <div className="faculty-option-list">
                        {getOrderedFacultyOptions(code).map((faculty) => (
                          <label
                            key={`${code}-preferred-${faculty}`}
                            className={`faculty-option-item ${isTbaFacultyLabel(faculty) ? "is-tba" : ""} ${(facultyPrefsByCourse[code]?.preferredList || []).includes(faculty) ? "is-preferred" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={(facultyPrefsByCourse[code]?.preferredList || []).includes(faculty)}
                              onChange={() => toggleFacultyPreference(code, "preferredList", faculty)}
                            />
                            <span>{faculty}</span>
                          </label>
                        ))}
                      </div>

                      <div className="faculty-option-list">
                        {getOrderedFacultyOptions(code).map((faculty) => (
                          <label
                            key={`${code}-avoid-${faculty}`}
                            className={`faculty-option-item ${isTbaFacultyLabel(faculty) ? "is-tba" : ""} ${(facultyPrefsByCourse[code]?.avoidList || []).includes(faculty) ? "is-avoided" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={(facultyPrefsByCourse[code]?.avoidList || []).includes(faculty)}
                              onChange={() => toggleFacultyPreference(code, "avoidList", faculty)}
                            />
                            <span>{faculty}</span>
                          </label>
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              ) : (
                <div className="section-pref-grid">
                  <div className="course-pref-head">Course</div>
                  <div className="course-pref-head">Valid Sections (hover for timings)</div>

                  {selectedCodes.map((code) => (
                    <Fragment key={`${code}-section-row`}>
                      <div className="course-pref-code">{code}</div>

                      <div className="section-option-list">
                        {(sectionOptionsByCourse[code] || []).length === 0 ? (
                          <div className="section-empty">No valid sections right now.</div>
                        ) : (
                          (sectionOptionsByCourse[code] || []).map((section) => {
                            const sectionName = String(section.sectionName || "").toUpperCase();
                            const isSelected = (preferredSectionsByCourse[code] || []).includes(sectionName);
                            const timingGroups = getSectionTimingGroups(section);

                            return (
                              <button
                                key={`${code}-${section.sectionId || sectionName}`}
                                type="button"
                                className={`section-option-chip ${isSelected ? "is-selected" : ""}`}
                                onClick={() => togglePreferredSection(code, sectionName)}
                              >
                                <span className="section-chip-title">
                                  {sectionName || "SECTION"}
                                  {section.faculties ? ` | ${section.faculties}` : ""}
                                </span>
                                <span className="section-chip-meta">
                                  Seats: {section.remainingSeats == null ? "N/A" : section.remainingSeats}
                                </span>

                                <span className="section-tooltip" role="tooltip">
                                  <span className="section-tooltip-title">{code} {sectionName || "Section"}</span>
                                  <span className="section-tooltip-subtitle">Theory</span>
                                  {timingGroups.classLines.length > 0 ? (
                                    timingGroups.classLines.map((line, index) => (
                                      <span key={`${code}-${sectionName}-class-${index}`}>{line}</span>
                                    ))
                                  ) : (
                                    <span>No theory timing listed.</span>
                                  )}

                                  <span className="section-tooltip-subtitle">Lab</span>
                                  {timingGroups.labLines.length > 0 ? (
                                    timingGroups.labLines.map((line, index) => (
                                      <span key={`${code}-${sectionName}-lab-${index}`}>{line}</span>
                                    ))
                                  ) : (
                                    <span>No lab timing listed.</span>
                                  )}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Scheduling Settings</h2>
          <div className="sub-panel day-selector-panel">
            <h3>Preferred Class Days</h3>
            <div className="day-toggle-bar">
              {DAY_ORDER.map((day) => {
                const enabled = allowedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`day-toggle ${enabled ? "is-selected" : ""}`}
                    onClick={() => toggleAllowedDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-grid">
            <label>
              Max Days Per Week (1-6)
              <select value={maxDaysPerWeek} onChange={(event) => setMaxDaysPerWeek(Number(event.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="MIN_DAYS">Minimum Days</option>
                <option value="MIN_DAILY_HOURS">Minimum Daily Hours</option>
              </select>
            </label>
          </div>

          <div className="sub-panel">
            <h3>Ignored Time Slots</h3>
            <div className="ignored-slot-grid">
              {TIME_SLOTS.map((slot) => {
                const isSelected = ignoredSlotLabels.includes(slot.label);
                return (
                  <button
                    key={slot.label}
                    type="button"
                    className={`ignored-slot-toggle ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleIgnoredSlot(slot.label)}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
            <p className="hint-text">8 tar class asholei korba?</p>
          </div>

          <div className="sub-panel">
            <h3>Section Availability</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ignoreFilledSections}
                onChange={(event) => setIgnoreFilledSections(event.target.checked)}
              />
              Ignore filled sections
            </label>
          </div>

          <div className="sub-panel">
            <h3>Break Preference</h3>
            <label className="checkbox-label">
              <input type="checkbox" checked={preferBreaks} onChange={(event) => setPreferBreaks(event.target.checked)} />
              Prefer routines with breaks between consecutive classes
            </label>
            <p className="hint-text">Quiz er age pora lage bhai.</p>
          </div>

          <button className="generate-button" type="button" disabled={selectedCodes.length === 0 || isGenerating} onClick={generateRoutine}>
            {isGenerating ? "Generating..." : "Generate Routine"}
          </button>
        </section>
      </div>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <section className="panel results-panel" ref={resultsPanelRef}>
        <h2>Results</h2>
        {routines.length === 0 && !errorMessage && <p className="hint-text">Generate a routine to view schedules.</p>}

        {routines.length > 0 && (
          <div className="results-summary">
            <span>
              Created <strong>{routineStats?.generatedRoutines ?? routines.length}</strong> routines from
              <strong> {routineStats?.totalCombinations ?? "N/A"}</strong> combinations.
            </span>
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
          </div>
        )}

        {renderPaginationControls("results-pagination-top")}

        <div className="results-stack">
          {pageRoutines.map((routine, index) => {
            const routineKey = `routine-${pageStartIndex + index}`;

            return (
              <article
                key={routineKey}
                className="result-card"
                ref={(node) => registerRoutineCardRef(routineKey, node)}
              >
                <div className="result-header">
                  <h3>Routine #{pageStartIndex + index + 1}</h3>
                  <p>
                    Score: <strong>{Math.round(routine.metrics.score || 0)}</strong> | Days: <strong>{routine.metrics.totalDays}</strong> | Avg Daily: <strong>{formatHoursAsHourMinute(routine.metrics.avgDailyHours)}</strong>
                  </p>
                  <button
                    type="button"
                    className="download-routine-button"
                    disabled={downloadingRoutineKey === routineKey}
                    onClick={() => downloadRoutineImage(routineKey, pageStartIndex + index + 1)}
                  >
                    {downloadingRoutineKey === routineKey ? "Preparing download..." : "Download Routine"}
                  </button>
                </div>

                <WeeklyCalendar sections={routine.sections} />

                <div className="routine-exams-section">
                  {routine.examClashes && routine.examClashes.length > 0 && (
                    <ExamClashWarning clashes={routine.examClashes} />
                  )}
                  {routine.exams && routine.exams.length > 0 && (
                    <ExamSchedule exams={routine.exams} forceExpanded={exportRoutineKey === routineKey} />
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {renderPaginationControls("results-pagination-bottom")}
      </section>

      <footer className="app-footer">
        <div className="footer-left">
          <p className="footer-credit">Built by Dihan Islam Dhrubo</p>

          <div className="footer-links">
            <a href="https://github.com/xDhruboVai/Routiner-Khichuri" target="_blank" rel="noreferrer">
              GitHub Repo
            </a>
            <a href="https://www.linkedin.com/in/dihan-islam-dhrubo-79a904249/" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href="https://www.facebook.com/dihanislam.dhrubo.5/" target="_blank" rel="noreferrer">
              Facebook
            </a>
          </div>

          <div className="footer-links footer-secondary-links">
            <a
              href="https://forms.gle/Bm9jtdD3FR3MctZi7"
              target="_blank"
              rel="noreferrer"
            >
              Suggest / Report 
            </a>
          </div>
        </div>

        <p className="footer-quote">"{QUOTES[quoteIndex]}"</p>
      </footer>
      </div>
    </div>
  );
}
