/**
 * Server-side media reference helpers.
 *
 * Industry standard: the database stores HOSTED http(s) URLs only. The mobile
 * app uploads binary media through /api/app/upload (auth + 5MB cap + MIME
 * allow-list) and then references the returned /uploads/... path. Local
 * device URIs (file://, content://, data:) are meaningless outside the device
 * and are rejected at every write boundary — this is the root-cause fix for
 * the carry-over bug where a local file URI was persisted as a post/story
 * image and rendered broken for every other user.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function adminBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

/**
 * Normalize a media reference. Root-relative paths (/uploads/...) resolve
 * against the panel's own origin so stories can reference fresh uploads.
 */
export function resolveMediaUrl(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${adminBaseUrl().replace(/\/$/, "")}${value}`;
  return value;
}

export type MediaValidation =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

/**
 * Validate + normalize media references. Everything that reaches the database
 * must be hosted (http/https). file:, content: and data: URIs are rejected —
 * the client must upload first. Hosts are FIRST-PARTY ONLY (own origin,
 * Vercel preview suffix, or the configured Cloudinary cloud): arbitrary
 * external hotlinks rot, leak buyer IPs via tracking pixels, and let a
 * third party swap listing bytes post-moderation.
 */
export function validateMediaRefs(
  refs: unknown,
  opts: { min?: number; max?: number; field?: string } = {}
): MediaValidation {
  const min = opts.min ?? 1;
  const max = opts.max ?? 10;
  const field = opts.field ?? "image";
  const list = Array.isArray(refs) ? refs : refs === undefined || refs === null ? [] : [refs];
  if (list.length < min) {
    return { ok: false, error: min === 1 ? `${field} is required` : `At least ${min} ${field}(s) required` };
  }
  if (list.length > max) return { ok: false, error: `Maximum ${max} ${field}(s)` };
  const ownHosts = new Set<string>();
  for (const base of [process.env.APP_PUBLIC_BASE_URL, process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"]) {
    try {
      if (base) ownHosts.add(new URL(base).hostname.toLowerCase());
    } catch {}
  }
  const cloudName = (() => {
    const m = String(process.env.CLOUDINARY_URL ?? "").match(/@([^/]+)/);
    return m ? m[1].toLowerCase() : "";
  })();
  const urls: string[] = [];
  for (const item of list.slice(0, max)) {
    const value = resolveMediaUrl(item);
    try {
      const parsed = new URL(value);
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        return {
          ok: false,
          error: `${field} must be a hosted http(s) URL — upload the file via /api/app/upload first`,
        };
      }
      const host = parsed.hostname.toLowerCase();
      const firstParty =
        ownHosts.has(host) ||
        host.endsWith(".vercel.app") ||
        (cloudName !== "" && (host === cloudName || host.endsWith(`.${cloudName}`) || host.endsWith(".cloudinary.com")));
      if (!firstParty) {
        return {
          ok: false,
          error: `${field} must be uploaded via /api/app/upload first — external image links are not accepted`,
        };
      }
      urls.push(value);
    } catch {
      return {
        ok: false,
        error: `${field} must be a hosted http(s) URL — upload the file via /api/app/upload first`,
      };
    }
  }
  return { ok: true, urls };
}
