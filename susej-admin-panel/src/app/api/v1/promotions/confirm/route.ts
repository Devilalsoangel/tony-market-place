import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { activatePromotion } from "@/lib/promotions/activate";

export async function POST(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();
  if (process.env.NODE_ENV === "production" && process.env.DEV_SIMULATE !== "true") {
    return NextResponse.json({ error: "Dev simulation is disabled." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const checkoutRef = String(body.checkoutRef ?? "");
  if (!checkoutRef) {
    return NextResponse.json({ error: "checkoutRef is required." }, { status: 400 });
  }

  const result = await activatePromotion(checkoutRef, `dev_${checkoutRef}`);
  if (!result.ok) {
    const status = result.error === "database_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error, demo: result.demo ?? false }, { status });
  }
  return NextResponse.json(result);
}