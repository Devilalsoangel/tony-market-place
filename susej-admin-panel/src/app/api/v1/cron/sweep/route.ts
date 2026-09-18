import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { sweepExpiredPromotions, sweepOrphanUploads } from "@/lib/promotions/activate";

// CRON_SECRET guards scheduled tasks. If set, the x-cron-secret header must match.
// This separates cron auth from the general app-key — a compromised app-key
// cannot trigger cron sweeps that expire paid promotions.
const CRON_SECRET = process.env.CRON_SECRET ?? "";

function cronAuth(request: NextRequest): NextResponse | null {
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
  return null;
}

async function runSweep() {
  const result = await sweepExpiredPromotions();
  if (!result.ok) {
    const status = result.error === "database_unavailable" ? 503 : 500;
    return NextResponse.json({ error: result.error, demo: result.demo ?? false }, { status });
  }
  const orphans = await sweepOrphanUploads();
  return NextResponse.json({ ok: true, expired: result.expired, uploadsSwept: orphans });
}

export async function POST(request: NextRequest) {
  const denied = cronAuth(request);
  if (denied) return denied;
  return runSweep();
}

// Vercel Cron invokes GET (a POST-only route 405s even a correct schedule),
// so the sweep answers both verbs under the same secret. No vercel.json
// schedule ships with the repo — attach the cron in the dashboard.
export async function GET(request: NextRequest) {
  const denied = cronAuth(request);
  if (denied) return denied;
  return runSweep();
}