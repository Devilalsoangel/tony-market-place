/**
 * App <-> Admin Panel sync bridge (offline-first).
 *
 * The app stays the source of truth (AsyncStorage). When the admin panel
 * server is reachable, new app-side records are mirrored to its local DB
 * (/api/data/*), so the admin console shows LIVE buyer/seller activity:
 *   - new orders            -> orders
 *   - order status changes  -> orders (PATCH)
 *   - refund requests       -> refunds
 *   - seller applications   -> sellers
 *   - support tickets       -> tickets (+ opener message in the thread)
 *   - withdrawal requests   -> withdrawals
 *   - promotion purchases   -> promotions
 *
 * AUTH: the admin /api/data/* endpoints normally require an admin session
 * cookie. The app authenticates with the device API key instead
 * (x-app-key header, default "dev-key" in dev, override via AsyncStorage
 * key @susej_app_key). The admin route accepts the app key for the sync
 * resource set and never for reads.
 *
 * Base URL: `http://127.0.0.1:3000` (works on-device via `adb reverse
 * tcp:3000 tcp:3000`). Override at runtime with AsyncStorage key
 * `@susej_admin_url` (e.g. the PC's Tailscale IP).
 *
 * All calls are fire-and-forget with a hard 6s timeout; failures are
 * silently ignored so sync never blocks the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionStorage } from './sessionStorage';

export const ADMIN_URL_KEY = '@susej_admin_url';
export const DEFAULT_ADMIN_URL = 'http://127.0.0.1:3000';
export const APP_KEY_KEY = '@susej_app_key';
export const DEFAULT_APP_KEY = 'dev-key';

let cachedUrl: string | null = null;
let cachedKey: string | null = null;

export async function getAdminUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  try {
    const stored = await AsyncStorage.getItem(ADMIN_URL_KEY);
    cachedUrl = stored && stored.trim() ? stored.trim() : DEFAULT_ADMIN_URL;
  } catch {
    cachedUrl = DEFAULT_ADMIN_URL;
  }
  return cachedUrl;
}

export function setAdminUrl(url: string) {
  cachedUrl = url;
  AsyncStorage.setItem(ADMIN_URL_KEY, url).catch(() => {});
}

export async function getAppKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  try {
    const stored = await AsyncStorage.getItem(APP_KEY_KEY);
    cachedKey = stored && stored.trim() ? stored.trim() : DEFAULT_APP_KEY;
  } catch {
    cachedKey = DEFAULT_APP_KEY;
  }
  return cachedKey;
}

/** Resolve the logged-in user so admin rows carry real identity, not "App User". */
export async function getSyncUser(): Promise<{
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
} | null> {
  try {
    const u = await sessionStorage.getUser();
    if (!u || typeof u !== 'object') return null;
    return {
      name: typeof u.name === 'string' ? u.name : undefined,
      username: typeof u.username === 'string' ? u.username : undefined,
      email: typeof u.email === 'string' ? u.email : undefined,
      phone: typeof u.phone === 'string' ? u.phone : undefined,
    };
  } catch {
    return null;
  }
}

async function post(resource: string, data: unknown): Promise<boolean> {
  try {
    const [base, key] = await Promise.all([getAdminUrl(), getAppKey()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/api/data/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': key },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false; // offline / server down - app keeps working, sync skipped
  }
}

async function patch(resource: string, id: string, data: unknown): Promise<boolean> {
  try {
    const [base, key] = await Promise.all([getAdminUrl(), getAppKey()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/api/data/${resource}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-app-key': key },
      body: JSON.stringify({ id, data }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function iso(ts?: number): string {
  return new Date(ts ?? Date.now()).toISOString();
}

/** Mirror a status change (seller accepts/ships/completes, buyer cancels) to the admin DB. */
export async function syncOrderStatus(
  id: string,
  patchData: { status?: string; paymentStatus?: string }
): Promise<boolean> {
  return patch('orders', id, patchData);
}

/** Mirror a refund status decision (seller/platform) to the admin refunds queue. */
export async function syncRefundStatus(
  refundId: string,
  status: string,
  note?: string
): Promise<boolean> {
  return patch('refunds', refundId, {
    status,
    respondedAt: iso(),
    ...(note ? { note } : {}),
  });
}

/** Mirror a refund request to the admin DB (admin refunds queue). */
export async function syncRefundRequest(refund: {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  requestedAt: number;
  amount?: number;
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('refunds', {
    id: refund.id,
    orderRef: refund.orderId,
    buyerName: user?.name ?? 'App User',
    sellerName: 'App Seller',
    reason: refund.reason,
    amount: refund.amount ?? 0,
    status: refund.status,
    requestedAt: iso(refund.requestedAt),
    respondedAt: null,
  });
}

/** Mirror a freshly placed order to the admin DB (Order model shape). */
export async function syncOrder(order: {
  id: string;
  orderNumber?: string;
  buyerName?: string;
  sellerName: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  chargedTotal?: number;
  status: string;
  placedAt?: number;
  address?: string;
  paymentMethod?: string;
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('orders', {
    id: order.id,
    buyerName: order.buyerName ?? user?.name ?? 'App Buyer',
    sellerName: order.sellerName,
    amount: order.chargedTotal ?? order.total,
    status: order.status,
    deliveryStatus: 'awaiting_shipment',
    items: order.items.reduce((s, i) => s + i.quantity, 0),
    itemsList: order.items.map((i) => ({ name: i.name, qty: i.quantity })),
    shippingCarrier: '',
    trackingNumber: order.orderNumber ?? order.id,
    estimatedDelivery: '',
    actualDelivery: '',
    shippingAddress: order.address ?? '',
    paymentMethod: order.paymentMethod ?? 'wallet',
    paymentStatus: 'paid',
    createdAt: iso(order.placedAt),
    deliveryLog: [],
  });
}

/** Mirror a seller application to the admin verification queue. */
export async function syncSellerApplicant(applicant: {
  username?: string;
  name: string;
  businessName: string;
  email?: string;
  phone?: string;
  docs?: string[];
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('sellers', {
    id: `app_${applicant.username ?? Date.now()}`,
    businessName: applicant.businessName,
    ownerName: applicant.name,
    logo: '',
    email: applicant.email ?? user?.email ?? '',
    phone: applicant.phone ?? user?.phone ?? '',
    address: '',
    taxId: '',
    kycStatus: 'pending',
    gstStatus: 'pending',
    score: 0,
    productsCount: 0,
    joinedAt: iso(),
    submittedAt: iso(),
    documents: (applicant.docs ?? []).map((label, i) => ({
      id: `doc_app_${Date.now()}_${i}`,
      type: 'additional',
      label,
      fileName: `${label.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      url: '',
      uploadedAt: iso(),
      verified: false,
    })),
    auditLogs: [],
  });
}

/** Mirror a raised support ticket (+ opener message for the thread). */
export async function syncTicket(ticket: {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  messageText?: string;
}): Promise<boolean> {
  const user = await getSyncUser();
  const ok = await post('tickets', {
    id: ticket.id,
    userName: user?.name ?? 'App User',
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    assignee: null,
    createdAt: iso(Date.parse(ticket.createdAt) || Date.now()),
  });
  if (ok && ticket.messageText) {
    await post('messages', {
      threadId: ticket.id,
      sender: user?.name ?? 'App User',
      senderRole: 'user',
      body: ticket.messageText,
      createdAt: iso(),
    });
  }
  return ok;
}

/** Mirror a withdrawal payout request to the admin queue. */
export async function syncWithdrawal(req: {
  id: string;
  amount: number;
  status: string;
  requestedAt: number;
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('withdrawals', {
    id: req.id,
    userName: user?.name ?? 'App User',
    method: 'bank',
    amount: req.amount,
    status: req.status,
    requestedAt: iso(req.requestedAt),
    respondedAt: null,
  });
}

/** Mirror a promotion purchase so it appears in the admin campaign queue. */
export async function syncPromotion(promo: {
  id: string;
  kind: string;
  packageName: string;
  price: number;
  days: number;
  sellerUsername?: string;
  postId?: string;
  postTitle?: string;
  createdAt?: number;
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('promotions', {
    id: promo.id,
    kind: promo.kind,
    packageName: promo.packageName,
    amountPaid: promo.price,
    currency: 'INR',
    durationDays: promo.days,
    sellerId: promo.sellerUsername ?? user?.username ?? 'app_user',
    sellerName: user?.name ?? promo.sellerUsername ?? 'App User',
    postId: promo.postId,
    postTitle: promo.postTitle,
    provider: 'app',
    checkoutRef: `app_${promo.id}`,
    status: 'active',
    isPinned: true,
    startsAt: iso(promo.createdAt),
    endsAt: iso((promo.createdAt ?? Date.now()) + promo.days * 86400000),
    createdAt: iso(promo.createdAt),
  });
}