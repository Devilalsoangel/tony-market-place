import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { normalizeHandle } from "../claim-username/route";

/**
 * GET /api/app/users/check-username?u=<handle>
 * Live availability probe for the signup username field (debounced client).
 * Authed (signup sessions carry a token). Never reveals WHO owns a handle —
 * just format-ok + taken boolean, same as Instagram's signup check.
 */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const raw = req.nextUrl.searchParams.get("u") ?? "";
  const handle = normalizeHandle(raw);
  if (!handle) {
    return NextResponse.json({ available: false, reason: "format" });
  }
  if (handle === (auth.user.username ?? "").toLowerCase()) {
    return NextResponse.json({ available: true, mine: true });
  }
  const taken = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: "insensitive" } },
    select: { id: true },
  });
  return NextResponse.json(taken ? { available: false, reason: "taken" } : { available: true });
}
