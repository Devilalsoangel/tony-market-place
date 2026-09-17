import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  verifyPassword,
  verifyChallengeToken,
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  CHALLENGE_COOKIE,
  MAX_LOGIN_ATTEMPTS,
  getClientIp,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// 2FA attempt budget is tracked HERE (per challenge-subject, in-memory per
// isolate) — deliberately SEPARATE from the password failedAttempts/lockedUntil
// counter. Sharing it meant five wrong 2FA guesses locked the real admin out
// even with the right password (lockout-DoS via the second factor). On
// exhaustion the challenge is invalidated (re-login required), never a lock.
const TFA_WINDOW_MS = 10 * 60 * 1000;
const tfaFails = new Map<string, { count: number; resetAt: number }>();
function tfaFailed(sub: string): number {
  const now = Date.now();
  const cur = tfaFails.get(sub);
  if (!cur || now >= cur.resetAt) {
    tfaFails.set(sub, { count: 1, resetAt: now + TFA_WINDOW_MS });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}
function tfaClear(sub: string) {
  tfaFails.delete(sub);
}

export async function POST(request: NextRequest) {
  let code = "";
  try {
    const body = await request.json();
    code = String(body?.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (!code) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const challenge = verifyChallengeToken(request.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    return NextResponse.json({ error: "Your sign-in expired. Please sign in again.", expired: true }, { status: 401 });
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: "Two-factor sign-in is unavailable. Please sign in again.", expired: true }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({ where: { id: challenge.sub } });
  if (!admin) {
    return NextResponse.json({ error: "Invalid sign-in. Please sign in again." }, { status: 401 });
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "Invalid sign-in. Please sign in again.", expired: true },
      { status: 401 }
    );
  }

  if (!admin.twoFactorEnabled || !admin.twoFactorCode || !verifyPassword(code, admin.twoFactorCode)) {
    const fails = tfaFailed(admin.id);
    const exhausted = fails >= MAX_LOGIN_ATTEMPTS;
    await writeAudit({
      action: "auth.2fa.failed",
      entity: "admins",
      entityId: admin.id,
      details: exhausted ? "2FA budget exhausted — challenge invalidated" : "Invalid 2FA code",
      adminName: admin.loginId,
      ip,
    });
    const response = NextResponse.json(
      exhausted
        ? { error: "Too many wrong codes. Please sign in again.", expired: true }
        : { error: "Invalid code. Try again." },
      { status: 401 }
    );
    if (exhausted) {
      tfaClear(admin.id);
      response.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return response;
  }
  tfaClear(admin.id);

  if (admin.status !== "active") {
    return NextResponse.json({ error: "This account is deactivated. Contact a Super Admin." }, { status: 403 });
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() },
  });

  const token = signSession({ id: admin.id, name: admin.name, role: admin.role, loginId: admin.loginId });
  const response = NextResponse.json({
    token,
    user: {
      id: admin.id,
      name: admin.name,
      loginId: admin.loginId,
      email: admin.email,
      avatar: admin.avatar,
      role: admin.role,
      status: admin.status,
      twoFactorEnabled: true,
      createdAt: admin.createdAt.toISOString(),
      lastLogin: admin.lastLogin?.toISOString() ?? null,
      password: "",
    },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    path: "/",
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });

  await writeAudit({
    action: "auth.login",
    entity: "admins",
    entityId: admin.id,
    details: "Signed in (2FA)",
    adminName: admin.loginId,
    ip,
  });
  return response;
}