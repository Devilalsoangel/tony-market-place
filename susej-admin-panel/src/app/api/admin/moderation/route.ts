import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getActiveAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

/**
 * POST /api/admin/moderation { reportId, action: warn|suspend|ban }
 *
 * Reported-user actions that USED to run as 2-3 unawaited client writes:
 * - Ban/Suspend resolved identity by scanning the loaded 100-row users
 *   window, so out-of-window targets were silently untouched while the report
 *   flipped to reviewed (account never banned, queue said done).
 * - Warn only flipped the report — zero user-visible effect anywhere.
 *
 * Server-side now: full-table email resolution (no window limit), account
 * patch, user-visible warning tell (app bell reads userNotification rows),
 * report flip, audit trail. Returns { accountTouched } so the desk can say
 * exactly what happened instead of assuming.
 */
export async function POST(request: NextRequest) {
  const admin = await getActiveAdmin(request).catch(() => null);
  const role = String(admin?.role ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
  const isManagerUp = ["super_admin", "superadmin", "owner", "manager", "admin"].includes(role);
  const isStaff = isManagerUp || ["moderator", "mod", "support"].includes(role);
  if (!admin || !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { reportId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reportId = String(body.reportId ?? "").trim();
  const action = String(body.action ?? "").trim().toLowerCase();
  if (!reportId || !["warn", "suspend", "ban"].includes(action)) {
    return NextResponse.json({ error: "reportId and action (warn|suspend|ban) are required" }, { status: 400 });
  }
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const report = await (prisma as any).reportedUser.findUnique({ where: { id: reportId } }).catch(() => null);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  // Account-level ban/suspend is a manager+ decision (least privilege): the
  // users desk + data lane both deny moderators/support, so this endpoint
  // must not be their side door. Warn (user-visible notice) stays
  // triage-level. Re-warn requires a pending report, enforced atomically
  // inside the warn tx (pre-tx check is the fast path only) — 10 concurrent
  // POSTs serialize on the report lock, losers 409. Ban/suspend stay
  // idempotent for safe retries.
  if ((action === "suspend" || action === "ban") && !isManagerUp) {
    return NextResponse.json({ error: "Ban/suspend needs a manager — moderators can warn or per-user block." }, { status: 403 });
  }
  if (action === "warn" && String(report.status ?? "") !== "pending") {
    return NextResponse.json({ error: "Report already reviewed — warnings fire once." }, { status: 409 });
  }

  // Atomic warn (report lock + bell write + flip in ONE tx): 10 concurrent
  // POSTs used to all read `pending` before any flip committed, minting N
  // warning bells for one report. The row lock serializes them — the losers
  // see `reviewed` and 409. Ban/suspend stay idempotent outside the tx (safe
  // retries by design).
  if (action === "warn") {
    try {
      const result = await (prisma as any).$transaction(async (tx: any) => {
        await tx.$queryRawUnsafe(`SELECT id FROM "ReportedUser" WHERE id = $1 FOR UPDATE`, reportId);
        const rep = await tx.reportedUser.findUnique({ where: { id: reportId } });
        if (!rep) throw new Error("NOT_FOUND");
        if (String(rep.status ?? "") !== "pending") throw new Error("ALREADY");
        const mail = String(rep.email ?? "").trim();
        let uname = "";
        if (mail) {
          const hit = await tx.user.findFirst({ where: { email: { equals: mail, mode: "insensitive" } } }).catch(() => null);
          if (hit) uname = String(hit.username ?? "");
        }
        if (uname) {
          await tx.userNotification.create({
            data: {
              username: uname,
              type: "warning",
              userName: "susej Safety",
              action: `You received a warning from the safety team (${String(rep.reason ?? "community guidelines").slice(0, 120)}). Further reports may restrict your account.`,
              targetId: reportId,
            },
          });
        }
        await tx.reportedUser.update({ where: { id: reportId }, data: { status: "reviewed" } });
        return { uname };
      });
      void writeAudit({
        action: "moderation.warn",
        entity: "reported-users",
        entityId: reportId,
        details: `warn on ${String(report.email ?? report.name)} — ${result.uname ? "delivered" : "no account, flipped"}`,
        adminName: admin.loginId,
      });
      if (!result.uname) {
        return NextResponse.json({ ok: true, accountTouched: false });
      }
      return NextResponse.json({ ok: true, accountTouched: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return NextResponse.json({ error: "Report not found" }, { status: 404 });
      if (msg === "ALREADY") return NextResponse.json({ error: "Report already reviewed — warnings fire once." }, { status: 409 });
      return NextResponse.json({ error: "Warning not delivered — report left pending, retry." }, { status: 503 });
    }
  }

  // Full-table identity resolution: exact email match, case-insensitive.
  // ReportedUser carries no userId FK, so this is the only join key.
  // Trimmed form: report emails with case/space variance used to miss the
  // User row (account exists, reported untouched).
  const email = String(report.email ?? "").trim().toLowerCase();
  let account: { id: string; username: string } | null = null;
  if (email) {
    const hit = await (prisma as any).user
      .findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
      .catch(() => null);
    if (hit) account = { id: String(hit.id), username: String(hit.username ?? "") };
  }

  // Report flips only on EFFECT (or when there is no account to effect):
  // flipping first stranded failed suspends/bans as reviewed with the account
  // untouched and no retry path. No account (unknown email): flip, nothing
  // exists to retry for. Account exists but untouched (DB failure): 503 with
  // the report still pending so the desk CAN retry (ban/suspend are
  // idempotent — safe).
  let accountTouched = false;
  {
    const status = action === "ban" ? "banned" : "suspended";
    if (account) {
      await (prisma as any).user.update({ where: { id: account.id }, data: { status } }).catch(() => null);
      const check = await (prisma as any).user.findUnique({ where: { id: account.id } }).catch(() => null);
      accountTouched = String(check?.status ?? "") === status;
      if (!accountTouched) {
        void writeAudit({
          action: `moderation.${action}.failed`,
          entity: "reported-users",
          entityId: reportId,
          details: `${action} on ${email} failed at the account write — report left pending for retry`,
          adminName: admin.loginId,
        });
        return NextResponse.json({ error: `Account ${action} failed — report left pending, retry.` }, { status: 503 });
      }
    }
  }
  await (prisma as any).reportedUser.update({ where: { id: reportId }, data: { status: "reviewed" } }).catch(() => null);

  void writeAudit({
    action: `moderation.${action}`,
    entity: "reported-users",
    entityId: reportId,
    details: `${action} on ${email || report.name} — account ${accountTouched ? "touched" : "NOT found/touched"}`,
    adminName: admin.loginId,
  });
  return NextResponse.json({ ok: true, accountTouched });
}
