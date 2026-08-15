import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Switch, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { BackIcon, MapPinIcon, ChevronRightIcon, ShopIcon, BagIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart, DELIVERY_FEES, DEMO_DISCOUNT } from '../contexts/CartContext';
import { useOrders } from '../contexts/OrderContext';
import { productImages } from '../utils/productImages';
import { getSelectedAddress, SavedAddress } from './address-book';
import { getSelectedPayment, PaymentMethod } from './payment-methods';
import { debitWallet, getWallet } from '../utils/walletStore';

function ClockIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7V12L15.5 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { cart, subtotal, clearCart } = useCart();
  const { placeOrders } = useOrders();
  const [loaded, setLoaded] = useState(false);
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [placing, setPlacing] = useState(false);
  const [emiOn, setEmiOn] = useState(false);
  const [emiPlan, setEmiPlan] = useState<0 | 3 | 6>(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [a, p] = await Promise.all([getSelectedAddress(), getSelectedPayment()]);
        if (active) {
          setAddress(a);
          setPayment(p);
          setLoaded(true);
        }
      })().catch(() => {
        if (active) setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const hasFood = cart.some((item) => item.type === 'food_item');
  const delivery = cart.length > 0 ? (hasFood ? DELIVERY_FEES.food_item : DELIVERY_FEES.product) : 0;
  const discount = cart.length > 0 ? DEMO_DISCOUNT : 0;
  const total = subtotal + delivery - discount;

  const emiAvailable = total >= 1000;
  const emiMonthly = (months: number) => Math.ceil((total * (1 + (0.08 * months) / 12)) / months);
  const emiPlanLabel =
    emiPlan === 0 ? 'Pay full' : `${emiPlan} months · ${formatPrice(emiMonthly(emiPlan))}/mo`;
  const emiPaymentSuffix = emiOn ? ` · EMI ${emiPlan === 0 ? 'full' : `${emiPlan}m`}` : '';

  const addressText = address
    ? `${address.type} • ${address.name} — ${address.street}, ${address.city} • ${address.phone}`
    : '';

  const paymentText = payment
    ? payment.id === 'wallet'
      ? `Wallet · ${formatPrice(total)}`
      : `${payment.label} ${payment.detail}`
    : '';

  const handlePlaceOrder = async () => {
    if (placing || cart.length === 0) return;
    if (!address) {
      router.push('/address-book');
      return;
    }
    if (!payment) {
      router.push('/payment-methods');
      return;
    }
    // Wallet payment: verify balance, then debit BEFORE placing the order so
    // money and orders can never diverge.
    if (payment.id === 'wallet') {
      const wallet = await getWallet();
      if (wallet.balance < total) {
        Alert.alert(
          'Insufficient wallet balance',
          `Your wallet has ${formatPrice(wallet.balance)} but this order costs ${formatPrice(total)}. Add money in the Wallet tab or choose another payment method.`
        );
        return;
      }
      const debited = await debitWallet(total, {
        title: 'Order payment',
        detail: `SUSEJ order · ${cart.length} item${cart.length === 1 ? '' : 's'}`,
      });
      if (!debited) {
        Alert.alert('Payment failed', 'The wallet debit could not be completed. Please try again.');
        return;
      }
    }
    setPlacing(true);
    const created = placeOrders(cart, addressText, paymentText + emiPaymentSuffix);
    clearCart();
    router.replace(`/order/${created[0].id}`);
  };

  if (!loaded) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
            Checkout
          </Text>
          <View style={{ width: 16 }} />
        </View>
        <View className="flex-1 items-center justify-center px-8 pb-16">
          <ShopIcon size={56} color={colors.textSecondary} />
          <Text className="text-[18px] font-inter-600 text-textPrimary mt-5 mb-2" style={{ lineHeight: 28 }}>
            Your cart is empty
          </Text>
          <Text className="text-[14px] font-inter-400 text-textSecondary text-center" style={{ lineHeight: 20 }}>
            Add items to your cart before checking out
          </Text>
          <TouchableOpacity
            className="px-8 py-3 rounded-full mt-6"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => router.replace('/(tabs)/feed')}
          >
            <Text className="text-[15px] font-inter-600 text-white">Browse Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header — h52 safe area */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Checkout
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 190, rowGap: 20 }}>
        {/* Delivery address */}
        <TouchableOpacity
          className="mx-5 rounded-[24px] p-4"
          style={{
            backgroundColor: colors.surfaceContainerLowest,
            borderWidth: 1.5,
            borderColor: address ? colors.surfaceContainer : colors.outlineVariant,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 2,
          }}
          onPress={() => router.push('/address-book')}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <MapPinIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
                Delivery Address
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.textSecondary} />
          </View>
          {address ? (
            <>
              <Text className="text-[14px] font-inter-600 text-textPrimary" style={{ lineHeight: 20 }}>
                {address.type} • {address.name}
              </Text>
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                {address.street}
              </Text>
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
                {address.city}
              </Text>
              <Text className="text-[13px] font-inter-500 text-textPrimary mt-1" style={{ lineHeight: 18 }}>
                {address.phone}
              </Text>
            </>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Add a delivery address to continue
            </Text>
          )}
        </TouchableOpacity>

        {/* Payment method */}
        <TouchableOpacity
          className="mx-5 rounded-[24px] p-4"
          style={{
            backgroundColor: colors.surfaceContainerLowest,
            borderWidth: 1.5,
            borderColor: payment ? colors.surfaceContainer : colors.outlineVariant,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 2,
          }}
          onPress={() => router.push('/payment-methods')}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <BagIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
                Payment Method
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.textSecondary} />
          </View>
          {payment ? (
            <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>
              {payment.label} <Text style={{ color: colors.textSecondary }}>{payment.detail}</Text>
            </Text>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Choose how you want to pay
            </Text>
          )}
        </TouchableOpacity>

        {/* Pay in installments */}
        <View
          className="mx-5 rounded-[24px] p-4"
          style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <ClockIcon size={18} color={colors.primaryContainer} />
              <Text className="text-[15px] font-inter-700 text-textPrimary ml-2" style={{ lineHeight: 22 }}>
                Pay in installments
              </Text>
            </View>
            <Switch
              value={emiOn}
              onValueChange={setEmiOn}
              disabled={!emiAvailable}
              trackColor={{ false: colors.secondaryContainer, true: colors.primaryContainer }}
              thumbColor={colors.surfaceContainerLowest}
            />
          </View>
          {!emiAvailable ? (
            <Text className="text-[13px] font-inter-400 text-textSecondary mt-2" style={{ lineHeight: 18 }}>
              EMI available on orders above ₹1,000
            </Text>
          ) : (
            <>
              <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                {([0, 3, 6] as const).map((months) => {
                  const selected = emiPlan === months;
                  return (
                    <TouchableOpacity
                      key={months}
                      className="rounded-full px-3 py-2"
                      style={{ backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setEmiPlan(months)}
                    >
                      <Text
                        className="text-[13px] font-inter-600"
                        style={{ lineHeight: 18, color: selected ? colors.onPrimary : colors.textPrimary }}
                      >
                        {months === 0 ? 'Pay full' : `${months} months · ${formatPrice(emiMonthly(months))}/mo`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {emiPlan > 0 && (
                <Text className="text-[12px] font-inter-400 text-textSecondary mt-2" style={{ lineHeight: 16 }}>
                  Flat 8% p.a. — demo rate
                </Text>
              )}
            </>
          )}
        </View>

        {/* Order summary */}
        <View className="mx-5 rounded-[24px] p-4" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <Text className="text-[15px] font-inter-700 text-textPrimary mb-3" style={{ lineHeight: 22 }}>
            Order Summary
          </Text>
          <View style={{ rowGap: 14 }}>
            {cart.map((item) => (
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
                    Sold by {item.seller} • Qty {item.quantity}
                  </Text>
                </View>
                <Text className="text-[14px] font-inter-600 text-textPrimary" style={{ lineHeight: 20 }}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>

          <View className="h-[1px] my-4" style={{ backgroundColor: colors.surfaceContainerLow }} />

          <View style={{ rowGap: 10 }}>
            <View className="flex-row justify-between">
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Subtotal</Text>
              <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{formatPrice(subtotal)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Delivery Fee</Text>
              <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{formatPrice(delivery)}</Text>
            </View>
            {discount > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>Discount</Text>
                <Text className="text-[14px] font-inter-500" style={{ lineHeight: 20, color: colors.tertiary }}>-{formatPrice(discount)}</Text>
              </View>
            )}
            {emiOn && (
              <View className="flex-row justify-between">
                <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>EMI</Text>
                <Text className="text-[14px] font-inter-500 text-textPrimary" style={{ lineHeight: 20 }}>{emiPlanLabel}</Text>
              </View>
            )}
            <View className="h-[1px]" style={{ backgroundColor: colors.surfaceContainerLow }} />
            <View className="flex-row justify-between">
              <Text className="text-[16px] font-inter-700 text-textPrimary" style={{ lineHeight: 24 }}>Total</Text>
              <Text className="text-[16px] font-inter-700" style={{ lineHeight: 24, color: colors.primary }}>{formatPrice(total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed bottom bar — h55 + safe area */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-3"
        style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 10, paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center">
          <View className="flex-1 mr-4">
            <Text className="text-[12px] font-inter-400 text-textSecondary" style={{ lineHeight: 16 }}>Total</Text>
            <Text className="text-[20px] font-inter-700" style={{ lineHeight: 26, color: colors.primary }}>{formatPrice(total)}</Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center justify-center"
            style={{ height: 55, flex: 1.4, borderRadius: 16, backgroundColor: placing ? colors.disabled : colors.primaryContainer, shadowColor: colors.primaryContainer, shadowOffset: { width: 0, height: 4 }, shadowOpacity: placing ? 0 : 0.2, shadowRadius: 6, elevation: placing ? 0 : 4 }}
            disabled={placing}
            onPress={handlePlaceOrder}
          >
            {placing ? (
              <ActivityIndicator size="small" color={colors.disabledText} />
            ) : (
              <Text className="text-white text-[16px] font-inter-600" style={{ lineHeight: 24 }}>
                Place Order
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
