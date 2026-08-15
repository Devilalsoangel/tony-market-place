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
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity ?? "system",
        entityId: entry.entityId ?? "",
        details: (entry.details ?? "").slice(0, 500),
        adminName: entry.adminName ?? "system",
        ip: entry.ip ?? "",
        timestamp: new Date(),
      },
    });
  } catch {
    // Auditing must never block the request that triggered it.
  }
}