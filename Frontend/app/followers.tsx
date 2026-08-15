import { useMemo, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, VerifiedIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { storyAvatars, sellerAvatars } from '../utils/productImages';
import { useFollow } from '../contexts/FollowContext';

function WalletPathIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6a2 2 0 012-2h12v2H5v12h16V8a2 2 0 00-2-2h-1V4h1a4 4 0 014 4v8a4 4 0 01-4 4H5a2 2 0 01-2-2V6z" fill={color} />
      <Path d="M15 12a1 1 0 011-1h3v2h-3a1 1 0 01-1-1z" fill={color} />
    </Svg>
  );
}

interface SeedUser {
  username: string;
  name: string;
  avatar: any;
}

const SEED_USERS: SeedUser[] = [
  { username: 'elara_mod', name: 'Elara Moda', avatar: storyAvatars['1'] },
  { username: 'arc_design', name: 'Arc Design Studio', avatar: storyAvatars['2'] },
  { username: 'lux_gems', name: 'Lux Gems', avatar: storyAvatars['3'] },
  { username: 'hype_vault', name: 'Hype Vault', avatar: storyAvatars['4'] },
  { username: 'luxe', name: 'Luxe Thread Studio', avatar: sellerAvatars['post_001'] },
  { username: 'techvault', name: 'TechVault', avatar: sellerAvatars['post_002'] },
  { username: 'urbanjungle', name: 'Urban Jungle', avatar: { uri: 'https://randomuser.me/api/portraits/women/44.jpg' } },
  { username: 'brushstyle', name: 'Brush & Style', avatar: { uri: 'https://randomuser.me/api/portraits/men/32.jpg' } },
  { username: 'freshbasket', name: 'FreshBasket Pune', avatar: { uri: 'https://randomuser.me/api/portraits/women/68.jpg' } },
  { username: 'shopnoir', name: 'Shop Noir', avatar: { uri: 'https://randomuser.me/api/portraits/men/51.jpg' } },
];

const userFor = (username: string): SeedUser =>
  SEED_USERS.find((u) => u.username === username) ?? {
    username,
    name: username,
    avatar: { uri: `https://picsum.photos/seed/${username}/200/200` },
  };

type Tab = 'followers' | 'following';

export default function FollowersScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const { followedList, followedSellers, toggleFollow } = useFollow();

  const followingRows = useMemo(
    () => followedList.map((username) => userFor(username)),
    [followedList]
  );
  const followersRows = useMemo(() => SEED_USERS, []);

  const rows = tab === 'following' ? followingRows : followersRows;

  const renderSegment = (label: string, value: Tab) => {
    const active = tab === value;
    return (
      <TouchableOpacity
        className="flex-1 items-center justify-center py-2"
        style={{ borderRadius: 100, backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
        onPress={() => setTab(value)}
      >
        <Text
          className="font-inter-600"
          style={{ fontSize: 14, lineHeight: 20, color: active ? colors.onPrimary : colors.textSecondary }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          {tab === 'following' ? 'Following' : 'Followers'}
        </Text>
        <WalletPathIcon size={20} color={colors.primary} />
      </View>

      <View className="flex-row px-5 pb-3" style={{ gap: 8 }}>
        {renderSegment('Followers', 'followers')}
        {renderSegment('Following', 'following')}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.username}
        contentContainerClassName="pb-24"
        renderItem={({ item }) => {
          const isFollowing = followedSellers.has(item.username);
          return (
            <TouchableOpacity
              className="flex-row items-center px-5 py-3"
              onPress={() => router.push(`/seller/${item.username}`)}
            >
              <View className="w-12 h-12 rounded-full overflow-hidden mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                <Image source={item.avatar} className="w-full h-full" resizeMode="cover" />
              </View>
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
                    {item.name}
                  </Text>
                  {item.username === 'luxe' || item.username === 'freshbasket' ? <VerifiedIcon size={14} /> : null}
                </View>
                <Text className="font-inter-400 mt-0.5" style={{ fontSize: 13, lineHeight: 16, color: colors.textSecondary }}>
                  @{item.username}
                </Text>
              </View>
              {tab === 'following' ? (
                <TouchableOpacity
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: isFollowing ? colors.surfaceContainer : colors.primaryContainer }}
                  onPress={() => toggleFollow(item.username)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: isFollowing ? colors.textPrimary : colors.onPrimary }}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: isFollowing ? colors.surfaceContainer : colors.primaryContainer }}
                  onPress={() => toggleFollow(item.username)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: isFollowing ? colors.textPrimary : colors.onPrimary }}>
                    {isFollowing ? 'Following' : 'Follow back'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-20 px-8">
            <Text className="font-inter-600 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
              {tab === 'following' ? 'You are not following anyone yet' : 'No followers yet'}
            </Text>
            <Text className="font-inter-400 text-center mt-1" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              {tab === 'following'
                ? 'Follow sellers you like — their products will appear on your feed.'
                : 'Follow sellers back to keep up with their new listings.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
