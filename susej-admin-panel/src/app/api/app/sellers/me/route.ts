import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/** Find the caller's own seller application: primary key app_<username>,
 *  falling back to a phone match for rows filed before the id clamp. */
async function findMine(prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>, username: string, phone: string | null) {
  const byId = await prisma.seller.findUnique({ where: { id: `app_${username}` } }).catch(() => null);
  if (byId) return byId;
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits) {
    const byPhone = await prisma.seller.findFirst({
      where: { OR: [{ phone: digits }, { phone: { endsWith: digits.slice(-10) } }] },
      orderBy: { submittedAt: "desc" },
    }).catch(() => null);
    if (byPhone) return byPhone;
  }
  return null;
}

/**
 * GET /api/app/sellers/me — my own seller application status (server truth).
 * Industry pattern (Amazon/Meesho onboarding): the app fetches this on login
 * and on the become-seller screen so a pending verdict survives reinstalls,
 * relogins and reopens. Missing row -> { application: null } (never 404, so
 * the client treats "never applied / withdrawn" as the wizard state).
 */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  const row = await findMine(prisma, username, auth.user.phone);
  if (!row) return NextResponse.json({ application: null });

  const [docCount, verifiedDocs, lastAudit] = await Promise.all([
    prisma.sellerDocument.count({ where: { sellerId: row.id } }),
    prisma.sellerDocument.count({ where: { sellerId: row.id, verified: true } }),
    prisma.sellerAuditLog.findFirst({ where: { sellerId: row.id }, orderBy: { timestamp: "desc" } }).catch(() => null),
  ]);

  return NextResponse.json({
    application: {
      id: row.id,
      businessName: row.businessName,
      category: row.category ?? "",
      status: row.kycStatus,
      submittedAt: row.submittedAt instanceof Date ? row.submittedAt.getTime() : new Date(row.submittedAt).getTime(),
      docCount,
      verifiedDocs,
      lastDecision: lastAudit ? { action: lastAudit.action, note: lastAudit.note, at: lastAudit.timestamp.getTime() } : null,
    },
  });
}

/**
 * DELETE /api/app/sellers/me — withdraw my own PENDING application (owner
 * only). Approved sellers cannot self-delete (they hold live store data);
 * rejected applications are removed by re-applying (wizard upserts). The
 * user's own KYC files go with it — their data, their choice.
 */
export async function DELETE(req: NextRequest) {
  void req;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  const row = await findMine(prisma, username, auth.user.phone);
  if (!row) return NextResponse.json({ ok: true, withdrawn: false });
  if (row.kycStatus !== "pending") {
    return NextResponse.json({ error: "Only a pending application can be withdrawn" }, { status: 409 });
  }
  // Pending applicants cannot own products/orders (creation gates on
  // approved), but refuse rather than strand if that ever changes.
  const [products, orders] = await Promise.all([
    prisma.product.count({ where: { sellerName: { contains: row.businessName, mode: "insensitive" } } }),
    prisma.order.count({ where: { sellerName: { contains: row.businessName, mode: "insensitive" } } }),
  ]);
  if (products || orders) {
    return NextResponse.json({ error: "This application holds live store data — contact support" }, { status: 409 });
  }
  await prisma.seller.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true, withdrawn: true });
}
