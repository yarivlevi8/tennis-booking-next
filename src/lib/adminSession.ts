import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ADMIN_SESSION_ROLE = "admin";

type AdminSessionPayload = {
  role: typeof ADMIN_SESSION_ROLE;
  exp: number;
};

export class AdminSessionSecretMissingError extends Error {
  constructor() {
    super("Admin session secret is missing in the server environment.");
    this.name = "AdminSessionSecretMissingError";
  }
}

function requireSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new AdminSessionSecretMissingError();
  }

  return secret;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parsePayload(encodedPayload: string): AdminSessionPayload | null {
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return null;
    }

    const role = (payload as Record<string, unknown>).role;
    const exp = (payload as Record<string, unknown>).exp;

    if (role !== ADMIN_SESSION_ROLE || typeof exp !== "number") {
      return null;
    }

    return { role, exp };
  } catch {
    return null;
  }
}

export function createAdminSessionCookieValue(now = Date.now()) {
  const secret = requireSessionSecret();
  const payload: AdminSessionPayload = {
    role: ADMIN_SESSION_ROLE,
    exp: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function isAdminSessionCookieValueValid(
  cookieValue: string | null | undefined,
  now = Date.now(),
) {
  if (!cookieValue) {
    return false;
  }

  const parts = cookieValue.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  const [encodedPayload, signature] = parts;
  const secret = requireSessionSecret();
  const expectedSignature = signPayload(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  const payload = parsePayload(encodedPayload);

  if (!payload) {
    return false;
  }

  return payload.exp > Math.floor(now / 1000);
}

export function getAdminSessionCookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");

    if (rawName === ADMIN_SESSION_COOKIE_NAME) {
      const rawValue = rawValueParts.join("=");

      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
}

export function hasValidAdminSession(request: Request) {
  return isAdminSessionCookieValueValid(getAdminSessionCookieValue(request));
}
