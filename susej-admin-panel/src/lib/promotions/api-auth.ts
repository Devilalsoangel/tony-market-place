import { NextRequest, NextResponse } from "next/server";

const APP_API_KEY = process.env.APP_API_KEY ?? (process.env.NODE_ENV === "production" ? "" : "dev-key");

export function checkAppKey(request: NextRequest) {
  if (!APP_API_KEY) return false;
  return request.headers.get("x-app-key") === APP_API_KEY;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}