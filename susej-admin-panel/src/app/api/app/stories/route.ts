import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { validateMediaRefs } from "@/lib/media";

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // IG-style 24h story lifetime
const MIN_DURATION = 3000;
const MAX_DURATION = 60000;

function clampDuration(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw ?? NaN);
  if (!Number.isFinite(n)) return 5000;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(n)));
}

export interface StoryOverlayInput {
  text: string;
  zone: "top" | "middle" | "bottom";
}

export interface StoryProductRefInput {
  id: string;
  title: string;
  image?: string;
  price?: number;
}

const ZONES = new Set(["top", "middle", "bottom"]);

/** Validate author-supplied text overlays: max 3, each <=80 chars, zone enum. */
function parseOverlays(raw: unknown): StoryOverlayInput[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: StoryOverlayInput[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim().slice(0, 80) : "";
    const zone = typeof rec.zone === "string" && ZONES.has(rec.zone) ? (rec.zone as StoryOverlayInput["zone"]) : "";
    if (!text || !zone) continue;
    out.push({ text, zone: zone as StoryOverlayInput["zone"] });
  }
  return out.length ? out : null;
}

/** Validate the attached product: must be one of the AUTHOR'S OWN listings
 *  (Post row owned by this username). Keeps stories honest - no tagging
 *  other sellers' products. */
async function parseProductRef(
  prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>,
  raw: unknown,
  username: string
): Promise<StoryProductRefInput | null> {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  if (!id) return null;
  const post = await prisma.post.findFirst({
    where: { id, authorUsername: username },
    select: { id: true, title: true, images: true, price: true },
  });
  if (!post) return null; // not yours -> silently drop instead of erroring
  const imageArr = Array.isArray(post.images) ? post.images.filter((i): i is string => typeof i === "string") : [];
  return {
    id: post.id,
    title: String(post.title || "").slice(0, 120),
    image: imageArr[0],
    price: typeof post.price === "number" ? post.price : Number(post.price) || undefined,
  };
}

/** GET /api/app/stories — all active (non-expired) stories, newest first.
 *  Lazily flips expired rows to status:"expired" so the admin Stories page
 *  KPIs reflect reality without a separate cron. */
export async function GET(req: NextRequest) {
  void req;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const now = new Date();
  await prisma.story.updateMany({
    where: { expiresAt: { lt: now }, status: "active" },
    data: { status: "expired" },
  });

  const rows = await prisma.story.findMany({
    where: { status: "active", expiresAt: { gt: now }, image: { not: "" } },
    orderBy: { createdAt: "desc" },
    // Industry cap: latest 100 active stories (24h TTL already bounds rows).
    take: 100,
  });

  return NextResponse.json({
    stories: rows.map((s) => ({
      id: s.id,
      username: s.username,
      creatorName: s.creatorName || s.username,
      image: s.image,
      caption: s.caption ?? "",
      durationMs: s.durationMs,
      overlays: s.overlays ?? null,
      productRef: s.productRef ?? null,
      views: s.views,
      createdAt: s.createdAt.getTime(),
      expiresAt: s.expiresAt.getTime(),
    })),
  });
}

/** POST /api/app/stories — post YOUR story (auth required, real image required).
 *  Body: { image: string (uri), caption?: string, durationMs?: number }
 *  Lifetime is fixed at 24h; display duration is user-chosen (3-60s). */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  // Per-user rate cap: 20 stories/day. Without this a script could flood the
  // tray + storage with unlimited rows (no other gate exists here).
  try {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = await prisma.story.count({
      where: { username: auth.user.username!, createdAt: { gte: dayStart } },
    });
    if (today >= 20) {
      return NextResponse.json({ error: "Daily story limit reached (20/day)" }, { status: 429 });
    }
  } catch {}

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Industry standard: store HOSTED urls only. A local device URI (file:/
  // content:/data:) is unviewable for every other user — clients must upload
  // via /api/app/upload first and send the returned /uploads/... reference.
  const rawImage = typeof body.image === "string" ? body.image.trim() : "";
  const mediaCheck = validateMediaRefs(rawImage ? [rawImage] : [], { min: 1, max: 1, field: "image" });
  if (!mediaCheck.ok) return NextResponse.json({ error: mediaCheck.error }, { status: 400 });
  const image = mediaCheck.urls[0];
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 300) : "";
  const durationMs = clampDuration(body.durationMs);
  const { user } = auth;
  const overlays = parseOverlays(body.overlays);
  const productRef = await parseProductRef(prisma, body.productRef, user.username!);

  const story = await prisma.story.create({
    data: {
      username: user.username!,
      creatorName: user.businessName || user.name,
      image,
      caption: caption || null,
      durationMs,
      // Prisma 7 Json input needs a cast for plain interfaces (repo pattern
      // from the posts route: `as never` satisfies JsonValue).
      overlays: (overlays ?? undefined) as never,
      productRef: (productRef ?? undefined) as never,
      views: 0,
      status: "active",
      expiresAt: new Date(Date.now() + MAX_AGE_MS),
    },
  });

  return NextResponse.json(
    {
      story: {
        id: story.id,
        username: story.username,
        creatorName: story.creatorName || story.username,
        image: story.image,
        caption: story.caption ?? "",
        durationMs: story.durationMs,
        overlays: story.overlays ?? null,
        productRef: story.productRef ?? null,
        views: story.views,
        createdAt: story.createdAt.getTime(),
        expiresAt: story.expiresAt.getTime(),
      },
    },
    { status: 201 }
  );
}
