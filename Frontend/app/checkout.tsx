import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, MapPinIcon, ChevronRightIcon, ShopIcon, BagIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart, DELIVERY_FEES } from '../contexts/CartContext';
import { useOrders } from '../contexts/OrderContext';
import { resolveListingImage } from '../utils/productImages';
import { getAppliedPromo, setAppliedPromo, clearAppliedPromo, type AppliedPromo } from '../utils/redeemedCoupons';
import { getSelectedAddress, SavedAddress } from './address-book';
import { getSelectedPayment, PaymentMethod } from './payment-methods';
import { getWallet, syncWalletFromServer } from '../utils/walletStore';
import { serverApi } from '../utils/serverApi';
import { useAuth } from '../contexts/AuthContext';


export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { cart, subtotal, clearCart, updatePrices } = useCart();
  const { placeOrders } = useOrders();
  const { user } = useAuth();
  const username = user?.username ?? null;
  const [loaded, setLoaded] = useState(false);
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [appliedPromo, setAppliedPromoState] = useState<AppliedPromo | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  // Live wallet figure for the payment row — the saved payment snapshot goes
  // stale the moment money moves anywhere else.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        void syncWalletFromServer().catch(() => {});
        const [a, p, promo] = await Promise.all([getSelectedAddress(username), getSelectedPayment(), getAppliedPromo()]);
        try {
          const w = await getWallet();
          if (active) setWalletBalance(w.balance);
        } catch {}
        if (active) {
          setAddress(a);
          setPayment(p);
          // Gatekeeper: only SERVER-listed coupon codes reach the order —
          // anything else (loyalty-local codes, stale/expired entries) dies
          // at the server with 400 and vaporizes the optimistic order. Clear
          // it here with an honest message instead of ambushing the buyer.
          if (promo) {
            try {
              const res = await serverApi.getCoupons();
              const list: Array<{ code: string }> = (res.data as any)?.coupons ?? [];
              const known = list.some((c) => String(c.code).toUpperCase() === promo.code.toUpperCase());
              if (!known) {
                await clearAppliedPromo().catch(() => {});
                if (active) {
                  setAppliedPromoState(null);
                  setCouponError(
                    promo.code.startsWith('SUSEJ-')
                      ? 'Loyalty coupons are not accepted at checkout yet — they stay in My Coupons.'
                      : `Coupon ${promo.code} is no longer valid — it was removed.`
                  );
                }
              } else if (active) {
                setAppliedPromoState(promo);
              }
            } catch {
              if (active) setAppliedPromoState(promo);
            }
          } else if (active) {
            setAppliedPromoState(promo);
          }
          setLoaded(true);
        }
      })().catch(() => {
        if (active) setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [username])
  );

  const hasFood = cart.some((item) => item.type === 'food_item');
  const delivery = cart.length > 0 ? (hasFood ? DELIVERY_FEES.food_item : DELIVERY_FEES.product) : 0;
  // Totals preview exactly what the SERVER charges at order time (subtotal +
  // delivery). Promo codes are settled server-side on the final bill — no
  // client-side discount is shown or assumed here.
  const total = subtotal + delivery;


  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await serverApi.getCoupons();
      const list: Array<{ code: string; type: string; value: number; expiresAt: string }> = (res.data as any)?.coupons ?? [];
      const found = list.find((c) => c.code.toUpperCase() === code);
      if (!found) {
        setCouponError('Invalid coupon code');
        return;
      }
      if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
        setCouponError('Coupon expired');
        return;
      }
      // Percent codes compute off the CURRENT subtotal (preview only — the
      // server settles the final bill). Zeroing them while showing "applied"
      // lied about the benefit.
      const promo: AppliedPromo = {
        code: found.code,
        amount: found.type === 'flat' ? found.value : Math.max(0, Math.round((subtotal * found.value) / 100)),
        freeDelivery: false,
      };
      await setAppliedPromo(promo);
      setAppliedPromoState(promo);
      setCouponInput('');
      setCouponError(null);
    } catch {
      setCouponError('Could not validate coupon');
    } finally {
      setCouponBusy(false);
    }
  };

  const handleRemoveCoupon = async () => {
    await clearAppliedPromo().catch(() => {});
    setAppliedPromoState(null);
    setCouponError(null);
  };

  const deliveryEta = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const addressText = address
    ? `${address.type} • ${address.name} — ${address.street}, ${address.city} • ${address.phone}`
    : '';

  // NOTE: there is intentionally NO display-string payment variable here.
  // A previous build sent `Wallet · ₹X` as paymentMethod and the server
  // (exact match) skipped the debit while marking paid + crediting the
  // seller. The payment row below renders label+detail directly; the server
  // receives only the canonical payment.id (see handlePlaceOrder).

  const handlePlaceOrder = async () => {
    if (placingRef.current || cart.length === 0) return;
    if (!address) {
      router.push('/address-book');
      return;
    }
    if (!payment) {
      router.push('/payment-methods');
      return;
    }
    // Wallet payment: refresh from the server and verify balance ONLY.
    // The server-side order route handles the actual wallet debit atomically
    // inside a transaction — client-side debitWallet must NOT run here or
    // the buyer gets double-charged.
    if (payment.id === 'wallet') {
      await syncWalletFromServer().catch(() => {});
      const wallet = await getWallet();
      if (wallet.balance < total) {
        Alert.alert(
          'Insufficient wallet balance',
          `Your wallet has ${formatPrice(wallet.balance)} but this order costs ${formatPrice(total)}. Add money in the Wallet tab or choose another payment method.`
        );
        return;
      }
    }
    setPlacing(true);
    placingRef.current = true;
    // Industry-standard: revalidate cart prices against server truth BEFORE
    // charging. The cart freezes prices at add-time; a seller edit since then
    // must surface for re-confirmation, never charge silently.
    try {
      const fresh = await Promise.all(
        cart.map((item) =>
          serverApi.getPost(item.listingId).then((res) => {
            const post = (res.data as { post?: { price?: unknown; isSold?: unknown; status?: unknown } } | null)?.post;
            return {
              id: item.listingId,
              price: res.ok && post ? Number(post.price) : NaN,
              gone: !res.ok || !post || post.isSold === true || (typeof post.status === 'string' && post.status !== 'published' && post.status !== 'active'),
            };
          })
        )
      );
      const gone = fresh.filter((f) => f.gone);
      if (gone.length > 0) {
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'No longer available',
          'An item in your cart was sold or removed by the seller. Remove it to continue.'
        );
        return;
      }
      const truth: Record<string, number> = {};
      for (const f of fresh) {
        if (Number.isFinite(f.price) && f.price >= 0) truth[f.id] = f.price;
      }
      const changed = updatePrices(truth);
      if (changed.length > 0) {
        setPlacing(false);
        placingRef.current = false;
        Alert.alert(
          'Prices updated',
          'The seller changed prices on some items in your cart. Review the new total before placing your order.'
        );
        return;
      }
    } catch {
      // Revalidation is best-effort: offline checkout still places against
      // the cached cart (the server charges ITS price and rejects cheap-buys).
    }
    // Structured address fields let the server serialize a canonical, clean
    // shipping string — the prebuilt display text stays for local display only.
    // Canonical payment id ('wallet' | 'cod') — the server exact-matches it
    // for debit/routing. NEVER send paymentText (display copy with the
    // amount baked in): "Wallet · ₹X" !== "wallet" skipped the debit while
    // the order was still marked paid + seller credited (free-order hole).
    const created = await placeOrders(cart, addressText, payment.id, {
      deliveryFee: delivery,
      promoCode: appliedPromo?.code,
      addressParts: address
        ? { label: address.type, name: address.name, phone: address.phone, street: address.street, city: address.city }
        : undefined,
    });
      if (!created || created.length === 0) {
        // placeOrders always returns the optimistic orders when the cart is
        // non-empty (guarded above), so this is dead in practice — kept as a
        // fail-closed gate. NOTE: server rejects (bad coupon, OOS, funds)
        // arrive ASYNC via the ghost-removal path and land the user on an
        // honest not-found order page; the coupon gate above keeps that rare.
        // Order failed after wallet check: no debit occurred (server owns debit),
        // so do not synthesize a credit. Re-sync to ensure UI truth.
        void syncWalletFromServer().catch(()=>{});
        Alert.alert('Order failed', 'Could not place order. Please try again.');
        setPlacing(false);
        placingRef.current = false;
        return;
      }
    // The promo was NOT applied to this order's total (settled server-side), so
    // a redeemed loyalty coupon is left spendable. Clear only the applied
    // marker so it doesn't leak into the next cart session.
    clearAppliedPromo().catch(() => {});
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
              {payment.label}{' '}
              <Text style={{ color: colors.textSecondary }}>
                {payment.id === 'wallet' && walletBalance !== null
                  ? `Balance ${formatPrice(walletBalance)}`
                  : payment.detail}
              </Text>
            </Text>
          ) : (
            <Text className="text-[14px] font-inter-400 text-textSecondary" style={{ lineHeight: 20 }}>
              Choose how you want to pay
            </Text>
          )}
        </TouchableOpacity>

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
                    source={resolveListingImage({ image: item.imageUrl }, item.listingId)}
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
            {appliedPromo ? (
              <View className="flex-row items-center justify-between px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success + '30' }}>
                <Text className="text-[13px] font-inter-600" style={{ color: colors.success }}>✓ {appliedPromo.code} applied</Text>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-[11px] font-inter-400" style={{ color: colors.textSecondary }}>Settled on final bill</Text>
                  <TouchableOpacity onPress={handleRemoveCoupon} className="px-3 py-1" style={{ borderRadius: 8, backgroundColor: colors.surfaceContainerLowest }}>
                    <Text className="text-[11px] font-inter-600" style={{ color: colors.error }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View className="flex-row" style={{ gap: 8 }}>
                  <View className="flex-1" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: couponError ? colors.error : colors.outlineVariant }}>
                    <TextInput value={couponInput} onChangeText={(t) => { setCouponInput(t.toUpperCase()); if (couponError) setCouponError(null); }} placeholder="Coupon code (e.g. WELCOME20)" placeholderTextColor={colors.placeholder} autoCapitalize="characters" className="px-4 h-11 font-inter-500" style={{ fontSize: 13, color: colors.textPrimary }} editable={!couponBusy} />
                  </View>
                  <TouchableOpacity onPress={handleApplyCoupon} disabled={!couponInput.trim() || couponBusy} className="px-5 h-11 items-center justify-center" style={{ borderRadius: 12, backgroundColor: !couponInput.trim() || couponBusy ? colors.disabled : colors.primaryContainer, opacity: !couponInput.trim() || couponBusy ? 0.5 : 1 }}>
                    <Text className="font-inter-600" style={{ fontSize: 13, color: colors.onPrimary }}>{couponBusy ? '...' : 'Apply'}</Text>
                  </TouchableOpacity>
                </View>
                {couponError ? <Text className="font-inter-400 mt-1" style={{ fontSize: 11, color: colors.error }}>{couponError}</Text> : <Text className="font-inter-400 mt-1" style={{ fontSize: 11, color: colors.textTertiary }}>Codes validated live from the platform.</Text>}
              </View>
            )}
            <View className="px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant }}>
              <Text className="font-inter-600" style={{ fontSize: 12, color: colors.textPrimary }}>Estimated delivery {deliveryEta} · 7-day returns where offered · COD available</Text>
              <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, color: colors.textSecondary }}>Fulfilled from seller’s store location · Tracked shipping · Estimated, not guaranteed.</Text>
            </View>
            <View className="flex-row items-center px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-500" style={{ fontSize: 11, color: colors.textSecondary }}>🔒 128-bit SSL · Secure payment · Protected by susej · Wallet / COD</Text>
            </View>
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
              <Text className="text-white text-[16px] font-inter-600" style={{ lineHeight: 24 }} numberOfLines={1}>
                {address && payment ? `Place Order · ${formatPrice(total)}` : 'Continue to Payment'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
