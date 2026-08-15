import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, MoreIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { sellerImages } from '../utils/screenImages';
import { useAuth } from '../contexts/AuthContext';
import { useOrders, Order, OrderStatus } from '../contexts/OrderContext';

// Seller Orders — Incoming (Figma 245:2376) — live orders from OrderContext,
// grouped by seller tab, with working Accept / Ship transitions.

type Tab = 'All' | 'Placed' | 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

const TAB_STATUSES: Partial<Record<Tab, OrderStatus[]>> = {
  Placed: ['placed'],
  Confirmed: ['confirmed'],
  Preparing: ['preparing'],
  'Out for Delivery': ['out_for_delivery'],
  Delivered: ['delivered'],
  Cancelled: ['cancelled'],
};

const NOTE_BY_STATUS: Partial<Record<OrderStatus, string>> = {
  placed: 'Payment received · awaiting acceptance',
  confirmed: 'Accepted · awaiting shipment',
  preparing: 'Packing your order',
  out_for_delivery: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const DEMO_QUEUE: Order[] = [
  {
    id: 'demo_sell_1',
    orderNumber: '#SUJ-4821',
    kind: 'order',
    sellerName: 'Your Store',
    sellerUsername: 'demo_seller',
    items: [
      { listingId: 'demo_a', name: 'Vintage Silk Saree', price: 4999, quantity: 1 },
      { listingId: 'demo_b', name: 'Handmade Ceramic Set', price: 1299, quantity: 1 },
    ],
    total: 6298,
    status: 'placed',
    placedAt: Date.now() - 2 * 36e5,
    reviewed: false,
    tracking: [],
  },
  {
    id: 'demo_sell_2',
    orderNumber: '#SUJ-4710',
    kind: 'order',
    sellerName: 'Your Store',
    sellerUsername: 'demo_seller',
    items: [{ listingId: 'demo_c', name: 'Canvas Tote Bag', price: 850, quantity: 1 }],
    total: 850,
    status: 'confirmed',
    placedAt: Date.now() - 24 * 36e5,
    reviewed: false,
    tracking: [],
  },
  {
    id: 'demo_sell_3',
    orderNumber: '#SUJ-4605',
    kind: 'order',
    sellerName: 'Your Store',
    sellerUsername: 'demo_seller',
    items: [{ listingId: 'demo_d', name: 'Silver Filigree Earrings', price: 2400, quantity: 1 }],
    total: 2400,
    status: 'out_for_delivery',
    placedAt: Date.now() - 3 * 24 * 36e5,
    reviewed: false,
    tracking: [],
  },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SellerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, updateOrderStatus, respondRefund } = useOrders();
  const [tab, setTab] = useState<Tab>('All');
  const [demoQueue, setDemoQueue] = useState<Order[]>(DEMO_QUEUE);

  // Real orders for this seller; fall back to the demo queue when the account
  // has no seller orders yet so the screen stays meaningful in the demo.
  const myOrders = useMemo(
    () => orders.filter((o) => o.sellerUsername === (user?.username || 'user')),
    [orders, user]
  );
  const isDemo = myOrders.length === 0;
  const queue = isDemo ? demoQueue : myOrders;

  const visible = tab === 'All' ? queue : queue.filter((o) => TAB_STATUSES[tab]?.includes(o.status));
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: queue.length };
    for (const t of Object.keys(TAB_STATUSES) as Tab[]) {
      c[t] = queue.filter((o) => TAB_STATUSES[t]?.includes(o.status)).length;
    }
    return c;
  }, [queue]);

  const earnings = isDemo
    ? 38412
    : queue.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.chargedTotal ?? o.total), 0);

  const transition = (order: Order, next: OrderStatus) => {
    if (isDemo) {
      setDemoQueue((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      return;
    }
    if (!updateOrderStatus(order.id, next)) {
      Alert.alert('Cannot update', 'This order status can no longer be changed.');
    }
  };

  const primaryAction = (o: Order) => {
    if (o.status === 'placed')
      return { label: 'Accept Order', run: () => transition(o, 'confirmed') };
    if (o.status === 'confirmed' || o.status === 'preparing')
      return { label: 'Mark Shipped', run: () => transition(o, 'out_for_delivery') };
    if (o.status === 'out_for_delivery')
      return { label: 'Track via courier', run: () => Alert.alert('In transit', `Order ${o.orderNumber} is with the courier.`) };
    if (o.status === 'delivered')
      return { label: 'Message Buyer', run: () => router.push('/(tabs)/chat') };
    return null;
  };

  const REFUND_LABEL: Record<string, string> = {
    requested: 'REFUND REQUESTED',
    approved: 'REFUND APPROVED',
    rejected: 'REFUND REJECTED',
    refunded: 'REFUND ISSUED',
  };

  const respondToRefund = (o: Order, approve: boolean) => {
    const doRespond = (note?: string) => {
      if (isDemo) {
        setDemoQueue((prev) =>
          prev.map((x) =>
            x.id === o.id
              ? {
                  ...x,
                  refund: {
                    id: `ref_demo_${Date.now()}`,
                    reason: x.refund?.reason || 'Buyer requested a refund',
                    status: approve ? ('approved' as const) : ('rejected' as const),
                    requestedAt: Date.now(),
                    timeline: [],
                  },
                }
              : x
          )
        );
        return;
      }
      respondRefund(
        o.id,
        'seller',
        approve
          ? `Refund approved${note ? `: ${note}` : ''}. The amount will be returned to the buyer's wallet.`
          : `Refund declined${note ? `: ${note}` : ''}.`,
        approve ? 'approved' : 'rejected'
      );
    };
    if (!approve) {
      Alert.alert('Reject refund request', `${o.orderNumber} — ${o.refund?.reason || 'Buyer requested a refund'}. Reason for declining?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject refund', style: 'destructive', onPress: () => doRespond() },
      ]);
      return;
    }
    Alert.alert('Approve refund', `Approve the refund for ${o.orderNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => doRespond() },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
          Orders
        </Text>
        <TouchableOpacity>
          <MoreIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Earnings pill */}
        <TouchableOpacity
          className="self-start mx-5 mb-4 px-4 py-2 rounded-full flex-row items-center"
          style={{ backgroundColor: colors.primaryContainer, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }}
        >
          <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 18 }}>
            {formatPrice(earnings)} this month
          </Text>
          <Text className="font-inter-500 text-white/80 ml-1" style={{ fontSize: 12, lineHeight: 16 }}>
            ›
          </Text>
        </TouchableOpacity>

        {/* Status tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {(['All', 'Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <TouchableOpacity key={t} onPress={() => setTab(t)} className="px-4 py-2 rounded-full" style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}>
                <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : colors.textPrimary }}>
                  {t} ({counts[t] ?? 0})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Orders */}
        <View className="mx-5 mt-4" style={{ gap: 12 }}>
          {visible.length === 0 && (
            <View className="p-6 rounded-figma-24 items-center" style={{ backgroundColor: colors.surfaceContainer }}>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
                No {tab === 'All' ? '' : tab.toLowerCase() + ' '}orders yet
              </Text>
            </View>
          )}
          {visible.map((o) => {
            const action = primaryAction(o);
            return (
              <View key={o.id} className="p-4 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
                <View className="flex-row items-center">
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                    Order {o.orderNumber}
                  </Text>
                  {o.status === 'placed' && (
                    <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                      <Text className="font-inter-500 text-white" style={{ fontSize: 10, lineHeight: 12 }}>
                        NEW
                      </Text>
                    </View>
                  )}
                  <Text className="font-inter-400 text-textSecondary ml-auto" style={{ fontSize: 11, lineHeight: 14 }}>
                    {timeAgo(o.placedAt)}
                  </Text>
                </View>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                  {NOTE_BY_STATUS[o.status]}
                </Text>
                {o.refund && (
                  <View className="self-start mt-2 px-2 py-1 rounded-full" style={{ backgroundColor: o.refund.status === 'requested' ? colors.errorContainer : colors.surfaceContainer }}>
                    <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: o.refund.status === 'requested' ? colors.error : colors.textSecondary }}>
                      {REFUND_LABEL[o.refund.status] ?? 'REFUND'}
                    </Text>
                  </View>
                )}

                {/* Items */}
                <View className="mt-3" style={{ gap: 8 }}>
                  {o.items.map((item, idx) => (
                    <View key={item.listingId + idx} className="flex-row items-center">
                      <Image source={sellerImages.products[idx % sellerImages.products.length]} className="w-10 h-10 rounded-figma-10 mr-3" resizeMode="cover" />
                      <View className="flex-1">
                        <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                          {item.name}
                        </Text>
                        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                          Qty {item.quantity}
                        </Text>
                      </View>
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                        {formatPrice(item.price * item.quantity)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="flex-row items-center mt-3 pt-3 border-t" style={{ borderTopColor: colors.surfaceContainer }}>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                    Buyer
                  </Text>
                  <Text className="font-inter-500 text-textPrimary ml-2 flex-1" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                    via SUSEJ checkout
                  </Text>
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                    {formatPrice(o.chargedTotal ?? o.total)}
                  </Text>
                </View>

                <View className="flex-row mt-3" style={{ gap: 10 }}>
                  {o.refund && o.refund.status === 'requested' ? (
                    <>
                      <TouchableOpacity className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={() => respondToRefund(o, true)}>
                        <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                          Approve refund
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }} onPress={() => respondToRefund(o, false)}>
                        <Text className="font-inter-600 text-error" style={{ fontSize: 13, lineHeight: 16 }}>
                          Reject
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : action ? (
                    <TouchableOpacity className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={action.run}>
                      <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                      <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                        {o.status === 'cancelled' ? 'Order cancelled' : 'Delivered'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }} onPress={() => router.push('/(tabs)/chat')}>
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                      Message Buyer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}