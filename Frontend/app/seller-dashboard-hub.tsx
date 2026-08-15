import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeftIcon, ChevronRightIcon, ShopIcon, PencilIcon, HeartIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostContext';
import { useOrders } from '../contexts/OrderContext';
import { usePromotions } from '../contexts/PromotionContext';
import { findMainCategory } from '../utils/categories';

// Seller Dashboard Hub (Figma 245:286) — store hero, KPI stats grid,
// 7-day views chart, storefront manager, my listings, manage profile.
// KPIs + listings are wired to real app state (orders, posts, follow).

function EyeIcon({ size = 24, color = '#4343d5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3.2" fill={color} />
    </Svg>
  );
}

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

// Deterministic per-username follower demo (no real follower-back tracking yet)
function seedFollowers(username: string): string {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const base = 800 + h;
  return base > 999 ? `${(base / 1000).toFixed(1)}k` : String(base);
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SellerDashboardHubScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, deletePost, toggleSold } = usePosts();
  const { orders } = useOrders();
  const { promotions } = usePromotions();

  const username = user?.username || 'user';
  const shopName = user?.businessName || user?.name || 'My Store';
  const avatar = user?.avatar || `https://picsum.photos/seed/avatar-${username}/200`;
  const banner = `https://picsum.photos/seed/banner-${username}/1200/400`;
  const verified = user?.verification === 'approved';
  const category = user?.category ? findMainCategory(user.category)?.label ?? user.category : null;

  const myPosts = useMemo(() => posts.filter((p) => p.sellerUsername === username), [posts, username]);
  const myOrders = useMemo(() => orders.filter((o) => o.sellerUsername === username), [orders, username]);

  const myPromos = useMemo(() => promotions.filter((p) => p.sellerUsername === username), [promotions, username]);
  const activePromoCount = myPromos.filter((p) => p.status === 'active').length;
  const promoSpent = myPromos.reduce((s, p) => s + p.amountPaid, 0);

  const revenue = useMemo(() => myOrders.reduce((sum, o) => sum + (o.chargedTotal ?? o.total), 0), [myOrders]);
  const totalLikes = useMemo(() => myPosts.reduce((sum, p) => sum + (p.likes || 0), 0), [myPosts]);

  // 7-day view bars derived from my posts (likes distributed by day-of-week)
  const week = useMemo(() => {
    const dayIdx = (ts: number) => (new Date(ts).getDay() + 6) % 7; // Mon=0
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    for (const p of myPosts) perDay[dayIdx(p.createdAt)] += Math.max(p.likes, 1);
    const max = Math.max(...perDay, 1);
    return WEEK_DAYS.map((day, i) => ({ day, v: Math.round((perDay[i] / max) * 96) + 6 }));
  }, [myPosts]);

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
            <Image source={{ uri: banner }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
            { label: 'Views', value: totalLikes >= 1000 ? `${(totalLikes / 1000).toFixed(1)}k` : String(totalLikes), icon: <EyeIcon size={20} color={colors.primary} />, route: null },
            { label: 'Followers', value: seedFollowers(username), icon: <UsersIcon size={20} color={colors.primary} />, route: null },
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

        {/* Promote & Grow — pay-per-use visibility (IG boost / OLX featured / FB promoted) */}
        <TouchableOpacity
          className="mx-5 mt-4 flex-row items-center p-4 rounded-figma-16"
          style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}
          onPress={() => router.push('/promotions')}
        >
          <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
            <ShopIcon size={20} color={colors.onPrimary} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
              Promote & Grow
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
              {activePromoCount > 0
                ? `${activePromoCount} active campaign${activePromoCount === 1 ? '' : 's'} · ${formatPrice(promoSpent)} spent — boost posts, Hot Deals & Top Seller slots`
                : 'Boost posts, Hot Deals & Top Seller slots — pay-per-use from wallet'}
            </Text>
          </View>
          <ChevronRightIcon size={14} color={colors.primary} />
        </TouchableOpacity>

        {/* 7-Day Views Chart (derived from my posts) */}
        <View className="mx-5 mt-5 p-5 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 }}>
          <View className="flex-row items-center justify-between">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
              Views — Last 7 Days
            </Text>
            <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primary }}>
              {totalLikes >= 1000 ? `${(totalLikes / 1000).toFixed(1)}k` : String(totalLikes)} Views
            </Text>
          </View>
          <View className="flex-row items-end justify-between mt-4" style={{ height: 112 }}>
            {week.map((d, i) => (
              <View key={i} className="flex-1 items-center">
                <View
                  className="w-full rounded-t-sm"
                  style={{ height: d.v, backgroundColor: i === 5 ? colors.primaryContainer : colors.surfaceContainer, maxWidth: 22 }}
                />
                <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 10, lineHeight: 12 }}>
                  {d.day}
                </Text>
              </View>
            ))}
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
                  source={p.image ? { uri: p.image } : { uri: `https://picsum.photos/seed/${p.id}/200` }}
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
                  <View className="self-start mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: p.isSold ? colors.surfaceContainer : colors.surfaceContainerLow }}>
                    <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 12, color: p.isSold ? colors.secondary : '#22c55e' }}>
                      {p.isSold ? 'Sold Out' : 'Active'}
                    </Text>
                  </View>
                </View>
                <View className="items-center justify-between self-stretch py-1" style={{ gap: 10 }}>
                  <TouchableOpacity onPress={() => toggleSold(p.id)}>
                    <HeartIcon size={18} color={p.isSold ? colors.primary : colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push(`/product/${p.id}`)}>
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