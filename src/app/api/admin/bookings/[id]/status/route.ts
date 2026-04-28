import { NextResponse } from "next/server";
import {
  AdminTokenMissingError,
  unauthorizedResponse,
  validateAdminRequest,
} from "@/lib/adminAuth";
import {
  isBookingStatus,
  updateBookingStatus,
} from "@/lib/bookingsRepository";

const NUMERIC_ID_PATTERN = /^\d+$/;

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authFailureResponse = getAuthFailureResponse(request);

  if (authFailureResponse) {
    return authFailureResponse;
  }

  const { id } = await params;

  if (!NUMERIC_ID_PATTERN.test(id)) {
    return jsonError("Invalid booking id");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body");
  }

  if (!isRecord(body) || !isBookingStatus(body.status)) {
    return jsonError("Invalid status");
  }

  try {
    const result = await updateBookingStatus(id, body.status);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return jsonError("Booking not found", 404);
      }

      return jsonError("Selected slot is not available", 409);
    }

    return NextResponse.json(result.booking);
  } catch {
    return jsonError("Failed to update booking status", 500);
  }
}
