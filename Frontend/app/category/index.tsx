import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, Dimensions, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, SearchIcon } from '../../utils/icons';
import { colors, CATEGORIES } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { resolveListingImage } from '../../utils/productImages';
import { serverApi } from '../../utils/serverApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const TILE_W = (width - 40 - 24) / 3; // Figma 1:2198: 3-col bento, 350 content, ~11.5 gap
const CARD_W = 169;

export default function CategoryHubScreen() {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();

  // Figma 1:2198 "Explore Industries" — tiles come from the ADMIN-OWNED
  // catalog in Postgres (/api/app/categories) so a category added in the
  // admin panel lands here. Local CATEGORIES stay only as the offline fallback.
  const [adminCats, setAdminCats] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    serverApi.getCategories().then((res) => {
      if (!alive) return;
      if (res.ok && res.data?.categories?.length) {
        setAdminCats(res.data.categories.map((c: { slug: string; name: string }) => ({ id: c.slug, label: c.name })));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const industries = adminCats.length > 0 ? adminCats : CATEGORIES;

  // Trending Now — top posts by likes, Figma shows 3
  const trending = useMemo(
    () => [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 4),
    [posts]
  );

  // Navigate by the catalog id (the server slug, e.g. "home-living").
  // Deriving slugs from labels ("Home & Living" -> "home-&-living") 404s
  // multiword categories — label-derived slugs are fallback-only.
  const slugFor = (cat: { id?: string; label: string }) =>
    cat.id && cat.id.trim() ? cat.id : cat.label.toLowerCase().replace(/\s+/g, '-');

  return (
    <View className="flex-1 bg-surface">
      {/* Header — Figma 1:2198: 52px, hamburger left, susej, bag right */}
      <View
        className="flex-row items-center justify-between px-5 bg-surface"
        style={{ height: 52 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeftIcon size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-primary" style={{ letterSpacing: -0.5 }}>
          susej
        </Text>
        <View style={{ width: 22 }} />
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
          {industries.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              className="mb-3"
              style={{ width: TILE_W }}
              activeOpacity={0.8}
              onPress={() => router.push(`/category/${slugFor(cat)}`)}
            >
              <View
                className="w-full rounded-figma-16 overflow-hidden"
                style={{ height: TILE_W * 0.9, backgroundColor: colors.surfaceContainer }}
              >
                <Image
                  source={resolveListingImage(null, cat.id)}
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
          {trending.map((post) => (
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
                  <Image source={resolveListingImage(null, post.id)} className="w-full h-full" resizeMode="cover" />
                )}
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
    </View>
  );
}
