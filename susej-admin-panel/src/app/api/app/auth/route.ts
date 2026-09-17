import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { getPrisma } from "@/lib/db";
import { getAppUser, isIndianPhoneShape } from "@/lib/app-auth";

// Production OTP request flow:
// - 6-digit random code, stored as SHA-256 hash with 5-minute expiry,
//   max 5 verify attempts, single-use (row deleted on success).
// - Delivery through an SMS provider when SMS_API_URL + SMS_API_KEY are set;
//   otherwise AUTH_DEV_MODE (default on in development) returns devCode so
//   the flow stays testable without a provider contract.
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

async function sendViaSmsProvider(phone: string, code: string): Promise<boolean> {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to: phone, text: `Your susej verification code is ${code}. It expires in 5 minutes.` }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const phone = (body.phone ?? "").replace(/\D/g, "");
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: "A valid 10-digit phone number is required" }, { status: 400 });
  }
  // India-only product (INR identity, 91-normalized accounts): codes are
  // issued to Indian shapes only. A foreign number sharing an Indian
  // account's last 10 digits must never receive a code — the verify step
  // binds sessions by phone, and cross-country issuance is account takeover.
  if (!isIndianPhoneShape(phone)) {
    return NextResponse.json({ error: "Only Indian (+91) mobile numbers are supported" }, { status: 400 });
  }
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  // Cooldown: an unexpired request cannot be re-issued inside the window.
  const existing = await prisma.appSetting.findUnique({ where: { key: `otp:${phone}` } });
  if (existing?.value) {
    const prev = existing.value as { exp?: number; issuedAt?: number };
    if (typeof prev.exp === "number" && prev.exp > Date.now() &&
        typeof prev.issuedAt === "number" && Date.now() - prev.issuedAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: "Code already sent. Please wait before requesting another." }, { status: 429 });
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  await prisma.appSetting.upsert({
    where: { key: `otp:${phone}` },
    create: { key: `otp:${phone}`, value: { hash: hashCode(phone, code), exp: now + OTP_TTL_MS, attempts: 0, issuedAt: now } },
    update: { value: { hash: hashCode(phone, code), exp: now + OTP_TTL_MS, attempts: 0, issuedAt: now } },
  });

  const delivered = await sendViaSmsProvider(phone, code);
  const devMode = process.env.AUTH_DEV_MODE === "1" || (process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_MODE !== "0");
  if (!delivered && !devMode) {
    // No provider configured and dev mode off -> fail closed rather than
    // pretending a message went out.
    return NextResponse.json({ error: "SMS delivery is not configured" }, { status: 503 });
  }
  // Explicit AUTH_DEV_MODE=1 exposes the code even in production — DEV/PREVIEW
  // ONLY (lets testers register without an SMS provider). Never set on a
  // real public launch; anyone with the number could read codes otherwise.
  // Default (no flag): codes stay hidden outside development, as before.
  const exposeDevCode =
    !delivered && devMode && (process.env.NODE_ENV !== "production" || process.env.AUTH_DEV_MODE === "1");
  return NextResponse.json({
    ok: true,
    message: delivered ? "OTP sent" : "OTP generated (dev mode)",
    ...(exposeDevCode ? { devCode: code } : {}),
  });
}

/**
 * DELETE /api/app/auth — log out: revoke the caller's session token now
 * (plus ?all=1 to burn every session on the account, e.g. after device
 * theft). Without this a stolen susej_ Bearer stayed valid for the full
 * 30-day TTL with no way to kill it.
 */
export async function DELETE(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all) {
    await prisma.appSession.deleteMany({ where: { userId: auth.user.id } });
  } else {
    await prisma.appSession.deleteMany({ where: { token } });
  }
  return NextResponse.json({ ok: true, revoked: all ? "all" : "current" });
}
