import { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartIcon, BackIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { useHashtags } from '../../contexts/HashtagContext';
import { productImages } from '../../utils/productImages';
import { hashtagImages } from '../../utils/screenImages';

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
  // from the description (lowercase compare)
  const taggedPosts = useMemo(() => {
    if (!tag) return [];
    const lowerTag = `#${tag.toLowerCase()}`;
    return posts.filter((p) => {
      if (p.hashtags.some((h) => h.toLowerCase() === lowerTag)) return true;
      const descTags = (p.description.match(/#(\w+)/g) ?? []).map((t) => t.toLowerCase());
      return descTags.includes(lowerTag);
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

            {/* Follow + Distance */}
            <View className="flex-row items-center gap-3 mb-5">
              <TouchableOpacity
                className={`px-6 py-2.5 rounded-figma-full ${following ? 'bg-surfaceContainerLow' : 'bg-primaryContainer'}`}
                onPress={() => toggleHashtag(tag ?? '')}
              >
                <Text className={`text-figma-12 font-inter-600 ${following ? 'text-textSecondary' : 'text-white'}`}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Distance: 5km</Text>
            </View>

            {/* Filter Row */}
            <View className="flex-row gap-4 mb-5">
              <View className="flex-row items-center gap-2">
                <Text className="text-figma-12 font-inter-400 text-secondary">Price</Text>
                <Text className="text-figma-12 font-inter-600 text-textPrimary">{formatPrice(0)} - {formatPrice(500)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-figma-12 font-inter-400 text-secondary">Condition</Text>
                <Text className="text-figma-12 font-inter-600 text-textPrimary">Like New</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            className="bg-surfaceContainerLowest rounded-figma-12 overflow-hidden mb-2"
            style={{ width: COL, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View className="w-full aspect-square bg-surfaceContainer">
              {productImages[item.id] ? (
                <Image source={productImages[item.id]} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Image source={hashtagImages.products[index % hashtagImages.products.length]} className="w-full h-full" resizeMode="cover" />
              )}
              {/* Figma 1:2026: "NEW DROP" tag on first card */}
              {index === 0 ? (
                <View className="absolute top-2 left-2 px-2 py-0.5 rounded-figma-4" style={{ backgroundColor: colors.inverseSurface }}>
                  <Text className="text-figma-10 font-inter-400 text-white">NEW DROP</Text>
                </View>
              ) : null}
            </View>
            <View className="px-2.5 pt-2 pb-2.5">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Image source={hashtagImages.avatars[index % hashtagImages.avatars.length]} className="w-4 h-4 rounded-full" />
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

      {/* Bottom Nav — Figma: 56px, #fcf8ff at 0.8, 5 tabs */}
      <View className="absolute bottom-0 left-0 right-0 h-14 bg-surface/80 flex-row items-center justify-around px-2" style={{ height: 56 + insets.bottom, paddingBottom: insets.bottom }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className="items-center justify-center py-1"
            style={{ width: 75, height: 40 }}
            onPress={() => router.replace(tab.route)}
          >
            <Text className={`text-figma-16 mb-0.5 ${tab.active ? 'text-primary' : 'text-secondary/40'}`}>{tab.icon}</Text>
            <Text className={`text-figma-12 ${tab.active ? 'text-primary font-inter-600' : 'text-secondary/40 font-inter-400'}`}>
              {tab.key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
