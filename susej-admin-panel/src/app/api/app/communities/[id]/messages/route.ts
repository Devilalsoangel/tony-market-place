import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

// Room history (FB Groups rule: every member sees every message, on every
// device). The app used to read community chat from device storage only, so
// member B never saw member A's messages. This endpoint is the shared truth:
// last 100 messages, oldest-first. Private rooms require membership.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;

  const community = await prisma.community.findUnique({ where: { id } });
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  if (community.type === "private" || community.type === "Private") {
    const rawList: unknown = (community as unknown as { memberList?: unknown }).memberList;
    const list: unknown[] = Array.isArray(rawList) ? rawList : [];
    const isMember = list.some((m) => {
      if (typeof m === "string") return m === auth.user.username;
      if (m && typeof m === "object") return (m as { username?: string }).username === auth.user.username;
      return false;
    });
    if (!isMember) {
      return NextResponse.json({ error: "Join this private community to read messages" }, { status: 403 });
    }
  }

  const rows = await prisma.communityMessage.findMany({
    where: { communityId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const messages = rows.reverse().map((m) => ({
    id: m.id,
    communityId: m.communityId,
    author: m.author,
    authorUsername: m.authorUsername,
    text: m.text,
    createdAt: m.createdAt.getTime(),
  }));
  return NextResponse.json({ messages });
}
