import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Keyboard, Modal, ScrollView, Switch } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchIcon, CloseIcon, BellIcon, BagIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { usePosts } from '../../contexts/PostContext';
import { useCart } from '../../contexts/CartContext';
import { usePromotions } from '../../contexts/PromotionContext';
import { hasRealImage, resolveListingImage } from '../../utils/productImages';
import { matchesCategory } from '../category/[slug]';
import { serverApi } from '../../utils/serverApi';

function PlayIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5v14l11-7z" fill={color} />
    </Svg>
  );
}

function LiveIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" fill={color} />
      <Path d="M7.5 7.5a6.36 6.36 0 010 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M16.5 7.5a6.36 6.36 0 010 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function AuctionTimerIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="14" r="8" stroke={color} strokeWidth="2.2" />
      <Path d="M12 9.5V14l3 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 2h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function BundleGiftIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.27 2 9.5 2 7.57 2 6 3.57 6 5.5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9.5 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM20 19H4V8h16v11zm-9-7H6v-2h5v2zm7 0h-5v-2h5v2z" fill={color} />
    </Svg>
  );
}

function CommunityIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill={color} />
    </Svg>
  );
}

function BroadcastIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill={color} />
    </Svg>
  );
}

function FilterIcon({ size = 14, color = colors.secondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M8 12h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M11 18h2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function MapOutlineIcon({ size = 18, color = '#5d5fef' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M9 4v14M15 6v14" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

interface PricePreset {
  key: string;
  label: string;
  min?: number;
  max?: number;
}

const PRICE_PRESETS: PricePreset[] = [
  { key: 'any', label: 'Any' },
  { key: 'u500', label: 'Under ₹500', max: 500 },
  { key: '500_2000', label: '₹500 – ₹2,000', min: 500, max: 2000 },
  { key: '2000_10000', label: '₹2,000 – ₹10,000', min: 2000, max: 10000 },
  { key: '10000_plus', label: '₹10,000+', min: 10000 },
];

const CONDITIONS = ['Any', 'New', 'Like New', 'Used', 'Refurbished'];

// Posts have no condition field — derive it from description keywords (case-insensitive).
// Unknown when undescribed: defaulting to 'New' mislabeled used goods in the
// condition filter. Unknown posts are skipped by any specific condition filter.
// Word-boundary matching: naive `includes('new')` mislabeled "renewed"/"like brand new-ish".
const deriveCondition = (description: string): string => {
  const d = (description ?? '').toLowerCase();
  if (/\blike new\b/.test(d) || /\bmint\b/.test(d)) return 'Like New';
  if (/\brefurbished\b/.test(d) || /\brefurb\b/.test(d)) return 'Refurbished';
  if (/\bnew\b/.test(d)) return 'New';
  if (/\bused\b/.test(d) || /\bpre-owned\b/.test(d) || /\bpre owned\b/.test(d) || /\bsecond hand\b/.test(d)) return 'Used';
  return 'Unknown';
};

const SORT_OPTIONS = [
  { key: 'popular', label: 'Popular' },
  { key: 'newest', label: 'Newest' },
  { key: 'priceAsc', label: 'Price ↑' },
  { key: 'priceDesc', label: 'Price ↓' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

interface ExploreFilters {
  price: string;
  condition: string;
  verifiedOnly: boolean;
  sort: SortKey;
}

const DEFAULT_FILTERS: ExploreFilters = { price: 'any', condition: 'any', verifiedOnly: false, sort: 'popular' };

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { cartCount } = useCart();
  const { posts, hiddenPostIds = [], mutedSellers = [] } = usePosts() as { posts: import('../../contexts/PostContext').Post[]; hiddenPostIds?: string[]; mutedSellers?: string[] };
  const [serverPromos, setServerPromos] = useState<any[]>([]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    serverApi.getPromotions().then((res) => {
      if (!alive) return;
      setServerPromos(res.ok && res.data?.promotions ? res.data.promotions : []);
    }).catch(()=>{});
    return () => { alive = false; };
  }, []));
  const activePromos = useMemo(() => serverPromos.filter((p) => p.status === 'active'), [serverPromos]);

  // Admin-owned category catalog (DB). Chips render what admins configured;
  // 'All' is the only app-local chip. Offline -> All-only (honest).
  const [adminCategories, setAdminCategories] = useState<Array<{ name: string; slug: string }>>([]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      serverApi.getCategories().then((res) => {
        if (!active) return;
        const cats = res.ok && res.data?.categories?.length ? res.data.categories : [];
        setAdminCategories(cats.map((c) => ({ name: c.name, slug: c.slug })));
      });
      return () => {
        active = false;
      };
    }, [])
  );
  const categories = useMemo(() => ['All', ...adminCategories.map((c) => c.name)], [adminCategories]);

  const pricePreset = PRICE_PRESETS.find((p) => p.key === filters.price) ?? PRICE_PRESETS[0];
  const hasActiveFilters =
    filters.price !== 'any' || filters.condition !== 'any' || filters.verifiedOnly || filters.sort !== 'popular';

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clearKey: keyof ExploreFilters }[] = [];
    if (filters.price !== 'any') chips.push({ key: 'price', label: pricePreset.label, clearKey: 'price' });
    if (filters.condition !== 'any') chips.push({ key: 'condition', label: filters.condition, clearKey: 'condition' });
    if (filters.verifiedOnly) chips.push({ key: 'verified', label: 'Verified', clearKey: 'verifiedOnly' });
    if (filters.sort !== 'popular') {
      const sortLabel = SORT_OPTIONS.find((s) => s.key === filters.sort)?.label ?? 'Sort';
      chips.push({ key: 'sort', label: sortLabel, clearKey: 'sort' });
    }
    return chips;
  }, [filters, pricePreset.label]);

  const clearFilter = (key: keyof ExploreFilters) => {
    setFilters((prev) => {
      if (key === 'price') return { ...prev, price: 'any' };
      if (key === 'condition') return { ...prev, condition: 'any' };
      if (key === 'verifiedOnly') return { ...prev, verifiedOnly: false };
      return { ...prev, sort: 'popular' };
    });
  };

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  const filteredPosts = useMemo(() => {
    let out = posts.filter((p) => !hiddenPostIds?.includes(p.id) && !mutedSellers?.includes(p.sellerUsername) && hasRealImage(p));
    if (selectedCategory !== 'All') out = out.filter((p) => matchesCategory(p.category, selectedCategory));
    const { min, max } = pricePreset;
    if (min != null) out = out.filter((p) => p.price >= min);
    if (max != null) out = out.filter((p) => p.price <= max);
    if (filters.condition !== 'any') {
      // Structured condition wins when the seller set one (create wizard stores it);
      // text-parsing stays only as a legacy fallback for old posts.
      out = out.filter((p) => (p.condition ?? deriveCondition(p.description)) === filters.condition);
    }
    if (filters.verifiedOnly) out = out.filter((p) => p.verified);
    // Popular is real: engagement first, recency breaks ties (was a no-op label).
    if (filters.sort === 'popular') {
      out = [...out].sort(
        (a, b) => ((b.likes ?? 0) + (b.comments ?? 0)) - ((a.likes ?? 0) + (a.comments ?? 0)) || b.createdAt - a.createdAt
      );
    }
    else if (filters.sort === 'newest') out = [...out].sort((a, b) => b.createdAt - a.createdAt);
    else if (filters.sort === 'priceAsc') out = [...out].sort((a, b) => a.price - b.price);
    else if (filters.sort === 'priceDesc') out = [...out].sort((a, b) => b.price - a.price);
    return out;
  }, [posts, selectedCategory, filters, pricePreset, hiddenPostIds, mutedSellers]);

  // Paid Boost Post campaigns surface a Sponsored chip on explore cards (IG ad pattern).
  const boostedIds = useMemo(
    () => new Set(activePromos.filter((p) => p.kind === 'featuredPost' && p.postId).map((p) => p.postId as string)),
    [activePromos]
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Header — Figma 1:3512: hamburger left, susej left-aligned next to it, cart icon right */}
      <View className="flex-row items-center px-5 bg-surface" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <Text className="text-figma-20 font-inter-700 text-primary" style={{ letterSpacing: -0.5 }}>susej</Text>
        <View className="flex-1" />
        <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications" accessibilityRole="button">
          <BellIcon size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Shopping cart" accessibilityRole="button" style={{ marginLeft: 20 }}>
          <View style={{ position: 'relative' }}>
            <BagIcon size={22} color={colors.primary} />
            {cartCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -9,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  paddingHorizontal:  4,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700', lineHeight: 14 }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredPosts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-24"
        columnWrapperClassName="gap-3"
        ListEmptyComponent={
          <View className="items-center py-16 px-4">
            <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 15, lineHeight: 22 }}>
              {hasActiveFilters ? 'No items match your filters' : 'No items yet'}
            </Text>
            {hasActiveFilters ? (
              <TouchableOpacity
                className="mt-4 h-11 px-6 items-center justify-center rounded-figma-full"
                style={{ backgroundColor: colors.surfaceContainerLow }}
                onPress={clearAllFilters}
              >
                <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                  Clear filters
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View className="mb-4">
            {/* Search Bar — Figma: light lavender bg, blue search icon, compact height */}
            <View className="flex-row items-center h-11 px-4 rounded-figma-16 bg-surfaceContainerLow mb-4">
              <SearchIcon size={18} color={colors.primary} />
              <TextInput
                className="flex-1 ml-3 font-inter-400 text-textPrimary h-full"
                style={{ fontSize: 16 }}
                placeholder="Search for items, brands, or sellers..."
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
            <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.13 }}>
              {filteredPosts.length} {filteredPosts.length === 1 ? 'item found' : 'items found'}
            </Text>

            {/* View Nearby Sellers — Figma: full-width purple filled button, white map icon + white text */}
            <TouchableOpacity
              className="flex-row items-center justify-center gap-3 rounded-figma-16 mb-4"
              style={{ height: 48, backgroundColor: colors.primaryContainer }}
              onPress={() => router.push('/map')}
            >
              <MapOutlineIcon size={18} color={colors.surfaceContainerLowest} />
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.surfaceContainerLowest }}>
                View Nearby Sellers
              </Text>
            </TouchableOpacity>

            {/* Feature shortcuts — ONE compact row (Reels/Live/Auction/Bundles). Industry keeps these discoverable,
                but Figma's Explore is grid-first: slim tiles keep the product grid reachable in the first viewport */}
            <View className="mb-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} contentContainerClassName="px-5">
                {[
                  { label: 'Reels', icon: <PlayIcon size={16} color={colors.surfaceContainerLowest} />, route: '/reels' },
                  { label: 'Live', icon: <LiveIcon size={16} color={colors.surfaceContainerLowest} />, route: '/live' },
                  { label: 'Auctions', icon: <AuctionTimerIcon size={16} color={colors.surfaceContainerLowest} />, route: '/auctions' },
                  { label: 'Bundles', icon: <BundleGiftIcon size={16} color={colors.surfaceContainerLowest} />, route: '/bundles' },
                  { label: 'Communities', icon: <CommunityIcon size={16} color={colors.surfaceContainerLowest} />, route: '/communities' },
                  { label: 'Broadcast', icon: <BroadcastIcon size={16} color={colors.surfaceContainerLowest} />, route: '/broadcasts' },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    className="items-center justify-center bg-surfaceContainerLow rounded-figma-16"
                    style={{ width: 92, height: 84 }}
                    onPress={() => router.push(f.route as never)}
                  >
                    <View className="w-9 h-9 rounded-full bg-primaryContainer items-center justify-center">{f.icon}</View>
                    <Text className="font-inter-500 text-textPrimary mt-1.5" style={{ fontSize: 11, lineHeight: 14 }}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category Chips + See All (routes to Explore Industries hub, Figma 1:2198) */}
            <View className="flex-row items-center mb-4">
              <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3"
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`px-5 py-2 rounded-figma-full ${item === selectedCategory ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'}`}
                  onPress={() => {
                    setSelectedCategory(item === selectedCategory ? 'All' : item);
                  }}
                >
                  <Text className={`font-inter-500 ${item === selectedCategory ? 'text-white' : 'text-textSecondary'}`} style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>{item}</Text>
                </TouchableOpacity>
              )}
              />
              <TouchableOpacity
                onPress={() => router.push('/category')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="ml-3"
              >
                <Text className="font-inter-600 text-primary" style={{ fontSize: 12, lineHeight: 14 }}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filters */}
            <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
              <TouchableOpacity
                className="flex-row items-center h-10 px-4 rounded-figma-full"
                style={{ backgroundColor: hasActiveFilters ? colors.primaryContainer : colors.surfaceContainerLow }}
                onPress={() => setFilterVisible(true)}
              >
                <FilterIcon size={14} color={hasActiveFilters ? colors.onPrimary : colors.textSecondary} />
                <Text className="font-inter-500 ml-2" style={{ fontSize: 13, lineHeight: 16, color: hasActiveFilters ? colors.onPrimary : colors.textSecondary }}>
                  Filters
                </Text>
              </TouchableOpacity>
              {hasActiveFilters ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center" contentContainerStyle={{ gap: 8 }}>
                  {activeFilterChips.map((chip) => (
                    <View key={chip.key} className="flex-row items-center h-10 pl-3 pr-1.5 rounded-figma-full" style={{ backgroundColor: colors.primaryFixed }}>
                      <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.onPrimaryFixedVariant }} numberOfLines={1}>
                        {chip.label}
                      </Text>
                      <TouchableOpacity className="ml-1 p-1.5" hitSlop={6} onPress={() => clearFilter(chip.clearKey)}>
                        <CloseIcon size={12} color={colors.onPrimaryFixedVariant} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {/* Popular right now — the grid below is filtered+sorted stock
                (Popular/Newest/Price), not a velocity signal. */}
            <Text className="font-inter-600 text-textPrimary mb-3" style={{ fontSize: 20, lineHeight: 28 }}>
              Popular right now
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-1 bg-surfaceContainerLowest rounded-figma-24 mb-4 overflow-hidden"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <View className="w-full aspect-square bg-surfaceContainer">
              <Image source={resolveListingImage(item, item.id)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              {!hasRealImage(item) && (
                <View className="absolute inset-0 items-center justify-center">
                  <Text className="font-inter-700 text-secondary" style={{ fontSize: 30, lineHeight: 36 }}>
                    {(item.title?.trim()?.[0] ?? item.description.trim()[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              {boostedIds.has(item.id) && (
                <View
                  className="absolute top-3 left-3 h-5 px-2 rounded-figma-full items-center justify-center"
                  style={{ backgroundColor: colors.primaryContainer }}
                >
                  <Text className="font-inter-600" style={{ fontSize: 9, lineHeight: 13, color: colors.onPrimary, letterSpacing: 0.5 }}>
                    Sponsored
                  </Text>
                </View>
              )}
            </View>
            <View className="p-3">
              <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }} numberOfLines={2}>
                {(item.title?.trim() || item.description).split('#')[0].trim()}
              </Text>
              <Text className="font-inter-600 text-primaryContainer" style={{ fontSize: 20, lineHeight: 28 }}>
                {formatPrice(item.price)}
              </Text>
              <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 14, lineHeight: 20 }}>
                {item.sellerLocation}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      >
      </FlatList>

      {/* Filters Bottom Sheet */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setFilterVisible(false)} />
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
            </View>
            <View className="flex-row items-center px-5 pt-3 pb-2">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                Filters
              </Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <CloseIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5" style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
              {/* Price Range */}
              <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                PRICE RANGE
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {PRICE_PRESETS.map((p) => {
                  const active = filters.price === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      className="px-4 h-10 items-center justify-center rounded-figma-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setFilters((prev) => ({ ...prev, price: p.key }))}
                    >
                      <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Condition */}
              <Text className="font-inter-600 text-textPrimary mb-2 mt-5" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                CONDITION
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CONDITIONS.map((c) => {
                  const active = c === 'Any' ? filters.condition === 'any' : filters.condition === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      className="px-4 h-10 items-center justify-center rounded-figma-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setFilters((prev) => ({ ...prev, condition: c === 'Any' ? 'any' : c }))}
                    >
                      <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Verified Sellers Only */}
              <View className="flex-row items-center justify-between mt-5 mb-1">
                <View className="pr-3">
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                    Verified Sellers Only
                  </Text>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    Show listings from verified sellers
                  </Text>
                </View>
                <Switch
                  value={filters.verifiedOnly}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, verifiedOnly: v }))}
                  trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
                  thumbColor={colors.surfaceContainerLowest}
                />
              </View>

              {/* Sort */}
              <Text className="font-inter-600 text-textPrimary mb-2 mt-5" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                SORT BY
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {SORT_OPTIONS.map((s) => {
                  const active = filters.sort === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      className="px-4 h-10 items-center justify-center rounded-figma-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setFilters((prev) => ({ ...prev, sort: s.key }))}
                    >
                      <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="flex-row px-5 pt-4" style={{ gap: 12 }}>
              <TouchableOpacity
                className="flex-1 h-12 items-center justify-center"
                style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}
                onPress={clearAllFilters}
              >
                <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}>
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 items-center justify-center"
                style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                onPress={() => setFilterVisible(false)}
              >
                <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
