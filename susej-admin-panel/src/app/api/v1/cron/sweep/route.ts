import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { sweepExpiredPromotions } from "@/lib/promotions/activate";

export async function POST(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();
  const result = await sweepExpiredPromotions();
  if (!result.ok) {
    const status = result.error === "database_unavailable" ? 503 : 500;
    return NextResponse.json({ error: result.error, demo: result.demo ?? false }, { status });
  }
  return NextResponse.json({ ok: true, expired: result.expired });
}