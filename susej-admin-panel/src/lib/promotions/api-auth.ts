import { NextRequest, NextResponse } from "next/server";

const APP_API_KEY = process.env.APP_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "dev-key");

export function checkAppKey(request: NextRequest) {
  // Prod fail-CLOSED (industry standard): a missing APP_API_KEY must deny
  // device calls, never silently open them. Dev stays open for velocity.
  // Prod currently HAS the key (dev-key) so live APK sync is unaffected.
  if (!APP_API_KEY) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-app-key") === APP_API_KEY;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}