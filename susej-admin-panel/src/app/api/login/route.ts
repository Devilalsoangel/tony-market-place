import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  signSession,
  signChallenge,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  CHALLENGE_COOKIE,
  CHALLENGE_TTL_MS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
  MAX_PASSWORD_LEN,
  getClientIp,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { PrismaClient } from "@/generated/prisma/client";

// Per-IP login throttle (in-memory per isolate — raises spray cost alongside
// the account lockout; serverless fan-out residual is standing-noted).
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX = 30;
const loginHits = new Map<string, { count: number; resetAt: number }>();
function throttleLoginIp(ip: string): boolean {
  const now = Date.now();
  const cur = loginHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    loginHits.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > LOGIN_MAX) return false;
  return true;
}

type AdminLike = {
  id: string;
  name: string;
  loginId: string;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  passwordHash: string;
  twoFactorEnabled: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
};

async function getPrisma(): Promise<PrismaClient | null> {
  const { getPrisma: resolveDb } = await import("@/lib/db");
  return resolveDb();
}

async function recordFailure(prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>, adminId: string): Promise<{ locked: boolean; remaining: number }> {
  try {
    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: { failedAttempts: { increment: 1 } },
    });
    if (admin.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await prisma.admin.update({ where: { id: adminId }, data: { lockedUntil } });
      return { locked: true, remaining: 0 };
    }
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - admin.failedAttempts };
  } catch {
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }
}

export async function POST(request: NextRequest) {
  let loginId = "";
  let password = "";
  try {
    const body = await request.json();
    loginId = String(body?.loginId ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!loginId || !password) {
    return NextResponse.json({ error: "Admin ID and password are required." }, { status: 400 });
  }
  // CPU-DoS guard: scrypt is synchronous — an unbounded password blocks the
  // event loop per attempt. 128 chars is far beyond any human password.
  if (password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json({ error: "Invalid Admin ID or password." }, { status: 401 });
  }

  const ip = getClientIp(request);
  if (!throttleLoginIp(ip)) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute." }, { status: 429 });
  }
  const prisma = await getPrisma();

  // FAIL CLOSED: no DB connection means no login — no mock credential fallback.
  if (!prisma) {
    return NextResponse.json(
      { error: "Authentication service unavailable. The database is unreachable." },
      { status: 503 }
    );
  }

  let db: AdminLike | null = null;
  try {
    db = await prisma.admin.findUnique({ where: { loginId } });
  } catch {
    db = null;
  }

  if (!db) {
    await writeAudit({ action: "auth.login.failed", entity: "admins", details: `Unknown loginId: ${loginId}`, ip });
    return NextResponse.json({ error: "Invalid Admin ID or password." }, { status: 401 });
  }

  if (db.lockedUntil && db.lockedUntil > new Date()) {
    await writeAudit({
      action: "auth.login.locked",
      entity: "admins",
      entityId: db.id,
      details: "Blocked attempt on locked account",
      adminName: loginId,
      ip,
    });
    // Uniform 401 (no 423, no minutes): distinct locked responses hand out a
    // valid-loginId oracle and confirm lockout-DoS success to the attacker.
    // Legit owners see the same message and retry after the window.
    return NextResponse.json(
      { error: "Invalid Admin ID or password." },
      { status: 401 }
    );
  }

  if (!verifyPassword(password, db.passwordHash)) {
    let locked = false;
    if (prisma) {
      locked = (await recordFailure(prisma, db.id)).locked;
    }
    await writeAudit({
      action: "auth.login.failed",
      entity: "admins",
      entityId: db.id,
      details: locked ? "Account locked after too many attempts" : "Invalid password",
      adminName: loginId,
      ip,
    });
    return NextResponse.json({ error: "Invalid Admin ID or password." }, { status: 401 });
  }

  if (db.status !== "active") {
    await writeAudit({
      action: "auth.login.rejected",
      entity: "admins",
      entityId: db.id,
      details: "Account deactivated",
      adminName: loginId,
      ip,
    });
    return NextResponse.json({ error: "This account is deactivated. Contact a Super Admin." }, { status: 403 });
  }

  if (prisma) {
    prisma.admin.update({
      where: { id: db.id },
      data: {
        lastLogin: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
      select: { id: true },
    })
      .catch(() => null);
  }

  if (db.twoFactorEnabled) {
    const challenge = signChallenge({ id: db.id });
    const response = NextResponse.json({ twoFactor: true });
    response.cookies.set(CHALLENGE_COOKIE, challenge, {
      path: "/",
      maxAge: CHALLENGE_TTL_MS / 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    await writeAudit({
      action: "auth.pre_2fa",
      entity: "admins",
      entityId: db.id,
      details: "Password verified, awaiting 2FA code",
      adminName: loginId,
      ip,
    });
    return response;
  }

  const token = signSession({ id: db.id, name: db.name, role: db.role, loginId: db.loginId }, db.passwordHash);
  // Session travels in the HttpOnly cookie ONLY — the token is never echoed
  // in the JSON body (any XSS/log leak would yield a bearer-equivalent).
  const response = NextResponse.json({
    user: {
      id: db.id,
      name: db.name,
      loginId: db.loginId,
      email: db.email,
      avatar: db.avatar,
      role: db.role,
      status: db.status,
      twoFactorEnabled: db.twoFactorEnabled,
      createdAt: null,
      lastLogin: null,
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
  await writeAudit({
    action: "auth.login",
    entity: "admins",
    entityId: db.id,
    details: "Signed in",
    adminName: loginId,
    ip,
  });
  return response;
}