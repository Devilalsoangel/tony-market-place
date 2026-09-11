import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { activatePromotion } from "@/lib/promotions/activate";
import { getAppUser } from "@/lib/app-auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();
  if (process.env.NODE_ENV === "production" && process.env.DEV_SIMULATE !== "true") {
    return NextResponse.json({ error: "Dev simulation is disabled." }, { status: 403 });
  }
  const caller = await getAppUser(request);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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

  // Ownership check: promotion must belong to caller
  try {
    const prisma = await getPrisma();
    if (prisma) {
      const row = await prisma.promotionPurchase.findUnique({ where: { checkoutRef }, select: { sellerId: true } });
      if (row && row.sellerId !== String(caller.user.username ?? caller.user.id)) {
        return NextResponse.json({ error: "Not your promotion" }, { status: 403 });
      }
    }
  } catch {}

  const result = await activatePromotion(checkoutRef, `dev_${checkoutRef}`);
  if (!result.ok) {
    const status = result.error === "database_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error, demo: result.demo ?? false }, { status });
  }
  return NextResponse.json(result);
}