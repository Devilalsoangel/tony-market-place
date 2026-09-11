import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/** PATCH /api/app/live/[id] — end YOUR stream (host only).
 *  Body: not required; the action is "end stream". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const stream = await prisma.liveStream.findUnique({ where: { id } });
  if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  if (stream.hostUsername !== auth.user.username) {
    return NextResponse.json({ error: "Only the host can end this stream" }, { status: 403 });
  }
  if (stream.status !== "live") {
    return NextResponse.json({ ok: true, status: stream.status });
  }

  const updated = await prisma.liveStream.update({
    where: { id },
    data: { status: "ended", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
