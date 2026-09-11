import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
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
