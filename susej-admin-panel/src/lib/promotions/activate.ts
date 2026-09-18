import { randomUUID } from "node:crypto";
import { format } from "date-fns";
import { getPrisma } from "@/lib/db";
import { getPackage, type PromotionKind } from "@/lib/promotions/catalog";

export const ACTIVE_STATUS = "active";

export interface CheckoutInput {
  kind: PromotionKind;
  packageId: string;
  sellerId: string;
  productId?: string;
  discountedPrice?: number;
  postId?: string;
  postTitle?: string;
  postImage?: string;
  postExcerpt?: string;
}

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export async function createPendingPurchase(input: CheckoutInput) {
  const prisma = await getPrisma();
  if (!prisma) return { ok: false as const, error: "database_unavailable", demo: true };

  let pkg = getPackage(input.packageId);
  if (!pkg || pkg.kind !== input.kind) {
    return { ok: false as const, error: "unknown_package" };
  }
  // Respect admin-edited price overrides (promoPrices AppSetting). The config
  // GET returns overridden prices, so checkout must charge the same amount.
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "promoPrices" } });
    const overrides = row?.value as Record<string, unknown> | null | undefined;
    const raw = overrides?.[pkg.id];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) pkg = { ...pkg, price: Math.round(raw) };
    // chatPin override does not affect promotion packages
  } catch {}

  let sellerName = input.sellerId;
  let sellerLogo: string | null = null;
  try {
    const seller = await prisma.seller.findUnique({ where: { id: input.sellerId } });
    if (seller) {
      sellerName = seller.businessName;
      sellerLogo = seller.logo;
    }
  } catch {
    // ignore - fall back to raw sellerId
  }

  const checkoutRef = randomUUID();
  const purchase = await prisma.promotionPurchase.create({
    data: {
      kind: input.kind,
      packageName: pkg.name,
      amountPaid: pkg.price,
      currency: pkg.currency,
      durationDays: pkg.durationDays,
      sellerId: input.sellerId,
      sellerName,
      sellerLogo,
      productId: input.productId,
      discountedPrice: input.discountedPrice,
      postId: input.postId,
      postTitle: input.postTitle,
      postImage: input.postImage,
      postExcerpt: input.postExcerpt,
      provider: "dev",
      checkoutRef,
      status: "pending_payment",
      isPinned: pkg.pinned,
    },
  });

  return { ok: true as const, checkoutRef, amountPaid: pkg.price, currency: pkg.currency };
}

export async function activatePromotion(checkoutRef: string, providerPaymentId?: string) {
  const prisma = await getPrisma();
  if (!prisma) return { ok: false as const, error: "database_unavailable", demo: true };

  // Atomic claim: flip pending_payment→active in ONE updateMany. Concurrent
  // confirms (double-tap Pay / timeout retry) serialize on the row lock —
  // exactly one wins the claim; losers fall through to alreadyProcessed.
  // Previously both reads saw pending_payment and both created rail rows
  // (one payment → two placements).
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx: any) => {
    const upd = await tx.promotionPurchase.updateMany({
      where: { checkoutRef, status: "pending_payment" },
      data: { providerPaymentId: providerPaymentId ?? null, status: ACTIVE_STATUS, startsAt: now },
    });
    if (upd.count !== 1) return null;
    const purchase = await tx.promotionPurchase.findUnique({ where: { checkoutRef } });
    if (!purchase) throw new Error("claim lost");
    const endsAt = new Date(now.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000);
    const position = await nextPosition(tx, purchase.kind);
    // Route every db call below through the claiming tx.
    const prisma = tx;

  const data: Record<string, unknown> = {
    sellerId: purchase.sellerId,
    sellerName: purchase.sellerName,
    sellerLogo: purchase.sellerLogo ?? "",
    position,
    isPinned: purchase.isPinned,
    status: ACTIVE_STATUS,
    createdAt: now,
  };
  const purchaseData: Record<string, unknown> = {
    position,
    endsAt,
  };

  if (purchase.kind === "topSeller") {
    // Live snapshot by USERNAME (orders + reviews are keyed by sellerUsername).
    // The old code looked up Seller.id with the username and always missed
    // (totalSales 0 / rating 0), and Seller.totalSales is never incremented by
    // any order path — so the home "X sales" never reconciled. Snapshot real
    // delivered-order units + review aggregate here; /api/v1/home re-resolves
    // live at serve time so the number keeps reconciling after purchase.
    let totalSales = 0;
    let rating = 0;
    let reviewCount = 0;
    try {
      const [delivered, agg] = await Promise.all([
        prisma.order.findMany({
          where: { sellerUsername: purchase.sellerId, status: "delivered" },
          select: { itemsList: true },
        }),
        prisma.review.aggregate({
          where: { sellerUsername: purchase.sellerId },
          _avg: { rating: true },
          _count: { id: true },
        }),
      ]);
      for (const o of delivered) {
        const items = Array.isArray((o as { itemsList?: unknown }).itemsList)
          ? ((o as { itemsList: { qty?: unknown; quantity?: unknown }[] }).itemsList)
          : [];
        for (const it of items) totalSales += Math.max(1, Math.round(Number(it?.qty ?? it?.quantity ?? 1)));
      }
      rating = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0;
      reviewCount = agg._count.id;
    } catch {
      // Snapshot best-effort — serve-time live resolve is the real truth.
    }
    data.totalSales = totalSales;
    data.rating = rating;
    data.reviewCount = reviewCount;
    await prisma.topSeller.create({ data: data as never });
  }

  if (purchase.kind === "hotDeal") {
    const product = await prisma.product.findUnique({ where: { id: purchase.productId ?? "" } });
    const originalPrice = product?.price ?? 0;
    const discountedPrice = purchase.discountedPrice ?? originalPrice;
    await prisma.hotDeal.create({
      data: {
        productId: purchase.productId ?? "",
        productName: product?.title ?? purchase.productName ?? "Product",
        productImage: firstImage(product?.images),
        originalPrice,
        discountedPrice,
        discountPercentage: discountPercent(originalPrice, discountedPrice),
        startDate: isoDate(now),
        endDate: isoDate(endsAt),
        priority: position,
        status: ACTIVE_STATUS,
        createdAt: now,
      },
    });
  }

    if (purchase.kind === "featuredPost") {
    await prisma.featuredPost.create({
      data: {
        postId: purchase.postId ?? "",
        title: purchase.postTitle ?? "Featured post",
        excerpt: purchase.postExcerpt ?? "",
        imageUrl: purchase.postImage ?? "",
        position,
        isPinned: purchase.isPinned,
        status: ACTIVE_STATUS,
        startDate: isoDate(now),
        endDate: isoDate(endsAt),
        createdAt: now,
      },
    });
  }

  if (purchase.kind === "spotlight") {
    // Spotlight pins a listing/post at the top of buyer feeds for a fixed
    // duration (24h). It always occupies position 1 — only one active
    // spotlight per seller at a time (enforced by unique constraint below).
    await prisma.spotlight.create({
      data: {
        postId: purchase.postId ?? null,
        productId: purchase.productId ?? null,
        sellerId: purchase.sellerId,
        sellerName: purchase.sellerName ?? "",
        sellerLogo: purchase.sellerLogo ?? "",
        title: purchase.postTitle ?? purchase.productName ?? "Spotlight listing",
        imageUrl: purchase.postImage ?? purchase.productImage ?? "",
        position: 1,
        isPinned: true,
        status: ACTIVE_STATUS,
        startDate: isoDate(now),
        endDate: isoDate(endsAt),
        createdAt: now,
      },
    });
  }

    const updated = await tx.promotionPurchase.update({
      where: { id: purchase.id },
      data: purchaseData,
    });
    return updated;
  });

  if (!claimed) {
    const purchase = await prisma.promotionPurchase.findUnique({ where: { checkoutRef } });
    if (!purchase) return { ok: false as const, error: "not_found" };
    return { ok: true as const, purchase: serializePurchase(purchase), alreadyProcessed: true };
  }
  return { ok: true as const, purchase: serializePurchase(claimed) };
}

export async function deactivateOnRefund(checkoutRef: string) {
  const prisma = await getPrisma();
  if (!prisma) return { ok: false as const, error: "database_unavailable" };

  const purchase = await prisma.promotionPurchase.findUnique({ where: { checkoutRef } });
  if (!purchase) return { ok: false as const, error: "not_found" };

  await prisma.promotionPurchase.update({
    where: { id: purchase.id },
    data: { status: "refunded", isPinned: false } as never,
  });
  await hideSlot(prisma, purchase.kind, purchase.position);
  // Money back: the purchase debit left the seller's wallet, so refunding
  // must re-credit it — previously the slot unpinned while the money stayed
  // taken. Race-safe by construction: the credit row is created FIRST inside
  // one tx, so concurrent double-refunds serialize on UNIQUE(username,title)
  // — the loser takes P2002 and its increment rolls back with it (the old
  // count-then-increment shape double-credited: both passed count==0, both
  // incremented, one create won and the loser's P2002 was swallowed).
  try {
    const revTitle = `Promotion refund · ${purchase.checkoutRef}`;
    const amount = Number(purchase.amountPaid ?? 0);
    if (amount > 0 && purchase.sellerId) {
      const seller = await prisma.user.findUnique({ where: { username: purchase.sellerId } }).catch(() => null);
      if (seller) {
        try {
          await prisma.$transaction(async (tx: any) => {
            await tx.walletTransaction.create({
              data: {
                username: purchase.sellerId as string,
                title: revTitle,
                detail: `Refund for ${purchase.packageName} (${purchase.kind})`,
                amount,
              },
            });
            await tx.user.update({
              where: { id: seller.id },
              data: { walletBalance: { increment: amount } },
            });
          });
        } catch (txErr) {
          // P2002 = a concurrent refund (or replay) already credited this
          // title — idempotent replay, not a failure. Anything else keeps the
          // old contract: slot stays unpinned, credit is skipped, call still ok.
          if ((txErr as { code?: string })?.code !== "P2002") throw txErr;
        }
      }
    }
  } catch {
    // Slot is already unpinned above; a credit failure must not re-pin it.
  }

  return { ok: true as const, status: "refunded" };
}

async function hideSlot(prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>, kind: string, position: number | null) {
  if (position === null) return;
  try {
    if (kind === "topSeller") {
      await prisma.topSeller.updateMany({
        where: { status: ACTIVE_STATUS, position },
        data: { status: "expired", isPinned: false },
      });
    } else if (kind === "hotDeal") {
      await prisma.hotDeal.updateMany({
        where: { status: ACTIVE_STATUS, priority: position },
        data: { status: "expired" },
      });
        } else if (kind === "featuredPost") {
      await prisma.featuredPost.updateMany({
        where: { status: ACTIVE_STATUS, position },
        data: { status: "expired", isPinned: false },
      });
    } else if (kind === "spotlight") {
      await prisma.spotlight.updateMany({
        where: { status: ACTIVE_STATUS },
        data: { status: "expired", isPinned: false },
      });
    }
  } catch {
    // best effort
  }
}

export async function sweepExpiredPromotions() {
  const prisma = await getPrisma();
  if (!prisma) return { ok: false as const, error: "database_unavailable", demo: true };

  const now = new Date();
  const expired = await prisma.promotionPurchase.findMany({
    where: { status: ACTIVE_STATUS, endsAt: { lte: now } },
    select: { id: true, kind: true, position: true },
  });

  for (const p of expired) {
    await hideSlot(prisma, p.kind, p.position);
    await prisma.promotionPurchase.update({ where: { id: p.id }, data: { status: "expired", isPinned: false } });
  }

  // Orphan expiry: featured/spotlight rows carry their own endDate strings
  // and may have NO backing purchase (legacy/manual rows). A past endDate
  // must unpin them even when no purchase row exists to trigger hideSlot.
  const nowMs = now.getTime();
  try {
    const [feat, spots] = await Promise.all([
      prisma.featuredPost.findMany({ where: { status: ACTIVE_STATUS }, select: { id: true, endDate: true } }),
      prisma.spotlight.findMany({ where: { status: ACTIVE_STATUS }, select: { id: true, endDate: true } }),
    ]);
    const pastIds = (rows: { id: string; endDate: string }[]) =>
      rows.filter((r) => r.endDate && !Number.isNaN(Date.parse(r.endDate)) && Date.parse(r.endDate) <= nowMs).map((r) => r.id);
    const featPast = pastIds(feat as { id: string; endDate: string }[]);
    const spotPast = pastIds(spots as { id: string; endDate: string }[]);
    if (featPast.length) {
      await prisma.featuredPost.updateMany({ where: { id: { in: featPast } }, data: { status: "expired", isPinned: false } });
    }
    if (spotPast.length) {
      await prisma.spotlight.updateMany({ where: { id: { in: spotPast } }, data: { status: "expired", isPinned: false } });
    }
  } catch {
    // best effort — serve-time filter below still hides them from buyers
  }

  return { ok: true as const, expired: expired.length };
}

export async function sweepOrphanUploads(): Promise<{ ok: true; removed: number; scanned: number }> {
  const prisma = await getPrisma();
  if (!prisma) return { ok: true, removed: 0, scanned: 0 };
  // Disk-only (serverless ephemeral; Cloudinary objects need their own
  // lifecycle rule in the cloud console — out of reach here, noted).
  // Uploads with no DB row referencing them (abandoned wizards, 400d creates)
  // older than 7 days are deleted. Bounded scan; failures never throw.
  try {
    const { readdir, stat, unlink } = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "uploads");
    let files: string[] = [];
    try {
      files = (await readdir(dir)).slice(0, 2000);
    } catch {
      return { ok: true, removed: 0, scanned: 0 };
    }
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const old: string[] = [];
    for (const f of files) {
      try {
        const st = await stat(path.join(dir, f));
        if (st.isFile() && st.mtimeMs < cutoff) old.push(f);
      } catch {}
    }
    if (!old.length) return { ok: true, removed: 0, scanned: files.length };
    const refs = new Set<string>();
    const remember = (v: unknown) => {
      if (typeof v === "string" && v.includes("/uploads/")) {
        const m = v.match(/\/uploads\/([A-Za-z0-9._-]+)/);
        if (m) refs.add(m[1]);
      } else if (Array.isArray(v)) {
        for (const x of v) remember(x);
      } else if (v && typeof v === "object") {
        // Plain-object recursion: any future Json-object image field (variant
        // overlays etc.) is protected too — strings+arrays alone silently
        // missed embedded URLs.
        for (const x of Object.values(v as Record<string, unknown>)) remember(x);
      }
    };
    // Reference scan: EVERY table that stores /uploads/ URLs. Missing one
    // irreversibly deletes live files — SellerDocument.url (KYC evidence,
    // compliance-critical, NOT re-uploadable by the user) and User.avatar
    // (profile photos) were both absent and got eaten at 7d.
    // Product.images mirrors Post.images (survives independent Post deletes);
    // promo-copy tables (purchase/topSeller/hotDeal/featured/spotlight) carry
    // /uploads/-derived URLs that outlive their originals on paid rails.
    // Story overlays/productRef embed a product copy (image) that outlives
    // post edits — the object recursion covers them.
    // Bounded scans (take CAP = the file cap): at 100k-row scale unbounded
    // selects would OOM/timeout the serverless cron (fail-safe direction —
    // no cleanup — but still a silent disable). Stronger: when ANY table hits
    // the cap the scan is provably partial, so deletion is REFUSED outright
    // (fail-safe toward accumulation, LOUD) — a partial ref-set reads live
    // files as orphans and eats them.
    const CAP = 2000;
    const cappedTables: string[] = [];
    // Error path refuses like cap-hit: a failed table contributes zero refs,
    // and deleting against a partial ref-set eats live files (a transient DB
    // error must accumulate, never delete).
    const capped = async <T>(name: string, q: Promise<T[]>): Promise<T[]> => {
      try {
        const rows = await q;
        if (rows.length >= CAP) cappedTables.push(name);
        return rows;
      } catch {
        cappedTables.push(`${name}!err`);
        return [] as T[];
      }
    };
    const [posts, products, stories, reels, banners, sellers, sellerDocs, avatars, purchases, tops, deals, featured, spots] = await Promise.all([
      capped("post", prisma.post.findMany({ select: { images: true }, take: CAP })),
      capped("product", prisma.product.findMany({ select: { images: true }, take: CAP })),
      capped("story", prisma.story.findMany({ select: { image: true, overlays: true, productRef: true }, take: CAP })),
      capped("reel", prisma.reel.findMany({ select: { mediaUrl: true }, take: CAP })),
      capped("storefrontBanner", prisma.storefrontBanner.findMany({ select: { imageUrl: true }, take: CAP })),
      capped("seller", prisma.seller.findMany({ select: { logo: true, selfieUrl: true }, take: CAP })),
      capped("sellerDocument", (prisma as any).sellerDocument.findMany({ select: { url: true }, take: CAP })),
      capped("user", prisma.user.findMany({ select: { avatar: true }, take: CAP })),
      capped("promotionPurchase", (prisma as any).promotionPurchase.findMany({ select: { sellerLogo: true, postImage: true, productImage: true }, take: CAP })),
      capped("topSeller", (prisma as any).topSeller.findMany({ select: { sellerLogo: true }, take: CAP })),
      capped("hotDeal", (prisma as any).hotDeal.findMany({ select: { productImage: true }, take: CAP })),
      capped("featuredPost", (prisma as any).featuredPost.findMany({ select: { imageUrl: true }, take: CAP })),
      capped("spotlight", (prisma as any).spotlight.findMany({ select: { imageUrl: true, sellerLogo: true }, take: CAP })),
    ]);
    if (cappedTables.length) {
      console.error(`[sweep] REFUSED: partial scan (${cappedTables.join(",")} hit the ${CAP} cap) — deletion unsafe, accumulating instead.`);
      return { ok: true, removed: 0, scanned: files.length };
    }
    for (const row of [...posts, ...products, ...stories, ...reels, ...banners, ...sellers, ...sellerDocs, ...avatars, ...purchases, ...tops, ...deals, ...featured, ...spots]) {
      for (const v of Object.values(row as Record<string, unknown>)) remember(v);
    }
    let removed = 0;
    for (const f of old) {
      if (refs.has(f)) continue;
      try {
        await unlink(path.join(dir, f));
        removed += 1;
      } catch {}
    }
    return { ok: true, removed, scanned: files.length };
  } catch {
    return { ok: true, removed: 0, scanned: 0 };
  }
}

let lastSweepAt = 0;
export async function lazySweep() {
  const now = Date.now();
  if (now - lastSweepAt < 5 * 60 * 1000) return;
  lastSweepAt = now;
  await sweepExpiredPromotions();
}

async function nextPosition(prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>, kind: string): Promise<number> {
  try {
    if (kind === "topSeller") {
      const max = await prisma.topSeller.aggregate({ _max: { position: true } });
      return (max._max.position ?? 0) + 1;
    }
        if (kind === "hotDeal") {
      const max = await prisma.hotDeal.aggregate({ _max: { priority: true } });
      return (max._max.priority ?? 0) + 1;
    }
    if (kind === "spotlight") {
      // Spotlight always occupies position 1 — the top feed slot.
      return 1;
    }
    const max = await prisma.featuredPost.aggregate({ _max: { position: true } });
    return (max._max.position ?? 0) + 1;
  } catch {
    return 1;
  }
}

function discountPercent(original: number, discounted: number): number {
  if (!original || !discounted || discounted >= original) return 0;
  return Math.round(((original - discounted) / original) * 100);
}

function firstImage(images: unknown): string {
  if (Array.isArray(images) && typeof images[0] === "string") return images[0];
  if (images && typeof images === "object" && "url" in (images as Record<string, unknown>)) {
    return String((images as Record<string, unknown>).url);
  }
  return "";
}

function serializePurchase(p: {
  id: string;
  kind: string;
  packageName: string;
  status: string;
  position: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  amountPaid: number;
  currency: string;
  durationDays: number;
}) {
  return {
    id: p.id,
    kind: p.kind,
    packageName: p.packageName,
    status: p.status,
    position: p.position,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    amountPaid: p.amountPaid,
    currency: p.currency,
    durationDays: p.durationDays,
    remainingDays: p.endsAt ? Math.max(0, Math.ceil((p.endsAt.getTime() - Date.now()) / 86400000)) : null,
  };
}