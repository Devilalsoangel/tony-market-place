import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { sweepExpiredPromotions } from "@/lib/promotions/activate";

// CRON_SECRET guards scheduled tasks. If set, the x-cron-secret header must match.
// This separates cron auth from the general app-key — a compromised app-key
// cannot trigger cron sweeps that expire paid promotions.
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(request: NextRequest) {
  // Prefer dedicated cron secret when configured; fail CLOSED in production
  // when it is missing (never let the widely-distributed app-key expire paid
  // promotions). Local dev keeps the app-key fallback for operability.
  if (CRON_SECRET) {
    const provided = request.headers.get("x-cron-secret");
    if (!provided || provided !== CRON_SECRET) return unauthorized();
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  } else {
    if (!checkAppKey(request)) return unauthorized();
  }
  const result = await sweepExpiredPromotions();
  if (!result.ok) {
    const status = result.error === "database_unavailable" ? 503 : 500;
    return NextResponse.json({ error: result.error, demo: result.demo ?? false }, { status });
  }
  return NextResponse.json({ ok: true, expired: result.expired });
}