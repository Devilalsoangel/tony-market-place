import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackIcon, CloseIcon, ShopIcon, MinusIcon, PlusIcon, ArrowRightIcon, ChevronRightIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart, DELIVERY_FEES, cartLineKey, type CartItem } from '../contexts/CartContext';
import { resolveListingImage } from '../utils/productImages';
import { getRedeemedCoupons, setAppliedPromo, clearAppliedPromo, previewDiscount, type AppliedPromo } from '../utils/redeemedCoupons';
import { serverApi } from '../utils/serverApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const SAVED_KEY_BASE = '@susej_saved_for_later';

type SavedItem = CartItem & { savedAt: number };

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const savedKey = user?.username ? `${SAVED_KEY_BASE}:${user.username}` : SAVED_KEY_BASE;
  const { cart, updateQuantity, removeFromCart, restoreSavedItem, subtotal } = useCart();
  const [promoCode, setPromoCode] = useState('');
const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [savedOpen, setSavedOpen] = useState(true);
  const [offers, setOffers] = useState<Array<{ code: string; label: string }>>([]);

  // Amazon/Flipkart "Available offers": live admin-created coupons surfaced as
  // one-tap chips. Silent on failure — offers are a bonus, never a blocker.
  useEffect(() => {
    if (cart.length === 0) {
      setOffers([]);
      return;
    }
    let alive = true;
    serverApi
      .getCoupons()
      .then((res) => {
        if (!alive) return;
        const list = res.ok && res.data?.coupons ? res.data.coupons : [];
        setOffers(
          list
            .filter((c) => c && c.code)
            .map((c) => ({
              code: String(c.code),
              label:
                c.type === 'percent' || c.type === 'percentage'
                  ? String(c.value) + '% off'
                  : c.type === 'free_delivery'
                    ? 'Free delivery'
                    : formatPrice(Number(c.value)) + ' off',
            }))
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cart.length]);

  useEffect(() => {
    let cancelled = false;
    setSavedLoaded(false);
    AsyncStorage.getItem(savedKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data) as SavedItem[];
            if (Array.isArray(parsed)) setSaved(parsed.filter((s) => s && s.listingId));
            else setSaved([]);
          } catch { if (!cancelled) setSaved([]); }
        } else {
          setSaved([]);
        }
        if (!cancelled) setSavedLoaded(true);
      })
      .catch(() => { if (!cancelled) setSavedLoaded(true); });
    return () => { cancelled = true; };
  }, [savedKey]);

  const persistSaved = (next: SavedItem[]) => {
    if (!savedLoaded) return;
    AsyncStorage.setItem(savedKey, JSON.stringify(next)).catch(() => {});
  };

  const saveForLater = (item: CartItem) => {
    removeFromCart(item.listingId, { variantLabel: item.variantLabel, bundleId: item.bundleId });
    setSaved((prev) => {
      const key = cartLineKey(item);
      const next = [{ ...item, savedAt: Date.now() }, ...prev.filter((s) => cartLineKey(s) !== key)];
      persistSaved(next);
      return next;
    });
  };

  const moveToCart = (item: SavedItem) => {
    // Atomic single-transition restore (quantity preserved, no setTimeout
    // patch race). Rejection means a different seller's cart is active.
    if (!restoreSavedItem(item, item.quantity)) {
      Alert.alert(
        'Different seller',
        'Your cart has items from another seller. Checkout or clear it first to move this item.'
      );
      return;
    }
    setSaved((prev) => {
      const next = prev.filter((s) => cartLineKey(s) !== cartLineKey(item));
      persistSaved(next);
      return next;
    });
  };

  const removeSaved = (item: SavedItem) => {
    setSaved((prev) => {
      const next = prev.filter((s) => cartLineKey(s) !== cartLineKey(item));
      persistSaved(next);
      return next;
    });
  };

  const hasFood = cart.some((item) => item.type === 'food_item');
  const hasOnlyServices = cart.length > 0 && cart.every((item) => item.type === 'service');
  // Bundle carts reject coupons server-side (one price authority per order) —
  // an applied promo is INERT here (totals ignore it, honest note below).
  const hasBundle = cart.some((item) => !!item.bundleId);
  const activePromo = promo && !hasBundle ? promo : null;
  const delivery = cart.length > 0 ? (activePromo?.freeDelivery ? 0 : hasOnlyServices ? 0 : hasFood ? DELIVERY_FEES.food_item : DELIVERY_FEES.product) : 0;
  // Buyer-visible estimate by the SAME server formula checkout uses
  // (percent on subtotal+delivery, capped at base−1) — cart and checkout
  // totals agree, and the server stays truth at placement.
  const discount = previewDiscount(subtotal, delivery, activePromo);
  const total = Math.max(0, subtotal + delivery - discount);

  const applyPromo = async (override?: string) => {
    const code = (override ?? promoCode).trim().toUpperCase();
    if (override) setPromoCode(override.toUpperCase());
    if (!code) return;
    if (promo && promo.code === code) return;
    // Bundle carts reject coupons at placement (one price authority) — refuse
    // the tap with the reason instead of previewing a discount that 400s.
    if (cart.some((i) => !!i.bundleId)) {
      Alert.alert('Coupons need a non-bundle cart', 'Bundle deals already carry their own price — coupons apply to regular items only.');
      return;
    }
    let amount = 0;
    let freeDelivery = false;
    // Live coupons from server (prevents drift where cart discount differs from server charge).
    let liveCoupons: Array<{ code: string; type: string; value: number; expiresAt?: string }> = [];
    try {
      const res = await serverApi.getCoupons();
      if (res.ok && res.data?.coupons) liveCoupons = res.data.coupons;
    } catch {}
    const live = liveCoupons.find((c) => c.code.toUpperCase() === code);
    // The server list is already expiry-filtered, but check explicitly so an
    // expired code says EXPIRED (not "invalid") even on a stale cache.
    if (live?.expiresAt && new Date(live.expiresAt).getTime() < Date.now()) {
      setPromo(null);
      await clearAppliedPromo().catch(() => {});
      Alert.alert('Coupon expired', `Code ${code} has expired. Try a code from Loyalty > My Coupons or a current server coupon.`);
      return;
    }
    if (live) {
      // Percent previews on the SAME base the server charges (subtotal+delivery);
      // unknown future kinds fail closed here (server is truth at placement,
      // but the buyer must never see a preview the server won't honor).
      // 'percentage' is the server alias for 'percent' — both preview.
      const feeForPreview = hasOnlyServices ? 0 : hasFood ? DELIVERY_FEES.food_item : DELIVERY_FEES.product;
      const previewBase = Math.round(subtotal) + Math.round(feeForPreview);
      if (live.type === 'percent' || live.type === 'percentage') amount = Math.round(((subtotal + feeForPreview) * live.value) / 100);
      else if (live.type === 'flat' || live.type === 'fixed') amount = live.value;
      else if (live.type === 'free_delivery') freeDelivery = true;
      // Stored face amount never exceeds what the server will honor (base−1).
      if (!freeDelivery && previewBase > 1) amount = Math.max(0, Math.min(amount, previewBase - 1));
    } else {
      // Loyalty rewards are NOT accepted at checkout yet (the gatekeeper
      // strips them pre-order) — offering them here wastes the apply tap and
      // contradicts the checkout screen. Single coupon truth: server codes
      // only until the server supports loyalty redemption.
      const redeemedList = await getRedeemedCoupons();
      const match = redeemedList.find((c) => c.code.toUpperCase() === code);
      if (match) {
        setPromo(null);
        await clearAppliedPromo().catch(() => {});
        Alert.alert(
          'Not accepted at checkout yet',
          'Loyalty coupons stay in My Coupons — only platform codes apply to this order.'
        );
        return;
      } else {
        // No hardcoded fallback codes: invented codes (WELCOME20/SELLER50/…)
        // always die at the server with 400 and vaporize the order. Unknown
        // here means invalid — the server list is the only truth.
        setPromo(null);
        await clearAppliedPromo().catch(() => {});
        Alert.alert('Invalid promo code', 'Try a code from Loyalty > My Coupons or a server coupon.');
        return;
      }
    }
    if (amount <= 0 && !freeDelivery) {
      Alert.alert('Invalid promo code', 'Try a code from Loyalty > My Coupons or a server coupon.');
      return;
    }
    const applied: AppliedPromo = { code, amount, ...(freeDelivery ? { freeDelivery: true } : {}), ...(live ? { kind: live.type, value: live.value } : {}) };
    setPromo(applied);
    // Checkout reads this so the discount reaches the real charged total.
    setAppliedPromo(applied).catch(() => {});
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header — Figma spec: h52, padH20, SPACE_BETWEEN */}
      <View className="flex-row items-center justify-between h-[52px] px-5 pt-3 pb-3" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-[20px] font-inter-700" style={{ lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
          Cart
        </Text>
          <View style={{ width: 16 }} />
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item) => cartLineKey(item)}
        contentContainerClassName="px-5 pb-[352px]"
        contentContainerStyle={{ rowGap: 24, paddingBottom: insets.bottom + 352 }}
        renderItem={({ item }) => (
          <View
            className="flex-row rounded-[24px] px-3 py-3"
            style={{ width: '100%', height: 120, backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}
          >
            {/* Product Image — Figma: 96×96, cornerRadius 16, bg #f5f2ff */}
            <View className="w-24 h-24 rounded-[16px] items-center justify-center overflow-hidden" style={{ width: 96, height: 96, backgroundColor: colors.surfaceContainerLow }}>
              <Image
                source={resolveListingImage({ image: item.imageUrl }, item.listingId)}
                className="w-full h-full"
                style={{ width: 96, height: 96 }}
              />
            </View>
            {/* Info column */}
            <View className="flex-1 ml-4 justify-between py-1">
              {/* Title row + X button */}
              <View className="flex-row justify-between">
                <View className="flex-1">
                  <Text
                    className="text-[14px] font-inter-600 text-textPrimary"
                    style={{ lineHeight: 16, letterSpacing: 0.14 }}
                    numberOfLines={1}
                  >
                    {item.name}{item.variantLabel ? ` · ${item.variantLabel}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(item.listingId, { variantLabel: item.variantLabel, bundleId: item.bundleId })} className="pb-1.5">
                  <CloseIcon size={12} color={colors.textSecondary} style={{ opacity: 0.4 }} />
                </TouchableOpacity>
              </View>
              {/* Seller name */}
              <Text
                className="text-[14px] font-inter-400 text-textSecondary"
                style={{ lineHeight: 20 }}
                numberOfLines={1}
              >
                Sold by {item.seller}
              </Text>
              {/* Price + Quantity stepper row */}
              <View className="flex-row justify-between items-end">
                <View>
                  <Text
                    className="text-[18px] font-inter-700 text-textPrimary"
                    style={{ lineHeight: 28 }}
                  >
                    {formatPrice(item.price)}
                  </Text>
                  <TouchableOpacity onPress={() => saveForLater(item)} className="mt-0.5 self-start" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Save ${item.name} for later`}>
                    <Text
                      className="text-[12px] font-inter-500"
                      style={{ lineHeight: 16, color: colors.textSecondary }}
                    >
                      Save for later
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Quantity stepper — Figma: pill 9999, bg #dedfe5, pad 4 */}
                <View className="flex-row items-center rounded-full px-1 py-1" style={{ height: 44, backgroundColor: colors.secondaryContainer }}>
                  <TouchableOpacity
                    className="items-center justify-center"
                    style={{ width: 44, height: 44 }}
                    hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease quantity of ${item.name}`}
                    onPress={() => updateQuantity(item.listingId, item.quantity - 1, { variantLabel: item.variantLabel, bundleId: item.bundleId })}
                  >
                    <MinusIcon size={11} color={colors.primary} />
                  </TouchableOpacity>
                  <Text
                    className="text-center text-[14px] font-inter-600 text-textPrimary"
                    style={{ lineHeight: 16, letterSpacing: 0.14, minWidth: 24 }}
                  >
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    className="items-center justify-center"
                    style={{ width: 44, height: 44 }}
                    hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase quantity of ${item.name}`}
                    onPress={() => updateQuantity(item.listingId, item.quantity + 1, { variantLabel: item.variantLabel, bundleId: item.bundleId })}
                  >
                    <PlusIcon size={11} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={
          cart.length > 0 ? (
          <>
        {/* Available offers — REAL server coupons (Amazon/Flipkart pattern); hidden when none */}
        {offers.length > 0 && (
          <View className="mb-3" style={{ rowGap: 8 }}>
            {offers.map((o) => {
              const isApplied = promo?.code === o.code.toUpperCase();
              return (
                <TouchableOpacity
                  key={o.code}
                  className="flex-row items-center px-4 py-2 rounded-[16px]"
                  style={{ backgroundColor: colors.secondaryContainer }}
                  onPress={() => applyPromo(o.code)}
                  accessibilityRole="button"
                  accessibilityLabel={'Apply offer ' + o.code + ' — ' + o.label}
                >
                  <View className="flex-1">
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 17 }}>
                      {o.code} · {o.label}
                    </Text>
                  </View>
                  <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: isApplied ? colors.primary : colors.tertiary }}>
                    {isApplied ? 'Applied' : 'Apply'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
          {/* Promo Code — Figma spec (only meaningful when cart has items) */}
          <View className="pt-4">
            <View className="flex-row items-center h-14 rounded-[16px] overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <TextInput
                className="flex-1 h-full px-4 text-[16px] font-inter-400"
                placeholder="Promo code"
                placeholderTextColor={colors.placeholder}
                style={{ color: colors.placeholder }}
                value={promoCode}
                onChangeText={setPromoCode}
              />
              <TouchableOpacity
                className="rounded-[12px] px-4 py-3 mr-2"
                style={{ height: 40, backgroundColor: promo ? colors.tertiary : colors.secondary, opacity: promoCode.trim() ? 1 : 0.5 }}
                disabled={!promoCode.trim()}
                onPress={() => applyPromo()}
              >
                <Text className="text-white text-[14px] font-inter-600" style={{ lineHeight: 16, letterSpacing: 0.14 }}>
                  {promo ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </>
          ) : null
        }
        ListFooterComponent={
          savedLoaded && saved.length > 0 ? (
            <View className="mt-2">
              {/* Saved for later header — collapsible */}
              <TouchableOpacity
                className="flex-row items-center justify-between mb-4"
                onPress={() => setSavedOpen((o) => !o)}
              >
                <Text className="text-[16px] font-inter-700 text-textPrimary" style={{ lineHeight: 22, letterSpacing: -0.2 }}>
                  Saved for later ({saved.length})
                </Text>
                <ChevronRightIcon
                  size={14}
                  color={colors.secondary}
                  style={{ transform: [{ rotate: savedOpen ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              {savedOpen ? (
                <View style={{ rowGap: 16 }}>
                  {saved.map((item) => (
                    <View
                      key={cartLineKey(item)}
                      className="rounded-[24px] px-3 py-3"
                      style={{ width: '100%', backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}
                    >
                      <View className="flex-row">
                        {/* Saved image */}
                        <View className="w-24 h-24 rounded-[16px] items-center justify-center overflow-hidden" style={{ width: 96, height: 96, backgroundColor: colors.surfaceContainerLow }}>
                          <Image
                            source={resolveListingImage({ image: item.imageUrl }, item.listingId)}
                            className="w-full h-full"
                            style={{ width: 96, height: 96 }}
                          />
                        </View>
                        {/* Saved info */}
                        <View className="flex-1 ml-4 justify-between py-1">
                          <Text
                            className="text-[14px] font-inter-600 text-textPrimary"
                            style={{ lineHeight: 16, letterSpacing: 0.14 }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            className="text-[14px] font-inter-400 text-textSecondary"
                            style={{ lineHeight: 20 }}
                            numberOfLines={1}
                          >
                            Sold by {item.seller}
                          </Text>
                          <Text
                            className="text-[18px] font-inter-700 text-textPrimary"
                            style={{ lineHeight: 28 }}
                          >
                            {formatPrice(item.price)}
                          </Text>
                        </View>
                      </View>
                      {/* Saved actions */}
                      <View
                        className="flex-row items-center mt-3 pt-3"
                        style={{ borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow }}
                      >
                        <TouchableOpacity onPress={() => moveToCart(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right:  8 }} accessibilityRole="button" accessibilityLabel={`Move ${item.name} to cart`}>
                          <Text className="text-[13px] font-inter-600" style={{ lineHeight: 18, color: colors.primaryContainer }}>
                            Move to cart
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeSaved(item)} className="ml-6" hitSlop={{ top: 8, bottom: 8, left: 8, right:  8 }} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}from saved`}>
                          <Text className="text-[13px] font-inter-500" style={{ lineHeight: 18, color: colors.textSecondary }}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <View style={{ opacity: 0.35 }}>
              <ShopIcon size={44} color={colors.textSecondary} />
            </View>
            <Text className="text-[18px] font-inter-600 text-textPrimary mb-2 mt-3" style={{ lineHeight: 28 }}>
              Your cart is empty
            </Text>
            <Text className="text-[14px] font-inter-400 text-textSecondary text-center" style={{ lineHeight: 20 }}>
              Add items to start shopping
            </Text>
            <TouchableOpacity
              className="mt-6 h-12 px-8 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: colors.primaryContainer }}
              accessibilityRole="button"
              accessibilityLabel="Start shopping"
              onPress={() => router.push('/(tabs)/feed')}
            >
              <Text className="text-white text-[14px] font-inter-600" style={{ lineHeight: 18, letterSpacing: 0.14 }}>
                Start shopping
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Fixed Bottom Summary — Figma spec: 390×277, pad 20/24/20/16. Industry: hidden when cart is empty */}
      {cart.length > 0 && (
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-6 pb-4"
        style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.08, shadowRadius: 30, elevation: 10, paddingBottom: insets.bottom + 16 }}
      >
        <View style={{ rowGap: 12 }}>
          {/* Subtotal */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[16px] font-inter-400 text-textSecondary" style={{ lineHeight: 24 }}>Subtotal</Text>
            <Text className="text-[16px] font-inter-400 text-textPrimary" style={{ lineHeight: 24 }}>{formatPrice(subtotal)}</Text>
          </View>
          {/* Delivery Fee */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[16px] font-inter-400 text-textSecondary" style={{ lineHeight: 24 }}>Delivery Fee</Text>
            <Text className="text-[16px] font-inter-400 text-textPrimary" style={{ lineHeight: 24 }}>{formatPrice(delivery)}</Text>
          </View>
          {/* Discount — server-mirror estimate (same formula as checkout); final charge settled server-side */}
          {discount > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[16px] font-inter-400 text-textSecondary" style={{ lineHeight: 24 }}>
                {activePromo ? `Coupon ${activePromo.code}` : 'Discount'}
              </Text>
              <Text className="text-[16px] font-inter-600" style={{ lineHeight: 24, color: colors.success }}>−{formatPrice(discount)}</Text>
            </View>
          )}
          {/* Bundle honesty: an applied coupon stays saved but cannot discount
              a bundle cart (server rejects the combination at placement). */}
          {hasBundle && promo && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[13px] font-inter-400 text-textSecondary" style={{ lineHeight: 18 }}>
                Coupon {promo.code} doesn&apos;t apply to bundle deals
              </Text>
            </View>
          )}
          {/* Divider */}
          <View className="h-[1px]" style={{ backgroundColor: colors.surfaceContainerLow }} />
          {/* Total */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[16px] font-inter-700 text-textPrimary" style={{ lineHeight: 24 }}>Total</Text>
            <Text className="text-[16px] font-inter-700" style={{ lineHeight: 24, color: colors.primary }}>{formatPrice(total)}</Text>
          </View>
        </View>
        {/* Checkout Button — Figma spec: h60, cornerRadius 16, bg #5d5fef */}
        <TouchableOpacity
          className="w-full items-center justify-center flex-row mt-6"
          style={{ height: 60, backgroundColor: colors.primaryContainer, borderRadius: 16, shadowColor: colors.primaryContainer, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
          onPress={() => {
            if (cart.length === 0) return;
            router.push('/checkout');
          }}
        >
          <Text className="text-white text-[16px] font-inter-400 mr-2" style={{ lineHeight: 24 }}>
            Proceed to Checkout
          </Text>
          <ArrowRightIcon size={16} color={colors.surfaceContainerLowest} />
        </TouchableOpacity>
      </View>
      )}
    </View>
  );
}
