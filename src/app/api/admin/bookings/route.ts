import { NextResponse } from "next/server";
import {
  AdminTokenMissingError,
  unauthorizedResponse,
  validateAdminRequest,
} from "@/lib/adminAuth";
import { parseDateString } from "@/lib/bookingRules";
import { getBookings, isBookingStatus } from "@/lib/bookingsRepository";

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

export async function GET(request: Request) {
  const authFailureResponse = getAuthFailureResponse(request);

  if (authFailureResponse) {
    return authFailureResponse;
  }

  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const q = searchParams.get("q");

  if (status !== null && !isBookingStatus(status)) {
    return jsonError("Invalid status");
  }

  if (date !== null && !parseDateString(date)) {
    return jsonError("Invalid date");
  }

  try {
    return NextResponse.json({
      bookings: await getBookings({
        status: status ?? undefined,
        date: date ?? undefined,
        q: q ?? undefined,
      }),
    });
  } catch {
    return jsonError("Failed to load bookings", 500);
  }
}
