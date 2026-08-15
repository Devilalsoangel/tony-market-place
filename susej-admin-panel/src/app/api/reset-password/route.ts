import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { sha256Hex, hashPassword, SESSION_COOKIE, getClientIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const MIN_PASSWORD_LENGTH = 8;
const OTP_PATTERN = /^\d{6}$/;

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

  if (action === "verify") {
    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json(
        OTP_PATTERN.test(token)
          ? { ok: true, adminName: "Demo Admin", demo: true }
          : { ok: false, error: "Enter the 6-digit code." }
      );
    }
    const row = await resolveToken(token);
    return NextResponse.json(row ? { ok: true, adminName: row.admin.name } : { ok: false, error: "This reset code is invalid or has expired." });
  }

  if (action === "reset") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }
    const row = await resolveToken(token);
    if (!row) {
      const prisma = await getPrisma();
      if (!prisma && OTP_PATTERN.test(token)) {
        const response = NextResponse.json({ success: true, demo: true });
        response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
        return response;
      }
      return NextResponse.json({ error: "This reset code is invalid or has expired." }, { status: 400 });
    }

    const prisma = await getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
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