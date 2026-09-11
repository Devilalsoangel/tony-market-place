import { NextRequest, NextResponse } from "next/server";
import { getPrisma as resolveDb } from "@/lib/db";
import { verifySessionToken, hashPassword, SESSION_COOKIE, getClientIp } from "@/lib/auth";
import { checkAppKey } from "@/lib/promotions/api-auth";
import { lazySweep } from "@/lib/promotions/activate";
import { getAppUser } from "@/lib/app-auth";
import { resolveCommissionRate, settlementGoodsBasis, settledFeeFromLegs } from "@/lib/commission";

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
const MODERATOR_RESOURCES = new Set(["communities", "reviews", "tickets"]);
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

function readAllowed(resource: string, role: Role): boolean {
  if (role === "app") return false; // the app never reads admin data
  if (role === "super_admin" || role === "manager") return true;
  if (role === "finance") return true; // desk needs cross-table reads to rule
  return MODERATOR_RESOURCES.has(resource);
}

function writeAllowed(resource: string, role: Role): boolean {
  if (role === "app") return APP_SYNC_RESOURCES.has(resource);
  if (role === "super_admin") return !READ_ONLY_RESOURCES.has(resource);
  if (role === "manager") return !READ_ONLY_RESOURCES.has(resource) && resource !== "admins";
  if (role === "finance") return FINANCE_RESOURCES.has(resource);
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
 * Returns null when execution may proceed, else an error message.
 */
async function makerCheck(
  prisma: any,
  entity: string,
  entityId: string,
  me: string
): Promise<string | null> {
  try {
    const admins: { role: string }[] = await prisma.admin.findMany({ select: { role: true } });
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
    if (!prior) return "Dual control: a different admin must approve first (no prior approval on record).";
    return null;
  } catch {
    return "Could not verify dual control — execution refused";
  }
}

/** Count finance-eligible admins (for the sole-approver audit flag). */
async function financeApproverCount(prisma: any): Promise<number> {
  try {
    const admins: { role: string }[] = await prisma.admin.findMany({ select: { role: true } });
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
  const admin = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (admin) return admin as { sub: string; name: string; role: Role; loginId: string; appUser?: unknown };
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

function sanitizeSellerForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SELLER_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  // Phone/email prefer the verified token identity when present.
  const tokenPhone = String((appUser as { phone?: unknown }).phone ?? "").replace(/\D/g, "");
  if (tokenPhone) out.phone = tokenPhone;
  else if (typeof out.phone === "string") out.phone = String(out.phone).replace(/\D/g, "");
  const tokenEmail = String((appUser as { email?: unknown }).email ?? "").trim();
  if (tokenEmail && !out.email) out.email = tokenEmail;
  // Force server-controlled verification state - app can never self-approve.
  out.kycStatus = "pending";
  out.gstStatus = "pending";
  // Never trust client-supplied scores or counters.
  delete (out as Record<string, unknown>).score;
  delete (out as Record<string, unknown>).productsCount;
  delete (out as Record<string, unknown>).totalSales;
  delete (out as Record<string, unknown>).rating;
  delete (out as Record<string, unknown>).reviewCount;
  // Server-side defaults for required Seller columns the app never supplies.
  // (Previously a bare KYC submission 500'd: Prisma "Argument logo is missing".)
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
  const ALLOWED = new Set(["items", "itemsList", "shippingAddress", "address", "label", "type", "name", "phone", "street", "city", "sellerName", "paymentMethod", "trackingNumber", "orderNumber"]);
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

const MESSAGE_APP_FIELDS = new Set(["threadId", "sender", "senderRole", "body", "createdAt"]);
function sanitizeMessageForApp(raw: Record<string, unknown>, appUser: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of MESSAGE_APP_FIELDS) if (raw[k] !== undefined) out[k] = raw[k];
  const userName = String(appUser.name ?? appUser.username ?? "").trim();
  if (userName) out.sender = userName;
  return out;
}

const REFUND_APP_FIELDS = new Set(["id", "orderRef", "reason", "requestedAt", "respondedAt"]);
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
  const session = parseSession(request);
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
  const takeRaw = url.searchParams.get("take") ?? url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? "";
  const skipRaw = url.searchParams.get("skip") ?? url.searchParams.get("offset") ?? "";
  const pageRaw = url.searchParams.get("page") ?? "";
  const orderByKey = url.searchParams.get("orderBy") ?? url.searchParams.get("sortBy") ?? url.searchParams.get("sort") ?? "";
  const orderDir = (url.searchParams.get("orderDir") ?? url.searchParams.get("sortDir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  let take = takeRaw ? Math.min(Math.max(parseInt(takeRaw, 10) || 0, 1), 100) : 0;
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
  };
  const fields = SEARCH_FIELDS[resource] ?? [];
  const where: Record<string, unknown> = {};
  if (statusFilter) (where as any).status = statusFilter;
  if (q && fields.length) {
    (where as any).OR = fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
  }
  const orderBy = orderByKey ? { [orderByKey]: orderDir } : undefined;
  const hasPagination = take > 0 || skip > 0 || !!q || !!statusFilter || !!orderByKey;

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      await lazySweep();
      // Merge EXTENDED include/select with pagination where/orderBy
      const base = (EXTENDED[resource] ?? {}) as Record<string, unknown>;
      const findArgs: Record<string, unknown> = { ...base };
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
    } catch {
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
  opts: { actor: string; superAdmin: boolean }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const fail = (error: string, status: number) => ({ ok: false as const, error, status });
  const row = await prisma.refund.findUnique({ where: { id: String(refundId) } });
  if (!row) return fail("Refund not found", 404);
  const rawCurrent = String(row.status ?? "requested");
  const okTransition =
    (rawCurrent === "requested" && ["approved", "rejected", "refunded"].includes(nextStatus)) ||
    (rawCurrent === "approved" && ["refunded", "rejected"].includes(nextStatus));
  if (!okTransition) {
    return fail(
      `Invalid refund transition '${rawCurrent}' -> '${nextStatus}'. Allowed: requested→approved/rejected/refunded, approved→refunded/rejected.`,
      409
    );
  }
  if (rawCurrent === "requested" && nextStatus === "refunded" && !opts.superAdmin) {
    return fail("Mark approved first — only a Super Admin may refund in one step.", 409);
  }
  if (nextStatus === "refunded") {
    const block = await makerCheck(prisma, "refunds", String(row.id), opts.actor);
    if (block) return fail(block, 409);
  }
  if (nextStatus === "approved" || nextStatus === "refunded") {
    try {
      const tracking = String(row.orderRef ?? "").trim();
      if (tracking) {
        const order = await prisma.order.findFirst({ where: { trackingNumber: tracking } });
        if (order) {
          const method = String(order.paymentMethod ?? "");
          const isCod = /cash|cod/i.test(method);
          const paysWallet = method.toLowerCase() === "wallet";
          const refundTitle = `Order refund · ${tracking}`;
          const clawTitle = `Order refund clawback · ${tracking}`;
          const alreadyRefunded = await prisma.walletTransaction.count({
            where: { username: order.buyerUsername, title: refundTitle },
          });
          if (paysWallet && !alreadyRefunded && order.buyerUsername && order.amount > 0) {
            const buyer = await prisma.user.findUnique({ where: { username: order.buyerUsername } }).catch(() => null);
            if (buyer) {
              await prisma.user.update({ where: { id: buyer.id }, data: { walletBalance: { increment: order.amount } } });
              await prisma.walletTransaction.create({
                data: { username: order.buyerUsername, title: refundTitle, detail: `Refund approved for order ${tracking}`, amount: order.amount },
              });
              await prisma.ledgerEntry.createMany({
                data: [{ partyName: order.buyerName, partyRole: "buyer", direction: "in", type: "reversal", amount: order.amount, method, status: "success", orderId: order.id, createdAt: new Date() }],
              }).catch(() => {});
            }
          }
          const wasCredited = await prisma.walletTransaction.count({
            where: { username: order.sellerUsername, title: `Order earnings · ${tracking}` },
          });
          const alreadyClawed = await prisma.walletTransaction.count({
            where: { username: order.sellerUsername, title: clawTitle },
          });
          if (!isCod && wasCredited && !alreadyClawed && order.sellerUsername) {
            const rate = await resolveCommissionRate(prisma);
            let basis = Number(order.amount);
            // Coupon-aware settlement basis (prefers per-line netPrice).
            const settledBasis = settlementGoodsBasis(order.itemsList);
            if (Number.isFinite(settledBasis)) basis = settledBasis;
            const net = Math.max(0, Math.round(basis * (1 - rate)));
            const seller = net > 0 ? await prisma.user.findUnique({ where: { username: order.sellerUsername } }).catch(() => null) : null;
            if (seller) {
              await prisma.user.update({ where: { id: seller.id }, data: { walletBalance: { decrement: net } } });
              await prisma.walletTransaction.create({
                data: { username: order.sellerUsername, title: clawTitle, detail: `Earnings reversal for refunded order ${tracking}`, amount: -net },
              });
              await prisma.ledgerEntry.createMany({
                data: [{ partyName: order.sellerUsername, partyRole: "seller", direction: "out", type: "reversal", amount: net, method, status: "success", orderId: order.id, createdAt: new Date() }],
              }).catch(() => {});
            }
          }
          if (paysWallet) {
            await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } }).catch(() => {});
          }
        }
      }
    } catch {
      return fail("Refund settlement failed — status not changed", 503);
    }
  }
  await prisma.refund.update({
    where: { id: String(row.id) },
    data: { status: nextStatus, respondedAt: new Date().toISOString() },
  });
  return { ok: true };
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

  const { id, data } = await request.json();
  if (!id || typeof data !== "object" || data === null) {
    return NextResponse.json({ error: "id and data are required" }, { status: 400 });
  }
  const validationErr = validateResourcePayload(resource, data as Record<string, unknown>);
  if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });
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
      appScopedData = sanitizeSellerForApp(raw, appUser);
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
  if (resource === "users") {
    const blockedUserFields = new Set(["walletBalance", "loyaltyPoints", "passwordHash"]);
    for (const k of Object.keys(cleanPayload)) if (blockedUserFields.has(k)) delete (cleanPayload as any)[k];
  }

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
        // Refund-on-reject (industry standard: a rejected payout never strands
        // the debit). The seller's wallet was debited at submission; rejection
        // credits it back server-side and leaves an audit-visible transaction.
        // (currentStatus is narrowed to requested|approved by the gate above,
        // so no extra guard is needed here.)
        if (nextStatus === "rejected") {
          try {
            const wRow = before as { userName?: string; amount?: number } | null;
            const owner = String(wRow?.userName ?? "").trim();
            const amt = Number(wRow?.amount ?? 0);
            if (owner && amt > 0) {
              const target = await prisma.user.findFirst({
                where: { OR: [{ name: owner }, { username: owner }] },
              });
              if (target) {
                await prisma.user.update({
                  where: { id: target.id },
                  data: { walletBalance: { increment: amt } },
                });
                await prisma.walletTransaction.create({
                  data: {
                    username: String(target.username ?? owner),
                    title: "Payout rejected — refunded",
                    detail: `Withdrawal ${id} rejected; funds returned to wallet`,
                    amount: amt,
                  },
                });
              }
            }
          } catch {
            // Refund is best-effort; the rejection itself always applies and is
            // auditable, so support can re-credit manually if this ever fails.
          }
        }
        // Maker-checker on EXECUTION (bank money actually leaves): approved →
        // completed needs a different admin's prior approval on record.
        if (nextStatus === "completed") {
          const block = await makerCheck(prisma, resource, String(id), session.name);
          if (block) return NextResponse.json({ error: block }, { status: 409 });
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
          try {
            const revTitle = `Withdrawal rejected refund · ${String(id)}`;
            const already = await prisma.walletTransaction.count({ where: { title: revTitle } });
            if (!already) {
              const debit = await prisma.walletTransaction.findFirst({
                where: { detail: { contains: String(id) }, amount: { lt: 0 } },
                orderBy: { ts: "desc" },
              });
              if (debit) {
                const owner = await prisma.user.findUnique({ where: { username: debit.username } }).catch(() => null);
                if (owner) {
                  const back = -Number(debit.amount);
                  await prisma.user.update({
                    where: { id: owner.id },
                    data: { walletBalance: { increment: back } },
                  });
                  await prisma.walletTransaction.create({
                    data: {
                      username: debit.username,
                      title: revTitle,
                      detail: `Rejected payout ${String(id)} refunded (incl. fee)`,
                      amount: back,
                    },
                  });
                }
              }
            }
          } catch {
            return NextResponse.json({ error: "Payout rejection refund failed — status not changed" }, { status: 503 });
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
          if (tracking && rawCurrent !== "cancelled" && nextStatus === "cancelled") {
            let reversed = false;
            if (paysWallet && b.buyerUsername && Number(b.amount ?? 0) > 0) {
              const title = `Order cancelled - refund · ${tracking}`;
              const done = await prisma.walletTransaction.count({
                where: { username: String(b.buyerUsername), title },
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
                where: { username: String(b.sellerUsername), title: clawTitle },
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
                  reversed = true;
                }
              } else if (wasCredited) {
                reversed = true;
              }
            }
            if (reversed) (cleanPayload as Record<string, unknown>).paymentStatus = "refunded";
          }
          if (tracking && rawCurrent !== "delivered" && nextStatus === "delivered" && isCod && b.sellerUsername) {
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
                    detail: `COD collected on delivery · net after ${blendedPct}% commission`,
                    amount: net,
                  },
                });
                (cleanPayload as Record<string, unknown>).paymentStatus = "paid";
              }
            } else if (done) {
              (cleanPayload as Record<string, unknown>).paymentStatus = "paid";
            }
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
        const outcome = String((data as Record<string, unknown>).outcome ?? "");
        if (outcome === "full_refund" || outcome === "split_50_50") {
          try {
            const b = (before ?? {}) as { orderId?: unknown };
            const ref = String(b.orderId ?? "").trim();
            const order = ref
              ? await prisma.order.findFirst({
                  where: { OR: [{ id: ref }, { trackingNumber: ref }, { orderNumber: ref }] },
                })
              : null;
            if (!order) {
              return NextResponse.json(
                { error: "Linked order not found — ruling recorded without money movement." },
                { status: 409 }
              );
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
            const buyerDue = half ? Math.round(Number(order.amount ?? 0) / 2) : Number(order.amount ?? 0);
            const clawDue = half
              ? Math.max(0, Math.round(disputeNet / 2))
              : disputeNet;
            const buyerTitle = half ? `Dispute split refund · ${tracking}` : `Dispute refund · ${tracking}`;
            const clawTitle = half ? `Dispute split clawback · ${tracking}` : `Dispute refund clawback · ${tracking}`;
            const settledElsewhere = async (t: string, u: unknown) =>
              u ? (await prisma.walletTransaction.count({ where: { username: String(u), title: t } })) > 0 : false;
            if (paysWallet && order.buyerUsername && buyerDue > 0) {
              const dup = await settledElsewhere(buyerTitle, order.buyerUsername);
              const fullGone =
                (await settledElsewhere(`Order refund · ${tracking}`, order.buyerUsername)) ||
                (await settledElsewhere(`Order cancelled - refund · ${tracking}`, order.buyerUsername));
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
                  if (!half) {
                    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } }).catch(() => {});
                  }
                }
              }
            }
            if (!isCod && order.sellerUsername && clawDue > 0) {
              const dup = await settledElsewhere(clawTitle, order.sellerUsername);
              const fullGone =
                (await settledElsewhere(`Order refund clawback · ${tracking}`, order.sellerUsername)) ||
                (await settledElsewhere(`Order cancelled clawback · ${tracking}`, order.sellerUsername));
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
                }
              }
            }
          } catch {
            return NextResponse.json({ error: "Dispute settlement failed — ruling not recorded" }, { status: 503 });
          }
        }
      }
      // Shipment/order parity: "Mark delivered" previously flipped ONLY the
      // shipment row while the linked order stayed out_for_delivery (and COD
      // sellers were never credited). Advancing a shipment to delivered now
      // advances the linked order too, with the same idempotent COD
      // settlement the staff order path uses (shared titles — never double).
      if (resource === "shipments" && String((data as Record<string, unknown>).status ?? "") === "delivered") {
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
              await prisma.order.update({
                where: { id: order.id },
                data: { status: "delivered", deliveryStatus: "delivered" },
              }).catch(() => {});
              const method = String(order.paymentMethod ?? "").trim().toLowerCase();
              const isCod = method === "cash on delivery" || method === "cod" || method === "cash";
              if (isCod && order.sellerUsername) {
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
                          detail: `COD collected on delivery · net after ${blendedShipPct}% commission`,
                          amount: net,
                        },
                      });
                      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } }).catch(() => {});
                    }
                  }
                } else {
                  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } }).catch(() => {});
                }
              }
            }
          }
        } catch {
            return NextResponse.json({ error: "Order sync failed — shipment not changed" }, { status: 500 });
        }
      }
      const row = await prisma[PRISMA_MODELS[resource]].update({ where: { [PRIMARY_KEY[resource] ?? "id"]: id }, data: cleanPayload });
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
      let details = `Fields: ${Object.keys(data as object).join(", ")}`;
      if (before) {
        const diffs: string[] = [];
        for (const k of Object.keys(data as object)) {
          const oldV = (before as any)[k];
          const newV = (cleanPayload as any)[k] ?? (data as any)[k];
          if (String(oldV ?? "") !== String(newV ?? "")) {
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
    else if (resource === "sellers") appScopedBody = sanitizeSellerForApp(raw, appUser);
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
      // KYC resubmission: a seller application is idempotent per user. If the
      // caller-owned row already exists (id = app_<username>), update it instead
      // of failing with a unique-violation misreported as "Database unavailable".
      if (resource === "sellers" && role === "app" && cleanPayloadPost.id) {
        const existing = await prisma.seller.findUnique({ where: { id: String(cleanPayloadPost.id) } });
        if (existing) {
          // Re-submission resets a rejected/suspended application to pending for
          // re-review, but NEVER silently re-approves or modifies an approved one.
          const resetStatus = ["rejected", "suspended", "pending"].includes(String(existing.kycStatus));
          const patch = { ...cleanPayloadPost, kycStatus: resetStatus ? "pending" : existing.kycStatus, gstStatus: resetStatus ? "pending" : existing.gstStatus, submittedAt: new Date().toISOString() };
          const row = await prisma.seller.update({ where: { id: String(cleanPayloadPost.id) }, data: patch });
          await writeAuditSafe({ action: "data.create", entity: resource, entityId: String(row.id ?? ""), details: "Seller KYC resubmitted (upsert)", adminName: session.name, ip: getClientIp(request) });
          return NextResponse.json({ row: serialize(row, resource) });
        }
      }
      const row = await prisma[PRISMA_MODELS[resource]].create({ data: cleanPayloadPost });
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
            const s = await prisma.seller.findUnique({ where: { id: String(id) }, select: { businessName: true } });
            const biz = s?.businessName ? String(s.businessName) : null;
            if (biz) {
              const [products, orders] = await Promise.all([
                prisma.product.count({ where: { sellerName: { contains: biz, mode: "insensitive" } } }),
                prisma.order.count({ where: { sellerName: { contains: biz, mode: "insensitive" } } }),
              ]);
              if (products || orders) {
                return NextResponse.json(
                  { error: `Seller has live data (${products} products, ${orders} orders). Soft-delete instead.` },
                  { status: 409 }
                );
              }
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
      await prisma[PRISMA_MODELS[resource]].delete({ where: { [PRIMARY_KEY[resource] ?? "id"]: id } });
      if (resource === "products" && String(id).startsWith("lst_")) {
        const postId = String(id).slice(4);
        await prisma.post.delete({ where: { id: postId } }).catch(() => {});
      }
      await writeAuditSafe({
        action: "data.delete",
        entity: resource,
        entityId: String(id),
        details: "Deleted record",
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
