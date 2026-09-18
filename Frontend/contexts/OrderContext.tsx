import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, DELIVERY_FEES } from './CartContext';
import { serverApi } from '../utils/serverApi';
import { useAuth } from './AuthContext';

const ORDERS_KEY_BASE = '@susej_orders';
const ORDERS_KEY = ORDERS_KEY_BASE;

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderKind = 'order' | 'booking' | 'food';

export interface OrderItem {
  listingId: string;
  name: string;
  price: number;
  quantity: number;
  /** Canonical listing image captured at checkout so every surface (buyer,
   * seller, admin) renders the SAME product picture for this order. */
  imageUrl?: string;
  /** Variant selection at purchase time (e.g. "Size:M") — the server
   * re-checks availability at placement; the receipt shows what was bought. */
  variantLabel?: string;
  /** Bundle row id for combo lines — the server re-prices from the Bundle
   * row at placement; the cart split is preview-only. */
  bundleId?: string;
  /** Settled per-line facts persisted by the server at placement (net unit
   * price after coupon share + commission rupees, category-aware). Earnings
   * displays sum these — never re-derived — so client/admin can never
   * disagree with what was actually credited. Absent on legacy rows. */
  netPrice?: number;
  commission?: number;
  category?: string;
}

export interface TrackingStep {
  label: string;
  time: string;
  done: boolean;
}

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

export type RefundTimelineAuthor = 'you' | 'seller' | 'platform';

export interface RefundTimelineEntry {
  author: RefundTimelineAuthor;
  text: string;
  time: number;
}

export interface Refund {
  id: string;
  reason: string;
  status: RefundStatus;
  timeline: RefundTimelineEntry[];
  requestedAt: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  kind: OrderKind;
  sellerName: string;
  sellerUsername: string;
  /** Buyer identity (server truth, needed by sellers to fulfill + contact).
   *  Absent on pre-sync local rows — UI falls back gracefully. */
  buyerName?: string;
  buyerUsername?: string;
  items: OrderItem[];
  total: number;
  /** Amount actually charged to the buyer (items + delivery − discount). Falls back to total. */
  chargedTotal?: number;
  status: OrderStatus;
  placedAt: number;
  reviewed: boolean;
  rating?: number;
  reviewComment?: string;
  /** Buyer chose "Post Anonymously" - storefront shows Anonymous, never the name. */
  reviewAnonymous?: boolean;
  tracking: TrackingStep[];
  address?: string;
  /** Real Postgres row id (cuid) returned by POST /api/app/orders. All server
   * mutations (status/review/cancel) MUST target this, never the local id. */
  serverId?: string;
  /** Delivery fee charged on this order (validated server-side). Stored so a
   * failed sync can be retried with the exact same payload (idempotent). */
  deliveryFee?: number;
  /** Promo code forwarded for server validation (discount settles server-side). */
  promoCode?: string;
  /** True when the order exists locally but the server never acknowledged it
   * (network failure after optimistic create). Kept — never ghost-deleted —
   * until retryOrderSync succeeds or the server explicitly rejects it. */
  syncPending?: boolean;
  /** Server explicitly rejected this order (bad coupon, OOS, funds). Kept —
   * never ghost-deleted — so the buyer sees WHY instead of a not-found page. */
  syncFailed?: string;
  paymentMethod?: string;
  bookingDate?: string;
  bookingTime?: string;
  /** Accepted-offer lock carried for sync retries (server re-verifies). */
  offer?: { threadId: string; messageId: string };
  refund?: Refund;
  /** Settlement stamp ("" = pre-hold era = matured). Seller earnings unlock
   *  7 days after this date (payout hold); every surface reads the same value. */
  actualDelivery?: string;
  /** Server settlement state: 'refunded' rows were clawed back (never
   *  earnings — headlines must exclude them, exactly like the server guard). */
  paymentStatus?: string;
  /** True while an open/under_review dispute freezes this order's net (unlocks
   *  on ruling — withdrawable-truth, mirrors the server payout guard). */
  disputeFrozen?: boolean;
  /** Proof-of-delivery entries (seller handover claims: tracking ID / receiver
   *  name). Buyer tracking renders the latest; server wins on pull. */
  deliveryLog?: Array<{ at?: string; by?: string; note?: string }>;
}

export interface PlaceOrderOptions {
  bookingDate?: string;
  bookingTime?: string;
  // Delivery fee charged on the first order of the checkout (validated
  // server-side against the allowed fee set so totals stay trustworthy).
  deliveryFee?: number;
  // Promo code applied in cart — forwarded to server for validation so
  // cart coupon drift cannot create a client-only discount mismatch.
  promoCode?: string;
  // Server-mirror discount estimate (previewDiscount) so the local receipt
  // shows the discounted figure the server will charge — not the full price.
  // The server re-validates and settles the real discount; this never prices.
  discountEstimate?: number;
  // Accepted-offer lock (chat deal → checkout): the server prices this order
  // from the verified accepted offer row, not the listing mirror. Single-item
  // only, never combinable with coupons (server enforces both).
  offer?: { threadId: string; messageId: string };
  // Structured shipping fields — the server canonicalizes these into a clean
  // address string, so garbage can never be serialized into the Order row.
  addressParts?: {
    label?: string;
    name?: string;
    phone?: string;
    street?: string;
    city?: string;
  };
}

interface OrderContextType {
  orders: Order[];
  placeOrders: (
    cart: CartItem[],
    address?: string,
    paymentMethod?: string,
    options?: PlaceOrderOptions
  ) => Order[];
  getOrder: (id: string) => Order | undefined;
  /** Re-POST a syncPending order with its original payload (server is
   * idempotent on orderNumber, so a lost-ack retry can never double-charge).
   * Returns true when the server acknowledges the order. */
  retryOrderSync: (id: string) => Promise<boolean>;
  /** Returns true when the server acknowledged the transition (false = local
   *  refusal or server rollback — callers must surface it, never silent). */
  updateOrderStatus: (id: string, status: OrderStatus, podNote?: string) => Promise<boolean>;
  markReviewed: (id: string, rating: number, comment?: string, anonymous?: boolean) => Promise<boolean>;
  requestRefund: (orderId: string, reason: string) => Promise<boolean>;
  /** Seller decisions await the server ack (false = rolled back, surface it);
   *  plain timeline notes resolve true immediately (no server round-trip). */
  respondRefund: (
    orderId: string,
    author: RefundTimelineAuthor,
    text: string,
    newStatus?: RefundStatus
  ) => Promise<boolean>;
  /**
   * Cancels an order. Contract: awaits the server ack — returns true only
   * when the server confirmed the cancel (false = local refusal or server
   * rollback — callers must surface it, never silent).
   */
  cancelOrder: (orderId: string, reason?: string) => Promise<boolean>;
  /**
   * True once the first load cycle settled (cache read + first server pull
   * attempt, success or fail). Screens must show a loader — never a
   * "No orders yet" empty state — while this is false.
   */
  loaded: boolean;
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  refunded: 'Refunded',
};

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { user, tokenSeq } = useAuth();
  const ordersKey = user?.username ? `${ORDERS_KEY_BASE}:${user.username}` : ORDERS_KEY_BASE;
  const serverAuthoritative = useRef(false);
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  useEffect(() => {
    let cancelled = false;
    const key = user?.username ? `${ORDERS_KEY_BASE}:${user.username}` : ORDERS_KEY_BASE;
    // Reset authority when switching identities so new user's cache can load.
    serverAuthoritative.current = false;
    setLoaded(false);
    AsyncStorage.getItem(key)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              const real = (parsed as Order[]).filter(
                (o) => o && !String(o.id).startsWith('seed_')
              );
              setOrders(real);
              // Cached rows render instantly — no loader flash for returners.
              if (real.length > 0) setLoaded(true);
              return;
            }
          } catch {}
        }
        if (!cancelled) setOrders([]);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => { cancelled = true; };
  }, [user?.username]);

  // Server sync: pull MY real orders from the shared backend (so the same
  // account sees the same orders on any device). A successful pull REPLACES
  // the cache — stale local/demo rows can never masquerade as real orders.
  const loadedOrdersFor = useRef('');
  useEffect(() => {
    if (!user?.username) {
      setLoaded(true);
      return;
    }
    const key = `${user.username}:${tokenSeq}`;
    if (loadedOrdersFor.current === key) return;
    loadedOrdersFor.current = key;
    // mine=all: one pull returns BOTH purchase history and sales — every
    // screen (buyer orders, seller dashboard/orders) filters locally.
    serverApi.getOrders('all').then((res) => {
      if (!res.ok || !res.data?.orders) return; // offline -> keep cached orders
      serverAuthoritative.current = true;
      // Merge, never wholesale replace: the server row lacks client-side
      // fields (deliveryFee/promoCode/booking/reviewAnonymous) that have no
      // server column yet — dropping them on every pull emptied the Refunds
      // tab and re-offered refunds after every restart. Match by server id,
      // else by order number (idempotent echo), else treat as a new row.
      // Unmatched local rows that are still syncing (or in-flight) are kept.
      const priorByServerId = new Map<string, Order>();
      const priorByNumber = new Map<string, Order>();
      for (const o of ordersRef.current) {
        if (o.serverId) priorByServerId.set(o.serverId, o);
        if (o.orderNumber) priorByNumber.set(o.orderNumber, o);
      }
      const seenLocalIds = new Set<string>();
      const serverOrders = res.data.orders
        .filter((o) => o && o.id)
        .map((o) => {
          const sid = String(o.id);
          const tracking = String(o.orderNumber ?? o.id);
          const prior = priorByServerId.get(sid) ?? priorByNumber.get(tracking);
          if (prior) seenLocalIds.add(prior.id);
          const serverRefund = (o as { refund?: { id: string; status: string; reason: string; requestedAt: number } }).refund;
          const priorItemsByListing = new Map((prior?.items ?? []).map((i) => [i.listingId, i]));
          const merged: Order = {
            id: prior?.id ?? sid,
            orderNumber: tracking,
            kind: (o.kind as Order['kind']) ?? 'order',
            sellerName: String(o.sellerName ?? ''),
            sellerUsername: String(o.sellerUsername ?? ''),
            buyerName: (o as { buyerName?: unknown }).buyerName ? String((o as { buyerName?: unknown }).buyerName) : prior?.buyerName,
            buyerUsername: (o as { buyerUsername?: unknown }).buyerUsername ? String((o as { buyerUsername?: unknown }).buyerUsername) : prior?.buyerUsername,
            items: Array.isArray(o.items)
              ? o.items.map((i: any) => ({
                  listingId: String(i.listingId ?? i.postId ?? ''),
                  name: String(i.name ?? 'Item'),
                  price: Number(i.price ?? 0),
                  quantity: Number(i.quantity ?? 1),
                  ...(i.imageUrl ? { imageUrl: String(i.imageUrl) } : {}),
                  ...(typeof i.bundleId === 'string' && i.bundleId ? { bundleId: i.bundleId } : {}),
                  ...((typeof i.variantLabel === 'string' && i.variantLabel
                    ? { variantLabel: i.variantLabel }
                    : priorItemsByListing.get(String(i.listingId ?? i.postId ?? ''))?.variantLabel
                      ? { variantLabel: priorItemsByListing.get(String(i.listingId ?? i.postId ?? ''))!.variantLabel }
                      : {})),
                  // Settled legs ride through untouched — earnings displays
                  // must sum server facts, never re-derive them.
                  ...(typeof i.netPrice === 'number' && Number.isFinite(i.netPrice) ? { netPrice: i.netPrice } : {}),
                  ...(typeof i.commission === 'number' && Number.isFinite(i.commission) ? { commission: i.commission } : {}),
                  ...(typeof i.category === 'string' && i.category ? { category: i.category } : {}),
                }))
              : [],
            total: Number(o.total ?? 0),
            chargedTotal: Number(o.chargedTotal ?? o.total ?? 0),
            status: (o.status as Order['status']) ?? 'placed',
            placedAt: typeof o.placedAt === 'string' ? Date.parse(o.placedAt) : Number(o.placedAt ?? Date.now()),
            reviewed: Boolean(o.reviewed),
            rating: o.rating ? Number(o.rating) : undefined,
            reviewComment: o.reviewComment ? String(o.reviewComment) : undefined,
            // Server has no reviewAnonymous column yet: keep the local choice.
            ...(prior?.reviewAnonymous !== undefined ? { reviewAnonymous: prior.reviewAnonymous } : {}),
            address: o.address ? String(o.address) : undefined,
            paymentMethod: o.paymentMethod ? String(o.paymentMethod) : undefined,
            serverId: sid,
            // Settlement stamp rides through like the other server facts —
            // the payout hold reads it, so it must survive pulls.
            ...((o as { actualDelivery?: unknown }).actualDelivery
              ? { actualDelivery: String((o as { actualDelivery?: unknown }).actualDelivery) }
              : prior?.actualDelivery
                ? { actualDelivery: prior.actualDelivery }
                : {}),
            // Settlement state rides through too — refunded rows are clawed
            // back (never earnings) and frozen rows unlock on ruling. Server
            // wins when present; prior survives pulls from older builds.
            ...(typeof (o as { paymentStatus?: unknown }).paymentStatus === 'string' && (o as { paymentStatus?: string }).paymentStatus
              ? { paymentStatus: (o as { paymentStatus?: string }).paymentStatus }
              : prior?.paymentStatus
                ? { paymentStatus: prior.paymentStatus }
                : {}),
            ...((o as { disputeFrozen?: unknown }).disputeFrozen !== undefined
              ? { disputeFrozen: Boolean((o as { disputeFrozen?: unknown }).disputeFrozen) }
              : prior?.disputeFrozen !== undefined
                ? { disputeFrozen: prior.disputeFrozen }
                : {}),
            // POD log rides through like the other server facts (buyer
            // tracking renders the latest entry; server wins when present).
            ...(((o as { deliveryLog?: unknown }).deliveryLog as Array<{ at?: string; by?: string; note?: string }> | undefined)?.length
              ? { deliveryLog: (o as { deliveryLog?: Array<{ at?: string; by?: string; note?: string }> }).deliveryLog }
              : prior?.deliveryLog?.length
                ? { deliveryLog: prior.deliveryLog }
                : {}),
            // Server refund row wins (cross-device truth); else keep local.
            ...(serverRefund
              ? {
                  refund: {
                    id: String(serverRefund.id),
                    reason: String(serverRefund.reason ?? ''),
                    status: serverRefund.status as RefundStatus,
                    timeline: prior?.refund?.timeline ?? [],
                    requestedAt: Number(serverRefund.requestedAt ?? Date.now()),
                  },
                }
              : prior?.refund
                ? { refund: prior.refund }
                : {}),
            // No server columns (yet): preserve local values across pulls.
            ...(prior?.deliveryFee !== undefined ? { deliveryFee: prior.deliveryFee } : {}),
            ...(prior?.promoCode !== undefined ? { promoCode: prior.promoCode } : {}),
            ...(prior?.bookingDate !== undefined ? { bookingDate: prior.bookingDate } : {}),
            ...(prior?.bookingTime !== undefined ? { bookingTime: prior.bookingTime } : {}),
            // Timeline done-flags derive from the SERVER status, not a default
            // placed-only template — otherwise pulled orders render stale state.
            tracking: (() => {
              const flowIdx = ORDER_STATUS_FLOW.indexOf((o.status as Order['status']) ?? 'placed');
              const labels = ['Order Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
              return labels.map((label, i) => ({
                label,
                time: i === 0 ? new Date(typeof o.placedAt === 'string' ? Date.parse(o.placedAt) : Number(o.placedAt ?? Date.now())).toLocaleString() : '—',
                done: flowIdx < 0 ? i === 0 : i <= flowIdx,
              }));
            })(),
          };
          return merged;
        });
      // Keep unmatched locals that are still syncing (or freshly created and
      // possibly in-flight): dropping them orphans orders the server may
      // already hold under a different id. Rejected rows (syncFailed) are
      // kept too — they carry the WHY plus the retry path, and deleting them
      // on the next pull ghost-deletes the receipt.
      const now = Date.now();
      for (const o of ordersRef.current) {
        if (seenLocalIds.has(o.id)) continue;
        if (o.syncPending || o.syncFailed || now - o.placedAt < 120000) serverOrders.push(o);
      }
      // Server is the single source of truth — replace instead of merge so
      // stale pre-wipe local rows (demo orders) can never resurface.
      setOrders(serverOrders);
      persist(serverOrders);
      setLoaded(true);
    }).catch(() => {
      // Offline/failed pull: cached rows (if any) are already rendered; an
      // empty cache is now a settled state, not a loading flash.
      setLoaded(true);
    });
  }, [user?.username, tokenSeq]);

  const persist = useCallback((next: Order[]) => {
    AsyncStorage.setItem(ordersKey, JSON.stringify(next)).catch(() => {});
  }, [ordersKey]);

  const placeOrders = useCallback(
    (cart: CartItem[], address?: string, paymentMethod?: string, options?: PlaceOrderOptions) => {
      const sellers = new Map<string, CartItem[]>();
      for (const item of cart) {
        const key = item.sellerUsername;
        sellers.set(key, [...(sellers.get(key) ?? []), item]);
      }
      const now = Date.now();
      const created: Order[] = [];
      let index = ordersRef.current.length;
      const delivery =
        cart.length > 0
          ? cart.every((i) => i.type === 'service')
            ? 0
            : cart.some((i) => i.type === 'food_item')
              ? DELIVERY_FEES.food_item
              : DELIVERY_FEES.product
          : 0;
      const discount = Math.max(0, Math.round(Number(options?.discountEstimate ?? 0)));
      let first = true;
      for (const [sellerUsername, items] of sellers) {
        const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const fee = first ? delivery : 0;
        const disc = first ? discount : 0;
        const chargedTotal = Math.max(0, total + fee - disc);
        const isFood = items.some((i) => i.type === 'food_item');
        index += 1;
        // Random suffix: two devices in the same ms with the same cart size
        // used to mint identical orderNumbers, and the server treats
        // orderNumber as idempotent — two buyers' orders conflated as one.
        const randSuffix = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
        const order: Order = {
          id: `order_${now}_${index}`,
          orderNumber: `#SJ-${String(now).slice(-6)}${index}-${randSuffix}`,
          kind: items.some((i) => i.type === 'service')
            ? 'booking'
            : isFood
              ? 'food'
              : 'order',
          sellerName: items[0].seller,
          sellerUsername,
          // Buyer identity stamped optimistically (server is truth on pull):
          // without it the Orders Rate CTA and rate-review buyer gate can't
          // recognize own rows before the first sync.
          ...(user?.username ? { buyerUsername: user.username } : {}),
          ...(user?.name ? { buyerName: user.name } : {}),
          items: items.map((i) => ({
            listingId: i.listingId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            ...(i.imageUrl ? { imageUrl: i.imageUrl } : {}),
            ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
            ...(i.bundleId ? { bundleId: i.bundleId } : {}),
          })),
          total,
          chargedTotal,
          status: 'placed',
          placedAt: now,
          reviewed: false,
          address,
          paymentMethod,
          deliveryFee: fee,
          ...(options?.promoCode ? { promoCode: options.promoCode } : {}),
          ...(options?.bookingDate ? { bookingDate: options.bookingDate } : {}),
          ...(options?.bookingTime ? { bookingTime: options.bookingTime } : {}),
          ...(options?.offer ? { offer: options.offer } : {}),
          tracking: isFood
            ? [
                { label: 'Order Placed', time: new Date(now).toLocaleString(), done: true },
                { label: 'Preparing', time: '—', done: false },
                { label: 'Out for Delivery', time: '—', done: false },
                { label: 'Delivered', time: '—', done: false },
              ]
            : [
                { label: 'Order Placed', time: new Date(now).toLocaleString(), done: true },
                { label: 'Confirmed', time: '—', done: false },
                { label: 'Preparing', time: '—', done: false },
                { label: 'Out for Delivery', time: '—', done: false },
                { label: 'Delivered', time: '—', done: false },
              ],
        };
        created.push(order);
        first = false;
      }
      setOrders((prev) => {
        const next = [...created, ...prev];
        persist(next);
        return next;
      });
      // Single server sync per order — /api/app/orders is the one real row.
      // The legacy adminSync mirror is NOT called: it created a SECOND admin
      // entity per order (duplicate cuid + order_ rows in the panel).
      // The server's cuid is captured as `serverId` so every later mutation
      // (accept/ship/review/cancel) targets the real row, not the local id.
      const payload = (o: Order) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        sellerUsername: o.sellerUsername,
        sellerName: o.sellerName,
        items: o.items,
        total: o.total,
        chargedTotal: o.chargedTotal,
        kind: o.kind,
        status: o.status,
        placedAt: o.placedAt,
        address: o.address,
        paymentMethod: o.paymentMethod,
        bookingDate: o.bookingDate,
        bookingTime: o.bookingTime,
        deliveryFee: options?.deliveryFee ?? 0,
        promoCode: options?.promoCode ?? undefined,
        ...(options?.offer ? { offer: options.offer } : {}),
        ...(options?.addressParts ?? {}),
      });
      created.forEach((o) => {
        void serverApi.placeOrder(payload(o)).then((res) => {
          const sid = res.ok && res.data && res.data.order ? String(res.data.order.id) : undefined;
          if (sid) {
            setOrders((prev) => {
              const next = prev.map((x) => (x.id === o.id ? { ...x, serverId: sid, syncPending: false, syncFailed: undefined } : x));
              persist(next);
              return next;
            });
            return;
          }
          if (!res.ok && res.error === 'offline') {
            // Network failure (NOT a server reject): the server may or may
            // not have committed. NEVER ghost-delete — flag for explicit
            // retry (idempotent on orderNumber, so retry can't double-charge).
            setOrders((prev) => {
              const next = prev.map((x) => (x.id === o.id ? { ...x, syncPending: true } : x));
              persist(next);
              return next;
            });
            return;
          }
          // Server rejected this order (coupon expired, insufficient funds,
          // validation) — FLAG it with the reason instead of ghost-deleting:
          // the buyer navigated to this receipt and must see WHY, not a
          // not-found page. No money moved (server owns debit).
          const reason = String((res as { error?: unknown }).error ?? 'Rejected by server');
          setOrders((prev) => {
            const next = prev.map((x) => (x.id === o.id ? { ...x, syncPending: false, syncFailed: reason } : x));
            persist(next);
            return next;
          });
        }).catch(() => {
          // Fetch threw (offline mid-flight): same as offline above — keep + flag.
          setOrders((prev) => {
            const next = prev.map((x) => (x.id === o.id ? { ...x, syncPending: true } : x));
            persist(next);
            return next;
          });
        });
      });
      return created;
    },
    [persist, user?.username, user?.name]
  );

  const retryOrderSync = useCallback(
    async (id: string): Promise<boolean> => {
      const order = ordersRef.current.find((o) => o.id === id);
      if (!order) return false;
      const res = await serverApi
        .placeOrder({
          id: order.id,
          orderNumber: order.orderNumber,
          sellerUsername: order.sellerUsername,
          sellerName: order.sellerName,
          items: order.items,
          total: order.total,
          chargedTotal: order.chargedTotal,
          kind: order.kind,
          status: order.status,
          placedAt: order.placedAt,
          address: order.address,
          paymentMethod: order.paymentMethod,
          bookingDate: order.bookingDate,
          bookingTime: order.bookingTime,
          deliveryFee: order.deliveryFee ?? 0,
          promoCode: order.promoCode ?? undefined,
          offer: order.offer ?? undefined,
        })
        .catch(() => null);
      const sid = res && res.ok && res.data && res.data.order ? String(res.data.order.id) : undefined;
      if (sid) {
        setOrders((prev) => {
          const next = prev.map((x) => (x.id === id ? { ...x, serverId: sid, syncPending: false, syncFailed: undefined } : x));
          persist(next);
          return next;
        });
        return true;
      }
      // Explicit server reject on retry: flag the reason on the row (never
      // ghost-delete). Offline keeps pending.
      if (res && !res.ok && res.error !== 'offline') {
        const reason = String(res.error ?? 'Rejected by server');
        setOrders((prev) => {
          const next = prev.map((x) => (x.id === id ? { ...x, syncPending: false, syncFailed: reason } : x));
          persist(next);
          return next;
        });
      }
      return false;
    },
    [persist]
  );

  const getOrder = useCallback(
    (id: string) => {
      const normalized = id.startsWith('#') ? id : `#${id}`;
      return ordersRef.current.find(
        (o) => o.id === id || o.serverId === id || o.orderNumber === id || o.orderNumber === normalized
      );
    },
    []
  );

  const updateOrderStatus = useCallback(
    async (id: string, status: OrderStatus, podNote?: string): Promise<boolean> => {
      const order = ordersRef.current.find((o) => o.id === id);
      if (!order || order.status === 'cancelled') return false;
      if (status === 'cancelled') {
        // Cancel-until-shipped: preparing is still reversible (packing
        // started, nothing left the building); out_for_delivery is the point
        // of no return. Server enforces the same allow-list.
        if (order.status !== 'placed' && order.status !== 'confirmed' && order.status !== 'preparing') return false;
      } else {
        // Fulfilment advances are seller-only AND per-order: the seller on
        // THIS order advances it. A dual-role buyer painting their own
        // purchase delivered flashed tracking + hold stamps before the server
        // 400 rolled it back (global isSeller was not enough).
        const meLower = String(user?.username ?? '').trim().toLowerCase();
        const ownerLower = String(order.sellerUsername ?? '').trim().toLowerCase();
        if (!user?.isSeller || !meLower || meLower !== ownerLower) return false;
        const curIdx = ORDER_STATUS_FLOW.indexOf(order.status);
        const nextIdx = ORDER_STATUS_FLOW.indexOf(status);
        // Adjacent-only fulfilment (seller P0): placed→confirmed→preparing→
        // out_for_delivery→delivered. Skipping straight to delivered used to
        // instantly settle withdrawable earnings with no packing/shipping.
        if (nextIdx === -1 || nextIdx !== curIdx + 1) return false;
      }
      const prevSnapshot = ordersRef.current.find((o) => o.id === id);
      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== id) return o;
          const flowIndex = ORDER_STATUS_FLOW.indexOf(status);
          const tracking = o.tracking.map((step, i) => ({
            ...step,
            done: status === 'cancelled' ? step.done : i <= flowIndex,
            time:
              status !== 'cancelled' && i <= flowIndex && step.time === '—'
                ? new Date().toLocaleString()
                : step.time,
          }));
          // Delivery stamp (7-day hold anchor): set atomically on entering
          // delivered so the wallet hold gate and server payout guard agree.
          // Never backfill — missing stamp means unmatured, not withdrawable.
          const stamp = status === 'delivered' && !(o as { actualDelivery?: unknown }).actualDelivery
            ? { actualDelivery: new Date().toISOString() }
            : {};
          // Optimistic POD entry (server appends the same on ack; pull
          // reconciles). Rolls back with the status on refusal.
          const pod = status === 'delivered' && podNote
            ? { deliveryLog: [...(o.deliveryLog ?? []), { at: new Date().toISOString(), note: podNote }] }
            : {};
          return { ...o, status, tracking, ...stamp, ...pod };
        });
        persist(next);
        return next;
      });
      // Server sync OUTSIDE the updater (updaters must stay pure: StrictMode
      // double-invokes them, which fired this PATCH twice and let rapid taps
      // roll back to a stale snapshot). AWAITED: a refusal/offline rolls back
      // AND reports false so the seller never packs on a lie.
      const realId = ordersRef.current.find((o) => o.id === id)?.serverId ?? id;
      const rollbackStatus = () => {
        setOrders((cur) => {
          const rolled = cur.map((x) => (x.id === id && prevSnapshot ? prevSnapshot : x));
          persist(rolled);
          return rolled;
        });
      };
      try {
        const res = await serverApi.updateOrder(realId, podNote ? { status, podNote } : { status });
        if (!res.ok) rollbackStatus(); // Rollback optimistic update — server truth wins.
        return res.ok;
      } catch {
        rollbackStatus();
        return false;
      }
    },
    [persist, user?.isSeller, user?.username]
  );

  const markReviewed = useCallback(
    async (id: string, rating: number, comment?: string, anonymous?: boolean): Promise<boolean> => {
      const prevSnapshot = ordersRef.current.find((o) => o.id === id);
      setOrders((prev) => {
        const next = prev.map((order) =>
          order.id === id ? { ...order, reviewed: true, rating, reviewComment: comment, reviewAnonymous: !!anonymous } : order
        );
        persist(next);
        return next;
      });
      // Rollback on server refusal (not delivered / already reviewed /
      // offline): a review the server never stored must not render as posted.
      // Returns the ack so callers show success ONLY after the server confirms.
      const realId = ordersRef.current.find((o) => o.id === id)?.serverId ?? id;
      const rollbackReview = () => {
        setOrders((cur) => {
          const rolled = cur.map((x) => (x.id === id && prevSnapshot ? prevSnapshot : x));
          persist(rolled);
          return rolled;
        });
      };
      try {
        const res = await serverApi.updateOrder(realId, { rating, reviewComment: comment ?? '', reviewAnonymous: !!anonymous });
        if (!res.ok) rollbackReview();
        return res.ok;
      } catch {
        rollbackReview();
        return false;
      }
    },
    [persist]
  );

  const requestRefund = useCallback(
    async (orderId: string, reason: string): Promise<boolean> => {
      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order || order.refund) return false;
      const now = Date.now();
      // Build the refund object OUTSIDE the state updater so the admin sync
      // below can reference it (the updater runs asynchronously — capturing
      // inside it previously made the sync never fire).
      const created: Refund = {
        id: `ref_${now}`,
        reason,
        status: 'requested',
        requestedAt: now,
        timeline: [{ author: 'you' as RefundTimelineAuthor, text: `Refund requested: ${reason}.`, time: now }],
      };
      const prevSnapshot = ordersRef.current.find((o) => o.id === orderId);
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId && !o.refund ? { ...o, refund: created } : o));
        persist(next);
        return next;
      });
      // The refund request itself is created server-side (single writer):
      // serverApi.updateOrder({ refundReason }) inserts the canonical Refund
      // row. The legacy admin-mirror POST is gone — it wrote a SECOND
      // duplicate row per request (different id + orderRef, no seller link).
      // AWAITED with rollback: an offline request used to render "requested"
      // forever while the server held nothing and no retry path existed.
      const realRefundId = order.serverId ?? orderId;
      try {
        const res = await serverApi.updateOrder(realRefundId, { refundReason: reason });
        if (!res.ok) {
          setOrders((cur) => {
            const rolled = cur.map((x) => (x.id === orderId && prevSnapshot ? prevSnapshot : x));
            persist(rolled);
            return rolled;
          });
        }
        return res.ok;
      } catch {
        setOrders((cur) => {
          const rolled = cur.map((x) => (x.id === orderId && prevSnapshot ? prevSnapshot : x));
          persist(rolled);
          return rolled;
        });
        return false;
      }
    },
    [persist]
  );

  const respondRefund = useCallback(
    async (orderId: string, author: RefundTimelineAuthor, text: string, newStatus?: RefundStatus): Promise<boolean> => {
      const now = Date.now();
      const prevStatus = ordersRef.current.find((o) => o.id === orderId)?.refund?.status;
      setOrders((prev) => {
        const next = prev.map((order) => {
          if (order.id !== orderId || !order.refund) return order;
          return {
            ...order,
            refund: {
              ...order.refund,
              status: newStatus ?? order.refund.status,
              timeline: [...order.refund.timeline, { author, text, time: now }],
            },
          };
        });
        persist(next);
        return next;
      });
      // Seller decisions settle REAL money server-side (single writer:
      // PATCH /api/app/orders/[id] {refundDecision}, seller-only, idempotent
      // legs shared with the finance desk). The legacy admin-mirror call is
      // gone — it patched a duplicate row and moved no money. Server refusal
      // (not the seller, nothing pending, offline) rolls the optimistic
      // decision back AND reports false — the UI never shows money that
      // didn't move.
      if (newStatus === 'approved' || newStatus === 'rejected') {
        const realId = ordersRef.current.find((o) => o.id === orderId)?.serverId ?? orderId;
        const rollback = () => {
          setOrders((prev) => {
            const next = prev.map((order) => {
              if (order.id !== orderId || !order.refund) return order;
              return {
                ...order,
                refund: {
                  ...order.refund,
                  status: prevStatus ?? order.refund.status,
                  timeline: order.refund.timeline.filter(
                    (t) => !(t.time === now && t.text === text && t.author === author)
                  ),
                },
              };
            });
            persist(next);
            return next;
          });
        };
        try {
          const res = await serverApi.respondRefund(realId, newStatus);
          if (!res.ok) rollback();
          return res.ok;
        } catch {
          rollback();
          return false;
        }
      }
      return true;
    },
    [persist]
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason?: string) => {
      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order || (order.status !== 'placed' && order.status !== 'confirmed' && order.status !== 'preparing') || order.refund) {
        return false;
      }
      const now = Date.now();
      const prevSnapshot = ordersRef.current.find((o) => o.id === orderId);
      // The server cancel settles money IMMEDIATELY in-tx (wallet buyer
      // credited, no Refund row ever created) — so the local mirror must not
      // fabricate a `requested` refund: it never advances (no server row),
      // and sellers render phantom Approve/Reject buttons that 400 forever.
      // Wallet cancels mirror `refunded`; COD moves no money → no refund row.
      const isWallet = String(order.paymentMethod ?? '').trim().toLowerCase() === 'wallet';
      setOrders((prev) => {
        const next = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelled' as OrderStatus,
                tracking: o.tracking
                  ? [
                      ...o.tracking,
                      { label: isWallet ? 'Order cancelled — refund issued' : 'Order cancelled', time: new Date(now).toLocaleString(), done: true },
                    ]
                  : o.tracking,
                ...(isWallet
                  ? {
                      refund: {
                        id: `ref_${now}`,
                        reason: reason ?? 'Order cancelled',
                        status: 'refunded' as RefundStatus,
                        requestedAt: now,
                        timeline: [
                          { author: 'you' as RefundTimelineAuthor, text: 'Order cancelled — refund issued to wallet', time: now },
                        ],
                      },
                    }
                  : { refund: undefined }),
              }
            : o
        );
        persist(next);
        return next;
      });
      // Single server sync OUTSIDE the updater (updaters must stay pure:
      // StrictMode double-invokes them, which fired this PATCH twice), with
      // rollback on refusal/offline — a cancel the server never saw must not
      // read "cancelled / refund requested" (sync lie). Buyer-cancel settles
      // the real refund + clawback server-side.
      const realId = ordersRef.current.find((o) => o.id === orderId)?.serverId ?? orderId;
      const rollback = () => {
        setOrders((cur) => {
          const rolled = cur.map((x) => (x.id === orderId && prevSnapshot ? prevSnapshot : x));
          persist(rolled);
          return rolled;
        });
      };
      try {
        const res = await serverApi.updateOrder(realId, { status: 'cancelled' });
        if (!res.ok) {
          rollback();
          return false;
        }
        return true;
      } catch {
        rollback();
        return false;
      }
    },
    [persist]
  );

  return (
    <OrderContext.Provider
      value={{
        orders,
        placeOrders,
        getOrder,
        retryOrderSync,
        updateOrderStatus,
        markReviewed,
        requestRefund,
        respondRefund,
        cancelOrder,
        loaded,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return ctx;
}

export { STATUS_LABELS, REFUND_STATUS_LABELS };
