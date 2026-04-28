import { scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookieValue,
} from "@/lib/adminSession";

const INVALID_CREDENTIALS_ERROR = "שם המשתמש או הסיסמה שגויים";
const SCRYPT_HASH_PARTS = 3;
const SCRYPT_HASH_BYTE_LENGTH = 64;

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function invalidCredentialsResponse() {
  return jsonError(INVALID_CREDENTIALS_ERROR, 401);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireConfig(value: string | undefined) {
  if (!value) {
    throw new Error("Missing admin auth configuration.");
  }

  return value;
}

function verifyPassword(password: string, passwordHash: string) {
  try {
    const parts = passwordHash.split(":");

    if (parts.length !== SCRYPT_HASH_PARTS || parts[0] !== "scrypt") {
      return false;
    }

    const [, salt, encodedHash] = parts;
    const expectedHash = Buffer.from(encodedHash, "base64url");

    if (expectedHash.length !== SCRYPT_HASH_BYTE_LENGTH) {
      return false;
    }

    const actualHash = scryptSync(password, salt, SCRYPT_HASH_BYTE_LENGTH);

    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidCredentialsResponse();
  }

  if (!isRecord(body)) {
    return invalidCredentialsResponse();
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return invalidCredentialsResponse();
  }

  try {
    const adminUsername = requireConfig(process.env.ADMIN_USERNAME);
    const adminPasswordHash = requireConfig(process.env.ADMIN_PASSWORD_HASH);

    if (
      username !== adminUsername ||
      !verifyPassword(password, adminPasswordHash)
    ) {
      return invalidCredentialsResponse();
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: createAdminSessionCookieValue(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return jsonError("Server configuration error", 500);
  }
}
