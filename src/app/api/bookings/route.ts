import { NextResponse } from "next/server";
import {
  createBookingInDb,
  DuplicateBookingError,
  getBookedTimesForDate,
} from "@/lib/bookingsRepository";
import {
  isAllowedTrainingType,
  isAvailableSlot,
  isValidBookingDate,
  isValidIsraeliPhone,
  isValidTime,
} from "@/lib/bookingRules";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body");
  }

  if (!isRecord(body)) {
    return jsonError("Invalid request body");
  }

  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const trainingType = body.trainingType;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : undefined;

  if (!isValidBookingDate(date)) {
    return jsonError("Invalid date");
  }

  if (!isValidTime(time)) {
    return jsonError("Invalid time");
  }

  if (!isAllowedTrainingType(trainingType)) {
    return jsonError("Invalid training type");
  }

  if (!fullName) {
    return jsonError("Invalid full name");
  }

  if (!isValidIsraeliPhone(phone)) {
    return jsonError("Invalid phone");
  }

  if (!isAvailableSlot(date, time)) {
    return jsonError("Selected slot is not available", 409);
  }

  try {
    const bookedTimes = await getBookedTimesForDate(date);

    if (bookedTimes.includes(time)) {
      return jsonError("Selected slot is not available", 409);
    }

    return NextResponse.json(
      await createBookingInDb({
        date,
        time,
        trainingType,
        fullName,
        phone,
        notes,
      }),
    );
  } catch (error) {
    if (error instanceof DuplicateBookingError) {
      return jsonError("Selected slot is not available", 409);
    }

    return jsonError("Failed to create booking", 500);
  }
}
