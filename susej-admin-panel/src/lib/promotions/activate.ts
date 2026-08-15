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

  const pkg = getPackage(input.packageId);
  if (!pkg || pkg.kind !== input.kind) {
    return { ok: false as const, error: "unknown_package" };
  }

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

  const purchase = await prisma.promotionPurchase.findUnique({ where: { checkoutRef } });
  if (!purchase) return { ok: false as const, error: "not_found" };
  if (purchase.status !== "pending_payment") {
    return { ok: true as const, purchase: serializePurchase(purchase), alreadyProcessed: true };
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + purchase.durationDays * 24 * 60 * 60 * 1000);
  const position = await nextPosition(prisma, purchase.kind);

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
    providerPaymentId: providerPaymentId ?? `app_${checkoutRef}`,
    status: ACTIVE_STATUS,
    position,
    startsAt: now,
    endsAt,
  };

  if (purchase.kind === "topSeller") {
    const seller = await prisma.seller.findUnique({ where: { id: purchase.sellerId } });
    data.totalSales = seller?.totalSales ?? 0;
    data.rating = seller?.rating ?? 4.5;
    data.reviewCount = seller?.reviewCount ?? 0;
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

  const updated = await prisma.promotionPurchase.update({
    where: { id: purchase.id },
    data: purchaseData,
  });

  return { ok: true as const, purchase: serializePurchase(updated) };
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

  return { ok: true as const, expired: expired.length };
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