import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { resolveListingImage } from '../utils/productImages';
import { useAuth } from '../contexts/AuthContext';
import { useOrders, Order, OrderStatus } from '../contexts/OrderContext';
import { sellerNetForOrders, isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';
import { usePosts } from '../contexts/PostContext';

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
  confirmed: 'Accepted · awaiting shipment',
  preparing: 'Packing your order',
  out_for_delivery: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Honest money copy: COD orders have NOT been paid at placement time.
// Exact trimmed-lowercase match (server canonical) — the old /cash|cod/
// substring labeled e.g. "Cashback reward" prepaid rows as cash-on-delivery.
function isCashOrder(o: Order): boolean {
  const m = String(o.paymentMethod ?? '').trim().toLowerCase();
  return m === 'cash on delivery' || m === 'cod' || m === 'cash';
}

function noteFor(o: Order): string {
  if (o.status === 'placed')
    return isCashOrder(o) ? 'Awaiting acceptance · cash on delivery' : 'Payment received · awaiting acceptance';
  return NOTE_BY_STATUS[o.status] ?? '';
}

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
  const { orders, loaded: ordersLoaded, updateOrderStatus, respondRefund, cancelOrder } = useOrders();
  const { posts } = usePosts();
  const [tab, setTab] = useState<Tab>('All');
  // Proof-of-delivery notes per order (courier tracking ID / receiver name).
  // Mark Delivered requires one — a bare tap used to settle COD with zero
  // evidence, and the server 400s without it.
  const [podNotes, setPodNotes] = useState<Record<string, string>>({});

  // Canonical listing image: the real post's own photo when available; seeded
  // fallback only when the listing is not in the local cache.
  // Canonical listing image, in priority order: the image captured on the
  // ORDER ITEM at checkout (same picture the buyer saw), then the live post,
  // then the deterministic fallback.
  const listingImageSource = (listingId: string, orderImageUrl?: string) => {
    const fromOrder = orderImageUrl;
    if (fromOrder) return { uri: String(fromOrder) };
    const listing = posts.find((p) => p.id === listingId);
    const img = listing ? listing.image ?? listing.images?.[0] : undefined;
    if (img === undefined || img === null) return resolveListingImage(null, listingId);
    return typeof img === 'number' ? img : { uri: String(img) };
  };

  // Real orders for this seller only — honest empty state when none exist.
  // Case-insensitive: server stores exact username casing, client may vary.
  const myOrders = useMemo(() => {
    const me = (user?.username ?? '').trim().toLowerCase();
    if (!me) return [];
    return orders.filter((o) => (o.sellerUsername ?? '').toLowerCase() === me);
  }, [orders, user]);
  const queue = myOrders;

  const visible = tab === 'All' ? queue : queue.filter((o) => TAB_STATUSES[tab]?.includes(o.status));
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: queue.length };
    for (const t of Object.keys(TAB_STATUSES) as Tab[]) {
      c[t] = queue.filter((o) => TAB_STATUSES[t]?.includes(o.status)).length;
    }
    return c;
  }, [queue]);

  // Net after 8% commission — matches hub + dashboard + wallet (gross here
  // would show sellers money they never receive).
  // Seller earnings — single definition shared with every seller surface
  // (marketplace.sellerNetForOrders): goods-only × live rate. A third local
  // formula here disagreed with hub + dashboard on identical orders.
  const earnings = sellerNetForOrders(queue);

  const transition = async (order: Order, next: OrderStatus, podNote?: string) => {
    const ok = await updateOrderStatus(order.id, next, podNote);
    if (!ok) {
      Alert.alert('Update did not go through', 'The order may have changed, or the sync failed. Refresh and try again — nothing was recorded.');
    }
  };

  const primaryAction = (o: Order) => {
    if (o.status === 'placed')
      return { label: 'Accept Order', run: () => transition(o, 'confirmed') };
    if (o.status === 'confirmed')
      return { label: 'Start Preparing', run: () => transition(o, 'preparing') };
    if (o.status === 'preparing')
      return { label: 'Mark Shipped', run: () => transition(o, 'out_for_delivery') };
    if (o.status === 'out_for_delivery')
      return {
        label: 'Mark Delivered',
        run: () =>
          Alert.alert(
            'Confirm delivery',
            'Only mark delivered after the buyer receives the goods. Enter the courier tracking ID or receiver name on the order card first — it is stored as the delivery proof the buyer sees. False delivery marks settle COD earnings and can be disputed — abuse leads to suspension.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Confirm POD',
                onPress: () => {
                  const note = (podNotes[o.id] ?? '').trim();
                  if (note.length < 4) {
                    Alert.alert('Proof needed', 'Enter the courier tracking ID or receiver name on the card before marking delivered.');
                    return;
                  }
                  transition(o, 'delivered', note);
                },
              },
            ]
          ),
      };
    // delivered/cancelled are terminal: neutral placeholder + single Message Buyer CTA below
    return null;
  };

  const REFUND_LABEL: Record<string, string> = {
    requested: 'REFUND REQUESTED',
    approved: 'REFUND APPROVED',
    rejected: 'REFUND REJECTED',
    refunded: 'REFUND ISSUED',
  };

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="Orders" user={user} />;

  const respondToRefund = (o: Order, approve: boolean) => {
    const doRespond = (note?: string) => {
      respondRefund(
        o.id,
        'seller',
        approve
          ? `Refund approved${note ? `: ${note}` : ''}. The amount will be returned to the buyer's wallet.`
          : `Refund declined${note ? `: ${note}` : ''}.`,
        approve ? 'approved' : 'rejected'
      ).then((ok) => {
        if (!ok) {
          Alert.alert('Decision not recorded', 'The server refused or could not sync — the refund was rolled back. Check your connection and try again.');
        }
      });
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
          <View style={{ width: 20 }} />
        </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Earnings pill — opens the wallet where seller earnings live. */}
        <TouchableOpacity
          className="self-start mx-5 mb-4 px-4 py-2 rounded-full flex-row items-center"
          style={{ backgroundColor: colors.primaryContainer, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }}
          onPress={() => router.push('/wallet')}
        >
            <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 18 }}>
              {formatPrice(earnings)} net earned
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
              <TouchableOpacity key={t} onPress={() => setTab(t)} className="px-4 py-2 rounded-full" accessibilityRole="button" accessibilityLabel={'Filter orders by status: ' + t} style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}>
                <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : colors.textPrimary }}>
                  {t} ({counts[t] ?? 0})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Orders */}
        <View className="mx-5 mt-4" style={{ gap: 12 }}>
          {!ordersLoaded && (
            <View className="p-6 rounded-figma-24 items-center" style={{ backgroundColor: colors.surfaceContainer }}>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
                Loading orders…
              </Text>
            </View>
          )}
          {ordersLoaded && visible.length === 0 && (
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
                  {noteFor(o)}
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
                      <Image source={listingImageSource(item.listingId, item.imageUrl)} className="w-10 h-10 rounded-figma-10 mr-3" resizeMode="cover" />
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
                    {o.buyerUsername || o.buyerName || 'via SUSEJ checkout'}
                  </Text>
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                    {formatPrice(o.chargedTotal ?? o.total)}
                  </Text>
                </View>
                {/* Ship-to: the seller fulfils FROM this screen — address is mandatory. */}
                <View className="mt-2 px-3 py-2 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0.8 }}>
                    SHIP TO
                  </Text>
                  <Text className="font-inter-500 text-textPrimary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                    {o.address || 'Address not yet synced — pull to refresh before shipping.'}
                  </Text>
                </View>
                {/* POD note: required before Mark Delivered (server 400s without
                    it). Stored on the order; the buyer sees it on tracking. */}
                {o.status === 'out_for_delivery' && (
                  <View className="mt-2 px-3 py-2 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
                    <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0.8 }}>
                      DELIVERY PROOF — TRACKING ID / RECEIVER NAME
                    </Text>
                    <TextInput
                      value={podNotes[o.id] ?? ''}
                      onChangeText={(t) => setPodNotes((prev) => ({ ...prev, [o.id]: t }))}
                      placeholder="e.g. Delhivery 78410239655 / handed to Ramesh"
                      placeholderTextColor={colors.textTertiary}
                      maxLength={200}
                      style={{ fontSize: 13, color: colors.textPrimary, paddingVertical: 6 }}
                    />
                  </View>
                )}

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
                    <>
                      <TouchableOpacity className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={action.run}>
                        <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                      {(o.status === 'placed' || o.status === 'confirmed' || o.status === 'preparing') && (
                        <TouchableOpacity
                          className="h-11 px-3 rounded-figma-12 items-center justify-center"
                          style={{ backgroundColor: colors.surfaceContainer }}
                          accessibilityRole="button"
                          accessibilityLabel={`Decline order ${o.orderNumber}`}
                          onPress={() =>
                            Alert.alert(
                              'Decline order?',
                              `${o.orderNumber} will be cancelled and the buyer refunded to their wallet. Only decline when you cannot fulfil — repeated declines hurt your seller standing.`,
                              [
                                { text: 'Keep order', style: 'cancel' },
                                { text: 'Decline & refund buyer', style: 'destructive', onPress: () => {
                                  void cancelOrder(o.id, 'Declined by seller — buyer refunded to wallet').then((ok) => {
                                    if (!ok) {
                                      Alert.alert('Decline did not go through', 'The server refused the cancel — nothing was refunded. Refresh and try again.');
                                    }
                                  });
                                } },
                              ]
                            )
                          }
                        >
                          <Text className="font-inter-600 text-error" style={{ fontSize: 13, lineHeight: 16 }}>
                            Decline
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View className="flex-1 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                      <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                        {o.status === 'cancelled' ? 'Order cancelled' : 'Delivered'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    className="flex-1 h-11 rounded-figma-12 items-center justify-center"
                    style={{ backgroundColor: colors.surfaceContainer }}
                    onPress={() => {
                      // Username-only: a display name ("Aarav Sharma") is not a
                      // thread identity — pushing it opens a device-local stub
                      // that can never deliver. Say so instead of failing mute.
                      const to = (o.buyerUsername ?? '').trim();
                      if (to) {
                        router.push({ pathname: '/(tabs)/chat', params: { to } });
                      } else {
                        Alert.alert('No contact linked', 'This order has no buyer account attached (legacy row) — the buyer cannot be messaged from here.');
                      }
                    }}
                  >
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