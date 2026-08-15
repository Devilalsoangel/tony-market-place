import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, AlertButton } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, MapPinIcon, StarIcon, SendIcon, ShopIcon, BagIcon, ChevronRightIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useOrders, STATUS_LABELS, REFUND_STATUS_LABELS } from '../../contexts/OrderContext';
import { productImages } from '../../utils/productImages';

const REFUND_REASONS = ['Item not as described', 'Item not received', 'Damaged', 'Other'];
const CANCEL_REASONS = ['Changed my mind', 'Found better price', 'Ordered by mistake', 'Other'];
const RETURN_WINDOW_MS = 7 * 86400000;

function getRefundChipColors(status: keyof typeof REFUND_STATUS_LABELS): { bg: string; fg: string } {
  switch (status) {
    case 'refunded': return { bg: colors.successBg, fg: colors.success };
    case 'approved': return { bg: colors.primaryBg, fg: colors.primary };
    case 'rejected': return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default: return { bg: colors.primaryContainer, fg: colors.onPrimary };
  }
}

function getStatusColor(status: keyof typeof STATUS_LABELS): string {
  switch (status) {
    case 'delivered': return colors.primary;
    case 'out_for_delivery': return colors.primaryContainer;
    case 'placed':
    case 'confirmed':
    case 'preparing': return colors.tertiary;
    case 'cancelled': return colors.textSecondary;
    default: return colors.textSecondary;
  }
}

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { getOrder, requestRefund, cancelOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const order = rawId ? getOrder(String(rawId)) : undefined;
  const [showRefundPicker, setShowRefundPicker] = useState(false);
  const [refundReason, setRefundReason] = useState<string | null>(null);

  const submitRefund = () => {
    if (!order || !refundReason) return;
    requestRefund(order.id, refundReason);
    setRefundReason(null);
    setShowRefundPicker(false);
  };

  const toggleRefundPicker = () => {
    setShowRefundPicker((v) => !v);
    setRefundReason(null);
  };

  if (!order) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
            Order Details
          </Text>
          <View style={{ width: 16 }} />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <ShopIcon size={56} color={colors.textSecondary} />
          <Text className="text-[18px] font-inter-700 text-textPrimary mt-5 mb-2" style={{ lineHeight: 28 }}>
            Order not found
          </Text>
          <Text className="text-[14px] font-inter-400 text-textSecondary text-center" style={{ lineHeight: 20 }}>
            We couldn't find this order. It may have been removed or is no longer available.
          </Text>
          <TouchableOpacity className="px-6 py-3 rounded-full mt-6" style={{ backgroundColor: colors.primaryContainer }} onPress={() => router.back()}>
            <Text className="text-[14px] font-inter-600 text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const steps = order.tracking.map((s) => ({ label: s.label, date: s.time, done: s.done }));
  const activeIdx = steps.findIndex((s) => !s.done);

  const canCancel = !order.refund && (order.status === 'placed' || order.status === 'confirmed');

  const confirmCancel = () => {
    const buttons: AlertButton[] = [
      ...CANCEL_REASONS.map((reason) => ({
        text: reason,
        style: 'default' as const,
        onPress: () => {
          cancelOrder(order.id, reason);
        },
      })),
      { text: 'Keep order', style: 'cancel' as const },
    ];
    Alert.alert('Cancel this order?', 'Why are you cancelling?', buttons, { cancelable: true });
  };

  const orderNumber = order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderDate = new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const etaLine =
    order.status === 'delivered'
      ? `Delivered on ${orderDate}`
      : order.status === 'cancelled'
        ? 'Order cancelled'
        : order.kind === 'food'
          ? 'Arriving in 30–40 min'
          : 'Arriving soon';

  const deliveredStep = order.tracking.find((s) => s.done && s.label === 'Delivered');
  const deliveredStepTime = deliveredStep ? new Date(deliveredStep.time).getTime() : NaN;
  const deliveredAt = Number.isNaN(deliveredStepTime) ? order.placedAt : deliveredStepTime;
  const withinReturnWindow =
    order.status === 'delivered' && !order.refund && Date.now() <= deliveredAt + RETURN_WINDOW_MS;

  const returnUntil = withinReturnWindow
    ? new Date(deliveredAt + RETURN_WINDOW_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Order Details
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 40, rowGap: 20 }}>
        {/* Order # + status */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[16px] font-inter-700 text-textPrimary" style={{ lineHeight: 24 }}>
              Order {orderNumber}
            </Text>
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.primaryBg }}>
              <Text className="text-[12px] font-inter-600" style={{ lineHeight: 16, color: getStatusColor(order.status) }}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
          </View>
          <Text className="text-[14px] font-inter-500 mt-1" style={{ lineHeight: 20, color: getStatusColor(order.status) }}>
            {etaLine}
          </Text>
        </View>

        {/* Status timeline */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <Text className="text-[15px] font-inter-700 text-textPrimary mb-4" style={{ lineHeight: 22 }}>
            Order Progress
          </Text>
          <View className="ml-2">
            {steps.map((step, i) => {
              const isActive = activeIdx === -1 ? i === steps.length - 1 : i === activeIdx;
              const isDone = activeIdx === -1 ? true : i < activeIdx;
              return (
                <View key={step.label} className="flex-row">
                  <View className="items-center mr-4">
                    <View
                      className="w-4 h-4 rounded-full"
                      style={{
                        borderWidth: 2,
                        borderColor: isActive ? colors.primaryContainer : isDone ? colors.primaryContainer : colors.surfaceContainer,
                        backgroundColor: isActive ? colors.primaryContainer : isDone ? colors.primaryFixedDim : colors.surfaceContainerLowest,
                      }}
                    />
                    {i < steps.length - 1 && (
                      <View className="w-0.5 flex-1 my-1" style={{ minHeight: 18, backgroundColor: isDone ? colors.primaryFixedDim : colors.surfaceContainer }} />
                    )}
                  </View>
                  <View className="flex-1 pb-5">
                    <Text className="text-[14px] font-inter-600" style={{ lineHeight: 20, color: isActive ? colors.primaryContainer : colors.textPrimary }}>
                      {step.label}
                    </Text>
                    <Text className="text-[12px] font-inter-400 text-textSecondary" style={{ lineHeight: 16 }}>
                      {step.date}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Return window — informational banner; the single action lives in the refund card below */}
        {returnUntil && (
          <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[14px] font-inter-500" style={{ lineHeight: 20, color: colors.textPrimary }}>
                  Return window: open until {returnUntil}
                </Text>
                <Text className="text-[12px] font-inter-400 text-textSecondary mt-1" style={{ lineHeight: 16 }}>
                  You can request a return within 7 days of delivery.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Items */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <Text className="text-[15px] font-inter-700 text-textPrimary mb-3" style={{ lineHeight: 22 }}>
            Items ({order.items.length})
          </Text>
          <View style={{ rowGap: 14 }}>
            {order.items.map((item) => (
              <View key={item.listingId} className="flex-row items-center">
                <View className="w-12 h-12 rounded-[12px] overflow-hidden mr-3" style={{ backgroundColor: colors.surfaceContainerLow }}>
                  <Image
                    source={productImages[item.listingId] ?? { uri: `https://picsum.photos/seed/${item.listingId}/48/48` }}
                    className="w-full h-full"
                    style={{ width: 48, height: 48 }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 18 }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[12px] font-inter-400 text-textSecondary" style={{ lineHeight: 16 }}>
                    Qty {item.quantity}
                  </Text>
                </View>
                <Text className="text-[14px] font-inter-600 text-textPrimary" style={{ lineHeight: 20 }}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Address + payment */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <View className="flex-row items-center mb-2">
            <MapPinIcon size={16} color={colors.primaryContainer} />
            <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
              Delivery Address
            </Text>
          </View>
          {order.address ? (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              {order.address}
            </Text>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Not provided
            </Text>
          )}
          <View className="h-[1px] my-3" style={{ backgroundColor: colors.surfaceContainerLow }} />
          <View className="flex-row items-center mb-2">
            <BagIcon size={16} color={colors.primaryContainer} />
            <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
              Payment
            </Text>
          </View>
          <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
            {order.paymentMethod ?? 'Not provided'}
          </Text>
        </View>

        {/* Totals */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <Text className="text-[15px] font-inter-700 text-textPrimary mb-3" style={{ lineHeight: 22 }}>
            Payment Summary
          </Text>
          <View style={{ rowGap: 10 }}>
            <View className="flex-row justify-between">
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Items Total</Text>
              <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{formatPrice(order.total)}</Text>
            </View>
            <View className="h-[1px]" style={{ backgroundColor: colors.surfaceContainerLow }} />
            <View className="flex-row justify-between">
              <Text className="text-[15px] font-inter-700 text-textPrimary" style={{ lineHeight: 22 }}>Total Paid</Text>
              <Text className="text-[15px] font-inter-700" style={{ lineHeight: 22, color: colors.primary }}>{formatPrice(order.chargedTotal ?? order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Refund */}
        {order.refund ? (
          <TouchableOpacity
            className="mx-5 rounded-[24px] p-4"
            style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
            onPress={() => router.push(`/refund/${order!.id}`)}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-[15px] font-inter-700 text-textPrimary" style={{ lineHeight: 22 }}>
                  Refund
                </Text>
                <View className="px-3 py-1 rounded-full ml-3" style={{ backgroundColor: getRefundChipColors(order.refund.status).bg }}>
                  <Text className="text-[12px] font-inter-600" style={{ lineHeight: 16, color: getRefundChipColors(order.refund.status).fg }}>
                    {REFUND_STATUS_LABELS[order.refund.status]}
                  </Text>
                </View>
              </View>
              <ChevronRightIcon size={12} color={colors.primaryContainer} />
            </View>
            <Text className="text-[14px] font-inter-400 text-textSecondary mt-2" style={{ lineHeight: 20 }}>
              {order.refund.reason}
            </Text>
            <Text className="text-[18px] font-inter-700 text-primary mt-1" style={{ lineHeight: 24 }}>
              {formatPrice(order.chargedTotal ?? order.total)}
            </Text>
          </TouchableOpacity>
        ) : order.status === 'delivered' && Date.now() <= deliveredAt + RETURN_WINDOW_MS ? (
          <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[15px] font-inter-700 text-textPrimary" style={{ lineHeight: 22 }}>
                  Not happy with your order?
                </Text>
                <Text className="text-[13px] font-inter-400 text-textSecondary mt-1" style={{ lineHeight: 18 }}>
                  Request a refund — sellers respond within 3–7 days.
                </Text>
              </View>
              <TouchableOpacity
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: showRefundPicker ? colors.surfaceContainer : colors.primaryContainer }}
                onPress={() => { setShowRefundPicker((v) => !v); setRefundReason(null); }}
              >
                <Text className="text-[13px] font-inter-600" style={{ lineHeight: 18, color: showRefundPicker ? colors.textSecondary : colors.onPrimary }}>
                  {showRefundPicker ? 'Cancel' : 'Request Refund'}
                </Text>
              </TouchableOpacity>
            </View>
            {showRefundPicker && (
              <View className="mt-4">
                <Text className="text-[12px] font-inter-500 text-textSecondary mb-2" style={{ lineHeight: 14, letterSpacing: 0.24 }}>
                  REASON
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {REFUND_REASONS.map((r) => {
                    const active = refundReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        className="px-4 py-2 rounded-full"
                        style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                        onPress={() => setRefundReason(r)}
                      >
                        <Text className="text-[13px] font-inter-500" style={{ lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  className="items-center justify-center mt-4"
                  style={{ height: 44, borderRadius: 12, backgroundColor: refundReason ? colors.primaryContainer : colors.surfaceContainer }}
                  disabled={!refundReason}
                  onPress={submitRefund}
                >
                  <Text className="text-[15px] font-inter-600" style={{ lineHeight: 20, color: refundReason ? colors.onPrimary : colors.textTertiary }}>
                    Confirm refund request
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Cancel order */}
        {canCancel && (
          <TouchableOpacity
            className="mx-5 items-center justify-center py-3 rounded-[16px]"
            style={{ backgroundColor: colors.errorContainer }}
            onPress={confirmCancel}
          >
            <Text className="text-[14px] font-inter-600" style={{ lineHeight: 20, color: colors.onErrorContainer }}>
              Cancel Order
            </Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View className="mx-5 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            className="flex-1 items-center justify-center py-3 rounded-[16px]"
            style={{ backgroundColor: colors.surfaceContainerLow }}
            onPress={() => router.push('/map')}
          >
            <MapPinIcon size={18} color={colors.primaryContainer} />
            <Text className="text-[13px] font-inter-600 text-textPrimary mt-1" style={{ lineHeight: 18 }}>
              Track on Map
            </Text>
          </TouchableOpacity>
          {order.status === 'delivered' && !order.reviewed && (
            <TouchableOpacity
              className="flex-1 items-center justify-center py-3 rounded-[16px]"
              style={{ backgroundColor: colors.surfaceContainerLow }}
              onPress={() => router.push(`/rate-review?id=${order.id}`)}
            >
              <StarIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[13px] font-inter-600 text-textPrimary mt-1" style={{ lineHeight: 18 }}>
                Rate & Review
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="flex-1 items-center justify-center py-3 rounded-[16px]"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => router.push(`/(tabs)/chat?seller=${order.sellerUsername}`)}
          >
            <SendIcon size={18} color={colors.surfaceContainerLowest} />
            <Text className="text-[13px] font-inter-600 text-white mt-1" style={{ lineHeight: 18 }}>
              Contact Seller
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
