import { getPrisma } from "@/lib/db";

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  adminName?: string;
  ip?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const prisma = await getPrisma();
    if (!prisma) return;
    // details is TEXT (unbounded) — never truncate the before/after diff the
    // route builds. Auditing stays non-blocking, but a failure is LOUD in the
    // server log instead of a silent compliance gap.
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity ?? "system",
        entityId: entry.entityId ?? "",
        details: entry.details ?? "",
        adminName: entry.adminName ?? "system",
        ip: entry.ip ?? "",
        timestamp: new Date(),
      },
    });
  } catch (e) {
    // Auditing must never block the request that triggered it.
    console.error("[audit] writeAudit failed — mutation succeeded without a trail:", e instanceof Error ? e.message : e);
  }
}