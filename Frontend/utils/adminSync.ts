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
// Production default = the deployed admin panel (verified live Sep 13 —
// serves real Neon rows with the app key). The bare vercel.app domain is
// owned by another scope (stale deploy, rejects the app key), so the app
// MUST point at the -theta host. Dev devices that need the local panel set
// AsyncStorage @susej_admin_url to http://<PC-IP>:3000 (or use
// adb reverse tcp:3000 tcp:3000). The old 127.0.0.1:3000 default sent every
// production sync to a dead localhost — seller applications never reached the
// admin queue at all.
// Vercel = Neon DB with all 19 users + real data. Auth works with AUTH_DEV_MODE=1.
export const DEFAULT_ADMIN_URL = 'https://susej-admin-panel-theta.vercel.app';
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

/** Resolve the logged-in user's Bearer token for authenticated admin sync. */
async function getSyncToken(): Promise<string | null> {
  try {
    const session = await sessionStorage.getSession();
    return session?.accessToken && session.accessToken.startsWith('susej_')
      ? session.accessToken
      : null;
  } catch {
    return null;
  }
}

async function post(resource: string, data: unknown): Promise<boolean> {
  try {
    const [base, key, token] = await Promise.all([getAdminUrl(), getAppKey(), getSyncToken()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-key': key,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/api/data/${resource}`, {
      method: 'POST',
      headers,
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
    const [base, key, token] = await Promise.all([getAdminUrl(), getAppKey(), getSyncToken()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-key': key,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/api/data/${resource}`, {
      method: 'PATCH',
      headers,
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

/** DEPRECATED — do not call. Refund decisions settle through
 *  serverApi.respondRefund (PATCH /api/app/orders/[id] {refundDecision},
 *  seller-only, idempotent money legs). This patched a duplicate mirror row
 *  and moved no money. Kept as a no-op shell so old call sites fail safe. */
export async function syncRefundStatus(
  _refundId: string,
  _status: string,
  _note?: string
): Promise<boolean> {
  return false;
}

/** DEPRECATED — do not call. Refund requests are created server-side by
 *  serverApi.updateOrder({ refundReason }) (single writer, canonical row with
 *  seller link). This POSTed a SECOND duplicate row per request (local
 *  ref_ id, no seller, client-supplied amount). Kept as a no-op shell so old
 *  call sites fail safe. */
export async function syncRefundRequest(_refund: {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  requestedAt: number;
  amount?: number;
}): Promise<boolean> {
  return false;
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
  const buyerName = order.buyerName ?? user?.name;
  // Skip rather than invent an identity for the shared DB.
  if (!buyerName) return false;
  return post('orders', {
    id: order.id,
    buyerName,
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
    // Industry-standard: COD is cash-on-DELIVERY — never 'paid' at placement.
    // Marking every mirror paid corrupted the admin finance view.
    paymentStatus: /cash|cod/i.test(order.paymentMethod ?? '') ? 'pending' : 'paid',
    createdAt: iso(order.placedAt),
    deliveryLog: [],
  });
}

/** Mirror a seller application to the admin verification queue. */
export async function syncSellerApplicant(applicant: {
  username?: string;
  name: string;
  businessName: string;
  /** Shop main category - one per shop (admin sees + corrects it). */
  category?: string;
  email?: string;
  phone?: string;
  docs?: string[];
  /** Store logo / seller avatar (uploaded image URL from the admin panel). */
  logo?: string;
  /** REAL uploaded verification documents (id card, selfie with ID, ...). */
  documents?: Array<{ type: string; label: string; fileName: string; url: string }>;
  /** Mandatory physical store location picked on the live map. */
  storeLat?: number | null;
  storeLng?: number | null;
  storeAddress?: string | null;
  /** Business tax identity (business sellers only). taxId/pan/bankAccount land
   *  on their Seller columns (scrubbed from the device on sync ack). */
  taxId?: string;
  pan?: string;
  bankAccount?: string;
  /** CKYC identity binding — shown on the admin seller detail Identity card. */
  idType?: string;
  idNumber?: string;
  nameOnId?: string;
  dob?: string;
  selfieUrl?: string;
}): Promise<boolean> {
  const user = await getSyncUser();
  return post('sellers', {
    id: `app_${applicant.username ?? Date.now()}`,
    businessName: applicant.businessName,
    ownerName: applicant.name,
    logo: applicant.logo ?? '',
    email: applicant.email ?? user?.email ?? '',
    phone: applicant.phone ?? user?.phone ?? '',
    address: '',
    category: applicant.category ?? '',
    storeLat: typeof applicant.storeLat === 'number' ? applicant.storeLat : null,
    storeLng: typeof applicant.storeLng === 'number' ? applicant.storeLng : null,
    storeAddress: applicant.storeAddress ?? '',
    taxId: applicant.taxId ?? '',
    pan: applicant.pan ?? '',
    bankAccount: applicant.bankAccount ?? '',
    idType: applicant.idType ?? '',
    idNumber: applicant.idNumber ?? '',
    nameOnId: applicant.nameOnId ?? '',
    dob: applicant.dob ?? '',
    selfieUrl: applicant.selfieUrl ?? '',
    kycStatus: 'pending',
    gstStatus: 'pending',
    score: 0,
    productsCount: 0,
    joinedAt: iso(),
    submittedAt: iso(),
    // REAL documents only — every row carries the URL of a file actually
    // uploaded to the admin panel. Doc-less applications are rejected in the
    // app BEFORE this mirror runs, so no fabricated pdf rows here.
    documents: (applicant.documents ?? []).map((d, i) => ({
      id: `doc_app_${Date.now()}_${i}`,
      type: d.type,
      label: d.label,
      fileName: d.fileName,
      url: d.url,
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
  // Tickets need a real requester — skip when identity is unknown.
  if (!user?.name) return false;
  const ok = await post('tickets', {
    id: ticket.id,
    userName: user.name,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    assignee: null,
    createdAt: iso(Date.parse(ticket.createdAt) || Date.now()),
  });
  if (ok && ticket.messageText) {
    await post('messages', {
      threadId: ticket.id,
      sender: user.name,
      senderRole: 'user',
      body: ticket.messageText,
      createdAt: iso(),
    });
  }
  return ok;
}

/**
 * Poll payout verdicts made on the admin desk (approved/rejected/completed)
 * so the app wallet reflects them without a manual refresh. Uses the app's
 * Bearer token; the server maps rows to the caller's identity so a seller
 * only ever receives their own payout records.
 *
 * (Payout SUBMISSION is not mirrored here anymore — it is a single
 * transactional server call via serverApi.requestPayout.)
 */
export async function getWithdrawalStatuses(): Promise<
  { id: string; amount: number; status: string; requestedAt: string; respondedAt: string | null }[] | null
> {
  try {
    const [base, key, token] = await Promise.all([getAdminUrl(), getAppKey(), getSyncToken()]);
    if (!token) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const headers: Record<string, string> = { 'x-app-key': key };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/api/app/withdrawals`, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    return Array.isArray(json?.withdrawals) ? json.withdrawals : null;
  } catch {
    return null; // offline / server down — local state stays as-is
  }
}


/** Mirror a promotion purchase so it appears in the admin campaign queue. */
/** DEPRECATED — do not call. Campaign purchases go through
 *  serverApi.purchasePromotion (atomic debit + ACTIVE placement, server
 *  price, idempotent on checkoutRef). This POSTed a client-priced ACTIVE row
 *  with no debit behind it (free-mint hole) and stranded money whenever it
 *  failed after a client debit. Kept as a no-op shell so old call sites fail safe. */
export async function syncPromotion(_promo: {
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
  void _promo;
  return false;
}