import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser, toAppUser } from "@/lib/app-auth";

// Username rules (Instagram pattern): 3-20 chars, lowercase letters,
// digits, dots, underscores. Case-insensitive uniqueness — 'Aarav' and
// 'aarav' are the same handle, first claimant wins.
const HANDLE_RE = /^[a-z0-9._]{3,20}$/;
const RESERVED = new Set([
  "admin", "administrator", "susej", "support", "help", "api", "null",
  "undefined", "system", "official", "verify", "verified", "staff",
]);

export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().toLowerCase();
  if (!HANDLE_RE.test(h)) return null;
  if (h.startsWith(".") || h.startsWith("_") || h.endsWith(".") || h.endsWith("_")) return null;
  if (h.includes("..") || h.includes("__")) return null;
  if (RESERVED.has(h)) return null;
  return h;
}

/**
 * POST /api/app/users/claim-username { username }
 * One-time handle claim during profile setup. Allowed ONLY while the account
 * has no marketplace activity (no posts, no orders as buyer or seller) so no
 * historical row ever orphans — after that the handle is permanent, which is
 * why PATCH /users/me refuses username changes.
 * 200 { user } | 400 bad format | 403 account already active | 409 taken.
 */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const handle = normalizeHandle(body.username);
  if (!handle) {
    return NextResponse.json(
      { error: "Usernames are 3-20 characters: lowercase letters, numbers, dots and underscores." },
      { status: 400 }
    );
  }
  if (handle === (auth.user.username ?? "").toLowerCase()) {
    return NextResponse.json({ user: toAppUser(auth.user) });
  }

  const taken = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  // Fresh accounts only: username keys every user-owned table (posts, orders
  // both sides, follows both directions, chat threads/messages, wallet legs,
  // likes, comments (author + username), withdrawals, stories, reels, live,
  // auctions + bids, community messages, ticket messages, notifications,
  // support tickets) — renaming with ANY such row orphans history.
  // Zero-activity auto-handle accounts (the normal onboarding case) pass freely.
  const me = auth.user.username!;
  const footprint = await Promise.all([
    prisma.post.count({ where: { authorUsername: me } }),
    prisma.order.count({ where: { buyerUsername: me } }),
    prisma.order.count({ where: { sellerUsername: me } }),
    prisma.follow.count({ where: { follower: me } }),
    prisma.follow.count({ where: { followed: me } }),
    prisma.chatThread.count({ where: { OR: [{ participantA: me }, { participantB: me }] } }),
    prisma.chatMessage.count({ where: { OR: [{ sender: me }, { receiver: me }] } }),
    prisma.walletTransaction.count({ where: { username: me } }),
    prisma.postLike.count({ where: { username: me } }),
    prisma.postComment.count({ where: { OR: [{ username: me }, { author: me }] } }),
    prisma.withdrawal.count({ where: { userName: me } }),
    prisma.story.count({ where: { username: me } }),
    prisma.reel.count({ where: { creatorUsername: me } }),
    prisma.liveStream.count({ where: { hostUsername: me } }),
    prisma.auction.count({ where: { sellerUsername: me } }),
    prisma.auctionBid.count({ where: { bidder: me } }),
    prisma.communityMessage.count({ where: { OR: [{ authorUsername: me }, { author: me }] } }),
    prisma.message.count({ where: { sender: me } }),
    prisma.userNotification.count({ where: { username: me } }),
    prisma.supportTicket.count({ where: { userName: me } }),
  ]);
  if (footprint.some((n) => n > 0)) {
    return NextResponse.json(
      { error: "Username can't be changed after account activity. Contact support for assistance." },
      { status: 403 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: { username: handle },
    });
    return NextResponse.json({ user: toAppUser(updated) });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    throw e;
  }
}
