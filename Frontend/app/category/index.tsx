import { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, Dimensions, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { HamburgerIcon, SearchIcon, BagIcon } from '../../utils/icons';
import { colors, CATEGORIES } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { categoryImages } from '../../utils/screenImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const TILE_W = (width - 40 - 24) / 3; // Figma 1:2198: 3-col bento, 350 content, ~11.5 gap
const CARD_W = 169;

const TRENDING_BADGES = ['Trending', 'New', 'Hot'];

export default function CategoryHubScreen() {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();

  // Figma 1:2198 "Explore Industries" — all 17 verticals from the product spec
  const industries = useMemo(() => CATEGORIES, []);

  // Trending Now — top posts by likes, Figma shows 3
  const trending = useMemo(
    () => [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 4),
    [posts]
  );

  const slugFor = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

  return (
    <View className="flex-1 bg-surface">
      {/* Header — Figma 1:2198: 52px, hamburger left, susej, bag right */}
      <View
        className="flex-row items-center justify-between px-5 bg-surface"
        style={{ height: 52 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HamburgerIcon size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-primary" style={{ letterSpacing: -0.5 }}>
          susej
        </Text>
        <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BagIcon size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pb-28"
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        {/* Search Header Section — Figma: Heading 2 (350x32) + Input (350x56) */}
        <View className="mt-3">
          <Text className="text-figma-24 font-inter-600 text-textPrimary" style={{ lineHeight: 32 }}>
            Explore Industries
          </Text>
          <View className="flex-row items-center h-14 px-4 rounded-figma-16 bg-surfaceContainerLow mt-2">
            <SearchIcon size={18} color={colors.primary} />
            <TextInput
              className="flex-1 ml-3 font-inter-400 text-textPrimary h-full"
              style={{ fontSize: 16 }}
              placeholder="Search fashion, tech, real estate..."
              placeholderTextColor={colors.secondary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                Keyboard.dismiss();
                if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
              }}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Industries Bento Grid — Figma: 109x120 tiles, label 12/500 left-aligned */}
        <View className="flex-row flex-wrap justify-between mt-4">
          {industries.map((cat, i) => (
            <TouchableOpacity
              key={cat.id}
              className="mb-3"
              style={{ width: TILE_W }}
              activeOpacity={0.8}
              onPress={() => router.push(`/category/${slugFor(cat.label)}`)}
            >
              <View
                className="w-full rounded-figma-16 overflow-hidden"
                style={{ height: TILE_W * 0.9, backgroundColor: colors.surfaceContainer }}
              >
                <Image
                  source={categoryImages[i % categoryImages.length]}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <Text
                className="font-inter-500 mt-1.5"
                style={{ fontSize: 12, lineHeight: 16, color: colors.textPrimary, paddingLeft: 4 }}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trending Now — Figma: title 20/600 + See All 14/600 */}
        <View className="flex-row items-center justify-between mt-2 mb-3">
          <Text className="text-figma-20 font-inter-600 text-textPrimary">Trending Now</Text>
          <TouchableOpacity onPress={() => router.push('/search')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-figma-14 font-inter-600 text-primary">See All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 pb-1"
        >
          {trending.map((post, i) => (
            <TouchableOpacity
              key={post.id}
              className="bg-surfaceContainerLowest rounded-figma-16 overflow-hidden"
              style={{ width: CARD_W, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 }}
              activeOpacity={0.8}
              onPress={() => router.push(`/product/${post.id}`)}
            >
              <View className="w-full" style={{ height: CARD_W }}>
                {post.image ? (
                  <Image source={{ uri: post.image }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Image source={categoryImages[(i + 3) % categoryImages.length]} className="w-full h-full" resizeMode="cover" />
                )}
                <View
                  className="absolute rounded-figma-8 px-3 py-1"
                  style={{ top: 12, left: 12, backgroundColor: colors.inverseSurface }}
                >
                  <Text className="text-figma-12 font-inter-700 text-white">
                    {TRENDING_BADGES[i % TRENDING_BADGES.length]}
                  </Text>
                </View>
              </View>
              <View className="p-3">
                <Text className="text-figma-14 font-inter-600 text-textPrimary" numberOfLines={1}>
                  {post.description.split('#')[0].trim()}
                </Text>
                <Text className="text-figma-14 font-inter-400 text-textSecondary mt-0.5" numberOfLines={1}>
                  {post.category}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      {/* Bottom Nav — Figma: 58px */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-surface/80 flex-row items-center justify-around px-4"
        style={{ height: 58 + insets.bottom, paddingBottom: insets.bottom }}
      >
        {['Feed', 'Explore', 'Create', 'Chat', 'Profile'].map((key) => (
          <TouchableOpacity
            key={key}
            className="items-center justify-center py-1"
            style={{ width: 64 }}
            onPress={() => {
              if (key === 'Feed') router.replace('/(tabs)/feed');
              if (key === 'Explore') router.replace('/(tabs)/explore');
              if (key === 'Create') router.replace('/(tabs)/create');
              if (key === 'Chat') router.replace('/(tabs)/chat');
              if (key === 'Profile') router.replace('/(tabs)/profile');
            }}
          >
            <Text className="text-figma-12 font-inter-400 text-secondary/40">{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
