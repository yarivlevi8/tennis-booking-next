import { NextResponse } from "next/server";
import { getBlockedTimesForDate } from "@/lib/availabilityRepository";
import { getBookedTimesForDate } from "@/lib/bookingsRepository";
import {
  getAvailableSlotsForDate,
  isValidBookingDate,
} from "@/lib/bookingRules";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");

  if (!isValidBookingDate(date)) {
    return jsonError("Invalid date");
  }

  const baseSlots = getAvailableSlotsForDate(date);

  try {
    const [blockedTimes, bookedTimes] = await Promise.all([
      getBlockedTimesForDate(date),
      getBookedTimesForDate(date),
    ]);
    const unavailableTimes = new Set([...blockedTimes, ...bookedTimes]);

    return NextResponse.json({
      date,
      slots: baseSlots.filter((slot) => !unavailableTimes.has(slot.time)),
    });
  } catch {
    return jsonError("Failed to load availability", 500);
  }
}
