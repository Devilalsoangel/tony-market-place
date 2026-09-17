import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { getActiveAdmin, verifyPassword, hashPassword, getClientIp, MAX_PASSWORD_LEN } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

/**
 * POST /api/login/rotate-2fa { password } — rotate MY OWN 2FA code.
 *
 * Seeded admins all start on the static bootstrap code, so a shared/known
 * code must be replaceable with a fresh crypto-random one (shown ONCE in the
 * response — no delivery channel exists, write it down). Requires the live
 * session AND the current password. Audited. The old code dies on rotate.
 */
export async function POST(request: NextRequest) {
  const auth = await getActiveAdmin(request).catch(() => null);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let password = "";
  try {
    password = String((await request.json())?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!password || password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json({ error: "Current password is required." }, { status: 400 });
  }

  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const admin = await prisma.admin.findUnique({ where: { id: auth.id } });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    await writeAudit({
      action: "auth.2fa.rotate_denied",
      entity: "admins",
      entityId: auth.id,
      details: "Wrong password on 2FA rotation",
      adminName: auth.loginId,
      ip: getClientIp(request),
    });
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const code = String(randomInt(100000, 1000000));
  await prisma.admin.update({
    where: { id: auth.id },
    data: { twoFactorCode: hashPassword(code), twoFactorEnabled: true },
  });
  await writeAudit({
    action: "auth.2fa.rotated",
    entity: "admins",
    entityId: auth.id,
    details: "2FA code rotated (new code shown once)",
    adminName: auth.loginId,
    ip: getClientIp(request),
  });
  return NextResponse.json({ code });
}
