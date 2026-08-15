import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackIcon, CloseIcon, ShopIcon, MinusIcon, PlusIcon, ArrowRightIcon, ChevronRightIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart, DELIVERY_FEES, DEMO_DISCOUNT, type CartItem } from '../contexts/CartContext';
import { productImages } from '../utils/productImages';
import { cartImages } from '../utils/screenImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SAVED_KEY = '@susej_saved_for_later';

type SavedItem = CartItem & { savedAt: number };

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { cart, updateQuantity, removeFromCart, addToCart, subtotal } = useCart();
  const [promoCode, setPromoCode] = useState('');
const [promo, setPromo] = useState<{ code: string; amount: number } | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [savedOpen, setSavedOpen] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_KEY)
      .then((data) => {
        if (data) {
          try {
            setSaved(JSON.parse(data) as SavedItem[]);
          } catch {
          }
        }
      })
      .catch(() => {})
      .finally(() => setSavedLoaded(true));
  }, []);

  const persistSaved = (next: SavedItem[]) => {
    if (!savedLoaded) return;
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(() => {});
  };

  const saveForLater = (item: CartItem) => {
    removeFromCart(item.listingId);
    setSaved((prev) => {
      const next = [{ ...item, savedAt: Date.now() }, ...prev.filter((s) => s.listingId !== item.listingId)];
      persistSaved(next);
      return next;
    });
  };

  const moveToCart = (item: SavedItem) => {
    addToCart(item);
    if (item.quantity > 1) updateQuantity(item.listingId, item.quantity);
    setSaved((prev) => {
      const next = prev.filter((s) => s.listingId !== item.listingId);
      persistSaved(next);
      return next;
    });
  };

  const removeSaved = (listingId: string) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.listingId !== listingId);
      persistSaved(next);
      return next;
    });
  };

  const hasFood = cart.some((item) => item.type === 'food_item');
  const delivery = cart.length > 0 ? (hasFood ? DELIVERY_FEES.food_item : DELIVERY_FEES.product) : 0;
  const discount = cart.length > 0 ? (promo ? promo.amount : DEMO_DISCOUNT) : 0;
  const total = Math.max(0, subtotal + delivery - discount);

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
        keyExtractor={(item) => item.listingId}
        contentContainerClassName="px-5 pb-[352px]"
        contentContainerStyle={{ rowGap: 24, paddingBottom: insets.bottom + 352 }}
        renderItem={({ item, index }) => (
          <View
            className="flex-row rounded-[24px] px-3 py-3"
            style={{ width: 350, height: 120, backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}
          >
            {/* Product Image — Figma: 96×96, cornerRadius 16, bg #f5f2ff */}
            <View className="w-24 h-24 rounded-[16px] items-center justify-center overflow-hidden" style={{ width: 96, height: 96, backgroundColor: colors.surfaceContainerLow }}>
              <Image
                source={productImages[item.listingId] ?? cartImages[index % 3]}
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
                    {item.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(item.listingId)} className="pb-1.5">
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
                  <TouchableOpacity onPress={() => saveForLater(item)} className="mt-0.5 self-start">
                    <Text
                      className="text-[12px] font-inter-500"
                      style={{ lineHeight: 16, color: colors.textSecondary }}
                    >
                      Save for later
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Quantity stepper — Figma: pill 9999, bg #dedfe5, pad 4 */}
                <View className="flex-row items-center rounded-full px-1 py-1" style={{ height: 40, backgroundColor: colors.secondaryContainer }}>
                  <TouchableOpacity
                    className="items-center justify-center"
                    style={{ width: 32, height: 32 }}
                    onPress={() => updateQuantity(item.listingId, item.quantity - 1)}
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
                    style={{ width: 32, height: 32 }}
                    onPress={() => updateQuantity(item.listingId, item.quantity + 1)}
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
          /* Promo Code — Figma spec (only meaningful when cart has items) */
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
                onPress={() => {
                  const code = promoCode.trim().toUpperCase();
                  if (!code) return;
                  if (promo && promo.code === code) return;
                  let amount = 0;
                  // Coupons mirror susej-admin-panel coupon codes (mockCoupons in admin mock-data).
                  if (code === 'WELCOME20') amount = Math.round(subtotal * 0.2);
                  else if (code === 'SELLER50') amount = 50;
                  else if (code === 'PREMIUM25') amount = Math.round(subtotal * 0.25);
                  else if (code === 'FLASH30') amount = Math.round(subtotal * 0.3);
                  else if (code === 'YEARLY100') amount = 100;
                  else if (code === 'OLD10') amount = Math.round(subtotal * 0.1);
                  if (amount <= 0) {
                    Alert.alert('Invalid promo code', 'Try WELCOME20, SELLER50, PREMIUM25, FLASH30, YEARLY100 or OLD10.');
                    return;
                  }
                  setPromo({ code, amount });
                }}
              >
                <Text className="text-white text-[14px] font-inter-600" style={{ lineHeight: 16, letterSpacing: 0.14 }}>
                  {promo ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
                  {saved.map((item, i) => (
                    <View
                      key={item.listingId}
                      className="rounded-[24px] px-3 py-3"
                      style={{ width: 350, backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}
                    >
                      <View className="flex-row">
                        {/* Saved image */}
                        <View className="w-24 h-24 rounded-[16px] items-center justify-center overflow-hidden" style={{ width: 96, height: 96, backgroundColor: colors.surfaceContainerLow }}>
                          <Image
                            source={productImages[item.listingId] ?? cartImages[i % 3]}
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
                        <TouchableOpacity onPress={() => moveToCart(item)}>
                          <Text className="text-[13px] font-inter-600" style={{ lineHeight: 18, color: colors.primaryContainer }}>
                            Move to cart
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeSaved(item.listingId)} className="ml-6">
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
          {/* Discount */}
          {discount > 0 && (
            <View className="flex-row justify-between items-center">
              <Text className="text-[16px] font-inter-400 text-textSecondary" style={{ lineHeight: 24 }}>
                {promo ? `Discount (${promo.code})` : 'Discount'}
              </Text>
              <Text className="text-[16px] font-inter-400" style={{ lineHeight: 24, color: colors.tertiary }}>-{formatPrice(discount)}</Text>
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
