import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

/**
 * POST /api/admin/migrate-indexes — ONE-SHOT money-guard index migration.
 *
 * Runs a fixed allow-list of CREATE INDEX IF NOT EXISTS statements (no
 * arbitrary SQL — the request body carries no statements at all) and reports
 * per-statement results. Exists because direct DB access from ops machines is
 * blocked while the Vercel runtime reaches Neon fine.
 *
 * Auth: super_admin session only. Everything else (incl. no cookie) → 404,
 * so the route is undiscoverable to anyone without the panel's top role.
 * Every invocation is audit-logged. DELETE THIS ROUTE once the indexes land
 * (it must not become permanent surface).
 */
const MIGRATION_STATEMENTS: Array<{ key: string; sql: string }> = [
  { key: "Dispute.orderId", sql: `CREATE INDEX IF NOT EXISTS "Dispute_orderId_idx" ON "Dispute"("orderId")` },
  { key: "Dispute.status", sql: `CREATE INDEX IF NOT EXISTS "Dispute_status_idx" ON "Dispute"("status")` },
  { key: "Refund.orderRef", sql: `CREATE INDEX IF NOT EXISTS "Refund_orderRef_idx" ON "Refund"("orderRef")` },
  { key: "Refund.status", sql: `CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status")` },
  { key: "Withdrawal.userName", sql: `CREATE INDEX IF NOT EXISTS "Withdrawal_userName_idx" ON "Withdrawal"("userName")` },
  { key: "Withdrawal.status", sql: `CREATE INDEX IF NOT EXISTS "Withdrawal_status_idx" ON "Withdrawal"("status")` },
  { key: "LedgerEntry.orderId", sql: `CREATE INDEX IF NOT EXISTS "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId")` },
  {
    key: "LedgerEntry.orderId+type+status",
    sql: `CREATE INDEX IF NOT EXISTS "LedgerEntry_orderId_type_status_idx" ON "LedgerEntry"("orderId", "type", "status")`,
  },
  { key: "AppSession.userId", sql: `CREATE INDEX IF NOT EXISTS "AppSession_userId_idx" ON "AppSession"("userId")` },
  { key: "AppSession.expiresAt", sql: `CREATE INDEX IF NOT EXISTS "AppSession_expiresAt_idx" ON "AppSession"("expiresAt")` },
];

function isSuperAdmin(req: NextRequest): { ok: true; name: string } | { ok: false } {
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return { ok: false };
  const r = String((session as { role?: unknown }).role ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (r !== "super_admin" && r !== "superadmin" && r !== "owner") return { ok: false };
  return { ok: true, name: String((session as { name?: unknown }).name ?? "super_admin") };
}

export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req).ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ route: "migrate-indexes", statements: MIGRATION_STATEMENTS.length, method: "POST" });
}

export async function POST(req: NextRequest) {
  const auth = isSuperAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const applied: Array<{ key: string; ok: boolean; error?: string }> = [];
  for (const stmt of MIGRATION_STATEMENTS) {
    try {
      await (prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> }).$executeRawUnsafe(stmt.sql);
      applied.push({ key: stmt.key, ok: true });
    } catch (e) {
      applied.push({ key: stmt.key, ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) });
    }
  }
  const failed = applied.filter((a) => !a.ok);
  try {
    await writeAudit({
      action: "admin.migrate-indexes",
      entity: "system",
      entityId: "money-guard-indexes",
      details: `applied ${applied.length - failed.length}/${applied.length}` + (failed.length ? `; failed: ${failed.map((f) => f.key).join(",")}` : ""),
      adminName: auth.name,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "migration",
    });
  } catch {}
  return NextResponse.json({ ok: failed.length === 0, applied }, { status: failed.length === 0 ? 200 : 500 });
}
