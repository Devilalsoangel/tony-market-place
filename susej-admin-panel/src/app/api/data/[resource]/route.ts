import { NextRequest, NextResponse } from "next/server";
import { getPrisma as resolveDb } from "@/lib/db";
import { verifySessionToken, hashPassword, SESSION_COOKIE, getClientIp } from "@/lib/auth";
import { checkAppKey } from "@/lib/promotions/api-auth";
import { lazySweep } from "@/lib/promotions/activate";
import {
  mockUsers,
  mockAdmins,
  mockSellers,
  mockCategories,
  mockOrders,
  mockProducts,
  mockCommunities,
  mockReviews,
  mockTransactions,
  mockLedger,
  mockGatewayLogs,
  mockShipments,
  mockCarriers,
  mockDeliveryZones,
  mockTickets,
  mockAuditLogs,
  mockPromotions,
  mockCommissionSettings,
  mockCoupons,
  mockRevenueMetrics,
  mockNotificationTemplates,
  mockNotificationHistory,
  mockReportedProducts,
  mockReportedMessages,
  mockReportedComments,
  mockFeedPosts,
  mockBlockedUsers,
  mockAddressBook,
  mockPaymentMethods,
  mockLiveStreams,
  mockReels,
  mockStories,
  mockHashtags,
  mockBundles,
  mockFoodHub,
  mockBroadcasts,
  mockBookings,
  mockLoyaltyUsers,
  mockDisputes,
  mockAuctionRows,
  mockRefundRequests,
  mockWithdrawalRequests,
  mockReportedUsers,
} from "@/services/mock-data";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRISMA_MODELS: Record<string, string> = {
  users: "user",
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
  "hero-banners": "heroBanner",
  "featured-categories": "featuredCategory",
  "top-sellers": "topSeller",
  "hot-deals": "hotDeal",
  "featured-posts": "featuredPost",
  "home-sections": "homeSection",
  "app-settings": "appSetting",
  admins: "admin",
  "seller-documents": "sellerDocument",
  "seller-audit-log": "sellerAuditLog",
};

const MOCK_ROWS: Record<string, unknown[]> = {
  users: mockUsers,
  admins: mockAdmins,
  sellers: mockSellers,
  categories: mockCategories,
  products: mockProducts,
  orders: mockOrders,
  communities: mockCommunities,
  reviews: mockReviews,
  transactions: mockTransactions,
  ledger: mockLedger,
  "gateway-logs": mockGatewayLogs,
  shipments: mockShipments,
  carriers: mockCarriers,
  "delivery-zones": mockDeliveryZones,
  tickets: mockTickets,
  "audit-logs": mockAuditLogs,
  promotions: mockPromotions,
  commission: [mockCommissionSettings],
  coupons: mockCoupons,
  "revenue-metrics": [mockRevenueMetrics],
  "notification-templates": mockNotificationTemplates,
  "notification-history": mockNotificationHistory,
  "reported-products": mockReportedProducts,
  "reported-messages": mockReportedMessages,
  "reported-comments": mockReportedComments,
  "reported-users": mockReportedUsers,
  messages: [],
  posts: mockFeedPosts,
  blocked: mockBlockedUsers,
  "address-book": mockAddressBook,
  "payment-methods": mockPaymentMethods,
  live: mockLiveStreams,
  reels: mockReels,
  stories: mockStories,
  hashtags: mockHashtags,
  bundles: mockBundles,
  "food-hub": mockFoodHub,
  broadcasts: mockBroadcasts,
  bookings: mockBookings,
  loyalty: mockLoyaltyUsers,
  disputes: mockDisputes,
  auctions: mockAuctionRows,
  refunds: mockRefundRequests,
  withdrawals: mockWithdrawalRequests,
};

type Role = "super_admin" | "manager" | "moderator" | "app";

const READ_ONLY_RESOURCES = new Set(["audit-logs"]);
const MODERATOR_RESOURCES = new Set(["communities", "reviews", "tickets"]);

// Resources the mobile app may write to via the device API key (x-app-key).
// The app is never allowed to READ admin data — it only mirrors activity.
const APP_SYNC_RESOURCES = new Set([
  "orders",
  "sellers",
  "tickets",
  "messages",
  "withdrawals",
  "promotions",
  "refunds",
]);

const SENSITIVE_ADMIN_FIELDS = ["password", "passwordHash", "twoFactorCode", "failedAttempts", "lockedUntil"] as const;

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

function readAllowed(resource: string, role: Role): boolean {
  if (role === "app") return false; // the app never reads admin data
  if (role === "super_admin" || role === "manager") return true;
  return MODERATOR_RESOURCES.has(resource);
}

function writeAllowed(resource: string, role: Role): boolean {
  if (role === "app") return APP_SYNC_RESOURCES.has(resource);
  if (role === "super_admin") return !READ_ONLY_RESOURCES.has(resource);
  if (role === "manager") return !READ_ONLY_RESOURCES.has(resource) && resource !== "admins";
  return MODERATOR_RESOURCES.has(resource);
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
    return resource === "admins" ? stripSensitive(out) : out;
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
 * mobile app's device API key (x-app-key). The app session is restricted to
 * APP_SYNC_RESOURCES by writeAllowed/readAllowed above.
 */
function parseWriteSession(request: NextRequest) {
  const admin = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (admin) return admin;
  if (checkAppKey(request)) {
    return { sub: "app", name: "App", role: "app" as Role, loginId: "app" };
  }
  return null;
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
  const role = session.role as Role;
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!readAllowed(resource, role)) return forbidden();

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      await lazySweep();
      const list = await prisma[PRISMA_MODELS[resource]].findMany(EXTENDED[resource] ?? {});
      return NextResponse.json({ rows: serialize(list, resource) as Record<string, unknown>[] });
    } catch {
      // fall through to demo data
    }
  }

  const rows = MOCK_ROWS[resource] ?? [];
  return NextResponse.json({ rows: serialize(rows, resource) as Record<string, unknown>[] });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const session = parseWriteSession(request);
  if (!session) return unauthorized();
  const role = session.role as Role;
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  const { id, data } = await request.json();
  if (!id || typeof data !== "object" || data === null) {
    return NextResponse.json({ error: "id and data are required" }, { status: 400 });
  }
  if (resource === "admins" && session.sub === id) {
    return forbidden("You cannot modify your own account.");
  }

  const payload = resource === "admins" ? cleanAdminInput(data, role, false, { id: session.sub, loginId: session.loginId }) : data;
  if (payload instanceof NextResponse) return payload;

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
      const row = await prisma[PRISMA_MODELS[resource]].update({ where: { id }, data: payload });
      await writeAuditSafe({
        action: "data.update",
        entity: resource,
        entityId: String(id),
        details: `Fields: ${Object.keys(data).join(", ")}`,
        adminName: session.name,
        ip: getClientIp(request),
      });
      return NextResponse.json({ row: serialize(row, resource) });
    } catch {
      // fall through to demo response
    }
  }

  return NextResponse.json({ success: true, row: { id, ...serialize(payload, resource) as Record<string, unknown> } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const session = parseWriteSession(request);
  if (!session) return unauthorized();
  const role = session.role as Role;
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = resource === "admins" ? cleanAdminInput(body, role, true, { id: session.sub, loginId: session.loginId }) : body;
  if (payload instanceof NextResponse) return payload;

  const prisma = (await resolveDb()) as any;
  if (prisma) {
    try {
      const row = await prisma[PRISMA_MODELS[resource]].create({ data: payload });
      await writeAuditSafe({
        action: "data.create",
        entity: resource,
        entityId: String(row.id ?? ""),
        details: "Created record",
        adminName: session.name,
        ip: getClientIp(request),
      });
      return NextResponse.json({ row: serialize(row, resource) });
    } catch {
      // fall through to demo response
    }
  }

  const id = `demo_${Math.random().toString(36).slice(2, 10)}`;
  return NextResponse.json({ success: true, row: { id, ...serialize(payload, resource) as Record<string, unknown> } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const session = parseWriteSession(request);
  if (!session) return unauthorized();
  const role = session.role as Role;
  const { resource } = await params;
  if (!PRISMA_MODELS[resource]) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (!writeAllowed(resource, role)) return forbidden();

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (resource === "admins") {
    if (session.sub === id) return forbidden("You cannot delete your own account.");
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
      await prisma[PRISMA_MODELS[resource]].delete({ where: { id } });
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
      // fall through to demo response
    }
  }

  return NextResponse.json({ success: true });
}