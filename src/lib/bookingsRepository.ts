import { getSqlClient } from "@/lib/db";
import type {
  BookingConfirmationData,
  BookingRequest,
  TrainingType,
} from "@/types/booking";

const UNIQUE_VIOLATION_CODE = "23505";

export type BookingStatus = "confirmed" | "cancelled";

interface BookedTimeRow {
  time: string;
}

interface DbErrorLike {
  code?: string;
}

interface BookingRow {
  id: string;
  date: string;
  time: string;
  training_type: string;
  full_name: string;
  phone: string;
  notes: string | null;
  status: string;
  created_at: string | Date;
  google_event_id: string | null;
}

export interface AdminBooking {
  id: string;
  date: string;
  time: string;
  trainingType: TrainingType;
  fullName: string;
  phone: string;
  notes: string | null;
  status: BookingStatus;
  createdAt: string;
  googleEventId?: string;
}

export interface GetBookingsOptions {
  status?: BookingStatus;
  date?: string;
  q?: string;
}

export type UpdateBookingStatusResult =
  | {
      ok: true;
      booking: AdminBooking;
    }
  | {
      ok: false;
      reason: "not_found" | "conflict";
    };

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

function normalizeCreatedAt(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function normalizeBookingRow(row: BookingRow): AdminBooking {
  return {
    id: row.id,
    date: row.date,
    time: normalizeTime(row.time),
    trainingType: row.training_type as TrainingType,
    fullName: row.full_name,
    phone: row.phone,
    notes: row.notes,
    status: row.status as BookingStatus,
    createdAt: normalizeCreatedAt(row.created_at),
    ...(row.google_event_id ? { googleEventId: row.google_event_id } : {}),
  };
}

function normalizeSearchQuery(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function normalizePhoneSearchQuery(value: string | null) {
  const normalizedValue = value?.replace(/\D/g, "") ?? "";

  return normalizedValue || null;
}

function toLocalPhoneSearchQuery(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("972") && value.length > 3) {
    return `0${value.slice(3)}`;
  }

  return value;
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return value === "confirmed" || value === "cancelled";
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

export async function getBookings(
  options: GetBookingsOptions = {},
): Promise<AdminBooking[]> {
  const sql = getSqlClient();
  const status = options.status ?? null;
  const date = options.date ?? null;
  const searchQuery = normalizeSearchQuery(options.q);
  const phoneSearchQuery = normalizePhoneSearchQuery(searchQuery);
  const localPhoneSearchQuery = toLocalPhoneSearchQuery(phoneSearchQuery);
  const rows = (await sql`
    SELECT
      id::text AS id,
      to_char(booking_date, 'YYYY-MM-DD') AS date,
      to_char(booking_time, 'HH24:MI') AS time,
      training_type,
      full_name,
      phone,
      notes,
      status,
      created_at,
      google_event_id
    FROM bookings
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${date}::date IS NULL OR booking_date = ${date}::date)
      AND (
        ${searchQuery}::text IS NULL
        OR full_name ILIKE '%' || ${searchQuery} || '%'
        OR phone ILIKE '%' || ${searchQuery} || '%'
        OR (
          ${phoneSearchQuery}::text IS NOT NULL
          AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || ${phoneSearchQuery} || '%'
        )
        OR (
          ${localPhoneSearchQuery}::text IS NOT NULL
          AND (
            CASE
              WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '972%'
                THEN '0' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 4)
              ELSE regexp_replace(phone, '[^0-9]', '', 'g')
            END
          ) LIKE '%' || ${localPhoneSearchQuery} || '%'
        )
      )
    ORDER BY booking_date ASC, booking_time ASC, created_at DESC
  `) as BookingRow[];

  return rows.map(normalizeBookingRow);
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<UpdateBookingStatusResult> {
  if (!isBookingStatus(status)) {
    throw new Error("Invalid booking status.");
  }

  const sql = getSqlClient();

  try {
    const rows = (await sql`
      UPDATE bookings
      SET status = ${status}
      WHERE id = ${id}::bigint
      RETURNING
        id::text AS id,
        to_char(booking_date, 'YYYY-MM-DD') AS date,
        to_char(booking_time, 'HH24:MI') AS time,
        training_type,
        full_name,
        phone,
        notes,
        status,
        created_at,
        google_event_id
    `) as BookingRow[];

    if (rows.length === 0) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: true, booking: normalizeBookingRow(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "conflict" };
    }

    throw error;
  }
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
