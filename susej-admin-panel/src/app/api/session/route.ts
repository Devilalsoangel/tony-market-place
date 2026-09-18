import { NextRequest, NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/auth";

/**
 * GET /api/session — lightweight live-session probe for the dashboard shell.
 * The edge proxy can only verify the token SIGNATURE (24h), so a banned /
 * demoted admin keeps full page navigation until expiry while every data API
 * already 401/403s them (getActiveAdmin). The shell polls this (live Admin
 * row) and bounces to /login the moment privilege dies — closing the
 * page-half of revocation without DB access in middleware.
 */
export async function GET(request: NextRequest) {
  const admin = await getActiveAdmin(request).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
