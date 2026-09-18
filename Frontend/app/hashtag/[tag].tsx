import { useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartIcon, BackIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { useHashtags, extractHashtags } from '../../contexts/HashtagContext';
import { resolveListingImage, hasRealImage } from '../../utils/productImages';
import { AvatarView } from '../../components/AvatarView';

const { width } = Dimensions.get('window');
const COL = (width - 44) / 2;

const tabs = [
  { key: 'Feed', route: '/(tabs)/feed', icon: '♡', active: false },
  { key: 'Explore', route: '/(tabs)/explore', icon: '⌕', active: false },
  { key: 'Create', route: '/(tabs)/create', icon: '+', active: false },
  { key: 'Chat', route: '/(tabs)/chat', icon: '✉', active: false },
  { key: 'Profile', route: '/(tabs)/profile', icon: '⊙', active: false },
];

export default function HashtagDetailScreen() {
  return <HashtagDetailContent />;
}

function HashtagDetailContent() {
  const p = useLocalSearchParams<{ tag: string | string[] }>();
  const tag = Array.isArray(p.tag) ? p.tag[0] : p.tag;
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();
  const { isFollowingHashtag, toggleHashtag } = useHashtags();
  const following = isFollowingHashtag(tag ?? '');

  // Filter posts that contain the hashtag — in the hashtags field OR parsed
  // from the description (Unicode-aware, lowercase compare). Server-q covers
  // hashtags cross-device: pull `#tag` on mount so other devices' posts land
  // in the cache instead of a false "0 Posts".
  const { searchServer } = usePosts() as unknown as { searchServer: (q: string) => Promise<{ rows: unknown[]; ok: boolean }> };
  useEffect(() => {
    if (tag && tag.trim()) {
      searchServer(`#${tag.trim()}`).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);
  const taggedPosts = useMemo(() => {
    if (!tag) return [];
    const lowerTag = `#${tag.toLowerCase()}`;
    return posts.filter((p) => {
      if (p.hashtags.some((h) => h.toLowerCase() === lowerTag)) return true;
      return extractHashtags(p.description).includes(lowerTag);
    });
  }, [posts, tag]);

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between h-[52px] px-4 bg-surface" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-primary">susej</Text>
        <View className="w-5" />
      </View>

      <FlatList
        data={taggedPosts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-4"
        contentContainerClassName="px-4 pb-24"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        columnWrapperStyle={{ gap: 4 }}
        ListHeaderComponent={
          <View className="mb-4">
            {/* Hashtag Title */}
            <Text className="text-figma-24 font-inter-700 text-textPrimary mb-1">#{tag}</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary mb-4">
              {taggedPosts.length} {taggedPosts.length === 1 ? 'Post' : 'Posts'}
            </Text>

            {/* Follow — device-local for now (follows don't roam yet). */}
            <View className="flex-row items-center gap-3 mb-1">
              <TouchableOpacity
                className={`px-6 py-2.5 rounded-figma-full ${following ? 'bg-surfaceContainerLow' : 'bg-primaryContainer'}`}
                onPress={() => toggleHashtag(tag ?? '')}
              >
                <Text className={`text-figma-12 font-inter-600 ${following ? 'text-textSecondary' : 'text-white'}`}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-figma-11 font-inter-400 text-secondary mb-5">
              Follows stay on this device for now.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-surfaceContainerLowest rounded-figma-12 overflow-hidden mb-2"
            style={{ width: COL, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View className="w-full aspect-square bg-surfaceContainer">
              <Image source={resolveListingImage(item, item.id)} className="w-full h-full" resizeMode="cover" />
              {!hasRealImage(item) && (
                <View className="absolute inset-0 items-center justify-center">
                  <Text className="font-inter-700 text-secondary" style={{ fontSize: 26, lineHeight: 32 }}>
                    {(item.title?.trim()?.[0] ?? item.description.trim()[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View className="px-2.5 pt-2 pb-2.5">
              <View className="flex-row items-center gap-1.5 mb-1">
                <AvatarView name={item.sellerUsername} size={16} />
                <Text className="text-figma-10 font-inter-400 text-textSecondary flex-1" numberOfLines={1}>{item.sellerName}</Text>
              </View>
              <Text className="text-figma-12 font-inter-500 text-textPrimary mb-0.5" numberOfLines={1}>{item.description}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-figma-14 font-inter-700 text-primaryContainer">{formatPrice(item.price)}</Text>
                <View className="flex-row items-center gap-1">
                  <HeartIcon size={10} color={colors.secondary} />
                  <Text className="text-figma-10 font-inter-400 text-secondary">{item.likes}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
