import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { sha256Hex, getClientIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const OTP_TTL_MS = 10 * 60 * 1000;

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
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({
      success: true,
      demo: true,
      devCode: randomOtp(),
      message: "Demo mode (no database): use the dev code shown on the next screen.",
    });
  }

  const admin = await prisma.admin.findFirst({ where: { email } });
  let devCode: string | undefined;

  if (admin && admin.status === "active") {
    const code = randomOtp();
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
    const passthrough = process.env.NODE_ENV !== "production" || process.env.DEV_RESET_PASSTHROUGH === "true";
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
  return String(Math.floor(100000 + Math.random() * 900000));
}