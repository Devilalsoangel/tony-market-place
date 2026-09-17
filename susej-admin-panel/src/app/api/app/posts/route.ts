import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { validateMediaRefs } from "@/lib/media";

function toAppPost(p: {
  id: string;
  title: string;
  authorName: string;
  authorUsername: string | null;
  sellerLocation: string | null;
  verified: boolean;
  price: number | null;
  mrp?: number | null;
  description: string | null;
  category: string | null;
  type: string;
  hashtags: unknown;
  images: unknown;
  likes: number;
  comments: number;
  isSold: boolean;
  featured: boolean;
  condition?: string | null;
  brand?: string | null;
  variants?: unknown;
  stockLeft?: number | null;
  negotiable?: boolean | null;
  deliveryMode?: string | null;
  shippingFee?: number | null;
  listingLat?: number | null;
  listingLng?: number | null;
  listingLocation?: string | null;
  createdAt: Date;
  likedByMe?: boolean;
}, authorDisplay?: string | null) {
  const images = Array.isArray(p.images) ? (p.images as string[]) : [];
  const hashtags = Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [];
  return {
    id: p.id,
    title: p.title,
    // Display identity resolves LIVE from the author's User row (business
    // name first) so renamed/rebranded sellers never show stale signup names.
    sellerName: authorDisplay || p.authorName,
    sellerUsername: p.authorUsername ?? "",
    sellerLocation: p.sellerLocation ?? "",
    verified: p.verified,
    price: p.price ?? 0,
    mrp: typeof p.mrp === "number" && p.mrp > (p.price ?? 0) ? p.mrp : null,
    description: p.description ?? "",
    category: p.category ?? "",
    type: (p.type as "product" | "service" | "food_item") ?? "product",
    hashtags,
    likes: p.likes,
    comments: p.comments,
    createdAt: p.createdAt.getTime(),
    isSold: p.isSold,
    featured: p.featured,
    variants: (p as unknown as { variants?: unknown }).variants ?? null,
    subCategories: Array.isArray((p as unknown as { subCategories?: unknown }).subCategories) ? (p as unknown as { subCategories: string[] }).subCategories : null,
    stockLeft: typeof (p as unknown as { stockLeft?: number }).stockLeft === "number" ? (p as unknown as { stockLeft: number }).stockLeft : null,
    negotiable: typeof (p as unknown as { negotiable?: boolean }).negotiable === "boolean" ? (p as unknown as { negotiable: boolean }).negotiable : null,
    deliveryMode: typeof (p as unknown as { deliveryMode?: string }).deliveryMode === "string" ? (p as unknown as { deliveryMode: string }).deliveryMode : null,
    shippingFee: typeof (p as unknown as { shippingFee?: number }).shippingFee === "number" ? (p as unknown as { shippingFee: number }).shippingFee : null,
    images,
    image: images[0],
    likedByMe: p.likedByMe ?? false,
    // Optional per-listing selling location (separate from the seller's store
    // address) — powers delivery-area context on the product page.
    listingLat: typeof p.listingLat === "number" ? p.listingLat : null,
    listingLng: typeof p.listingLng === "number" ? p.listingLng : null,
    listingLocation: p.listingLocation ?? "",
  };
}

export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  const username = auth?.user.username ?? null;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const seller = req.nextUrl.searchParams.get("seller");
  const cat = req.nextUrl.searchParams.get("category");
  // Guard: cap search query length to prevent DoS via expensive LIKE queries (slice before lowercasing).
  const qRaw = req.nextUrl.searchParams.get("q");
  const q = qRaw ? qRaw.slice(0, 100).toLowerCase() : undefined;

  const posts = await prisma.post.findMany({
    where: {
      status: "published",
      ...(seller ? { authorUsername: seller } : {}),
      ...(cat ? { category: { equals: cat, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const likedSet = new Set<string>();
  if (username) {
    const likes = await prisma.postLike.findMany({
      where: { username },
      select: { postId: true },
    });
    likes.forEach((l) => likedSet.add(l.postId));
  }

  // Resolve current author display names (business name first, real rows only).
  const authorNames = new Map<string, string>();
  const authorUsernames = Array.from(new Set(posts.map((p) => p.authorUsername).filter(Boolean))) as string[];
  if (authorUsernames.length) {
    const authors = await prisma.user.findMany({
      where: { username: { in: authorUsernames } },
      select: { username: true, name: true, businessName: true },
    });
    authors.forEach((a) => {
      if (a.username) authorNames.set(a.username, a.businessName || a.name);
    });
  }

  return NextResponse.json({ posts: posts.map((p) => toAppPost({ ...p, likedByMe: likedSet.has(p.id) }, authorNames.get(p.authorUsername ?? ""))) });
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { user } = auth;
  // Approved sellers only: pending-KYC accounts have isSeller=false after the
  // users/me re-verify reset, and this gate enforces it at creation time too.
  if (!user.isSeller || user.verification !== "approved") {
    return NextResponse.json({ error: "Only approved sellers can create listings" }, { status: 403 });
  }
  const price = typeof body.price === "number" ? body.price : Number(body.price ?? 0);
  const rawMrp = typeof body.mrp === "number" ? body.mrp : Number(body.mrp ?? 0);
  const mrp = Number.isFinite(rawMrp) && rawMrp > price ? rawMrp : null;
  const images = Array.isArray(body.images) ? (body.images as string[]) : body.image ? [body.image] : [];
  // Guard: cap hashtags count + length to prevent DB abuse.
  const rawHashtags = Array.isArray(body.hashtags) ? (body.hashtags as unknown[]) : [];
  const hashtags = rawHashtags
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.trim().slice(0, 50))
    .filter((h) => h.length > 0)
    .slice(0, 30);
  // Optional per-listing selling location (store location stays separate).
  const listingLat = Number.isFinite(Number(body.listingLat)) && body.listingLat !== null && body.listingLat !== "" ? Number(body.listingLat) : null;
  const listingLng = Number.isFinite(Number(body.listingLng)) && body.listingLng !== null && body.listingLng !== "" ? Number(body.listingLng) : null;
  const listingLocation = body.listingLocation ? String(body.listingLocation).slice(0, 240) : null;

  // --- Validation: money + images (prevents -price, 1e9 price, 1000 images) ---
  if (!Number.isFinite(price) || price <= 0 || price > 10000000) {
    return NextResponse.json({ error: "Price must be between 1 and 10,000,000" }, { status: 400 });
  }
  // Industry standard: images must be HOSTED http(s) URLs. file:/content:/data:
  // device URIs are rejected — the client uploads via /api/app/upload first.
  const mediaCheck = validateMediaRefs(images, { min: 1, max: 10, field: "image" });
  if (!mediaCheck.ok) {
    return NextResponse.json({ error: mediaCheck.error }, { status: 400 });
  }
  const hostedImages = mediaCheck.urls;
  const titleStr = String(body.title ?? body.description ?? "New listing").slice(0, 200).trim();
  if (titleStr.length < 3) {
    return NextResponse.json({ error: "Title too short" }, { status: 400 });
  }
  // Guard: cap description length to prevent DB abuse / DoS.
  const description = String(body.description ?? "").slice(0, 5000);
  const categoryStr = String(body.category ?? "").trim().slice(0, 60);
  const variants = Array.isArray((body as unknown as { variants?: unknown }).variants) ? ((body as unknown as { variants: unknown[] }).variants.slice(0, 20) as never) : null;
  const rawSubs = (body as unknown as { subCategories?: unknown }).subCategories;
  const subCategories = Array.isArray(rawSubs) ? rawSubs.map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 20) as never : null;
  const stockLeftRaw = (body as unknown as { stockLeft?: unknown }).stockLeft;
  // Single-stock invariant: tracked variant stock and base stockLeft must
  // never coexist (placement settles on exactly one leg; two truths split
  // inventory and the gates disagree). Variant-tracked listings carry
  // stockLeft null — per-value stock is the only truth.
  const trackedVariants = Array.isArray(variants) && (variants as Array<{ values?: Array<{ stock?: unknown }> }>).some((g) =>
    Array.isArray(g?.values) && g.values.some((v) => typeof v?.stock === "number")
  );
  const stockLeft = trackedVariants
    ? null
    : typeof stockLeftRaw === "number" && Number.isFinite(stockLeftRaw) && stockLeftRaw >= 0 && stockLeftRaw <= 100000 ? Math.floor(stockLeftRaw) : null;
  const negotiable = typeof (body as unknown as { negotiable?: unknown }).negotiable === "boolean" ? (body as unknown as { negotiable: boolean }).negotiable : null;
  const rawMode = (body as unknown as { deliveryMode?: unknown }).deliveryMode;
  const deliveryMode = rawMode === "pickup" || rawMode === "shipping" || rawMode === "local" ? String(rawMode) : null;
  const feeRaw = (body as unknown as { shippingFee?: unknown }).shippingFee;
  const shippingFee = typeof feeRaw === "number" && Number.isFinite(feeRaw) && feeRaw >= 0 && feeRaw <= 100000 ? Math.floor(feeRaw) : null;

  const allowedTypes = new Set(["product", "service", "food_item"]);
  const reqType = String(body.type ?? "product");
  if (!allowedTypes.has(reqType)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  const post = await prisma.post.create({
    data: {
      title: titleStr,
      authorName: user.businessName || user.name,
      authorUsername: user.username!,
      sellerLocation: user.location ?? "",
      verified: user.verification === "approved",
      price,
      mrp,
      description,
      category: categoryStr,
      type: reqType,
      hashtags: hashtags as never,
      images: hostedImages as never,
      likes: 0,
      comments: 0,
      status: "published",
      isSold: false,
      featured: false,
      condition: body.condition ? String(body.condition) : null,
      brand: body.brand ? String(body.brand) : null,
      variants: variants as never,
      subCategories: subCategories as never,
      stockLeft,
      negotiable,
      deliveryMode,
      shippingFee,
      listingLat,
      listingLng,
      listingLocation,
    },
  });

  // Mirror into the admin Product table so listings are moderable
  // (products page shows real marketplace inventory, not a separate seed).
  await prisma.product.create({
    data: {
      id: `lst_${post.id}`,
      title: post.title,
      images: hostedImages as never,
      price: post.price ?? 0,
      category: post.category ?? "",
      sellerName: `${post.authorName}${post.authorUsername ? ` (@${post.authorUsername})` : ""}`,
      status: "active",
      reports: 0,
      createdAt: post.createdAt,
    },
  }).catch(() => {});

  return NextResponse.json({ post: toAppPost(post) }, { status: 201 });
}