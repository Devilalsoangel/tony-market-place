import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { getAppUser } from "@/lib/app-auth";
import { getPrisma } from "@/lib/db";
import { lazySweep } from "@/lib/promotions/activate";

export async function GET(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();
  const auth = await getAppUser(request);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sellerId = request.nextUrl.searchParams.get("sellerId");
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId is required." }, { status: 400 });
  }
  if (sellerId !== auth.user.username) {
    return NextResponse.json({ error: "Forbidden: sellerId must match authenticated user" }, { status: 403 });
  }

  await lazySweep();
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: "Database required.", demo: true }, { status: 503 });
  }

  const purchases = await prisma.promotionPurchase.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      id: p.id,
      kind: p.kind,
      packageName: p.packageName,
      status: p.status,
      position: p.position,
      amountPaid: p.amountPaid,
      currency: p.currency,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      remainingDays: p.endsAt ? Math.max(0, Math.ceil((p.endsAt.getTime() - Date.now()) / 86400000)) : null,
    })),
  });
}