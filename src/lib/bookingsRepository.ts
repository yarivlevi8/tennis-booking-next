import { getSqlClient } from "@/lib/db";
import type {
  BookingConfirmationData,
  BookingRequest,
} from "@/types/booking";

const UNIQUE_VIOLATION_CODE = "23505";

interface BookedTimeRow {
  time: string;
}

interface DbErrorLike {
  code?: string;
}

export class DuplicateBookingError extends Error {
  constructor() {
    super("Selected slot is not available");
    this.name = "DuplicateBookingError";
  }
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function isDbErrorLike(error: unknown): error is DbErrorLike {
  return typeof error === "object" && error !== null && "code" in error;
}

function isUniqueViolation(error: unknown) {
  return isDbErrorLike(error) && error.code === UNIQUE_VIOLATION_CODE;
}

export async function getBookedTimesForDate(date: string): Promise<string[]> {
  const sql = getSqlClient();
  const rows = (await sql`
    SELECT to_char(booking_time, 'HH24:MI') AS time
    FROM bookings
    WHERE booking_date = ${date}::date
      AND status = 'confirmed'
  `) as BookedTimeRow[];

  return rows.map((row) => normalizeTime(row.time));
}

export async function createBookingInDb(
  request: BookingRequest,
): Promise<BookingConfirmationData> {
  const sql = getSqlClient();

  try {
    await sql`
      INSERT INTO bookings (
        booking_date,
        booking_time,
        training_type,
        full_name,
        phone,
        notes
      )
      VALUES (
        ${request.date}::date,
        ${request.time}::time,
        ${request.trainingType},
        ${request.fullName},
        ${request.phone},
        ${request.notes ?? null}
      )
    `;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateBookingError();
    }

    throw error;
  }

  return {
    date: request.date,
    time: request.time,
    trainingType: request.trainingType,
    fullName: request.fullName,
    phone: request.phone,
    notes: request.notes,
  };
}
