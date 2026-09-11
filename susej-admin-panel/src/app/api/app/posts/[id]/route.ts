import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.status !== "published") {
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
      featured: post.featured,
      // Full fidelity with the list endpoint: detail must never be poorer
      // than the card (condition/fulfillment/negotiation drive the PDP).
      mrp: typeof post.mrp === "number" && post.mrp > (post.price ?? 0) ? post.mrp : null,
      condition: post.condition ?? null,
      brand: post.brand ?? null,
      variants: (post as unknown as { variants?: unknown }).variants ?? null,
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
  if (post.authorUsername !== auth.user.username) {
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
    const imgs = body.images as string[];
    if (imgs.length === 0 || imgs.length > 10) {
      return NextResponse.json({ error: "Images must be 1-10" }, { status: 400 });
    }
    for (const u of imgs) {
      const s = String(u).trim();
      if (s.length > 2048) return NextResponse.json({ error: "Image URL too long" }, { status: 400 });
      try {
        const parsed = new URL(s);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: "Image must be http(s)" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
      }
    }
    data.images = imgs;
  }
  if (Array.isArray((body as unknown as { variants?: unknown }).variants)) {
    data.variants = ((body as unknown as { variants: unknown[] }).variants.slice(0, 20) as never);
  }
  if (typeof (body as unknown as { stockLeft?: unknown }).stockLeft === "number") {
    const sl = Math.floor(Number((body as unknown as { stockLeft: number }).stockLeft));
    if (Number.isFinite(sl) && sl >= 0 && sl <= 100000) data.stockLeft = sl;
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
  if (post.authorUsername !== auth.user.username) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }
  await prisma.post.update({ where: { id }, data: { status: "removed" } });
  await prisma.product.delete({ where: { id: `lst_${id}` } }).catch(() => {});
  return NextResponse.json({ ok: true });
}