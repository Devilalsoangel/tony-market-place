import { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders, STATUS_LABELS } from '../contexts/OrderContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveListingImage } from '../utils/productImages';

function getStatusColor(status: keyof typeof STATUS_LABELS): string {
  switch (status) {
    case 'delivered': return '#2e7d32';
    case 'out_for_delivery': return colors.primaryContainer;
    case 'placed':
    case 'confirmed':
    case 'preparing': return '#e65100';
    case 'cancelled': return colors.textSecondary;
    default: return colors.textSecondary;
  }
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders, loaded: ordersLoaded, cancelOrder } = useOrders();
  const { user } = useAuth();
  const myStore = (user?.username ?? '').toLowerCase();
  const STATUS_TABS = ['All', 'In Progress', 'Delivered', 'Cancelled'] as const;
  type StatusTab = (typeof STATUS_TABS)[number];
  const [statusTab, setStatusTab] = useState<StatusTab>('All');
  const data = orders
    // Buyer history hides own-listing sales — but never hides rows that need
    // attention (pending/failed syncs surface here with their error card).
    .filter((o) => o.syncFailed || o.syncPending || (o.sellerUsername ?? '').toLowerCase() !== myStore)
    .filter((o) => {
      if (statusTab === 'All') return true;
      if (statusTab === 'Delivered') return o.status === 'delivered';
      if (statusTab === 'Cancelled') return o.status === 'cancelled';
      return o.status === 'placed' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'out_for_delivery';
    });

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center h-[52px] px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Order History
        </Text>
        <TouchableOpacity onPress={() => router.push('/saved')}>
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 20, color: colors.primaryContainer }}>
            Saved
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status filter tabs — industry: All / In Progress / Delivered / Cancelled */}
      <View className="flex-row items-center px-5 pt-1" style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
        {STATUS_TABS.map((tab) => {
          const active = tab === statusTab;
          return (
            <TouchableOpacity key={tab} className="items-center pb-2.5 px-4" onPress={() => setStatusTab(tab)} accessibilityRole="button" accessibilityLabel={`Show ${tab} orders`}>
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight:  16, color: active ? colors.primary : colors.secondary, letterSpacing: 0.14 }}>{tab}</Text>
              {active && <View className="absolute bottom-0 w-[42px] h-[2px] rounded-full" style={{ backgroundColor: colors.primary }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {!ordersLoaded && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primaryContainer} />
        </View>
      )}

      {ordersLoaded && (
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
            <TouchableOpacity
              className="rounded-figma-24 bg-white p-4"
              style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`View order ${item.orderNumber ?? item.id}`}
              onPress={() => router.push(`/order/${item.id}`)}
            >
              <View className="flex-row gap-4">
                {/* Product thumbnail — Figma Order History 96x96 */}
                <Image
                  source={item.items[0]?.imageUrl ? { uri: item.items[0].imageUrl } : resolveListingImage(null, item.items[0]?.listingId ?? item.id)}
                  className="w-[96px] h-[96px] rounded-figma-16"
                  resizeMode="cover"
                />
                <View className="flex-1">
                  {/* Date + Status row */}
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                      {formatDate(item.placedAt)}
                      {item.orderNumber ? ` · ${item.orderNumber}` : ''}
                    </Text>
                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.primaryBg }}>
                      <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: getStatusColor(item.status) }}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                  </View>

                  {/* Product title — guarded: legacy/malformed orders may carry zero items */}
                  <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 22 }}>
                    {item.items[0]?.name ?? 'Order'}
                    {item.items.length > 1 ? ` +${item.items.length - 1} more` : ''}
                  </Text>

                  {/* Price + actions row */}
                  <View className="flex-row justify-between items-center">
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
                      {formatPrice(item.chargedTotal ?? item.total)}
                    </Text>
                    <View className="flex-row items-center gap-4">
                      {(item.status === 'placed' || item.status === 'confirmed') && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              'Cancel order?',
                              'The seller will be notified. Prepaid amounts return to your wallet.',
                              [
                                { text: 'Keep order', style: 'cancel' },
                                {
                                  text: 'Cancel order',
                                  style: 'destructive',
                                  onPress: () => {
                                    if (!cancelOrder(item.id, 'Cancelled by buyer')) {
                                      Alert.alert('Cannot cancel', 'This order can no longer be cancelled. Contact support for help.');
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                          hitSlop={{ top: 8, bottom:	8, left:	8, right:	8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel order ${item.orderNumber ?? item.id}`}
                        >
                          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: colors.error }}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      )}
                      {item.status === 'delivered' && !item.reviewed && (
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); router.push(`/rate-review?id=${item.id}`); }}
                          hitSlop={{ top: 8, bottom:	8, left:	8, right:	8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Rate this order"
                        >
                          <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
                            Rate
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); router.push(`/order/${item.id}`); }}
                        hitSlop={{ top: 8, bottom:	8, left:	8, right:	8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`View details for order ${item.orderNumber ?? item.id}`}
                      >
                        <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
                          Receipt
                        </Text>
                      </TouchableOpacity>
                      {(item.status === 'placed' || item.status === 'confirmed' || item.status === 'preparing' || item.status === 'out_for_delivery') && (
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); router.push(`/track-order?id=${item.id}`); }}
                          hitSlop={{ top: 8, bottom:	8, left:	8, right:	8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Track order ${item.orderNumber ?? item.id}`}
                        >
                          <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
                            Track
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 18, lineHeight: 28 }}>
              No orders yet
            </Text>
            <TouchableOpacity
              className="px-6 py-3 rounded-full"
              style={{ backgroundColor: colors.primaryContainer }}
              onPress={() => router.push('/(tabs)/feed')}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
                Browse Feed
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}
    </View>
  );
}
