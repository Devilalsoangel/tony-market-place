import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser, toAppUser } from "@/lib/app-auth";

/**
 * PATCH /api/app/users/me — persist profile edits from the app.
 * Mirrors AuthContext.updateUser so name/username/avatar/location/bio/
 * interests and seller fields stay in sync across every device + admin.
 */
export async function PATCH(req: NextRequest) {
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

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (typeof body.bio === "string") data.bio = body.bio.slice(0, 300);
  if (typeof body.location === "string") data.location = body.location.slice(0, 120);
  if (typeof body.avatar === "string") {
    const av = body.avatar.trim();
    if (av.length > 2048) return NextResponse.json({ error: "Avatar URL too long" }, { status: 400 });
    if (av && !av.startsWith("http://") && !av.startsWith("https://") && !av.startsWith("data:image/")) {
      return NextResponse.json({ error: "Avatar must be http(s) or data:image" }, { status: 400 });
    }
    data.avatar = av.slice(0, 2048);
  }
  // Business identity edits void the KYC verdict that was granted on the OLD
  // identity: an approved seller could otherwise rebrand or category-hop with
  // the verified badge intact. Changing either resets verification to pending
  // and suspends seller powers until re-approved (Shopify re-review pattern).
  const prevBiz = typeof auth.user.businessName === "string" ? auth.user.businessName.trim() : "";
  const prevCat = typeof auth.user.category === "string" ? auth.user.category.trim() : "";
  let reverify = false;
  if (typeof body.businessName === "string") {
    const nextBiz = body.businessName.trim().slice(0, 120);
    data.businessName = nextBiz;
    if (nextBiz !== prevBiz) reverify = true;
  }
  if (typeof body.category === "string") {
    const nextCat = body.category.trim().slice(0, 60);
    data.category = nextCat;
    if (nextCat !== prevCat) reverify = true;
  }
  if (reverify && auth.user.verification === "approved") {
    data.verification = "pending";
    data.isSeller = false;
  }
  if (Array.isArray(body.interests)) data.interests = (body.interests as unknown[]).map((v) => String(v).slice(0, 60)).slice(0, 20);
  // verification / role / isSeller are NOT client-settable from this endpoint.
  // Seller onboarding is via POST /api/app/posts gate + POST /api/data/sellers application;
  // becoming a seller requires docs + admin KYC (see become-seller.tsx -> syncSellerApplicant).
  // Direct isSeller:true here would bypass KYC — industry standard (Shopify: gated).
  // username is also NOT client-settable: the data model references username
  // across 15+ tables (ChatThread, Follow, PostLike, PostComment, WalletTransaction,
  // ChatMessage, Order, Post, Story, CommunityMessage, AuctionBid, Withdrawal,
  // SupportTicket, Message, UserNotification). Changing it orphans all historical
  // data. The long-term fix is to migrate those tables to use userId (cuid) instead.
  // For now, username is immutable from the client.
  if (typeof body.username === "string" && body.username.trim()) {
    return NextResponse.json(
      { error: "Username cannot be changed. Contact support for assistance." },
      { status: 400 }
    );
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id: auth.user.id },
      data,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || (e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    // Legacy WIN1252 cluster (pre-UTF8 rebuild): non-Latin text and emoji
    // cannot persist yet. Name the cause plainly instead of a 500 — the
    // client shows this string verbatim.
    if (msg.includes("22P05") || msg.includes("no equivalent in encoding") || (e as { code?: string })?.code === "P2039") {
      return NextResponse.json(
        { error: "That text has characters we can't store yet — remove emojis and try again." },
        { status: 400 }
      );
    }
    throw e;
  }

  return NextResponse.json({ user: toAppUser(user) });
}

/** GET /api/app/users/me — resolved profile for the token holder. */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ user: toAppUser(auth.user) });
}
