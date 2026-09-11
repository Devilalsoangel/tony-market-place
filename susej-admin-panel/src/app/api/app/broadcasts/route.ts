import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// Public broadcast directory: scheduled + live channels first, ended kept for
// history. The app keeps its own local join prefs + per-channel posts.
export async function GET() {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await prisma.broadcast.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 50,
  });
  const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
  rows.sort((a, b) => rank(a.status) - rank(b.status));
  return NextResponse.json({
    broadcasts: rows.map((c) => ({
      id: c.id,
      name: c.title,
      tagline: `by ${c.hostName}${c.status === "live" ? ` · ${c.listeners} listening` : ""}`,
      hostName: c.hostName,
      listeners: c.listeners,
      status: c.status,
      scheduledAt: c.scheduledAt.getTime(),
    })),
  });
}
