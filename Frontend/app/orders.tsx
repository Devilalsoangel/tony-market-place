import { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders, STATUS_LABELS } from '../contexts/OrderContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orderImages } from '../utils/screenImages';

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
  const [tab, setTab] = useState<'buying' | 'selling'>('buying');
  const { orders } = useOrders();
  const { user } = useAuth();
  // Selling = orders placed against the signed-in user's own store (industry: your shop's sales).
  const myStore = (user?.username ?? '').toLowerCase();
  const data = tab === 'buying' ? orders : orders.filter((o) => (o.sellerUsername ?? '').toLowerCase() === myStore);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
        <View style={{ width: 18 }} />
      </View>

      {/* Tabs - Buying / Selling */}
      <View className="flex-row mx-5 mb-4 bg-surfaceContainerLow rounded-figma-12 p-1">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-figma-8 items-center ${tab === 'buying' ? 'bg-white' : ''}`}
          onPress={() => setTab('buying')}
        >
          <Text className={`font-inter-700 ${tab === 'buying' ? 'text-primaryContainer' : 'text-textSecondary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
            Buying
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-figma-8 items-center ${tab === 'selling' ? 'bg-white' : ''}`}
          onPress={() => setTab('selling')}
        >
          <Text className={`font-inter-600 ${tab === 'selling' ? 'text-primaryContainer' : 'text-textSecondary'}`} style={{ fontSize: 14, lineHeight: 16 }}>
            Selling
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item, index }) => {
          const isNewSellerGroup = index === 0 || data[index - 1].sellerUsername !== item.sellerUsername;
          if (tab === 'selling') {
            return (
              <View>
                {isNewSellerGroup && (
                  <Text className="font-inter-600 text-textSecondary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
                    Sold by {item.sellerName} (@{item.sellerUsername})
                  </Text>
                )}
                <TouchableOpacity
                  className="rounded-figma-24 bg-white p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                  onPress={() => router.push(`/order/${item.id}`)}
                >
                  <View className="flex-row gap-4">
                    {/* Product thumbnail — Figma Order History 96x96 */}
                    <Image
                      source={orderImages[index % 4]}
                      className="w-[96px] h-[96px] rounded-figma-16"
                      resizeMode="cover"
                    />
                    <View className="flex-1">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                          {formatDate(item.placedAt)}
                        </Text>
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.primaryBg }}>
                          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: getStatusColor(item.status) }}>
                            {STATUS_LABELS[item.status]}
                          </Text>
                        </View>
                      </View>

                      <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 22 }}>
                        {item.items[0].name}
                        {item.items.length > 1 ? ` +${item.items.length - 1} more` : ''}
                      </Text>

                      <View className="flex-row justify-between items-center">
                        <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
                          {formatPrice(item.total)}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="font-inter-600 text-primaryContainer mr-1" style={{ fontSize: 14, lineHeight: 16 }}>
                            View
                          </Text>
                          <ChevronRightIcon size={10} color={colors.primaryContainer} />
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View className="rounded-figma-24 bg-white p-4" style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View className="flex-row gap-4">
                {/* Product thumbnail — Figma Order History 96x96 */}
                <Image
                  source={orderImages[index % 4]}
                  className="w-[96px] h-[96px] rounded-figma-16"
                  resizeMode="cover"
                />
                <View className="flex-1">
                  {/* Date + Status row */}
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                      {formatDate(item.placedAt)}
                    </Text>
                    <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 14, color: getStatusColor(item.status) }}>
                      {STATUS_LABELS[item.status]}
                    </Text>
                  </View>

                  {/* Product title */}
                  <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 22 }}>
                    {item.items[0].name}
                    {item.items.length > 1 ? ` +${item.items.length - 1} more` : ''}
                  </Text>

                  {/* Price + actions row */}
                  <View className="flex-row justify-between items-center">
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
                      {formatPrice(item.total)}
                    </Text>
                    <View className="flex-row items-center gap-4">
                      {item.status === 'delivered' && !item.reviewed && (
                        <TouchableOpacity onPress={() => router.push(`/rate-review?id=${item.id}`)}>
                          <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
                            Rate
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => router.push(`/track-order?id=${item.id}`)}>
                        <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
                          View Details
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 18, lineHeight: 28 }}>
              {tab === 'buying' ? 'No orders yet' : 'No sales yet — share your listings'}
            </Text>
            {tab === 'buying' && (
              <TouchableOpacity
                className="px-6 py-3 rounded-full"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={() => router.push('/(tabs)/feed')}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
                  Browse Feed
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
