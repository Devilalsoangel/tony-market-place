import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/**
 * GET /api/app/auctions/[id] — single auction with SERVER-resolved top bid.
 *
 * The detail screen used to crown "You won!" from the device-local bid
 * thread: a rival outbid from another phone never merged, so losers
 * celebrated. The winner is the highest auctionBid row — one query, no N+1
 * (the list lane stays light on purpose).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req).catch(() => null);
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const auction = await (prisma as any).auction.findUnique({ where: { id } }).catch(() => null);
  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  const top = await (prisma as any).auctionBid
    .findFirst({ where: { auctionId: id }, orderBy: [{ amount: "desc" }, { createdAt: "asc" }] })
    .catch(() => null);
  const me = auth?.user?.username ? String(auth.user.username) : "";
  const myTop = me
    ? await (prisma as any).auctionBid
        .findFirst({ where: { auctionId: id, bidder: me }, orderBy: [{ amount: "desc" }] })
        .catch(() => null)
    : null;
  // Listing cover for the hero (same join as the list lane).
  let imageUrl: string | null = null;
  try {
    const key = String((auction as { imageKey?: unknown }).imageKey ?? "");
    if (key) {
      const listing = await (prisma as any).post.findUnique({ where: { id: key }, select: { images: true } }).catch(() => null);
      const imgs = Array.isArray(listing?.images) ? (listing.images as unknown[]).filter((u): u is string => typeof u === "string" && !!u) : [];
      if (imgs[0]) imageUrl = imgs[0];
    }
  } catch {}
  return NextResponse.json({
    auction: {
      id: auction.id,
      title: auction.title,
      seller: auction.sellerName,
      sellerUsername: auction.sellerUsername,
      startPrice: auction.startPrice ?? auction.currentBid,
      currentBid: auction.currentBid,
      endTime: auction.endsAt ? new Date(auction.endsAt).getTime() : null,
      bidsCount: auction.bids,
      status: auction.status,
      imageUrl,
      topBid: top ? { bidder: String(top.bidder ?? ""), amount: Number(top.amount ?? 0) } : null,
      myTopBid: myTop ? Number(myTop.amount ?? 0) : 0,
      iAmWinning: !!me && !!top && String(top.bidder ?? "") === me,
    },
  });
}
