import {
  trainingTypeLabels,
  type BookingConfirmationData,
} from "@/types/booking";

const CALENDAR_TIME_ZONE = "Asia/Jerusalem";
const EVENT_TITLE = "אימון טניס";
const EVENT_LOCATION = "מגרש טניס";
const EVENT_DURATION_MINUTES = 60;

interface CalendarDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parseBookingDateTime(
  confirmation: BookingConfirmationData,
): CalendarDateTimeParts {
  const [year, month, day] = confirmation.date.split("-").map(Number);
  const [hour, minute] = confirmation.time.split(":").map(Number);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
  };
}

function addWallTimeMinutes(
  parts: CalendarDateTimeParts,
  minutesToAdd: number,
): CalendarDateTimeParts {
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute + minutesToAdd,
      parts.second,
    ),
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatCalendarDateTime(parts: CalendarDateTimeParts) {
  return [
    parts.year,
    pad(parts.month),
    pad(parts.day),
    "T",
    pad(parts.hour),
    pad(parts.minute),
    pad(parts.second),
  ].join("");
}

function formatUtcDateTime(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function getEventTimes(confirmation: BookingConfirmationData) {
  const start = parseBookingDateTime(confirmation);
  const end = addWallTimeMinutes(start, EVENT_DURATION_MINUTES);

  return {
    start: formatCalendarDateTime(start),
    end: formatCalendarDateTime(end),
  };
}

function createEventDescription(confirmation: BookingConfirmationData) {
  const descriptionLines = [
    `שם מלא: ${confirmation.fullName}`,
    `טלפון: ${confirmation.phone}`,
    `סוג אימון: ${trainingTypeLabels[confirmation.trainingType]}`,
  ];

  if (confirmation.notes) {
    descriptionLines.push(`הערות: ${confirmation.notes}`);
  }

  return descriptionLines.join("\n");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const maxLineBytes = 73;
  const lines: string[] = [];
  let currentLine = "";

  for (const character of Array.from(line)) {
    if (
      currentLine &&
      encoder.encode(`${currentLine}${character}`).length > maxLineBytes
    ) {
      lines.push(currentLine);
      currentLine = character;
    } else {
      currentLine += character;
    }
  }

  lines.push(currentLine);

  return lines
    .map((currentFoldedLine, index) =>
      index === 0 ? currentFoldedLine : ` ${currentFoldedLine}`,
    )
    .join("\r\n");
}

function createIcsUid(confirmation: BookingConfirmationData) {
  const stableId = `${confirmation.date}-${confirmation.time}-${confirmation.phone}`
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();

  return `tennis-booking-${stableId}@tennis-booking.local`;
}

function createIcsFileName(confirmation: BookingConfirmationData) {
  const time = confirmation.time.replace(":", "");

  return `tennis-booking-${confirmation.date}-${time}.ics`;
}

export function buildGoogleCalendarUrl(
  confirmation: BookingConfirmationData,
) {
  const { start, end } = getEventTimes(confirmation);
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", EVENT_TITLE);
  url.searchParams.set("dates", `${start}/${end}`);
  url.searchParams.set("details", createEventDescription(confirmation));
  url.searchParams.set("location", EVENT_LOCATION);
  url.searchParams.set("ctz", CALENDAR_TIME_ZONE);

  return url.toString();
}

export function createIcsContent(confirmation: BookingConfirmationData) {
  const { start, end } = getEventTimes(confirmation);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tennis Booking MVP//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    "BEGIN:VEVENT",
    `UID:${createIcsUid(confirmation)}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${start}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${end}`,
    `SUMMARY:${escapeIcsText(EVENT_TITLE)}`,
    `DESCRIPTION:${escapeIcsText(createEventDescription(confirmation))}`,
    `LOCATION:${escapeIcsText(EVENT_LOCATION)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return lines.map(foldIcsLine).join("\r\n");
}

export function downloadIcsFile(confirmation: BookingConfirmationData) {
  const blob = new Blob([createIcsContent(confirmation)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = createIcsFileName(confirmation);
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
