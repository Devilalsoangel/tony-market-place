import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { sweepExpiredPromotions } from "@/lib/promotions/activate";

// CRON_SECRET guards scheduled tasks. If set, the x-cron-secret header must match.
// This separates cron auth from the general app-key — a compromised app-key
// cannot trigger cron sweeps that expire paid promotions.
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(request: NextRequest) {
  // Prefer dedicated cron secret when configured; fall back to app key for backwards compat.
  if (CRON_SECRET) {
    const provided = request.headers.get("x-cron-secret");
    if (!provided || provided !== CRON_SECRET) return unauthorized();
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