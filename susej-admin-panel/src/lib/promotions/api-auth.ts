import { NextRequest, NextResponse } from "next/server";

const APP_API_KEY = process.env.APP_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "dev-key");
// Previous key, accepted during rotation windows ONLY: set APP_API_KEY to the
// new value, keep APP_API_KEY_PREVIOUS until every installed build has moved
// (OTA-gated), then unset it. Without this, rotating the shared device secret
// bricks all field builds at once — which is why it was never rotated.
const APP_API_KEY_PREVIOUS = process.env.APP_API_KEY_PREVIOUS ?? "";

export function checkAppKey(request: NextRequest) {
  // Prod fail-CLOSED (industry standard): a missing APP_API_KEY must deny
  // device calls, never silently open them. Dev stays open for velocity.
  // Prod currently HAS the key (dev-key) so live APK sync is unaffected.
  if (!APP_API_KEY) return process.env.NODE_ENV !== "production";
  const presented = request.headers.get("x-app-key") ?? "";
  if (presented === APP_API_KEY) return true;
  if (APP_API_KEY_PREVIOUS && presented === APP_API_KEY_PREVIOUS) return true;
  return false;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}