import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createAppSession, toAppUser } from "@/lib/app-auth";
import { getClientIp } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Per-IP throttle (minting side): every new Google email mints ₹500, so the
// endpoint is a money printer without a bucket. In-memory per isolate.
const GOOGLE_WINDOW_MS = 60_000;
const GOOGLE_MAX = 30;
const googleHits = new Map<string, { count: number; resetAt: number }>();
function throttleGoogleIp(ip: string): boolean {
  const now = Date.now();
  const cur = googleHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    googleHits.set(ip, { count: 1, resetAt: now + GOOGLE_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  if (cur.count > GOOGLE_MAX) return false;
  return true;
}
// Mint bucket (5/hour/IP, email-register parity): each mint creates ₹500 of
// spendable-after-hold value, and plus-addressed Gmails are distinct verified
// emails — without this, 30/min/IP farms ₹15k/min of bonus fuel (the hold
// delays withdrawal, it doesn't prevent the mint). Checked only when about
// to mint (existing-user logins never consume the budget); recorded only
// when the create commits.
const MINT_WINDOW_MS = 60 * 60 * 1000;
const MINT_MAX = 5;
const mintHits = new Map<string, { count: number; resetAt: number }>();
function googleMintAllowed(ip: string): boolean {
  const now = Date.now();
  const cur = mintHits.get(ip);
  if (!cur || now >= cur.resetAt) return true;
  return cur.count < MINT_MAX;
}
function recordGoogleMint(ip: string): void {
  const now = Date.now();
  const cur = mintHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    mintHits.set(ip, { count: 1, resetAt: now + MINT_WINDOW_MS });
  } else {
    cur.count += 1;
  }
}

export async function POST(req: NextRequest) {
  let body: { idToken?: string; devBypass?: boolean; email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  if (!throttleGoogleIp(getClientIp(req))) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });
  }

  // ── DEV BYPASS ──────────────────────────────────────────────────────────
  // CRITICAL SECURITY: this must default to DISABLED. The gate is
  // GOOGLE_AUTH_DEV_BYPASS === "on" AND non-production — never allow it in
  // production. An open bypass lets anyone log into ANY email (passwordless
  // account takeover) and mints a ₹500 welcome bonus per email.
  const devBypassEnabled =
    process.env.GOOGLE_AUTH_DEV_BYPASS === "on" && process.env.NODE_ENV !== "production";
  if (body.devBypass === true) {
    if (!devBypassEnabled) {
      return NextResponse.json({ error: "Google login not configured" }, { status: 401 });
    }
    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    const name = (body.name ?? "").trim() || email.split("@")[0];

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      let username = email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const taken = await prisma.user.findUnique({ where: { username } });
        if (!taken) break;
        username = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      // Ensure final uniqueness after loop suffix collisions
      let finalUsername = username;
      for (let i = 0; i < 5; i += 1) {
        const c = await prisma.user.findUnique({ where: { username: finalUsername } });
        if (!c) { username = finalUsername; break; }
        finalUsername = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
      }
      if (!googleMintAllowed(getClientIp(req))) {
        return NextResponse.json({ error: "Too many new accounts from this network — try again later" }, { status: 429 });
      }
      try {
        user = await prisma.user.create({
          data: {
            name,
            email,
            username,
            role: "buyer",
            status: "active",
            walletBalance: 500,
            joinedAt: new Date(),
          },
        });
        recordGoogleMint(getClientIp(req));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Unique constraint") || (e as { code?: string })?.code === "P2002") {
          // Race on email or username — refetch
          const existing = await prisma.user.findFirst({ where: { email } });
          if (existing) user = existing;
          else return NextResponse.json({ error: "Could not create account" }, { status: 500 });
        } else {
          return NextResponse.json({ error: "Could not create account" }, { status: 500 });
        }
      }
      // Ledger welcome bonus (same as OTP/email path)
      try {
        await prisma.walletTransaction.create({
          data: {
            username: user.username ?? username,
            title: "Welcome bonus",
            amount: 500,
            detail: "Signup credit",
            ts: new Date(),
          },
        });
      } catch {}
    }

    const token = await createAppSession(user.id, user.username!);
    const fresh = await prisma.user.findUnique({ where: { id: user.id } }).catch(() => null);
    return NextResponse.json({ token, user: toAppUser(fresh ?? user) });
  }

  // ── REAL PATH ─────────────────────────────────────────────────────────
  const idToken = (body.idToken ?? "").trim();
  if (!idToken) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google login not configured" }, { status: 503 });
  }

  let info: { aud?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; sub?: string; exp?: string | number; iat?: string | number; iss?: string; error_description?: string; error?: string };
  try {
    // POST body (never URL query): id_tokens in URLs land in proxy/CDN logs.
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    try {
      info = text ? (JSON.parse(text) as typeof info) : {};
    } catch {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }
    if (!res.ok || info.error || info.error_description) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }

  if (info.aud !== clientId) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  // Issuer + expiry: an aud-valid but expired (or foreign-issuer) token must
  // not mint sessions — expired-token replay was accepted before.
  const nowSec = Math.floor(Date.now() / 1000);
  if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  const exp = Number(info.exp);
  if (!Number.isFinite(exp) || exp <= nowSec) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  const iat = Number(info.iat);
  if (Number.isFinite(iat) && (iat > nowSec + 300 || exp - iat > 3600 * 5)) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }

  const emailVerified = info.email_verified === true || info.email_verified === "true";
  if (!emailVerified) {
    return NextResponse.json({ error: "Google email not verified" }, { status: 403 });
  }

  const email = (info.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  const name = (info.name ?? "").trim() || email.split("@")[0];
  const sub = typeof info.sub === "string" && info.sub ? info.sub : null;

  // Subject binding (email-recycling protection): the Google `sub` is the
  // stable identity; email alone hands the susej account + wallet to the
  // address's next owner. Rows carry googleSub once the column migration
  // lands; until then every access is guarded to degrade to email-only.
  // Banned accounts never mint, on either branch.
  async function findBySub(s: string) {
    try {
      return await (prisma as any).user.findFirst({ where: { googleSub: s } });
    } catch {
      return undefined;
    }
  }
  if (sub) {
    const bound = await findBySub(sub);
    if (bound && bound !== undefined) {
      if (bound.status !== "active") {
        return NextResponse.json({ error: "Account disabled. Contact support." }, { status: 403 });
      }
      const token = await createAppSession(bound.id, bound.username!);
      const fresh = await prisma.user.findUnique({ where: { id: bound.id } }).catch(() => null);
      return NextResponse.json({ token, user: toAppUser(fresh ?? bound) });
    }
  }

  let user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    if (user.status !== "active") {
      return NextResponse.json({ error: "Account disabled. Contact support." }, { status: 403 });
    }
    // Recycling tripwire: this email is bound to a DIFFERENT Google subject —
    // the address changed hands. Never hand over the account + wallet.
    const boundSub = (user as unknown as { googleSub?: unknown }).googleSub;
    if (sub && typeof boundSub === "string" && boundSub && boundSub !== sub) {
      return NextResponse.json({ error: "Google account mismatch. Contact support." }, { status: 403 });
    }
    // Adopt the subject on first sub-aware login (NULL → sub is safe: no
    // existing binding can conflict with an empty one).
    if (sub) {
      try {
        await (prisma as any).user.updateMany({
          where: { id: user.id, googleSub: null },
          data: { googleSub: sub },
        });
      } catch {}
    }
  }
  if (!user) {
    let username = email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken = await prisma.user.findUnique({ where: { username } });
      if (!taken) break;
      username = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    let finalUsername = username;
    for (let i = 0; i < 5; i += 1) {
      const c = await prisma.user.findUnique({ where: { username: finalUsername } });
      if (!c) { username = finalUsername; break; }
      finalUsername = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const avatar = typeof info.picture === "string" ? info.picture.trim() : null;
    if (!googleMintAllowed(getClientIp(req))) {
      return NextResponse.json({ error: "Too many new accounts from this network — try again later" }, { status: 429 });
    }
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          username,
          avatar,
          role: "buyer",
          status: "active",
          walletBalance: 500,
          joinedAt: new Date(),
        },
      });
      recordGoogleMint(getClientIp(req));
      // Bind subject at birth (guarded: no-op until the column migration lands).
      if (sub) {
        try {
          await (prisma as any).user.updateMany({
            where: { id: user.id, googleSub: null },
            data: { googleSub: sub },
          });
        } catch {}
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") || (e as { code?: string })?.code === "P2002") {
        const existing = await prisma.user.findFirst({ where: { email } });
        if (existing) user = existing;
        else return NextResponse.json({ error: "Could not create account" }, { status: 500 });
      } else {
        return NextResponse.json({ error: "Could not create account" }, { status: 500 });
      }
    }
    try {
      await prisma.walletTransaction.create({
        data: {
          username: user.username ?? username,
          title: "Welcome bonus",
          amount: 500,
          detail: "Signup credit",
          ts: new Date(),
        },
      });
    } catch {}
  }

  const token = await createAppSession(user.id, user.username!);
  const fresh = await prisma.user.findUnique({ where: { id: user.id } }).catch(() => null);
  return NextResponse.json({ token, user: toAppUser(fresh ?? user) });
}
