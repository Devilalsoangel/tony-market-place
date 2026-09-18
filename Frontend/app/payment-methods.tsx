import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CheckIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { getWallet, syncWalletFromServer } from '../utils/walletStore';
import { useAuth } from '../contexts/AuthContext';

export interface PaymentMethod {
  id: string;
  label: string;
  detail: string;
}

export const PAYMENT_KEY = '@susej_payment';
export const PAYMENT_KEY_BASE = PAYMENT_KEY;

async function getPaymentKey(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('app_user');
    if (raw) {
      const u = JSON.parse(raw) as { username?: string };
      const name = typeof u?.username === 'string' ? u.username.trim() : '';
      if (name) return `${PAYMENT_KEY_BASE}:${name}`;
    }
  } catch {}
  return PAYMENT_KEY_BASE;
}

// Industry-standard honesty: only offer rails the platform actually settles.
// Server truth: wallet = atomic server debit; COD = settles on delivery.
// UPI/Card have NO backend settlement path yet - offering them would be fake
// rails, so they stay OUT until wired (UPI intent + KYC'd merchant ID).
export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cod', label: 'Cash on Delivery', detail: 'Pay at your doorstep' },
];

export async function getSelectedPayment(): Promise<PaymentMethod | null> {
  try {
    const key = await getPaymentKey();
    let raw = await AsyncStorage.getItem(key);
    if (raw === null && key !== PAYMENT_KEY_BASE) {
      const legacy = await AsyncStorage.getItem(PAYMENT_KEY_BASE);
      if (legacy !== null) {
        try { await AsyncStorage.setItem(key, legacy); } catch {}
        raw = legacy;
      }
    }
    return raw ? (JSON.parse(raw) as PaymentMethod) : null;
  } catch {
    return null;
  }
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { tokenSeq } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  // Balance freshness: a failed sync leaves a possibly stale-low cache — the
  // gate must say "couldn't verify", never a false "Empty wallet".
  const [balanceStale, setBalanceStale] = useState(false);
  // Bumped by Retry so the effect below genuinely re-runs (same-route
  // router.replace does not reliably remount this screen).
  const [retrySeq, setRetrySeq] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Server-synced first: the gate below must judge real money, and the
        // row must display it — never a stale cache snapshot.
        const synced = await syncWalletFromServer().catch(() => false);
        const [selected, wallet] = await Promise.all([getSelectedPayment(), getWallet()]);
        if (!active) return;
        if (!synced) setBalanceStale(true);
        // Wallet sits at the top with the live balance; the rest follow.
        const walletMethod: PaymentMethod = { id: 'wallet', label: 'Wallet', detail: `Balance ${formatPrice(wallet.balance)}${!synced ? ' (offline)' : ''}` };
        setWalletBalance(wallet.balance);
        setMethods([walletMethod, ...PAYMENT_METHODS]);
        setSelectedId(selected?.id ?? 'wallet');
      } catch {
        if (active) setLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [tokenSeq, retrySeq]);

  const selectMethod = useCallback((method: PaymentMethod) => {
    // Numeric gate on the synced balance — never a formatted-string match.
    // Stale (unsynced) balances never false-block: the checkout re-gates on
    // live money at place time anyway.
    if (method.id === 'wallet' && walletBalance <= 0 && !balanceStale) {
      Alert.alert('Empty wallet', 'Add money in the Wallet tab before paying with wallet.');
      return;
    }
    void getPaymentKey().then((k) => AsyncStorage.setItem(k, JSON.stringify(method)).catch(() => {}));
    router.back();
  }, [walletBalance, balanceStale]);

  return (
    <View className="flex-1 bg-surface">
      {/* Header — h52 safe area */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Payment Method
        </Text>
        <View style={{ width: 16 }} />
      </View>

      {methods === null && !loadFailed && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primaryContainer} />
        </View>
      )}

      {loadFailed && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[18px] font-inter-600 text-textPrimary mb-2" style={{ lineHeight: 28 }}>
            Couldn't load payment methods
          </Text>
          <TouchableOpacity
            className="px-6 py-3 rounded-full"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => {
              setLoadFailed(false);
              setMethods(null);
              setRetrySeq((s) => s + 1);
            }}
          >
            <Text className="text-[14px] font-inter-600 text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {methods !== null && (
        <FlatList
          data={methods}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-8"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, rowGap: 16 }}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <TouchableOpacity
                className="flex-row items-center rounded-[24px] px-4 py-4"
                style={{
                  backgroundColor: colors.surfaceContainerLowest,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primaryContainer : colors.surfaceContainer,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 2,
                }}
                onPress={() => selectMethod(item)}
              >
                <View className="flex-1">
                  <Text className="text-[15px] font-inter-600 text-textPrimary" style={{ lineHeight: 22 }}>
                    {item.label}
                  </Text>
                  <Text className="text-[13px] font-inter-400 text-textSecondary" style={{ lineHeight: 18 }}>
                    {item.detail}
                  </Text>
                </View>
                {/* Radio */}
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={{
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primaryContainer : colors.outlineVariant,
                    backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLowest,
                  }}
                >
                  {isSelected && <CheckIcon size={12} color={colors.surfaceContainerLowest} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-[16px] font-inter-600 text-textPrimary" style={{ lineHeight: 24 }}>
                No payment methods
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
