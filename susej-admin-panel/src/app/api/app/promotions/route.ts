import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { applyPriceOverrides, getPackage } from "@/lib/promotions/catalog";

/** GET /api/app/promotions — ACTIVE paid campaigns only (public read-only).
 *  A campaign is live when status=active and its window (if set) still holds.
 *  This is the feed's single source of truth for paid placements: boost slots,
 *  the Hot Deals rail, and Top Seller pills. No active rows -> no placements. */
export async function GET(req: NextRequest) {
  void req;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const now = new Date();
  // Expire campaigns whose window has passed so the app never renders stale placements.
  await prisma.promotionPurchase.updateMany({
    where: { status: "active", endsAt: { not: null, lt: now } },
    data: { status: "expired" },
  });

  const rows = await prisma.promotionPurchase.findMany({
    where: {
      status: "active",
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Placements whose listing left published status (sold/hidden/removed)
  // must not render — filter against live post rows in one query.
  const postIds = [...new Set(rows.map((p) => p.postId).filter((v): v is string => !!v))];
  let liveIds = new Set<string>(postIds);
  if (postIds.length > 0) {
    try {
      const live = await prisma.post.findMany({
        where: { id: { in: postIds }, status: "published", isSold: false },
        select: { id: true },
      });
      liveIds = new Set(live.map((p) => p.id));
    } catch {
      liveIds = new Set();
    }
  }

  return NextResponse.json({
    promotions: rows.filter((p) => !p.postId || liveIds.has(p.postId)).map((p) => ({
      id: p.id,
      kind: p.kind,
      packageName: p.packageName,
      amountPaid: p.amountPaid,
      durationDays: p.durationDays,
      sellerId: p.sellerId,
      sellerName: p.sellerName,
      sellerLogo: p.sellerLogo,
      productId: p.productId,
      productName: p.productName,
      productImage: p.productImage,
      postId: p.postId,
      postTitle: p.postTitle,
      postImage: p.postImage,
      status: p.status,
      startsAt: p.startsAt ? p.startsAt.getTime() : null,
      endsAt: p.endsAt ? p.endsAt.getTime() : null,
    })),
  });
}

/** POST /api/app/promotions — buy a campaign with the wallet in ONE
 *  transaction (industry: the server owns money, never the client).
 *  Price comes from the server catalog (+ admin promoPrices overrides), the
 *  listing must be owned by the caller, and the debit + ACTIVE placement
 *  commit atomically — airplane-mode-after-debit and double-tap can never
 *  strand money without a placement. `checkoutRef` is idempotent: retrying
 *  with the same ref returns the existing purchase instead of charging twice.
 *  (Replaces the old client-debit + fire-and-forget mirror, which burned
 *  money whenever the mirror failed, and the chat-pin double-charge class.) */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { packageId?: string; postId?: string; checkoutRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const packageId = String(body.packageId ?? "").trim();
  const postId = String(body.postId ?? "").trim();
  if (!packageId || !postId) {
    return NextResponse.json({ error: "packageId and postId are required" }, { status: 400 });
  }

  // Server-authoritative price (admin overrides honored, client price ignored).
  let price = getPackage(packageId)?.price;
  let pkg = getPackage(packageId);
  if (!pkg) return NextResponse.json({ error: "Unknown package" }, { status: 400 });
  try {
    const row: any = await prisma.appSetting.findUnique({ where: { key: "promoPrices" } });
    const priced = applyPriceOverrides(row?.value as Record<string, unknown> | null).find(
      (p) => p.id === packageId
    );
    if (priced) {
      pkg = priced;
      price = priced.price;
    }
  } catch {}
  const amount = Math.round(Number(price));
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid package price" }, { status: 500 });
  }

  const username = auth.user.username!;
  const post = await (prisma as any).post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (String((post as any).authorUsername ?? "") !== username) {
    return NextResponse.json({ error: "You can only promote your own listing" }, { status: 403 });
  }
  // No paid placement on a sold/hidden listing — the slot could never render,
  // so selling it burns the seller's money for nothing.
  if ((post as any).isSold === true) {
    return NextResponse.json({ error: "This listing is already sold" }, { status: 400 });
  }
  if (String((post as any).status ?? "published") !== "published") {
    return NextResponse.json({ error: "Only live listings can be promoted" }, { status: 400 });
  }

  const checkoutRef =
    String(body.checkoutRef ?? "").trim() ||
    `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const existing = await prisma.promotionPurchase.findUnique({ where: { checkoutRef } });
  if (existing) {
    return NextResponse.json(
      {
        purchase: {
          id: existing.id,
          kind: existing.kind,
          amountPaid: existing.amountPaid,
          endsAt: existing.endsAt ? existing.endsAt.getTime() : null,
          duplicate: true,
        },
      },
      { status: 200 }
    );
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + pkg.durationDays * 864e5);
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (amount > 0) {
        const res = await tx.user.updateMany({
          where: { id: auth.user.id, walletBalance: { gte: amount } },
          data: { walletBalance: { decrement: amount } },
        });
        if (res.count === 0) throw new Error("BALANCE");
        await tx.walletTransaction.create({
          data: {
            username,
            title: `Promotion · ${pkg.name}`,
            detail: `${pkg.durationDays}d · ${String((post as any).description ?? (post as any).title ?? "").slice(0, 40)}`,
            amount: -amount,
          },
        });
      }
      return tx.promotionPurchase.create({
        data: {
          kind: pkg.kind,
          packageName: pkg.name,
          amountPaid: amount,
          currency: "INR",
          durationDays: pkg.durationDays,
          sellerId: username,
          sellerName: auth.user.name || username,
          postId,
          postTitle: String((post as any).description ?? (post as any).title ?? "").slice(0, 80),
          provider: "app",
          checkoutRef,
          status: "active",
          isPinned: pkg.pinned,
          startsAt: now,
          endsAt,
        },
      });
    });
    return NextResponse.json(
      {
        purchase: {
          id: created.id,
          kind: created.kind,
          amountPaid: created.amountPaid,
          endsAt: created.endsAt ? created.endsAt.getTime() : null,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "BALANCE") {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }
    // checkoutRef race: a concurrent retry won — return the winner, never charge twice.
    const winner = await prisma.promotionPurchase.findUnique({ where: { checkoutRef } }).catch(() => null);
    if (winner) {
      return NextResponse.json(
        {
          purchase: {
            id: winner.id,
            kind: winner.kind,
            amountPaid: winner.amountPaid,
            endsAt: winner.endsAt ? winner.endsAt.getTime() : null,
            duplicate: true,
          },
        },
        { status: 200 }
      );
    }
    throw e;
  }
}

/**
 * PATCH /api/app/promotions { id } — end a campaign early (owner only).
 * Seller-initiated end forfeits the remaining window (no pro-rata refund;
 * refunds happen only through Finance). Without this, "End early" in the app
 * was local-only while billing time kept burning server-side.
 */
export async function PATCH(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { id?: unknown; postId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  const postId = String(body.postId ?? "").trim();
  if (!id && !postId) return NextResponse.json({ error: "id or postId is required" }, { status: 400 });
  const caller = auth.user.username;
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // The app's local mirror uses PRM- ids; the server row is matched by its
  // own id, or — for mirror rows — by owned postId.
  const rows = id
    ? await prisma.promotionPurchase.findMany({ where: { id } })
    : await prisma.promotionPurchase.findMany({
        where: { postId, sellerId: caller, status: "active" },
      });
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (row.sellerId !== caller) {
    return NextResponse.json({ error: "Not your campaign" }, { status: 403 });
  }
  if (row.status !== "active") return NextResponse.json({ ok: true, status: row.status, ended: rows.length });
  await prisma.promotionPurchase.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "ended", endsAt: new Date() },
  });
  return NextResponse.json({ ok: true, status: "ended", ended: rows.length });
}
