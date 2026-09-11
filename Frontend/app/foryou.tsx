import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Keyboard, Dimensions, Image } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { usePosts } from '../contexts/PostContext';
import { useRecentlyViewed } from '../contexts/RecentlyViewedContext';
import { useFollow } from '../contexts/FollowContext';
import { useAuth } from '../contexts/AuthContext';
import { hasRealImage, resolveListingImage } from '../utils/productImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Post } from '../contexts/PostContext';

const RECENT_KEY_BASE = '@susej_recent_searches';

const { width } = Dimensions.get('window');
const CARD_W = (width - 40 - 14) / 2;

/**
 * "For You" - personalized all-products page.
 * Ranking signals (all real user data, no mocks):
 *  - followed sellers (FollowContext)
 *  - interests picked during onboarding (AuthContext.user.interests)
 *  - recent searches (@susej_recent_searches, same key as search.tsx)
 *  - recently viewed products + their categories (RecentlyViewedContext)
 */
export default function ForYouScreen() {
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();
  const { recents } = useRecentlyViewed();
  const { followedList } = useFollow();
  const { user } = useAuth();
  const recentKey = user?.username ? `${RECENT_KEY_BASE}:${user.username}` : RECENT_KEY_BASE;
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Read-only: viewing this page must not pollute the recent-searches list
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(recentKey)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setRecentSearches(arr.filter((s) => typeof s === 'string').slice(0, 6));
          else setRecentSearches([]);
        } catch {}
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recentKey]);

  const interests = useMemo(
    () => (user?.interests ?? []).map((i) => i.toLowerCase().trim()).filter(Boolean),
    [user?.interests]
  );

  const viewedPosts = useMemo(() => {
    const ids = new Set(recents.map((r) => r.postId));
    return posts.filter((p) => ids.has(p.id));
  }, [recents, posts]);

  const viewedCats = useMemo(
    () => new Set(viewedPosts.map((p) => p.category.toLowerCase().trim()).filter(Boolean)),
    [viewedPosts]
  );

  /** Score every post — imageless listings are penalized (hidden from buyers until fixed). */
  const scored = useMemo(() => {
    const followed = new Set(followedList);
    const searches = recentSearches.map((s) => s.toLowerCase().trim()).filter(Boolean);
    return posts.map((post) => {
      let score = 0;
      if (followed.has(post.sellerUsername)) score += 40;
      for (const interest of interests) {
        if (post.category.toLowerCase() === interest) score += 25;
        else if ((post.subCategories ?? []).some((s) => s.toLowerCase() === interest)) score += 15;
        if (post.hashtags.some((h) => h.toLowerCase().includes(interest))) score += 10;
      }
      for (const term of searches) {
        if (
          post.category.toLowerCase().includes(term) ||
          post.description.toLowerCase().includes(term) ||
          post.hashtags.some((h) => h.toLowerCase().includes(term))
        )
          score += 12;
      }
      if (post.category && viewedCats.has(post.category.toLowerCase())) score += 18;
      if (!hasRealImage(post)) score -= 1000;
      return { post, score };
    });
  }, [posts, followedList, interests, recentSearches, viewedCats]);

  /** Sections are mutually exclusive: a post appears in exactly one rail. Imageless never in For You (even for seller), only in seller dashboard under review. */
  const sections = useMemo(() => {
    const shown = new Set<string>();
    const canSee = (p: Post) => hasRealImage(p);

    const becauseYouViewed = viewedCats.size
      ? scored
          .filter(({ post }) => canSee(post) && !shown.has(post.id) && viewedCats.has(post.category.toLowerCase()) && !viewedPosts.some((v) => v.id === post.id))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
      : [];
    becauseYouViewed.forEach(({ post }) => shown.add(post.id));

    const followedSet = new Set(followedList);
    const fromFollowing = followedList.length
      ? scored
          .filter(({ post }) => canSee(post) && !shown.has(post.id) && followedSet.has(post.sellerUsername))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
      : [];
    fromFollowing.forEach(({ post }) => shown.add(post.id));

    const matchesSearches = recentSearches.length
      ? scored.filter(({ post, score }) => canSee(post) && !shown.has(post.id) && score >= 12).slice(0, 8)
      : [];
    matchesSearches.forEach(({ post }) => shown.add(post.id));

    const byInterest = interests.length
      ? scored
          .filter(({ post, score }) => canSee(post) && !shown.has(post.id) && score >= 15)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
      : [];
    byInterest.forEach(({ post }) => shown.add(post.id));

    // The personalized full catalog - every remaining product, best signal first (imageless excluded for buyers).
    const moreForYou = scored
      .filter(({ post }) => canSee(post) && !shown.has(post.id))
      .sort((a, b) => b.score - a.score)
      .map(({ post }) => post);

    return { becauseYouViewed, fromFollowing, matchesSearches, byInterest, moreForYou };
  }, [scored, viewedCats, viewedPosts, followedList, recentSearches, interests]);

  const isFresh = useMemo(
    () => recents.length === 0 && followedList.length === 0 && recentSearches.length === 0 && interests.length === 0,
    [recents, followedList, recentSearches, interests]
  );

  const renderGrid = (items: Post[]) => (
    <View className="flex-row flex-wrap" style={{ gap: 14, rowGap: 18 }}>
      {items.map((post) => {
        const img = resolveListingImage(post, post.id) as any;
        const src = img ? (typeof img === 'string' ? { uri: img } : img.uri ? img : null) : null;
        return (
          <TouchableOpacity key={post.id} style={{ width: CARD_W }} activeOpacity={0.9} onPress={() => router.push(`/product/${post.id}` as any)}>
            <View className="rounded-figma-16 overflow-hidden bg-surfaceContainerLowest" style={{ borderWidth: 1, borderColor: colors.outlineVariant }}>
              <View style={{ aspectRatio: 1, backgroundColor: colors.surfaceContainer }}>
                {src ? <Image source={src} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              </View>
              <View className="px-3 py-3" style={{ minHeight: 62 }}>
                <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }} numberOfLines={1}>{post.description.split('\n')[0]?.slice(0, 28) || post.sellerName}</Text>
                <Text className="font-inter-600 mt-1" style={{ fontSize: 13, color: colors.primary }}>{post.price ? `₹${post.price.toLocaleString('en-IN')}` : ''}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const SectionTitle = ({ children }: { children: string }) => (
    <Text className="px-5 text-figma-18 font-inter-600 text-textPrimary" style={{ letterSpacing: 0.18 }}>
      {children}
    </Text>
  );

  const EmptyNote = ({ children }: { children: string }) => (
    <View className="mx-5 rounded-figma-16 px-4 py-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
      <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 13, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} onTouchStart={Keyboard.dismiss}>
      {/* Header - mirrors category hub */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">For You</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {isFresh ? (
          <>
            {/* Fresh-user hero — clean, no backend jargon */}
            <View className="mx-5 mt-4 rounded-figma-24 px-6 py-6" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-600" style={{ fontSize: 18, lineHeight: 24, color: colors.textPrimary }}>You're new here — let's explore!</Text>
              <Text className="font-inter-400 mt-2" style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
                Follow sellers, open products and search — your For You will get smarter as you explore.
              </Text>
              <View className="flex-row mt-4" style={{ gap: 10 }}>
                <TouchableOpacity className="h-10 px-5 rounded-figma-full items-center justify-center" style={{ backgroundColor: colors.primary }} onPress={() => router.push('/category')}>
                  <Text className="font-inter-600" style={{ fontSize: 13, color: '#fff' }}>Browse categories</Text>
                </TouchableOpacity>
                <TouchableOpacity className="h-10 px-5 rounded-figma-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant }} onPress={() => router.push('/explore')}>
                  <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textPrimary }}>Explore</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View className="mt-6">
              <SectionTitle>Trending for you</SectionTitle>
              <View className="mt-3 px-5">
                {sections.moreForYou.length > 0 ? renderGrid(sections.moreForYou.slice(0, 10)) : <EmptyNote>No listings yet. Check back soon.</EmptyNote>}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Only show signals that actually have content — no empty placeholder rails */}
            {sections.becauseYouViewed.length > 0 && (
              <View className="mt-4">
                <SectionTitle>Because you viewed</SectionTitle>
                <View className="mt-2.5 px-5">{renderGrid(sections.becauseYouViewed.map((s) => s.post))}</View>
              </View>
            )}
            {sections.fromFollowing.length > 0 && (
              <View className="mt-5">
                <SectionTitle>From sellers you follow</SectionTitle>
                <View className="mt-2.5 px-5">{renderGrid(sections.fromFollowing.map((s) => s.post))}</View>
              </View>
            )}
            {sections.matchesSearches.length > 0 && (
              <View className="mt-5">
                <SectionTitle>Matches your searches</SectionTitle>
                <View className="mt-2.5 px-5">{renderGrid(sections.matchesSearches.map((s) => s.post))}</View>
              </View>
            )}
            {sections.byInterest.length > 0 && (
              <View className="mt-5">
                <SectionTitle>Based on your interests</SectionTitle>
                <View className="mt-2.5 px-5">{renderGrid(sections.byInterest.map((s) => s.post))}</View>
              </View>
            )}
            <View className="mt-6">
              <SectionTitle>{sections.becauseYouViewed.length + sections.fromFollowing.length + sections.matchesSearches.length + sections.byInterest.length > 0 ? 'More for you' : 'Popular picks'}</SectionTitle>
              <View className="mt-3 px-5">
                {sections.moreForYou.length > 0 ? renderGrid(sections.moreForYou) : <EmptyNote>No listings yet. Check back soon.</EmptyNote>}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
