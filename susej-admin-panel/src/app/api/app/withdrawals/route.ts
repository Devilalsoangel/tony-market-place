import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/**
 * GET /api/app/withdrawals — the caller's OWN payout requests plus the desk's
 * verdicts (requested -> approved/rejected -> completed).
 *
 * Closes the mirror gap: the app used to submit a withdrawal and never learn
 * the outcome, because the app role has no read access to /api/data. This
 * endpoint is the read-your-own-records surface; ownership is enforced by
 * matching rows to the Bearer user's identity (the same one the app mirrors
 * on create), so a seller can only ever receive their own payouts.
 */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = String(auth.user.username ?? "").trim();
  const displayName = String(auth.user.name ?? "").trim();
  if (!username) return NextResponse.json({ withdrawals: [] });

  // Exact unique-username match: display-name matching leaked payouts across
  // same-name accounts. Legacy rows keyed by display name heal below, but
  // ONLY when the name is provably unique to this caller.
  const rows = await prisma.withdrawal.findMany({
    where: { userName: username },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  if (displayName && displayName !== username) {
    try {
      const sameName = await prisma.user.count({ where: { name: displayName } });
      if (sameName <= 1) {
        const legacy = await prisma.withdrawal.findMany({
          where: { userName: displayName },
          orderBy: { requestedAt: "desc" },
          take: 100,
        });
        if (legacy.length) {
          // One-time self-heal: re-key provably-mine rows to the username.
          await prisma.withdrawal.updateMany({
            where: { userName: displayName },
            data: { userName: username },
          });
          for (const w of legacy) rows.push({ ...w, userName: username });
          rows.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
        }
      }
    } catch {}
  }

  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id,
      amount: w.amount,
      status: w.status,
      requestedAt: w.requestedAt.toISOString(),
      respondedAt: w.respondedAt ? w.respondedAt.toISOString() : null,
    })),
  });
}
