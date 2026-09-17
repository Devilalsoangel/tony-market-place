import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findUserByPhone } from "@/lib/app-auth";

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
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim() || "unknown";
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
  return NextResponse.json({ exists: !!user });
}
