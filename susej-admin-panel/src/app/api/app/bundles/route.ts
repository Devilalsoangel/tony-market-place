import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// Public bundle catalog: active bundle deals with their item contents so the
// app can one-tap add the whole set to cart. Legacy rows without items still
// list (the card links the seller's shop instead).
export async function GET() {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await prisma.bundle.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    bundles: rows.map((b) => ({
      id: b.id,
      title: b.title,
      itemsCount: b.itemsCount,
      price: b.price,
      discount: b.discount,
      sellerName: b.sellerName,
      items: Array.isArray(b.items) ? b.items : null,
    })),
  });
}
