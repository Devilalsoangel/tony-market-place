import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { sha256Hex, hashPassword, SESSION_COOKIE, MAX_PASSWORD_LEN, getClientIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const MIN_PASSWORD_LENGTH = 8;

// Per-IP throttle (brute-force cost on the 900k code space) + uniform failure
// delay (timing uniformity: success and failure take the same time).
const RESET_WINDOW_MS = 60_000;
const RESET_MAX = 10;
const resetHits = new Map<string, { count: number; resetAt: number }>();
function throttleResetIp(ip: string): boolean {
  const now = Date.now();
  const cur = resetHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    resetHits.set(ip, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > RESET_MAX) return false;
  return true;
}
const FAIL_DELAY_MS = 300;
const slowFail = (body: Record<string, unknown>, status: number) =>
  new Promise<NextResponse>((resolve) => setTimeout(() => resolve(NextResponse.json(body, { status })), FAIL_DELAY_MS));

async function resolveToken(token: string) {
  if (!token) return null;
  const prisma = await getPrisma();
  if (!prisma) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { admin: true },
  });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt < new Date()) return null;
  return row;
}

export async function POST(request: NextRequest) {
  let action = "";
  let token = "";
  let password = "";
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    token = String(body?.token ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (!throttleResetIp(ip)) {
    return slowFail({ error: "Too many attempts — try again in a minute." }, 429);
  }

  if (action === "verify") {
    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { ok: false, error: "Database unavailable. Password reset is disabled." },
        { status: 503 },
      );
    }
    const row = await resolveToken(token);
    // No adminName on success (it leaked valid-token confirmation); uniform
    // timing on failure (see slowFail on the reset branch).
    if (!row) return slowFail({ ok: false, error: "This reset code is invalid or has expired." }, 200);
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LEN} characters.` },
        { status: 400 }
      );
    }
    const row = await resolveToken(token);
    if (!row) {
      return slowFail({ error: "This reset code is invalid or has expired." }, 400);
    }

    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: "Database unavailable. Password reset is disabled." }, { status: 503 });
    }

    await prisma.$transaction([
      prisma.admin.update({ where: { id: row.adminId }, data: { passwordHash: hashPassword(password), failedAttempts: 0, lockedUntil: null } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.deleteMany({ where: { adminId: row.adminId, usedAt: null } }),
    ]);

    await writeAudit({
      action: "auth.password_reset",
      entity: "admins",
      entityId: row.adminId,
      details: "Password reset via email link",
      adminName: row.admin.loginId,
      ip,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}