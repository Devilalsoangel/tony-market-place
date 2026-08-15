import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ChevronRightIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders, REFUND_STATUS_LABELS } from '../contexts/OrderContext';

function RefundArrowIcon({ size = 20, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
        fill={color}
      />
    </Svg>
  );
}

function getChipColors(status: keyof typeof REFUND_STATUS_LABELS): { bg: string; fg: string } {
  switch (status) {
    case 'refunded': return { bg: colors.successBg, fg: colors.success };
    case 'approved': return { bg: colors.primaryBg, fg: colors.primary };
    case 'rejected': return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default: return { bg: colors.primaryContainer, fg: colors.onPrimary };
  }
}

const formatTime = (time: number): string => {
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString();
};

export default function RefundsScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const refunds = orders.filter((o) => o.refund);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Refunds
        </Text>
        <View style={{ width: 18 }} />
      </View>

      <FlatList
        data={refunds}
        keyExtractor={(item) => item.refund!.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const refund = item.refund!;
          const chip = getChipColors(refund.status);
          const orderNumber = item.orderNumber.startsWith('#') ? item.orderNumber : `#${item.orderNumber}`;
          return (
            <TouchableOpacity
              className="p-4"
              style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              onPress={() => router.push(`/refund/${item.id}`)}
            >
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                  <RefundArrowIcon size={18} color={chip.fg} />
                </View>
                <View className="flex-1 pr-2">
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                    {refund.reason}
                  </Text>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    {orderNumber} · {formatTime(refund.requestedAt)}
                  </Text>
                </View>
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: chip.bg }}>
                  <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: chip.fg }}>
                    {REFUND_STATUS_LABELS[refund.status]}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 20 }}>
                  {formatPrice(item.chargedTotal ?? item.total)}
                </Text>
                <View className="flex-row items-center">
                  <Text className="font-inter-600 text-primaryContainer mr-1" style={{ fontSize: 13, lineHeight: 16 }}>
                    View
                  </Text>
                  <ChevronRightIcon size={10} color={colors.primaryContainer} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-8">
            <RefundArrowIcon size={40} color={colors.surfaceContainerHigh} />
            <Text className="font-inter-600 text-textPrimary mt-4" style={{ fontSize: 16, lineHeight: 24 }}>
              No refunds yet
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 13, lineHeight: 18 }}>
              Refunds you request will show up here.
            </Text>
            <TouchableOpacity
              className="mt-6 px-6 py-3 rounded-full"
              style={{ backgroundColor: colors.primaryContainer }}
              onPress={() => router.back()}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
                Go back
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
