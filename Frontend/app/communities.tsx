import { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { communityImages } from '../utils/screenImages';
import { router } from 'expo-router';
import { BackIcon, PlusIcon, ArrowRightIcon } from '../utils/icons';
import { CommunityPostCard } from '../components/cards/CommunityPostCard';
import { colors, formatCount } from '../utils/theme';
import { usePosts } from '../contexts/PostContext';
import { useCommunities } from '../contexts/CommunityContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_W = SCREEN_WIDTH - 40; // 350px at 390 width

const discoveryCategories = ['For You', 'Technology', 'Fashion', 'Art', 'Wellness'];

export default function CommunitiesScreen() {
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();
  const { communities, joinedCommunities, join } = useCommunities();
  const [activeCategory, setActiveCategory] = useState('For You');
  const [showAll, setShowAll] = useState(false);
  const discoverCommunities = useMemo(() => {
    const unjoined = communities.filter((c) => !c.joined);
    if (activeCategory === 'For You') return unjoined;
    const needle = activeCategory.toLowerCase();
    return unjoined.filter((c) => (c.category || '').toLowerCase().includes(needle));
  }, [communities, activeCategory]);
  const feedPosts = useMemo(() => {
    const source = showAll ? posts : posts.slice(0, 6);
    return source.map((p) => ({
      id: p.id,
      author: p.sellerName,
      content: p.description,
      likes: p.likes,
      comments: p.comments,
      large: p.likes > 30,
    }));
  }, [posts, showAll]);
  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={feedPosts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-24"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header — 64px, Figma: back + "susej" logo + notification/menu */}
             <View className="flex-row items-center justify-between h-[68px] px-5 bg-surface"
              style={{ height: 68 + insets.top, paddingTop: insets.top, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
            >
              <View className="flex-row items-center" style={{ gap: 16 }}>
                <TouchableOpacity onPress={() => router.back()}>
                  <BackIcon size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text className="text-figma-32 font-inter-700 text-primary" style={{ letterSpacing: -0.8, lineHeight: 40 }}>
                  susej
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 16 }}>
                <TouchableOpacity onPress={() => router.push('/create-community')}>
                  <PlusIcon size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/notifications')}>
                  <View className="w-5 h-5 rounded-full bg-surfaceContainer items-center justify-center">
                    <View className="w-3 h-3 rounded-full bg-secondary" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/settings')}>
                  <View className="flex-col items-center justify-center" style={{ gap: 3 }}>
                    <View className="w-[18px] h-0.5 rounded-full bg-textPrimary" />
                    <View className="w-[18px] h-0.5 rounded-full bg-textPrimary" />
                    <View className="w-[18px] h-0.5 rounded-full bg-textPrimary" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Your Communities — Figma: 486×180 */}
            <View className="mt-6 px-5">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-figma-20 font-inter-700 text-textPrimary">Your Communities</Text>
                <TouchableOpacity
                  className="flex-row items-center"
                  style={{ gap: 4 }}
                  onPress={() => setShowAll((v) => !v)}
                >
                  <Text className="text-figma-16 font-inter-500 text-primary">{showAll ? 'Show less' : 'See all'}</Text>
                  <ArrowRightIcon size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {joinedCommunities.length === 0 ? (
                <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-5">
                  <Text className="text-figma-12 font-inter-400 text-textSecondary">
                    You haven't joined any communities yet. Discover one below to get started.
                  </Text>
                </View>
              ) : showAll ? (
                <View className="bg-white rounded-figma-16 overflow-hidden" style={{ borderWidth: 1, borderColor: colors.surfaceContainer, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}>
                  {joinedCommunities.map((c, i) => (
                    <TouchableOpacity
                      key={c.id}
                      className="flex-row items-center px-4 py-3"
                      style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.surfaceContainer }}
                      onPress={() => router.push(`/community/${c.id}`)}
                    >
                      <View className="w-10 h-10 rounded-full bg-surfaceContainerLow items-center justify-center overflow-hidden">
                        <Image source={communityImages.avatars[i % communityImages.avatars.length]} className="w-10 h-10 rounded-full" />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-figma-14 font-inter-600 text-textPrimary" numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text className="text-figma-12 font-inter-400 text-textSecondary">
                          {formatCount(c.memberCount)} members
                        </Text>
                      </View>
                      <ArrowRightIcon size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4">
                  {joinedCommunities.map((c, i) => (
                    <TouchableOpacity
                      key={c.id}
                      className="items-center"
                      style={{ width: 96 }}
                      onPress={() => router.push(`/community/${c.id}`)}
                    >
                      <View
                        className="w-[96px] h-[96px] rounded-full items-center justify-center"
                        style={{ borderWidth: 2, borderColor: colors.primaryContainer }}
                      >
                        <View className="w-[88px] h-[88px] rounded-full bg-surfaceContainerLow items-center justify-center overflow-hidden">
                          <Image source={communityImages.covers[i % communityImages.covers.length]} className="w-full h-full" />
                        </View>
                      </View>
                      <Text className="text-figma-11 font-inter-400 text-textSecondary text-center mt-2" numberOfLines={2}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Discover Communities — Figma */}
            <View className="mt-8 px-5">
              <Text className="text-figma-20 font-inter-700 text-textPrimary mb-3">Discover Communities</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 mb-4">
                {discoveryCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    className={`px-5 rounded-figma-full items-center justify-center h-10 ${
                      cat === activeCategory ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'
                    }`}
                  >
                    <Text className={`text-figma-12 font-inter-500 ${cat === activeCategory ? 'text-white' : 'text-secondary'}`}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {discoverCommunities.length === 0 ? (
                <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-6 items-center">
                  <Text className="text-figma-12 font-inter-400 text-textSecondary">
                    No communities in this category yet
                  </Text>
                </View>
              ) : null}

              {/* Discover Cards — Figma: 526×252, 16cr, white bg, #efecff border, shadow */}
              {discoverCommunities.map((dc, i) => (
                <TouchableOpacity
                  key={dc.id}
                  className="bg-white rounded-figma-16 mb-4 overflow-hidden"
                  style={{
                    width: CONTENT_W,
                    borderWidth: 1,
                    borderColor: colors.surfaceContainer,
                    shadowColor: colors.textPrimary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.04,
                    shadowRadius: 20,
                    elevation: 3,
                  }}
                  onPress={() => router.push(`/community/${dc.id}`)}
                >
                  {/* Image area — 128h */}
                  <View className="w-full h-32 bg-surfaceContainer overflow-hidden">
                    <Image source={communityImages.banners[i % communityImages.banners.length]} className="w-full h-full" resizeMode="cover" />
                  </View>
                  {/* Card info */}
                  <View className="px-4 pt-3 pb-4">
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-surfaceContainerLow items-center justify-center overflow-hidden">
                        <Image source={communityImages.avatars[i % communityImages.avatars.length]} className="w-8 h-8 rounded-full" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-figma-14 font-inter-600 text-textPrimary">{dc.name}</Text>
                        <Text className="text-figma-12 font-inter-400 text-textSecondary">
                          {formatCount(dc.memberCount)} members
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-2">
                      <View className="px-3 py-1 bg-surfaceContainerLow rounded-figma-full">
                        <Text className="text-figma-11 font-inter-500 text-secondary">{dc.category}</Text>
                      </View>
                      <TouchableOpacity
                        className="px-4 py-1.5 bg-primaryContainer rounded-figma-full"
                        onPress={() => join(dc.id)}
                      >
                        <Text className="text-figma-12 font-inter-600 text-white">Join</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Broadcast Channels — compact card → /broadcasts */}
            <View className="mt-8 px-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-figma-20 font-inter-700 text-textPrimary">Broadcast Channels</Text>
                <TouchableOpacity className="flex-row items-center" style={{ gap: 4 }} onPress={() => router.push('/broadcasts')}>
                  <Text className="text-figma-16 font-inter-500 text-primary">See all</Text>
                  <ArrowRightIcon size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                className="bg-white rounded-figma-16 px-4 py-4"
                style={{
                  borderWidth: 1,
                  borderColor: colors.surfaceContainer,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 3,
                }}
                onPress={() => router.push('/broadcasts')}
              >
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  {['S', 'T', 'H'].map((initial, i) => (
                    <View
                      key={`${initial}-${i}`}
                      className="w-10 h-10 rounded-full bg-primaryContainer items-center justify-center"
                      style={{ marginLeft: i === 0 ? 0 : -14, borderWidth: 2, borderColor: colors.surfaceContainerLowest }}
                    >
                      <Text className="text-figma-13 font-inter-700 text-white">{initial}</Text>
                    </View>
                  ))}
                  <View className="flex-1 ml-1">
                    <Text className="text-figma-13 font-inter-600 text-textPrimary" numberOfLines={1}>
                      Saree Festival Deals, Tech Tuesday Drops & more
                    </Text>
                    <Text className="text-figma-11 font-inter-400 text-textSecondary mt-0.5">
                      Seller & community announcements
                    </Text>
                  </View>
                  <ArrowRightIcon size={14} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Community Feed — Figma */}
            <View className="px-5 mb-4 mt-8">
              <Text className="text-figma-20 font-inter-700 text-textPrimary">Community Feed</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-5 mb-4">
            <CommunityPostCard
              authorName={item.author}
              content={item.content}
              likeCount={item.likes}
              commentCount={item.comments}
              isLarge={item.large}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          </View>
        )}
      />

      {/* FAB — 56×56, #5d5fef (Figama live data) */}
      <TouchableOpacity
        className="absolute bottom-24 right-5 w-14 h-14 bg-primaryContainer rounded-full items-center justify-center"
        style={{
          shadowColor: colors.primaryContainer,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
        onPress={() => router.push('/(tabs)/create')}
      >
        <PlusIcon size={22} color="white" />
      </TouchableOpacity>

      {/* Bottom Nav — 390×43 (Figma live data) */}
      <View className="absolute bottom-0 left-0 right-0 h-[43px] bg-surface border-t"
        style={{ height: 43 + insets.bottom, paddingBottom: insets.bottom, borderTopColor: colors.secondaryContainer, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 6 }}
      >
        <View className="flex-1 flex-row items-center justify-center px-5" style={{ gap: 36 }}>
          {[
            { key: 'Feed', icon: '♡' },
            { key: 'Explore', icon: '⌕', active: true },
            { key: 'Create', icon: '+' },
            { key: 'Chat', icon: '✉' },
            { key: 'Profile', icon: '⊙' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className="items-center justify-center"
              style={{ width: 42 }}
              onPress={() => {
                if (tab.key === 'Feed') router.replace('/(tabs)/feed');
                if (tab.key === 'Explore') router.replace('/(tabs)/explore');
                if (tab.key === 'Create') router.replace('/(tabs)/create');
                if (tab.key === 'Chat') router.replace('/(tabs)/chat');
                if (tab.key === 'Profile') router.replace('/(tabs)/profile');
              }}
            >
              <Text className={`text-figma-16 ${tab.active ? 'text-primary' : 'text-secondary'}`}>{tab.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
