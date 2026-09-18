import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { validateMediaRefs } from "@/lib/media";

/**
 * Variant shape gate (POST + PATCH share it): at most 20 groups, 50 values
 * each; names/labels clipped; priceDelta within ±10M (a negative delta
 * undercharges every order and distorts fee legs); stock integer 0..100000.
 * Returns 400-grade errors, never silent clips of money fields.
 */
export function sanitizeVariants(raw: unknown): { ok: true; variants: null | unknown } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, variants: null };
  if (!Array.isArray(raw)) return { ok: false, error: "Invalid variants" };
  if (raw.length > 20) return { ok: false, error: "Too many variant groups (max 20)" };
  const out: Array<{ name: string; values: Array<{ label: string; priceDelta?: number; stock?: number }> }> = [];
  for (const g of raw as Array<{ name?: unknown; values?: unknown }>) {
    const name = String(g?.name ?? "").trim().slice(0, 60);
    if (!name) return { ok: false, error: "Variant group needs a name" };
    if (!Array.isArray(g?.values) || (g.values as unknown[]).length === 0) {
      return { ok: false, error: `Variant "${name}" needs at least one value` };
    }
    if ((g.values as unknown[]).length > 50) return { ok: false, error: `Too many values in "${name}" (max 50)` };
    const values: Array<{ label: string; priceDelta?: number; stock?: number }> = [];
    for (const v of g.values as Array<{ label?: unknown; priceDelta?: unknown; stock?: unknown }>) {
      const label = String(v?.label ?? "").trim().slice(0, 60);
      if (!label) return { ok: false, error: `Variant "${name}" has an empty value` };
      const row: { label: string; priceDelta?: number; stock?: number } = { label };
      if (v?.priceDelta !== undefined) {
        const d = Number(v.priceDelta);
        if (!Number.isFinite(d) || Math.abs(d) > 10000000) return { ok: false, error: `Bad price adjustment in "${name}"` };
        row.priceDelta = Math.round(d);
      }
      if (v?.stock !== undefined) {
        const s = Number(v.stock);
        if (!Number.isFinite(s) || s < 0 || s > 100000) return { ok: false, error: `Bad stock in "${name}"` };
        row.stock = Math.floor(s);
      }
      values.push(row);
    }
    out.push({ name, values });
  }
  return { ok: true, variants: out as never };
}

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

  // Extracted (shared by the page query + hashtag-suppression backfill below).
  const baseWhere: any = {
    status: "published",
    ...(seller ? { authorUsername: seller } : {}),
    ...(cat ? { category: { equals: cat, mode: "insensitive" } } : {}),
    ...(q
      ? {
          // Marketplace-wide coverage (was title/desc only): category,
          // seller identity, and hashtag terms must hit cross-device, or
          // sellers/tags/categories are unfindable from a fresh install.
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { authorName: { contains: q, mode: "insensitive" } },
            { authorUsername: { contains: q, mode: "insensitive" } },
            { hashtags: { array_contains: q } },
          ],
        }
      : {}),
  };
  const posts = await prisma.post.findMany({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Desk-wired hashtag moderation: tags the moderators Block actually
  // suppress content. hashtags is Json (no scalar-list filter), so the
  // exclusion runs here over the window — WITH backfill (up to 4 pages):
  // filtering without it silently shrank pages whenever blocked rows sat in
  // the window.
  const PAGE = 100;
  let blockedSet = new Set<string>();
  try {
    const blocked = await prisma.hashtag.findMany({ where: { status: "blocked" }, select: { tag: true } });
    blockedSet = new Set(
      (blocked as Array<{ tag?: unknown }>).map((h) => String(h.tag ?? "").replace(/^#+/, "").trim().toLowerCase()).filter(Boolean)
    );
  } catch (e) {
    // Fail-OPEN by design (availability beats moderation on a read blip —
    // fail-closed would blank paid rails + feed on a transient), but LOUD:
    // a silent empty set would serve blocked-tag rows indefinitely.
    console.error("[posts] blocked-hashtag read failed — serving unfiltered:", e instanceof Error ? e.message : e);
  }
  const isBlockedPost = (p: { hashtags?: unknown }) => {
    const tags = Array.isArray(p.hashtags)
      ? (p.hashtags as unknown[]).map((h) => String(h ?? "").replace(/^#+/, "").trim().toLowerCase())
      : [];
    return tags.some((t) => blockedSet.has(t));
  };
  let visible: typeof posts = [];
  if (!blockedSet.size) {
    visible = posts;
  } else {
    // Id-dedupe across backfill pages: concurrent inserts shift the
    // skip-window and the same row can arrive twice (duplicate feed cards).
    const seen = new Set(posts.map((p) => p.id));
    visible = posts.filter((p) => !isBlockedPost(p));
    let skip = PAGE;
    for (let page = 0; page < 3 && visible.length < PAGE; page++) {
      const more = await prisma.post.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        take: PAGE,
        skip,
      });
      if (!more.length) break;
      skip += PAGE;
      for (const p of more) {
        if (visible.length >= PAGE) break;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (!isBlockedPost(p)) visible.push(p);
      }
    }
  }

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
  const authorUsernames = Array.from(new Set(visible.map((p) => p.authorUsername).filter(Boolean))) as string[];
  if (authorUsernames.length) {
    const authors = await prisma.user.findMany({
      where: { username: { in: authorUsernames } },
      select: { username: true, name: true, businessName: true },
    });
    authors.forEach((a) => {
      if (a.username) authorNames.set(a.username, a.businessName || a.name);
    });
  }

  return NextResponse.json({ posts: visible.map((p) => toAppPost({ ...p, likedByMe: likedSet.has(p.id) }, authorNames.get(p.authorUsername ?? ""))) });
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
  // Guard: cap hashtags count + length to prevent DB abuse. Normalized to
  // lowercase: hashtag search is case-insensitive (array_contains is
  // case-sensitive, so mixed-case storage would silently miss).
  const rawHashtags = Array.isArray(body.hashtags) ? (body.hashtags as unknown[]) : [];
  const hashtags = rawHashtags
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.trim().toLowerCase().slice(0, 50))
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
  // Variant shape validation (both lanes share it): raw JSON used to accept
  // negative/unbounded priceDelta (undercharge every order + distort fee
  // legs), unbounded labels/stock, and 1000-value groups. Clipped, not just
  // sliced — a negative delta must 400, not silently pass.
  const variantCheck = sanitizeVariants((body as unknown as { variants?: unknown }).variants);
  if (!variantCheck.ok) {
    return NextResponse.json({ error: variantCheck.error }, { status: 400 });
  }
  const variants = variantCheck.variants;
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
      // Zero-stock listings start sold (out-of-stock shelf state): the client
      // sends isSold with stockLeft 0, and a 0-stock Active row can never
      // sell (placement 400s). isSold is honored ONLY in that consistent
      // pair — never as a free flag.
      isSold: body.isSold === true && stockLeft === 0,
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