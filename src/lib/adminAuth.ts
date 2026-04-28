import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getAdminSessionCookieValue,
  isAdminSessionCookieValueValid,
} from "@/lib/adminSession";

const BEARER_TOKEN_PATTERN = /^Bearer ([^\s]+)$/;

export class AdminTokenMissingError extends Error {
  constructor() {
    super("ADMIN_TOKEN is missing in the server environment.");
    this.name = "AdminTokenMissingError";
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = BEARER_TOKEN_PATTERN.exec(authorization);

  return match?.[1] ?? null;
}

function isBearerTokenValid(bearerToken: string) {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    throw new AdminTokenMissingError();
  }

  return safeEqual(bearerToken, adminToken);
}

export function validateAdminRequest(request: Request) {
  if (typeof window !== "undefined") {
    throw new Error("Admin auth can only be used on the server.");
  }

  const bearerToken = getBearerToken(request);
  const sessionCookieValue = getAdminSessionCookieValue(request);
  let configurationError: unknown = null;

  if (bearerToken) {
    try {
      if (isBearerTokenValid(bearerToken)) {
        return true;
      }
    } catch (error) {
      configurationError = error;
    }
  }

  if (sessionCookieValue) {
    try {
      if (isAdminSessionCookieValueValid(sessionCookieValue)) {
        return true;
      }
    } catch (error) {
      configurationError ??= error;
    }
  }

  if (configurationError) {
    throw configurationError;
  }

  return false;
}
