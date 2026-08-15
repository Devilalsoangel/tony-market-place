import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Image, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerIcon, PlusIcon, CheckIcon, VerifiedIcon, HeartIcon, BagIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { productImages, sellerAvatars } from '../../utils/productImages';
import { ProductCard } from '../../components/cards/ProductCard';
import { usePosts, type Post } from '../../contexts/PostContext';
import { useFollow } from '../../contexts/FollowContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { useHashtags } from '../../contexts/HashtagContext';
import { usePromotions } from '../../contexts/PromotionContext';
// Industry-style story tray — 8 sellers (IG shows 8-12 scrollable + functional; Figma only 4 static)
import { STORY_TRAY, trayParam } from '../../utils/storyTray';
// User's own uploaded story — read on focus so an upload is VISIBLE in the tray (ring + image)
import { loadMyStory, type MyStory } from '../../utils/myStory';

// Full-quality Figma assets (223:30 Home Feed) — 4x originals exported via LOCAL BRIDGE (exportAsync, no REST).
// Autos/Jobs tiles keep old photos: Figma image fills there are broken stubs (223:92, 223:97).
const FEED_IMAGES = {
  catForYou: require('../../assets/images/screens/feed/img-223-72.png'),
  catFood: require('../../assets/images/screens/feed/img-223-77.png'),
  catFashion: require('../../assets/images/screens/feed/img-223-82.png'),
  catElectronics: require('../../assets/images/screens/feed/img-223-87.png'),
  catAutos: require('../../assets/images/feed/cat-autos.png'),
  catJobs: require('../../assets/images/feed/cat-jobs.png'),
  heroBanner: require('../../assets/images/screens/feed/img-223-107.png'),
  seller1: require('../../assets/images/screens/feed/img-223-135.png'),
  seller2: require('../../assets/images/screens/feed/img-223-148.png'),
  deal1: require('../../assets/images/screens/feed/img-223-163.png'),
  deal2: require('../../assets/images/screens/feed/img-223-177.png'),
  sponsoredAvatar: require('../../assets/images/screens/feed/img-223-192.png'),
  sponsoredPost: require('../../assets/images/screens/feed/img-223-232.png'),
} as const;

// Helper for Image source — handles both require() (number) and uri strings
const imgSource = (img: string | number | undefined | null): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
};

const CompareIcon = ({ size = 16, color = '#464555' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
      fill={color}
    />
  </Svg>
);

const FlameIcon = ({ size = 14, color = '#ba1a1a' }: { size?: number; color?: string }) => (
  <Svg width={size} height={(size * 16) / 14} viewBox="0 0 14 16" fill="none">
    <Path
      d="M7 0c.4 3.4-2.6 4.8-3.6 6.9C2.6 8.6 2 9.8 2 11.2A5.2 5.2 0 007 16.4a5.2 5.2 0 005-5.2c0-1.7-.7-3.2-1.9-4.6-.2.9-.8 1.6-1.7 1.9C9.6 5.5 8.6 2.4 7 0z"
      fill={color}
    />
  </Svg>
);

const GridIcon = ({ size = 18, color = '#4343d5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path d="M2 2h6v6H2V2zM10 2h6v6h-6V2zM2 10h6v6H2v-6zM10 10h6v6h-6v-6z" fill={color} />
  </Svg>
);

const MAX_COMPARE = 3;

const WORLD_RAIL = [
  { label: 'For You', slug: null as string | null },
  { label: 'Food', slug: 'food' },
  { label: 'Fashion', slug: 'fashion' },
  { label: 'Electronics', slug: 'electronics' },
  { label: 'Auto', slug: 'automobiles' },
  { label: 'Jobs', slug: 'job' },
];

const DEALS = [
  { id: 'deal_1', name: 'Astron Chrono Watch', price: 12499, oldPrice: 15999, badge: '20% OFF', seed: 'astron', cat: 'electronics' },
  { id: 'deal_2', name: 'Urban Ace Low-Tops', price: 6999, oldPrice: 8500, badge: 'SALE', seed: 'ace-lowtop', cat: 'fashion' },
  { id: 'deal_3', name: 'Luxe Silk Saree', price: 2499, oldPrice: 3999, badge: '37% OFF', seed: 'silksaree', cat: 'fashion' },
  { id: 'deal_4', name: 'ProBook 14 Air', price: 54999, oldPrice: 62999, badge: '12% OFF', seed: 'probook', cat: 'electronics' },
];

// Figma Home Feed (223:30) shows 4 static story items; industry shows 8-12 scrollable + functional.
// STORY_TRAY (storyTray.ts) provides the full tray; the viewer advances across it (IG-style).

const formatFollowers = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`;

// Deterministic demo follower counts per seller
const followersFor = (username: string): number => {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % 997;
  return 120_000 + h * 12_000;
};

export default function FeedScreen() {
  return <FeedContent />;
}

function FeedContent() {
  // hiddenPostIds/mutedSellers land in PostContext from a parallel agent — read defensively
  const { posts, hiddenPostIds = [], mutedSellers = [] } = usePosts() as {
    posts: Post[];
    hiddenPostIds?: string[];
    mutedSellers?: string[];
  };
  const { isFollowing, toggleFollow } = useFollow();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { followedHashtags } = useHashtags();
  const insets = useSafeAreaInsets();
  const { recents } = useRecentlyViewed();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [countdown, setCountdown] = useState('04:12:35');
  const [myStory, setMyStory] = useState<MyStory | null>(null);

  // Reload the user's own uploaded story whenever the feed regains focus
  // (so a story posted from /create-story shows up in the tray immediately).
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

  // Hot deals countdown tick
  useEffect(() => {
    const tick = () => {
      setCountdown((prev) => {
        const parts = prev.split(':').map(Number);
        let total = parts[0] * 3600 + parts[1] * 60 + parts[2] - 1;
        if (total < 0) total = 24 * 3600 - 1;
        const hh = String(Math.floor(total / 3600)).padStart(2, '0');
        const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const ss = String(total % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      });
    };
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Suggested sellers — unique sellers from posts, excluding followed + current user
  const suggestions = useMemo(() => {
    const seen = new Map<string, { username: string; name: string; location: string; verified: boolean; avatar: any }>();
    for (const p of posts) {
      if (seen.has(p.sellerUsername)) continue;
      if (isFollowing(p.sellerUsername)) continue;
      if (authUser?.username && p.sellerUsername === authUser.username) continue;
      seen.set(p.sellerUsername, {
        username: p.sellerUsername,
        name: p.sellerName,
        location: p.sellerLocation,
        verified: p.verified,
        avatar:
          sellerAvatars[p.id] ??
          { uri: `https://picsum.photos/seed/${p.sellerUsername}/200/200` },
      });
    }
    return Array.from(seen.values()).slice(0, 8);
  }, [posts, isFollowing, authUser?.username]);

  const toggleCompare = (postId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(postId)) return prev.filter((id) => id !== postId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, postId];
    });
  };

  // Sort: sponsored post_001 first (Figma's top sponsored slot), then followed sellers, then newest
  const sortedPosts = useMemo(() => {
    const visible = posts.filter(
      (p) => !hiddenPostIds?.includes(p.id) && !mutedSellers?.includes(p.sellerUsername)
    );
    return [...visible].sort((a, b) => {
      if (a.id === 'post_001') return -1;
      if (b.id === 'post_001') return 1;
      const aFollowed = isFollowing(a.sellerUsername);
      const bFollowed = isFollowing(b.sellerUsername);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [posts, hiddenPostIds, mutedSellers, isFollowing]);

  // Promotions & Ads (IG boost model): sellers buy visibility from the Promotions
  // screen; the feed reflects live campaigns — Boost Posts interleaved every 4th
  // slot with a Sponsored chip, Hot Deals pinned in the deals rail, Top Sellers
  // pinned in the sellers rail. Vocabulary mirrors the admin Promotions console.
  const { promotions = [] } = usePromotions();
  const activePromos = useMemo(
    () => promotions.filter((p) => p.status === 'active'),
    [promotions]
  );
  const boostedIds = useMemo(
    () => new Set(activePromos.filter((p) => p.kind === 'featuredPost' && p.postId).map((p) => p.postId as string)),
    [activePromos]
  );
  const hotDealIds = useMemo(
    () => new Set(activePromos.filter((p) => p.kind === 'hotDeal' && p.postId).map((p) => p.postId as string)),
    [activePromos]
  );
  const promotedSellers = useMemo(
    () => new Set(activePromos.filter((p) => p.kind === 'topSeller').map((p) => p.sellerUsername)),
    [activePromos]
  );

  // Paid Hot Deal campaigns are pinned into the deals rail with an URGENT badge.
  const hotDealCards = useMemo(
    () =>
      sortedPosts
        .filter((p) => hotDealIds.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.description,
          price: p.price,
          oldPrice: p.mrp ?? Math.round(p.price * 1.25),
          badge: 'URGENT',
          seed: p.id,
          cat: p.category || 'fashion',
        })),
    [sortedPosts, hotDealIds]
  );

  // Interleave boosted posts every 4th position (post_001 keeps the Figma top slot).
  const feedList = useMemo(() => {
    const boosted = sortedPosts.filter((p) => boostedIds.has(p.id) && p.id !== 'post_001');
    if (boosted.length === 0) return sortedPosts;
    const rest = sortedPosts.filter((p) => !boostedIds.has(p.id) || p.id === 'post_001');
    const out: (typeof sortedPosts)[number][] = [];
    let bi = 0;
    for (let i = 0; i < rest.length; i++) {
      if (i > 0 && i % 4 === 0 && bi < boosted.length) out.push(boosted[bi++]);
      out.push(rest[i]);
    }
    while (bi < boosted.length) out.push(boosted[bi++]);
    return out;
  }, [sortedPosts, boostedIds]);

  const recentlyViewed = useMemo(() => {
    return recents
      .map((r) => ({ entry: r, post: posts.find((p) => p.id === r.postId) }))
      .filter((x): x is { entry: { postId: string; viewedAt: number }; post: (typeof posts)[number] } => !!x.post)
      .filter((x) => !hiddenPostIds?.includes(x.post.id) && !mutedSellers?.includes(x.post.sellerUsername))
      .slice(0, 8);
  }, [recents, posts, hiddenPostIds, mutedSellers]);

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5"
        style={{ height: 64, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.push('/explore')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HamburgerIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="font-inter-700" style={{ fontSize: 24, lineHeight: 28, color: colors.primary, letterSpacing: -0.5 }}>
          susej
        </Text>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TouchableOpacity onPress={() => router.push('/saved')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <HeartIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BagIcon size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={feedList}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* Stories — Figma 223:30 ring style (gradient stroke 64, avatar 56, label 12, gap 16),
                but industry-practical: YOUR STORY first + 8 seller stories, horizontally scrollable,
                tray navigation in viewer (tap -> story -> next story automatically). */}
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-5"
                contentContainerStyle={{ gap: 8 }}
              >
                {/* Your Story (IG pattern): uploaded story gets a ring + preview; empty state = + tile */}
                {myStory ? (
                  <TouchableOpacity
                    className="items-center"
                    style={{ width: 56 }}
                    onPress={() =>
                      router.push({
                        pathname: '/story/me',
                        params: { mine: '1', tray: trayParam(), idx: '0' },
                      })
                    }
                  >
                    <LinearGradient
                      colors={[colors.primaryContainer, colors.inversePrimary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        className="w-[54px] h-[54px] rounded-full items-center justify-center overflow-hidden"
                        style={{ backgroundColor: colors.surfaceContainerLowest }}
                      >
                        <Image source={{ uri: myStory.image }} className="w-[50px] h-[50px] rounded-full" resizeMode="cover" />
                      </View>
                    </LinearGradient>
                    <Text
                      className="text-figma-11 font-inter-400 text-textSecondary mt-0.5 text-center"
                      style={{ letterSpacing: 0.2 }}
                      numberOfLines={1}
                    >
                      Your Story
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="items-center"
                    style={{ width: 56 }}
                    onPress={() => router.push('/create-story')}
                  >
                    <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                      <View className="w-[54px] h-[54px] rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLowest }}>
                        <Image source={FEED_IMAGES.sponsoredAvatar} className="w-[50px] h-[50px] rounded-full" />
                        <View
                          className="absolute bottom-0 right-0 w-[18px] h-[18px] rounded-full items-center justify-center"
                          style={{ backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.surface }}
                        >
                          <PlusIcon size={10} color={colors.surfaceContainerLowest} />
                        </View>
                      </View>
                    </View>
                    <Text
                      className="text-figma-11 font-inter-400 text-textSecondary mt-0.5 text-center"
                      style={{ letterSpacing: 0.2 }}
                      numberOfLines={1}
                    >
                      Your Story
                    </Text>
                  </TouchableOpacity>
                )}

                {STORY_TRAY.map((story, idx) => (
                  <TouchableOpacity
                    key={story.id}
                    className="items-center"
                    style={{ width: 56 }}
                    onPress={() =>
                      router.push({
                        pathname: `/story/${story.route}`,
                        params: { tray: trayParam(), idx: String(idx) },
                      })
                    }
                  >
                    <LinearGradient
                      colors={[colors.primaryContainer, colors.inversePrimary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        className="w-[54px] h-[54px] rounded-full items-center justify-center overflow-hidden"
                        style={{ backgroundColor: colors.surfaceContainerLowest }}
                      >
                        <Image source={imgSource(story.avatar)} className="w-[50px] h-[50px] rounded-full" />
                      </View>
                    </LinearGradient>
                    <Text
                      className="text-figma-11 font-inter-400 text-textSecondary mt-0.5 text-center"
                      style={{ letterSpacing: 0.2 }}
                      numberOfLines={1}
                    >
                      {story.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* WORLD RAIL — categories rail: heading 18 SemiBold, tiles 72x92 gap 12, All tile icon-only */}
            <View className="mt-4">
              <Text className="px-5 text-figma-18 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.18 }}>
                WORLD RAIL
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4"
                contentContainerClassName="px-5"
                contentContainerStyle={{ gap: 12 }}
              >
                {WORLD_RAIL.map((tile) => (
                  <TouchableOpacity
                    key={tile.label}
                    className="w-[72px] h-[92px] rounded-figma-16 overflow-hidden"
                    onPress={() => (tile.slug ? router.push(`/category/${tile.slug}`) : router.push('/explore'))}
                  >
                    <Image
                      source={
                        tile.slug === 'food' ? FEED_IMAGES.catFood
                        : tile.slug === 'fashion' ? FEED_IMAGES.catFashion
                        : tile.slug === 'electronics' ? FEED_IMAGES.catElectronics
                        : tile.slug === 'automobiles' ? FEED_IMAGES.catAutos
                        : tile.slug === 'job' ? FEED_IMAGES.catJobs
                        : FEED_IMAGES.catForYou
                      }
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                    <Text
                      className="absolute bottom-2 left-0 right-0 text-center font-inter-400 text-white"
                      style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.2 }}
                    >
                      {tile.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  className="w-[72px] h-[92px] rounded-figma-12 items-center justify-center"
                  onPress={() => router.push('/explore')}
                >
                  <GridIcon size={16} color={colors.primary} />
                  <Text className="font-inter-400 text-primary mt-1" style={{ fontSize: 10, lineHeight: 13 }}>
                    All
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Hero banner — Figma 223:106: 350x176 section (mx-5), image 350x160, purple #5d5fef left-half gradient 0.75->0, CTA 115x32 */}
            <View className="mx-5 mt-4 rounded-figma-24 overflow-hidden bg-surfaceContainerLowest" style={{ height: 176 }}>
              <Image
                source={FEED_IMAGES.heroBanner}
                className="w-full"
                style={{ height: 160 }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(93,95,239,0.85)', 'rgba(93,95,239,0.05)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.6, y: 0.5 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 160 }}
              />
              <View className="absolute inset-0 justify-between" style={{ paddingTop: 18, paddingBottom: 30, paddingLeft: 24, paddingRight: 24 }}>
                <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 15, letterSpacing: 1.4 }}>
                  EXCLUSIVE OFFER
                </Text>
                <View>
                  <Text className="font-inter-600 text-white" style={{ fontSize: 19, lineHeight: 24 }}>
                    Mega Fashion{'\n'}Sale
                  </Text>
                  <TouchableOpacity
                    className="mt-4 items-center justify-center rounded-figma-full bg-white"
                    style={{ width: 115, height: 32 }}
                    onPress={() => router.push('/category/fashion')}
                  >
                    <Text className="font-inter-600 text-primary" style={{ fontSize: 14, lineHeight: 16 }}>
                      Shop now
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Top sellers — Figma: 2 cards 192x187 gap 16, avatar 56 top, solid primary Follow */}
            {!authLoading && suggestions.length > 0 && (
              <View className="mt-4">
                <View className="flex-row items-center justify-between px-5">
                  <Text className="text-figma-12 font-inter-600 text-secondary" style={{ letterSpacing: 0.12 }}>
                    TOP SELLERS
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/explore')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text className="text-figma-12 font-inter-600 text-primary">View all</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerClassName="px-5"
                  contentContainerStyle={{ gap: 16 }}
                >
                  {suggestions.slice(0, 6).map((s, i) => {
                    // Figma personas (223:118): Velvet & Co 2.4M + Urban Threads 890K first; rest demo data
                    const figmaName = i === 0 ? 'Velvet & Co' : i === 1 ? 'Urban Threads' : s.name;
                    const figmaFollowers = i === 0 ? 2400000 : i === 1 ? 890000 : followersFor(s.username);
                    return (
                    <View
                      key={s.username}
                      className="w-40 rounded-figma-16 bg-surfaceContainerLowest items-center p-2.5"
                      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                    >
                      <TouchableOpacity onPress={() => router.push(`/seller/${s.username}`)} className="items-center">
                        <View className="w-14 h-14 rounded-full bg-surfaceContainer items-center justify-center">
                          <Image
                            source={i === 0 ? FEED_IMAGES.seller1 : i === 1 ? FEED_IMAGES.seller2 : imgSource(s.avatar)}
                            className="w-14 h-14 rounded-full"
                          />
                          {(s.verified || i < 2) && (
                            <View
                              className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-surfaceContainerLowest items-center justify-center"
                              style={{ borderWidth: 1, borderColor: colors.outlineVariant }}
                            >
                              <VerifiedIcon size={13} />
                            </View>
                          )}
                        </View>
                        <Text className="font-inter-600 text-textPrimary mt-2" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                          {figmaName}
                        </Text>
                        {promotedSellers.has(s.username) && (
                          <View className="mt-0.5 px-1.5 py-px rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                            <Text className="font-inter-600" style={{ fontSize: 8, lineHeight: 10, letterSpacing: 0.4, color: colors.onPrimary }}>
                              TOP SELLER
                            </Text>
                          </View>
                        )}
                        <Text className="font-inter-400 text-secondary mt-0.5" style={{ fontSize: 9, lineHeight: 12 }}>
                          {formatFollowers(figmaFollowers)} followers
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="mt-2 h-6 w-[136px] rounded-figma-10 items-center justify-center"
                        style={{ backgroundColor: colors.primaryContainer }}
                        onPress={() => toggleFollow(s.username)}
                      >
                        <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 15 }}>Follow</Text>
                      </TouchableOpacity>
                    </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Hot deals — Figma: horizontal row of 169x273 cards, gap 12, image square + info below */}
            <View className="mt-4">
              <View className="flex-row items-center justify-between px-5">
                <Text className="text-figma-20 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.2 }}>
                  Hot Deals
                </Text>
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <FlameIcon size={13} color={colors.error} />
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 15, color: colors.error }}>
                    {countdown}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4"
                contentContainerClassName="px-5"
                contentContainerStyle={{ gap: 12 }}
              >
                {[...hotDealCards, ...DEALS].map((deal, i) => (
                  <TouchableOpacity
                    key={deal.id}
                    className="w-[169px] rounded-figma-24 bg-surfaceContainerLowest overflow-hidden"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
                    onPress={() => router.push(`/category/${deal.cat}`)}
                  >
                    <View className="w-full bg-surfaceContainer" style={{ aspectRatio: 1 }}>
                      <Image
                        source={i === 0 ? FEED_IMAGES.deal1 : i === 1 ? FEED_IMAGES.deal2 : { uri: `https://picsum.photos/seed/${deal.seed}/338/338` }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                      <View
                        className="absolute top-3 left-3 h-5 px-2 rounded-figma-full items-center justify-center"
                        style={{ backgroundColor: colors.dealBadgeBg }}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 9, lineHeight: 13, color: colors.dealBadgeText }}>
                          {deal.badge}
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="absolute bottom-4 right-3 w-8 h-8 rounded-figma-full items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <HeartIcon size={15} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                    <View className="px-4 pt-2 pb-3">
                      <Text className="font-inter-400 text-secondary" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                        {deal.name}
                      </Text>
                      <View className="flex-row items-baseline mt-1.5" style={{ gap: 8 }}>
                        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
                          {formatPrice(deal.price)}
                        </Text>
                        <Text className="font-inter-400 text-secondary line-through" style={{ fontSize: 10, lineHeight: 14 }}>
                          {formatPrice(deal.oldPrice)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View className="pt-2">
            <ProductCard
              id={item.id}
              sellerName={item.sellerName}
              sellerUsername={item.sellerUsername}
              sellerLocation={item.sellerLocation}
              verified={item.verified}
              sponsored={index === 0 || boostedIds.has(item.id)}
              price={item.price}
              description={item.description}
              likes={item.likes}
              comments={item.comments}
              hashtags={item.hashtags}
              productImage={
                item.id === 'post_001'
                  ? FEED_IMAGES.sponsoredPost
                  : item.image ??
                    item.images?.[0] ??
                    productImages[item.id] ??
                    { uri: `https://picsum.photos/seed/${item.id}/800/1000` }
              }
              sellerAvatar={item.id === 'post_001' ? FEED_IMAGES.sponsoredAvatar : sellerAvatars[item.id]}
            />
          </View>
        )}
        ListFooterComponent={
          <View className="pt-4 pb-4">
            {followedHashtags.length > 0 && (
              <View className="mb-4">
                <Text className="px-5 text-figma-14 font-inter-600 text-textPrimary mb-2" style={{ letterSpacing: 0.14 }}>
                  Followed hashtags
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="px-5"
                  contentContainerStyle={{ gap: 8 }}
                >
                  {followedHashtags.slice(0, 10).map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      className="px-4 py-2 rounded-figma-full items-center justify-center"
                      style={{ backgroundColor: colors.primaryContainer }}
                      onPress={() => router.push(`/hashtag/${tag}`)}
                    >
                      <Text className="text-figma-12 font-inter-600" style={{ color: colors.surfaceContainerLowest }}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {recentlyViewed.length > 0 && (
              <View>
                <View className="flex-row items-center justify-between px-5 mb-2">
                  <Text className="text-figma-14 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.14 }}>
                    Recently viewed
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (compareIds.length >= 2) router.push(`/compare?ids=${compareIds.join(',')}`);
                    }}
                  >
                    <Text
                      className="text-figma-12 font-inter-600"
                      style={{ letterSpacing: 0.24, color: compareIds.length >= 2 ? colors.primaryContainer : colors.textTertiary }}
                    >
                      {compareIds.length > 0 ? `Compare (${compareIds.length})` : 'Compare'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="px-5"
                  contentContainerStyle={{ gap: 12 }}
                >
                  {recentlyViewed.map(({ entry, post }) => {
                    const selected = compareIds.includes(entry.postId);
                    const image = post.image ?? productImages[entry.postId];
                    return (
                      <TouchableOpacity
                        key={entry.postId}
                        className="items-start"
                        style={{ width: 96 }}
                        onPress={() => router.push(`/product/${entry.postId}`)}
                      >
                        <View className="w-[96px] h-[96px] rounded-figma-16 overflow-hidden bg-surfaceContainer">
                          {image ? (
                            <Image source={imgSource(image)} className="w-full h-full" resizeMode="cover" />
                          ) : (
                            <View className="flex-1 items-center justify-center">
                              <Text className="text-figma-20 font-inter-500 text-primaryContainer">+</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLowest,
                            borderWidth: 1,
                            borderColor: selected ? colors.primaryContainer : colors.outlineVariant,
                          }}
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleCompare(entry.postId);
                          }}
                        >
                          {selected ? (
                            <CheckIcon size={12} color={colors.surfaceContainerLowest} />
                          ) : (
                            <CompareIcon size={12} color={colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                        <Text className="text-figma-12 font-inter-600 text-textPrimary mt-1.5">{formatPrice(post.price)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-10 py-24">
            <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 15, lineHeight: 22 }}>
              Nothing here — follow sellers to fill your feed
            </Text>
            <View className="mt-5 flex-row items-center h-11 px-6 rounded-figma-full" style={{ backgroundColor: colors.primaryContainer }}>
              <PlusIcon size={14} color={colors.surfaceContainerLowest} />
              <Text className="font-inter-600 ml-2" style={{ fontSize: 13, lineHeight: 16, color: colors.surfaceContainerLowest }}>
                Follow suggestions
              </Text>
            </View>
          </View>
        }
        contentContainerClassName="pb-20"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
