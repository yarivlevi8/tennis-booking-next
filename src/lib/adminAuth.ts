import { NextResponse } from "next/server";

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

export function validateAdminRequest(request: Request) {
  if (typeof window !== "undefined") {
    throw new Error("Admin auth can only be used on the server.");
  }

  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    throw new AdminTokenMissingError();
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return false;
  }

  const match = BEARER_TOKEN_PATTERN.exec(authorization);

  return Boolean(match && match[1] === adminToken);
}
