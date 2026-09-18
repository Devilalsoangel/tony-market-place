import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { validateMediaRefs } from "@/lib/media";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const post = await prisma.post.findUnique({ where: { id } });
  // Owner bypass: the author sees their own hidden rows (cold-cache edit of
  // a deactivated listing, owner preview). Strangers still 404 — hidden
  // means hidden for buyers. Case-insensitive like every identity check.
  const caller = String(auth?.user.username ?? "").trim().toLowerCase();
  const owner = String(post?.authorUsername ?? "").trim().toLowerCase();
  const isOwner = !!caller && !!owner && caller === owner;
  if (!post || (post.status !== "published" && !isOwner)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let likedByMe = false;
  if (auth?.user.username) {
    const like = await prisma.postLike.findUnique({
      where: { postId_username: { postId: id, username: auth.user.username } },
    });
    likedByMe = !!like;
  }
  const commentRows = await prisma.postComment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
  });
  const comments = commentRows.map((c) => ({ author: c.author, text: c.text, time: c.createdAt.getTime() }));

  // Display identity resolves LIVE from the author's User row (business name first).
  let sellerDisplayName = post.authorName;
  if (post.authorUsername) {
    const author = await prisma.user.findUnique({
      where: { username: post.authorUsername },
      select: { businessName: true, name: true },
    });
    if (author) sellerDisplayName = author.businessName || author.name;
  }

  const images = Array.isArray(post.images) ? (post.images as string[]) : [];
  return NextResponse.json({
    post: {
      id: post.id,
      sellerName: sellerDisplayName,
      sellerUsername: post.authorUsername ?? "",
      sellerLocation: post.sellerLocation ?? "",
      verified: post.verified,
      price: post.price ?? 0,
      description: post.description ?? "",
      category: post.category ?? "",
      type: post.type,
      hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
      likes: post.likes,
      comments: post.comments,
      commentList: comments,
      createdAt: post.createdAt.getTime(),
      isSold: post.isSold,
      // Owner lifecycle state (removed vs hidden): reactivate prunes truly
      // deleted ids instead of resurrecting them. Buyers never branch on it.
      status: post.status,
      featured: post.featured,
      // Full fidelity with the list endpoint: detail must never be poorer
      // than the card (condition/fulfillment/negotiation drive the PDP).
      mrp: typeof post.mrp === "number" && post.mrp > (post.price ?? 0) ? post.mrp : null,
      condition: post.condition ?? null,
      brand: post.brand ?? null,
      variants: (post as unknown as { variants?: unknown }).variants ?? null,
      subCategories: Array.isArray((post as unknown as { subCategories?: unknown }).subCategories) ? (post as unknown as { subCategories: string[] }).subCategories : null,
      stockLeft: typeof (post as unknown as { stockLeft?: number }).stockLeft === "number" ? (post as unknown as { stockLeft: number }).stockLeft : null,
      negotiable: typeof (post as unknown as { negotiable?: boolean }).negotiable === "boolean" ? (post as unknown as { negotiable: boolean }).negotiable : null,
      deliveryMode: typeof (post as unknown as { deliveryMode?: string }).deliveryMode === "string" ? (post as unknown as { deliveryMode: string }).deliveryMode : null,
      shippingFee: typeof (post as unknown as { shippingFee?: number }).shippingFee === "number" ? (post as unknown as { shippingFee: number }).shippingFee : null,
      listingLat: typeof post.listingLat === "number" ? post.listingLat : null,
      listingLng: typeof post.listingLng === "number" ? post.listingLng : null,
      listingLocation: post.listingLocation ?? "",
      images,
      image: images[0],
      likedByMe,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  // Case-insensitive owner check (GET lane already is): a mixed-case owner
  // read their hidden row fine, then PATCH 403d it — reactivate/deactivate
  // reported partial failures on their own listings.
  const patchCaller = String(auth.user.username ?? "").trim().toLowerCase();
  const patchOwner = String(post.authorUsername ?? "").trim().toLowerCase();
  if (!patchCaller || patchCaller !== patchOwner) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim().slice(0, 200);
    if (t.length >= 3) data.title = t;
  }
  if (typeof body.description === "string") data.description = body.description.slice(0, 5000);
  if (typeof body.price === "number" || typeof body.price === "string") {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p <= 0 || p > 10000000) {
      return NextResponse.json({ error: "Price must be between 1 and 10,000,000" }, { status: 400 });
    }
    data.price = p;
  }
  if (typeof body.category === "string") data.category = body.category.trim().slice(0, 60);
  if (typeof body.isSold === "boolean") data.isSold = body.isSold;
  // Authors may hide/publish their OWN listings (shop deactivation flows
  // through here). `featured` stays engine-owned (see above) — never author-set.
  if (body.status === "hidden" || body.status === "published") data.status = body.status;
  // `featured` is deliberately NOT author-settable: boosting is owned by the
  // paid-promotion engine, never a free client flag.
  if (Array.isArray(body.images)) {
    // Same shared gate as POST (first-party hosts only) — the old hand-rolled
    // URL check accepted any external hotlink here while POST refused it.
    const mediaCheck = validateMediaRefs(body.images, { min: 1, max: 10, field: "image" });
    if (!mediaCheck.ok) {
      return NextResponse.json({ error: mediaCheck.error }, { status: 400 });
    }
    data.images = mediaCheck.urls;
  }
  if (Array.isArray((body as unknown as { variants?: unknown }).variants)) {
    // Shared shape gate with POST (negative/unbounded deltas used to sail
    // through this lane while POST refused them).
    const { sanitizeVariants } = await import("../route");
    const check = sanitizeVariants((body as unknown as { variants?: unknown }).variants);
    if (!check.ok) {
      return NextResponse.json({ error: (check as { error: string }).error }, { status: 400 });
    }
    data.variants = ((check as { variants: unknown }).variants as never);
  }
  if (Array.isArray((body as unknown as { subCategories?: unknown }).subCategories)) {
    data.subCategories = ((body as unknown as { subCategories: unknown[] }).subCategories.map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 20) as never);
  }
  // Single-stock invariant (POST parity): when the incoming variants are
  // tracked, base stockLeft is nulled — two stock truths split inventory.
  // Variant edits arrive together with stock edits on this route, so resolve
  // against the effective (incoming ?? stored) variant set.
  {
    const incomingVariants = Array.isArray((body as unknown as { variants?: unknown }).variants)
      ? ((body as unknown as { variants: Array<{ values?: Array<{ stock?: unknown }> }> }).variants)
      : null;
    const effVariants = incomingVariants ?? (post as unknown as { variants?: Array<{ values?: Array<{ stock?: unknown }> }> | null }).variants ?? null;
    const tracked = Array.isArray(effVariants) && effVariants.some((g) =>
      Array.isArray(g?.values) && g.values.some((v) => typeof v?.stock === "number")
    );
    if (tracked) {
      data.stockLeft = null;
    } else if (typeof (body as unknown as { stockLeft?: unknown }).stockLeft === "number") {
      const sl = Math.floor(Number((body as unknown as { stockLeft: number }).stockLeft));
      if (Number.isFinite(sl) && sl >= 0 && sl <= 100000) data.stockLeft = sl;
    }
  }
  if (typeof (body as unknown as { negotiable?: unknown }).negotiable === "boolean") {
    data.negotiable = (body as unknown as { negotiable: boolean }).negotiable;
  }
  // Edit parity with POST: fulfillment fields stay editable after creation.
  if (typeof (body as unknown as { condition?: unknown }).condition === "string") {
    data.condition = String((body as unknown as { condition: string }).condition).slice(0, 60) || null;
  }
  const rawMode = (body as unknown as { deliveryMode?: unknown }).deliveryMode;
  if (rawMode === "pickup" || rawMode === "shipping" || rawMode === "local") data.deliveryMode = String(rawMode);
  const feeRaw = (body as unknown as { shippingFee?: unknown }).shippingFee;
  if (typeof feeRaw === "number" && Number.isFinite(feeRaw) && feeRaw >= 0 && feeRaw <= 100000) {
    data.shippingFee = Math.floor(feeRaw);
  }

  const updated = await prisma.post.update({ where: { id }, data });

  // Paid-placement burn notice: rails suppress non-published/sold listings,
  // so hiding/selling/deleting a promoted listing silently burns paid days.
  // Tell the seller once per affected campaign (fire-and-forget).
  try {
    const wentDark =
      data.status === "hidden" ||
      (data as { isSold?: unknown }).isSold === true;
    if (wentDark) {
      const { notifyUser } = await import("@/lib/notifications");
      const live = await (prisma as any).promotionPurchase.findMany({
        where: { postId: id, status: "active" },
        select: { id: true, sellerId: true, packageName: true },
      }).catch(() => []);
      for (const p of live as Array<{ id: string; sellerId?: unknown; packageName?: unknown }>) {
        const uname = String(p.sellerId ?? "");
        if (!uname) continue;
        notifyUser(prisma, {
          username: uname, type: "promotion",
          action: `paused "${String(p.packageName ?? "campaign")}" — its listing left the live feed`,
          target: "Paid days pause while the listing is hidden or sold; republish to resume visibility (no pro-rata refund).",
          targetId: p.id,
        });
      }
    }
  } catch {}

  // Keep the admin Product mirror in sync (status vocab: active/featured/hidden).
  const productData: Record<string, unknown> = {};
  if (data.title !== undefined) productData.title = data.title;
  if (data.price !== undefined) productData.price = data.price;
  if (data.category !== undefined) productData.category = data.category;
  if (data.images !== undefined) productData.images = data.images;
  if (Object.keys(productData).length) {
    await prisma.product.update({ where: { id: `lst_${id}` }, data: productData }).catch(() => {});
  }

  return NextResponse.json({ ok: true, post: { id: updated.id, isSold: updated.isSold, featured: updated.featured } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  // Case-insensitive owner check (GET/PATCH lanes already are).
  const delCaller = String(auth.user.username ?? "").trim().toLowerCase();
  const delOwner = String(post.authorUsername ?? "").trim().toLowerCase();
  if (!delCaller || delCaller !== delOwner) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }
  await prisma.post.update({ where: { id }, data: { status: "removed" } });
  await prisma.product.delete({ where: { id: `lst_${id}` } }).catch(() => {});
  // Orphan-lot guard: live auctions backed by this listing would keep
  // accepting funded bids on a removed item (cover join misses, winner
  // settles via chat for nothing). End them with the listing.
  await prisma.auction.updateMany({
    where: { imageKey: id, status: "live" },
    data: { status: "ended" },
  }).catch(() => {});
  // Same burn notice as PATCH-hide/sold (deletion also darkens paid rails).
  try {
    const { notifyUser } = await import("@/lib/notifications");
    const live = await (prisma as any).promotionPurchase.findMany({
      where: { postId: id, status: "active" },
      select: { id: true, sellerId: true, packageName: true },
    }).catch(() => []);
    for (const p of live as Array<{ id: string; sellerId?: unknown; packageName?: unknown }>) {
      const uname = String(p.sellerId ?? "");
      if (!uname) continue;
      notifyUser(prisma, {
        username: uname, type: "promotion",
        action: `ended "${String(p.packageName ?? "campaign")}" — its listing was deleted`,
        target: "Paid placement removed with the listing (no pro-rata refund).",
        targetId: p.id,
      });
    }
  } catch {}
  return NextResponse.json({ ok: true });
}