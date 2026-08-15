import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-in-production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

interface SessionPayload {
  sub: string;
  name: string;
  role: string;
  loginId: string;
  exp: number;
}

function hmac(payload: string): Buffer {
  const h = require("node:crypto").createHmac("sha256", SECRET);
  h.update(payload);
  return h.digest();
}

export function signSession(admin: { id: string; name: string; role: string; loginId: string }): string {
  const payload: SessionPayload = {
    sub: admin.id,
    name: admin.name,
    role: admin.role,
    loginId: admin.loginId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(body).toString("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "susej_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export const CHALLENGE_COOKIE = "susej_challenge";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

interface ChallengePayload {
  sub: string;
  exp: number;
}

export function signChallenge(admin: { id: string }): string {
  const payload: ChallengePayload = { sub: admin.id, exp: Date.now() + CHALLENGE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(body).toString("base64url");
  return `${body}.${sig}`;
}

export function verifyChallengeToken(token: string | undefined): ChallengePayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChallengePayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}