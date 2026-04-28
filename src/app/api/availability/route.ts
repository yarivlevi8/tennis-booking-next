import { NextResponse } from "next/server";
import {
  getAvailableSlotsForDate,
  isValidBookingDate,
} from "@/lib/bookingRules";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");

  if (!isValidBookingDate(date)) {
    return jsonError("Invalid date");
  }

  return NextResponse.json({
    date,
    slots: getAvailableSlotsForDate(date),
  });
}
