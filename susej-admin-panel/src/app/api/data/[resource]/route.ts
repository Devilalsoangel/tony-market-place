import { NextRequest, NextResponse } from "next/server";
import { getPrisma as resolveDb } from "@/lib/db";
import { verifySessionToken, hashPassword, SESSION_COOKIE, getClientIp } from "@/lib/auth";
import { checkAppKey } from "@/lib/promotions/api-auth";
import { lazySweep } from "@/lib/promotions/activate";
import { getAppUser } from "@/lib/app-auth";
import { resolveCommissionRate, settlementGoodsBasis, settledFeeFromLegs } from "@/lib/commission";
import { notifyUser } from "@/lib/notifications";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRISMA_MODELS: Record<string, string> = {
  users: "user",
  sessions: "appSession",
  sellers: "seller",
  categories: "category",
  products: "product",
  orders: "order",
  communities: "community",
  reviews: "review",
  transactions: "transaction",
  ledger: "ledgerEntry",
  "gateway-logs": "gatewayLog",
  shipments: "shipment",
  carriers: "carrier",
  "delivery-zones": "deliveryZone",
  tickets: "supportTicket",
  "audit-logs": "auditLog",
  "notification-templates": "notificationTemplate",
  "notification-history": "notificationHistoryItem",
  "reported-products": "reportedProduct",
  "reported-messages": "reportedMessage",
  "reported-comments": "reportedComment",
  "reported-users": "reportedUser",
  messages: "message",
  posts: "post",
  blocked: "blockedUser",
  "address-book": "addressBookEntry",
  "payment-methods": "paymentMethod",
  live: "liveStream",
  reels: "reel",
  stories: "story",
  hashtags: "hashtag",
  bundles: "bundle",
  "food-hub": "foodHubItem",
  broadcasts: "broadcast",
  bookings: "booking",
  loyalty: "loyaltyUser",
  disputes: "dispute",
  auctions: "auction",
  refunds: "refund",
  withdrawals: "withdrawal",
  promotions: "promotionPurchase",
  commission: "commissionSetting",
  coupons: "coupon",
  "revenue-metrics": "revenueMetrics",
  "top-sellers": "topSeller",
  "hot-deals": "hotDeal",
    "featured-posts": "featuredPost",
  spotlights: "spotlight",
  "home-sections": "homeSection",
  "storefront-banners": "storefrontBanner",
  "app-settings": "appSetting",
  admins: "admin",
  "seller-documents": "sellerDocument",
  "seller-audit-log": "sellerAuditLog",
};

// Models whose @id column is not named `id` (e.g. AppSetting.key) — the
// generic update/delete must address the real primary key or Prisma throws.
const PRIMARY_KEY: Record<string, string> = {
  "app-settings": "key",
};

type Role = "super_admin" | "manager" | "moderator" | "finance" | "support" | "app";

const READ_ONLY_RESOURCES = new Set(["audit-logs"]);
// Moderators own the safety queues: community/review/ticket desks plus the
// report queues they triage and the blocked list their mute/block actions
// write to. Without these, the moderation screens 403 for the role that owns
// them (chat moderation mute/block included).
const MODERATOR_RESOURCES = new Set(["communities", "reviews", "tickets", "reported-messages", "reported-products", "reported-comments", "reported-users", "blocked", "posts", "hashtags", "notification-templates", "notification-history", "disputes"]);
// Finance desk: money decisions only (payout/refund queues + their money
// tables). Explicit — never inherited from the moderator set.
const FINANCE_RESOURCES = new Set(["withdrawals", "refunds", "transactions", "ledger", "orders"]);
// Money tables no non-finance staff role may ever write (explicit deny closes
// the implicit-fallthrough hole for current AND future staff roles).
const MONEY_RESOURCES = new Set(["withdrawals", "refunds", "transactions", "ledger", "commission"]);

// Resources the mobile app may write to via the device API key (x-app-key).
// The app is never allowed to READ admin data — it only mirrors activity.
// NOTE: withdrawals are NOT app-writable. Payout requests are created only
// through the transactional /api/app/wallet POST (debit + desk row in one
// $transaction); /api/data/withdrawals is decision-only for the admin desk.
const APP_SYNC_RESOURCES = new Set([
  "orders",
  "sellers",
  "tickets",
  "messages",
  "promotions",
  "refunds",
  "storefront-banners",
]);

const SENSITIVE_ADMIN_FIELDS = ["password", "passwordHash", "twoFactorCode", "failedAttempts", "lockedUntil"] as const;

// Relation list-fields: Prisma 7 rejects BARE ARRAYS for nested relation
// writes ("Expected ...CreateNestedManyWithoutSellerInput") — the old client
// accepted `documents: [...]` as create-sugar. Normalize arrays to
// `{ create: [...] }` and drop empty ones (Json fields like hashtags/
// memberList are unaffected).
const RELATION_ARRAY_FIELDS = new Set(["documents", "auditLogs", "resetTokens", "sessions", "children"]);

function normalizeRelationArrays(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (RELATION_ARRAY_FIELDS.has(k) && Array.isArray(v)) {
      if (v.length === 0) continue;
      out[k] = { create: v };
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function writeAuditSafe(entry: {
  action: string;
  entity: string;
  entityId: string;
  details: string;
  adminName: string;
  ip: string;
}) {
  try {
    const { writeAudit } = await import("@/lib/audit");
    await writeAudit(entry);
  } catch {
    // no DB available (e.g. static Netlify demo) - audit is best-effort
  }
}

/**
 * Normalize free-form Admin.role strings to the enforced role set.
 * Unknown/staff roles (support, analytics, ...) fail CLOSED to moderator
 * scope — least privilege by default, expanded only by explicit mapping.
 */
function normalizeRole(raw: string): Role {
  const r = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (r === "super_admin" || r === "superadmin" || r === "owner") return "super_admin";
  if (r === "manager" || r === "admin") return "manager";
  if (r === "finance" || r === "accountant" || r === "treasury") return "finance";
  if (r === "support" || r === "moderator" || r === "mod") return "moderator";
  if (r === "app") return "app";
  return "moderator";
}

// Finance read scope (least-privilege): money queues + their tables, the
// payee directory (sellers), and read-only money context (commission rates,
// summary aggregates). NEVER admins/audit-logs/users/moderation queues — a
// payout clerk has no need for credentials, audit trails, or report contents.
const FINANCE_READ_RESOURCES = new Set([...FINANCE_RESOURCES, "commission", "sellers", "summary", "gateway-logs"]);
function readAllowed(resource: string, role: Role): boolean {
  if (role === "app") return false; // the app never reads admin data
  if (role === "super_admin") return true;
  // Manager reads everything EXCEPT the admin-credential + audit-trail
  // stores (mirrors proxy.ts managerBlockedPrefixes — page ACL and API ACL
  // share one matrix; blocking the page while leaving the API open is
  // theater that fails pen-test). app-settings joins the deny set: the System
  // page is manager-blocked, and promoPrices/rolePermissions/secrets-adjacent
  // config must not leak through the API door.
  if (role === "manager") return resource !== "admins" && resource !== "audit-logs" && resource !== "app-settings";
  if (role === "finance") return FINANCE_READ_RESOURCES.has(resource);
  return MODERATOR_RESOURCES.has(resource);
}

function writeAllowed(resource: string, role: Role): boolean {
  if (role === "app") return APP_SYNC_RESOURCES.has(resource);
  if (role === "super_admin") return !READ_ONLY_RESOURCES.has(resource);
  // Manager deny-list (F5): sessions tokens (= app-impersonation via Bearer),
  // app-settings (secrets/pricing), and the immutable money books
  // (transactions/ledger/commission display rows with no legs). Decision
  // queues (orders/disputes/refunds/withdrawals) stay writable — maker-checker
  // governs execution, not the resource gate.
  if (role === "manager") {
    if (READ_ONLY_RESOURCES.has(resource)) return false;
    if (resource === "admins" || resource === "audit-logs") return false;
    if (resource === "sessions" || resource === "app-settings") return false;
    if (resource === "transactions" || resource === "ledger" || resource === "commission") return false;
    return true;
  }
  // Finance executes decisions (withdrawals/refunds/orders queues) — it never
  // hand-writes the immutable books (ledger/transactions are append-only via
  // the settlement machines; a hand-minted leg breaks wallet↔ledger parity).
  if (role === "finance") {
    if (resource === "ledger" || resource === "transactions") return false;
    return FINANCE_RESOURCES.has(resource);
  }
  // Moderators + every other staff role: community scope only, and NEVER
  // money tables (explicit deny beats any future set additions).
  if (MONEY_RESOURCES.has(resource)) return false;
  return MODERATOR_RESOURCES.has(resource);
}

/**
 * Maker-checker for money execution (industry dual-control): completing a
 * payout or issuing a refund requires a PRIOR approve audit by a DIFFERENT
 * admin. Single-admin shops fall back to an explicitly flagged sole-approver
 * path (audited) instead of deadlocking.
 * Break-glass: a super_admin may pass dualControlOverride:true when the
 * approval trail is provably lost (deleted audit row) — execution proceeds
 * with a LOUD override audit naming the actor. Without the flag, a missing
 * trail refuses (fail-closed).
 * Returns null when execution may proceed, else an error message.
 */
async function makerCheck(
  prisma: any,
  entity: string,
  entityId: string,
  me: string,
  opts?: { superAdmin?: boolean; override?: boolean }
): Promise<string | null> {
  try {
    const admins: { role: string }[] = await prisma.admin.findMany({ where: { status: "active" }, select: { role: true } });
    const eligible = admins.filter((a) => ["super_admin", "manager", "finance"].includes(normalizeRole(a.role)));
    if (eligible.length < 2) return null; // sole finance approver — allowed, flagged below
    const prior = await prisma.auditLog.findFirst({
      where: {
        entity,
        entityId: String(entityId),
        adminName: { not: me },
        details: { contains: "-> 'approved'" },
      },
      orderBy: { timestamp: "desc" },
    });
    if (!prior) {
      if (opts?.override === true && opts?.superAdmin === true) return null;
      return "Dual control: a different admin must approve first (no prior approval on record). Super Admin break-glass: resubmit with dualControlOverride:true (audited).";
    }
    return null;
  } catch {
    return "Could not verify dual control — execution refused";
  }
}

/** Count finance-eligible admins (for the sole-approver audit flag). */
async function financeApproverCount(prisma: any): Promise<number> {
  try {
    const admins: { role: string }[] = await prisma.admin.findMany({ where: { status: "active" }, select: { role: true } });
    return admins.filter((a) => ["super_admin", "manager", "finance"].includes(normalizeRole(a.role))).length;
  } catch {
    return 2; // unknown → enforce checker (fail closed)
  }
}

function stripSensitive(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  for (const key of SENSITIVE_ADMIN_FIELDS) delete copy[key];
  return copy;
}

function serialize(value: unknown, resource?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => serialize(v, resource));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = v instanceof Date ? v.toISOString() : serialize(v, resource);
    }
    // Strip sensitive fields for admins AND users resources.
    // passwordHash must NEVER be exposed — it enables offline brute-force attacks.
    if (resource === "admins" || resource === "users") return stripSensitive(out);
    // Session tokens are credential material (Bearer susej_* impersonates the
    // user on every /api/app/* route) — opaque, HttpOnly, never listable.
    // Support uses short-lived impersonation grants, not token dumps.
    if (resource === "sessions") {
      delete out.token;
      return out;
    }
    // API keys / SMTP passwords are write-only secrets: list APIs return
    // metadata + last4 only; the full value exists only at creation.
    if (resource === "app-settings" && typeof out.key === "string" && typeof out.value === "string") {
      if (/api[_-]?key|secret|password|token|smtp/i.test(String(out.key))) {
        const v = String(out.value);
        out.value = v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
      }
      return out;
    }
    return out;
  }
  return value;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(message = "Forbidden for your role.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

const EXTENDED: Record<string, object> = {
  sellers: { include: { documents: true, auditLogs: true } },
};

function parseSession(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Session resolution for write paths: admin session cookie first, then the
 * mobile app's device API key (x-app-key) PLUS a valid Bearer susej_ token.
 * The Bearer token binds the device to a REAL user (getAppUser) so
 * storefront-banners / sellers / withdrawals cannot be spoofed as another
 * seller by just knowing dev-key.
 */
async function parseWriteSession(request: NextRequest) {
  // Admin cookie resolves to the LIVE Admin row (ban/deactivate/demote bite
  // on the next request, never at next login). App-key path unchanged.
  const { getActiveAdmin } = await import("@/lib/auth");
  const admin = await getActiveAdmin(request).catch(() => null);
  if (admin) return admin as unknown as { sub: string; name: string; role: Role; loginId: string; appUser?: unknown };
  if (checkAppKey(request)) {
    const app = await getAppUser(request);
    if (!app) return null;
    return {
      sub: app.user.id,
      name: app.user.name,
      role: "app" as Role,
      loginId: app.user.username ?? app.user.id,
      appUser: app.user,
      appSession: app.session,
    } as unknown as { sub: string; name: string; role: Role; loginId: string; appUser: Record<string, unknown> };
  }
  return null;
}

// ---------- Scoped-write helpers (app role) ----------
// Only these banner fields may be set by the app; seller identity + status
// are derived server-side from the Bearer user.
const STOREFRONT_BANNER_APP_FIELDS = new Set(["title", "subtitle", "ctaLabel", "imageUrl", "imageIndex", "size", "position"]);

const SELLER_APP_FIELDS = new Set([
  "businessName",
  "ownerName",
  "logo",
  "email",
  "phone",
  "address",
  "category",
  "storeLat",
  "storeLng",
  "storeAddress",
  "taxId",
  "documents",
  // CKYC identity binding from the become-a-seller wizard (issue: the app
  // sent pan/bankAccount for months and the whitelist silently stripped them).
  "idType",
  "idNumber",
  "nameOnId",
  "dob",
  "pan",
  "bankAccount",
  "selfieUrl",
]);

function sanitizeStorefrontBannerForApp(
  raw: Record<string, unknown>,
  appUser: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STOREFRONT_BANNER_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const username = String(appUser.username ?? appUser.phone ?? appUser.id ?? "").trim();
  const businessName = String(appUser.businessName ?? appUser.name ?? username).trim();
  out.sellerUsername = username;
  out.sellerName = businessName;
  out.status = "active";
  if (typeof out.title === "string") out.title = String(out.title).trim();
  return out;
}

// Server-side KYC format validation (mirrors the wizard regexes): client
// checks are display-only by construction, so an app-key POST with
// idNumber "000000000000" used to enter the review queue past every gate.
// Validate-if-present (no new required-field 400s for legacy callers).
function kycFormatError(out: Record<string, unknown>): string | null {
  const idType = String(out.idType ?? "").trim().toLowerCase();
  const num = String(out.idNumber ?? "").trim().toUpperCase();
  if (num) {
    if (idType === "aadhaar" || (!idType && /^\d+$/.test(num))) {
      if (!/^\d{12}$/.test(num) || /^(\d)\1{11}$/.test(num)) return "Invalid Aadhaar number";
    } else if (idType === "pan") {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(num)) return "Invalid PAN format";
    } else if (idType === "passport") {
      if (!/^[A-Z][0-9]{7}$/.test(num)) return "Invalid passport format";
    }
  }
  const pan = String(out.pan ?? "").trim().toUpperCase();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "Invalid PAN format";
  const bank = String(out.bankAccount ?? "").trim();
  if (bank && !/^\d{9,18}$/.test(bank)) return "Invalid bank account number";
  // GSTIN rides taxId (business sellers only; individuals leave it unset and
  // the create lane defaults PENDING-KYC). A present non-default taxId IS a
  // GSTIN attempt — the old check read out.gstin, a field nothing sends, so
  // it never fired and garbage taxIds entered the queue.
  const tax = String(out.taxId ?? "").trim().toUpperCase();
  if (tax && tax !== "PENDING-KYC" && !/^[0-9A-Z]{15}$/.test(tax)) return "Invalid GSTIN format";
  return null;
}

function sanitizeSellerForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>, forUpdate = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SELLER_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  // Phone/email prefer the verified token identity when present.
  const tokenPhone = String((appUser as { phone?: unknown }).phone ?? "").replace(/\D/g, "");
  if (tokenPhone) out.phone = tokenPhone;
  else if (typeof out.phone === "string") out.phone = String(out.phone).replace(/\D/g, "");
  const tokenEmail = String((appUser as { email?: unknown }).email ?? "").trim();
  if (tokenEmail && !out.email) out.email = tokenEmail;
  // Updates must NEVER touch verification state: the shared sanitizer used to
  // force kycStatus/gstStatus pending on every PATCH, so any profile edit by
  // an approved seller silently threw them back into the review queue (and
  // zeroed score/counters). Create-lane forcing stays below.
  delete (out as Record<string, unknown>).kycStatus;
  delete (out as Record<string, unknown>).gstStatus;
  if (!forUpdate) {
    // Force server-controlled verification state - app can never self-approve.
    out.kycStatus = "pending";
    out.gstStatus = "pending";
  }
  // Never trust client-supplied scores or counters.
  delete (out as Record<string, unknown>).score;
  delete (out as Record<string, unknown>).productsCount;
  delete (out as Record<string, unknown>).totalSales;
  delete (out as Record<string, unknown>).rating;
  delete (out as Record<string, unknown>).reviewCount;
  // Server-side defaults for required Seller columns the app never supplies.
  // (Previously a bare KYC submission 500'd: Prisma "Argument logo is missing".)
  // Create-lane ONLY: on update these would backfill blanks over real data
  // (and zero score/counters on every profile edit).
  if (!forUpdate) {
    const fallbackName = String(appUser.name ?? appUser.username ?? "New Seller").trim() || "New Seller";
    if (!String(out.businessName ?? "").trim()) out.businessName = fallbackName;
    if (!String(out.ownerName ?? "").trim()) out.ownerName = fallbackName;
    if (!String(out.logo ?? "").trim()) out.logo = "";
    if (!String(out.email ?? "").trim()) out.email = `${String(appUser.username ?? "user").trim() || "user"}@susej.app`;
    if (!String(out.phone ?? "").trim()) out.phone = tokenPhone;
    if (!String(out.address ?? "").trim()) out.address = String(appUser.location ?? "India").trim() || "India";
    if (!String(out.taxId ?? "").trim()) out.taxId = "PENDING-KYC";
    out.score = 0;
    out.productsCount = 0;
    out.joinedAt = new Date().toISOString();
    out.submittedAt = new Date().toISOString();
  }
  // Clamp id to the caller's identity so one user cannot overwrite another's row.
  const username = String(appUser.username ?? "").trim();
  if (username) out.id = `app_${username}`;
  return out;
}

// Withdrawals are no longer app-mirrorable: payout requests are born ONLY in
// the transactional /api/app/wallet POST (see app/wallet/route.ts), where the
// wallet debit and the Withdrawal desk row commit atomically. The old mirror
// path could create a "payout request" with no debit behind it — free money.

function sanitizePromotionForApp(
  raw: Record<string, unknown>,
  appUser: Record<string, unknown>,
): Record<string, unknown> {
  // Strict whitelist: only metadata the app mirror may set.
  // CRITICAL: status is forced to "pending" — the feed reads ACTIVE rows.
  // A client-mirrored row can therefore NEVER produce a paid placement
  // (Top Seller / Hot Deal / Sponsored). Real placements are ACTIVE only via
  // the payment engine (checkout → confirm → activatePromotion).
  // durationDays / endsAt / startsAt / amountPaid / checkoutRef / providerPaymentId
  // are all server-minted and NEVER client-settable here.
  const PROMO_APP_FIELDS = new Set([
    "kind", "packageName", "postId", "postTitle", "postImage",
    "postExcerpt", "productId", "sellerLogo",
  ]);
  const out: Record<string, unknown> = {};
  for (const k of PROMO_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const username = String(appUser.username ?? "").trim();
  const sellerName = String(appUser.businessName ?? appUser.name ?? username).trim();
  if (username) out.sellerId = username;
  if (sellerName) out.sellerName = sellerName;
  out.status = "pending";
  out.provider = "app";
  delete (out as Record<string, unknown>).isPinned;
  delete (out as Record<string, unknown>).providerPaymentId;
  delete (out as Record<string, unknown>).amountPaid;
  delete (out as Record<string, unknown>).currency;
  delete (out as Record<string, unknown>).checkoutRef;
  delete (out as Record<string, unknown>).startsAt;
  delete (out as Record<string, unknown>).endsAt;
  delete (out as Record<string, unknown>).createdAt;
  delete (out as Record<string, unknown>).durationDays;
  delete (out as Record<string, unknown>).discountedPrice;
  delete (out as Record<string, unknown>).provider;
  return out;
}

function sanitizeOrderForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  // Strict whitelist: app mirror may only set buyer-facing placement fields.
  // Everything else (amount, payment, delivery, seller binding, status) is
  // server-controlled via /api/app/orders.
  // sellerUsername is EXCLUDED: order-to-seller binding is server-authoritative
  // (resolved from the listing owner in /api/app/orders), not settable here.
  // trackingNumber/orderNumber/sellerName are EXCLUDED too: attacker-picked
  // tracking collides idempotency titles across distinct orders, and display
  // names are server-resolved (mirror rows must never spoof the admin queue).
  const ALLOWED = new Set(["items", "itemsList", "shippingAddress", "address", "label", "type", "name", "phone", "street", "city", "paymentMethod"]);
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) out[k] = raw[k];
  const buyerName = String(appUser.name ?? appUser.username ?? "").trim();
  const buyerUsername = String(appUser.username ?? "").trim();
  if (buyerName) out.buyerName = buyerName;
  if (buyerUsername) out.buyerUsername = buyerUsername;
  // Amount/paymentStatus are server-trusted via /api/app/orders - never from mirror.
  delete (out as any).amount;
  delete (out as any).paymentStatus;
  delete (out as any).deliveryStatus;
  delete (out as any).status;
  // Only placed is allowed via mirror, and we force it.
  out.status = "placed";
  out.deliveryStatus = "awaiting_shipment";
  // Prevent sellerUsername spoof to funnel orders to attacker account:
  // only accept sellerUsername that resolves to a real seller row (checked in
  // POST/PATCH ownership guard below) - otherwise leave as client value.
    return out;
}

// ── App-scoped sanitizers for tickets, messages, refunds ──
// These were previously missing — app role fell through to raw `data`/`body`,
// allowing arbitrary field injection on support tickets, chat messages and
// refunds. Now every app-write resource has a strict whitelist.
const TICKET_APP_FIELDS = new Set(["id", "subject", "priority", "createdAt"]);
function sanitizeTicketForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TICKET_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const userName = String(appUser.name ?? appUser.username ?? "").trim();
  if (userName) out.userName = userName;
  // status/assignee are desk-owned and never app-settable (callers filed
  // pre-closed tickets and spoofed staff assignment). Creation forces
  // status open in the POST branch below; PATCH can no longer touch either.
  return out;
}

// senderRole is desk-owned: app messages always render as the user bubble.
// (Previously whitelisted, so an app-key POST with senderRole:"agent" rendered
// as a staff reply on the support + live-chat desks.)
const MESSAGE_APP_FIELDS = new Set(["threadId", "sender", "body", "createdAt"]);
function sanitizeMessageForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of MESSAGE_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const userName = String(appUser.name ?? appUser.username ?? "").trim();
  if (userName) out.sender = userName;
  return out;
}

// Timestamps are server-owned: requestedAt is stamped at creation, and
// respondedAt only ever moves via the desk decision machines (a client-set
// respondedAt backdated the queue cosmetics).
const REFUND_APP_FIELDS = new Set(["id", "orderRef", "reason"]);
function sanitizeRefundForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of REFUND_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const userName = String(appUser.name ?? appUser.username ?? "").trim();
  if (userName) out.buyerName = userName;
  // The app may only REQUEST a refund — status and amount are server-owned.
  // (Previously a buyer could POST status:'approved' + an arbitrary amount,
  // inflating finance tiles and skipping the request state. Decisions run
  // through PATCH /api/app/orders/[id] {refundDecision}, seller-only.)
  out.status = "requested";
  out.amount = 0;
  // sellerName is server-derived from the order, not client-settable here.
  return out;
}

function cleanAdminInput(
  data: Record<string, unknown>,
  role: Role,
  isCreate: boolean,
  session: { id: string; loginId: string }
): Record<string, unknown> | NextResponse {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_ADMIN_FIELDS.includes(key as (typeof SENSITIVE_ADMIN_FIELDS)[number])) continue;
    if (key === "id" && !isCreate) continue;
    out[key] = value;
  }
  if (typeof out.password === "string" && out.password) {
    if (out.password.length < 8) return forbidden("Password must be at least 8 characters.");
    out.passwordHash = hashPassword(out.password);
  } else if (isCreate) {
    return forbidden("password is required");
  }
  delete out.password;
  if (isCreate && out.loginId === session.loginId) {
    return forbidden("loginId conflicts with your own account.");
  }
  if (out.role && role !== "super_admin") {
    out.role = "manager";
  }
  if (out.status && !["active", "inactive"].includes(String(out.status))) {
    out.status = "active";
  }
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  // Live Admin row (same rule as writes): banned/demoted sessions lose reads
  // on the next request, not at next login.
  const { getActiveAdmin } = await import("@/lib/auth");
  const session = await getActiveAdmin(request).catch(() => null);
  if (!session) return unauthorized();
  const role = normalizeRole(session.role as string);
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!readAllowed(resource, role)) return forbidden();

  // Optional server-side pagination / filtering (industry: never return entire table unbounded).
  // Query: ?q=search &status= &take=&skip= or ?page=&limit= &orderBy=&orderDir=asc|desc
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const statusFilter = url.searchParams.get("status")?.trim() ?? "";
  // Single-row fetch for detail pages (?id=): exact row, no table scan.
  // Detail desks must use this — full-table loads false-negative past 100 rows.
  const idFilter = url.searchParams.get("id")?.trim() ?? "";
  const takeRaw = url.searchParams.get("take") ?? url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? "";
  const skipRaw = url.searchParams.get("skip") ?? url.searchParams.get("offset") ?? "";
  const pageRaw = url.searchParams.get("page") ?? "";
  // Full-book export mode (?export=1): the Export Center needs the whole
  // table for finance reconciliation, not the 100-row desk window. Cap 5000
  // (bounded — never unbounded), same read-ACL as the desk. Desk browsing
  // stays capped at 100.
  const exportMode = url.searchParams.get("export") === "1";
  const TAKE_MAX = exportMode ? 5000 : 100;
  const orderByKey = url.searchParams.get("orderBy") ?? url.searchParams.get("sortBy") ?? url.searchParams.get("sort") ?? "";
  const orderDir = (url.searchParams.get("orderDir") ?? url.searchParams.get("sortDir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  let take = takeRaw ? Math.min(Math.max(parseInt(takeRaw, 10) || 0, 1), TAKE_MAX) : 0;
  let skip = skipRaw ? Math.max(parseInt(skipRaw, 10) || 0, 0) : 0;
  if (!skipRaw && pageRaw && take) {
    const page = Math.max(parseInt(pageRaw, 10) || 1, 1);
    skip = (page - 1) * take;
  }
  const SEARCH_FIELDS: Record<string, string[]> = {
    products: ["title", "category", "status"],
    orders: ["id", "buyerName", "sellerName", "buyerUsername", "sellerUsername", "status"],
    users: ["name", "email", "username", "phone"],
    sellers: ["businessName", "ownerName", "email", "phone", "category"],
    categories: ["name", "slug"],
    reviews: ["reviewerName", "text"],
    communities: ["name", "description"],
    tickets: ["subject", "userName"],
    // Money queues (server-searchable — client-side filtering of the loaded
    // 100 used to make rows past the window unfindable from the desk):
    disputes: ["orderId", "buyerName", "sellerName", "reason", "status"],
    refunds: ["orderRef", "buyerName", "sellerName", "reason", "status"],
    withdrawals: ["id", "userName", "method", "status"],
    promotions: ["packageName", "sellerId", "sellerName", "status"],
    coupons: ["code", "type", "status"],
    ledger: ["partyName", "partyRole", "type", "status", "orderId"],
  };
  const fields = SEARCH_FIELDS[resource] ?? [];
  const where: Record<string, unknown> = {};
  // Sellers track verification in kycStatus (no `status` column): map the
  // generic ?status= filter so the ops-critical Pending Queue can page the
  // server instead of filtering the first 100 rows in memory (row 101+
  // pendings were invisible).
  if (statusFilter) {
    if (resource === "sellers") (where as any).kycStatus = statusFilter;
    else (where as any).status = statusFilter;
  }
  if (q && fields.length) {
    (where as any).OR = fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
  }
  const orderBy = orderByKey ? { [orderByKey]: orderDir } : undefined;
  // skip-without-take used to pull the WHOLE table (hasPagination true, but
  // the `if (take)` guard applied neither) — default the page when skipping.
  if (skip > 0 && take === 0) take = 100;
  // Unvalidated sort keys threw inside Prisma and misreported as 503
  // "Database unavailable". Shape-guard the key; unknown fields 400.
  const ORDER_BY_ALLOW = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  if (orderByKey && !ORDER_BY_ALLOW.test(orderByKey)) {
    return NextResponse.json({ error: "Invalid sort field" }, { status: 400 });
  }
  const hasPagination = take > 0 || skip > 0 || !!q || !!statusFilter || !!orderByKey;

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      await lazySweep();
      // Transactions: the legacy `Transaction` table is an empty pre-launch
      // model (0 rows) — the REAL money movements live in WalletTransaction
      // (every debit/credit the engine writes). Serve those, projected onto
      // the Transaction shape the finance surfaces render. Derivation is
      // explicit: type from title taxonomy, method always wallet (true —
      // these are wallet ledger rows), status success (settled movements;
      // pending states live in the withdrawals/refunds queues).
      if (resource === "transactions") {
        const wTake = take || 500;
        const [wt, wTotal] = await Promise.all([
          prisma.walletTransaction.findMany({ orderBy: { ts: "desc" }, take: wTake, skip }),
          prisma.walletTransaction.count(),
        ]);
        const toType = (title: string): string => {
          const t = String(title ?? "");
          if (/^withdrawal to (bank|upi)/i.test(t)) return "withdrawal";
          if (/^order cancelled - refund/i.test(t)) return "refund";
          if (/^order earnings/i.test(t) || /clawback/i.test(t)) return "settlement";
          return "payment";
        };
        const wRows = (wt as Record<string, unknown>[]).map((w) => ({
          id: String(w.id ?? ""),
          userName: String(w.username ?? ""),
          type: toType(String(w.title ?? "")),
          amount: Number(w.amount ?? 0),
          method: "wallet",
          gateway: "internal",
          reference: String(w.detail ?? ""),
          status: "success",
          createdAt: w.ts instanceof Date ? w.ts.toISOString() : String(w.ts ?? ""),
        }));
        if (hasPagination) return NextResponse.json({ rows: wRows, total: wTotal, skip, take: take || wRows.length });
        return NextResponse.json({ rows: wRows });
      }
      // Merge EXTENDED include/select with pagination where/orderBy
      const base = (EXTENDED[resource] ?? {}) as Record<string, unknown>;
      const findArgs: Record<string, unknown> = { ...base };
      if (idFilter) {
        // Single-row mode: primary-key lookup + EXTENDED shape, total: 1/0.
        // findFirst (not findUnique) so non-unique key configs can't 500.
        const one = await prisma[PRISMA_MODELS[resource]].findFirst({
          ...((base as Record<string, unknown>) ?? {}),
          where: { [PRIMARY_KEY[resource] ?? "id"]: idFilter },
        });
        const rowsOut = one ? (serialize([one], resource) as Record<string, unknown>[]) : [];
        return NextResponse.json({ rows: rowsOut, total: rowsOut.length });
      }
      if (Object.keys(where).length) findArgs.where = where;
      if (orderBy) findArgs.orderBy = orderBy;
      else if (!hasPagination && (base as any).orderBy === undefined) {
        // default recent-first for known timestamp fields
        if (["orders", "users", "sellers", "products", "reviews", "audit-logs"].includes(resource)) {
          // let DB default or fallback to createdAt desc if field exists — safe to omit
        }
      }
      if (take) { findArgs.take = take; findArgs.skip = skip; }
      const list = hasPagination
        ? await prisma[PRISMA_MODELS[resource]].findMany(findArgs)
        : await prisma[PRISMA_MODELS[resource]].findMany(EXTENDED[resource] ?? {});
      let rowsOut = serialize(list, resource) as Record<string, unknown>[];
      // Finance PII minimization: payout clerks need seller identity +
      // payee destination (resolved above for withdrawals), never KYC
      // internals (PAN/DOB/ID numbers/bank numbers/selfies). Stripped
      // server-side — page-level hiding alone would leave the API door open.
      if (resource === "sellers" && role === "finance") {
        const PII = ["idNumber", "nameOnId", "dob", "pan", "bankAccount", "selfieUrl", "idType"];
        rowsOut = rowsOut.map((r) => {
          const copy = { ...r };
          for (const k of PII) delete copy[k];
          return copy;
        });
      }
      // Withdrawals: destination resolution (read-time join, no schema
      // change). New rows carry `· to <destination>` in their
      // walletTransaction detail (written atomically at payout). Legacy bank
      // rows resolve to the KYC-verified Seller.bankAccount on file; legacy
      // UPI rows predate destination capture and say so honestly instead of
      // inventing a VPA. The finance clerk always knows WHERE money goes.
      if (resource === "withdrawals" && rowsOut.length) {
        try {
          const names = [...new Set(rowsOut.map((r) => String((r as any).userName ?? "")).filter(Boolean))];
          const txs = names.length
            ? ((await prisma.walletTransaction.findMany({
                where: { username: { in: names } },
                orderBy: { ts: "desc" },
                take: 500,
                select: { username: true, detail: true },
              })) as Array<{ username?: unknown; detail?: unknown }>)
            : [];
          const byUser = new Map<string, Array<{ detail: string }>>();
          for (const t of txs) {
            const u = String(t.username ?? "");
            if (!u) continue;
            const arr = byUser.get(u) ?? [];
            arr.push({ detail: String(t.detail ?? "") });
            byUser.set(u, arr);
          }
          // Batched KYC join (was N+1: 2 queries per row): one users pull +
          // one stable-id sellers pull + one legacy contact pull, joined in
          // memory. Stable app_<username> rows win (contact changes must not
          // orphan payouts — same rule as the payout route itself).
          const users = names.length
            ? ((await prisma.user.findMany({
                where: { username: { in: names } },
                select: { username: true, email: true, phone: true },
              }).catch(() => [])) as Array<{ username: string; email?: unknown; phone?: unknown }>)
            : [];
          const userByName = new Map(users.map((u) => [String(u.username), u]));
          const stableIds = names.map((n) => `app_${n}`);
          const stableRows = names.length
            ? ((await prisma.seller.findMany({
                where: { id: { in: stableIds } },
                select: { id: true, bankAccount: true },
              }).catch(() => [])) as Array<{ id: string; bankAccount?: unknown }>)
            : [];
          const stableByName = new Map<string, string>();
          for (const s of stableRows) {
            const acct = String(s?.bankAccount ?? "").replace(/\D/g, "");
            if (acct) stableByName.set(String(s.id).replace(/^app_/, ""), acct);
          }
          const emails = users.map((u) => String(u.email ?? "")).filter(Boolean);
          const phones = users.map((u) => String(u.phone ?? "")).filter(Boolean);
          const legacyOrs: Array<Record<string, unknown>> = [
            ...emails.map((e) => ({ email: e })),
            ...phones.map((p) => ({ phone: p })),
          ];
          const legacyRows = legacyOrs.length
            ? ((await prisma.seller.findMany({
                where: { OR: legacyOrs },
                select: { email: true, phone: true, bankAccount: true },
              }).catch(() => [])) as Array<{ email?: unknown; phone?: unknown; bankAccount?: unknown }>)
            : [];
          const legacyAcctFor = (userName: string): string => {
            const u = userByName.get(userName);
            if (!u) return "";
            const email = String(u.email ?? "");
            const phone = String(u.phone ?? "");
            const hit =
              legacyRows.find((s) => email && String(s.email ?? "") === email) ??
              legacyRows.find((s) => phone && String(s.phone ?? "") === phone);
            return String(hit?.bankAccount ?? "").replace(/\D/g, "");
          };
          rowsOut = rowsOut.map((r) => {
            const id = String((r as any).id ?? "");
            const method = String((r as any).method ?? "");
            const userName = String((r as any).userName ?? "");
            let destination = "";
            const mine = byUser.get(userName) ?? [];
            // Exact-prefix match (VPA-embed class): substring could pair the
            // row with another payout's debit and show the wrong destination.
            const hit = mine.find((t) => t.detail.startsWith(`Payout request ${id} `));
            const m = hit ? hit.detail.match(/· to (.+)$/) : null;
            if (m) destination = m[1].trim();
            if (!destination && method === "bank" && userName) {
              const acct = stableByName.get(userName) || legacyAcctFor(userName);
              if (acct) destination = `KYC account ••••${acct.slice(-4)}`;
            }
            if (!destination) {
              destination =
                method === "upi"
                  ? "not recorded — confirm VPA with seller before paying"
                  : "no verified account on file";
            }
            return { ...r, destination };
          });
        } catch {}
      }
      // Categories: productCount is COMPUTED from real Product rows — the stored
      // column is legacy seed residue and must never be echoed (it held fake numbers).
      if (resource === "categories") {
        try {
          const counts = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } });
          const map = new Map<string, number>();
          for (const g of counts) map.set(String(g.category).toLowerCase(), g._count._all);
          rowsOut = rowsOut.map((r) => {
            const name = String(r.name ?? "").toLowerCase();
            const slug = String(r.slug ?? "").toLowerCase();
            const computed = (map.get(name) ?? 0) + (name !== slug ? map.get(slug) ?? 0 : 0);
            return { ...r, productCount: computed };
          });
        } catch {
          // count query failed — fall through with stored values rather than fabricating
        }
      }
      // Sellers: products count is COMPUTED from real Product rows — the stored
      // column is stale after Post→Product mirroring (was 0 for all). Live count
      // matches the Product table grouped by sellerName so admin sees the same
      // inventory the buyer feed does. Product.sellerName is "Display Name (@handle)"
      // while Seller.businessName is "Display Name" — strip the handle for matching.
      if (resource === "sellers") {
        try {
          const counts = await prisma.product.groupBy({ by: ["sellerName"], _count: { _all: true } });
          const map = new Map<string, number>();
          for (const g of counts) {
            const raw = String(g.sellerName).toLowerCase().trim();
            const base = raw.split("(")[0].trim(); // "riya threadz (@handle)" -> "riya threadz"
            const handleMatch = raw.match(/@([^\)]+)\)/);
            const handle = handleMatch ? handleMatch[1].trim() : "";
            map.set(raw, g._count._all);
            if (base) map.set(base, (map.get(base) ?? 0) + g._count._all);
            if (handle) map.set(handle, (map.get(handle) ?? 0) + g._count._all);
            if (handle) map.set("@" + handle, (map.get("@" + handle) ?? 0) + g._count._all);
          }
          rowsOut = rowsOut.map((r) => {
            const name = String((r as any).businessName ?? (r as any).name ?? "").toLowerCase().trim();
            const owner = String((r as any).ownerName ?? "").toLowerCase().trim();
            const username = String((r as any).username ?? "").toLowerCase().trim();
            // id like app_user0011 -> handle user0011
            const idHandle = String((r as any).id ?? "").replace(/^app_/, "").toLowerCase().trim();
            const computed = map.get(name) ?? map.get(owner) ?? map.get(username) ?? map.get("@" + username) ?? map.get(idHandle) ?? map.get("@" + idHandle) ?? 0;
            return { ...r, products: computed, productsCount: computed, productCount: computed };
          });
        } catch {
          // fall through
        }
      }
      if (hasPagination) {
        // Also return total for client pagination UI when paginated
        try {
          const total = await prisma[PRISMA_MODELS[resource]].count({ where: Object.keys(where).length ? where : undefined });
          return NextResponse.json({ rows: rowsOut, total, skip, take: take || rowsOut.length });
        } catch {}
      }
      return NextResponse.json({ rows: rowsOut });
    } catch (e: unknown) {
      // A well-formed key that is NOT a model field still throws inside
      // Prisma — report 400 (bad sort), never 503 "Database unavailable".
      const msg = e instanceof Error ? e.message : String(e);
      if (orderByKey && /orderBy|Unknown (field|argument)|Invalid (field|value)|validation/i.test(msg)) {
        return NextResponse.json({ error: "Invalid sort field" }, { status: 400 });
      }
      // DB error — report honestly instead of echoing demo rows
    }
  }

  return NextResponse.json({ rows: [], error: "Database unavailable" });
}

// Simple in-memory rate limiter for write endpoints (per-IP, per-minute).
const writeRateMap = new Map<string, { count: number; resetAt: number }>();
function checkWriteRate(ip: string, limit = 60): boolean {
  const now = Date.now();
  const entry = writeRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    writeRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function validateResourcePayload(resource: string, data: Record<string, unknown>): string | null {
  // Allow-list status values per resource (industry: no arbitrary status injection).
  // deleted/hidden are soft-delete states — allowed so DELETE can map to an update.
  const statusAllow: Record<string, Set<string>> = {
    products: new Set(["active", "featured", "hidden", "pending", "approved", "rejected", "deleted"]),
    orders: new Set(["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled", "deleted"]),
    sellers: new Set(["pending", "approved", "rejected", "suspended", "deleted"]),
    users: new Set(["active", "inactive", "suspended", "banned", "deleted"]),
    categories: new Set(["active", "hidden", "deleted"]),
    // Unified payout state machine (see PATCH transition guard below).
    withdrawals: new Set(["requested", "approved", "rejected", "completed"]),
    coupons: new Set(["active", "disabled", "expired", "deleted"]),
    // Disputes: open → under_review → resolved is the only forward path (the
    // one-way resolved guard below refuses re-resolve; arbitrary strings would
    // reopen the cross-outcome double-pay hole).
    disputes: new Set(["open", "under_review", "resolved", "closed", "rejected"]),
  };
  if (typeof data.status === "string" && statusAllow[resource] && !statusAllow[resource].has(String(data.status))) {
    return `Invalid status '${data.status}' for ${resource}`;
  }
  // Price/amount must be finite non-negative.
  if (data.price !== undefined) {
    const n = Number(data.price);
    if (!Number.isFinite(n) || n < 0) return "price must be a non-negative number";
  }
  if (data.amount !== undefined) {
    const n = Number(data.amount);
    if (!Number.isFinite(n) || n < 0) return "amount must be a non-negative number";
  }
  // Coupon money validation (server-side, Shopify/Amazon rule): percent
  // clamped 1–90 (settlement fail-closes above 100), fixed > 0, usageLimit
  // >= 1 (a 0-limit row is dead on arrival — intelligence-guard violation),
  // type allow-listed to the settlement vocab. The desk form mirrors these.
  if (resource === "coupons") {
    const allowedTypes = new Set(["percent", "percentage", "flat", "fixed", "free_delivery"]);
    if (data.type !== undefined && !allowedTypes.has(String(data.type))) {
      return `Invalid coupon type '${data.type}' — use percent, flat, fixed, or free_delivery`;
    }
    if (data.value !== undefined) {
      const v = Number(data.value);
      if (!Number.isFinite(v) || v <= 0) return "Coupon value must be greater than 0";
      const t = data.type !== undefined ? String(data.type) : undefined;
      if ((t === "percent" || t === "percentage") && v > 90) {
        return "Percentage coupons are capped at 90%";
      }
    }
    if (data.usageLimit !== undefined) {
      const u = Number(data.usageLimit);
      if (!Number.isInteger(u) || u < 1) return "usageLimit must be an integer >= 1";
    }
    if (data.usedCount !== undefined) {
      const u = Number(data.usedCount);
      if (!Number.isInteger(u) || u < 0) return "usedCount must be an integer >= 0";
    }
  }
  // Commission money validation (server-side, UI clamp bypass close): rates
  // are percents 0–30 (normalizeCommissionRate caps 100% — a 999 rate would
  // zero every seller payout; negatives zero the platform). Overrides carry
  // the same bounds with no duplicate categories.
  if (resource === "commission") {
    if (data.commissionRate !== undefined) {
      const r = Number(data.commissionRate);
      if (!Number.isFinite(r) || r < 0 || r > 30) return "commissionRate must be a percent between 0 and 30";
    }
    if (data.payoutFee !== undefined) {
      const f = Number(data.payoutFee);
      if (!Number.isFinite(f) || f < 0 || f > 1000) return "payoutFee must be between 0 and 1000";
    }
    if (data.categoryOverrides !== undefined) {
      if (!Array.isArray(data.categoryOverrides)) return "categoryOverrides must be an array";
      const seen = new Set<string>();
      for (const o of data.categoryOverrides as Array<{ category?: unknown; rate?: unknown }>) {
        const c = String(o?.category ?? "").trim().toLowerCase();
        const r = Number(o?.rate);
        if (!c) return "categoryOverrides entries need a category";
        if (seen.has(c)) return `Duplicate category override '${o?.category}'`;
        seen.add(c);
        if (!Number.isFinite(r) || r <= 0 || r > 30) return `Override rate for '${o?.category}' must be a percent between 0 and 30`;
      }
    }
  }
  return null;
}

/**
 * Refund state machine + settlement (single implementation for every desk:
 * the Refunds queue AND the order-detail refund panel). Transitions:
 *   requested → approved | rejected | refunded   (refunded in one step is
 *     super_admin break-glass only)
 *   approved  → refunded | rejected
 * Approving/refunding settles the wallet legs idempotently (buyer re-credit
 * + seller clawback keyed by tracking titles) + immutable ledger reversals.
 * Returns { ok:true } or { ok:false, error, status } — callers must not
 * change any display field when settlement fails.
 */
async function transitionRefund(
  prisma: any,
  refundId: string,
  nextStatus: string,
  opts: { actor: string; superAdmin: boolean; override?: boolean; ip?: string }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const fail = (error: string, status: number) => ({ ok: false as const, error, status });
  // Read-only validations run outside the money tx (no locks held during
  // maker-checker reads). The money path below re-reads everything AFTER
  // acquiring the order lock, so concurrent executions serialize properly.
  const row0 = await prisma.refund.findUnique({ where: { id: String(refundId) } });
  if (!row0) return fail("Refund not found", 404);
  const rawCurrent0 = String(row0.status ?? "requested");
  const okTransition0 =
    (rawCurrent0 === "requested" && ["approved", "rejected", "refunded"].includes(nextStatus)) ||
    (rawCurrent0 === "approved" && ["refunded", "rejected"].includes(nextStatus));
  if (!okTransition0) {
    return fail(
      `Invalid refund transition '${rawCurrent0}' -> '${nextStatus}'. Allowed: requested→approved/rejected/refunded, approved→refunded/rejected.`,
      409
    );
  }
  if (rawCurrent0 === "requested" && nextStatus === "refunded" && !opts.superAdmin) {
    return fail("Mark approved first — only a Super Admin may refund in one step.", 409);
  }
  if (nextStatus === "refunded") {
    const block = await makerCheck(prisma, "refunds", String(row0.id), opts.actor, {
      superAdmin: opts.superAdmin,
      override: opts.override,
    });
    if (block) return fail(block, 409);
  }
  // Non-money terminal states settle nothing — plain update, no lock needed.
  if (nextStatus !== "approved" && nextStatus !== "refunded") {
    await prisma.refund.update({
      where: { id: String(row0.id) },
      data: { status: nextStatus, respondedAt: new Date().toISOString() },
    });
    return { ok: true };
  }
  // Money path: ONE interactive tx + order-row lock. Concurrent executions
  // (same-path double-submit, cross-path cancel-vs-approve-vs-dispute) block
  // on the lock until the first COMMITS, then their count-guards observe the
  // first execution's titles and settle nothing twice.
  try {
    return await prisma.$transaction(async (tx: any) => {
      const row = await tx.refund.findUnique({ where: { id: String(refundId) } });
      if (!row) return fail("Refund not found", 404);
      const rawCurrent = String(row.status ?? "requested");
      const okTransition =
        (rawCurrent === "requested" && ["approved", "refunded"].includes(nextStatus)) ||
        (rawCurrent === "approved" && ["refunded"].includes(nextStatus));
      if (!okTransition) {
        return fail(
          `Invalid refund transition '${rawCurrent}' -> '${nextStatus}'. Already decided by a concurrent execution.`,
          409
        );
      }
      const tracking = String(row.orderRef ?? "").trim();
      if (tracking) {
        const order = await tx.order.findFirst({ where: { trackingNumber: tracking } });
        if (order) {
          // Serialization point: every money execution for this order —
          // desk refund/approve, staff cancel/deliver, dispute ruling,
          // shipment deliver — locks this row first (same helper text).
          await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, order.id);
          // Route every db call below through the locked tx (shadow): the
          // guard-reads and leg-writes serialize as one unit, so a concurrent
          // execution blocks until this COMMITS and then observes its titles.
          const prisma = tx;
          const method = String(order.paymentMethod ?? "");
          const isCod = /cash|cod/i.test(method);
          const paysWallet = method.toLowerCase() === "wallet";
          const refundTitle = `Order refund · ${tracking}`;
          const clawTitle = `Order refund clawback · ${tracking}`;
          // Cross-path guard (API-H1): cancel/app/dispute refunds for the same
          // order already settled — never pay twice on the desk path.
          const alreadyRefunded = await prisma.walletTransaction.count({
            where: {
              username: order.buyerUsername,
              title: {
                in: [
                  refundTitle,
                  `Order cancelled - refund · ${tracking}`,
                  `Dispute refund · ${tracking}`,
                  `Dispute split refund · ${tracking}`,
                ],
              },
            },
          });
          if (paysWallet && !alreadyRefunded && order.buyerUsername && order.amount > 0) {
            const buyer = await prisma.user.findUnique({ where: { username: order.buyerUsername } }).catch(() => null);
            if (buyer) {
              await prisma.user.update({ where: { id: buyer.id }, data: { walletBalance: { increment: order.amount } } });
              await prisma.walletTransaction.create({
                data: { username: order.buyerUsername, title: refundTitle, detail: `Refund approved for order ${tracking}`, amount: order.amount },
              });
              // Loud + count-guarded (never swallowed, never doubled): a
              // mirror failure 503s with status unchanged, and the title
              // guards above make the retry safe.
              const mirrored = await prisma.ledgerEntry.count({
                where: { orderId: order.id, type: "reversal", direction: "in", status: "success" },
              });
              if (!mirrored) {
                await prisma.ledgerEntry.createMany({
                  data: [{ partyName: order.buyerName, partyRole: "buyer", direction: "in", type: "reversal", amount: order.amount, method, status: "success", orderId: order.id, createdAt: new Date() }],
                });
              }
            }
          }
          const wasCredited = await prisma.walletTransaction.count({
            where: { username: order.sellerUsername, title: `Order earnings · ${tracking}` },
          });
          const alreadyClawed = await prisma.walletTransaction.count({
            where: {
              username: order.sellerUsername,
              title: {
                in: [
                  clawTitle,
                  `Order cancelled clawback · ${tracking}`,
                  `Dispute refund clawback · ${tracking}`,
                  `Dispute split clawback · ${tracking}`,
                ],
              },
            },
          });
          // Seller claw runs for wallet AND COD (post-delivery both were
          // credited — evidence-guarded by wasCredited, so pre-delivery rows
          // safely no-op).
          if (wasCredited && !alreadyClawed && order.sellerUsername) {
            const rate = await resolveCommissionRate(prisma);
            let basis = Number(order.amount);
            // Coupon-aware settlement basis (prefers per-line netPrice).
            const settledBasis = settlementGoodsBasis(order.itemsList);
            if (Number.isFinite(settledBasis)) basis = settledBasis;
            // Category-aware: claw EXACTLY what placement credited — persisted
            // per-line legs first, global rate only for legacy rows (M1: the
            // old global-rate math over/under-clawed override-category orders).
            const legFee = settledFeeFromLegs(order.itemsList);
            const net = legFee !== null
              ? Math.max(0, Math.round(basis) - legFee)
              : Math.max(0, Math.round(basis * (1 - rate)));
            const seller = net > 0 ? await prisma.user.findUnique({ where: { username: order.sellerUsername } }).catch(() => null) : null;
            if (seller) {
              await prisma.user.update({ where: { id: seller.id }, data: { walletBalance: { decrement: net } } });
              await prisma.walletTransaction.create({
                data: { username: order.sellerUsername, title: clawTitle, detail: `Earnings reversal for refunded order ${tracking}`, amount: -net },
              });
              const clawMirrored = await prisma.ledgerEntry.count({
                where: { orderId: order.id, type: "reversal", direction: "out", status: "success" },
              });
              if (!clawMirrored) {
                await prisma.ledgerEntry.createMany({
                  data: [{ partyName: order.sellerUsername, partyRole: "seller", direction: "out", type: "reversal", amount: net, method, status: "success", orderId: order.id, createdAt: new Date() }],
                });
              }
            }
          }
          // ANY executed desk refund marks the order refunded — wallet or COD
          // (matches the app approve path; otherwise COD stays withdrawable).
          await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } });
          // Platform legs: placement booked fee-in + shipping-in; the desk
          // path stranded both (cancel/app-approve mirror them). Count-guarded
          // so books balance on every path, not just cancel. Evidence-gated:
          // pre-delivery rows never booked a fee — reversing one mints a
          // phantom OUT leg — so only reverse what actually landed as IN.
          {
            const dRate = await resolveCommissionRate(prisma);
            const dLegFee = settledFeeFromLegs(order.itemsList);
            const dSettled = settlementGoodsBasis(order.itemsList);
            const dBasis = Number.isFinite(dSettled) ? (dSettled as number) : Number(order.amount ?? 0);
            const dFeeOut = dLegFee !== null && dLegFee > 0 ? Math.round(dLegFee) : Math.max(0, Math.round(dBasis * dRate));
            const feeBooked = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "fee", direction: "in", status: "success" } });
            if (dFeeOut > 0 && feeBooked > 0) {
              const dFeeReversed = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "fee", direction: "out" } });
              if (!dFeeReversed) {
                await prisma.ledgerEntry.createMany({
                  data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: dFeeOut, method, status: "success", orderId: order.id, createdAt: new Date() }],
                });
              }
            }
            const dShipOut = Math.max(0, Math.round(Number(order.amount ?? 0)) - Math.round(dBasis));
            const shipBooked = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "shipping", direction: "in", status: "success" } });
            if (dShipOut > 0 && shipBooked > 0) {
              const dShipReversed = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "shipping", direction: "out" } });
              if (!dShipReversed) {
                await prisma.ledgerEntry.createMany({
                  data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: dShipOut, method, status: "success", orderId: order.id, createdAt: new Date() }],
                });
              }
            }
            // COD pending void (cancel/seller-approve parity): a pre-delivery
            // desk refund must not leave pending charge/shipping legs dangling
            // next to the new success reversals.
            const pendCharge = await prisma.ledgerEntry.findFirst({ where: { orderId: order.id, type: "charge", direction: "out", status: "pending" } });
            if (pendCharge) {
              const chargeVoided = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "charge", direction: "out", status: "cancelled" } });
              if (!chargeVoided && order.buyerUsername) {
                await prisma.ledgerEntry.create({
                  data: { partyName: order.buyerName, partyRole: "buyer", direction: "out", type: "charge", amount: Number((pendCharge as { amount?: unknown }).amount ?? order.amount ?? 0), method, status: "cancelled", orderId: order.id, createdAt: new Date() },
                });
              }
            }
            const pendShip = await prisma.ledgerEntry.findFirst({ where: { orderId: order.id, type: "shipping", direction: "in", status: "pending" } });
            if (pendShip) {
              const shipVoided = await prisma.ledgerEntry.count({ where: { orderId: order.id, type: "shipping", direction: "out", status: "cancelled" } });
              if (!shipVoided) {
                await prisma.ledgerEntry.create({
                  data: { partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: Number((pendShip as { amount?: unknown }).amount ?? 0), method, status: "cancelled", orderId: order.id, createdAt: new Date() },
                });
              }
            }
          }
        }
      }
      await prisma.refund.update({
        where: { id: String(row.id) },
        data: { status: nextStatus, respondedAt: new Date().toISOString() },
      });
      // Break-glass audit: an override execution must scream in the trail
      // (who, what, explicit flag, real IP) — silent overrides would launder
      // theft, and an empty IP would orphan the trail.
      if (nextStatus === "refunded" && opts.override === true) {
        await writeAuditSafe({
          action: "dual-control-override",
          entity: "refunds",
          entityId: String(row.id),
          details: `DUAL-CONTROL OVERRIDE by ${opts.actor} — executed without a prior different-admin approval (lost-trail break-glass)`,
          adminName: opts.actor,
          ip: opts.ip ?? "",
        });
      }
      return { ok: true };
    });
  } catch {
    return fail("Refund settlement failed — status not changed", 503);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const ip = getClientIp(request);
  if (!checkWriteRate(ip)) return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  const session = await parseWriteSession(request);
  if (!session) return unauthorized();
  const role = normalizeRole(session.role as string);
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  const { id, data, reason } = (await request.json()) as { id: string; data: Record<string, unknown>; reason?: unknown };
  if (!id || typeof data !== "object" || data === null) {
    return NextResponse.json({ error: "id and data are required" }, { status: 400 });
  }
  // Paid-rail content is engine-owned: manager/finance may flip status (the
  // fraud kill-switch) but never rewrite paid content (price/name/priority).
  // Super_admin break-glass only, audited.
  {
    const PAID_RAILS = new Set(["top-sellers", "hot-deals", "featured-posts", "spotlights"]);
    if (PAID_RAILS.has(resource) && (role === "manager" || role === "finance" || role === "moderator")) {
      const keys = Object.keys(data);
      if (!keys.length || keys.some((k) => k !== "status")) {
        return NextResponse.json({ error: "Paid rails are engine-owned — staff can hide/show rows, not rewrite them." }, { status: 403 });
      }
    }
  }
  // Moderator dispute triage (read + under_review only): the queue needs the
  // fastest human review, but resolving moves money — manager/super_admin
  // only. POST/DELETE stay denied below; resolve PATCH is refused here.
  if (resource === "disputes" && role === "moderator") {
    const keys = Object.keys(data);
    if (keys.length !== 1 || keys[0] !== "status" || (data as Record<string, unknown>).status !== "under_review") {
      return NextResponse.json({ error: "Moderators can triage disputes (mark under review) — resolution moves money and needs a manager." }, { status: 403 });
    }
  }
  const validationErr = validateResourcePayload(resource, data as Record<string, unknown>);
  if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });
  // Settlement-owned money fields are NEVER hand-editable: display edits that
  // move no ledger legs make GMV/commission/payout tiles lie. Amounts move
  // only inside their machines (order cancel/deliver/refund, payout
  // request/approve/complete, promotion purchase/refund).
  const moneyOwned: Record<string, string[]> = {
    // orders.itemsList drives every settlement basis (goods + per-line fee
    // legs) — hand-editing it re-prices history behind the ledger's back.
    orders: ["amount", "itemsList"],
    withdrawals: ["amount"],
    refunds: ["amount"],
    promotions: ["amountPaid"],
  };
  const ownedFields = moneyOwned[resource] ?? [];
  const blockedHit = ownedFields.find((f) => (data as Record<string, unknown>)[f] !== undefined);
  if (blockedHit) {
    return NextResponse.json(
      { error: `'${blockedHit}' on ${resource} is settlement-owned and cannot be hand-edited — use the approve/refund/payout actions so ledger legs move with the display.` },
      { status: 400 }
    );
  }
  // Loyalty points are spendable value: direct PATCH must carry the same
  // justification the desk UI requires, or unattributed minting/deduction
  // bypasses the audit trail (direct-API calls skipped the client gate).
  if (resource === "loyalty") {
    const touchesValue =
      (data as Record<string, unknown>).points !== undefined || (data as Record<string, unknown>).tier !== undefined;
    if (touchesValue && typeof reason !== "string") {
      return NextResponse.json({ error: "A reason is required to adjust loyalty points." }, { status: 400 });
    }
    if (touchesValue && !(reason as string).trim()) {
      return NextResponse.json({ error: "A reason is required to adjust loyalty points." }, { status: 400 });
    }
  }
  if (resource === "admins" && session.sub === id) {
    return forbidden("You cannot modify your own account.");
  }

  // App role: scope writes to caller identity + whitelist fields.
  let appScopedData: Record<string, unknown> | null = null;
  if (role === "app") {
    const appUser = (session as unknown as { appUser: Record<string, unknown> }).appUser;
    if (!appUser) return unauthorized();
    const raw = data as Record<string, unknown>;
    if (resource === "refunds") {
      // Refund decisions settle real money and run ONLY through the
      // transactional order endpoint (PATCH /api/app/orders/[id]
      // {refundDecision}, seller-only, idempotent legs). Free-form row edits
      // from the app previously let buyers self-approve their own refunds.
      // Buyer requests go through POST /api/app/orders/[id] {refundReason}.
      return forbidden("Refund decisions go through the order endpoint, not row edits.");
    }
    if (resource === "storefront-banners") {
      // Only approved sellers can manage hero banners.
      if (!(appUser as { isSeller?: boolean }).isSeller) {
        return forbidden("Only approved sellers can manage storefront banners");
      }
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.storefrontBanner.findUnique({ where: { id: String(id) } });
          if (existing && String(existing.sellerUsername) !== String(appUser.username ?? "")) {
            return forbidden("Banner belongs to another seller.");
          }
        } catch {}
      }
      appScopedData = sanitizeStorefrontBannerForApp(raw, appUser);
    } else if (resource === "sellers") {
      const username = String(appUser.username ?? "").trim();
      if (username && String(id) !== `app_${username}`) return forbidden("Seller record belongs to another user.");
      // Update lane: verification state + counters survive profile edits.
      appScopedData = sanitizeSellerForApp(raw, appUser, true);
      // Format validation PATCH-side too: POST-only enforcement left the
      // exact same hole (garbage idNumber persisted past every gate).
      const patchKycErr = kycFormatError(appScopedData);
      if (patchKycErr) return NextResponse.json({ error: patchKycErr }, { status: 400 });
    } else if (resource === "promotions") {
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.promotionPurchase.findUnique({ where: { id: String(id) } });
          const callerId = String(appUser.username ?? "").trim();
          if (existing && String(existing.sellerId ?? "") !== callerId) return forbidden("Promotion belongs to another seller.");
        } catch {}
      }
      appScopedData = sanitizePromotionForApp(raw, appUser);
    } else if (resource === "orders") {
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.order.findUnique({ where: { id: String(id) } });
          const callerU = String(appUser.username ?? "").trim();
          if (existing && String(existing.buyerUsername ?? "") !== callerU && String(existing.sellerUsername ?? "") !== callerU) return forbidden("Order belongs to another user.");
        } catch {}
      }
            appScopedData = sanitizeOrderForApp(raw, appUser);
    } else if (resource === "tickets") {
      // Ownership: app user may only patch tickets they opened
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.supportTicket.findUnique({ where: { id: String(id) } });
          const callerName = String(appUser.name ?? appUser.username ?? "").trim();
          if (existing && String(existing.userName ?? "") !== callerName) return forbidden("Ticket belongs to another user.");
        } catch {}
      }
      appScopedData = sanitizeTicketForApp(raw, appUser);
    } else if (resource === "messages") {
      // Ownership: app user may only patch messages in threads they participate in
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.message.findUnique({ where: { id: String(id) } });
          const callerName = String(appUser.name ?? appUser.username ?? "").trim();
          if (existing && String(existing.sender ?? "") !== callerName) return forbidden("Message belongs to another user.");
        } catch {}
      }
      appScopedData = sanitizeMessageForApp(raw, appUser);
    } else if (resource === "refunds") {
      // Ownership: app user may only patch refunds tied to their orders
      const prismaTmp = (await resolveDb()) as any;
      if (prismaTmp) {
        try {
          const existing = await prismaTmp.refund.findUnique({ where: { id: String(id) } });
          const callerName = String(appUser.name ?? appUser.username ?? "").trim();
          if (existing && String(existing.buyerName ?? "") !== callerName) return forbidden("Refund belongs to another user.");
        } catch {}
      }
      appScopedData = sanitizeRefundForApp(raw, appUser);
    }
  }

  const payload =
    resource === "admins"
      ? cleanAdminInput(data, role, false, { id: session.sub, loginId: session.loginId })
      : appScopedData ?? data;
  if (payload instanceof NextResponse) return payload;
  let cleanPayload: Record<string, unknown> = normalizeRelationArrays(payload as Record<string, unknown>);
  // PK armor (hostile-audit 7b): the row key comes from body.id, never from
  // data — Prisma rejects @id writes, so a client-echoed id 503'd every save.
  delete (cleanPayload as Record<string, unknown>).id;
  // Control flags ride `data` but are not columns: dualControlOverride is
  // consumed by makerCheck above — persisting it would 500 every override.
  delete (cleanPayload as Record<string, unknown>).dualControlOverride;
  if (resource === "users") {
    const blockedUserFields = new Set(["walletBalance", "loyaltyPoints", "passwordHash"]);
    for (const k of Object.keys(cleanPayload)) if (blockedUserFields.has(k)) delete (cleanPayload as any)[k];
  }
  // podNote is evidence metadata consumed by the shipment-deliver machine
  // above — the Shipment model has no such column, so strip it before the
  // row write (else Prisma 503s every staff delivery).
  if (resource === "shipments") delete (cleanPayload as Record<string, unknown>).podNote;

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      // Promotions: route refunds through the real payment engine (unpins the slot).
      if (resource === "promotions" && String(data.status) === "refunded") {
        const target = await prisma.promotionPurchase.findUnique({ where: { id: String(id) } });
        if (target?.checkoutRef) {
          const { deactivateOnRefund } = await import("@/lib/promotions/activate");
          const result = await deactivateOnRefund(target.checkoutRef);
          if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
          await writeAuditSafe({
            action: "data.update",
            entity: resource,
            entityId: String(id),
            details: "Refunded & unpinned via payment engine",
            adminName: session.name,
            ip: getClientIp(request),
          });
          const row = await prisma.promotionPurchase.findUnique({ where: { id: String(id) } });
          return NextResponse.json({ row: serialize(row, resource) });
        }
      }
      // Capture before-image for audit diff (industry: log what changed, not just field names).
      let before: Record<string, unknown> | null = null;
      try {
        before = await prisma[PRISMA_MODELS[resource]].findUnique({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } });
      } catch {}
      // Coupon cap on the EFFECTIVE type (F10): the field validator only sees
      // the payload, so `PATCH {value:95}` on a percent row (or flipping
      // `type` onto a value-95 flat row) skipped the 90% clamp and minted
      // near-free coupons. Resolve type = payload ?? stored row.
      if (resource === "coupons" && before) {
        const d = data as Record<string, unknown>;
        if (d.value !== undefined || d.type !== undefined) {
          const effType = String(d.type ?? (before as { type?: unknown }).type ?? "");
          const effValue = d.value !== undefined ? Number(d.value) : Number((before as { value?: unknown }).value ?? 0);
          if ((effType === "percent" || effType === "percentage") && Number.isFinite(effValue) && effValue > 90) {
            return NextResponse.json({ error: "Percentage coupons are capped at 90%" }, { status: 400 });
          }
        }
      }
      // Loyalty tier must match the points band (desk computes it; direct API
      // used to mint Platinum-on-0-points). Bands mirror the desk exactly.
      if (resource === "loyalty" && before && (data as Record<string, unknown>).tier !== undefined) {
        const d = data as Record<string, unknown>;
        const effPoints = d.points !== undefined ? Number(d.points) : Number((before as { points?: unknown }).points ?? 0);
        const band = !Number.isFinite(effPoints) || effPoints < 0 ? null
          : effPoints >= 5000 ? "Platinum" : effPoints >= 1500 ? "Gold" : effPoints >= 500 ? "Silver" : "Bronze";
        if (!band || String(d.tier) !== band) {
          return NextResponse.json({ error: `Tier must match the points band (${effPoints} pts = ${band ?? "invalid"})` }, { status: 400 });
        }
      }
      // Top-seller PATCH: same ghost/duplicate rail guards as POST (F13).
      // Accepts Seller.id (`app_<username>`) or username, like POST.
      if (resource === "top-sellers" && role !== "app" && (data as Record<string, unknown>).sellerId !== undefined) {
        const rawSellerId = String((data as Record<string, unknown>).sellerId ?? "").trim();
        const sellerId = rawSellerId.startsWith("app_") ? rawSellerId.slice(4) : rawSellerId;
        if (!sellerId) return NextResponse.json({ error: "sellerId is required" }, { status: 400 });
        const sellerUser = await prisma.user.findUnique({ where: { username: sellerId } }).catch(() => null);
        if (!sellerUser || !(sellerUser as { isSeller?: boolean }).isSeller) {
          return NextResponse.json({ error: "sellerId must be an approved seller account." }, { status: 400 });
        }
        const dupe = await prisma.topSeller.findFirst({ where: { sellerId } }).catch(() => null);
        if (dupe && String((dupe as { id?: unknown }).id ?? "") !== String(id)) {
          return NextResponse.json({ error: "Seller is already on the top-sellers rail." }, { status: 409 });
        }
        (data as Record<string, unknown>).sellerId = sellerId;
        (cleanPayload as Record<string, unknown>).sellerId = sellerId;
        const resolvedName =
          (sellerUser as { businessName?: string; name?: string }).businessName ||
          (sellerUser as { name?: string }).name ||
          sellerId;
        (data as Record<string, unknown>).sellerName = resolvedName;
        (cleanPayload as Record<string, unknown>).sellerName = resolvedName;
      }
      // Hot-deal PATCH: same ghost guard as POST (dupe/cap enforced at serve
      // take:3 + POST; PATCH re-points must still resolve to a real row).
      if (resource === "hot-deals" && role !== "app" && (data as Record<string, unknown>).productId !== undefined) {
        const productId = String((data as Record<string, unknown>).productId ?? "").trim();
        if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
        const stripped = productId.startsWith("lst_") ? productId.slice(4) : productId;
        const [postHit, productHit] = await Promise.all([
          prisma.post.findUnique({ where: { id: stripped } }).catch(() => null),
          prisma.product.findUnique({ where: { id: productId } }).catch(() => null),
        ]);
        if (!postHit && !productHit) {
          return NextResponse.json({ error: "productId must be a real listing or product." }, { status: 400 });
        }
        (data as Record<string, unknown>).productId = productId;
        (cleanPayload as Record<string, unknown>).productId = productId;
        // Re-point refresh: a new productId with the old product's
        // name/image/prices serves a deceptive card (old face, new target).
        // Refresh display fields the caller didn't explicitly set.
        {
          const src = (postHit ?? productHit) as {
            title?: unknown; price?: unknown; mrp?: unknown; images?: unknown;
          } | null;
          const firstImage = (() => {
            const imgs = src?.images;
            if (typeof imgs === "string") { try { const p = JSON.parse(imgs); if (Array.isArray(p) && p.length) return String(p[0]); } catch {} }
            if (Array.isArray(imgs) && imgs.length) return String(imgs[0]);
            return "";
          })();
          const d = data as Record<string, unknown>;
          const c = cleanPayload as Record<string, unknown>;
          const setBoth = (k: string, v: unknown) => { if (d[k] === undefined && v !== "" && v !== null && v !== undefined) { d[k] = v; c[k] = v; } };
          if (src) {
            setBoth("productName", String(src.title ?? "").slice(0, 200));
            setBoth("productImage", firstImage);
            const price = Number(src.price);
            const mrp = Number((src as { mrp?: unknown }).mrp);
            if (d["discountedPrice"] === undefined && Number.isFinite(price) && price > 0) { d["discountedPrice"] = Math.round(price); c["discountedPrice"] = Math.round(price); }
            if (d["originalPrice"] === undefined && Number.isFinite(mrp) && mrp > 0) { d["originalPrice"] = Math.round(mrp); c["originalPrice"] = Math.round(mrp); }
            const op = Number(d["originalPrice"] ?? c["originalPrice"] ?? NaN);
            const dp = Number(d["discountedPrice"] ?? c["discountedPrice"] ?? NaN);
            if (d["discountPercentage"] === undefined && Number.isFinite(op) && Number.isFinite(dp) && op > 0 && dp >= 0 && dp <= op) {
              const pct = Math.round(((op - dp) / op) * 100);
              d["discountPercentage"] = pct; c["discountPercentage"] = pct;
            }
          }
        }
      }
      // Unattributed-order repair (admin desk): legacy rows placed before
      // server-side seller binding carry sellerName "Seller" with no
      // sellerUsername — invisible to seller settlements. Super_admin/manager
      // may bind ONE username, once, with a reason. Attribution-only: status,
      // payment and refund fields are refused in the same call, and no money
      // moves (no retroactive credit — reporting truth only). The display
      // name always resolves server-side from the User row, never the client.
      if (resource === "orders" && role !== "app" && (data as Record<string, unknown>).sellerUsername !== undefined) {
        const target = String((data as Record<string, unknown>).sellerUsername ?? "").trim();
        const currentSeller = String((before as { sellerUsername?: unknown } | null)?.sellerUsername ?? "").trim();
        if (!before) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (currentSeller) return NextResponse.json({ error: "Order already has a seller — re-attribution is refused." }, { status: 409 });
        if (!target) return NextResponse.json({ error: "sellerUsername is required" }, { status: 400 });
        // Repair is attribution-only: ownership/identity/payment/refund fields
        // are refused in the same call (a combined bind+steal/retrack would
        // orphan idempotency titles into double-pay; sellerName resolves
        // server-side, never from the client). paymentMethod/actualDelivery
        // ride along: flipping wallet→cod (or backdating the hold stamp) in
        // the bind call would re-route every downstream claw/credit branch.
        const moneyKeys = ["status", "deliveryStatus", "paymentStatus", "refundStatus", "amount", "itemsList", "buyerUsername", "trackingNumber", "orderNumber", "sellerName", "paymentMethod", "actualDelivery", "deliveryLog", "shippingCarrier", "estimatedDelivery", "reviewed", "rating"];
        if (moneyKeys.some((k) => (data as Record<string, unknown>)[k] !== undefined)) {
          return NextResponse.json({ error: "Seller repair is attribution-only — change no status, payment or refund field in the same call." }, { status: 400 });
        }
        if (typeof reason !== "string" || !reason.trim()) {
          return NextResponse.json({ error: "A reason is required for seller repair (audit trail)." }, { status: 400 });
        }
        const sellerUser = await prisma.user.findUnique({ where: { username: target } }).catch(() => null);
        if (!sellerUser || !(sellerUser as { isSeller?: boolean }).isSeller) {
          return NextResponse.json({ error: "Username is not an approved seller account." }, { status: 400 });
        }
        (data as Record<string, unknown>).sellerUsername = target;
        (data as Record<string, unknown>).sellerName =
          (sellerUser as { businessName?: string; name?: string }).businessName ||
          (sellerUser as { name?: string }).name ||
          target;
        // Deliver-then-repair settlement: the legacy rows this repair exists
        // for were delivered with NO seller bound, so no earnings were ever
        // credited — binding alone leaves owed money visible-but-unspendable
        // (payout counts the net, wallet holds 0, debit 400s forever). When
        // the row is already delivered, settle the newly-bound seller now
        // (credit + ledger + hold stamp), locked and once-only: concurrent
        // repairs serialize, the loser 409s, and the generic update below
        // lands the binding itself.
        if (String((before as { status?: unknown } | null)?.status ?? "") === "delivered") {
          try {
            await prisma.$transaction(async (tx: any) => {
              await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, String(id));
              const fresh = await tx.order.findUnique({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } });
              if (!fresh) throw new Error("__repair_order_gone");
              if (String((fresh as { sellerUsername?: unknown }).sellerUsername ?? "").trim()) {
                throw new Error("__repair_already_bound");
              }
              // Binding lands INSIDE the locked tx (not just the generic
              // update after): concurrent different-target repairs serialize
              // here, and the loser observes the winner's binding and 409s
              // instead of crediting a second seller for the same order.
              const resolvedName =
                (sellerUser as { businessName?: string; name?: string }).businessName ||
                (sellerUser as { name?: string }).name ||
                target;
              await tx.order.update({
                where: { id: String(id) },
                data: { sellerUsername: target, sellerName: resolvedName },
              });
              const rMethod = String((fresh as { paymentMethod?: unknown }).paymentMethod ?? "").trim().toLowerCase();
              const rIsCod = rMethod === "cash on delivery" || rMethod === "cod" || rMethod === "cash";
              const rRate = await resolveCommissionRate(tx);
              const rSettled = settlementGoodsBasis((fresh as { itemsList?: unknown }).itemsList);
              const rBasis = Number.isFinite(rSettled) ? (rSettled as number) : Number((fresh as { amount?: unknown }).amount ?? 0);
              const rLegFee = settledFeeFromLegs((fresh as { itemsList?: unknown }).itemsList);
              const rNet = rLegFee !== null
                ? Math.max(0, Math.round(rBasis) - rLegFee)
                : Math.max(0, Math.round(rBasis * (1 - rRate)));
              const rTracking = String((fresh as { trackingNumber?: unknown }).trackingNumber ?? "");
              // No settlement on dead money: a delivered row later refunded
              // (desk/dispute, buyer made whole) or under an open dispute must
              // never credit the newly-bound seller — buyer-whole +
              // seller-credited is double-pay. The binding itself still lands
              // (reporting truth: who sold it); payout guards exclude
              // refunded/frozen rows from withdrawable anyway.
              const rPay = String((fresh as { paymentStatus?: unknown }).paymentStatus ?? "").trim().toLowerCase();
              const rDead = rPay === "refunded" || rPay === "cancelled";
              const rFrozen = rDead ? false : (await tx.dispute.count({
                where: { orderId: rTracking, status: { in: ["open", "under_review"] } },
              }).catch(() => 0)) > 0;
              if (rTracking && rNet > 0 && !rDead && !rFrozen) {
                const earnTitle = `Order earnings · ${rTracking}`;
                const done = await tx.walletTransaction.count({ where: { username: target, title: earnTitle } });
                if (!done) {
                  const seller = await tx.user.findUnique({ where: { username: target } }).catch(() => null);
                  if (seller) {
                    await tx.user.update({ where: { id: (seller as { id: string }).id }, data: { walletBalance: { increment: rNet } } });
                    await tx.walletTransaction.create({
                      data: {
                        username: target,
                        title: earnTitle,
                        detail: rIsCod ? `COD collected on delivery · repair settlement` : `Escrow released on delivery · repair settlement`,
                        amount: rNet,
                      },
                    });
                    const settledExists = await tx.ledgerEntry.count({
                      where: { orderId: String(id), type: "settlement", direction: "in", status: "success" },
                    });
                    if (!settledExists) {
                      const feeRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [
                        { partyName: target, partyRole: "seller", direction: "in", type: "settlement", amount: rNet, method: String((fresh as { paymentMethod?: unknown }).paymentMethod ?? ""), status: "success", orderId: String(id), createdAt: new Date() },
                      ];
                      if (rLegFee !== null && rLegFee > 0) {
                        feeRows.push({ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: Math.round(rLegFee), method: String((fresh as { paymentMethod?: unknown }).paymentMethod ?? ""), status: "success", orderId: String(id), createdAt: new Date() });
                      }
                      await tx.ledgerEntry.createMany({ data: feeRows });
                    }
                    await tx.order.update({
                      where: { id: String(id) },
                      data: {
                        actualDelivery: new Date().toISOString(),
                        ...(rIsCod ? { paymentStatus: "paid" } : {}),
                      },
                    });
                  }
                }
              }
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (msg === "__repair_already_bound") {
              return NextResponse.json({ error: "Order already has a seller — re-attribution is refused." }, { status: 409 });
            }
            if (msg === "__repair_order_gone") {
              return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }
            return NextResponse.json({ error: "Repair settlement failed — binding not applied" }, { status: 503 });
          }
        }
      }
      // Display-name spoof guard: sellerName resolves server-side on the repair
      // path only — a bare sellerName PATCH with no binding is refused.
      if (resource === "orders" && role !== "app" && (data as Record<string, unknown>).sellerName !== undefined && (data as Record<string, unknown>).sellerUsername === undefined) {
        return NextResponse.json({ error: "sellerName resolves server-side — bind sellerUsername instead." }, { status: 400 });
      }
      // Payout state machine for DESK decisions (industry: money movement is a
      // one-way valve, never a free-form field edit):
      //   requested -> approved | rejected   (finance decision)
      //   approved  -> completed             (bank payout executed)
      // Skipping states, resurrecting rejected requests, or reversing completed
      // payouts is rejected 409 — corrections happen on a NEW payout request.
      if (resource === "withdrawals" && typeof data.status === "string") {
        // Legacy mirror rows wrote "pending" — normalize to "requested" so the
        // desk can still rule on them instead of deadlocking on old data.
        const rawCurrent = String((before as { status?: unknown } | null)?.status ?? "requested");
        const currentStatus = rawCurrent === "pending" ? "requested" : rawCurrent;
        const nextStatus = String(data.status);
        const valid =
          (currentStatus === "requested" && ["approved", "rejected"].includes(nextStatus)) ||
          (currentStatus === "approved" && nextStatus === "completed");
        if (!valid) {
          return NextResponse.json(
            { error: `Invalid payout transition '${currentStatus}' -> '${nextStatus}'. Allowed: requested→approved, requested→rejected, approved→completed.` },
            { status: 409 }
          );
        }
        // Refund-on-reject lives in the SECOND withdrawals block below (fee-
        // inclusive, idempotent by reversal title, fail-closed 503). A
        // duplicate non-idempotent block used to sit here and double-credit
        // every rejection (API-C1) — deleted, single return path only.
        // Maker-checker on EXECUTION (bank money actually leaves): approved →
        // completed needs a different admin's prior approval on record.
        if (nextStatus === "completed") {
          const block = await makerCheck(prisma, resource, String(id), session.name, {
            superAdmin: role === "super_admin",
            override: role === "super_admin" && (data as Record<string, unknown>).dualControlOverride === true,
          });
          if (block) return NextResponse.json({ error: block }, { status: 409 });
          // Break-glass audit for override executions (see transitionRefund).
          if ((data as Record<string, unknown>).dualControlOverride === true && role === "super_admin") {
            await writeAuditSafe({
              action: "dual-control-override",
              entity: resource,
              entityId: String(id),
              details: `DUAL-CONTROL OVERRIDE by ${session.name} — payout completed without a prior different-admin approval (lost-trail break-glass)`,
              adminName: session.name,
              ip: getClientIp(request),
            });
          }
          // Payee check (F12): completing a payout with no recorded
          // destination certifies an unpayable transfer. The destination rides
          // in the request-time walletTx detail (`· to <dest>`). Rows predating
          // the detail format (no debit row at all) are grandfathered —
          // refusing them would strand ancient payouts with no recourse.
          {
            // Exact-prefix match: a VPA destination (`name@bank`, cuid charset
            // fits) could embed another payout's id, so substring matching
            // could credit the wrong row's amount to the wrong user. Details
            // are canonically `Payout request <id> · …`.
            const debit = await prisma.walletTransaction.findFirst({
              where: { detail: { startsWith: `Payout request ${String(id)} ` }, amount: { lt: 0 } },
            }).catch(() => null);
            if (debit) {
              const dest = String((debit as { detail?: unknown } | null)?.detail ?? "").split("· to ").pop()?.trim() ?? "";
              if (!dest || /not recorded|no verified account/i.test(dest)) {
                return NextResponse.json(
                  { error: "No payee on file — confirm the seller's bank/UPI destination before completing." },
                  { status: 409 }
                );
              }
            }
          }
          if ((await financeApproverCount(prisma)) < 2) {
            await writeAuditSafe({
              action: "data.update",
              entity: resource,
              entityId: String(id),
              details: "Sole finance approver execution (only one eligible admin exists)",
              adminName: session.name,
              ip: getClientIp(request),
            });
          }
          // Settlement-freshness re-check (withdraw-after-refund closer): the
          // payout amount was validated at REQUEST time, but refunds/disputes
          // may have landed since. Completing against refunded/frozen earnings
          // realizes the loss (claw drives the wallet negative, uncollectible).
          // Recompute the payee's withdrawable NOW (same formula as the app
          // payout guard) excluding THIS row; refuse when it no longer covers.
          {
            const wRow = await prisma.withdrawal.findUnique({ where: { id: String(id) } }).catch(() => null);
            const payee = String((wRow as { userName?: unknown } | null)?.userName ?? "");
            const wAmt = Number((wRow as { amount?: unknown } | null)?.amount ?? 0);
            if (payee && wAmt > 0) {
              try {
                const dRate = await resolveCommissionRate(prisma);
                const sRows = await prisma.order.findMany({
                  where: { sellerUsername: payee, status: "delivered", paymentStatus: { not: "refunded" } },
                  select: { itemsList: true, actualDelivery: true, trackingNumber: true },
                });
                const trks = sRows.map((o: { trackingNumber?: unknown }) => String(o.trackingNumber ?? "")).filter(Boolean);
                const fz = trks.length
                  ? new Set(
                      (await prisma.dispute.findMany({
                        where: { orderId: { in: trks }, status: { in: ["open", "under_review"] } },
                        select: { orderId: true },
                      }).catch(() => [] as Array<{ orderId: string }>)).map((d: { orderId: string }) => String(d.orderId))
                    )
                  : new Set<string>();
                const HOLD_MS = 7 * 24 * 3600 * 1000;
                const hNow = Date.now();
                let lifeNet = 0;
                for (const o of sRows) {
                  const b = settlementGoodsBasis((o as { itemsList?: unknown }).itemsList);
                  if (!Number.isFinite(b) || (b as number) <= 0) continue;
                  if (fz.has(String((o as { trackingNumber?: unknown }).trackingNumber ?? ""))) continue;
                  const stamp = Date.parse(String((o as { actualDelivery?: unknown }).actualDelivery ?? ""));
                  if (Number.isFinite(stamp) && hNow - stamp < HOLD_MS) continue;
                  const legFee = settledFeeFromLegs((o as { itemsList?: unknown }).itemsList);
                  lifeNet += legFee !== null
                    ? Math.max(0, Math.round(b as number) - legFee)
                    : Math.max(0, Math.round((b as number) * (1 - dRate)));
                }
                const otherWd = await prisma.withdrawal.findMany({
                  where: { userName: payee, status: { in: ["requested", "approved", "completed"] }, id: { not: String(id) } },
                  select: { id: true, amount: true },
                }).catch(() => [] as Array<{ id?: unknown; amount?: unknown }>);
                // Principal + fee (matches the request-time paidOut math):
                // fee rides in each payout's debit detail (`₹<fee> fee`).
                // Unparseable legacy rows assume the CURRENT fee (same
                // fallback as the request guard — understating committed
                // would overstate withdrawable, the fail-open direction).
                const liveFee = await prisma.commissionSetting.findUnique({ where: { id: "global" } })
                  .then((s: { payoutFee?: unknown } | null) => {
                    const f = Number((s as { payoutFee?: unknown } | null)?.payoutFee);
                    return Number.isFinite(f) && f >= 0 && f <= 1000 ? Math.floor(f) : 20;
                  })
                  .catch(() => 20);
                const otherIds = otherWd.map((w: { id?: unknown; amount?: unknown }) => String(w.id ?? "")).filter(Boolean);
                const otherDebits = otherIds.length
                  ? await prisma.walletTransaction.findMany({
                      where: { username: payee, amount: { lt: 0 } },
                      select: { detail: true },
                    }).catch(() => [] as Array<{ detail?: unknown }>)
                  : [];
                const otherFeeById = new Map<string, number>();
                for (const r of otherDebits) {
                  const m = String(r.detail ?? "").match(/^Payout request (\S+).*?([\d,]+) fee/);
                  if (m) otherFeeById.set(m[1], Number(m[2].replace(/,/g, "")) || 0);
                }
                // Principal + fee (matches the request-time paidOut math, which
                // commits amount+fee; the wallet CAS still enforces amount+fee
                // at debit).
                const otherOut = otherWd.reduce((s: number, w: { id?: unknown; amount?: unknown }) => {
                  const principal = Math.max(0, Number(w.amount ?? 0));
                  const wf = otherFeeById.get(String(w.id ?? ""));
                  return s + principal + (wf !== undefined ? Math.max(0, wf) : liveFee);
                }, 0);
                if (wAmt > lifeNet - otherOut) {
                  return NextResponse.json(
                    { error: "Settlement moved since request (refund/dispute landed) — amount no longer covered. Reject and ask for a fresh request." },
                    { status: 409 }
                  );
                }
              } catch {
                return NextResponse.json({ error: "Settlement re-check unavailable — try again" }, { status: 503 });
              }
            }
          }
        }
      }
      // Refund desk: single shared machine (transitionRefund above validates,
      // settles the wallet legs + ledger, and updates the row). Falls through
      // to the generic update + audit diff below, which the dual-control
      // makerCheck reads. Staff only reaches here - app role is refused
      // refunds PATCH earlier and decides via the order endpoint.
      if (resource === "refunds" && typeof data.status === "string") {
        const settled = await transitionRefund(prisma, String(id), String(data.status), {
          actor: session.name,
          superAdmin: role === "super_admin",
          ip: getClientIp(request),
          // Break-glass is super_admin-only; the flag is stripped from the
          // row write below so Prisma never sees it.
          override: role === "super_admin" && (data as Record<string, unknown>).dualControlOverride === true,
        });
        if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: settled.status });
      }
      // Withdrawal desk state machine: the request-time debit (amount + fee,
      // committed atomically by PUT /api/app/wallet/payout) strands the
      // seller's money when a request is REJECTED — nothing re-credited it.
      // Rejecting now refunds the exact debit (looked up by withdrawal id,
      // idempotent by reversal title). Approving/completing moves no money:
      // the bank rail is manual; "completed" certifies an off-system transfer
      // (attributed audit trail).
      if (resource === "withdrawals" && typeof data.status === "string") {
        const rawCurrent = String((before as { status?: unknown } | null)?.status ?? "requested");
        const nextStatus = String(data.status);
        const okTransition =
          (rawCurrent === "requested" && ["approved", "rejected"].includes(nextStatus)) ||
          (rawCurrent === "approved" && ["completed", "rejected"].includes(nextStatus));
        if (!okTransition) {
          return NextResponse.json(
            { error: `Invalid payout transition '${rawCurrent}' -> '${nextStatus}'. Allowed: requested→approved/rejected, approved→completed/rejected.` },
            { status: 409 }
          );
        }
        if (nextStatus === "rejected") {
          // Rejection refunds the held debit (amount+fee). Race-safe by
          // construction: the credit row is created FIRST inside one tx, so
          // concurrent double-rejects serialize on UNIQUE(username,title) —
          // the loser takes P2002 and its increment rolls back with it (the
          // old count-then-increment shape double-credited: both passed
          // count==0, both incremented, the loser's create threw 503 while
          // +2x stood).
          try {
            const revTitle = `Withdrawal rejected refund · ${String(id)}`;
            // Exact-prefix match (same VPA-embedding class as the payee check
            // above): substring could refund the wrong row's amount.
            const debit = await prisma.walletTransaction.findFirst({
              where: { detail: { startsWith: `Payout request ${String(id)} ` }, amount: { lt: 0 } },
              orderBy: { ts: "desc" },
            });
            if (debit) {
              const back = -Number(debit.amount);
              try {
                await prisma.$transaction(async (tx: any) => {
                  await tx.walletTransaction.create({
                    data: {
                      username: debit.username,
                      title: revTitle,
                      detail: `Rejected payout ${String(id)} refunded (incl. fee)`,
                      amount: back,
                    },
                  });
                  const owner = await tx.user.findUnique({ where: { username: debit.username } }).catch(() => null);
                  if (!owner) throw new Error("payout_owner_gone");
                  await tx.user.update({
                    where: { id: owner.id },
                    data: { walletBalance: { increment: back } },
                  });
                });
              } catch (txErr) {
                // P2002 = a concurrent reject (or replay) already credited
                // this title — idempotent replay, proceed to the status flip.
                if ((txErr as { code?: string })?.code !== "P2002") throw txErr;
              }
            } else {
              // Fail-closed: legacy/pre-detail rows have no matching debit —
              // flipping to rejected would strand the held funds with the desk
              // believing it refunded. Refuse so ops verifies the balance first.
              return NextResponse.json({ error: "No matching payout debit found — verify the seller's balance manually before rejecting" }, { status: 409 });
            }
          } catch {
            return NextResponse.json({ error: "Payout rejection refund failed — status not changed" }, { status: 503 });
          }
        }
        // Payout decision tell (fire-and-forget): approved / paid / rejected —
        // sellers otherwise discover it by staring at the wallet.
        {
          const wUser = String((before as { userName?: unknown } | null)?.userName ?? "");
          const wAmount = Number((before as { amount?: unknown } | null)?.amount ?? 0);
          if (wUser) {
            const copy =
              nextStatus === "completed"
                ? `paid out ${wAmount > 0 ? `₹${Math.round(wAmount).toLocaleString("en-IN")} ` : ""}(completed)`
                : nextStatus === "approved"
                  ? "approved (bank transfer next)"
                  : "rejected (amount refunded to wallet)";
            notifyUser(prisma, {
              // Wallet tell (not order): the targetId is a WITHDRAWAL id,
              // which /order/<id> cannot resolve — stamping it as an order
              // tell dead-tapped to Order-not-found. The wallet screen shows
              // the payout row.
              username: wUser, type: "wallet",
              userName: "susej Payouts", action: `Your payout request was ${copy}`, targetId: String(id),
            });
          }
        }
      }
      // Staff order settlement (admin panel): the order-detail Cancel button
      // and status advances run through this generic PATCH, which previously
      // moved LABELS ONLY — buyer never re-credited, seller never clawed (or
      // COD-credited on delivery). Staff-driven terminal transitions now
      // settle the SAME idempotent legs as the app lifecycle route (shared
      // tracking titles, so app + admin execution can never double-move).
      // App role excluded: buyer/seller flows settle via /api/app/*.
      if (resource === "orders" && typeof data.status === "string" && role !== "app") {
        try {
          const b = (before ?? {}) as {
            status?: unknown; trackingNumber?: unknown; paymentMethod?: unknown;
            buyerUsername?: unknown; buyerName?: unknown; sellerUsername?: unknown;
            amount?: unknown; itemsList?: unknown; orderNumber?: unknown;
          };
          const rawCurrent = String(b.status ?? "");
          const nextStatus = String(data.status);
          const tracking = String(b.trackingNumber ?? "");
          const method = String(b.paymentMethod ?? "").trim().toLowerCase();
          const paysWallet = method === "wallet";
          const isCod = method === "cash on delivery" || method === "cod" || method === "cash";
          const rate = await resolveCommissionRate(prisma);
          let goodsBasis = Number(b.amount ?? 0);
          // Coupon-aware settlement basis (prefers per-line netPrice).
          {
            const settledBasis = settlementGoodsBasis(b.itemsList);
            if (Number.isFinite(settledBasis)) goodsBasis = settledBasis;
          }
          // Category-aware: settled per-line commission legs (persisted at
          // placement) beat a re-derived global rate — same helper as the
          // app order routes so every leg agrees.
          const legFee = settledFeeFromLegs(b.itemsList);
          const blendedPct = legFee !== null && goodsBasis > 0
            ? Math.round((legFee / goodsBasis) * 1000) / 10
            : Math.round(rate * 100);
          const net = legFee !== null
            ? Math.max(0, Math.round(goodsBasis) - legFee)
            : Math.max(0, Math.round(goodsBasis * (1 - rate)));
          const orderId = String(id);
          // Serialize with every other money execution for this order
          // (transitionRefund, dispute ruling, shipment deliver lock the same
          // row first): guard-reads below observe committed titles, so neither
          // same-second double-submit nor cross-path cancel-vs-dispute races
          // can move money twice.
          await prisma.$transaction(async (tx: any) => {
            await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, orderId);
            // Route every db call in this block through the locked tx.
            const prisma = tx;
          if (tracking && rawCurrent !== "cancelled" && nextStatus === "cancelled") {
            let reversed = false;
            if (paysWallet && b.buyerUsername && Number(b.amount ?? 0) > 0) {
              const title = `Order cancelled - refund · ${tracking}`;
              // Cross-path guard: an app-approve/desk/dispute refund for the
              // same order already made the buyer whole — a sequential
              // dispute-then-cancel (or concurrent pair under the lock above)
              // must never pay twice.
              const done = await prisma.walletTransaction.count({
                where: {
                  username: String(b.buyerUsername),
                  title: {
                    in: [
                      title,
                      `Order refund · ${tracking}`,
                      `Dispute refund · ${tracking}`,
                      `Dispute split refund · ${tracking}`,
                    ],
                  },
                },
              });
              if (!done) {
                const buyer = await prisma.user
                  .findUnique({ where: { username: String(b.buyerUsername) } })
                  .catch(() => null);
                if (buyer) {
                  await prisma.user.update({
                    where: { id: buyer.id },
                    data: { walletBalance: { increment: Number(b.amount) } },
                  });
                  await prisma.walletTransaction.create({
                    data: {
                      username: String(b.buyerUsername),
                      title,
                      detail: `Refund for cancelled order ${String(b.orderNumber ?? tracking)}`,
                      amount: Number(b.amount),
                    },
                  });
                  // Ledger mirror (staff path was wallet-only → unreconcilable).
                  // Count-guarded so a retry never double-mirrors.
                  {
                    const mirrored = await prisma.ledgerEntry.count({
                      where: { orderId, type: "reversal", direction: "in", status: "success" },
                    });
                    if (!mirrored) {
                      await prisma.ledgerEntry.createMany({
                        data: [{ partyName: String(b.buyerName ?? b.buyerUsername ?? ""), partyRole: "buyer", direction: "in", type: "reversal", amount: Number(b.amount), method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() }],
                      });
                    }
                  }
                  reversed = true;
                }
              } else {
                reversed = true;
              }
            }
            if (!isCod && b.sellerUsername) {
              const earnTitle = `Order earnings · ${tracking}`;
              const clawTitle = `Order cancelled clawback · ${tracking}`;
              const wasCredited = await prisma.walletTransaction.count({
                where: { username: String(b.sellerUsername), title: earnTitle },
              });
              const alreadyClawed = await prisma.walletTransaction.count({
                where: {
                  username: String(b.sellerUsername),
                  title: {
                    in: [
                      clawTitle,
                      `Order refund clawback · ${tracking}`,
                      `Dispute refund clawback · ${tracking}`,
                      `Dispute split clawback · ${tracking}`,
                    ],
                  },
                },
              });
              if (wasCredited && !alreadyClawed && net > 0) {
                const seller = await prisma.user
                  .findUnique({ where: { username: String(b.sellerUsername) } })
                  .catch(() => null);
                if (seller) {
                  await prisma.user.update({
                    where: { id: seller.id },
                    data: { walletBalance: { decrement: net } },
                  });
                  await prisma.walletTransaction.create({
                    data: {
                      username: String(b.sellerUsername),
                      title: clawTitle,
                      detail: `Earnings reversal for cancelled order ${String(b.orderNumber ?? tracking)}`,
                      amount: -net,
                    },
                  });
                  // Ledger mirror for the clawback (count-guarded).
                  {
                    const clawMirrored = await prisma.ledgerEntry.count({
                      where: { orderId, type: "reversal", direction: "out", status: "success" },
                    });
                    if (!clawMirrored) {
                      await prisma.ledgerEntry.createMany({
                        data: [{ partyName: String(b.sellerUsername), partyRole: "seller", direction: "out", type: "reversal", amount: net, method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() }],
                      });
                    }
                  }
                  reversed = true;
                }
              } else if (wasCredited) {
                reversed = true;
              }
              // Platform legs INDEPENDENT of the claw above: pre-delivery
              // escrow orders were never credited (no claw runs), but their
              // placement shipping-IN (wallet success) still needs its OUT —
              // nesting this inside the claw branch stranded it (ledger-only
              // drift, platform shipping revenue overstated per such cancel).
              // Evidence-gated + once-guarded like every sibling path.
              {
                const feeOut = legFee !== null && legFee > 0 ? Math.round(legFee) : Math.max(0, Math.round(goodsBasis * rate));
                const feeBooked = await prisma.ledgerEntry.count({ where: { orderId, type: "fee", direction: "in", status: "success" } });
                if (feeOut > 0 && feeBooked > 0) {
                  const feeReversed = await prisma.ledgerEntry.count({ where: { orderId, type: "fee", direction: "out" } });
                  if (!feeReversed) {
                    await prisma.ledgerEntry.createMany({
                      data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: feeOut, method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() }],
                    });
                  }
                }
                const shipOut = Math.max(0, Math.round(Number(b.amount ?? 0)) - Math.round(goodsBasis));
                const shipBooked = await prisma.ledgerEntry.count({ where: { orderId, type: "shipping", direction: "in", status: "success" } });
                if (shipOut > 0 && shipBooked > 0) {
                  const shipReversed = await prisma.ledgerEntry.count({ where: { orderId, type: "shipping", direction: "out" } });
                  if (!shipReversed) {
                    await prisma.ledgerEntry.createMany({
                      data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: shipOut, method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() }],
                    });
                  }
                }
              }
            }
            if (reversed) (cleanPayload as Record<string, unknown>).paymentStatus = "refunded";
          }
            if (tracking && rawCurrent !== "delivered" && nextStatus === "delivered" && b.sellerUsername) {
              const earnTitle = `Order earnings · ${tracking}`;
              const done = await prisma.walletTransaction.count({
                where: { username: String(b.sellerUsername), title: earnTitle },
              });
              if (!done && net > 0) {
              const seller = await prisma.user
                .findUnique({ where: { username: String(b.sellerUsername) } })
                .catch(() => null);
              if (seller) {
                await prisma.user.update({
                  where: { id: seller.id },
                  data: { walletBalance: { increment: net } },
                });
                await prisma.walletTransaction.create({
                  data: {
                    username: String(b.sellerUsername),
                    title: earnTitle,
                    detail: isCod
                      ? `COD collected on delivery · net after ${blendedPct}% commission`
                      : `Escrow released on delivery · net after ${blendedPct}% commission`,
                    amount: net,
                  },
                });
                // Ledger mirror (staff path was wallet-only → unreconcilable).
                // Settlement + platform fee land now (count-guarded); COD
                // adopts the pending placement legs instead of double-booking.
                {
                  const settledExists = await prisma.ledgerEntry.count({
                    where: { orderId, type: "settlement", direction: "in", status: "success" },
                  });
                  if (!settledExists) {
                    const feeRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [
                      { partyName: String(b.sellerUsername), partyRole: "seller", direction: "in", type: "settlement", amount: net, method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() },
                    ];
                    if (legFee !== null && legFee > 0) {
                      feeRows.push({ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: Math.round(legFee), method: String(b.paymentMethod ?? ""), status: "success", orderId, createdAt: new Date() });
                    }
                    await prisma.ledgerEntry.createMany({ data: feeRows });
                  }
                  if (isCod) {
                    const pendingCharge = await prisma.ledgerEntry.findFirst({ where: { orderId, type: "charge", direction: "out", status: "pending" } });
                    if (pendingCharge) {
                      await prisma.ledgerEntry.update({ where: { id: pendingCharge.id }, data: { status: "success", amount: Number(b.amount ?? pendingCharge.amount) } });
                    }
                    const pendingShip = await prisma.ledgerEntry.findFirst({ where: { orderId, type: "shipping", direction: "in", status: "pending" } });
                    if (pendingShip) {
                      const shipShare = Math.max(0, Math.round(Number(b.amount ?? 0)) - Math.round(goodsBasis));
                      if (shipShare > 0) await prisma.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "success", amount: shipShare } });
                      else await prisma.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "cancelled" } });
                    }
                  }
                }
                (cleanPayload as Record<string, unknown>).paymentStatus = isCod ? "paid" : (b as { paymentStatus?: unknown }).paymentStatus;
                // Settlement timestamp (drives the 7-day payout hold).
                (cleanPayload as Record<string, unknown>).actualDelivery = new Date().toISOString();
              }
            } else if (done) {
              (cleanPayload as Record<string, unknown>).paymentStatus = "paid";
            }
          }
          }); // end locked settlement tx (cancel + deliver legs above)
          // Staff-executed tells (fire-and-forget, post-commit): desk moves
          // money too, and both sides hear it like app-side moves.
          if (tracking && rawCurrent !== "cancelled" && nextStatus === "cancelled" && b.buyerUsername) {
            notifyUser(prisma, {
              username: String(b.buyerUsername), type: "order",
              userName: "susej Orders", userHandle: undefined,
              action: `cancelled order ${tracking} (refund issued${paysWallet ? "" : " where applicable"})`,
              targetId: tracking,
            });
          }
          if (tracking && rawCurrent !== "delivered" && nextStatus === "delivered" && b.buyerUsername) {
            notifyUser(prisma, {
              username: String(b.buyerUsername), type: "order",
              userName: String(b.sellerUsername ?? "susej Orders") as string, userHandle: String(b.sellerUsername ?? "") || undefined,
              action: `delivered your order ${tracking}`,
              targetId: tracking,
            });
          }
          // Staff refund decisions from the order-detail panel: the panel
          // edits Order.refundStatus (display-only), but money lives on the
          // linked Refund row. Route the decision through the shared machine
          // so approval actually settles; refuse when no refund record exists
          // (decide it in the Refunds queue instead of flipping a label).
          const wantRefund = (data as Record<string, unknown>).refundStatus;
          if (typeof wantRefund === "string") {
            const b2 = (before ?? {}) as { trackingNumber?: unknown };
            const refTracking = String(b2.trackingNumber ?? "");
            const linked = refTracking
              ? await prisma.refund.findFirst({
                  where: { orderRef: refTracking },
                  orderBy: { requestedAt: "desc" },
                })
              : null;
            if (!linked) {
              return NextResponse.json(
                { error: "No refund record for this order — decide it in the Refunds queue." },
                { status: 409 }
              );
            }
            const settled = await transitionRefund(prisma, String(linked.id), String(wantRefund), {
              actor: session.name,
              superAdmin: role === "super_admin",
              ip: getClientIp(request),
              override: role === "super_admin" && (data as Record<string, unknown>).dualControlOverride === true,
            });
            if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: settled.status });
          }
        } catch {
          return NextResponse.json({ error: "Order settlement failed — status not changed" }, { status: 503 });
        }
      }
      // Dispute rulings that move money (staff-only resource — app role can
      // never write disputes). full_refund settles the full legs, split_50_50
      // settles half legs, release_seller settles nothing (explicit). Legs
      // are SKIPPED when the cancel/refund queues already moved them (shared
      // title checks) so a dispute ruling composes with — never doubles — a
      // refund on the same order. All legs idempotent by title.
      if (resource === "disputes" && data.status === "resolved") {
        // One-way state machine: an already-resolved dispute cannot be
        // re-resolved with a new outcome (that path double-pays via
        // cross-outcome titles). Reopen explicitly first (audit-trailed).
        const priorStatus = String(((before ?? {}) as { status?: unknown }).status ?? "");
        if (priorStatus === "resolved") {
          return NextResponse.json(
            { error: "Dispute already resolved — reopen before a new ruling" },
            { status: 409 }
          );
        }
        const outcome = String((data as Record<string, unknown>).outcome ?? "");
        // Allow-list: any other outcome string (empty, typo, "partial")
        // used to fall through and resolve with zero legs settled.
        if (outcome !== "full_refund" && outcome !== "split_50_50" && outcome !== "release_seller") {
          return NextResponse.json(
            { error: "Unknown dispute outcome — use full_refund, split_50_50, or release_seller" },
            { status: 400 }
          );
        }
        if (outcome === "full_refund" || outcome === "split_50_50") {
          try {
            const b = (before ?? {}) as { orderId?: unknown };
            const ref = String(b.orderId ?? "").trim();
            const found = ref
              ? await prisma.order.findFirst({
                  where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
                })
              : null;
            if (!found) {
              return NextResponse.json(
                { error: "Linked order not found — ruling recorded without money movement." },
                { status: 409 }
              );
            }
            // Locked tx: concurrent rulings (same outcome retries, cross
            // outcome full-vs-split, or ruling-vs-cancel/approve) serialize on
            // the order row; guard-reads observe committed titles. Fresh
            // re-read inside — the outer row predates the lock.
            const ruling = await prisma.$transaction(async (tx: any) => {
              await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, (found as { id: string }).id);
              const prisma = tx;
              const order = await tx.order.findFirst({
                where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
              });
              if (!order) {
                return { status: 409 as const, error: "Linked order not found — ruling recorded without money movement." };
              }
            const tracking = String(order.trackingNumber ?? "");
            const method = String(order.paymentMethod ?? "").trim().toLowerCase();
            const paysWallet = method === "wallet";
            const isCod = method === "cash on delivery" || method === "cod" || method === "cash";
            const half = outcome === "split_50_50";
            const rate = await resolveCommissionRate(prisma);
            let goodsBasis = Number(order.amount ?? 0);
            // Coupon-aware settlement basis (prefers per-line netPrice).
            {
              const settledBasis = settlementGoodsBasis(order.itemsList);
              if (Number.isFinite(settledBasis)) goodsBasis = settledBasis;
            }
            // Category-aware: settled per-line legs beat a re-derived rate.
            const disputeLegFee = settledFeeFromLegs(order.itemsList);
            const disputeNet = disputeLegFee !== null
              ? Math.max(0, Math.round(goodsBasis) - disputeLegFee)
              : Math.max(0, Math.round(goodsBasis * (1 - rate)));
            // Split math balances EXACTLY (floor both halves; the ≤₹1 remainder
            // stays with the buyer): buyerDue = goods half + fee half, so the
            // delivery-fee share the platform absorbs is an explicit number,
            // never a silent rounding drift. feeEst = charged − goods basis
            // (includes any shipping-share of a coupon discount, documented).
            const roundedGoods = Math.round(goodsBasis);
            const roundedAmount = Math.round(Number(order.amount ?? 0));
            const feeEst = Math.max(0, roundedAmount - roundedGoods);
            const buyerDue = half ? Math.floor(roundedAmount / 2) : roundedAmount;
            const goodsHalf = half ? Math.floor(roundedGoods / 2) : roundedGoods;
            const shipAbsorbed = half ? Math.max(0, buyerDue - goodsHalf) : feeEst;
            const clawDue = half
              ? Math.max(0, Math.floor(disputeNet / 2))
              : disputeNet;
            let buyerPaid = false;
            let sellerClawedPaid = false;
            const buyerTitle = half ? `Dispute split refund · ${tracking}` : `Dispute refund · ${tracking}`;
            const clawTitle = half ? `Dispute split clawback · ${tracking}` : `Dispute refund clawback · ${tracking}`;
            const settledElsewhere = async (t: string, u: unknown) =>
              u ? (await prisma.walletTransaction.count({ where: { username: String(u), title: t } })) > 0 : false;
            if (paysWallet && order.buyerUsername && buyerDue > 0) {
              const dup = await settledElsewhere(buyerTitle, order.buyerUsername);
              // Cross-outcome guard: the OPPOSITE dispute ruling for the same
              // order already made the buyer whole (titles differ so UNIQUE
              // never collides) — never pay twice.
              const oppositeBuyer = half ? `Dispute refund · ${tracking}` : `Dispute split refund · ${tracking}`;
              const fullGone =
                (await settledElsewhere(`Order refund · ${tracking}`, order.buyerUsername)) ||
                (await settledElsewhere(`Order cancelled - refund · ${tracking}`, order.buyerUsername)) ||
                (await settledElsewhere(oppositeBuyer, order.buyerUsername));
              if (!dup && !fullGone) {
                const buyer = await prisma.user.findUnique({ where: { username: order.buyerUsername } }).catch(() => null);
                if (buyer) {
                  await prisma.user.update({ where: { id: buyer.id }, data: { walletBalance: { increment: buyerDue } } });
                  await prisma.walletTransaction.create({
                    data: {
                      username: order.buyerUsername,
                      title: buyerTitle,
                      detail: `Dispute ${half ? "split (50%) " : ""}ruling on order ${tracking}`,
                      amount: buyerDue,
                    },
                  });
                  // Buyer leg landed; the order-level refunded mark is applied
                  // once below for ALL methods (see after the claw block).
                  buyerPaid = true;
                }
              }
            }
            // Seller claw runs for wallet AND COD (post-delivery both were
            // credited — evidence-guarded by wasCredited, so pre-delivery rows
            // safely no-op).
            if (order.sellerUsername && clawDue > 0) {
              const dup = await settledElsewhere(clawTitle, order.sellerUsername);
              // Cross-outcome guard (mirror of the buyer side).
              const oppositeClaw = half ? `Dispute refund clawback · ${tracking}` : `Dispute split clawback · ${tracking}`;
              const fullGone =
                (await settledElsewhere(`Order refund clawback · ${tracking}`, order.sellerUsername)) ||
                (await settledElsewhere(`Order cancelled clawback · ${tracking}`, order.sellerUsername)) ||
                (await settledElsewhere(oppositeClaw, order.sellerUsername));
              const wasCredited =
                (await prisma.walletTransaction.count({
                  where: { username: String(order.sellerUsername), title: `Order earnings · ${tracking}` },
                })) > 0;
              if (!dup && !fullGone && wasCredited) {
                const seller = await prisma.user.findUnique({ where: { username: order.sellerUsername } }).catch(() => null);
                if (seller) {
                  await prisma.user.update({ where: { id: seller.id }, data: { walletBalance: { decrement: clawDue } } });
                  await prisma.walletTransaction.create({
                    data: {
                      username: order.sellerUsername,
                      title: clawTitle,
                      detail: `Dispute ${half ? "split (50%) " : ""}ruling clawback on order ${tracking}`,
                      amount: -clawDue,
                    },
                  });
                  sellerClawedPaid = true;
                }
              }
            }
            // ANY dispute settlement (full or split, wallet or COD) marks the
            // order refunded: the payout guard excludes refunded rows
            // wholesale, so a COD ruling that only claws the seller can never
            // leave the order "paid" and withdrawable again
            // (withdraw-after-claw double-spend). Conservative by design:
            // understates withdrawable, never overstates. Inside the locked
            // tx, so concurrent rulings serialize on this write.
            await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } });
            // Ledger mirror for the ruling: LOUD, never swallowed (a ruling with
            // money moved but no mirror is unreconcilable). Count-guarded so a
            // retry after a partial failure never double-mirrors — the wallet
            // legs above are equally idempotent, so retry-after-503 is safe.
            // Retry-hole fix: if the wallet legs landed on a prior attempt and
            // this retry skipped them as dups, buyerPaid/sellerClawedPaid stay
            // false and the mirror would write NOTHING while resolving the
            // ruling. Re-derive settled state from the idempotency titles so
            // the mirror still lands exactly once.
            try {
              const buyerSettledForMirror =
                buyerPaid ||
                (paysWallet && !!order.buyerUsername && buyerDue > 0 &&
                  ((await settledElsewhere(buyerTitle, order.buyerUsername)) ||
                    (await settledElsewhere(`Order refund · ${tracking}`, order.buyerUsername)) ||
                    (await settledElsewhere(`Order cancelled - refund · ${tracking}`, order.buyerUsername))));
              const sellerSettledForMirror =
                sellerClawedPaid ||
                (!!order.sellerUsername && clawDue > 0 &&
                  ((await settledElsewhere(clawTitle, order.sellerUsername)) ||
                    (await settledElsewhere(`Order refund clawback · ${tracking}`, order.sellerUsername)) ||
                    (await settledElsewhere(`Order cancelled clawback · ${tracking}`, order.sellerUsername))));
              // Mirror gate is cross-outcome: a full ruling mirrors reversal
              // rows, a split mirrors split rows — but the wallet legs are
              // cross-outcome idempotent (a second ruling moves no money), so
              // a reopen → re-resolve with the OTHER outcome must not mint a
              // second mirror for the same economic event (reconciliation
              // double-count). Same-outcome retries stay serialized by the
              // one-way resolved guard + title idempotency (a ledger UNIQUE
              // would need a migration — logged as NOTED).
              const alreadyMirrored = await prisma.ledgerEntry.count({
                where: {
                  orderId: order.id,
                  status: "success",
                  type: { in: ["split", "reversal"] },
                },
              });
              if (!alreadyMirrored) {
              const dnow = new Date();
              const drows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
              if (buyerSettledForMirror && order.buyerUsername) {
                drows.push({ partyName: order.buyerName, partyRole: "buyer", direction: "in", type: half ? "split" : "reversal", amount: buyerDue, method, status: "success", orderId: order.id, createdAt: dnow });
              }
              if (sellerSettledForMirror && order.sellerUsername) {
                drows.push({ partyName: order.sellerUsername, partyRole: "seller", direction: "out", type: half ? "split" : "reversal", amount: clawDue, method, status: "success", orderId: order.id, createdAt: dnow });
              }
              if ((buyerSettledForMirror || sellerSettledForMirror) && shipAbsorbed > 0) {
                // Evidence-gated like fee: no success shipping-IN (pre-delivery
                // COD pending) means nothing to absorb — the COD void path
                // offsets pending separately.
                const shipBooked = await prisma.ledgerEntry.count({
                  where: { orderId: order.id, type: "shipping", direction: "in", status: "success" },
                });
                if (shipBooked > 0) {
                  drows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: shipAbsorbed, method, status: "success", orderId: order.id, createdAt: dnow });
                }
              }
              // Full-ruling fee reversal: cancel / seller-approve / desk-refund
              // all reverse the placement fee — a full dispute ruling that keeps
              // it books invisible platform revenue and disagrees with every
              // sibling path. Evidence-gated (desk parity): fee-IN lands at
              // DELIVERY, so a pre-delivery ruling reversing it mints a
              // phantom OUT leg with no IN.
              if (!half && (buyerSettledForMirror || sellerSettledForMirror)) {
                const fullFeeOut = disputeLegFee !== null && disputeLegFee > 0
                  ? Math.round(disputeLegFee)
                  : Math.max(0, Math.round(goodsBasis * rate));
                const fullFeeBooked = await prisma.ledgerEntry.count({
                  where: { orderId: order.id, type: "fee", direction: "in", status: "success" },
                });
                if (fullFeeOut > 0 && fullFeeBooked > 0) {
                  const feeGone = await prisma.ledgerEntry.count({
                    where: { orderId: order.id, type: "fee", direction: "out", status: "success" },
                  });
                  if (!feeGone) {
                    drows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: fullFeeOut, method, status: "success", orderId: order.id, createdAt: dnow });
                  }
                }
              }
              // Retained-fee leg (split only): the platform keeps roughly half
              // the commission (goodsHalf − clawDue) while refunding the buyer
              // and clawing the seller. Delivery already booked the FULL fee
              // as fee-IN, so the returned half lands as fee-OUT (the kept
              // half stays as the original IN row). Booking IN here
              // double-counted the kept fee on every split ruling. Same
              // evidence gate: no fee-IN (pre-delivery) means nothing to
              // return — reversing books a phantom.
              if (half && (buyerSettledForMirror || sellerSettledForMirror)) {
                const retainedFee = Math.max(0, goodsHalf - clawDue);
                const splitFeeBooked = await prisma.ledgerEntry.count({
                  where: { orderId: order.id, type: "fee", direction: "in", status: "success" },
                });
                if (retainedFee > 0 && splitFeeBooked > 0) {
                  // Same once-only guard as the full path: a prior ruling may
                  // already have reversed the fee (reopen → re-resolve).
                  const feeGone = await prisma.ledgerEntry.count({
                    where: { orderId: order.id, type: "fee", direction: "out", status: "success" },
                  });
                  if (!feeGone) {
                    drows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: retainedFee, method, status: "success", orderId: order.id, createdAt: dnow });
                  }
                }
              }
              if (drows.length) await prisma.ledgerEntry.createMany({ data: drows });
              }
            } catch {
              // Mirror failure rolls the ruling back LOUD (503, ruling not
              // recorded) — the wallet legs are title-idempotent, so the admin
              // retries and nothing double-moves. Silent mirrors are how books
              // stop balancing.
              throw new Error("Dispute ledger mirror failed");
            }
              return undefined;
            });
            if (ruling && (ruling as { status?: number }).status === 409) {
              return NextResponse.json({ error: (ruling as { error?: string }).error }, { status: 409 });
            }
            } catch {
              return NextResponse.json({ error: "Dispute settlement failed — ruling not recorded" }, { status: 503 });
            }
          } else if (outcome === "release_seller") {
            // Release-to-seller moves no money BY DESIGN (funds already sit
            // with the seller) — but a resolve without verification used to
            // freeze COD orders with no settled earnings in limbo under a
            // "resolved" label. Verify settlement exists before resolving.
            try {
              const b = (before ?? {}) as { orderId?: unknown };
              const ref = String(b.orderId ?? "").trim();
              const linked = ref
                ? await prisma.order.findFirst({
                    where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
                  })
                : null;
              if (!linked) {
                return NextResponse.json(
                  { error: "Linked order not found — ruling recorded without money movement." },
                  { status: 409 }
                );
              }
              const lt = String(linked.trackingNumber ?? "");
              const lm = String(linked.paymentMethod ?? "").trim().toLowerCase();
              const lIsCod = lm === "cash on delivery" || lm === "cod" || lm === "cash";
              const earned =
                linked.sellerUsername &&
                (await prisma.walletTransaction.count({
                  where: { username: String(linked.sellerUsername), title: `Order earnings · ${lt}` },
                })) > 0;
              if (!earned && (lIsCod || String(linked.status ?? "") !== "delivered")) {
                return NextResponse.json(
                  { error: "Seller has no settled earnings on this order — deliver (or settle) first, then release." },
                  { status: 409 }
                );
              }
            } catch (e) {
              if (e instanceof NextResponse) throw e;
              return NextResponse.json({ error: "Dispute settlement check failed — ruling not recorded" }, { status: 503 });
            }
          }
      }
      // Shipment/order parity: "Mark delivered" previously flipped ONLY the
      // shipment row while the linked order stayed out_for_delivery (and COD
      // sellers were never credited). Advancing a shipment to delivered now
      // advances the linked order too, with the same idempotent COD
      // settlement the staff order path uses (shared titles — never double).
      if (resource === "shipments" && String((data as Record<string, unknown>).status ?? "") === "delivered") {
        // POD parity with the app lane: staff delivery settles real money, so
        // it needs the same handover evidence (tracking ID / receiver name).
        // The desk prompts for it; the API 400s without it.
        const shipPod = String((data as Record<string, unknown>).podNote ?? "").trim().slice(0, 200);
        if (shipPod.length < 4) {
          return NextResponse.json({ error: "Delivery proof required — tracking ID or receiver name" }, { status: 400 });
        }
        try {
          const b = (before ?? {}) as { status?: unknown; orderId?: unknown };
          if (String(b.status ?? "") !== "delivered") {
            const ref = String(b.orderId ?? "").trim();
            const order = ref
              ? await prisma.order.findFirst({
                  where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
                })
              : null;
            if (order && String(order.status ?? "") !== "delivered" && String(order.status ?? "") !== "cancelled") {
              // Locked tx (same order-row lock as every other money path):
              // concurrent shipment-vs-order delivers serialize; the earnings
              // title + settlement guards observe committed state.
              await prisma.$transaction(async (tx: any) => {
                await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, (order as { id: string }).id);
                const prisma = tx;
              // Settlement timestamp here too — without it the 7-day payout
              // hold treats shipment-delivered rows as immediately withdrawable.
              // NOTE: settlement runs BEFORE the status flip below — a mid-path
              // failure must leave the order flippable for retry, never
              // delivered-but-unpaid (the staff deliver path dedupes on
              // delivered and would strand the seller forever).
              const shipDeliveryAt = new Date().toISOString();
              const method = String(order.paymentMethod ?? "").trim().toLowerCase();
              const isCod = method === "cash on delivery" || method === "cod" || method === "cash";
              // Escrow release for BOTH rails (wallet sellers were never paid
              // on this path — status said delivered, wallet said +0, and a
              // later PATCH delivered deduped so the seller was unpaid forever).
              if (order.sellerUsername) {
                const earnTitle = `Order earnings · ${String(order.trackingNumber ?? "")}`;
                const done = await prisma.walletTransaction.count({
                  where: { username: String(order.sellerUsername), title: earnTitle },
                });
                if (!done) {
                  const rate = await resolveCommissionRate(prisma);
                  let goodsBasis = Number(order.amount ?? 0);
                  // Coupon-aware settlement basis (prefers per-line netPrice).
                  {
                    const settledBasis = settlementGoodsBasis(order.itemsList);
                    if (Number.isFinite(settledBasis)) goodsBasis = settledBasis;
                  }
                  // Category-aware: settled per-line legs (see app orders route).
                  const shipLegFee = settledFeeFromLegs(order.itemsList);
                  const blendedShipPct = shipLegFee !== null && goodsBasis > 0
                    ? Math.round((shipLegFee / goodsBasis) * 1000) / 10
                    : Math.round(rate * 100);
                  const net = shipLegFee !== null
                    ? Math.max(0, Math.round(goodsBasis) - shipLegFee)
                    : Math.max(0, Math.round(goodsBasis * (1 - rate)));
                  if (net > 0) {
                    const seller = await prisma.user.findUnique({ where: { username: String(order.sellerUsername) } }).catch(() => null);
                    if (seller) {
                      await prisma.user.update({ where: { id: seller.id }, data: { walletBalance: { increment: net } } });
                      await prisma.walletTransaction.create({
                        data: {
                          username: String(order.sellerUsername),
                          title: earnTitle,
                          detail: isCod
                            ? `COD collected on delivery · net after ${blendedShipPct}% commission`
                            : `Escrow released on delivery · net after ${blendedShipPct}% commission`,
                          amount: net,
                        },
                      });
                      // Ledger mirror (settlement + fee, count-guarded).
                      const settledExists = await prisma.ledgerEntry.count({
                        where: { orderId: order.id, type: "settlement", direction: "in", status: "success" },
                      });
                      if (!settledExists) {
                        const feeRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [
                          { partyName: String(order.sellerUsername), partyRole: "seller", direction: "in", type: "settlement", amount: net, method: String(order.paymentMethod ?? ""), status: "success", orderId: order.id, createdAt: new Date() },
                        ];
                        if (shipLegFee !== null && shipLegFee > 0) {
                          feeRows.push({ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: Math.round(shipLegFee), method: String(order.paymentMethod ?? ""), status: "success", orderId: order.id, createdAt: new Date() });
                        }
                        await prisma.ledgerEntry.createMany({ data: feeRows });
                      }
                      if (isCod) {
                        const pendingCharge = await prisma.ledgerEntry.findFirst({ where: { orderId: order.id, type: "charge", direction: "out", status: "pending" } });
                        if (pendingCharge) {
                          await prisma.ledgerEntry.update({ where: { id: pendingCharge.id }, data: { status: "success", amount: Number(order.amount ?? pendingCharge.amount) } });
                        }
                        const pendingShip = await prisma.ledgerEntry.findFirst({ where: { orderId: order.id, type: "shipping", direction: "in", status: "pending" } });
                        if (pendingShip) {
                          const shipShare = Math.max(0, Math.round(Number(order.amount ?? 0)) - Math.round(goodsBasis));
                          if (shipShare > 0) await prisma.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "success", amount: shipShare } });
                          else await prisma.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "cancelled" } });
                        }
                        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } });
                      }
                    }
                  }
                } else if (isCod) {
                  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } });
                }
              }
              // Status flip LAST: only a fully-settled delivery reads delivered.
              // POD evidence rides the order row (buyer tracking renders it).
              const priorLog = Array.isArray((order as { deliveryLog?: unknown }).deliveryLog)
                ? ((order as { deliveryLog: unknown[] }).deliveryLog)
                : [];
              await prisma.order.update({
                where: { id: order.id },
                data: {
                  status: "delivered",
                  deliveryStatus: "delivered",
                  actualDelivery: shipDeliveryAt,
                  deliveryLog: [...priorLog, { at: shipDeliveryAt, by: `staff:${String(session.name ?? "desk")}`, note: shipPod }],
                },
              });
              });
            }
          }
        } catch {
            return NextResponse.json({ error: "Order sync failed — shipment not changed" }, { status: 500 });
        }
      }
      const row = await prisma[PRISMA_MODELS[resource]].update({ where: { [PRIMARY_KEY[resource] ?? "id"]: id }, data: cleanPayload });
      // Dispute ruling tell (fire-and-forget, post-commit): both parties hear
      // the verdict with the outcome — rulings otherwise sit silent in the
      // desk while wallets move underneath.
      if (resource === "disputes" && (data as Record<string, unknown>).status === "resolved") {
        try {
          const ruled = await prisma.dispute.findUnique({ where: { id: String(id) } }).catch(() => null);
          const outcome = String((ruled as { outcome?: unknown } | null)?.outcome ?? (data as Record<string, unknown>).outcome ?? "");
          const ref = String((ruled as { orderId?: unknown } | null)?.orderId ?? "").trim();
          const outcomeCopy = outcome === "full_refund" ? "refunded in full" : outcome === "split_50_50" ? "split 50/50" : "released to the seller";
          if (ref) {
            const linked = await prisma.order.findFirst({
              where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
              select: { buyerUsername: true, sellerUsername: true, buyerName: true, sellerName: true, trackingNumber: true },
            }).catch(() => null);
            if (linked) {
              const tell = (username: unknown, userName: unknown, userHandle: unknown) =>
                notifyUser(prisma, {
                  username: String(username ?? ""), type: "order",
                  userName: "susej Disputes", userHandle: String(userHandle ?? ""),
                  action: `ruled on ${String((linked as { trackingNumber?: unknown }).trackingNumber ?? ref)}: ${outcomeCopy}`,
                  targetId: String((linked as { trackingNumber?: unknown }).trackingNumber ?? ref),
                });
              tell((linked as { buyerUsername?: unknown }).buyerUsername, (linked as { buyerName?: unknown }).buyerName, (linked as { buyerUsername?: unknown }).buyerUsername);
              tell((linked as { sellerUsername?: unknown }).sellerUsername, (linked as { sellerName?: unknown }).sellerName, (linked as { sellerUsername?: unknown }).sellerUsername);
            }
          }
        } catch {}
      }
      // Product moderation flows BACK to the app feed: hidden listings leave
      // the feed, featured ones get the boost, active restores published.
      if (resource === "products" && typeof data.status === "string" && String(id).startsWith("lst_")) {
        const postId = String(id).slice(4);
        const postStatus = data.status === "hidden" ? "hidden" : "published";
        await prisma.post.update({
          where: { id: postId },
          data: { status: postStatus, ...(data.status === "featured" ? { featured: true } : data.status === "active" ? { featured: false } : {}) },
        }).catch(() => {});
      }
            // Seller verification verdicts propagate to the app User row so the
      // in-app verified badge / seller mode follow the admin decision.
      // Store category corrections propagate the same way: one-shop-one-
      // category means User.category IS the shop category the app serves.
      // KYC/category propagation uses cleanPayload (sanitized), NOT raw `data`.
      // For admin role, cleanPayload is cleanAdminInput(data). For app role,
      // sanitizeSellerForApp forces kycStatus="pending" — preventing self-approval.
      const cp = cleanPayload as Record<string, unknown>;
      const cpKyc = typeof cp.kycStatus === "string" ? cp.kycStatus : null;
      const cpCat = typeof cp.category === "string" ? cp.category.trim() : null;
      if (resource === "sellers" && (cpKyc !== null || cpCat)) {
        const seller = await prisma.seller.findUnique({ where: { id } });
        if (!seller) {
          return NextResponse.json({ error: "Seller not found" }, { status: 404 });
        }
        const digits = (seller.phone ?? "").replace(/\D/g, "").slice(-10);
        if (!digits || digits.length < 4) {
          return NextResponse.json({ error: "Seller has no valid phone - cannot link User for KYC propagation", detail: `phone=${String(seller.phone ?? "")}` }, { status: 422 });
        }
        let linked: any = null;
        {
          const candidates: any[] = await (prisma as any).user.findMany({ where: { phone: { endsWith: digits } }, select: { id: true, phone: true, verification: true, category: true } });
          const match = candidates.find((u: any) => String(u.phone ?? "").replace(/\D/g, "").slice(-10) === digits);
          if (match) linked = match;
        }
        if (!linked) {
          return NextResponse.json({ error: "No User matched seller phone - KYC cannot propagate", detail: `seller phone digits=${digits}` }, { status: 422 });
        }
        if (cpKyc !== null && linked.verification !== cpKyc) {
          await prisma.user.update({
            where: { id: linked.id },
            data: {
              verification: cpKyc,
              ...(cpKyc === "approved" ? { isSeller: true, role: "both" } : {}),
              // Rejection revokes listing power: a rejected shop must not
              // keep posting through a stale isSeller:true (one-way valve
              // grants it at application time, KYC verdict rules after).
              ...(cpKyc === "rejected" ? { isSeller: false } : {}),
            },
          });
        }
        if (cpCat && linked.category !== cpCat) {
          await prisma.user.update({
            where: { id: linked.id },
            data: { category: cpCat },
          });
        }
      }
      // Build changed-field diff for audit — truncate to 1800 chars to fit column.
      // Callers (e.g. loyalty desk) may attach a top-level `reason` justification;
      // it rides the audit trail only, never the row write.
      let details = `Fields: ${Object.keys(data as object).join(", ")}`;
      const reasonText = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
      if (reasonText) details += ` | reason: ${reasonText.slice(0, 1600)}`;
      if (before) {
        const diffs: string[] = [];
        // Credential-bearing fields never land in the audit trail (F14):
        // sessions tokens + app-settings secrets would sit plaintext in
        // auditLog.details (readable via super_admin reads/exports). Seller
        // KYC identity (phone/bank/PAN/ID/selfie) gets the same treatment —
        // the row itself stays readable; the diff must not duplicate PII.
        const AUDIT_REDACTED = new Set(["token", "value", "secret", "password", "passwordHash", "twoFactorCode", "phone", "bankAccount", "pan", "idNumber", "nameOnId", "dob", "selfieUrl", "idDocUrl", "idBackUrl", "addrProofUrl", "gstCertUrl", "logoUrl", "taxId", "gstin", "aadhaar"]);
        for (const k of Object.keys(data as object)) {
          const oldV = (before as any)[k];
          const newV = (cleanPayload as any)[k] ?? (data as any)[k];
          if (String(oldV ?? "") !== String(newV ?? "")) {
            if (AUDIT_REDACTED.has(k)) {
              diffs.push(`${k}: '[redacted]' -> '[redacted]'`);
              continue;
            }
            const o = String(oldV ?? "").slice(0, 80);
            const n = String(newV ?? "").slice(0, 80);
            diffs.push(`${k}: '${o}' -> '${n}'`);
          }
        }
        if (diffs.length) details += ` | ${diffs.join("; ").slice(0, 1600)}`;
      }
      await writeAuditSafe({
        action: "data.update",
        entity: resource,
        entityId: String(id),
        details,
        adminName: session.name,
        ip: getClientIp(request),
      });
      return NextResponse.json({ row: serialize(row, resource) });
    } catch (err) {
      // DB error — surface it, never fake success
      if (process.env.NODE_ENV !== "production") {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "Database unavailable — change not saved", detail: msg.slice(0, 1500) }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ error: "Database unavailable — change not saved" }, { status: 503 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const ip = getClientIp(request);
  if (!checkWriteRate(ip)) return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  const session = await parseWriteSession(request);
  if (!session) return unauthorized();
  const role = normalizeRole(session.role as string);
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  // Paid rails are engine-sold inventory (purchases mint the rows): direct
  // creation by staff re-creates the orphan/money-for-nothing hole the sweep
  // cleans. Super_admin break-glass only (audited); the desk kill-switch
  // (status toggles) stays available to manager/finance via PATCH below.
  const PAID_RAILS = new Set(["top-sellers", "hot-deals", "featured-posts", "spotlights"]);
  if (PAID_RAILS.has(resource) && (role === "manager" || role === "finance" || role === "moderator" || role === "app")) {
    return forbidden("Paid rails are sold by the promotions engine — staff can hide/show rows, not mint them.");
  }
  // Moderator dispute scope is triage-only (PATCH under_review): creating or
  // deleting dispute rows is manager/super_admin territory.
  if (resource === "disputes" && role === "moderator") {
    return NextResponse.json({ error: "Moderators can triage disputes (mark under review) — creating them needs a manager." }, { status: 403 });
  }

  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const postValidationErr = validateResourcePayload(resource, body as Record<string, unknown>);
  if (postValidationErr) return NextResponse.json({ error: postValidationErr }, { status: 400 });

  let appScopedBody: Record<string, unknown> | null = null;
  if (role === "app") {
    const appUser = (session as unknown as { appUser: Record<string, unknown> }).appUser;
    if (!appUser) return unauthorized();
    const raw = body as Record<string, unknown>;
    if (resource === "storefront-banners") {
      // Only approved sellers can publish hero banners — a buyer must never
      // inject marketing content into the home feed.
      if (!(appUser as { isSeller?: boolean }).isSeller) {
        return forbidden("Only approved sellers can manage storefront banners");
      }
      appScopedBody = { id: raw.id, ...sanitizeStorefrontBannerForApp(raw, appUser) };
    }
    else if (resource === "sellers") {
      appScopedBody = sanitizeSellerForApp(raw, appUser);
      const kycErr = kycFormatError(appScopedBody);
      if (kycErr) return NextResponse.json({ error: kycErr }, { status: 400 });
    }
    else if (resource === "promotions") appScopedBody = sanitizePromotionForApp(raw, appUser);
        else if (resource === "orders") appScopedBody = sanitizeOrderForApp(raw, appUser);
    else if (resource === "tickets") {
      appScopedBody = sanitizeTicketForApp(raw, appUser);
      // New tickets are always open (required field): the sanitizer strips
      // status because the desk owns all transitions.
      appScopedBody.status = "open";
    }
    else if (resource === "messages") appScopedBody = sanitizeMessageForApp(raw, appUser);
    if (resource === "messages") {
      // Thread scoping: app callers may only post into their OWN support
      // ticket threads — previously any authed user could inject messages as
      // themselves into ANY threadId (chat threads included).
      const threadId = String((appScopedBody as Record<string, unknown>).threadId ?? "").trim();
      const callerName = String(appUser.name ?? appUser.username ?? "").trim();
      if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });
      try {
        const prismaTmp = (await resolveDb()) as any;
        const ticket = prismaTmp
          ? await prismaTmp.supportTicket.findUnique({ where: { id: threadId } })
          : null;
        if (!ticket || String(ticket.userName ?? "") !== callerName) {
          return forbidden("Messages can only be posted to your own support tickets.");
        }
      } catch {
        return NextResponse.json({ error: "Could not verify thread ownership" }, { status: 503 });
      }
    }
    else if (resource === "refunds") appScopedBody = sanitizeRefundForApp(raw, appUser);
    // Withdrawals are excluded from app writes entirely (see APP_SYNC_RESOURCES):
    // payout requests come only from the transactional wallet endpoint.
    // Order ownership guard: sellerUsername must not be spoofable (now excluded from whitelist)
  }

  const payload =
    resource === "admins"
      ? cleanAdminInput(body, role, true, { id: session.sub, loginId: session.loginId })
      : appScopedBody ?? body;
  if (payload instanceof NextResponse) return payload;
  let cleanPayloadPost: Record<string, unknown> = normalizeRelationArrays(payload as Record<string, unknown>);
  if (resource === "users") {
    const blockedPost = new Set(["walletBalance", "loyaltyPoints", "passwordHash"]);
    for (const k of Object.keys(cleanPayloadPost)) if (blockedPost.has(k)) delete (cleanPayloadPost as any)[k];
  }

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      // Ticket id squat guard: the app sends its local ticket id (the opener
      // message joins on it), so the id must stay client-settable — but a row
      // with that id belonging to ANOTHER requester 409s instead of P2002ing
      // into a 503 id-existence oracle.
      if (resource === "tickets" && role === "app" && cleanPayloadPost.id) {
        const clash = await prisma.supportTicket.findUnique({ where: { id: String(cleanPayloadPost.id) } }).catch(() => null);
        const appU = (session as unknown as { appUser?: Record<string, unknown> }).appUser ?? {};
        const callerName = String(appU.name ?? appU.username ?? "").trim();
        if (clash && callerName && String((clash as { userName?: unknown }).userName ?? "") !== callerName) {
          return NextResponse.json({ error: "Ticket id already in use — retry with a fresh ticket." }, { status: 409 });
        }
      }
      // KYC resubmission: a seller application is idempotent per user. If the
      // caller-owned row already exists (id = app_<username>), update it instead
      // of failing with a unique-violation misreported as "Database unavailable".
      if (resource === "sellers" && role === "app" && cleanPayloadPost.id) {
        const existing = await prisma.seller.findUnique({ where: { id: String(cleanPayloadPost.id) } });
        if (existing) {
          // Re-submission resets a rejected/suspended application to pending for
          // re-review, but NEVER silently re-approves or modifies an approved one.
          // Live counters survive: the create-lane defaults (score/productsCount
          // 0, fresh joinedAt) used to zero an approved row's earned values.
          const resetStatus = ["rejected", "suspended", "pending"].includes(String(existing.kycStatus));
          const { score: _dropScore, productsCount: _dropCount, totalSales: _dropSales, rating: _dropRating, reviewCount: _dropReviews, joinedAt: _dropJoined, ...resubmit } = cleanPayloadPost as Record<string, unknown>;
          void _dropScore; void _dropCount; void _dropSales; void _dropRating; void _dropReviews; void _dropJoined;
          const patch = { ...resubmit, kycStatus: resetStatus ? "pending" : existing.kycStatus, gstStatus: resetStatus ? "pending" : existing.gstStatus, submittedAt: new Date().toISOString() };
          const row = await prisma.seller.update({ where: { id: String(cleanPayloadPost.id) }, data: patch });
          await writeAuditSafe({ action: "data.create", entity: resource, entityId: String(row.id ?? ""), details: "Seller KYC resubmitted (upsert)", adminName: session.name, ip: getClientIp(request) });
          return NextResponse.json({ row: serialize(row, resource) });
        }
      }
      // Staff POST orders with a seller binding: the display name always
      // resolves server-side and the target must be a seller account (F11 —
      // the POST path had zero attribution guards).
      if (resource === "orders" && role !== "app" && (cleanPayloadPost as Record<string, unknown>).sellerUsername !== undefined) {
        const target = String((cleanPayloadPost as Record<string, unknown>).sellerUsername ?? "").trim();
        if (!target) return NextResponse.json({ error: "sellerUsername is required" }, { status: 400 });
        const sellerUser = await prisma.user.findUnique({ where: { username: target } }).catch(() => null);
        if (!sellerUser || !(sellerUser as { isSeller?: boolean }).isSeller) {
          return NextResponse.json({ error: "Username is not an approved seller account." }, { status: 400 });
        }
        (cleanPayloadPost as Record<string, unknown>).sellerUsername = target;
        (cleanPayloadPost as Record<string, unknown>).sellerName =
          (sellerUser as { businessName?: string; name?: string }).businessName ||
          (sellerUser as { name?: string }).name ||
          target;
      }
      // Staff POST orders are settlement-safe by construction (P0 mint fix):
      // status/paymentStatus/amount are FORCED (placed/pending/0) — a hand-set
      // delivered+paid+amount row would mint withdrawable earnings with no
      // buyer debit behind it. Real money enters only via app placement and
      // settles via the guarded PATCH machines. sellerUsername required (no
      // new unattributed rows through this lane). itemsList legs are STRIPPED
      // (price/netPrice/commission): the staff deliver machine prices from
      // before.itemsList, so crafted legs on a 0-amount row would still mint
      // seller credit with no debit. Names/qty stay for the record.
      if (resource === "orders" && role !== "app") {
        const target = String((cleanPayloadPost as Record<string, unknown>).sellerUsername ?? "").trim();
        if (!target) return NextResponse.json({ error: "sellerUsername is required" }, { status: 400 });
        const sellerUser = await prisma.user.findUnique({ where: { username: target } }).catch(() => null);
        if (!sellerUser || !(sellerUser as { isSeller?: boolean }).isSeller) {
          return NextResponse.json({ error: "Username is not an approved seller account." }, { status: 400 });
        }
        (cleanPayloadPost as Record<string, unknown>).sellerUsername = target;
        (cleanPayloadPost as Record<string, unknown>).sellerName =
          (sellerUser as { businessName?: string; name?: string }).businessName ||
          (sellerUser as { name?: string }).name ||
          target;
        (cleanPayloadPost as Record<string, unknown>).status = "placed";
        (cleanPayloadPost as Record<string, unknown>).deliveryStatus = "awaiting_shipment";
        (cleanPayloadPost as Record<string, unknown>).paymentStatus = "pending";
        (cleanPayloadPost as Record<string, unknown>).amount = 0;
        const rawLines = (cleanPayloadPost as Record<string, unknown>).itemsList;
        if (Array.isArray(rawLines)) {
          (cleanPayloadPost as Record<string, unknown>).itemsList = rawLines.map((l) => {
            if (!l || typeof l !== "object") return l;
            const line = l as Record<string, unknown>;
            return {
              name: typeof line.name === "string" ? line.name.slice(0, 200) : "Item",
              qty: Math.max(1, Math.round(Number((line as { qty?: unknown; quantity?: unknown }).qty ?? (line as { quantity?: unknown }).quantity ?? 1))),
              ...(typeof line.listingId === "string" ? { listingId: line.listingId.slice(0, 80) } : {}),
            };
          });
        }
      }
      // Top-seller rails: ghost rows (no User, no orders) render a fabricated
      // store with 0 sales via the serve-time fallback (F13). POST requires a
      // real seller account, rejects duplicates, and caps the rail at 3.
      if (resource === "top-sellers" && role !== "app") {
        // The desk picker sends Seller.id (`app_<username>`); the promo engine
        // sends username. Accept both — resolve to the username either way.
        const rawSellerId = String((cleanPayloadPost as Record<string, unknown>).sellerId ?? "").trim();
        const sellerId = rawSellerId.startsWith("app_") ? rawSellerId.slice(4) : rawSellerId;
        if (!sellerId) return NextResponse.json({ error: "sellerId is required" }, { status: 400 });
        const sellerUser = await prisma.user.findUnique({ where: { username: sellerId } }).catch(() => null);
        if (!sellerUser || !(sellerUser as { isSeller?: boolean }).isSeller) {
          return NextResponse.json({ error: "sellerId must be an approved seller account." }, { status: 400 });
        }
        const dupe = await prisma.topSeller.findFirst({ where: { sellerId } }).catch(() => null);
        if (dupe) return NextResponse.json({ error: "Seller is already on the top-sellers rail." }, { status: 409 });
        const railCount = await prisma.topSeller.count().catch(() => 0);
        if (railCount >= 3) return NextResponse.json({ error: "Top-sellers rail is capped at 3 — remove one first." }, { status: 409 });
        (cleanPayloadPost as Record<string, unknown>).sellerId = sellerId;
        (cleanPayloadPost as Record<string, unknown>).sellerName =
          (sellerUser as { businessName?: string; name?: string }).businessName ||
          (sellerUser as { name?: string }).name ||
          sellerId;
      }
      // Hot-deal rails: ghost productIds render a fabricated deal card, dupes
      // stack the same product, and N>3 breaks the rail contract (serve caps
      // at 3). Same ghost/dupe/cap discipline as top-sellers. NOTE: staff
      // creation is super_admin-only (paid-rail gate above); this validates
      // shape for engine + break-glass rows.
      if (resource === "hot-deals" && role !== "app") {
        const productId = String((cleanPayloadPost as Record<string, unknown>).productId ?? "").trim();
        if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
        const stripped = productId.startsWith("lst_") ? productId.slice(4) : productId;
        const [postHit, productHit] = await Promise.all([
          prisma.post.findUnique({ where: { id: stripped } }).catch(() => null),
          prisma.product.findUnique({ where: { id: productId } }).catch(() => null),
        ]);
        if (!postHit && !productHit) {
          return NextResponse.json({ error: "productId must be a real listing or product." }, { status: 400 });
        }
        const dupe = await prisma.hotDeal.findFirst({ where: { productId } }).catch(() => null);
        if (dupe) return NextResponse.json({ error: "Product is already on the hot-deals rail." }, { status: 409 });
        const railCount = await prisma.hotDeal.count().catch(() => 0);
        if (railCount >= 3) return NextResponse.json({ error: "Hot-deals rail is capped at 3 — remove one first." }, { status: 409 });
      }
      // App refund queue is not a free-text drop: the orderRef must resolve to
      // a real order involving the caller, or the finance queue fills with
      // zero-amount orphans that page sellers for nothing.
      if (resource === "refunds" && role === "app") {
        const ref = String((cleanPayloadPost as Record<string, unknown>).orderRef ?? "").trim().replace(/^#/, "");
        const caller = String(((session as unknown as { appUser?: Record<string, unknown> }).appUser as { username?: unknown } | undefined)?.username ?? "").trim();
        const linked = ref
          ? await prisma.order.findFirst({
              where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }, { trackingNumber: `#${ref}` }, { orderNumber: `#${ref}` }] },
            }).catch(() => null)
          : null;
        if (!linked) return NextResponse.json({ error: "Order not found — refunds start from a real order." }, { status: 400 });
        const parties = [String((linked as { buyerUsername?: unknown }).buyerUsername ?? ""), String((linked as { sellerUsername?: unknown }).sellerUsername ?? "")];
        if (!caller || !parties.includes(caller)) {
          return NextResponse.json({ error: "Not your order." }, { status: 403 });
        }
        (cleanPayloadPost as Record<string, unknown>).orderRef = String((linked as { trackingNumber?: unknown }).trackingNumber ?? ref);
        // Server-stamped (client timestamps left the whitelist with P3-2).
        (cleanPayloadPost as Record<string, unknown>).requestedAt = new Date();
        // Seller identity from the linked order (sanitizeRefundForApp forces
        // buyerName from the token but nothing set sellerName — required
        // column, so every data-lane app refund 500d as P2012).
        (cleanPayloadPost as Record<string, unknown>).sellerName = String((linked as { sellerName?: unknown }).sellerName ?? "");
      }
      const row = await prisma[PRISMA_MODELS[resource]].create({ data: cleanPayloadPost });
      // Ticket body without a column: SupportTicket has no description field
      // (schema change needed for one), so the app's description rides as the
      // thread's first Message row — otherwise every app ticket arrives
      // content-less and the desk sees empty threads. Best-effort: never fails
      // the ticket itself.
      if (resource === "tickets" && role === "app") {
        try {
          const desc = String((body as Record<string, unknown>).description ?? (body as Record<string, unknown>).message ?? "").trim().slice(0, 2000);
          if (desc) {
            const sender = String(((session as unknown as { appUser?: Record<string, unknown> }).appUser as { username?: unknown } | undefined)?.username ?? "user");
            await prisma.message.create({
              data: { threadId: String((row as { id?: unknown }).id ?? ""), sender, senderRole: "user", body: desc, createdAt: new Date() },
            });
          }
        } catch {}
      }
      await writeAuditSafe({
        action: "data.create",
        entity: resource,
        entityId: String(row.id ?? ""),
        details: "Created record",
        adminName: session.name,
        ip: getClientIp(request),
      });
      return NextResponse.json({ row: serialize(row, resource) });
    } catch (err) {
      // DB error — surface it, never fake success
      if (process.env.NODE_ENV !== "production") {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "Database unavailable — record not created", detail: msg.slice(0, 1500) }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ error: "Database unavailable — record not created" }, { status: 503 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const ip = getClientIp(request);
  if (!checkWriteRate(ip, 30)) return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });
  const session = await parseWriteSession(request);
  if (!session) return unauthorized();
  const role = normalizeRole(session.role as string);
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  // Paid rails are engine-owned (mirrors PATCH/POST gates): staff DELETE
  // would vaporize sold inventory with the purchase still active. Managers
  // and below cannot DELETE paid rails at all — hide via status instead.
  // Super_admin can only delete non-active rows; active rows must go through
  // the promotions refund path (which unpins + credits).
  // Moderator dispute scope is triage-only: no DELETE (see PATCH/POST gates).
  {
    const PAID_DELETE = new Set(["top-sellers", "hot-deals", "featured-posts", "spotlights"]);
    if (PAID_DELETE.has(resource) && role !== "super_admin") {
      return NextResponse.json({ error: "Paid rails are engine-owned — hide via status, never delete." }, { status: 403 });
    }
    if (resource === "disputes" && role === "moderator") {
      return NextResponse.json({ error: "Moderators can triage disputes — deleting them needs a manager." }, { status: 403 });
    }
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (resource === "admins") {
    if (session.sub === id) return forbidden("You cannot delete your own account.");
  }

  // Industry: hard delete is destructive and non-recoverable. Default to soft-delete
  // (status=hidden/deleted) for entity tables; require ?hard=true for physical delete.
  const url = new URL(request.url);
  const hardDelete = url.searchParams.get("hard") === "true";
  // NOTE: sellers are intentionally NOT soft-deletable: the Seller model has
  // no status column, so flipping status="deleted" 500'd every time ("record
  // not deleted"). Seller removal is hard-delete-only via ?hard=true, guarded
  // below by the evidence check (products/orders/documents/audit rows 409).
  const SOFT_DELETE_MAP: Record<string, string> = {
    products: "deleted",
    orders: "deleted",
    users: "deleted",
    categories: "hidden",
    communities: "hidden",
    posts: "hidden",
  };
  const softStatus = SOFT_DELETE_MAP[resource];
  if (role === "app" && resource === "storefront-banners") {
    const appUser = (session as unknown as { appUser: Record<string, unknown> }).appUser;
    if (!appUser) return unauthorized();
    const prismaTmp = (await resolveDb()) as any;
    if (prismaTmp) {
      try {
        const existing = await prismaTmp.storefrontBanner.findUnique({ where: { id: String(id) } });
        if (existing && String(existing.sellerUsername) !== String(appUser.username ?? "")) {
          return forbidden("Banner belongs to another seller.");
        }
      } catch {}
    }
  }
  if (role === "app" && resource === "sellers") {
    const appUser = (session as unknown as { appUser: Record<string, unknown> }).appUser;
    const username = String(appUser?.username ?? "").trim();
    if (username && String(id) !== `app_${username}`) return forbidden("Seller record belongs to another user.");
  }
  // Ownership checks for all app-writable resources in DELETE.
  // Without these, any authenticated app user could delete ANY record.
  if (role === "app") {
    const appUser = (session as unknown as { appUser: Record<string, unknown> }).appUser;
    if (!appUser) return unauthorized();
    const prismaTmp = (await resolveDb()) as any;
    if (prismaTmp) {
      try {
        const uid = String(appUser.username ?? "").trim();
        const uname = String(appUser.name ?? appUser.username ?? "").trim();
        if (resource === "orders") {
          const rec = await prismaTmp.order.findUnique({ where: { id: String(id) } });
          if (rec && rec.buyerUsername !== uid && rec.sellerUsername !== uid) return forbidden("Order belongs to another user.");
        } else if (resource === "tickets") {
          const rec = await prismaTmp.supportTicket.findUnique({ where: { id: String(id) } });
          if (rec && rec.userName !== uname) return forbidden("Ticket belongs to another user.");
        } else if (resource === "messages") {
          const rec = await prismaTmp.message.findUnique({ where: { id: String(id) } });
          if (rec && rec.sender !== uname) return forbidden("Message belongs to another user.");
        } else if (resource === "refunds") {
          const rec = await prismaTmp.refund.findUnique({ where: { id: String(id) } });
          if (rec && rec.buyerName !== uname) return forbidden("Refund belongs to another user.");
        } else if (resource === "withdrawals") {
          const rec = await prismaTmp.withdrawal.findUnique({ where: { id: String(id) } });
          if (rec && rec.userName !== uname) return forbidden("Withdrawal belongs to another user.");
        } else if (resource === "promotions") {
          const rec = await prismaTmp.promotionPurchase.findUnique({ where: { id: String(id) } });
          if (rec && rec.sellerId !== uid) return forbidden("Promotion belongs to another seller.");
        }
      } catch {}
    }
  }

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      if (resource === "admins") {
        const target = await prisma.admin.findUnique({ where: { id: String(id) }, select: { role: true } });
        if (target?.role === "super_admin") {
          const superAdmins = await prisma.admin.count({ where: { role: "super_admin" } });
          if (superAdmins <= 1) return forbidden("Cannot delete the last Super Admin.");
        }
      }
      if (resource === "categories") {
        const childCount = await prisma.category.count({ where: { parentId: String(id) } });
        if (childCount > 0) return NextResponse.json({ error: "Category has children - delete or move them first." }, { status: 400 });
      }
      // Soft-delete default: flip status so row stays recoverable + audit retains entity.
      if (softStatus && !hardDelete) {
        const existing = await prisma[PRISMA_MODELS[resource]].findUnique({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } }).catch(() => null);
        if (existing) {
          await prisma[PRISMA_MODELS[resource]].update({ where: { [PRIMARY_KEY[resource] ?? "id"]: id }, data: { status: softStatus } as any });
          if (resource === "products" && String(id).startsWith("lst_")) {
            const postId = String(id).slice(4);
            await prisma.post.update({ where: { id: postId }, data: { status: "hidden" } }).catch(() => {});
          }
          await writeAuditSafe({
            action: "data.soft_delete",
            entity: resource,
            entityId: String(id),
            details: `Soft-deleted via status=${softStatus} (use ?hard=true to permanently delete)`,
            adminName: session.name,
            ip: getClientIp(request),
          });
          return NextResponse.json({ success: true, softDeleted: true, status: softStatus });
        }
      }
      // Unblock parity: removing a blocked/banned row must also lift the ban
      // on the User row — otherwise the user stays banned everywhere except
      // this list (unblock was label-only). Matches exact username, else a
      // provably-unique display name; other statuses (active, deleted) untouched.
      if (resource === "blocked") {
        try {
          const rec = await prisma.blockedUser.findUnique({ where: { id: String(id) } }).catch(() => null);
          const key = String((rec as { userName?: unknown } | null)?.userName ?? "").trim();
          if (key) {
            const byUsername = await prisma.user.findUnique({ where: { username: key } }).catch(() => null);
            let target: { id: string; status: string } | null = (byUsername as { id: string; status: string } | null) ?? null;
            if (!target) {
              const sameName = await prisma.user.count({ where: { name: key } }).catch(() => 2);
              if (sameName === 1) {
                target = (await prisma.user.findFirst({ where: { name: key } }).catch(() => null)) as typeof target;
              }
            }
            if (target && ["banned", "suspended"].includes(String(target.status ?? ""))) {
              await prisma.user.update({ where: { id: target.id }, data: { status: "active" } }).catch(() => {});
            }
          }
        } catch {}
      }
      // Hard-delete orphan guards: money/social rows key by raw username
      // strings with zero FK constraints, so physical deletes must be
      // refused while dependents exist (soft-delete stays always available).
      // Sellers have no soft-delete path (no status column), so EVERY seller
      // DELETE is physical and always guarded.
      if ((hardDelete || resource === "sellers") && (resource === "users" || resource === "sellers" || resource === "products")) {
        try {
          if (resource === "users") {
            const u = await prisma.user.findUnique({ where: { id: String(id) }, select: { username: true } });
            const uname = u?.username ? String(u.username) : null;
            if (uname) {
              const [orders, txns, posts, threads] = await Promise.all([
                prisma.order.count({ where: { OR: [{ buyerUsername: uname }, { sellerUsername: uname }] } }),
                prisma.walletTransaction.count({ where: { username: uname } }),
                prisma.post.count({ where: { authorUsername: uname } }),
                prisma.chatThread.count({ where: { OR: [{ participantA: uname }, { participantB: uname }] } }),
              ]);
              const parts = [
                orders ? `${orders} orders` : "",
                txns ? `${txns} wallet transactions` : "",
                posts ? `${posts} posts` : "",
                threads ? `${threads} chat threads` : "",
              ].filter(Boolean);
              if (parts.length) {
                return NextResponse.json(
                  { error: `User owns live data (${parts.join(", ")}). Soft-delete instead, or reassign first.` },
                  { status: 409 }
                );
              }
            }
          } else if (resource === "sellers") {
            // Live-data guard keyed on EXACT username where possible: Post rows
            // carry authorUsername (stable identity); Product/Order rows carry
            // only the mutable display sellerName, so those stay exact-match
            // (never contains — similar business names false-refused deletes
            // while renamed sellers slipped through). The row id itself is
            // app_<username> for app-filed applications — strongest key.
            const rowId = String(id);
            const unameFromId = rowId.startsWith("app_") ? rowId.slice(4) : "";
            const s = await prisma.seller.findUnique({ where: { id: rowId }, select: { businessName: true } });
            const biz = s?.businessName ? String(s.businessName) : null;
            const [postCount, products, orders] = await Promise.all([
              unameFromId
                ? prisma.post.count({ where: { authorUsername: unameFromId } }).catch(() => 0)
                : Promise.resolve(0),
              biz
                ? prisma.product.count({ where: { sellerName: biz } }).catch(() => 0)
                : Promise.resolve(0),
              biz
                ? prisma.order.count({ where: { sellerName: biz } }).catch(() => 0)
                : Promise.resolve(0),
            ]);
            if (postCount || products || orders) {
              return NextResponse.json(
                { error: `Seller has live data (${postCount} listings, ${products} products, ${orders} orders). Soft-delete instead.` },
                { status: 409 }
              );
            }
            // KYC evidence is irreplaceable: SellerDocument + SellerAuditLog
            // rows cascade-delete with the seller, so a hard delete while any
            // exist vaporizes the review trail (this is how applications
            // "vanished" with only a one-line audit entry left behind).
            const [docCount, logCount] = await Promise.all([
              prisma.sellerDocument.count({ where: { sellerId: String(id) } }),
              prisma.sellerAuditLog.count({ where: { sellerId: String(id) } }),
            ]);
            if (docCount || logCount) {
              return NextResponse.json(
                { error: `Seller has review evidence (${docCount} documents, ${logCount} audit entries). Reject the application instead — deleting destroys it.` },
                { status: 409 }
              );
            }
          }
        } catch {
          // Fail CLOSED: if the dependent check itself errors, refuse the
          // destructive op rather than deleting blind.
          return NextResponse.json({ error: "Could not verify dependents — delete refused" }, { status: 503 });
        }
      }
      // Active paid placement guard (super_admin included): deleting an
      // active rail row orphans a live paid slot with the purchase still
      // active (unbillable, unrefundable). Hide via status or refund the
      // purchase via the promotions desk instead.
      if (resource === "top-sellers" || resource === "hot-deals" || resource === "featured-posts" || resource === "spotlights") {
        try {
          const rail = await prisma[PRISMA_MODELS[resource]].findUnique({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } }).catch(() => null);
          if (rail && String((rail as { status?: unknown }).status ?? "") === "active") {
            return NextResponse.json({ error: "Active paid placement — hide via status or refund the purchase; delete is refused." }, { status: 409 });
          }
        } catch {}
      }
      if (resource === "promotions") {
        try {
          const promo = await prisma.promotionPurchase.findUnique({ where: { id: String(id) } }).catch(() => null);
          if (promo && String((promo as { status?: unknown }).status ?? "") === "active") {
            return NextResponse.json({ error: "Active campaign — end/refund via the promotions desk so rails unpin; delete is refused." }, { status: 409 });
          }
        } catch {}
      }
      await prisma[PRISMA_MODELS[resource]].delete({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } });
      if (resource === "products" && String(id).startsWith("lst_")) {
        const postId = String(id).slice(4);
        await prisma.post.delete({ where: { id: postId } }).catch(() => {});
      }
      // Seller identity reset: seller rows are id-keyed `app_<username>`, so
      // deleting the row without touching the linked User left a ghost seller
      // login (isSeller + role both + approved verification, zero record).
      let identityNote = "";
      if (resource === "sellers" && String(id).startsWith("app_")) {
        const uname = String(id).slice(4);
        try {
          const linked = await prisma.user.findUnique({ where: { username: uname }, select: { id: true, role: true } });
          if (linked) {
            await prisma.user.update({
              where: { id: linked.id },
              data: {
                isSeller: false,
                verification: "none",
                ...(linked.role === "both" ? { role: "buyer" } : {}),
              },
            });
            identityNote = ` Linked @${uname} reset to buyer.`;
          }
        } catch {
          identityNote = ` Linked @${uname} reset FAILED — clear isSeller manually.`;
        }
      }
      await writeAuditSafe({
        action: "data.delete",
        entity: resource,
        entityId: String(id),
        details: `Deleted record.${identityNote}`,
        adminName: session.name,
        ip: getClientIp(request),
      });
      return NextResponse.json({ success: true });
    } catch {
      // DB error — surface it, never fake success
    }
  }

  return NextResponse.json({ error: "Database unavailable — record not deleted" }, { status: 503 });
}
