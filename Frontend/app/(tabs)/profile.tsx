import { useState, useMemo, useCallback } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, ScrollView, Share } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerIcon, VerifiedIcon, BellIcon, MoreIcon, PlusIcon, ShopIcon, ChevronRightIcon, CommentIcon } from 
'../../utils/icons';
import { colors, formatCount } from '../../utils/theme';
import { productImages } from '../../utils/productImages';
import { usePosts } from '../../contexts/PostContext';
import { profileImages } from '../../utils/screenImages';
import { useFollow } from '../../contexts/FollowContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadMyStory, type MyStory } from '../../utils/myStory';
import { trayParam as trayParamAll } from '../../utils/storyTray';

  const highlights = ['Style', 'Studio', 'Vibe'];

const FOLLOWERS_COUNT = 1240;

function GridIcon({ size = 18, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Rect x="1" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5" />
      <Rect x="11" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5" />
      <Rect x="1" y="11" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5" />
      <Rect x="11" y="11" width="6" height="6" rx="1" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

function ReelIcon({ size = 20, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 16 / 20} viewBox="0 0 20 16" fill="none">
      <Rect x="1" y="1" width="18" height="14" rx="3" stroke={color} strokeWidth="1.5" />
      <Path d="M8 5l5 3-5 3V5z" fill={color} />
    </Svg>
  );
}

function WalletIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6a2 2 0 012-2h12v2H5v12h16V8a2 2 0 00-2-2h-1V4h1a4 4 0 014 4v8a4 4 0 01-4 4H5a2 2 0 01-2-2V6z" fill={color} />
      <Path d="M15 12a1 1 0 011-1h3v2h-3a1 1 0 01-1-1z" fill={color} />
    </Svg>
  );
}

function GiftIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill={color} />
    </Svg>
  );
}

function StarIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill={color} />
    </Svg>
  );
}

function LogOutIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 17l5-5-5-5v3H3v4h7v3z" fill={color} />
      <Path d="M21 3h-8a2 2 0 00-2 2v2h2V5h8v14h-8v-2h-2v2a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2z" fill={color} />
    </Svg>
  );
}

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [myStory, setMyStory] = useState<MyStory | null>(null);
  const { posts } = usePosts();
  const { followedSellers } = useFollow();
  const { user, logout } = useAuth();
  const myPosts = useMemo(() => posts.filter((p) => p.sellerUsername === (user?.username ?? 'user')), [posts, user?.username]);
  const insets = useSafeAreaInsets();
  const name = user?.name ?? 'Susej Design';

  // Reflect an uploaded story in the highlights row (ring + preview instead of + tile)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMyStory().then((s) => {
        if (active) setMyStory(s);
      });
      return () => {
        active = false;
      };
    }, [])
  );
  const username = user?.username ?? 'susej_official';
  const bio = user?.bio ?? 'Curating the future of digital aesthetics. ✦\nHigh-end commerce & Social discovery.';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header - Top App Bar */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <HamburgerIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text className="font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
            susej
          </Text>
          <VerifiedIcon size={16} />
        </View>
        <View className="flex-row items-center gap-4">
          {user?.isSeller && (
            <TouchableOpacity onPress={() => router.push(`/seller/${user?.username}`)}>
              <ShopIcon size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/wallet')}>
            <WalletIcon size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')}>
            <BellIcon size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <MoreIcon size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activeTab === 0 ? myPosts : []}
        numColumns={3}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-24"
        columnWrapperClassName="gap-0.5"
        ListHeaderComponent={
          <View>
            {/* Profile Header (padding: top16 bottom24 left20 right20, gap16) */}
            <View className="px-5 pt-4 pb-6" style={{ gap: 16 }}>
              {/* Avatar + Stats Row (gap 40, h-24 = 96px) */}
              <View className="flex-row items-center" style={{ gap: 40 }}>
                <View className="w-24 h-24 rounded-full bg-surfaceContainerLow items-center justify-center overflow-hidden" style={{ borderWidth: 2.5, borderColor: colors.primaryContainer }}>
                  {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <Image source={profileImages.avatar} className="w-full h-full" resizeMode="cover" />
                  )}
                </View>
                <View className="flex-1 flex-row justify-center" style={{ gap: 24 }}>
                  <View className="items-center">
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                      {myPosts.length}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                      Posts
                    </Text>
                  </View>
                  <TouchableOpacity className="items-center" onPress={() => router.push('/followers?tab=followers')}>
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                      {formatCount(FOLLOWERS_COUNT)}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                      Followers
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="items-center" onPress={() => router.push('/followers?tab=following')}>
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                      {followedSellers.size}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                      Following
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name, Username, Bio */}
              <View style={{ gap: 2 }}>
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                  {name}
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                  @{username}
                </Text>
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                  {bio}
                </Text>
              </View>

              {/* Action Buttons (Figma: 147 + gap8 + 147 + gap8 + 40 = 350w, h-10 = 40px) */}
              <View className="flex-row pt-2" style={{ gap: 8 }}>
                <TouchableOpacity className="h-10 items-center justify-center rounded-figma-12" style={{ width: 147, backgroundColor: colors.surfaceContainerHigh }} onPress={() => router.push('/edit-profile')}>
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="h-10 items-center justify-center rounded-figma-12" style={{ width: 147, backgroundColor: colors.surfaceContainerHigh }} onPress={() => Share.share({ message: `Check out ${name} on susej — @${username}` })}>
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                    Share Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="w-10 h-10 items-center justify-center rounded-figma-12" style={{ backgroundColor: colors.surfaceContainerHigh }} onPress={() => router.push(user?.isSeller ? '/(tabs)/create' : '/become-seller')}>
                  <PlusIcon size={14} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Stories / Highlights (Figma: 64px circles, border surfaceContainerHigh; add-story + circle first) */}
            <View className="px-5 pb-6">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {myStory ? (
                  <TouchableOpacity
                    className="items-center"
                    style={{ width: 64 }}
                    onPress={() => router.push({ pathname: '/story/me', params: { mine: '1', tray: trayParamAll(), idx: '0' } })}
                  >
                    <View
                      className="w-16 h-16 rounded-full items-center justify-center"
                      style={{ borderWidth: 1.5, borderColor: colors.primaryContainer, backgroundColor: colors.surfaceContainerLow }}
                    >
                      <View className="w-[58px] h-[58px] rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLowest }}>
                        <Image source={{ uri: myStory.image }} className="w-full h-full" resizeMode="cover" />
                      </View>
                    </View>
                    <Text className="font-inter-500 text-textSecondary mt-1 text-center" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                      Your Story
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity className="items-center" style={{ width: 64 }} onPress={() => router.push('/create-story')}>
                    <View className="w-16 h-16 rounded-full items-center justify-center" style={{ borderWidth: 1.5, borderColor: colors.outlineVariant, borderStyle: 'dashed', backgroundColor: colors.surfaceContainerLow }}>
                      <PlusIcon size={20} color={colors.primaryContainer} />
                    </View>
                    <Text className="font-inter-500 text-textSecondary mt-1 text-center" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                      New
                    </Text>
                  </TouchableOpacity>
                )}
                {highlights.map((label, i) => (
                  <TouchableOpacity key={label} className="items-center" style={{ width: 64 }}>
                    <View className="w-16 h-16 rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: colors.surfaceContainerHigh, borderWidth: 1.5, borderColor: colors.outlineVariant }}>
                      <Image source={profileImages.highlights[i % profileImages.highlights.length]} className="w-14 h-14 rounded-full" resizeMode="cover" />
                    </View>
                    <Text className="font-inter-500 text-textSecondary mt-1 text-center" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Nav Tabs (Figma: Posts 18x18, Reels 20x16, Shop 20x20) */}
            <View className="flex-row border-b" style={{ borderBottomColor: colors.surfaceContainer }}>
              {[
                { icon: (c: string) => <GridIcon size={18} color={c} /> },
                { icon: (c: string) => <ReelIcon size={20} color={c} /> },
                { icon: (c: string) => <ShopIcon size={20} color={c} /> },
              ].map((tab, i) => (
                <TouchableOpacity
                  key={i}
                  className="flex-1 items-center py-3"
                  onPress={() => {
                    if (i === 2 && user?.isSeller) {
                      router.push(`/seller/${user?.username}`);
                    } else {
                      setActiveTab(i);
                    }
                  }}
                >
                  <View className="pb-3" style={{ borderBottomWidth: 2, borderBottomColor: activeTab === i ? colors.primaryContainer : 'transparent' }}>
                    {tab.icon(activeTab === i ? colors.primary : colors.textTertiary)}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* My Store (sellers) */}
            {user?.isSeller && (
              <View className="px-5 pb-4">
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5"
                  style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                  onPress={() => router.push('/seller-dashboard-hub')}
                >
                  <ShopIcon size={18} color={colors.onPrimary} />
                  <View className="flex-1 ml-3">
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                      My Store
                    </Text>
                    <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 15, color: colors.onPrimary + 'CC' }}>
                      Dashboard · Listings · Orders
                    </Text>
                  </View>
                  <ChevronRightIcon size={14} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Apply to be a Seller (buyers only — no dashboard access until approved) */}
            {!user?.isSeller && (
              <View className="px-5 pb-4">
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3.5"
                  style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
                  onPress={() => router.push('/become-seller')}
                >
                  <ShopIcon size={18} color={colors.primary} />
                  <View className="flex-1 ml-3">
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                      Apply to be a Seller
                    </Text>
                    <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 15, color: colors.textSecondary }}>
                      Show your storefront · 3-step application
                    </Text>
                  </View>
                  <ChevronRightIcon size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Refer & Earn / Loyalty Points */}
            <View className="flex-row px-5 py-4" style={{ gap: 8 }}>
              <TouchableOpacity
                className="flex-1 flex-row items-center px-3 py-3"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
                onPress={() => router.push('/refer')}
              >
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                  <GiftIcon size={16} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                    Refer & Earn
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Get ₹100 each
                  </Text>
                </View>
                <ChevronRightIcon size={12} color={colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 flex-row items-center px-3 py-3"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
                onPress={() => router.push('/loyalty')}
              >
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                  <StarIcon size={16} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                    Loyalty Points
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Earn & redeem
                  </Text>
                </View>
                <ChevronRightIcon size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Help & Support */}
            <View className="px-5 pb-4">
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
                onPress={() => router.push('/support')}
              >
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                  <CommentIcon size={16} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                    Help & Support
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Raise a ticket · 24h response
                  </Text>
                </View>
                <ChevronRightIcon size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Switch account / logout — the login + demo POV switcher is one tap away */}
            <View className="px-5 pb-6">
              <TouchableOpacity
                className="flex-row items-center px-4 py-3.5"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
                onPress={async () => {
                  await logout();
                  router.replace('/login');
                }}
              >
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                  <LogOutIcon size={16} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                    Switch account
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Log out & sign in as another buyer or seller
                  </Text>
                </View>
                <ChevronRightIcon size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const source = item.image ? { uri: item.image } : productImages[item.id];
          return (
            <TouchableOpacity
              className="flex-1 aspect-square"
              style={{ backgroundColor: colors.surfaceContainer }}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              {source ? <Image source={source} className="w-full h-full" resizeMode="cover" /> : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-400" style={{ fontSize: 14, color: colors.textSecondary }}>No posts yet</Text>
          </View>
        }
      />
    </View>
  );
}
