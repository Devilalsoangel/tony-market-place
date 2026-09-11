import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await prisma.auction.findMany({ orderBy: { endsAt: "asc" }, take: 100 });
  return NextResponse.json({
    auctions: rows.map((a) => ({
      id: a.id,
      title: a.title,
      seller: a.sellerName,
      sellerUsername: a.sellerUsername,
      startPrice: a.startPrice ?? a.currentBid,
      currentBid: a.currentBid,
      endTime: a.endsAt.getTime(),
      bidsCount: a.bids,
      status: a.status as "live" | "upcoming" | "ended",
    })),
  });
}

// Place a bid on an auction (real multi-user bidding)
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { auctionId?: string; amount?: number; title?: string; startPrice?: number; durationHours?: number; imageKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Create a new auction (seller-only). Bidding stays on { auctionId, amount }.
  if (!body.auctionId && typeof body.title === "string") {
    if (!auth.user.isSeller || auth.user.verification !== "approved") {
      return NextResponse.json({ error: "Only approved sellers can start auctions" }, { status: 403 });
    }
    const title = body.title.trim().slice(0, 120);
    if (title.length < 3) return NextResponse.json({ error: "Title too short" }, { status: 400 });
    const startPrice = Math.floor(Number(body.startPrice ?? 0));
    if (!Number.isFinite(startPrice) || startPrice <= 0 || startPrice > 10000000) {
      return NextResponse.json({ error: "Start price must be between 1 and 10,000,000" }, { status: 400 });
    }
    const hours = Math.min(168, Math.max(1, Math.floor(Number(body.durationHours ?? 24))));
    const now = new Date();
    const created = await prisma.auction.create({
      data: {
        title,
        status: "live",
        currentBid: startPrice,
        endsAt: new Date(now.getTime() + hours * 3600e3),
        bids: 0,
        sellerName: auth.user.businessName || auth.user.name,
        sellerUsername: auth.user.username!,
        startPrice,
        imageKey: typeof body.imageKey === "string" ? body.imageKey.slice(0, 120) : null,
        startsAt: now,
      },
    });
    return NextResponse.json(
      {
        auction: {
          id: created.id,
          title: created.title,
          seller: created.sellerName,
          sellerUsername: created.sellerUsername,
          startPrice: created.startPrice ?? created.currentBid,
          currentBid: created.currentBid,
          endTime: created.endsAt.getTime(),
          bidsCount: 0,
          status: "live",
        },
      },
      { status: 201 }
    );
  }
  const auction = await prisma.auction.findUnique({ where: { id: String(body.auctionId ?? "") } });
  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "live") return NextResponse.json({ error: "Auction is not live" }, { status: 400 });
  // Self-bidding guard: a seller inflating their own auction price (shill
  // bidding) is fraud on the platform — block it before the bid transaction.
  if (auction.sellerUsername && auction.sellerUsername === auth.user.username) {
    return NextResponse.json({ error: "You cannot bid on your own auction" }, { status: 403 });
  }
  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= auction.currentBid) {
    return NextResponse.json({ error: `Bid must be above ₹${auction.currentBid.toLocaleString("en-IN")}` }, { status: 400 });
  }

  // Atomic bid: create row + bump currentBid only if still above stored value
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.auction.updateMany({
      where: { id: auction.id, currentBid: { lt: amount }, status: "live" },
      data: { currentBid: amount, bids: { increment: 1 } },
    });
    if (updated.count === 0) throw new Error("outbid");
    const bid = await tx.auctionBid.create({ data: { auctionId: auction.id, bidder: auth.user.username!, amount } });
    return bid;
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "outbid") return null;
    throw e;
  });
  if (!result) {
    const fresh = await prisma.auction.findUnique({ where: { id: auction.id } });
    return NextResponse.json({ error: `Bid must be above ₹${(fresh?.currentBid ?? auction.currentBid).toLocaleString("en-IN")}` }, { status: 400 });
  }
  return NextResponse.json({ bid: { id: result.id, bidder: result.bidder, amount: result.amount, time: result.createdAt.getTime() }, currentBid: amount }, { status: 201 });
}