import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { BackIcon, VerifiedIcon, HeartIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts, Post } from '../contexts/PostContext';
import { useOrders } from '../contexts/OrderContext';
import { resolveListingImage } from '../utils/productImages';
import { sellerNetForOrders, isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';

function ViewIcon({ size = 14, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function CheckCircleIcon({ size = 14, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="m8.5 12.5 2.5 2.5 4.5-5.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RestockIcon({ size = 14, color = colors.secondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 4v6h-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon({ size = 14, color = colors.error }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SettingsIcon({ size = 20, color = colors.secondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}

function ClockIcon({ size = 16, color = colors.tertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function SellerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, deletePost, toggleSold } = usePosts();
  const { orders } = useOrders();

  // Logged-out fallback is '' (matches nobody): 'user' previously rendered
  // seller "user"'s listings + orders to logged-out viewers (cross-account leak).
  // Case-insensitive like the hub (server keeps exact casing): a mixed-case
  // username must see the same revenue/orders on every seller screen.
  const myPosts = useMemo(() => {
    const me = (user?.username ?? '').trim().toLowerCase();
    if (!me) return [];
    return posts.filter((p) => (p.sellerUsername ?? '').toLowerCase() === me);
  }, [posts, user]);

  const totalListings = myPosts.length;
  const totalLikes = myPosts.reduce((sum, p) => sum + (p.likes ?? 0), 0);
  const soldCount = myPosts.filter((p) => p.isSold).length;

  const confirmDelete = (item: Post) => {
    Alert.alert(
      'Delete listing?',
      `"${item.description.split('\n')[0]}" will be permanently removed from your inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePost(item.id) },
      ]
    );
  };

  const salesOrders = useMemo(() => {
    const me = (user?.username ?? '').trim().toLowerCase();
    if (!me) return [];
    return orders.filter((o) => (o.sellerUsername ?? '').toLowerCase() === me);
  }, [orders, user]);
  const salesCount = salesOrders.length;
  // Industry-standard: sellers see NET (after 8% commission) — the number
  // that matches their wallet. Gross here would contradict the hub + wallet.
  const salesRevenue = sellerNetForOrders(salesOrders);

  // Orders needing the seller's attention first (placed/confirmed), then latest.
  const recentOrders = useMemo(() => {
    const sorted = [...salesOrders].sort((a, b) => b.placedAt - a.placedAt);
    return sorted
      .slice()
      .sort((a, b) => Number(b.status === 'placed' || b.status === 'confirmed') - Number(a.status === 'placed' || a.status === 'confirmed'))
      .slice(0, 4);
  }, [salesOrders]);

  const orderTimeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Real activity: listings created per day over the last 7 days (from post
  // timestamps). No synthetic view multipliers.
  const weekChart = useMemo(() => {
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      values.push(myPosts.filter((p) => p.createdAt >= dayStart && p.createdAt < dayStart + 86400000).length);
    }
    const max = Math.max(...values, 1);
    return { labels, values, max };
  }, [myPosts]);

  const pending = user?.verification === 'pending';
  const rejected = user?.verification === 'rejected';
  const verified = user?.verification === 'approved';

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="Seller dashboard" user={user} />;

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between h-[52px] px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">susej</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <SettingsIcon size={20} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24" contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <Text className="text-figma-20 font-inter-700 text-primaryContainer mt-2 mb-1">Seller Dashboard</Text>
        <Text className="text-figma-14 font-inter-400 text-textSecondary mb-6">
          {user?.businessName ? `Manage ${user.businessName} listings and metrics` : 'Manage your listings and metrics'}
        </Text>

        {pending && (
          <View className="bg-primaryContainer rounded-figma-24 p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <ClockIcon size={16} color={colors.onPrimary} />
              <Text className="text-figma-14 font-inter-600 text-white flex-1">Verification under review</Text>
              <View className="px-3 py-1 bg-white/20 rounded-figma-full">
                <Text className="text-figma-10 font-inter-600 text-white">PENDING</Text>
              </View>
            </View>
            <Text className="text-figma-12 font-inter-400 text-white/80">
              Listing, reels and live unlock the moment you are approved.
            </Text>
          </View>
        )}

        {rejected && (
          <View className="bg-errorContainer rounded-figma-24 p-4 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-figma-14 font-inter-600 text-error flex-1">Verification not approved</Text>
              <View className="px-3 py-1 bg-error/10 rounded-figma-full">
                <Text className="text-figma-10 font-inter-600 text-error">REJECTED</Text>
              </View>
            </View>
            <Text className="text-figma-12 font-inter-400 text-error mb-3">
              Some documents couldn't be verified. Re-submit your details to try again.
            </Text>
            <TouchableOpacity
              className="self-start px-4 py-2 bg-error rounded-figma-full"
              onPress={() => router.push('/become-seller')}
            >
              <Text className="text-figma-12 font-inter-600 text-white">Re-submit</Text>
            </TouchableOpacity>
          </View>
        )}

        {verified && (
          <View className="bg-primaryContainer rounded-figma-24 p-4 mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <VerifiedIcon size={18} />
                <Text className="text-figma-14 font-inter-600 text-white">Verified Seller</Text>
              </View>
              <TouchableOpacity
                className="px-4 py-1.5 bg-white/20 rounded-figma-full"
                onPress={() => router.push('/storefront-editor')}
              >
                <Text className="text-figma-12 font-inter-600 text-white">Manage</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-figma-12 font-inter-400 text-white/80">Account fully authenticated</Text>
          </View>
        )}

        {!verified && !pending && !rejected && (
          <View className="bg-surfaceContainerLow rounded-figma-24 p-4 mb-6">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-surfaceContainer items-center justify-center">
                <VerifiedIcon size={16} />
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary">Verified badge</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary">Complete verification to unlock</Text>
              </View>
              <TouchableOpacity
                className="px-4 py-1.5 border border-outlineVariant rounded-figma-full"
                onPress={() => router.push('/become-seller')}
              >
                <Text className="text-figma-12 font-inter-600 text-primaryContainer">Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3">Analytics</Text>
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Total Listings</Text>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{totalListings}</Text>
          </View>
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Sold</Text>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{soldCount}</Text>
            <Text className="text-figma-10 font-inter-500 text-textTertiary mt-0.5">
              {soldCount === 0 ? 'Mark items as sold' : 'of your listings'}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Revenue (net)</Text>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{formatPrice(salesRevenue)}</Text>
            <Text className="text-figma-10 font-inter-500 text-textTertiary mt-0.5">
              {salesCount === 0 ? 'No orders yet' : 'delivered · after 8% fee'}
            </Text>
          </View>
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <View className="flex-row items-center gap-1 mb-1">
              <HeartIcon size={12} color={colors.primaryContainer} />
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Likes</Text>
            </View>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{totalLikes}</Text>
            <Text className="text-figma-10 font-inter-500 text-textTertiary mt-0.5">
              {totalLikes === 0 ? 'No engagement yet' : 'on your posts'}
            </Text>
          </View>
        </View>

        <View className="bg-surfaceContainerLow rounded-figma-16 p-4 mb-6">
          <Text className="text-figma-14 font-inter-600 text-textPrimary mb-1">New Listings — Last 7 Days</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary mb-4">
            {totalListings === 0 ? 'Post more to grow your audience' : `${totalListings} live listings · ${totalLikes} likes`}
          </Text>
          {totalListings === 0 ? (
            <View className="items-center py-6">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">No views yet — share your listings to get seen</Text>
            </View>
          ) : (
            <View className="flex-row items-end gap-2" style={{ height: 96 }}>
              {weekChart.values.map((v, i) => (
                <View key={i} className="flex-1 items-center justify-end" style={{ height: 96 }}>
                  <View
                    className="w-full bg-primaryContainer rounded-t-[8px]"
                    style={{
                      height: Math.max(6, Math.round((v / weekChart.max) * 80)),
                      opacity: 0.45 + 0.55 * (v / weekChart.max),
                    }}
                  />
                  <Text className="text-figma-10 font-inter-500 text-textTertiary mt-1">
                    {weekChart.labels[i]}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3">My Listings</Text>
        {myPosts.length === 0 ? (
          <View className="bg-surfaceContainerLow rounded-figma-24 p-6 mb-3 items-center">
            <Text className="text-figma-14 font-inter-500 text-textSecondary text-center mb-4">
              No listings yet — create your first post.
            </Text>
            <TouchableOpacity
              className="px-5 py-2.5 bg-primaryContainer rounded-figma-full"
              onPress={() => router.push('/(tabs)/create')}
            >
              <Text className="text-figma-12 font-inter-600 text-white">+ New Listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myPosts.map((item) => {
            const thumb = resolveListingImage(item, item.id);
            return (
              <View
                key={item.id}
                className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              >
                <TouchableOpacity
                  className="flex-row items-center"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <View className="w-16 h-16 rounded-figma-12 bg-surfaceContainer mr-3 overflow-hidden">
                    {thumb ? (
                      <Image
                        source={thumb}
                        className="w-16 h-16"
                        resizeMode="cover"
                        style={item.isSold ? { opacity: 0.5 } : undefined}
                      />
                    ) : null}
                    {item.isSold && (
                      <View
                        className="absolute left-0 right-0 items-center"
                        style={{ transform: [{ rotate: '-12deg' }], top: 26 }}
                      >
                        <View className="bg-inverseSurface px-1 py-0.5">
                          <Text className="text-figma-10 font-inter-700 text-inverseOnSurface tracking-wider">SOLD</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-figma-14 font-inter-600 text-textPrimary" numberOfLines={1}>
                      {item.description.split('\n')[0]}
                    </Text>
                    <Text
                      className="text-figma-14 font-inter-700 mt-1"
                      style={
                        item.isSold
                          ? { textDecorationLine: 'line-through', color: colors.textTertiary }
                          : { color: colors.primaryContainer }
                      }
                    >
                      {formatPrice(item.price)}
                    </Text>
                    <Text className="text-figma-10 font-inter-500 text-textTertiary mt-0.5">
                      {item.isSold ? 'Sold' : 'Active'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View
                  className="flex-row items-center justify-between mt-3 pt-3"
                  style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant }}
                >
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 px-2 py-1.5"
                    onPress={() => router.push(`/product/${item.id}`)}
                  >
                    <ViewIcon size={14} color={colors.primaryContainer} />
                    <Text className="text-figma-10 font-inter-600 text-primaryContainer">View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 px-2 py-1.5"
                    onPress={() => { void toggleSold(item.id).then((ok) => { if (!ok) Alert.alert('Not saved', 'Check your connection — the listing was restored.'); }); }}
                  >
                    {item.isSold ? (
                      <RestockIcon size={14} color={colors.tertiary} />
                    ) : (
                      <CheckCircleIcon size={14} color={colors.primaryContainer} />
                    )}
                    <Text
                      className="text-figma-10 font-inter-600"
                      style={{ color: item.isSold ? colors.tertiary : colors.primaryContainer }}
                    >
                      {item.isSold ? 'Restock' : 'Mark Sold'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 px-2 py-1.5"
                    onPress={() => confirmDelete(item)}
                  >
                    <TrashIcon size={14} color={colors.error} />
                    <Text className="text-figma-10 font-inter-600 text-error">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3 mt-2">Recent Orders</Text>
        {recentOrders.length === 0 ? (
          <View className="bg-surfaceContainerLowest rounded-figma-16 p-4 mb-2">
            <Text className="text-figma-13 font-inter-400 text-textSecondary">
              No orders yet — new orders will show up here as soon as buyers check out.
            </Text>
          </View>
        ) : (
          recentOrders.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="flex-row items-center bg-surfaceContainerLowest rounded-figma-16 p-4 mb-2"
              onPress={() => router.push('/seller-orders')}
            >
              <View className="w-10 h-10 rounded-full bg-surfaceContainerLow items-center justify-center mr-3">
                <Text className="text-figma-12 font-inter-600 text-textPrimary">{item.orderNumber.replace('#SJ-', '').slice(0, 3)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary">{item.items[0]?.name ?? 'Order'}</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary">
                  {item.orderNumber} · {orderTimeAgo(item.placedAt)}
                </Text>
              </View>
              <Text
                className="text-figma-10 font-inter-600 px-2 py-1 rounded-figma-full"
                style={{
                  color: item.status === 'delivered' ? colors.tertiary : item.status === 'cancelled' ? colors.error : colors.primaryContainer,
                  backgroundColor: item.status === 'delivered' ? colors.surfaceContainer : colors.surfaceContainerLow,
                }}
              >
                {item.status === 'placed' || item.status === 'confirmed' ? 'ACTION NEEDED' : item.status.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View className="absolute bottom-24 right-6" style={{ paddingBottom: insets.bottom + 32 }}>
        <TouchableOpacity
          className="w-14 h-14 bg-primaryContainer rounded-figma-full items-center justify-center"
          style={{ shadowColor: colors.primaryContainer, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
          onPress={() => router.push('/(tabs)/create')}
        >
          <Text className="text-2xl text-white">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
