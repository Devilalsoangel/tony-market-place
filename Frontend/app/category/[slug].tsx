import { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackIcon, SearchIcon, HeartIcon } from '../../utils/icons';
import { colors, CATEGORIES, formatPrice } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { productImages } from '../../utils/productImages';
import { categoryImages } from '../../utils/screenImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

// 17 industries from the design system — matches the app's spec verticals
const allCategories = CATEGORIES.map((c) => c.label);

// Map a slug (e.g. "home-services", "art-crafts") to a category label
const slugToLabel = (s: string): string => {
  const norm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = CATEGORIES.find(
    (c) =>
      c.id.toLowerCase().replace(/[^a-z0-9]/g, '') === norm ||
      c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
  );
  if (match) return match.label;
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Legacy posts may use the old "Home" label — surface them under Home Services
const matchesCategory = (postCategory: string, active: string): boolean => {
  const a = postCategory.toLowerCase();
  const b = active.toLowerCase();
  if (a === b) return true;
  if (a === 'home' && b === 'home services') return true;
  return false;
};

export default function CategoryDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(
    slug ? slugToLabel(slug) : 'Fashion'
  );
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();

  // Filter posts by active category + search term
  const categoryPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter(
      (p) =>
        matchesCategory(p.category, activeCategory) &&
        (!term ||
          p.description.toLowerCase().includes(term) ||
          p.hashtags.some((h) => h.toLowerCase().includes(term)) ||
          p.sellerName.toLowerCase().includes(term) ||
          p.sellerUsername.toLowerCase().includes(term))
    );
  }, [posts, activeCategory, search]);

  const isServiceCategory = activeCategory === 'Services' || activeCategory === 'Home Services';

  return (
    <View className="flex-1 bg-surface">
      {/* Header — Figma: 52px, susej logo */}
      <View className="flex-row items-center justify-between h-[52px] px-5 bg-surface/80" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-primary">susej</Text>
        <View className="w-4" />
      </View>

      <FlatList
        data={categoryPosts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-4"
        contentContainerClassName="px-4 pb-28"
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
        columnWrapperStyle={{ gap: 4 }}
        ListHeaderComponent={
          <View>
            {/* Search */}
            <View className="pt-3 pb-2">
              <View className="flex-row items-center h-12 px-4 rounded-figma-16 bg-surfaceContainerLow">
                <SearchIcon size={18} color={colors.secondary} />
                <TextInput
                  className="flex-1 ml-3 text-figma-14 font-inter-400 text-textPrimary h-full"
                  placeholder="Search categories"
                  placeholderTextColor={colors.secondary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>

            {/* Book a Service affordance for service categories */}
            {isServiceCategory ? (
              <TouchableOpacity
                className="self-start px-4 py-2 rounded-figma-full mb-2"
                style={{ backgroundColor: colors.surfaceContainer }}
                onPress={() => router.push('/book-service')}
              >
                <Text className="text-figma-12 font-inter-600 text-primary">
                  Book a Service
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Category Pills — horizontal scroll */}
            <FlatList
              horizontal
              data={allCategories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3 py-3"
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`px-5 py-2 rounded-figma-full ${item === activeCategory ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'}`}
                  onPress={() => setActiveCategory(item)}
                >
                  <Text className={`text-figma-12 font-inter-500 ${item === activeCategory ? 'text-white' : 'text-secondary'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Trending Now — title */}
            <View className="flex-row items-center justify-between mb-3 mt-1">
              <Text className="text-figma-18 font-inter-700 text-textPrimary">
                {activeCategory}
              </Text>
              <Text className="text-figma-14 font-inter-400 text-textSecondary">
                {categoryPosts.length} items
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-figma-16 font-inter-500 text-textSecondary">
              No items in this category yet
            </Text>
            <Text className="text-figma-12 font-inter-400 text-secondary mt-2">
              Be the first to create a post in {activeCategory}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            className="bg-surfaceContainerLowest rounded-figma-12 overflow-hidden mb-2"
            style={{ width: CARD_W, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View className="w-full aspect-square bg-surfaceContainer">
              {item.image ? (
                <Image source={{ uri: item.image }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              ) : productImages[item.id] ? (
                <Image source={productImages[item.id]} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              ) : (
                <Image source={categoryImages[index % categoryImages.length]} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              )}
            </View>
            <View className="p-2.5">
              <Text className="text-figma-12 font-inter-400 text-secondary mb-0.5">{item.category}</Text>
              <Text className="text-figma-13 font-inter-500 text-textPrimary mb-1" numberOfLines={1}>{item.description.split('#')[0].trim()}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-figma-14 font-inter-700 text-primaryContainer">
                  {formatPrice(item.price)}
                </Text>
                <View className="flex-row items-center gap-1">
                  <HeartIcon size={10} color={colors.secondary} />
                  <Text className="text-figma-10 font-inter-400 text-secondary">{item.likes}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Bottom Nav — Figma: 58px */}
      <View className="absolute bottom-0 left-0 right-0 h-[58px] bg-surface/80 flex-row items-center justify-around px-4" style={{ height: 58 + insets.bottom, paddingBottom: insets.bottom }}>
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
