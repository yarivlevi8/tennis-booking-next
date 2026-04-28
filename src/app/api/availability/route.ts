import { NextResponse } from "next/server";
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
    const bookedTimes = new Set(await getBookedTimesForDate(date));

    return NextResponse.json({
      date,
      slots: baseSlots.filter((slot) => !bookedTimes.has(slot.time)),
    });
  } catch {
    return jsonError("Failed to load availability", 500);
  }
}
