import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  let body: { joined?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const joined = !!body.joined;
  const username = auth.user.username!;
  const updated = await prisma.$transaction(async (tx) => {
    const community = await tx.community.findUnique({ where: { id } });
    if (!community) return null;
    const rawList: unknown = (community as unknown as { memberList?: unknown }).memberList;
    const list: unknown[] = Array.isArray(rawList) ? rawList : [];
    const isMember = list.some((m) => {
      if (typeof m === "string") return m === username;
      if (m && typeof m === "object") return (m as { username?: string }).username === username;
      return false;
    });
    if (joined === isMember) {
      return { ok: true, joined: isMember, memberCount: community.members, noChange: true as const };
    }
    let nextList: unknown[];
    let nextMembers: number;
    if (joined) {
      nextList = [...list, { username, joinedAt: new Date().toISOString() }];
      nextMembers = community.members + 1;
    } else {
      nextList = list.filter((m) => {
        if (typeof m === "string") return m !== username;
        if (m && typeof m === "object") return (m as { username?: string }).username !== username;
        return true;
      });
      nextMembers = Math.max(0, community.members - 1);
    }
    await tx.community.update({
      where: { id },
      data: { members: nextMembers, memberList: nextList as never },
    });
    return { ok: true, joined, memberCount: nextMembers, noChange: false as const };
  });
  if (!updated) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  return NextResponse.json({ ok: true, joined: updated.joined, memberCount: updated.memberCount });
}
