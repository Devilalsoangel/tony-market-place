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

/** Find a user by phone or username (used by OTP login). */
export async function findUserByPhone(phone: string) {
  const prisma = await getPrisma();
  if (!prisma) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Match exact first, then national-significant-number (last 10 digits) so
  // E.164 senders ("91"+"98765...") still resolve rows stored before the
  // country-code fix, and one SIM never spawns duplicate accounts.
  const candidate = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { not: null, equals: phone } },
        { phone: { not: null, equals: digits } },
        ...(digits.length > 10 ? [{ phone: { not: null, equals: digits.slice(-10) } }] : []),
      ],
    },
  });
  if (candidate) return candidate;
  // New phone → fresh buyer account. Username must be unique even when two
  // phones share the same last 4 digits (user0001-style collisions hard-500'd).
  const base = `user${digits.slice(-4)}`;
  let username = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) break;
    username = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  const created = await prisma.user.create({
    data: {
      name: `User ${digits.slice(-4)}`,
      email: `user${digits.slice(-4)}_${Date.now()}@susej.app`,
      phone: digits,
      username,
      role: "buyer",
      status: "active",
      walletBalance: 500, // welcome bonus
      joinedAt: new Date(),
    },
  });
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