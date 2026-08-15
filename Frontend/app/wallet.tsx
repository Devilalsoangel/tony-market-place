import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, FlatList, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CloseIcon } from '../utils/icons';
import { colors, formatPrice, shadows } from '../utils/theme';
import { storyAvatars } from '../utils/productImages';
import { notificationImages, messageAvatars } from '../utils/screenImages';
import { useAuth } from '../contexts/AuthContext';
import { useOrders } from '../contexts/OrderContext';
import { loadMarketplaceConfig } from '../utils/marketplace';
import { getWallet, saveWallet, type WalletTx } from '../utils/walletStore';

const WITHDRAWALS_KEY = '@susej_withdrawals';

const AMOUNT_PRESETS = [100, 500, 1000];

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  requestedAt: number;
}

const DAY = 86400000;
const HOUR = 3600000;

type Transaction = WalletTx;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatTxDate = (ts: number): string => {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  const time = new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type ListRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'tx'; key: string; tx: Transaction };

const groupTransactions = (items: Transaction[]): ListRow[] => {
  const sorted = [...items].sort((a, b) => b.ts - a.ts);
  const todayStart = startOfDay(Date.now());
  const yesterdayStart = todayStart - DAY;
  const rows: ListRow[] = [];
  let lastGroup: string | null = null;
  for (const tx of sorted) {
    const group = tx.ts >= todayStart ? 'Today' : tx.ts >= yesterdayStart ? 'Yesterday' : 'Earlier';
    if (lastGroup !== group) {
      rows.push({ kind: 'section', key: `s:${group}`, title: group });
      lastGroup = group;
    }
    rows.push({ kind: 'tx', key: tx.id, tx });
  }
  return rows;
};

const AVATAR_POOL = [...Object.values(storyAvatars), ...notificationImages, ...messageAvatars];

// Distinct per-merchant avatar so debits don't all share one face.
const MERCHANT_AVATAR_MAP: [string, number][] = [
  ['Luxe', 0],
  ['Artisan', 1],
  ['TechVault', 2],
  ['Velvet', 3],
  ['FitKart', 4],
  ['Golden Chaat', 5],
  ['Urban Threads', 6],
  ['Green Crates', 7],
  ['BookNook', 8],
  ['Gadget', 9],
];

const avatarFor = (title: string) => {
  const hit = MERCHANT_AVATAR_MAP.find(([key]) => title.toLowerCase().includes(key.toLowerCase()));
  if (hit) return AVATAR_POOL[hit[1] % AVATAR_POOL.length];
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_POOL[h % AVATAR_POOL.length];
};

function WalletPathIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6a2 2 0 012-2h12v2H5v12h16V8a2 2 0 00-2-2h-1V4h1a4 4 0 014 4v8a4 4 0 01-4 4H5a2 2 0 01-2-2V6z" fill={color} />
      <Path d="M15 12a1 1 0 011-1h3v2h-3a1 1 0 01-1-1z" fill={color} />
    </Svg>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders } = useOrders();
  const [loaded, setLoaded] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [preset, setPreset] = useState<number | null>(500);
  const [custom, setCustom] = useState('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  // Live Commission & Fees from the admin panel (falls back to local constants).
  const [commissionRate, setCommissionRate] = useState(0.08);
  const [payoutFee, setPayoutFee] = useState(20);

  useEffect(() => {
    loadMarketplaceConfig().then((c) => {
      setCommissionRate(c.commissionRate);
      setPayoutFee(c.payoutFee);
    });
  }, []);

  useEffect(() => {
    getWallet()
      .then((state) => {
        setBalance(state.balance);
        setTransactions(state.transactions);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(WITHDRAWALS_KEY)
      .then((data) => {
        if (!data) return;
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            setWithdrawals(parsed.filter((w: any) => w && typeof w.id === 'string' && typeof w.amount === 'number'));
          }
        } catch {
          // corrupted — ignore
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveWallet({ balance, transactions }).catch(() => {});
  }, [balance, transactions, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(withdrawals)).catch(() => {});
  }, [withdrawals, loaded]);

  const confirmAdd = () => {
    const amount = preset ?? Number(custom);
    if (!amount || amount <= 0) return;
    setBalance((prev) => prev + amount);
    setTransactions((prev) => [
      { id: `t${Date.now()}`, title: 'Wallet top-up', detail: 'Added via susej Wallet', amount, ts: Date.now() },
      ...prev,
    ]);
    setShowAdd(false);
    setCustom('');
  };

  const rows = useMemo(() => groupTransactions(transactions), [transactions]);

  // Seller earnings from the seller's own delivered orders (real order data).
  const sellerOrders = useMemo(
    () => orders.filter((o) => o.sellerUsername === (user?.username || 'user')),
    [orders, user]
  );
  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const earningsTotal = sellerOrders
    .filter((o) => o.status === 'delivered')
    .reduce((s, o) => s + (o.chargedTotal ?? o.total), 0);
  const earningsMonth = sellerOrders
    .filter((o) => o.status === 'delivered' && o.placedAt >= monthStart)
    .reduce((s, o) => s + (o.chargedTotal ?? o.total), 0);
  // Platform commission (mirrors admin Commission & Fees): payout = gross − commission%.
  const commissionTotal = Math.round(earningsTotal * commissionRate);
  const netEarnings = earningsTotal - commissionTotal;
  const submitPayout = () => {
    const amount = Math.round(Number(payoutAmount));
    if (!amount || amount <= 0 || amount > netEarnings) return;
    const now = Date.now();
    const req: WithdrawalRequest = {
      id: `WDL-${1000 + withdrawals.length + 1}`,
      amount,
      status: 'requested',
      requestedAt: now,
    };
    setWithdrawals((prev) => [req, ...prev]);
    // Mirror to the admin payout queue (fire-and-forget).
    void import('../utils/adminSync').then((m) =>
      m.syncWithdrawal({ id: req.id, amount: req.amount, status: req.status, requestedAt: now })
    );
    setTransactions((prev) => [
      { id: `w${now}`, title: 'Withdrawal to bank', detail: `Payout request ${req.id} · HDFC Bank •••• 4521 · ${formatPrice(payoutFee)} fee`, amount: -amount, ts: now },
      ...prev,
    ]);
    setShowPayout(false);
    setPayoutAmount('');
    Alert.alert(
      'Withdrawal requested',
      `${formatPrice(amount)} payout for ${req.id} is submitted. susej finance reviews it within 24h — you'll see the status here.`,
      [{ text: 'OK' }]
    );
  };

  const PAYOUT_CHIP: Record<WithdrawalRequest['status'], { label: string; bg: string; fg: string }> = {
    requested: { label: 'Requested', bg: colors.primaryFixed, fg: colors.primary },
    approved: { label: 'Approved', bg: colors.tertiaryContainer, fg: colors.tertiary },
    rejected: { label: 'Rejected', bg: colors.errorContainer, fg: colors.error },
    completed: { label: 'Completed', bg: colors.successBg, fg: colors.success },
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const credit = item.amount > 0;
    return (
      <View className="flex-row items-center px-5 py-3">
        <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
          {credit ? (
            <WalletPathIcon size={18} color={colors.primaryContainer} />
          ) : (
            <Image source={avatarFor(item.title)} className="w-11 h-11 rounded-full" resizeMode="cover" />
          )}
        </View>
        <View className="flex-1 pr-3">
          <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
            {item.title}
          </Text>
          <Text className="font-inter-400 mt-0.5" numberOfLines={1} style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
            {item.detail}
          </Text>
          <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, lineHeight: 12, color: colors.textTertiary }}>
            {formatTxDate(item.ts)}
          </Text>
        </View>
        <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: credit ? colors.success : colors.textPrimary }}>
          {credit ? `+${formatPrice(item.amount)}` : `-${formatPrice(Math.abs(item.amount))}`}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Wallet
        </Text>
        <WalletPathIcon size={20} color={colors.primary} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading wallet…
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerClassName="pb-24"
          ListHeaderComponent={
            <View className="px-5 pt-2 pb-4">
              <View style={{ borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 24, ...shadows.card }}>
                <View className="flex-row items-center gap-2">
                  <WalletPathIcon size={18} color={colors.onPrimary} />
                  <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                    susej Wallet
                  </Text>
                </View>
                <Text className="font-inter-700 mt-3" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.onPrimary }}>
                  {formatPrice(balance)}
                </Text>
                <TouchableOpacity
                  className="mt-5 h-12 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.onPrimary }}
                  onPress={() => setShowAdd(true)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.primary }}>
                    Add Money
                  </Text>
                </TouchableOpacity>
              </View>

              {user?.isSeller && (
                <View className="mt-4" style={{ borderRadius: 24, backgroundColor: colors.inverseSurface, padding: 20 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.inverseOnSurface }}>
                      Seller Earnings
                    </Text>
                    <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.7 }}>
                      {formatPrice(earningsMonth)} this month
                    </Text>
                  </View>
                  <Text className="font-inter-700 mt-2" style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.4, color: colors.inverseOnSurface }}>
                    {formatPrice(netEarnings)}
                  </Text>
                  <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface, opacity: 0.7 }}>
                    Gross {formatPrice(earningsTotal)} · −{formatPrice(commissionTotal)} susej commission ({Math.round(commissionRate * 100)}%)
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.55 }}>
                    From {sellerOrders.filter((o) => o.status === 'delivered').length} delivered order{sellerOrders.filter((o) => o.status === 'delivered').length === 1 ? '' : 's'} · first 10 orders 0% commission
                  </Text>
                  <TouchableOpacity
                    className="mt-4 h-11 items-center justify-center"
                    style={{ borderRadius: 12, backgroundColor: colors.inverseOnSurface }}
                    disabled={netEarnings <= 0}
                    onPress={() => setShowPayout(true)}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.inverseSurface }}>
                      Withdraw to bank
                    </Text>
                  </TouchableOpacity>
                  {withdrawals.length > 0 && (
                    <View className="mt-4">
                      <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.3, color: colors.inverseOnSurface, opacity: 0.7 }}>
                        PAYOUT REQUESTS
                      </Text>
                      {withdrawals.slice(0, 4).map((w) => {
                        const chip = PAYOUT_CHIP[w.status];
                        return (
                          <View key={w.id} className="flex-row items-center mt-2">
                            <Text className="font-inter-500 flex-1" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface }}>
                              {w.id}
                            </Text>
                            <Text className="font-inter-500 mr-2" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface }}>
                              {formatPrice(w.amount)}
                            </Text>
                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: chip.bg }}>
                              <Text className="font-inter-600" style={{ fontSize: 9, lineHeight: 12, color: chip.fg }}>
                                {chip.label}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                Transactions
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'section' ? (
              <Text
                className="font-inter-600 px-5 pt-3 pb-1"
                style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.26, color: colors.textTertiary }}
              >
                {item.title}
              </Text>
            ) : (
              renderTransaction({ item: item.tx })
            )
          }
          ListEmptyComponent={
            <View className="items-center py-20 px-8">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <WalletPathIcon size={22} color={colors.textSecondary} />
              </View>
              <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                No transactions yet
              </Text>
              <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                Add money or shop with susej to see your activity here.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
            <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setShowAdd(false)} />
            <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
              </View>
              <View className="flex-row items-center px-5 pt-3 pb-2">
                <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                  Add Money
                </Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <CloseIcon size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="px-5 pb-4">
                <View className="flex-row" style={{ gap: 8 }}>
                  {AMOUNT_PRESETS.map((amt) => {
                    const active = preset === amt;
                    return (
                      <TouchableOpacity
                        key={amt}
                        className="flex-1 items-center py-3"
                        style={{ borderRadius: 16, backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                        onPress={() => {
                          setPreset(amt);
                          setCustom('');
                        }}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: active ? colors.onPrimary : colors.textPrimary }}>
                          {formatPrice(amt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="mt-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput
                    className="px-4 h-14 font-inter-500"
                    placeholder="Custom amount"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}
                    value={custom}
                    onChangeText={(text) => {
                      setCustom(text.replace(/[^0-9]/g, ''));
                      if (text) setPreset(null);
                    }}
                  />
                </View>
                <TouchableOpacity
                  className="mt-4 h-14 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                  onPress={confirmAdd}
                >
                  <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPayout} transparent animationType="slide" onRequestClose={() => setShowPayout(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
            <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setShowPayout(false)} />
            <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
              </View>
              <View className="flex-row items-center px-5 pt-3 pb-2">
                <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                  Withdraw to bank
                </Text>
                <TouchableOpacity onPress={() => setShowPayout(false)}>
                  <CloseIcon size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="px-5 pb-6">
                <View className="px-4 py-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Transfer to
                  </Text>
                  <Text className="font-inter-600 mt-0.5" style={{ fontSize: 13, lineHeight: 18, color: colors.textPrimary }}>
                    HDFC Bank •••• 4521 · A/c holder name
                  </Text>
                </View>
                <View className="mt-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput
                    className="px-4 h-14 font-inter-500"
                    placeholder={`Amount (max ${formatPrice(netEarnings)})`}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}
                    value={payoutAmount}
                    onChangeText={(text) => setPayoutAmount(text.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <TouchableOpacity
                  className="mt-4 h-14 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.primaryContainer, opacity: payoutAmount && Number(payoutAmount) > 0 && Number(payoutAmount) <= netEarnings ? 1 : 0.4 }}
                  disabled={!payoutAmount || Number(payoutAmount) <= 0 || Number(payoutAmount) > netEarnings}
                  onPress={submitPayout}
                >
                  <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                    Request payout
                  </Text>
                </TouchableOpacity>
                <Text className="font-inter-400 mt-3 text-center" style={{ fontSize: 11, lineHeight: 15, color: colors.textTertiary }}>
                  susej finance approves payouts within 24h. Status shows here on the Seller Earnings card.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
