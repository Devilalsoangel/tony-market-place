import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { View, Text, Image, FlatList, ScrollView, TouchableOpacity, StyleSheet, Animated, Dimensions, RefreshControl } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { hasRealImage, resolveAvatar, resolveListingImage } from '../../utils/productImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon, CheckIcon, VerifiedIcon, BellIcon, BagIcon, HeartIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { ProductCard } from '../../components/cards/ProductCard';
import { PostCardSkeleton } from '../../components/ui/Skeleton';
import { useCart } from '../../contexts/CartContext';
import { usePosts, type Post } from '../../contexts/PostContext';
import { useFollow } from '../../contexts/FollowContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { useHashtags } from '../../contexts/HashtagContext';
import { useBookmark } from '../../contexts/BookmarkContext';
import { serverApi } from '../../utils/serverApi';
import { getAdminUrl } from '../../utils/adminSync';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
// REAL stories only — first-class /api/app/stories entities (24h, author-posted).
// Feed posts are NEVER shown as stories.
import { groupStoriesByAuthor, trayParam, type AppStory } from '../../utils/storyTray';
// User's own uploaded story — read on focus so an upload is VISIBLE in the tray (ring + image)
import { loadMyStory, type MyStory } from '../../utils/myStory';

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

const GridIcon = ({ size = 18, color = '#4343d5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path d="M2 2h6v6H2V2zM10 2h6v6h-6V2zM2 10h6v6H2v-6zM10 10h6v6h-6v-6z" fill={color} />
  </Svg>
);

const MAX_COMPARE = 3;

// Real deals only: posts where the seller set an MRP above the selling price.
// No fabricated discount rows — when nothing is discounted the rail hides entirely.

// Figma Home Feed (223:30) shows 4 static story items; industry shows 8-12 scrollable + functional.
// The tray lists authors who actually POSTED a story (/api/app/stories); the viewer walks it IG-style.

// Real follower counts come from the server Follow table via FollowContext.
// Small numbers render exact ("7 followers") — honest data beats vanity metrics.
const formatFollowers = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1e3).toFixed(n % 1000 >= 100 ? 1 : 0)}K`;
  return `${(n / 1e6).toFixed(1)}M`;
};

export default function FeedScreen() {
  return <FeedContent />;
}

function FeedContent() {
  // hiddenPostIds/mutedSellers land in PostContext from a parallel agent — read defensively
  const { posts, hiddenPostIds = [], mutedSellers = [], refresh: refreshPosts, toggleLike, isLiked } = usePosts() as {
    posts: Post[];
    loaded: boolean;
    refresh: () => Promise<boolean>;
    hiddenPostIds?: string[];
    mutedSellers?: string[];
    toggleLike: (postId: string) => boolean;
    isLiked: (postId: string) => boolean;
  };
  // Industry-standard cart affordance: item-count badge on the bag icon (feed header). The
  // count mirrors CartContext so the badge stays truthful across every surface.
  const { cartCount } = useCart();
  const feedLoaded = (usePosts() as unknown as { loaded?: boolean }).loaded ?? false;
  // Industry-standard pull-to-refresh: refetch server feed + reconcile cache; spinner
  // runs only while the request is live — failure shows "Couldn't refresh"
  // (IG parity) instead of passing as "no new posts".
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshFailed(false);
    Promise.resolve(refreshPosts ? refreshPosts() : true).then((ok) => {
      if (!ok) setRefreshFailed(true);
    }).catch(() => setRefreshFailed(true)).finally(() => setRefreshing(false));
  }, [refreshPosts]);
  const { isFollowing, toggleFollow, followerCounts } = useFollow();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { followedHashtags } = useHashtags();
  const insets = useSafeAreaInsets();
  const { recents } = useRecentlyViewed();
  // ROLE-BASED UI: post/story/live creation surfaces render for SELLERS only.
  const isSeller = !!authUser?.isSeller;
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [myStory, setMyStory] = useState<MyStory | null>(null);
  // Marketing banner hero: REAL seller-uploaded banner image synced from the
  // seller dashboard (admin "Marketing Banners"). No server content -> NO hero
  // section at all (no fabricated campaigns, no post marketing).
  const [hero, setHero] = useState<{ sellerUsername: string; sellerName: string; title: string; subtitle?: string | null; ctaLabel?: string | null; imageUrl: string; size?: string | null } | null>(null);
  // Admin-owned category catalog (name + banner image from the DB). The app
  // injects NO category assets — tiles without an admin image render a
  // neutral letter tile.
  const [worldCats, setWorldCats] = useState<Array<{ name: string; slug: string; bannerImage?: string | null }>>([]);
  // REAL stories posted via /api/app/stories (own story is local, everyone else server-side)
  const [serverStories, setServerStories] = useState<AppStory[]>([]);
  // Paid promotion campaigns from the SERVER (source of truth for placements).
  // The local PromotionContext mirrors only the seller's own purchases.
  const [serverPromos, setServerPromos] = useState<any[]>([]);
  // Home-API spotlight (paid position-1 pin, promo engine writes it). Merged
  // with promotion-campaign spotlight ids below so the paid slot renders even
  // when the promotions feed lags the home sweep.
  const [homeSpotlightPostId, setHomeSpotlightPostId] = useState<string | null>(null);
  // Admin rail visibility ("Show on home page" toggles). Missing = ON.
  const [homeSections, setHomeSections] = useState<Record<string, boolean> | null>(null);
  const sectionOn = (k: string) => homeSections?.[k] !== false;
  // Featured-post rail (paid placements from /api/v1/home). Pinned rows float
  // to the spotlight; the rest interleave as boosted posts — every paid row
  // renders while its rail is ON, none renders while OFF.
  const [homeFeaturedPinned, setHomeFeaturedPinned] = useState<string[]>([]);
  const [homeFeaturedBoosted, setHomeFeaturedBoosted] = useState<string[]>([]);
  // Server rails (single truth with the admin desks): /api/v1/home serves
  // admin-curated + live-resolved top sellers and paid hot deals. The app
  // renders THESE first; organic suggestions fill leftover slots only.
  const [homeTopSellers, setHomeTopSellers] = useState<Array<{ sellerId: string; sellerUsername?: string | null; sellerName: string; sellerLogo?: string | null; totalSales?: number; rating?: number; reviewCount?: number; position?: number; isPinned?: boolean | null }>>([]);
  const [homeHotDeals, setHomeHotDeals] = useState<Array<{ productId: string; postId?: string | null; productName: string; productImage?: string | null; originalPrice?: number; discountedPrice?: number; discountPercentage?: number; priority?: number }>>([]);

  // Reload the user's own uploaded story whenever the feed regains focus
  // (so a story posted from /create-story shows up in the tray immediately)
  // and refresh admin-curated content (hero + categories) + real stories/promos.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMyStory().then((s) => {
        if (active) setMyStory(s);
      });
      serverApi.getHome().then(async (res) => {
        if (!active) return;
        const sections = res.ok ? (res.data?.sections ?? null) : null;
        if (active) setHomeSections(sections);
        const secOn = (k: string) => (sections as Record<string, boolean> | null)?.[k] !== false;
        if (res.ok && secOn('spotlight')) setHomeSpotlightPostId(res.data?.spotlight?.postId ?? null);
        else if (active) setHomeSpotlightPostId(null);
        // Featured rail merges into the paid boost sets (pinned floats top).
        if (res.ok && secOn('featured-posts') && res.data?.featuredPosts?.length) {
          const pinned: string[] = [];
          const boosted: string[] = [];
          for (const f of res.data.featuredPosts) {
            if (!f?.postId) continue;
            if (f.isPinned) pinned.push(f.postId);
            else boosted.push(f.postId);
          }
          if (active) {
            setHomeFeaturedPinned(pinned);
            setHomeFeaturedBoosted(boosted);
          }
        } else if (active) {
          setHomeFeaturedPinned([]);
          setHomeFeaturedBoosted([]);
        }
        // Server rails: curated top sellers (username-resolved) + paid hot
        // deals (postId-resolved). Rows without a resolvable key are dropped —
        // a dead chip is worse than a shorter rail; organic fills the gap.
        if (res.ok && secOn('top-sellers') && res.data?.topSellers?.length) {
          if (active) setHomeTopSellers(res.data.topSellers.filter((t) => t?.sellerUsername));
        } else if (active) {
          setHomeTopSellers([]);
        }
        if (res.ok && secOn('hot-deals') && res.data?.hotDeals?.length) {
          if (active) setHomeHotDeals(res.data.hotDeals.filter((d) => d?.postId));
        } else if (active) {
          setHomeHotDeals([]);
        }
        const list = res.ok && secOn('storefront-banners') && res.data?.marketingBanners?.length ? res.data.marketingBanners : [];
        // Only banners with a REAL uploaded image can be a hero — a text-only
        // row would render an empty box.
        const first = list.find((b) => b.imageUrl) || null;
        if (!first || !first.imageUrl) {
          setHero(null);
          return;
        }
        const base = await getAdminUrl();
        if (!active) return;
        setHero({
          sellerUsername: first.sellerUsername,
          sellerName: first.sellerName,
          title: first.title,
          subtitle: first.subtitle,
          ctaLabel: first.ctaLabel,
          imageUrl: first.imageUrl.startsWith('http') ? first.imageUrl : `${base}${first.imageUrl}`,
          size: first.size,
        });
      });
      serverApi.getCategories().then((res) => {
        if (!active) return;
        const cats = res.ok && res.data?.categories?.length ? res.data.categories : [];
        setWorldCats(cats.slice(0, 6).map((c) => ({ name: c.name, slug: c.slug, bannerImage: c.bannerImage ?? null })));
      });
      serverApi.getStories().then((res) => {
        if (!active) return;
        setServerStories(res.ok && res.data?.stories ? (res.data.stories as AppStory[]) : []);
      });
      serverApi.getPromotions().then((res) => {
        if (!active) return;
        setServerPromos(res.ok && res.data?.promotions ? res.data.promotions : []);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  // Story tray: authors with REAL posted stories only (never feed posts).
  // Own story tile renders separately above this row.
  const storyTray = useMemo(
    () =>
      groupStoriesByAuthor(
        serverStories.filter((s) => s.username !== authUser?.username),
        10
      ),
    [serverStories, authUser?.username]
  );
  const trayUsernames = useMemo(() => storyTray.map((s) => s.username), [storyTray]);

  // Suggested sellers — unique sellers from posts, excluding followed + muted + hidden + imageless
  const suggestions = useMemo(() => {
    const seen = new Map<string, { username: string; name: string; location: string; verified: boolean; avatar: any }>();
    for (const p of posts) {
      if (seen.has(p.sellerUsername)) continue;
      if (isFollowing(p.sellerUsername)) continue;
      if (authUser?.username && p.sellerUsername === authUser.username) continue;
      if ((mutedSellers as string[] | undefined)?.includes(p.sellerUsername)) continue;
      if ((hiddenPostIds as string[] | undefined)?.includes(p.id)) continue;
      if (!hasRealImage(p)) continue;
      seen.set(p.sellerUsername, {
        username: p.sellerUsername,
        name: p.sellerName,
        location: p.sellerLocation,
        verified: p.verified,
        avatar: resolveAvatar(p.sellerUsername),
      });
    }
    return Array.from(seen.values()).slice(0, 8);
  }, [posts, isFollowing, authUser?.username, mutedSellers, hiddenPostIds]);

  // TOP SELLERS rail (single truth with the admin desk): server-curated rows
  // (live sales-resolved, username-keyed) lead in admin rank order; organic
  // suggestions backfill leftover slots so the rail never goes dead when the
  // desk is empty. Paid pill + follow + kill-switch behave as before.
  const topSellerChips = useMemo(() => {
    if (!sectionOn('top-sellers')) return [];
    const byUser = new Map(suggestions.map((s) => [s.username, s]));
    const out: Array<{ username: string; name: string; location: string; verified: boolean; avatar: any }> = [];
    const seen = new Set<string>();
    for (const t of homeTopSellers) {
      const u = t.sellerUsername as string | undefined;
      if (!u || seen.has(u)) continue;
      seen.add(u);
      const s = byUser.get(u);
      out.push({
        username: u,
        name: t.sellerName || s?.name || u,
        location: s?.location ?? '',
        verified: s?.verified ?? false,
        avatar: s?.avatar ?? resolveAvatar(u),
      });
    }
    for (const s of suggestions) {
      if (seen.has(s.username) || out.length >= 6) continue;
      seen.add(s.username);
      out.push(s);
    }
    return out.slice(0, 6);
  }, [homeTopSellers, suggestions, homeSections]);

  const toggleCompare = (postId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(postId)) return prev.filter((id) => id !== postId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, postId];
    });
  };

  // Sort: followed sellers first, then newest — imageless NEVER in feed (even for seller), only in seller dashboard under review until image added
  const sortedPosts = useMemo(() => {
    const visible = posts.filter(
      (p) => !hiddenPostIds?.includes(p.id) && !mutedSellers?.includes(p.sellerUsername) && hasRealImage(p)
    );
    return [...visible].sort((a, b) => {
      const aFollowed = isFollowing(a.sellerUsername);
      const bFollowed = isFollowing(b.sellerUsername);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [posts, hiddenPostIds, mutedSellers, isFollowing]);

  // Promotions & Ads (IG boost model): PAID placements come from the SERVER
  // (PromotionPurchase rows). No paid campaign -> no placement anywhere; the
  // deals rail NEVER backfills with organic discounts (paid-only rule).
  const activePromos = useMemo(
    () => serverPromos.filter((p) => p.status === 'active'),
    [serverPromos]
  );
  const boostedIds = useMemo(
    () => {
      if (!sectionOn('featured-posts')) return new Set<string>();
      const ids = new Set(activePromos.filter((p) => p.kind === 'featuredPost' && p.postId).map((p) => p.postId as string));
      for (const id of homeFeaturedBoosted) ids.add(id);
      return ids;
    },
    [activePromos, homeFeaturedBoosted, homeSections]
  );
  const hotDealIds = useMemo(
    () => {
      if (!sectionOn('hot-deals')) return new Set<string>();
      return new Set(activePromos.filter((p) => p.kind === 'hotDeal' && p.postId).map((p) => p.postId as string));
    },
    [activePromos, homeSections]
  );
  // Feed Spotlight (OLX Pin-to-Top): paid posts float to the VERY top of the feed.
  const spotlightIds = useMemo(
    () => {
      const ids = new Set<string>();
      if (sectionOn('spotlight')) {
        for (const p of activePromos) {
          if (p.kind === 'spotlight' && p.postId) ids.add(p.postId as string);
        }
        if (homeSpotlightPostId) ids.add(homeSpotlightPostId);
      }
      // Pinned featured rows float top too — but under their own rail flag.
      if (sectionOn('featured-posts')) {
        for (const id of homeFeaturedPinned) ids.add(id);
      }
      return ids;
    },
    [activePromos, homeSpotlightPostId, homeFeaturedPinned, homeSections]
  );
  const promotedSellers = useMemo(
    () => {
      // Kill-switch honored like every other home rail: OFF hides the
      // TOP SELLER chips too.
      if (!sectionOn('top-sellers')) return new Set<string>();
      return new Set(activePromos.filter((p) => p.kind === 'topSeller').map((p) => p.sellerId ?? p.sellerUsername));
    },
    [activePromos, homeSections]
  );

  // PAID Hot Deal campaigns ONLY (kind=hotDeal with a real post). Organic MRP
  // discounts are NOT deals-rail material — they stay as badges on normal cards.
  // Server hot deals (admin-curated paid placements, postId-resolved) lead;
  // live-campaign matches append behind them, deduped by post id.
  const hotDealCards = useMemo(() => {
    const seen = new Set<string>();
    const cards: Array<{ id: string; name: string; price: number; oldPrice?: number; badge: string; image?: string }> = [];
    if (sectionOn('hot-deals')) {
      for (const d of homeHotDeals) {
        const pid = d.postId as string;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        const price = typeof d.discountedPrice === 'number' ? d.discountedPrice : (typeof d.originalPrice === 'number' ? d.originalPrice : 0);
        cards.push({
          id: pid,
          name: d.productName,
          price,
          oldPrice: typeof d.originalPrice === 'number' && d.originalPrice > price ? d.originalPrice : undefined,
          badge: 'URGENT',
          image: d.productImage ?? undefined,
        });
      }
    }
    for (const p of sortedPosts) {
      if (!hotDealIds.has(p.id) || seen.has(p.id)) continue;
      seen.add(p.id);
      cards.push({
        id: p.id,
        name: p.description,
        price: p.price,
        oldPrice: typeof p.mrp === 'number' && p.mrp > p.price ? p.mrp : undefined as number | undefined,
        badge: 'URGENT',
        image: p.image ?? p.images?.[0],
      });
    }
    return cards;
  }, [sortedPosts, hotDealIds, homeHotDeals, homeSections]);

  // Deals rail = paid campaigns only. Hides entirely when nothing is paid.
  const dealsRail = useMemo(() => hotDealCards, [hotDealCards]);

  // Spotlight pins first (paid #1 slot), then boosted posts interleaved every
  // 4th position (paid campaigns only — no fake sponsored slot).
  const feedList = useMemo(() => {
    const pinned = sortedPosts.filter((p) => spotlightIds.has(p.id));
    if (boostedIds.size === 0 && pinned.length > 0) return pinned.concat(sortedPosts.filter((p) => !spotlightIds.has(p.id)));
    const boosted = sortedPosts.filter((p) => boostedIds.has(p.id));
    if (boosted.length === 0 && pinned.length === 0) return sortedPosts;
    const rest = sortedPosts.filter((p) => !boostedIds.has(p.id));
    const out: (typeof sortedPosts)[number][] = [];
    let bi = 0;
    for (let i = 0; i < rest.length; i++) {
      if (i > 0 && i % 4 === 0 && bi < boosted.length) out.push(boosted[bi++]);
      out.push(rest[i]);
    }
    while (bi < boosted.length) out.push(boosted[bi++]);
    return pinned.length > 0 ? pinned.concat(out.filter((p) => !spotlightIds.has(p.id))) : out;
  }, [sortedPosts, boostedIds, spotlightIds]);

  const recentlyViewed = useMemo(() => {
    return recents
      .map((r) => ({ entry: r, post: posts.find((p) => p.id === r.postId) }))
      .filter((x): x is { entry: { postId: string; viewedAt: number }; post: (typeof posts)[number] } => !!x.post)
      .filter((x) => !hiddenPostIds?.includes(x.post.id) && !mutedSellers?.includes(x.post.sellerUsername) && hasRealImage(x.post))
      .slice(0, 8);
  }, [recents, posts, hiddenPostIds, mutedSellers]);

  // IG-style hold-and-drag reveal: dragging right progressively slides the
  // camera/creation surface in from the left while the feed shrinks slightly.
  // Release past threshold -> complete into the real creator route; otherwise
  // spring back. Replaces the old instant fling navigation.
  const winW = Dimensions.get('window').width;
  const dragX = useRef(new Animated.Value(0)).current;
  const navLock = useRef(false);
  const revealX = dragX.interpolate({ inputRange: [0, 1], outputRange: [-winW, 0] });
  const feedScale = dragX.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const feedShift = dragX.interpolate({ inputRange: [0, 1], outputRange: [0, 44] });
  const onDragUpdate = ({ nativeEvent }: { nativeEvent: { translationX: number } }) => {
    if (nativeEvent.translationX > 0) dragX.setValue(Math.min(1, nativeEvent.translationX / winW));
  };
  const onDragEnd = ({ nativeEvent }: { nativeEvent: { state: number; translationX: number } }) => {
    const s = nativeEvent.state;
    if (s !== State.END && s !== State.CANCELLED) return;
    if (nativeEvent.translationX > winW * 0.3 && !navLock.current) {
      navLock.current = true;
      Animated.timing(dragX, { toValue: 1, duration: 130, useNativeDriver: true }).start(({ finished }) => {
        if (finished) router.push('/(tabs)/creator');
        setTimeout(() => {
          dragX.setValue(0);
          navLock.current = false;
        }, 400);
      });
    } else {
      Animated.spring(dragX, { toValue: 0, speed: 24, bounciness: 5, useNativeDriver: true }).start();
    }
  };

  return (
    <View className="flex-1 bg-surface">
      {/* IG pattern: hold + drag RIGHT anywhere on the feed -> progressive
          camera reveal; release completes into the creator surface. */}
      <PanGestureHandler
        activeOffsetX={30}
        failOffsetY={[-14, 14]}
        onGestureEvent={onDragUpdate}
        onHandlerStateChange={onDragEnd}
      >
      {/* Normal flex child (NOT absoluteFill) so it never overlaps the header;
          header lives INSIDE so the whole feed scales together like Instagram. */}
      <Animated.View
        style={[
          { flex: 1 },
          {
            transform: [{ scale: feedScale }, { translateX: feedShift }],
          },
        ]}
      >
      {/* Header — airier: taller bar + wider side padding + more icon gap */}
      <View
        className="flex-row items-center justify-between px-6"
        style={{ height: 64 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <Text className="font-inter-700" style={{ fontSize: 26, lineHeight: 32, color: colors.primary, letterSpacing: -0.5 }}>
          susej
        </Text>
        <View className="flex-row items-center" style={{ gap: 20 }}>
          <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Notifications">
            <BellIcon size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 10, bottom: 10, left:  10, right:  10 }} accessibilityLabel="Shopping cart" accessibilityRole="button">
            <View style={{ position: 'relative' }}>
              <BagIcon size={22} color={colors.primary} />
              {cartCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -9,
                    minWidth: 18,
                    height:  18,
                    borderRadius:  9,
                    paddingHorizontal: 4,
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
      </View>
      <FlatList
        data={feedList}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryContainer}
            colors={[colors.primaryContainer]}
          />
        }
        contentContainerStyle={{ paddingBottom: 96, paddingTop: 8 }}
        ListHeaderComponent={
          <View>
            {refreshFailed && (
              <View className="mx-5 mb-2 px-4 py-2.5 rounded-figma-12" style={{ backgroundColor: colors.errorContainer }}>
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.error }}>
                  Couldn&apos;t refresh — showing your saved feed. Pull to retry.
                </Text>
              </View>
            )}
            {/* Stories — Figma 223:30 ring style (gradient stroke 64, avatar 56, label 12, gap 16),
                but industry-practical: YOUR STORY first + 8 seller stories, horizontally scrollable,
                tray navigation in viewer (tap -> story -> next story automatically). */}
            <View style={{ paddingTop: 8, paddingBottom: 4 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-5"
                contentContainerStyle={{ gap: 14 }}
              >
                {/* Your Story (IG pattern): uploaded story gets a ring + preview; empty state = + tile.
                    SELLERS ONLY — buyers consume stories, they never see story-creation UI. */}
                {isSeller &&
                  (myStory ? (
                  <TouchableOpacity
                    className="items-center"
                    style={{ width: 68 }}
                    onPress={() =>
                      router.push({
                        pathname: '/story/me',
                        params: { mine: '1', tray: trayParam(trayUsernames), idx: '0' },
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
                    style={{ width: 68 }}
                    onPress={() => router.push('/(tabs)/creator?mode=story')}
                  >
                    <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                      <View className="w-[54px] h-[54px] rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLowest }}>
                        <PlusIcon size={18} color={colors.primaryContainer} />
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
                ))}

                {storyTray.map((story, idx) => (
                  <TouchableOpacity
                    key={story.username}
                    className="items-center"
                    style={{ width: 68 }}
                    onPress={() =>
                      router.push({
                        pathname: `/story/${story.username}`,
                        params: { tray: trayParam(trayUsernames), idx: String(idx) },
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
                        {story.avatar ? (
                          <Image source={imgSource(story.avatar)} className="w-[50px] h-[50px] rounded-full" />
                        ) : (
                          <Text className="font-inter-700" style={{ fontSize: 20, color: colors.primaryContainer }}>
                            {story.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
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

            {/* Shop by Category — airier rail */}
            <View className="mt-6">
              <Text className="px-6 text-figma-18 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.18 }}>
                Shop by Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerClassName="px-6"
                contentContainerStyle={{ gap: 14 }}
              >
                {/* 'For You' = personalized all-products page (interests / searches / watched / followed) */}
                <TouchableOpacity
                  className="w-[72px] h-[92px] rounded-figma-16 items-center justify-center"
                  style={{ backgroundColor: colors.surfaceContainerLow }}
                  onPress={() => router.push('/foryou')}
                >
                  <GridIcon size={16} color={colors.primary} />
                  <Text className="font-inter-500 text-primary mt-1" style={{ fontSize: 10, lineHeight: 13 }}>
                    For You
                  </Text>
                </TouchableOpacity>
                {worldCats.map((tile) => (
                  <TouchableOpacity
                    key={tile.slug}
                    className="w-[72px] h-[92px] rounded-figma-16 overflow-hidden"
                    onPress={() => router.push(`/category/${tile.slug}`)}
                  >
                    {tile.bannerImage ? (
                      <Image
                        source={{ uri: tile.bannerImage }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                        <Text className="font-inter-700" style={{ fontSize: 26, lineHeight: 32, color: colors.primary }}>
                          {tile.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                    <Text
                      className="absolute bottom-2 left-0 right-0 text-center font-inter-400 text-white"
                      style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.2 }}
                    >
                      {tile.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  className="w-[72px] h-[92px] rounded-figma-12 items-center justify-center"
                  onPress={() => router.push('/category')}
                >
                  <GridIcon size={16} color={colors.primary} />
                  <Text className="font-inter-400 text-primary mt-1" style={{ fontSize: 10, lineHeight: 13 }}>
                    All
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Marketing banner hero — REAL seller-uploaded banner image
                (seller dashboard → admin Marketing Banners). Size follows the
                seller's picked preset; tap opens that seller's shop. */}
            {hero && (() => {
              const W = Dimensions.get('window').width - 40;
              const imgH = hero.size === 'wide' ? Math.round((W * 9) / 16) : hero.size === 'tall' ? Math.round(Math.min((W * 5) / 4, 340)) : 160;
              // hero.imageUrl is already resolved to an absolute URL at fetch time.
              const bannerUri = hero.imageUrl;
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/seller/${hero.sellerUsername}`)}
                  className="mx-5 mt-4 rounded-figma-24 overflow-hidden bg-surfaceContainerLowest"
                  style={{ height: imgH + 16 }}
                >
                  <Image
                    source={{ uri: bannerUri }}
                    className="w-full"
                    style={{ height: imgH }}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['rgba(93,95,239,0.85)', 'rgba(93,95,239,0.05)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 0.6, y: 0.5 }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, height: imgH }}
                  />
                  <View className="absolute inset-0 justify-between" style={{ paddingTop: 18, paddingBottom: 30, paddingLeft: 24, paddingRight: 24 }}>
                    <Text className="font-inter-600 text-white" style={{ fontSize: 11, lineHeight: 13, letterSpacing: 1.4 }}>
                      {(hero.sellerName || hero.sellerUsername || '').toUpperCase()} · SPONSORED
                    </Text>
                    <View>
                      <Text className="font-inter-600 text-white" style={{ fontSize: 19, lineHeight: 24 }} numberOfLines={2}>
                        {hero.title}
                      </Text>
                      {hero.subtitle ? (
                        <Text className="font-inter-400 text-white" style={{ fontSize: 12, lineHeight: 16, marginTop: 2, opacity: 0.9 }} numberOfLines={1}>
                          {hero.subtitle}
                        </Text>
                      ) : null}
                      <View className="mt-4 items-center justify-center rounded-figma-full bg-white self-start px-5" style={{ height: 32 }}>
                        <Text className="font-inter-600 text-primary" style={{ fontSize: 14, lineHeight: 16 }}>
                          {hero.ctaLabel || 'View shop'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Top sellers — more breathing room */}
            {!authLoading && topSellerChips.length > 0 && (
              <View className="mt-6">
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
                  {topSellerChips.map((s) => {
                    // REAL data only: name/avatar/verified from the seller's posts,
                    // follower count from the server Follow table (0 when nobody follows yet).
                    const realFollowers = followerCounts[s.username] ?? 0;
                    return (
                    <View
                      key={s.username}
                      className="w-40 rounded-figma-16 bg-surfaceContainerLowest items-center p-2.5"
                      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                    >
                      <TouchableOpacity onPress={() => router.push(`/seller/${s.username}`)} className="items-center">
                        <View className="w-14 h-14 rounded-full bg-surfaceContainer items-center justify-center">
                          <Image
                            source={imgSource(s.avatar)}
                            className="w-14 h-14 rounded-full"
                          />
                          {s.verified && (
                            <View
                              className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-surfaceContainerLowest items-center justify-center"
                              style={{ borderWidth: 1, borderColor: colors.outlineVariant }}
                            >
                              <VerifiedIcon size={13} />
                            </View>
                          )}
                        </View>
                        <Text className="font-inter-600 text-textPrimary mt-2" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                          {s.name}
                        </Text>
                        {promotedSellers.has(s.username) && (
                          <View className="mt-0.5 px-1.5 py-px rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                            <Text className="font-inter-600" style={{ fontSize: 8, lineHeight: 10, letterSpacing: 0.4, color: colors.onPrimary }}>
                              TOP SELLER
                            </Text>
                          </View>
                        )}
                        <Text className="font-inter-400 text-secondary mt-0.5" style={{ fontSize: 9, lineHeight: 12 }}>
                          {realFollowers === 1 ? '1 follower' : `${formatFollowers(realFollowers)} followers`}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="mt-2 h-6 w-[136px] rounded-figma-10 items-center justify-center"
                        style={{
                          backgroundColor: isFollowing(s.username) ? colors.surfaceContainer : colors.primaryContainer,
                          borderWidth: isFollowing(s.username) ? 1 : 0,
                          borderColor: colors.outlineVariant,
                        }}
                        onPress={() => toggleFollow(s.username)}
                      >
                        <Text
                          className="font-inter-600"
                          style={{
                            fontSize: 12,
                            lineHeight: 15,
                            color: isFollowing(s.username) ? colors.textSecondary : '#FFFFFF',
                          }}
                        >
                          {isFollowing(s.username) ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Hot Deals — dedicated space, airier bottom gap to posts */}
            {dealsRail.length > 0 && (
            <View className="mt-6 mb-2">
              <View className="flex-row items-center px-6">
                <Text className="text-figma-20 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.2 }}>
                  Hot Deals
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerClassName="px-6"
                contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
              >
                {dealsRail.map((deal) => (
                  <TouchableOpacity
                    key={deal.id}
                    className="w-[169px] rounded-figma-24 bg-surfaceContainerLowest overflow-hidden"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
                    onPress={() => router.push(`/product/${deal.id}`)}
                  >
                    <View className="w-full bg-surfaceContainer" style={{ aspectRatio: 4 / 3 }}>
                      {deal.image ? (
                        <Image source={imgSource(deal.image)} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                            {deal.name?.split('\n')[0]?.slice(0, 24) || 'Hot deal'}
                          </Text>
                        </View>
                      )}
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
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleLike(deal.id);
                        }}
                      >
                        <HeartIcon
                          size={15}
                          color={typeof isLiked === 'function' && isLiked(deal.id) ? colors.error : colors.textPrimary}
                        />
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
                        {typeof deal.oldPrice === 'number' && deal.oldPrice > deal.price && (
                          <Text className="font-inter-400 text-secondary line-through" style={{ fontSize: 10, lineHeight: 14 }}>
                            {formatPrice(deal.oldPrice)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View className="pt-4">
            <ProductCard
              id={item.id}
              sellerName={item.sellerName}
              sellerUsername={item.sellerUsername}
              sellerLocation={item.sellerLocation}
              verified={item.verified}
              sponsored={boostedIds.has(item.id) || spotlightIds.has(item.id)}
              sponsoredLabel={spotlightIds.has(item.id) ? 'Spotlight' : 'Sponsored'}
              price={item.price}
              description={item.description}
              likes={item.likes}
              comments={item.comments}
              hashtags={item.hashtags}
              productImage={resolveListingImage(item, item.id)}
              sellerAvatar={resolveAvatar(item.sellerUsername)}
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
                    disabled={compareIds.length < 2}
                    onPress={() => {
                      if (compareIds.length >= 2) router.push(`/compare?ids=${compareIds.join(',')}`);
                    }}
                  >
                    <Text
                      className="text-figma-12 font-inter-600"
                      style={{ letterSpacing: 0.24, color: compareIds.length >= 2 ? colors.primaryContainer : colors.textTertiary }}
                    >
                      {compareIds.length >= 2
                        ? `Compare (${compareIds.length})`
                        : compareIds.length === 1
                          ? 'Select 1 more to compare'
                          : 'Compare'}
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
                    const image = post.image;
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
          !feedLoaded ? (
            <View className="pt-4">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : (
          <View className="items-center justify-center px-10 py-24">
            <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 15, lineHeight:  22 }}>
              Nothing here — follow sellers to fill your feed
            </Text>
            <TouchableOpacity className="mt-5 flex-row items-center h-11 px-6 rounded-figma-full" style={{ backgroundColor: colors.primaryContainer }} onPress={() => router.push('/explore')}>
              <PlusIcon size={14} color={colors.surfaceContainerLowest} />
              <Text className="font-inter-600 ml-2" style={{ fontSize: 13, lineHeight: 16, color: colors.surfaceContainerLowest }}>
                Follow suggestions
              </Text>
            </TouchableOpacity>
          </View>
          )
        }
        contentContainerClassName="pb-20"
        showsVerticalScrollIndicator={false}
      />
      </Animated.View>
      </PanGestureHandler>

      {/* Progressive-reveal preview of the creation surface - slides in from
          the left edge while dragging; pure visual, never intercepts touches. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000000', transform: [{ translateX: revealX }] },
        ]}
      >
        <View style={{ position: 'absolute', top: insets.top + 14, right: 24, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFFB3', fontSize: 22, lineHeight: 26 }}>✕</Text>
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF' }} />
          </View>
          <Text className="font-inter-600" style={{ color: '#FFFFFFB3', fontSize: 13, marginTop: 24, letterSpacing: 0.2 }}>
            Release to open the camera
          </Text>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
          {['POST', 'STORY', 'REEL', 'LIVE'].map((m) => (
            <Text key={m} className="font-inter-600" style={{ color: '#FFFFFF59', fontSize: 12, letterSpacing: 1.4 }}>
              {m}
            </Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
