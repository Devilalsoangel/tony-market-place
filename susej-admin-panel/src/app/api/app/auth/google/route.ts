import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createAppSession, toAppUser } from "@/lib/app-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { idToken?: string; devBypass?: boolean; email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

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

  let info: { aud?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; sub?: string; error_description?: string; error?: string };
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
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

  const emailVerified = info.email_verified === true || info.email_verified === "true";
  if (!emailVerified) {
    return NextResponse.json({ error: "Google email not verified" }, { status: 403 });
  }

  const email = (info.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }
  const name = (info.name ?? "").trim() || email.split("@")[0];

  let user = await prisma.user.findFirst({ where: { email } });
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
