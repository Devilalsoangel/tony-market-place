import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders } from '../contexts/OrderContext';

const DISPUTES_KEY = '@susej_disputes';

export interface DisputeTimelineEntry {
  id: string;
  author: 'you' | 'seller' | 'platform';
  text: string;
  time: number;
}

export interface Dispute {
  id: string;
  orderRef: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved';
  resolution?: string;
  timeline: DisputeTimelineEntry[];
  createdAt: number;
}

const REASONS = ['Item not as described', 'Not received', 'Damaged', 'Other'];

const dayAgo = (days: number) => Date.now() - days * 86400000;

const SEED_DISPUTES: Dispute[] = [
  {
    id: 'd1',
    orderRef: '#SJ-102938',
    reason: 'Damaged',
    description: 'The ceramic pot set arrived with a cracked base and chipped rim.',
    status: 'open',
    timeline: [
      { id: 'd1t1', author: 'you', text: 'Raised a dispute: item arrived damaged.', time: dayAgo(2) },
      { id: 'd1t2', author: 'seller', text: 'So sorry about this — checking packaging records and will get back within 24 hours.', time: dayAgo(1) },
      { id: 'd1t3', author: 'platform', text: 'Case opened. Our team is reviewing both sides.', time: dayAgo(0.5) },
    ],
    createdAt: dayAgo(2),
  },
  {
    id: 'd2',
    orderRef: '#SJ-100211',
    reason: 'Item not as described',
    description: 'Received a different shade of the runner than what was listed.',
    status: 'resolved',
    resolution: `Refund of ${formatPrice(1250)} issued to your wallet (3–5 working days).`,
    timeline: [
      { id: 'd2t1', author: 'you', text: 'Raised a dispute: colour does not match the listing.', time: dayAgo(6) },
      { id: 'd2t2', author: 'seller', text: 'We apologise for the mix-up — offering a full refund.', time: dayAgo(5) },
      { id: 'd2t3', author: 'platform', text: 'Seller agreed to full refund. Case resolved in buyer favour.', time: dayAgo(4) },
    ],
    createdAt: dayAgo(6),
  },
];

function ShieldPathIcon({ size = 20, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill={color} />
    </Svg>
  );
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

export default function DisputesScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const [loaded, setLoaded] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [orderRef, setOrderRef] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(DISPUTES_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setDisputes(parsed as Dispute[]);
              setLoaded(true);
              return;
            }
          } catch {
            // corrupted data — fall through to seed
          }
        }
        setDisputes(SEED_DISPUTES);
        setLoaded(true);
      })
      .catch(() => {
        setDisputes(SEED_DISPUTES);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(DISPUTES_KEY, JSON.stringify(disputes)).catch(() => {});
  }, [disputes, loaded]);

  const openForm = () => {
    setOrderRef(orders[0]?.orderNumber ?? 'SJ-');
    setReason(null);
    setDescription('');
    setShowForm(true);
  };

  const createDispute = () => {
    const ref = orderRef.trim();
    if (!ref || !reason || !description.trim()) return;
    const now = Date.now();
    const dispute: Dispute = {
      id: `d${now}`,
      orderRef: ref.startsWith('#') ? ref : `#${ref}`,
      reason,
      description: description.trim(),
      status: 'open',
      timeline: [{ id: `t${now}`, author: 'you', text: `Raised a dispute: ${reason}.`, time: now }],
      createdAt: now,
    };
    setDisputes((prev) => [dispute, ...prev]);
    setShowForm(false);
    router.push(`/dispute/${dispute.id}`);
  };

  const canSubmit = Boolean(orderRef.trim() && reason && description.trim());

  const renderDispute = (dispute: Dispute) => {
    const chip =
      dispute.status === 'resolved'
        ? { bg: colors.successBg, fg: colors.success, label: 'Resolved' }
        : dispute.status === 'under_review'
        ? { bg: colors.surfaceContainer, fg: colors.tertiary, label: 'Under review' }
        : { bg: colors.primaryContainer, fg: colors.onPrimary, label: 'Open' };
    return (
      <TouchableOpacity
        key={dispute.id}
        className="mb-4 p-4"
        style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        onPress={() => router.push(`/dispute/${dispute.id}`)}
      >
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
            <ShieldPathIcon size={18} color={dispute.status === 'resolved' ? colors.success : colors.primaryContainer} />
          </View>
          <View className="flex-1 pr-2">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
              {dispute.reason}
            </Text>
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {dispute.orderRef} · {formatTime(dispute.createdAt)}
            </Text>
          </View>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: chip.bg }}>
            <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: chip.fg }}>
              {chip.label}
            </Text>
          </View>
        </View>
        <Text className="font-inter-400 text-textPrimary" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
          {dispute.description}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Disputes
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 + insets.bottom }}>
          {/* Raise a dispute */}
          <TouchableOpacity
            className="items-center justify-center mb-6"
            style={{ height: 56, borderRadius: 16, backgroundColor: colors.primaryContainer }}
            onPress={() => (showForm ? setShowForm(false) : openForm())}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
              {showForm ? 'Close' : 'Raise a dispute'}
            </Text>
          </TouchableOpacity>

          {/* Inline form */}
          {showForm && (
            <View className="mb-6 p-4" style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 16 }}>
              <Text className="font-inter-600 text-textPrimary mb-3" style={{ fontSize: 16, lineHeight: 24 }}>
                New dispute
              </Text>
              <Text className="font-inter-500 text-textSecondary mb-1" style={{ fontSize: 12, lineHeight: 14 }}>
                ORDER REFERENCE
              </Text>
              <TextInput
                className="px-4 mb-4"
                style={{ height: 48, borderRadius: 12, backgroundColor: colors.surfaceContainerLowest, color: colors.textPrimary, fontSize: 15, fontFamily: 'Inter_400Regular' }}
                placeholder="e.g. #SJ-102938"
                placeholderTextColor={colors.textTertiary}
                value={orderRef}
                onChangeText={setOrderRef}
                autoCapitalize="characters"
              />
              <Text className="font-inter-500 text-textSecondary mb-2" style={{ fontSize: 12, lineHeight: 14 }}>
                REASON
              </Text>
              <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                {REASONS.map((r) => {
                  const active = reason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLowest }}
                      onPress={() => setReason(r)}
                    >
                      <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="font-inter-500 text-textSecondary mb-1" style={{ fontSize: 12, lineHeight: 14 }}>
                DESCRIPTION
              </Text>
              <TextInput
                className="px-4 mb-4"
                style={{ minHeight: 88, borderRadius: 12, backgroundColor: colors.surfaceContainerLowest, color: colors.textPrimary, fontSize: 15, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' }}
                placeholder="Describe what went wrong…"
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <TouchableOpacity
                className="items-center justify-center"
                style={{ height: 48, borderRadius: 12, backgroundColor: canSubmit ? colors.primaryContainer : colors.surfaceContainer }}
                disabled={!canSubmit}
                onPress={createDispute}
              >
                <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: canSubmit ? colors.onPrimary : colors.textTertiary }}>
                  Submit dispute
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {disputes.length === 0 ? (
            <View className="items-center py-16">
              <ShieldPathIcon size={40} color={colors.surfaceContainerHigh} />
              <Text className="font-inter-600 text-textPrimary mt-4" style={{ fontSize: 16, lineHeight: 24 }}>
                No disputes yet
              </Text>
              <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 13, lineHeight: 18 }}>
                If an order goes wrong, you can raise a dispute here.
              </Text>
            </View>
          ) : (
            disputes.map(renderDispute)
          )}
        </ScrollView>
      )}
    </View>
  );
}
