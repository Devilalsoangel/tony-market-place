import { getPrisma } from "@/lib/db";

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  adminName?: string;
  ip?: string;
}

/** Strip control characters (CR/LF) from audit free-text: raw loginIds and
 *  details land in this trail, and an embedded newline forges rows in CSV
 *  exports and log viewers (CRLF injection). One choke point for all writers. */
function scrubAuditText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 4000);
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const prisma = await getPrisma();
    if (!prisma) return;
    // details is TEXT (unbounded) — callers cap their own diffs; the 4000-char
    // bound here is injection hygiene, not truncation of real content.
    // Auditing stays non-blocking, but a failure is LOUD in the
    // server log instead of a silent compliance gap.
    await prisma.auditLog.create({
      data: {
        action: scrubAuditText(entry.action),
        entity: scrubAuditText(entry.entity ?? "system"),
        entityId: scrubAuditText(entry.entityId ?? ""),
        details: scrubAuditText(entry.details ?? ""),
        adminName: scrubAuditText(entry.adminName ?? "system"),
        ip: scrubAuditText(entry.ip ?? ""),
        timestamp: new Date(),
      },
    });
  } catch (e) {
    // Auditing must never block the request that triggered it.
    console.error("[audit] writeAudit failed — mutation succeeded without a trail:", e instanceof Error ? e.message : e);
  }
}