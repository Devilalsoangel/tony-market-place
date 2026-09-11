import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  // Optional auth: if the caller is signed in, compute `joined` from memberList
  let myUsername: string | null = null;
  try {
    const auth = await getAppUser(req);
    myUsername = auth?.user?.username ?? null;
  } catch {}
  const rows = await prisma.community.findMany({ orderBy: { createdAt: "asc" }, take: 100 });
  // Resolve member handles to real profiles so member lists show actual
  // people (never fabricated rosters). Unresolvable handles are skipped.
  const wanted = new Map<string, string[]>();
  for (const c of rows) {
    const raw: unknown = (c as { memberList?: unknown }).memberList;
    const handles = (Array.isArray(raw) ? raw : [])
      .map((m) => (typeof m === "string" ? m : m && typeof m === "object" ? String((m as { username?: unknown }).username ?? "") : ""))
      .map((h) => h.trim())
      .filter(Boolean)
      .slice(0, 50);
    wanted.set(c.id, handles);
  }
  const allHandles = [...new Set([...wanted.values()].flat())];
  const profiles = new Map<string, { username: string; name: string; avatar: string | null; verified: boolean }>();
  if (allHandles.length) {
    const users = await prisma.user.findMany({
      where: { username: { in: allHandles } },
      select: { username: true, name: true, businessName: true, avatar: true, verification: true },
    });
    for (const u of users) {
      if (u.username) profiles.set(u.username, { username: u.username, name: u.businessName || u.name, avatar: u.avatar, verified: u.verification === "approved" });
    }
  }
  return NextResponse.json({
    communities: rows.map((c) => {
      const handles = wanted.get(c.id) ?? [];
      let joined = false;
      if (myUsername) joined = handles.includes(myUsername);
      return {
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        category: c.type === "public" ? "Public" : "Private",
        memberCount: c.members,
        joined,
        type: c.type,
        ownerName: c.ownerName,
        memberProfiles: handles
          .map((h) => profiles.get(h))
          .filter((p): p is { username: string; name: string; avatar: string | null; verified: boolean } => !!p),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { communityId?: string; text?: string; name?: string; description?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Community creation (no communityId, but a name): previously the app only
  // persisted creations to device storage — invisible to everyone else. Now a
  // real shared row with the creator as owner + first member.
  if (!body.communityId && typeof body.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (name.length < 3) return NextResponse.json({ error: "Community name too short" }, { status: 400 });
    const description = String(body.description ?? "").trim().slice(0, 500);
    const type = body.type === "private" || body.type === "Private" ? "private" : "public";
    const username = auth.user.username!;
    const created = await prisma.community.create({
      data: {
        name,
        description,
        ownerName: auth.user.name,
        members: 1,
        posts: 0,
        type,
        status: "active",
        reports: 0,
        postingLocked: false,
        commentsDisabled: false,
        createdAt: new Date(),
        memberList: [username],
        postList: [],
        commentList: [],
        reportedList: [],
      } as never,
    });
    return NextResponse.json(
      {
        community: {
          id: created.id,
          name: created.name,
          description: created.description ?? "",
          category: created.type === "public" ? "Public" : "Private",
          memberCount: 1,
          joined: true,
          type: created.type,
        },
      },
      { status: 201 }
    );
  }
  const text = String(body.text ?? "").trim();
  if (!body.communityId || !text) {
    return NextResponse.json({ error: "communityId and text required" }, { status: 400 });
  }
  // Guard: cap message length to prevent DB abuse / DoS.
  if (text.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }
  const community = await prisma.community.findUnique({ where: { id: body.communityId } });
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  // Private communities: only members may post.
  if (community.type === "private" || community.type === "Private") {
    const rawList: unknown = (community as unknown as { memberList?: unknown }).memberList;
    const list: unknown[] = Array.isArray(rawList) ? rawList : [];
    const isMember = list.some((m) => {
      if (typeof m === "string") return m === auth.user.username;
      if (m && typeof m === "object") return (m as { username?: string }).username === auth.user.username;
      return false;
    });
    if (!isMember) {
      return NextResponse.json({ error: "Join this private community before posting" }, { status: 403 });
    }
  }

  const message = await prisma.communityMessage.create({
    data: {
      communityId: community.id,
      author: auth.user.name,
      authorUsername: auth.user.username!,
      text,
    },
  });
  return NextResponse.json(
    { message: { id: message.id, author: message.author, authorUsername: message.authorUsername, text: message.text, createdAt: message.createdAt.getTime() } },
    { status: 201 }
  );
}