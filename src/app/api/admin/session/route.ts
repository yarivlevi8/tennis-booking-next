import { NextResponse } from "next/server";
import { hasValidAdminSession } from "@/lib/adminSession";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  try {
    return NextResponse.json({
      authenticated: hasValidAdminSession(request),
    });
  } catch {
    return jsonError("Server configuration error", 500);
  }
}
