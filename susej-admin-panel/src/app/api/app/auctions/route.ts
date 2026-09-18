import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await prisma.auction.findMany({ orderBy: { endsAt: "asc" }, take: 100 });
  // List-row photos: auctions carry imageKey = listing id, so join the
  // listing covers in ONE query — otherwise every list row is a blind tile
  // until the buyer opens it (and fresh installs never resolve).
  let covers = new Map<string, string>();
  try {
    const keys = [...new Set(rows.map((a: { imageKey?: unknown }) => String(a.imageKey ?? "")).filter(Boolean))];
    if (keys.length) {
      // Post has no scalar image column — cover is images[0].
      const listings = await prisma.post.findMany({ where: { id: { in: keys } }, select: { id: true, images: true } });
      for (const l of listings as Array<{ id: string; images?: unknown }>) {
        const imgs = Array.isArray(l.images) ? (l.images as unknown[]).filter((u): u is string => typeof u === "string" && !!u) : [];
        if (imgs[0]) covers.set(String(l.id), imgs[0]);
      }
    }
  } catch {}
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
      imageKey: (a as { imageKey?: unknown }).imageKey ?? a.id,
      imageUrl: covers.get(String((a as { imageKey?: unknown }).imageKey ?? "")) ?? null,
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
    // Per-seller daily cap (stories 20/day, live 5/day exist; auctions had
    // none): an uncapped script could mint 500 lots and own the 100-row rail
    // for hours. 10/day is generous for legitimate sellers.
    {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
      const recent = await prisma.auction.count({
        where: { sellerUsername: auth.user.username!, startsAt: { gte: dayAgo } },
      }).catch(() => 0);
      if (recent >= 10) {
        return NextResponse.json({ error: "Auction limit reached — try again tomorrow" }, { status: 429 });
      }
    }
    const title = body.title.trim().slice(0, 120);
    if (title.length < 3) return NextResponse.json({ error: "Title too short" }, { status: 400 });
    const startPrice = Math.floor(Number(body.startPrice ?? 0));
    if (!Number.isFinite(startPrice) || startPrice <= 0 || startPrice > 10000000) {
      return NextResponse.json({ error: "Start price must be between 1 and 10,000,000" }, { status: 400 });
    }
    const hours = Math.min(168, Math.max(1, Math.floor(Number(body.durationHours ?? 24))));
    const now = new Date();
    // Cover binding (photo-hijack + dead-item guard): imageKey must be the
    // seller's OWN live listing — a raw API call used to auction anyone's
    // photo (tile renders the victim's item) or an already-sold row.
    const coverId = typeof body.imageKey === "string" ? body.imageKey.trim().slice(0, 120) : "";
    if (coverId) {
      const cover = await prisma.post.findUnique({ where: { id: coverId } }).catch(() => null);
      const coverOwner = String((cover as { authorUsername?: unknown } | null)?.authorUsername ?? "").trim().toLowerCase();
      const me = String(auth.user.username ?? "").trim().toLowerCase();
      const coverOk = !!cover
        && !!me && coverOwner === me
        && (cover as { status?: unknown }).status === "published"
        && (cover as { isSold?: unknown }).isSold !== true;
      if (!coverOk) {
        return NextResponse.json({ error: "Auction cover must be your own live listing" }, { status: 400 });
      }
    }
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
        imageKey: coverId || null,
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
  // Backing-listing liveness (orphan-lot guard, bid side): the listing may
  // have sold, hidden, or removed since the auction went live (including
  // lots minted before the create-time cover check). Funded bids on a dead
  // item are refused instead of accepted.
  {
    const key = String((auction as { imageKey?: unknown }).imageKey ?? "").trim();
    if (key) {
      const backing = await prisma.post.findUnique({ where: { id: key } }).catch(() => null);
      const alive =
        !!backing &&
        (backing as { status?: unknown }).status === "published" &&
        (backing as { isSold?: unknown }).isSold !== true;
      if (!alive) {
        // Retire the lot so the next bidder doesn't hit the same wall.
        await prisma.auction.update({ where: { id: auction.id }, data: { status: "ended" } }).catch(() => {});
        return NextResponse.json({ error: "This auction's item is no longer available" }, { status: 410 });
      }
    }
  }
  // Self-bidding guard: a seller inflating their own auction price (shill
  // bidding) is fraud on the platform — block it before the bid transaction.
  if (auction.sellerUsername && auction.sellerUsername === auth.user.username) {
    return NextResponse.json({ error: "You cannot bid on your own auction" }, { status: 403 });
  }
  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= auction.currentBid) {
    return NextResponse.json({ error: `Bid must be above ₹${auction.currentBid.toLocaleString("en-IN")}` }, { status: 400 });
  }
  // Server-enforced bid discipline (the app promises these; the server must
  // hold them — client-only rules are display-only): whole rupees, minimum
  // ₹100 increment (eBay-style proxy schedule, flat tier).
  if (!Number.isInteger(amount)) {
    return NextResponse.json({ error: "Bids must be whole rupees" }, { status: 400 });
  }
  if (amount < auction.currentBid + 100) {
    return NextResponse.json(
      { error: `Minimum bid is ₹${(auction.currentBid + 100).toLocaleString("en-IN")} (₹100 increments)` },
      { status: 400 }
    );
  }
  if (amount > 10000000) {
    return NextResponse.json({ error: "Bid exceeds the ₹1,00,00,000 limit" }, { status: 400 });
  }
  // Anti-grief: bids need a funded wallet behind them (empty-wallet accounts
  // could otherwise win every auction for free — no hold exists yet, so the
  // balance check prices grief at one funded account per bid level) + a
  // per-bidder throttle (5 bids/min) so one account can't spray an auction.
  // Full escrow (authorize-at-bid + auto-charge/close worker) is a product
  // build — tracked in the findings log; the winner settles via chat offer.
  const bidderRow = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { username: true, walletBalance: true },
  });
  if (!bidderRow || (bidderRow.walletBalance ?? 0) < amount) {
    return NextResponse.json({ error: "Insufficient wallet balance to back this bid" }, { status: 400 });
  }
  const recentBids = await prisma.auctionBid.count({
    where: { bidder: auth.user.username!, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recentBids >= 5) {
    return NextResponse.json({ error: "Bidding too fast — wait a minute and try again" }, { status: 429 });
  }
  // Concurrent-exposure guard (escrow-bypass hardening): one ₹5,000 wallet
  // backing unlimited simultaneous leading bids is unenforceable — the winner
  // can only pay one. Cap total leading exposure at the wallet balance (the
  // auction being bid on counts too unless already led by this bidder).
  // User-scoped (this bidder's live bids, NOT a take:200 live-auction window —
  // past-200 rows were invisible to the old guard by construction). Fail-closed
  // past a 2000-bid window no real bidder ever hits.
  const exposureOf = async (
    db: { auctionBid: { findMany(a: unknown): Promise<Array<{ auctionId: string; amount: number }>> }; auction: { findMany(a: unknown): Promise<Array<{ id: string; currentBid: number }>> } },
    skipAuctionId: string
  ): Promise<{ exposure: number; leadingThis: number }> => {
    const mine = await db.auctionBid.findMany({
      where: { bidder: auth.user.username!, auctionId: { not: skipAuctionId } },
      select: { auctionId: true, amount: true },
      take: 2000,
    });
    if (mine.length >= 2000) throw new Error("exposure-cap");
    const ids = [...new Set(mine.map((b) => b.auctionId))];
    const others = ids.length
      ? await db.auction.findMany({ where: { id: { in: ids }, status: "live" }, select: { id: true, currentBid: true } })
      : [];
    const cur = new Map(others.map((a) => [a.id, Number(a.currentBid ?? 0)]));
    const myMax = new Map<string, number>();
    for (const b of mine) myMax.set(b.auctionId, Math.max(myMax.get(b.auctionId) ?? 0, Number(b.amount ?? 0)));
    let exposure = 0;
    for (const [aid, mx] of myMax) {
      const cb = cur.get(aid) ?? 0;
      if (cb > 0 && mx >= cb) exposure += cb;
    }
    const mineThis = await db.auctionBid.findMany({
      where: { bidder: auth.user.username!, auctionId: skipAuctionId },
      select: { auctionId: true, amount: true },
      take: 10,
    });
    const leadingThis = mineThis.reduce((m, b) => Math.max(m, Number(b.amount ?? 0)), 0);
    return { exposure, leadingThis };
  };
  try {
    const { exposure, leadingThis } = await exposureOf(prisma as never, auction.id);
    const alreadyLeadingThis = leadingThis >= Number(auction.currentBid ?? 0);
    const need = exposure + (alreadyLeadingThis ? Math.max(0, amount - leadingThis) : amount);
    if (need > (bidderRow.walletBalance ?? 0)) {
      return NextResponse.json({ error: "Insufficient wallet balance to cover all your leading bids" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "exposure-cap") {
      return NextResponse.json({ error: "Too many live bids — settle some auctions first" }, { status: 400 });
    }
  }

  // Atomic bid: re-verify funds + exposure INSIDE the tx (TOCTOU close — a
  // concurrent payout/debit/outbid between the pre-check and the commit used
  // to slip through) + bump currentBid only if still above stored value.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({ where: { id: auction.id } });
    if (!fresh || fresh.status !== "live") throw new Error("closed");
    if (amount <= Number(fresh.currentBid ?? 0)) throw new Error("outbid");
    const me = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });
    if (!me || (me.walletBalance ?? 0) < amount) throw new Error("funds");
    const { exposure, leadingThis } = await exposureOf(tx as never, auction.id);
    const alreadyLeadingThis = leadingThis >= Number(fresh.currentBid ?? 0);
    const need = exposure + (alreadyLeadingThis ? Math.max(0, amount - leadingThis) : amount);
    if (need > (me.walletBalance ?? 0)) throw new Error("exposure");
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
    if (msg === "closed" || msg === "funds" || msg === "exposure" || msg === "exposure-cap") return msg;
    throw e;
  });
  if (result === "closed") {
    return NextResponse.json({ error: "Auction is not live" }, { status: 400 });
  }
  if (result === "funds") {
    return NextResponse.json({ error: "Insufficient wallet balance to back this bid" }, { status: 400 });
  }
  if (result === "exposure" || result === "exposure-cap") {
    return NextResponse.json({ error: "Insufficient wallet balance to cover all your leading bids" }, { status: 400 });
  }
  if (!result) {
    const fresh = await prisma.auction.findUnique({ where: { id: auction.id } });
    return NextResponse.json({ error: `Bid must be above ₹${(fresh?.currentBid ?? auction.currentBid).toLocaleString("en-IN")}` }, { status: 400 });
  }
  return NextResponse.json({ bid: { id: result.id, bidder: result.bidder, amount: result.amount, time: result.createdAt.getTime() }, currentBid: amount }, { status: 201 });
}