import { NextRequest } from "next/server";
import { getPrisma } from "./db";

export const APP_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getAppToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

/** Resolve the app user from the Bearer token. Returns null when unauthenticated. */
export async function getAppUser(req: NextRequest) {
  const token = getAppToken(req);
  if (!token) return null;
  const prisma = await getPrisma();
  if (!prisma) return null;
  const session = await prisma.appSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.appSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.status !== "active") return null;
  return { session, user: session.user };
}

/** Issue a new app session token for a user id. */
export async function createAppSession(userId: string, username: string): Promise<string> {
  const prisma = await getPrisma();
  if (!prisma) throw new Error("db unavailable");
  const { randomBytes } = await import("crypto");
  const token = `susej_${randomBytes(32).toString("base64url")}`;
  await prisma.appSession.create({
    data: { token, userId, username, expiresAt: new Date(Date.now() + APP_SESSION_TTL_MS) },
  });
  return token;
}

/**
 * Indian-number shape test (the product is India-only: INR, 91-normalized
 * identity). 10-digit nationals, 12-digit 91-prefixed, 11-digit 0-trunk.
 * Anything else is foreign-shaped and MUST NOT be folded into 91-space.
 */
export function isIndianPhoneShape(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  return (
    digits.length === 10 ||
    (digits.length === 12 && digits.startsWith("91")) ||
    (digits.length === 11 && digits.startsWith("0"))
  );
}

/**
 * Pure phone lookup (used by OTP verify). NEVER creates — creation is an
 * explicit signup decision (see createUserByPhone). Silent auto-provision on
 * a typo'd number used to mint ghost accounts + 500 welcome money each.
 *
 * Country lock: foreign-shaped input matches EXACT digits only. Normalizing a
 * foreign number into 91-space (or endsWith-matching its last 10) would bind
 * the verified session to a DIFFERENT person's Indian account — cross-country
 * account takeover with nothing but a same-last-10 number.
 */
export async function findUserByPhone(phone: string) {
  const prisma = await getPrisma();
  if (!prisma) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (!isIndianPhoneShape(digits)) {
    return prisma.user.findFirst({
      where: { OR: [{ phone: { not: null, equals: digits } }, { phone: { not: null, equals: phone } }] },
    });
  }
  // Normalize to E.164-ish India form (91 + last 10) so a paste of
  // "911556848908" (+91 + 12-digit national) does not create a 14-digit
  // duplicate (91911556848908) distinct from the intended 12-digit row.
  // FIX Sep 15: tony 911556848908 was showing as user8908 because the
  // double-country bug spawned a ghost account.
  const national = digits.slice(-10);
  const normalized = `91${national}`;
  // Deterministic priority: exact normalized first, then exact raw forms,
  // and only then the endsWith fallback. A single findFirst with OR is
  // ambiguous when a ghost duplicate exists (tony 911556848908 vs ghost
  // 91911556848908 both end with 1556848908) — the DB could return either.
  const exactFirst = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { not: null, equals: normalized } },
        { phone: { not: null, equals: digits } },
        { phone: { not: null, equals: phone } },
        { phone: { not: null, equals: national } },
      ],
    },
  });
  if (exactFirst) return exactFirst;
  const candidate = await prisma.user.findFirst({
    where: { phone: { not: null, endsWith: national } as never },
  });
  if (candidate) return candidate;
  return null;
}

/**
 * Explicit signup creation (ONLY called when the client passes create:true
 * from a signup screen + the caller passed its creation throttle). Split
 * from the finder so a sign-in typo can never mint an account or money.
 */
export async function createUserByPhone(phone: string) {
  const prisma = await getPrisma();
  if (!prisma) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const national = digits.slice(-10);
  // Foreign-shaped signups keep their own digits (never folded into 91-space,
  // or the @unique on phone collides with the victim's Indian row and the
  // P2002 loser-returns-winner path hands back the VICTIM account).
  const normalized = isIndianPhoneShape(digits) ? `91${national}` : digits;
  // Re-check under creation: a concurrent signup may have landed first.
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  // New phone → fresh buyer account. Username must be unique even when two
  // phones share the same last 4 digits (user0001-style collisions hard-500'd).
  const base = `user${national.slice(-4)}`;
  let username = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) break;
    username = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  // Race-close (API-H3): phone is @unique, so a concurrent signup for the
  // same number throws P2002 here even after the re-check above. Loser
  // returns the winner — one account, one bonus, never a dup + double mint.
  let created;
  try {
    created = await prisma.user.create({
      data: {
        name: `User ${national.slice(-4)}`,
        email: `user${national.slice(-4)}_${Date.now()}@susej.app`,
        phone: normalized,
        username,
        role: "buyer",
        status: "active",
        walletBalance: 500, // welcome bonus
        joinedAt: new Date(),
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") return findUserByPhone(phone);
    throw e;
  }
  if (!created) return null;
  // Ledger the bonus so every rupee in the wallet is traceable - an
  // unaudited balance is indistinguishable from minted money.
  try {
    await prisma.walletTransaction.create({
      data: {
        username: created.username ?? `user${digits.slice(-4)}`,
        title: "Welcome bonus",
        amount: 500,
        detail: "Signup credit",
        ts: new Date(),
      },
    });
  } catch {
    // Ledger write must never block login; balance stays authoritative.
  }
  return created;
}

/** Public user shape (mirrors the app's User type). */
export function toAppUser(u: {
  name: string;
  username: string | null;
  phone: string | null;
  email: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  interests: unknown;
  role: string;
  isSeller: boolean;
  businessName: string | null;
  category: string | null;
  verification: string;
  walletBalance: number;
  loyaltyPoints: number;
  joinedAt: Date;
}) {
  return {
    name: u.name,
    username: u.username ?? "",
    phone: u.phone ?? "",
    email: u.email,
    avatar: u.avatar ?? undefined,
    bio: u.bio ?? "",
    location: u.location ?? "",
    interests: Array.isArray(u.interests) ? u.interests : [],
    role: u.role === "both" ? "both" : u.isSeller ? "both" : "buyer",
    isSeller: u.isSeller,
    businessName: u.businessName ?? "",
    category: u.category ?? "",
    verification: u.verification as "none" | "pending" | "approved" | "rejected",
    walletBalance: u.walletBalance,
    loyaltyPoints: u.loyaltyPoints,
    joinedAt: u.joinedAt.toISOString(),
  };
}