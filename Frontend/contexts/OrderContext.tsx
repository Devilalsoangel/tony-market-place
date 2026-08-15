import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, DELIVERY_FEES, DEMO_DISCOUNT } from './CartContext';

const ORDERS_KEY = '@susej_orders';

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
  items: OrderItem[];
  total: number;
  /** Amount actually charged to the buyer (items + delivery − discount). Falls back to total. */
  chargedTotal?: number;
  status: OrderStatus;
  placedAt: number;
  reviewed: boolean;
  rating?: number;
  reviewComment?: string;
  tracking: TrackingStep[];
  address?: string;
  paymentMethod?: string;
  bookingDate?: string;
  bookingTime?: string;
  refund?: Refund;
}

export interface PlaceOrderOptions {
  bookingDate?: string;
  bookingTime?: string;
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
  updateOrderStatus: (id: string, status: OrderStatus) => boolean;
  markReviewed: (id: string, rating: number, comment?: string) => void;
  requestRefund: (orderId: string, reason: string) => void;
  respondRefund: (
    orderId: string,
    author: RefundTimelineAuthor,
    text: string,
    newStatus?: RefundStatus
  ) => void;
  /**
   * Cancels an order. Contract: returns true when the order was cancelled
   * (status set to 'cancelled', tracking note appended, persisted).
   * Returns false when refused — order not found, status other than
   * 'placed'/'confirmed', or a refund already exists.
   */
  cancelOrder: (orderId: string, reason?: string) => boolean;
}

const ORDER_STATUS_FLOW: OrderStatus[] = [
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

const dayAgo = (days: number) => Date.now() - days * 86400000;

const SEED_ORDERS: Order[] = [
  {
    id: 'seed_order_1',
    orderNumber: '#SJ-102938',
    kind: 'order',
    sellerName: 'Luxe Threads',
    sellerUsername: 'luxe',
    items: [{ listingId: 'post_001', name: 'Handmade Ceramic Plant Pot', price: 1299, quantity: 1 }],
    total: 1299,
    status: 'delivered',
    placedAt: dayAgo(8),
    reviewed: false,
    tracking: [
      { label: 'Order Placed', time: new Date(dayAgo(8)).toLocaleString(), done: true },
      { label: 'Confirmed', time: new Date(dayAgo(8)).toLocaleString(), done: true },
      { label: 'Preparing', time: new Date(dayAgo(7)).toLocaleString(), done: true },
      { label: 'Out for Delivery', time: new Date(dayAgo(6)).toLocaleString(), done: true },
      { label: 'Delivered', time: new Date(dayAgo(6)).toLocaleString(), done: true },
    ],
    address: 'Shivaji Nagar, Pune 411005',
    paymentMethod: 'UPI',
    refund: {
      id: 'ref_seed_1',
      reason: 'Item not as described',
      status: 'refunded',
      requestedAt: dayAgo(6),
      timeline: [
        { author: 'you', text: 'Refund requested: Item not as described.', time: dayAgo(6) },
        { author: 'seller', text: 'We apologise — approving your refund request.', time: dayAgo(5) },
        { author: 'platform', text: 'Refund approved and issued to your wallet (3–5 working days).', time: dayAgo(4) },
      ],
    },
  },
  {
    id: 'seed_order_2',
    orderNumber: '#SJ-103399',
    kind: 'order',
    sellerName: 'TechVault',
    sellerUsername: 'techvault',
    items: [{ listingId: 'post_002', name: 'Wireless Headphones', price: 2499, quantity: 1 }],
    total: 2499,
    status: 'delivered',
    placedAt: dayAgo(3),
    reviewed: false,
    tracking: [
      { label: 'Order Placed', time: new Date(dayAgo(3)).toLocaleString(), done: true },
      { label: 'Confirmed', time: new Date(dayAgo(3)).toLocaleString(), done: true },
      { label: 'Preparing', time: new Date(dayAgo(2)).toLocaleString(), done: true },
      { label: 'Out for Delivery', time: new Date(dayAgo(1)).toLocaleString(), done: true },
      { label: 'Delivered', time: new Date(dayAgo(1)).toLocaleString(), done: true },
    ],
    address: 'Shivaji Nagar, Pune 411005',
    paymentMethod: 'Visa',
  },
];

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(ORDERS_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setOrders(parsed as Order[]);
              return;
            }
          } catch {
            // corrupted data — fall through to seed
          }
        }
        setOrders(SEED_ORDERS);
      })
      .catch(() => setOrders(SEED_ORDERS));
  }, []);

  const persist = useCallback((next: Order[]) => {
    AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const placeOrders = useCallback(
    (cart: CartItem[], address?: string, paymentMethod?: string, options?: PlaceOrderOptions) => {
      const sellers = new Map<string, CartItem[]>();
      for (const item of cart) {
        const key = item.sellerUsername;
        sellers.set(key, [...(sellers.get(key) ?? []), item]);
      }
      const now = Date.now();
      const created: Order[] = [];
      let index = orders.length;
      const delivery =
        cart.length > 0
          ? cart.some((i) => i.type === 'food_item')
            ? DELIVERY_FEES.food_item
            : DELIVERY_FEES.product
          : 0;
      const discount = cart.length > 0 ? DEMO_DISCOUNT : 0;
      let first = true;
      for (const [sellerUsername, items] of sellers) {
        const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const fee = first ? delivery : 0;
        const disc = first ? discount : 0;
        const chargedTotal = Math.max(0, total + fee - disc);
        const isFood = items.some((i) => i.type === 'food_item');
        index += 1;
        const order: Order = {
          id: `order_${now}_${index}`,
          orderNumber: `#SJ-${String(now).slice(-6)}${index}`,
          kind: items.some((i) => i.type === 'service')
            ? 'booking'
            : isFood
              ? 'food'
              : 'order',
          sellerName: items[0].seller,
          sellerUsername,
          items: items.map((i) => ({
            listingId: i.listingId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          total,
          chargedTotal,
          status: 'placed',
          placedAt: now,
          reviewed: false,
          address,
          paymentMethod,
          ...(options?.bookingDate ? { bookingDate: options.bookingDate } : {}),
          ...(options?.bookingTime ? { bookingTime: options.bookingTime } : {}),
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
      // Mirror the fresh orders to the admin panel DB (fire-and-forget).
      created.forEach((o) => {
        void import('../utils/adminSync').then((m) =>
          m.syncOrder({
            id: o.id,
            orderNumber: o.orderNumber,
            sellerName: o.sellerName,
            items: o.items,
            total: o.total,
            chargedTotal: o.chargedTotal,
            status: o.status,
            placedAt: o.placedAt,
            address: o.address,
            paymentMethod: o.paymentMethod,
          })
        );
      });
      return created;
    },
    [orders.length, persist]
  );

  const getOrder = useCallback(
    (id: string) => {
      const normalized = id.startsWith('#') ? id : `#${id}`;
      return orders.find(
        (o) => o.id === id || o.orderNumber === id || o.orderNumber === normalized
      );
    },
    [orders]
  );

  const updateOrderStatus = useCallback(
    (id: string, status: OrderStatus): boolean => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status === 'cancelled') return false;
      if (status === 'cancelled') {
        if (order.status !== 'placed' && order.status !== 'confirmed') return false;
      } else {
        const curIdx = ORDER_STATUS_FLOW.indexOf(order.status);
        const nextIdx = ORDER_STATUS_FLOW.indexOf(status);
        if (nextIdx === -1 || nextIdx <= curIdx) return false;
      }
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
          return { ...o, status, tracking };
        });
        persist(next);
        // Mirror the status change to the admin panel (fire-and-forget).
        void import('../utils/adminSync').then((m) => m.syncOrderStatus(id, { status }));
        return next;
      });
      return true;
    },
    [orders, persist]
  );

  const markReviewed = useCallback(
    (id: string, rating: number, comment?: string) => {
      setOrders((prev) => {
        const next = prev.map((order) =>
          order.id === id ? { ...order, reviewed: true, rating, reviewComment: comment } : order
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const requestRefund = useCallback(
    (orderId: string, reason: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.refund) return;
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
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId && !o.refund ? { ...o, refund: created } : o));
        persist(next);
        return next;
      });
      // Mirror the refund request to the admin refunds queue (fire-and-forget).
      void import('../utils/adminSync').then((m) =>
        m.syncRefundRequest({
          id: created.id,
          orderId,
          reason: created.reason,
          status: created.status,
          requestedAt: created.requestedAt,
          amount: order.chargedTotal ?? order.total,
        })
      );
    },
    [orders, persist]
  );

  const respondRefund = useCallback(
    (orderId: string, author: RefundTimelineAuthor, text: string, newStatus?: RefundStatus) => {
      const now = Date.now();
      const refundId = orders.find((o) => o.id === orderId)?.refund?.id;
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
      // Mirror a status decision (seller approve/reject, platform refunded)
      // to the admin refunds queue (fire-and-forget).
      if (refundId && newStatus) {
        void import('../utils/adminSync').then((m) => m.syncRefundStatus(refundId, newStatus, text));
      }
    },
    [orders, persist]
  );

  const cancelOrder = useCallback(
    (orderId: string, reason?: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order || (order.status !== 'placed' && order.status !== 'confirmed') || order.refund) {
        return false;
      }
      const now = Date.now();
      setOrders((prev) => {
        const next = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelled' as OrderStatus,
                tracking: o.tracking
                  ? [
                      ...o.tracking,
                      { label: 'Order cancelled — refund requested', time: new Date(now).toLocaleString(), done: true },
                    ]
                  : o.tracking,
                refund: {
                  id: `ref_${now}`,
                  reason: reason ?? 'Order cancelled',
                  status: 'requested' as RefundStatus,
                  requestedAt: now,
                  timeline: [
                    { author: 'you' as RefundTimelineAuthor, text: 'Order cancelled — refund requested', time: now },
                  ],
                },
              }
            : o
        );
        persist(next);
        // Mirror the cancellation + refund to the admin panel (fire-and-forget).
        void import('../utils/adminSync').then((m) =>
          m.syncOrderStatus(orderId, { status: 'cancelled', paymentStatus: 'refunded' })
        );
        return next;
      });
      return true;
    },
    [orders, persist]
  );

  return (
    <OrderContext.Provider
      value={{
        orders,
        placeOrders,
        getOrder,
        updateOrderStatus,
        markReviewed,
        requestRefund,
        respondRefund,
        cancelOrder,
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
