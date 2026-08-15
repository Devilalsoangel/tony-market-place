import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, SendIcon, CheckIcon, CloseIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useOrders, REFUND_STATUS_LABELS } from '../../contexts/OrderContext';
import type { RefundTimelineAuthor } from '../../contexts/OrderContext';
import { creditWallet as creditWalletFromStore } from '../../utils/walletStore';

const AUTHOR_LABELS: Record<RefundTimelineAuthor, string> = {
  you: 'You',
  seller: 'Seller',
  platform: 'susej team',
};

const AUTHOR_COLORS: Record<RefundTimelineAuthor, string> = {
  you: colors.primaryContainer,
  seller: colors.tertiary,
  platform: colors.success,
};

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

function getChipColors(status: keyof typeof REFUND_STATUS_LABELS): { bg: string; fg: string } {
  switch (status) {
    case 'refunded': return { bg: colors.successBg, fg: colors.success };
    case 'approved': return { bg: colors.primaryBg, fg: colors.primary };
    case 'rejected': return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default: return { bg: colors.primaryContainer, fg: colors.onPrimary };
  }
}

export default function RefundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const refundId = Array.isArray(id) ? id[0] : id ?? '';
  const insets = useSafeAreaInsets();
  const { getOrder, respondRefund } = useOrders();
  const [loaded, setLoaded] = useState(false);
  const [response, setResponse] = useState('');
  const creditedRef = useRef<Set<string>>(new Set());

  const order = loaded ? getOrder(String(refundId)) : undefined;
  const refund = order?.refund;

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 250);
    return () => clearTimeout(t);
  }, [refundId]);

  const creditWallet = (orderId: string, orderNumber: string, amount: number) => {
    if (amount <= 0 || creditedRef.current.has(orderId)) return;
    creditedRef.current.add(orderId);
    void creditWalletFromStore(amount, {
      title: `Refund · ${orderNumber}`,
      detail: 'Refund issued to your susej wallet',
      dedupeByTitle: `Refund · ${orderNumber}`,
    }).catch(() => {});
  };

  const sendResponse = () => {
    const text = response.trim();
    if (!order || !text) return;
    respondRefund(order.id, 'you', text);
    setResponse('');
  };

  const sellerApproves = () => {
    if (!order) return;
    respondRefund(order.id, 'seller', 'Seller approved your refund request.', 'approved');
  };

  const platformReview = () => {
    if (!order) return;
    const amount = order.chargedTotal ?? order.total;
    creditWallet(order.id, order.orderNumber, amount);
    respondRefund(
      order.id,
      'platform',
      `Refund approved and ${formatPrice(amount)} credited to your wallet.`,
      'refunded'
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Refund Details
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : !order || !refund ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
            Refund not found
          </Text>
          <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 13, lineHeight: 18 }}>
            This refund may have been removed.
          </Text>
          <TouchableOpacity
            className="mt-6 items-center justify-center px-6"
            style={{ height: 48, borderRadius: 12, backgroundColor: colors.primaryContainer }}
            onPress={() => router.back()}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 + insets.bottom }}>
          {/* Status chip */}
          <View className="items-start mb-4">
            <View className="px-4 py-2 rounded-full" style={{ backgroundColor: getChipColors(refund.status).bg }}>
              <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: getChipColors(refund.status).fg }}>
                {REFUND_STATUS_LABELS[refund.status]}
              </Text>
            </View>
          </View>

          {/* Case summary */}
          <View className="mb-6 p-4" style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                {refund.reason}
              </Text>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                {order.orderNumber}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                {order.items[0].name}
                {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
              </Text>
              <Text className="font-inter-700 text-primary" style={{ fontSize: 16, lineHeight: 20 }}>
                {formatPrice(order.chargedTotal ?? order.total)}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
            TIMELINE
          </Text>
          <View className="mb-6">
            {refund.timeline.map((entry, i) => {
              const last = i === refund.timeline.length - 1;
              const authorColor = AUTHOR_COLORS[entry.author];
              return (
                <View key={`${entry.time}-${i}`} className="flex-row">
                  <View className="items-center mr-3">
                    <View className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: authorColor }} />
                    {!last && <View className="flex-1 w-px" style={{ backgroundColor: colors.surfaceContainerHigh }} />}
                  </View>
                  <View className="flex-1 pb-5">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                        {AUTHOR_LABELS[entry.author]}
                      </Text>
                      <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                        {formatTime(entry.time)}
                      </Text>
                    </View>
                    <View className="mt-1 p-3" style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 12 }}>
                      <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                        {entry.text}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Resolution note */}
          {refund.status === 'refunded' && (
            <View className="mb-6 p-4 flex-row items-start" style={{ backgroundColor: colors.successBg, borderRadius: 16 }}>
              <CheckIcon size={18} color={colors.success} />
              <View className="flex-1 ml-3">
                <Text className="font-inter-600 mb-1" style={{ fontSize: 14, lineHeight: 16, color: colors.success }}>
                  Refund issued
                </Text>
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                  {formatPrice(order.chargedTotal ?? order.total)} credited to your wallet — arrives in 3–5 working days.
                </Text>
              </View>
            </View>
          )}
          {refund.status === 'rejected' && (
            <View className="mb-6 p-4 flex-row items-start" style={{ backgroundColor: colors.errorContainer, borderRadius: 16 }}>
              <CloseIcon size={18} color={colors.onErrorContainer} />
              <View className="flex-1 ml-3">
                <Text className="font-inter-600 mb-1" style={{ fontSize: 14, lineHeight: 16, color: colors.onErrorContainer }}>
                  Refund rejected
                </Text>
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                  The seller did not accept this request. You can still message the seller to resolve it.
                </Text>
              </View>
            </View>
          )}

          {/* Mock actions while requested */}
          {refund.status === 'requested' && (
            <View className="mb-6">
              <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                SELLER & PLATFORM REVIEW (DEMO)
              </Text>
              <View className="flex-row" style={{ gap: 10 }}>
                <TouchableOpacity
                  className="flex-1 items-center justify-center py-3"
                  style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow }}
                  onPress={sellerApproves}
                >
                  <Text className="font-inter-600 text-tertiary" style={{ fontSize: 13, lineHeight: 16 }}>
                    Seller approves refund
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 items-center justify-center py-3"
                  style={{ borderRadius: 12, backgroundColor: colors.primaryContainer }}
                  onPress={platformReview}
                >
                  <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                    Platform review
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Add response */}
          {refund.status !== 'rejected' && (
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 h-12 px-4 mr-3"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary }}
                placeholder="Add a response…"
                placeholderTextColor={colors.secondary}
                value={response}
                onChangeText={setResponse}
                onSubmitEditing={sendResponse}
                returnKeyType="send"
              />
              <TouchableOpacity
                className="w-12 h-12 items-center justify-center rounded-full"
                style={{ backgroundColor: response.trim() ? colors.primaryContainer : colors.surfaceContainer }}
                onPress={sendResponse}
              >
                <SendIcon size={20} color={response.trim() ? colors.onPrimary : colors.secondary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
