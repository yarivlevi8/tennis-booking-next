import type { TimeSlot, TrainingType } from "@/types/booking";

const FIRST_FRIDAY_SLOTS = ["08:00", "09:00", "10:00", "12:00"];
const SECOND_FRIDAY_SLOTS = ["09:00", "11:00", "13:00"];
const FRIDAY_DAY_INDEX = 5;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

function toStableDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toTimeSlots(times: string[]): TimeSlot[] {
  return times.map((time) => ({ time }));
}

export function parseDateString(date: string | null): LocalDateParts | null {
  if (!date) {
    return null;
  }

  const match = DATE_PATTERN.exec(date);

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const localDate = new Date(year, month - 1, day);

  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isFridayDate(date: string) {
  const parts = parseDateString(date);

  if (!parts) {
    return false;
  }

  return new Date(parts.year, parts.month - 1, parts.day).getDay() === FRIDAY_DAY_INDEX;
}

export function isValidBookingDate(date: string | null): date is string {
  return Boolean(date && parseDateString(date) && isFridayDate(date));
}

export function getNextTwoFridayDateStrings(referenceDate = new Date()) {
  const daysUntilFriday =
    (FRIDAY_DAY_INDEX - referenceDate.getDay() + 7) % 7;
  const firstFriday = addLocalDays(referenceDate, daysUntilFriday);
  const secondFriday = addLocalDays(firstFriday, 7);

  return [toStableDateString(firstFriday), toStableDateString(secondFriday)];
}

export function getAvailableSlotsForDate(date: string) {
  const [firstFriday, secondFriday] = getNextTwoFridayDateStrings();

  if (date === firstFriday) {
    return toTimeSlots(FIRST_FRIDAY_SLOTS);
  }

  if (date === secondFriday) {
    return toTimeSlots(SECOND_FRIDAY_SLOTS);
  }

  return [];
}

export function isValidTime(time: string) {
  return TIME_PATTERN.test(time);
}

export function isAllowedTrainingType(
  trainingType: unknown,
): trainingType is TrainingType {
  return trainingType === "single" || trainingType === "couple";
}

export function isValidIsraeliPhone(phone: string) {
  const normalized = phone.trim().replace(/[\s-]/g, "");

  return /^0\d{8,9}$/.test(normalized) || /^\+972\d{8,9}$/.test(normalized);
}

export function isAvailableSlot(date: string, time: string) {
  return getAvailableSlotsForDate(date).some((slot) => slot.time === time);
}
