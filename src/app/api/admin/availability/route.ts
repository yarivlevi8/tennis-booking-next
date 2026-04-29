import { NextResponse } from "next/server";
import {
  getBlockedTimesForDate,
  setSlotBlocked,
  setSlotOpen,
} from "@/lib/availabilityRepository";
import {
  AdminTokenMissingError,
  unauthorizedResponse,
  validateAdminRequest,
} from "@/lib/adminAuth";
import { getBookedTimesForDate } from "@/lib/bookingsRepository";
import {
  getDefaultWorkingHourSlots,
  isDefaultWorkingHourTime,
  isFridayDate,
  isValidTime,
  parseDateString,
} from "@/lib/bookingRules";

type AdminAvailabilitySlotState = "open" | "blocked" | "booked";

interface AdminAvailabilitySlot {
  time: string;
  state: AdminAvailabilitySlotState;
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function getAuthFailureResponse(request: Request) {
  try {
    return validateAdminRequest(request) ? null : unauthorizedResponse();
  } catch (error) {
    if (error instanceof AdminTokenMissingError) {
      return jsonError("Server configuration error", 500);
    }

    return jsonError("Server configuration error", 500);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAdminAvailabilityDate(date: string | null): date is string {
  return Boolean(date && parseDateString(date) && isFridayDate(date));
}

async function buildAvailabilityResponse(date: string) {
  const [blockedTimes, bookedTimes] = await Promise.all([
    getBlockedTimesForDate(date),
    getBookedTimesForDate(date),
  ]);
  const blockedTimeSet = new Set(blockedTimes);
  const bookedTimeSet = new Set(bookedTimes);
  const slots: AdminAvailabilitySlot[] = getDefaultWorkingHourSlots().map(
    (slot) => {
      if (bookedTimeSet.has(slot.time)) {
        return { time: slot.time, state: "booked" };
      }

      if (blockedTimeSet.has(slot.time)) {
        return { time: slot.time, state: "blocked" };
      }

      return { time: slot.time, state: "open" };
    },
  );

  return { date, slots };
}

export async function GET(request: Request) {
  const authFailureResponse = getAuthFailureResponse(request);

  if (authFailureResponse) {
    return authFailureResponse;
  }

  const date = new URL(request.url).searchParams.get("date");

  if (!isValidAdminAvailabilityDate(date)) {
    return jsonError("Invalid date");
  }

  try {
    return NextResponse.json(await buildAvailabilityResponse(date));
  } catch {
    return jsonError("Failed to load availability", 500);
  }
}

export async function PATCH(request: Request) {
  const authFailureResponse = getAuthFailureResponse(request);

  if (authFailureResponse) {
    return authFailureResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body");
  }

  if (!isRecord(body)) {
    return jsonError("Invalid request body");
  }

  const date = typeof body.date === "string" ? body.date : null;
  const time = typeof body.time === "string" ? body.time : "";
  const isOpen = body.isOpen;

  if (!isValidAdminAvailabilityDate(date)) {
    return jsonError("Invalid date");
  }

  if (!isValidTime(time) || !isDefaultWorkingHourTime(time)) {
    return jsonError("Invalid time");
  }

  if (typeof isOpen !== "boolean") {
    return jsonError("Invalid request body");
  }

  try {
    const bookedTimes = await getBookedTimesForDate(date);

    if (!isOpen && bookedTimes.includes(time)) {
      return jsonError("Cannot close a booked slot", 409);
    }

    if (isOpen) {
      await setSlotOpen(date, time);
    } else {
      await setSlotBlocked(date, time);
    }

    return NextResponse.json(await buildAvailabilityResponse(date));
  } catch {
    return jsonError("Failed to update availability", 500);
  }
}
