import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { sha256Hex, getClientIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_TOKENS_PER_ADMIN = 3;

// Per-IP throttle (in-memory per isolate): uncapped sends = SMS-cost pumping
// (where a provider is wired) + victim harassment + token-table bloat.
const FORGOT_WINDOW_MS = 60_000;
const FORGOT_MAX = 10;
const forgotHits = new Map<string, { count: number; resetAt: number }>();
function throttleForgotIp(ip: string): boolean {
  const now = Date.now();
  const cur = forgotHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    forgotHits.set(ip, { count: 1, resetAt: now + FORGOT_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > FORGOT_MAX) return false;
  return true;
}

export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (!throttleForgotIp(ip)) {
    // Uniform success shape even when throttled: no oracle, no cost signal.
    return NextResponse.json({ success: true });
  }
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { error: "Database unavailable. Password reset is disabled." },
      { status: 503 },
    );
  }

  const admin = await prisma.admin.findFirst({ where: { email } });
  let devCode: string | undefined;

  if (admin && admin.status === "active") {
    const code = randomOtp();
    // Sweep expired rows + cap active tokens per admin: previously every
    // request minted a permanent row (unbounded table, brute-force surface
    // that never shrinks).
    await prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    }).catch(() => null);
    const live = await prisma.passwordResetToken.findMany({
      where: { adminId: admin.id, usedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);
    for (const stale of live.slice(MAX_ACTIVE_TOKENS_PER_ADMIN - 1)) {
      await prisma.passwordResetToken.delete({ where: { id: stale.id } }).catch(() => null);
    }
    await prisma.passwordResetToken.create({
      data: {
        adminId: admin.id,
        tokenHash: sha256Hex(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await writeAudit({
      action: "auth.forgot.otp_sent",
      entity: "admins",
      entityId: admin.id,
      details: "Password reset OTP requested",
      adminName: admin.loginId,
      ip,
    });
    // Dev passthrough is DEV-ONLY, never production even if the flag leaks
    // into prod env: in prod the code travels by email only, full stop.
    const passthrough = process.env.NODE_ENV !== "production" && process.env.DEV_RESET_PASSTHROUGH === "true";
    if (passthrough) {
      devCode = code;
    }
  } else if (admin) {
    await writeAudit({
      action: "auth.forgot.rejected",
      entity: "admins",
      entityId: admin.id,
      details: "OTP requested for deactivated account",
      adminName: admin.loginId,
      ip,
    });
  }

  return NextResponse.json({ success: true, ...(devCode ? { devCode } : {}) });
}

function randomOtp(): string {
  // Crypto PRNG: Math.random is predictable — reset codes must not be.
  return String(randomInt(100000, 1000000));
}