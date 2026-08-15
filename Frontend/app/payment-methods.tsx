import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CheckIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { getWallet } from '../utils/walletStore';

export interface PaymentMethod {
  id: string;
  label: string;
  detail: string;
}

export const PAYMENT_KEY = '@susej_payment';

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'upi', label: 'UPI', detail: 'sam@upi' },
  { id: 'card', label: 'Visa', detail: '•••• 4242' },
  { id: 'cod', label: 'Cash on Delivery', detail: 'Pay at your doorstep' },
];

export async function getSelectedPayment(): Promise<PaymentMethod | null> {
  try {
    const raw = await AsyncStorage.getItem(PAYMENT_KEY);
    return raw ? (JSON.parse(raw) as PaymentMethod) : null;
  } catch {
    return null;
  }
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [selected, wallet] = await Promise.all([getSelectedPayment(), getWallet()]);
        if (!active) return;
        // Wallet sits at the top with the live balance; the rest follow.
        const walletMethod: PaymentMethod = { id: 'wallet', label: 'Wallet', detail: `Balance ${formatPrice(wallet.balance)}` };
        setMethods([walletMethod, ...PAYMENT_METHODS]);
        setSelectedId(selected?.id ?? 'wallet');
      } catch {
        if (active) setLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectMethod = useCallback((method: PaymentMethod) => {
    if (method.id === 'wallet' && method.detail === 'Balance ₹0') {
      Alert.alert('Empty wallet', 'Add money in the Wallet tab before paying with wallet.');
      return;
    }
    AsyncStorage.setItem(PAYMENT_KEY, JSON.stringify(method)).catch(() => {});
    router.back();
  }, []);

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
            onPress={() => router.replace('/payment-methods')}
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
