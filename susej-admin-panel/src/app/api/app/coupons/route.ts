import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  // Auth-required: coupon codes ARE the secret — an open catalog lets anyone
  // harvest codes and burn usageLimits. Guests can still redeem at checkout
  // (placement validates per-code); they just can't browse the vault.
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const now = new Date();
  const rows = await prisma.coupon.findMany({
    where: { status: "active", expiresAt: { gt: now } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return NextResponse.json({
    coupons: rows
      .filter((c) => c.usedCount < c.usageLimit)
      .map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value,
        expiresAt: c.expiresAt.toISOString(),
      })),
  });
}
