import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { resolveAvatar, resolveListingImage } from '../utils/productImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeftIcon, ChevronRightIcon, ShopIcon, PencilIcon, StarIcon, PlusIcon, BellIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostContext';
import { useOrders } from '../contexts/OrderContext';
import { usePromotions } from '../contexts/PromotionContext';
import { useFollow } from '../contexts/FollowContext';
import { findMainCategory } from '../utils/categories';
import { STORE_THEMES, saveStoreTheme } from '../utils/sellerUnlocks';
import { sellerNetForOrders, getPackages, getChatPinPrice, getChatPinDays, loadMarketplaceConfig, isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';

// Seller Dashboard Hub — store hero, KPI stats, needs-action, quick actions,
// recent orders, performance, growth tools, listings, storefront manager.

function UsersIcon({ size = 24, color = '#4343d5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.4" stroke={color} strokeWidth="1.8" />
      <Path d="M2.5 19.5C3 15.5 5.5 13.5 9 13.5C12.5 13.5 15 15.5 15.5 19.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="16.5" cy="9" r="2.6" stroke={color} strokeWidth="1.8" />
      <Path d="M17.5 13.7C20 14 21.7 15.6 22.1 18.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function WalletIcon({ size = 24, color = '#4343d5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="5.5" width="20" height="14.5" rx="3" stroke={color} strokeWidth="1.8" />
      <Path d="M2 9.5H22" stroke={color} strokeWidth="1.8" />
      <Circle cx="16.5" cy="14.8" r="1.6" fill={color} />
    </Svg>
  );
}

function TrashIcon({ size = 20, color = '#464555' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M9.5 7V5C9.5 4.45 9.95 4 10.5 4H13.5C14.05 4 14.5 4.45 14.5 5V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M6 7L6.8 18.5C6.86 19.35 7.56 20 8.4 20H15.6C16.44 20 17.14 19.35 17.2 18.5L18 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function GearIcon({ size = 20, color = '#464555' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <Path
        d="M12 2.8L13.1 5.1C13.3 5.5 13.7 5.75 14.15 5.8L16.7 6.05C17.6 6.15 18.25 6.9 18.15 7.8L17.9 10.35C17.85 10.8 18 11.25 18.3 11.55L20 13.3C20.65 13.95 20.6 15 19.9 15.6L17.85 17.3C17.5 17.6 17.3 18.05 17.25 18.5L17 20.9C16.95 21.8 16.15 22.45 15.25 22.35L12.7 22.1C12.25 22.05 11.8 22.2 11.5 22.5L9.7 24.2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function SellerDashboardHubScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, deletePost, toggleSold } = usePosts();
  const { orders } = useOrders();
  const { promotions } = usePromotions();
  const { followerCounts } = useFollow();

  // Logged-out fallback is '' (matches nobody): 'user' previously rendered
  // seller "user"'s data to logged-out viewers (cross-account leak, C2).
  const username = user?.username ?? '';
  const shopName = user?.businessName || user?.name || 'My Store';
  const avatar = user?.avatar || resolveAvatar(username ?? 'user').uri;
  // Banner: real uploaded photo from edit-shop when set — no stock placeholder (per-user).
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  useEffect(() => {
    const key = username ? `@susej_shop_profile:${username}` : '@susej_shop_profile';
    let cancelled = false;
    setBannerUri(null);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { photoUri?: unknown };
          if (parsed && typeof parsed.photoUri === 'string' && parsed.photoUri) setBannerUri(parsed.photoUri);
        } catch {
          // corrupted profile cache — keep the token-gradient hero
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username]);
  const verified = user?.verification === 'approved';
  const category = user?.category ? findMainCategory(user.category)?.label ?? user.category : null;

  // Case-insensitive like seller-orders (server keeps exact casing, C3).
  const myPosts = useMemo(() => {
    const me = username.trim().toLowerCase();
    if (!me) return [];
    return posts.filter((p) => (p.sellerUsername ?? '').toLowerCase() === me);
  }, [posts, username]);
  const myOrders = useMemo(() => {
    const me = username.trim().toLowerCase();
    if (!me) return [];
    return orders.filter((o) => (o.sellerUsername ?? '').toLowerCase() === me);
  }, [orders, username]);

  const myPromos = useMemo(() => {
    const me = (username ?? '').trim().toLowerCase();
    if (!me) return [];
    return promotions.filter((p) => (p.sellerUsername ?? '').toLowerCase() === me);
  }, [promotions, username]);
  const activePromoCount = myPromos.filter((p) => p.status === 'active').length;

  // Live promo pricing (admin-editable) — hub cards must never show stale
  // hardcoded prices. Refresh the marketplace config on mount.
  const [promoTick, setPromoTick] = useState(0);
  useEffect(() => {
    let alive = true;
    loadMarketplaceConfig().then(() => {
      if (alive) setPromoTick((t) => t + 1);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const spotlightPrice = useMemo(
    () => getPackages().find((p) => p.kind === 'spotlight')?.price ?? 49,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [promoTick]
  );
  const chatPinPrice = useMemo(() => getChatPinPrice(), [promoTick]);
  const chatPinDays = useMemo(() => getChatPinDays(), [promoTick]);

  // Net revenue after commission — single definition shared with every
  // seller surface (marketplace.sellerNetForOrders): goods-only net exactly
  // like the server credits. Delivery float is never commissioned.
  const revenue = useMemo(() => sellerNetForOrders(myOrders), [myOrders]);


  // Orders waiting on the seller — the actionable number (placed + confirmed + preparing).
  const toFulfill = useMemo(
    () => myOrders.filter((o) => o.status === 'placed' || o.status === 'confirmed' || o.status === 'preparing').length,
    [myOrders]
  );

  const recentOrders = useMemo(
    () => [...myOrders].sort((a, b) => (b.placedAt || 0) - (a.placedAt || 0)).slice(0, 4),
    [myOrders]
  );

  const [selectedTheme, setSelectedTheme] = useState<string>('violet');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(`@susej_store_theme:${username}`);
        if (alive && saved) setSelectedTheme(saved);
      } catch {
        // theme selection is cosmetic — defaults are fine offline
      }
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  const pickTheme = async (themeId: string) => {
    setSelectedTheme(themeId);
    await saveStoreTheme(username, themeId);
  };

  // Real sales analytics (unlocked feature) — computed from real orders/posts only.
  const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const analytics = useMemo(() => {
    const dayIdx = (ts: number) => (new Date(ts).getDay() + 6) % 7;
    const revPerDay = [0, 0, 0, 0, 0, 0, 0];
    for (const o of myOrders) {
      if (o.status !== 'delivered') continue;
      // Net per order (settled legs, not gross) — chart agrees with the Net
      // revenue KPI above. Bucketed by actualDelivery (settlement day), not
      // placedAt: the wallet hold releases Friday+7 for a Friday delivery,
      // and a Monday-placed chart bar could never tie out otherwise.
      const stamp = Date.parse(String((o as { actualDelivery?: unknown }).actualDelivery ?? ""));
      revPerDay[dayIdx(Number.isFinite(stamp) ? stamp : o.placedAt || Date.now())] += sellerNetForOrders([o]);
    }
    const maxRev = Math.max(...revPerDay, 1);
    const top = [...myPosts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    return { revBars: revPerDay.map((v) => Math.round((v / maxRev) * 72) + 4), top };
  }, [myOrders, myPosts]);

  const removeListing = (id: string) => {
    Alert.alert('Delete listing', 'Remove this listing permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deletePost(id),
      },
    ]);
  };

  const formatRevenue = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`);

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="Seller dashboard" user={user} />;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View
        className="flex-row items-center px-5"
        style={{ height: 54 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 17, lineHeight: 22 }}>
            {shopName}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/edit-shop')}>
          <GearIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Store Hero */}
        <View className="mx-5 rounded-figma-24 overflow-hidden" style={{ backgroundColor: colors.inverseSurface, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 4 }}>
          <View style={{ height: 132 }}>
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[colors.primaryContainer, colors.inverseSurface]}
                style={{ width: '100%', height: '100%' }}
              />
            )}
            <LinearGradient
              colors={['rgba(93,95,239,0.45)', 'rgba(47,46,67,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.9 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* Change banner */}
            <TouchableOpacity
              className="absolute top-2.5 right-3 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
              onPress={() => router.push('/storefront-editor')}
            >
              <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                Change banner
              </Text>
            </TouchableOpacity>
          </View>

          <View className="px-4 pb-4" style={{ marginTop: -30 }}>
            <View className="flex-row items-end">
              <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: colors.surfaceContainerLowest, overflow: 'visible' }}>
                <Image source={{ uri: avatar }} style={{ width: 60, height: 60, borderRadius: 30 }} resizeMode="cover" />
              </View>
              <View className="flex-1 ml-3 pb-1">
                <View className="flex-row items-center">
                  <Text className="font-inter-700 text-white" numberOfLines={1} style={{ fontSize: 17, lineHeight: 22 }}>
                    {shopName}
                  </Text>
                </View>
                {verified ? (
                  <View className="self-start mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                    <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 12, color: '#ffffff' }}>
                      Verified Seller
                    </Text>
                  </View>
                ) : (
                  <View className="self-start mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                    <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 12, color: '#ffffff' }}>
                      {category ?? 'Seller'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                className="items-center justify-center"
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)' }}
                onPress={() => router.push('/edit-shop')}
              >
                <PencilIcon size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* KPI Stats — 2x2 grid (real data) */}
        <View className="mx-5 mt-5 flex-row flex-wrap" style={{ gap: 12 }}>
          {[
            { label: 'Revenue', value: formatRevenue(revenue), icon: <WalletIcon size={20} color={colors.primary} />, route: '/wallet' },
            { label: 'Orders', value: String(myOrders.length), icon: <ShopIcon size={20} color={colors.primary} />, route: '/seller-orders' },
            { label: 'To Fulfill', value: String(toFulfill), icon: <BellIcon size={20} color={colors.primary} />, route: '/seller-orders' },
            { label: 'Followers', value: String(followerCounts[username] ?? 0), icon: <UsersIcon size={20} color={colors.primary} />, route: null },
          ].map((s) => (
            <TouchableOpacity
              key={s.label}
              className="rounded-figma-16 p-3.5"
              activeOpacity={s.route ? 0.7 : 1}
              disabled={!s.route}
              style={{ width: '48%', backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }}
              onPress={() => s.route && router.push(s.route as never)}
            >
              <View className="w-10 h-10 rounded-figma-10 items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                {s.icon}
              </View>
              <Text className="font-inter-700 text-textPrimary mt-2.5" style={{ fontSize: 19, lineHeight: 26 }}>
                {s.value}
              </Text>
              <Text className="font-inter-500 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                {s.label}
              </Text>
              {s.route && (
                <Text className="font-inter-500 mt-1" style={{ fontSize: 10, lineHeight: 12, color: colors.primary }}>
                  Manage {s.label.toLowerCase()} →
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Needs action — same actionable definition as the To Fulfill KPI
            above (placed + confirmed + preparing), so the two numbers on one
            screen can never disagree. */}
        {(() => {
          const pending = toFulfill;
          if (pending === 0) return null;
          return (
            <TouchableOpacity
              className="mx-5 mt-4 flex-row items-center px-4 py-3 rounded-figma-16"
              style={{ backgroundColor: colors.surfaceContainer }}
              onPress={() => router.push('/seller-orders')}
            >
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.error }}>
                <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 15, color: '#ffffff' }}>
                  {pending}
                </Text>
              </View>
              <Text className="font-inter-600 text-textPrimary flex-1 ml-3" style={{ fontSize: 13, lineHeight: 18 }}>
                order{pending === 1 ? '' : 's'} need your action — confirm & ship
              </Text>
              <ChevronRightIcon size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })()}

        {/* Quick actions — the four things sellers open daily (Shopify/Meesho pattern) */}
        <View className="mx-5 mt-5 flex-row" style={{ gap: 10 }}>
          {[
            { label: 'Add Product', icon: <PlusIcon size={22} color={colors.primary} />, route: '/(tabs)/create', badge: 0 },
            { label: 'Orders', icon: <ShopIcon size={22} color={colors.primary} />, route: '/seller-orders', badge: toFulfill },
            { label: 'Wallet', icon: <WalletIcon size={22} color={colors.primary} />, route: '/wallet', badge: 0 },
            { label: 'Promote', icon: <StarIcon size={22} color={colors.primary} />, route: '/promotions', badge: activePromoCount },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              className="flex-1 items-center py-4 rounded-figma-16"
              style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }}
              onPress={() => router.push(a.route as never)}
            >
              <View>
                {a.icon}
                {a.badge > 0 && (
                  <View className="absolute items-center justify-center rounded-full" style={{ top: -8, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4, backgroundColor: colors.error }}>
                    <Text className="font-inter-700" style={{ fontSize: 10, lineHeight: 12, color: '#ffffff' }}>
                      {a.badge > 99 ? '99+' : a.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="font-inter-500 text-textPrimary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent orders — latest first with live status (Etsy/Amazon pattern) */}
        <View className="mx-5 mt-6">
          <View className="flex-row items-center mb-3">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              Recent orders
            </Text>
            <View className="flex-1" />
            <TouchableOpacity className="flex-row items-center" onPress={() => router.push('/seller-orders')}>
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primary }}>
                View all
              </Text>
              <ChevronRightIcon size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {recentOrders.length === 0 ? (
            <View className="items-center py-6 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-400" style={{ fontSize: 13, color: colors.textSecondary }}>
                No orders yet — share your store to get the first sale
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recentOrders.map((o) => {
                const amount = o.chargedTotal ?? o.total;
                const chipBg =
                  o.status === 'delivered' ? '#22c55e22'
                  : o.status === 'cancelled' ? `${colors.error}22`
                  : `${colors.primary}22`;
                const chipFg =
                  o.status === 'delivered' ? '#16a34a'
                  : o.status === 'cancelled' ? colors.error
                  : colors.primary;
                return (
                  <TouchableOpacity
                    key={o.id}
                    className="flex-row items-center p-3 rounded-figma-16"
                    style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                    onPress={() => router.push('/seller-orders')}
                  >
                    <View className="flex-1">
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }} numberOfLines={1}>
                        {o.orderNumber || 'Order'}
                      </Text>
                      <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                        {o.items.length} item{o.items.length === 1 ? '' : 's'} · {new Date(o.placedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                        {formatPrice(amount)}
                      </Text>
                      <View className="mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: chipBg }}>
                        <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: chipFg }}>
                          {o.status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Grow Your Shop — paid VISIBILITY only (OLX featured / FB boost model).
            Insights and themes are free tools; listings, orders & chat stay free. */}
        <View className="mx-5 mt-6">
          <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 24, letterSpacing: 0.4 }}>
            GROW YOUR SHOP
          </Text>
          <Text className="font-inter-400 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 16 }}>
            Paid visibility that brings buyers — listings, orders & chat are always free
          </Text>

          {/* Feed Spotlight (OLX Pin-to-Top): #1 slot in buyer feeds for 24h */}
          <TouchableOpacity
            className="flex-row items-center p-4 rounded-figma-16 mb-3"
            style={{ backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: `${colors.primary}22`, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
            onPress={() => router.push('/promotions')}
          >
            <View className="w-10 h-10 rounded-figma-10 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
              <ShopIcon size={20} color={colors.onPrimary} />
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }}>
                  Feed Spotlight
                </Text>
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary }}>
                  <Text className="font-inter-700" style={{ fontSize: 10.5, lineHeight: 13, color: colors.onPrimary }}>
                    {formatPrice(spotlightPrice)}
                  </Text>
                </View>
              </View>
              <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11.5, lineHeight: 15 }}>
                Pin a listing to the very top of buyer feeds for 24 hours
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.primary} />
          </TouchableOpacity>

          {/* Pinned Chat (OLX Elite): top of the buyer's inbox for 7 days */}
          <TouchableOpacity
            className="flex-row items-center p-4 rounded-figma-16 mb-3"
            style={{ backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: `${colors.primary}22`, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
            onPress={() => router.push('/(tabs)/chat' as never)}
          >
            <View className="w-10 h-10 rounded-figma-10 items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <UsersIcon size={20} color={colors.primary} />
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }}>
                  Pinned Chat
                </Text>
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary }}>
                  <Text className="font-inter-700" style={{ fontSize: 10.5, lineHeight: 13, color: colors.onPrimary }}>
                    {formatPrice(chatPinPrice)}
                  </Text>
                </View>
              </View>
              <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11.5, lineHeight: 15 }}>
                {`Stay at the top of a buyer's inbox for ${chatPinDays} days — open any chat and tap the pin`}
              </Text>
            </View>
            <ChevronRightIcon size={14} color={colors.primary} />
          </TouchableOpacity>

          {/* Sales insights — free tool, computed from real orders/posts only */}
          <View className="p-4 rounded-figma-16 mb-3" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-figma-10 items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                <WalletIcon size={20} color={colors.primary} />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }}>
                    Sales insights
                  </Text>
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                    <Text className="font-inter-600" style={{ fontSize: 9.5, lineHeight: 12, color: colors.secondary }}>
                      Free
                    </Text>
                  </View>
                </View>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11.5, lineHeight: 15 }}>
                  Order funnel · delivered revenue trend · top listing
                </Text>
              </View>
            </View>

            <View className="mt-4">
                {myOrders.length === 0 ? (
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    No orders yet — insights appear with your first sale.
                  </Text>
                ) : (
                  <>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {(['placed', 'delivered', 'cancelled'] as const).map((s) => (
                        <View key={s} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
                          <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                            {s.replace('_', ' ')}: <Text className="font-inter-700" style={{ color: colors.textPrimary }}>{myOrders.filter((o) => o.status === s).length}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View className="flex-row items-end justify-between mt-4" style={{ height: 84 }}>
                      {WEEK_DAYS.map((day, i) => (
                        <View key={i} className="flex-1 items-center">
                          <View className="w-full rounded-t-sm" style={{ height: analytics.revBars[i], backgroundColor: i === 6 ? colors.primaryContainer : colors.surfaceContainer, maxWidth: 20 }} />
                          <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 9, lineHeight: 11 }}>{day}</Text>
                        </View>
                      ))}
                    </View>
                    <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 10.5, lineHeight: 14 }}>
                      Delivered revenue by day (last 7 days)
                    </Text>
                    {analytics.top && (
                      <Text className="font-inter-400 text-textSecondary mt-3" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                        Top listing: <Text className="font-inter-600" style={{ color: colors.textPrimary }}>{(analytics.top.description || '').split('\n')[0]}</Text> ({analytics.top.likes || 0} likes)
                      </Text>
                    )}
                  </>
                )}
              </View>
          </View>

          {/* Storefront theme — free personalization */}
          <View className="p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-figma-10 items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                <ShopIcon size={20} color={colors.primary} />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }}>
                    Storefront theme
                  </Text>
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                    <Text className="font-inter-600" style={{ fontSize: 9.5, lineHeight: 12, color: colors.secondary }}>
                      Free
                    </Text>
                  </View>
                </View>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11.5, lineHeight: 15 }}>
                  Accent color preview on this device — buyer-side themes arrive with the next storefront sync
                </Text>
              </View>
            </View>

            <View className="flex-row mt-4" style={{ gap: 12 }}>
                {STORE_THEMES.map((t) => {
                  const active = selectedTheme === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => pickTheme(t.id)}
                      className="items-center"
                    >
                      <View
                        className="items-center justify-center"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: t.accent,
                          borderWidth: active ? 3 : 0,
                          borderColor: colors.textPrimary,
                        }}
                      >
                        {active ? <Text className="font-inter-700" style={{ fontSize: 12, color: '#ffffff' }}>✓</Text> : null}
                      </View>
                      <Text className="font-inter-500 text-textSecondary mt-1.5" style={{ fontSize: 10.5, lineHeight: 13 }}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
          </View>
        </View>

        {/* Storefront Manager */}
        <View className="mx-5 mt-5">
          <Text className="font-inter-700 text-textPrimary mb-3" style={{ fontSize: 16, lineHeight: 24, letterSpacing: 0.4 }}>
            STOREFRONT
          </Text>
          <View className="flex-row" style={{ gap: 10 }}>
            {[
              { label: 'Banner', route: '/storefront-editor' },
              { label: 'Categories', route: '/categories-manager' },
              { label: 'Top Deals', route: '/storefront-editor' },
              { label: 'Auctions', route: '/start-auction' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="flex-1 items-center py-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow }}
                onPress={() => router.push(item.route as any)}
              >
                <ShopIcon size={22} color={colors.textPrimary} />
                <Text className="font-inter-500 text-textPrimary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* My Listings (real posts) */}
        <View className="mx-5 mt-6">
          <View className="flex-row items-center mb-3">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              My Listings
            </Text>
            <View className="ml-2 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
              <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: '#ffffff' }}>
                {myPosts.length}
              </Text>
            </View>
            <View className="flex-1" />
            <TouchableOpacity className="flex-row items-center" onPress={() => router.push('/listings-manager')}>
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primary }}>
                Manage all
              </Text>
              <ChevronRightIcon size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            {myPosts.slice(0, 3).map((p) => (
              <View key={p.id} className="flex-row items-center p-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                <Image
                  source={resolveListingImage(p, p.id)}
                  style={{ width: 68, height: 68, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <View className="flex-1 ml-3">
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 19 }} numberOfLines={1}>
                    {(p.description || '').split('\n')[0]}
                  </Text>
                  <Text className="font-inter-700 text-primary mt-1" style={{ fontSize: 15, lineHeight: 20 }}>
                    {formatPrice(p.price)}
                  </Text>
                  <TouchableOpacity onPress={() => toggleSold(p.id)}>
                    <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: p.isSold ? colors.surfaceContainer : '#22c55e22' }}>
                      <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 12, color: p.isSold ? colors.secondary : '#16a34a' }}>
                        {p.isSold ? 'Sold Out · tap to restock' : 'Active · tap to mark sold'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <View className="items-center justify-center self-stretch py-1" style={{ gap: 14 }}>
                  <TouchableOpacity onPress={() => router.push(`/edit-listing/${p.id}`)} accessibilityRole="button" accessibilityLabel={`Edit ${((p.description || '').split('\n')[0] || 'listing').slice(0, 40)}`}>
                    <PencilIcon size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeListing(p.id)}>
                    <TrashIcon size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {myPosts.length === 0 && (
              <View className="items-center py-8 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
                <Text className="font-inter-400" style={{ fontSize: 13, color: colors.textSecondary }}>
                  No listings yet — create your first post
                </Text>
                <TouchableOpacity
                  className="mt-3 px-5 h-10 rounded-figma-12 items-center justify-center"
                  style={{ backgroundColor: colors.primaryContainer }}
                  onPress={() => router.push('/(tabs)/create')}
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, color: colors.onPrimary }}>
                    Create Post
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Manage Profile */}
        <View className="mx-5 mt-6 mb-4">
          <TouchableOpacity
            className="h-12 rounded-figma-12 items-center justify-center"
            style={{ backgroundColor: colors.surfaceContainer }}
            onPress={() => router.push('/edit-shop')}
          >
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
              Edit Shop Profile
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}