import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import type { NextRequest } from "next/server";

// Signing key MUST come from env. A hardcoded fallback would let anyone who
// reads the repo forge admin sessions. In production runtime without env we
// FAIL LOUD (throw at boot) so a wiped env pages instead of silently bouncing
// logins across instances (Sep-14 ephemeral-JWT outage). Build phase stays
// silent (no runtime to warn to); local dev keeps the loud console warning.
const SECRET =
  process.env.JWT_SECRET ??
  (() => {
    const isBuild = process.env.NEXT_PHASE?.includes("build");
    if (isBuild) {
      // During build there is no runtime to warn to; keep silent.
      return randomBytes(48).toString("hex");
    }
    if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
      throw new Error(
        "[auth] JWT_SECRET is not set in production — refusing to boot with an ephemeral secret. Set JWT_SECRET (stable 64-hex) and redeploy."
      );
    }
    console.warn(
      "[auth] JWT_SECRET not set - using an EPHEMERAL per-boot secret. All sessions invalidate on restart. Set JWT_SECRET in .env."
    );
    return randomBytes(48).toString("hex");
  })();

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
  /** Issued-at (revocation horizon) + password verifier (revocation key). */
  iat?: number;
  ph?: string;
}

/** Password verifier: any password change invalidates all sessions minted
 *  before it (migration-free revocation — no schema change needed). */
export function sessionPasswordVerifier(passwordHash: string): string {
  return sha256Hex(`susej-sess-v1:${passwordHash}`).slice(0, 16);
}

function hmac(payload: string): Buffer {
  const h = require("node:crypto").createHmac("sha256", SECRET);
  h.update(payload);
  return h.digest();
}

export function signSession(admin: { id: string; name: string; role: string; loginId: string }, passwordHash?: string): string {
  const payload: SessionPayload = {
    sub: admin.id,
    name: admin.name,
    role: admin.role,
    loginId: admin.loginId,
    // 24h (was 7d): stolen-cookie replay, logout gap, and stale-privilege
    // windows all shrink to a day. Writes re-check the Admin row per request
    // (getActiveAdmin) so ban/demote bites immediately, not at next login.
    exp: Date.now() + 24 * 60 * 60 * 1000,
    iat: Date.now(),
    ...(passwordHash ? { ph: sessionPasswordVerifier(passwordHash) } : {}),
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

import { SESSION_COOKIE, CHALLENGE_COOKIE } from "./session-cookie";
export { SESSION_COOKIE, CHALLENGE_COOKIE };
export const SESSION_MAX_AGE = 24 * 60 * 60;
export const MAX_PASSWORD_LEN = 128;
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
  // Trust order matters: clients can inject arbitrary X-Forwarded-For entries
  // and Vercel appends the real client IP AFTER them — so the FIRST entry is
  // attacker-controlled while x-real-ip (set by the edge) is authoritative.
  // Old code took the first XFF entry: rotating the header per request gave a
  // fresh throttle bucket every time (all IP throttles + audit IPs defeated).
  // Residual hardening: x-real-ip is edge-set ONLY behind Vercel (x-vercel-id
  // present). Off-edge origins (direct/preview hits) could spoof it per
  // request to rotate throttle buckets + forge audit IPs — there we fall back
  // to the LAST XFF entry (closest proxy, hardest to spoof without an
  // allowlist) instead of the edge header.
  if (request.headers.get("x-vercel-id")) {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

/**
 * Fresh admin identity for request handling: verifies the signature, then
 * re-reads the Admin row (status + role are LIVE, never frozen at login).
 * Returns null for bad/expired tokens, missing rows, and non-active accounts —
 * so ban/deactivate/demote take effect on the NEXT request, not next login.
 * Fail-closed (null) when the DB is unreachable: a panel that cannot read its
 * own admin table must not serve stale-privilege sessions.
 */
export async function getActiveAdmin(
  request: NextRequest
): Promise<{ id: string; name: string; role: string; loginId: string } | null> {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  try {
    const { getPrisma } = await import("./db");
    const prisma = await getPrisma();
    if (!prisma) return null;
    const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
    if (!admin || (admin as { status?: unknown }).status !== "active") return null;
    // Revocation: sessions minted with a password verifier die on the next
    // password reset/change (hash rotates). Pre-fix tokens carry no verifier
    // and stay valid until their 24h expiry — accepted deliberately so the
    // rollout never logs out the whole team at once.
    if (session.ph) {
      const cur = sessionPasswordVerifier(String((admin as { passwordHash?: unknown }).passwordHash ?? ""));
      if (session.ph !== cur) return null;
    }
    return {
      id: (admin as { id: string }).id,
      name: String((admin as { name?: unknown }).name ?? ""),
      role: String((admin as { role?: unknown }).role ?? ""),
      loginId: String((admin as { loginId?: unknown }).loginId ?? ""),
    };
  } catch {
    return null;
  }
}