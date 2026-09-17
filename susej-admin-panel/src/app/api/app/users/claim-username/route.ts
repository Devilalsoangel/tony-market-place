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

/** Control-flow signal: account has activity, handle is frozen (→ 403). */
class UsernameFrozen extends Error {
  constructor() {
    super("__username_frozen");
  }
}

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
  // support tickets, legacy products) — renaming with ANY such row orphans
  // history. Zero-activity auto-handle accounts (the normal onboarding case)
  // pass freely. The birth-minted Welcome bonus is SYSTEM money, not activity
  // (counting it 403d every fresh account — onboarding handle choice was dead).
  // Check + rename run in ONE locked tx: activity landing between a check and
  // a later update would orphan (TOCTOU).
  const me = auth.user.username!;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM "User" WHERE id = $1 FOR UPDATE`, auth.user.id);
      const footprint = await Promise.all([
        tx.post.count({ where: { authorUsername: me } }),
        tx.order.count({ where: { buyerUsername: me } }),
        tx.order.count({ where: { sellerUsername: me } }),
        tx.follow.count({ where: { follower: me } }),
        tx.follow.count({ where: { followed: me } }),
        tx.chatThread.count({ where: { OR: [{ participantA: me }, { participantB: me }] } }),
        tx.chatMessage.count({ where: { OR: [{ sender: me }, { receiver: me }] } }),
        tx.walletTransaction.count({ where: { username: me, title: { not: "Welcome bonus" } } }),
        tx.postLike.count({ where: { username: me } }),
        tx.postComment.count({ where: { OR: [{ username: me }, { author: me }] } }),
        tx.withdrawal.count({ where: { userName: me } }),
        tx.story.count({ where: { username: me } }),
        tx.reel.count({ where: { creatorUsername: me } }),
        tx.liveStream.count({ where: { hostUsername: me } }),
        tx.auction.count({ where: { sellerUsername: me } }),
        tx.auctionBid.count({ where: { bidder: me } }),
        tx.communityMessage.count({ where: { OR: [{ authorUsername: me }, { author: me }] } }),
        tx.message.count({ where: { sender: me } }),
        tx.userNotification.count({ where: { username: me } }),
        tx.supportTicket.count({ where: { userName: me } }),
        tx.product.count({ where: { sellerName: me } }),
      ]);
      if (footprint.some((n) => n > 0)) {
        throw new UsernameFrozen();
      }
      return tx.user.update({
        where: { id: auth.user.id },
        data: { username: handle },
      });
    });
    return NextResponse.json({ user: toAppUser(updated) });
  } catch (e: unknown) {
    if (e instanceof UsernameFrozen) {
      return NextResponse.json(
        { error: "Username can't be changed after account activity. Contact support for assistance." },
        { status: 403 }
      );
    }
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    throw e;
  }
}
