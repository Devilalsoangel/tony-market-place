import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findUserByPhone } from "@/lib/app-auth";
import { getClientIp } from "@/lib/auth";

// Existence probe for the sign-in screen: "does this number have an account?"
// Lets login redirect unknown numbers to the signup flow BEFORE any OTP is
// sent or any account is minted. Returns only a boolean — never user data —
// and shares the verify-style per-IP throttle so numbers can't be farmed.
// (Same disclosure level as verify's 404 needsSignup; enumeration is
//  rate-bounded, matching the existing check-username precedent.)
const CHECK_WINDOW_MS = 60_000;
const CHECK_MAX = 30;
const checkHits = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Existence probe for the sign-in screen: uniform 300ms timing + shared
  // throttle so enumeration costs real time. Residual oracle accepted
  // (the UX needs the signup/signin fork); CAPTCHA is the full fix.
  const startedAt = Date.now();
  const ip = getClientIp(req);
  const now = Date.now();
  const cur = checkHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    checkHits.set(ip, { count: 1, resetAt: now + CHECK_WINDOW_MS });
  } else {
    cur.count += 1;
    if (cur.count > CHECK_MAX) {
      return NextResponse.json({ error: "Too many attempts — try again in a minute" }, { status: 429 });
    }
  }
  const phone = (body.phone ?? "").replace(/\D/g, "");
  if (!phone) return NextResponse.json({ error: "Enter a phone number" }, { status: 400 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const user = await findUserByPhone(phone);
  const elapsed = Date.now() - startedAt;
  if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
  return NextResponse.json({ exists: !!user });
}
