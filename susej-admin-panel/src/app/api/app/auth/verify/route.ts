import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import { createAppSession, createUserByPhone, findUserByPhone, toAppUser } from "@/lib/app-auth";

// Consumes the hashed OTP stored by POST /api/app/auth:
// expiry check, attempt cap (5), single-use (record deleted on success).
const MAX_ATTEMPTS = 5;

// Minimal per-IP throttle (single-instance, in-memory): 30 verifies per
// minute per IP. The per-phone 45s resend cooldown stops code spam, but
// without this a botnet could brute-force codes across many phones.
const VERIFY_WINDOW_MS = 60_000;
const VERIFY_MAX = 30;
const verifyHits = new Map<string, { count: number; resetAt: number }>();
// Creation bucket (mirrors email register: 5/hour/IP). Each OTP creation
// mints a 500 welcome bonus, so uncapped create = farmable money. Sign-in
// (existing user) is never throttled by this — only minting is.
const CREATE_WINDOW_MS = 60 * 60 * 1000;
const CREATE_MAX = 5;
const createHits = new Map<string, { count: number; resetAt: number }>();
function throttleCreateIp(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
  const now = Date.now();
  const cur = createHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    createHits.set(ip, { count: 1, resetAt: now + CREATE_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > CREATE_MAX) return false;
  return true;
}
function throttleVerifyIp(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
  const now = Date.now();
  const cur = verifyHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    verifyHits.set(ip, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > VERIFY_MAX) return false;
  return true;
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; create?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Explicit signup intent only: the client sends create:true solely from a
  // signup screen. Sign-in screens omit it, so a typo'd number can never
  // mint a ghost account + welcome money (was silent auto-create before).
  const wantCreate = body.create === true;
  const phone = (body.phone ?? "").replace(/\D/g, "");
  const code = String(body.code ?? "").replace(/\D/g, "");
  // Align with POST /api/app/auth (>=10 digits): shorter strings can never
  // have a code row, and previously fell through to findUserByPhone -> null
  // -> 500. Fail clean with 400 instead.
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: "A valid 10-digit phone number is required" }, { status: 400 });
  }
  if (!throttleVerifyIp(req)) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });
  }
  if (code.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rec = await prisma.appSetting.findUnique({ where: { key: `otp:${phone}` } });
  const data = rec?.value as { hash?: string; exp?: number; attempts?: number } | undefined;
  if (!rec || !data?.hash) {
    return NextResponse.json({ error: "No code requested. Tap Resend." }, { status: 400 });
  }
  if (typeof data.exp === "number" && data.exp < Date.now()) {
    await prisma.appSetting.delete({ where: { key: `otp:${phone}` } }).catch(() => undefined);
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 401 });
  }
  const attempts = typeof data.attempts === "number" ? data.attempts : 0;
  if (attempts >= MAX_ATTEMPTS) {
    await prisma.appSetting.delete({ where: { key: `otp:${phone}` } }).catch(() => undefined);
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }
  // Attempt counter is read-then-write on a JSON field (no atomic increment
  // in Prisma): two concurrent wrong guesses can both pass the >=MAX check
  // and each add 1, allowing at most 1 extra guess beyond MAX. Bounded and
  // acceptable — the code itself stays 6-digit secret + 5-min expiry +
  // single-use + per-IP throttle above. A raw-SQL jsonb atomic increment
  // would close the 1-extra gap if abuse ever shows up.
  if (data.hash !== createHash("sha256").update(`${phone}:${code}`).digest("hex")) {
    await prisma.appSetting.update({
      where: { key: `otp:${phone}` },
      data: { value: { ...data, attempts: attempts + 1 } },
    });
    return NextResponse.json({ error: "Incorrect code", attemptsLeft: MAX_ATTEMPTS - attempts - 1 }, { status: 401 });
  }

  // Success -> single use.
  await prisma.appSetting.delete({ where: { key: `otp:${phone}` } }).catch(() => undefined);

  const existing = await findUserByPhone(phone);
  if (existing) {
    const token = await createAppSession(existing.id, existing.username!);
    const fresh = await prisma.user
      .findUnique({ where: { id: existing.id } })
      .catch(() => null);
    return NextResponse.json({ token, user: toAppUser(fresh ?? existing) });
  }
  // Unknown number + correct code: sign-in must NOT create. Tell the client
  // it is a signup case so it can ask for explicit consent (industry split,
  // same as email login 401 vs register). Creation mints 500 welcome money,
  // so it additionally passes the per-IP creation bucket.
  if (!wantCreate) {
    return NextResponse.json(
      { error: "No account found for this number. Create one to continue.", needsSignup: true },
      { status: 404 }
    );
  }
  if (!throttleCreateIp(req)) {
    return NextResponse.json({ error: "Too many accounts from this network — try again later" }, { status: 429 });
  }
  const user = await createUserByPhone(phone);
  if (!user) return NextResponse.json({ error: "Could not create account" }, { status: 500 });

  const token = await createAppSession(user.id, user.username!);
  // Respond with the row as it exists NOW - a KYC verdict may have landed on
  // the User row moments before login, and the payload must never carry a
  // stale pre-verdict snapshot (isSeller/verification/businessName).
  const fresh = await prisma.user
    .findUnique({ where: { id: user.id } })
    .catch(() => null);
  return NextResponse.json({ token, user: toAppUser(fresh ?? user) });
}
