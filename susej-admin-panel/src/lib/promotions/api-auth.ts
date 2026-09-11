import { NextRequest, NextResponse } from "next/server";

const APP_API_KEY = process.env.APP_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "dev-key");

export function checkAppKey(request: NextRequest) {
  // Unset key = device gate DISABLED, not "deny all". x-app-key never
  // authenticated anything by itself — every app write additionally requires a
  // valid Bearer susej_ session (getAppUser) bound to a real user, which is the
  // actual security boundary. Treating "unset" as deny-all silently broke ALL
  // app->admin sync in production (seller queue stayed empty).
  if (!APP_API_KEY) return true;
  return request.headers.get("x-app-key") === APP_API_KEY;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}