import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, SearchIcon, BookmarkIcon, BellIcon, ChevronRightIcon } from '../utils/icons';
import { formatPrice, formatCount, colors } from '../utils/theme';
import { usePosts } from '../contexts/PostContext';
import { useCommunities } from '../contexts/CommunityContext';
import { useAuth } from '../contexts/AuthContext';
import { hasRealImage, resolveListingImage } from '../utils/productImages';

const RECENT_KEY_BASE = '@susej_recent_searches';
const SEARCHES_KEY_BASE = '@susej_saved_searches';

interface SavedSearch {
  id: string;
  query: string;
  savedAt: number;
  priceAlert: boolean;
}

type SearchTab = 'products' | 'sellers' | 'communities' | 'hashtags';
const searchTabs: { key: SearchTab; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'sellers', label: 'Sellers' },
  { key: 'communities', label: 'Communities' },
  { key: 'hashtags', label: 'Hashtags' },
];

interface SellerHit {
  sellerName: string;
  sellerUsername: string;
  sellerLocation: string;
  verified: boolean;
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q || '');
  const [tab, setTab] = useState<SearchTab>('products');
  const { posts, hiddenPostIds = [], mutedSellers = [], searchServer } = usePosts() as { posts: import('../contexts/PostContext').Post[]; hiddenPostIds?: string[]; mutedSellers?: string[]; searchServer: (q: string) => Promise<{ rows: unknown[]; ok: boolean }> };
  const { communities } = useCommunities();
  const { user } = useAuth();
  const recentKey = user?.username ? `${RECENT_KEY_BASE}:${user.username}` : RECENT_KEY_BASE;
  const searchesKey = user?.username ? `${SEARCHES_KEY_BASE}:${user.username}` : SEARCHES_KEY_BASE;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (q) {
      setQuery(q);
      addRecentSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const term = query.trim().toLowerCase();
  // Unicode NFC: composed vs decomposed forms of the same Indic/accented text
  // must match identically on both sides of every comparison below.
  const norm = (s: string) => (s ?? '').normalize('NFC').toLowerCase();
  const nterm = norm(term);

  // Cross-device search: the local filter above answers instantly from cache;
  // a debounced server query (title/desc/category/seller/hashtags, 100-cap)
  // merges hits from other devices into the cache, which then flow into the
  // same results. A failed server leg sets serverDown (honest "local results
  // only" notice) instead of presenting partial results as complete.
  const [serverSearching, setServerSearching] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  useEffect(() => {
    if (term.length < 2) {
      setServerSearching(false);
      setServerDown(false);
      return;
    }
    setServerSearching(true);
    const t = setTimeout(() => {
      searchServer(term)
        .then((r) => setServerDown(!r.ok))
        .catch(() => setServerDown(true))
        .finally(() => setServerSearching(false));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(recentKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data) as unknown;
            if (Array.isArray(parsed)) {
              setRecentSearches(parsed.filter((s): s is string => typeof s === 'string').slice(0, 8));
            } else {
              setRecentSearches([]);
            }
          } catch {}
        } else {
          setRecentSearches([]);
        }
      })
      .catch(() => { if (!cancelled) setRecentSearches([]); })
      .finally(() => { if (!cancelled) setRecentLoaded(true); });
    return () => { cancelled = true; };
  }, [recentKey]);

  const persistRecent = (next: string[]) => {
    setRecentSearches(next);
    AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => {});
  };

  const addRecentSearch = (raw: string) => {
    const termToSave = raw.trim();
    if (!termToSave) return;
    setRecentSearches((prev) => {
      const next = [termToSave, ...prev.filter((s) => s.toLowerCase() !== termToSave.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearRecentSearches = () => {
    persistRecent([]);
  };

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(searchesKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data) as SavedSearch[];
            if (Array.isArray(parsed)) setSavedSearches(parsed);
            else setSavedSearches([]);
          } catch {}
        } else {
          setSavedSearches([]);
        }
      })
      .catch(() => { if (!cancelled) setSavedSearches([]); });
    return () => { cancelled = true; };
  }, [searchesKey]);

  const isCurrentSaved = term.length > 0 && savedSearches.some((s) => s.query.toLowerCase() === term);

  const saveCurrentSearch = () => {
    const q = query.trim();
    if (!q || isCurrentSaved) return;
    // Random suffix: a double-tap used to mint twin `ss_<ms>` ids, breaking
    // keyExtractor + delete-by-id (saved-searches already suffixes).
    const entry: SavedSearch = { id: `ss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, query: q, savedAt: Date.now(), priceAlert: true };
    const next = [entry, ...savedSearches];
    setSavedSearches(next);
    AsyncStorage.setItem(searchesKey, JSON.stringify(next)).catch(() => {});
  };

  const matchResults = useMemo(() => {
    if (!nterm) return [];
    return posts.filter(
      (p) =>
        !hiddenPostIds.includes(p.id) &&
        !mutedSellers.includes(p.sellerUsername) &&
        (norm(p.title ?? '').includes(nterm) ||
          norm(p.description).includes(nterm) ||
          norm(p.category).includes(nterm) ||
          p.hashtags.some((h) => norm(h).includes(nterm)) ||
          norm(p.sellerName).includes(nterm) ||
          norm(p.sellerUsername).includes(nterm))
    );
  }, [posts, nterm, hiddenPostIds, mutedSellers]);

  // Product cards hide imageless listings (policy); the SELLERS tab must not
  // inherit that — a seller whose rows all lack photos is still a seller.
  const results = useMemo(() => matchResults.filter(hasRealImage), [matchResults]);

  const sellers = useMemo(() => {
    const seen = new Set<string>();
    const out: SellerHit[] = [];
    for (const p of matchResults) {
      const key = p.sellerUsername.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sellerName: p.sellerName, sellerUsername: p.sellerUsername, sellerLocation: p.sellerLocation, verified: p.verified });
    }
    return out;
  }, [matchResults]);

  const communityHits = useMemo(() => {
    if (!nterm) return [];
    return communities.filter(
      (c) =>
        norm(c.name).includes(nterm) ||
        norm(c.category).includes(nterm) ||
        norm(c.description ?? '').includes(nterm)
    );
  }, [communities, nterm]);

  // Hashtag counts respect moderation (hidden/muted never inflate a tag) and
  // memoize over the tag set (was O(T·P) per keystroke over all posts).
  const allTags = useMemo(() => {
    const seen = new Set<string>();
    for (const p of posts) {
      if (hiddenPostIds.includes(p.id) || mutedSellers.includes(p.sellerUsername)) continue;
      for (const h of p.hashtags) seen.add(h);
    }
    return Array.from(seen);
  }, [posts, hiddenPostIds, mutedSellers]);

  const hashtagHits = useMemo(() => {
    const tags = allTags.filter((t) => !nterm || norm(t).includes(nterm));
    return tags.map((t) => ({
      tag: t,
      count: posts.filter(
        (p) => !hiddenPostIds.includes(p.id) && !mutedSellers.includes(p.sellerUsername) && p.hashtags.includes(t)
      ).length,
    }));
  }, [allTags, posts, nterm, hiddenPostIds, mutedSellers]);

  const renderProductCard = ({ item }: { item: (typeof posts)[number] }) => (
    <TouchableOpacity
      className="flex-1 bg-surfaceContainerLowest rounded-figma-12 overflow-hidden mb-3"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <View className="w-full aspect-square bg-surfaceContainer">
        <Image source={resolveListingImage(item, item.id)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
      </View>
      <View className="p-3">
        <Text className="text-figma-13 font-inter-500 text-textPrimary mb-1" numberOfLines={2}>{(item.title?.trim() || item.description).split('#')[0].trim()}</Text>
        <Text className="text-figma-14 font-inter-700 text-primaryContainer">{formatPrice(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSellerRow = ({ item }: { item: SellerHit }) => (
    <TouchableOpacity
      className="flex-row items-center gap-3 py-3 border-b border-surfaceContainer"
      onPress={() => router.push(`/seller/${item.sellerUsername}`)}
    >
      <View className="w-11 h-11 rounded-figma-full bg-surfaceContainer items-center justify-center">
        <Text className="font-inter-600 text-primary" style={{ fontSize: 16, lineHeight: 20 }}>
          {item.sellerName.charAt(0)}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-figma-14 font-inter-600 text-textPrimary">{item.sellerName}</Text>
          {item.verified && (
            <Text className="text-figma-11 font-inter-500 text-white bg-tertiary rounded-figma-full px-2 py-0.5 overflow-hidden">
              Verified
            </Text>
          )}
        </View>
        <Text className="text-figma-12 font-inter-400 text-textSecondary mt-0.5">
          @{item.sellerUsername} · {item.sellerLocation}
        </Text>
      </View>
      <Text className="text-figma-12 font-inter-500 text-primary">View</Text>
    </TouchableOpacity>
  );

  const renderCommunityRow = ({ item }: { item: (typeof communities)[number] }) => (
    <TouchableOpacity
      className="flex-row items-center gap-3 py-3 border-b border-surfaceContainer"
      onPress={() => router.push(`/community/${item.id}`)}
    >
      <View className="w-11 h-11 rounded-figma-12 bg-primaryContainer items-center justify-center">
        <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 20 }}>
          {item.name.charAt(0)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-figma-14 font-inter-600 text-textPrimary">{item.name}</Text>
        <Text className="text-figma-12 font-inter-400 text-textSecondary mt-0.5">
          {item.category} · {formatCount(item.memberCount)} members
        </Text>
      </View>
      <Text className="text-figma-12 font-inter-500 text-primary">View</Text>
    </TouchableOpacity>
  );

  const renderHashtagRow = ({ item }: { item: { tag: string; count: number } }) => (
    <TouchableOpacity
      className="flex-row items-center gap-3 py-3 border-b border-surfaceContainer"
      onPress={() => router.push(`/hashtag/${item.tag.slice(1)}`)}
    >
      <View className="w-11 h-11 rounded-figma-full bg-surfaceContainerLow items-center justify-center">
        <Text className="font-inter-700 text-primaryContainer" style={{ fontSize: 14, lineHeight: 18 }}>#</Text>
      </View>
      <View className="flex-1">
        <Text className="text-figma-14 font-inter-600 text-textPrimary">{item.tag}</Text>
        <Text className="text-figma-12 font-inter-400 text-textSecondary mt-0.5">{item.count} posts</Text>
      </View>
      <Text className="text-figma-12 font-inter-500 text-primary">View</Text>
    </TouchableOpacity>
  );

  const renderEmpty = (message: string) => (
    <View className="items-center py-16 px-4">
      <Text className="text-figma-16 font-inter-500 text-textSecondary">{message}</Text>
      <Text className="text-figma-12 font-inter-400 text-secondary mt-2">Try a different search term</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center h-14 px-4 gap-3" style={{ height: 56 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primaryContainer} />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center h-11 px-4 bg-surfaceContainerLow rounded-figma-16">
          <SearchIcon size={16} color={colors.secondary} />
          <TextInput
            className="flex-1 ml-3 text-figma-14 font-inter-400 text-textPrimary"
            placeholder="Search products, sellers..."
            placeholderTextColor={colors.secondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => addRecentSearch(query)}
            autoFocus
          />
        </View>
        <TouchableOpacity
          className="w-11 h-11 items-center justify-center rounded-figma-full"
          style={{ backgroundColor: isCurrentSaved ? colors.primaryFixed : colors.surfaceContainerLow }}
          disabled={!query.trim() || isCurrentSaved}
          onPress={saveCurrentSearch}
        >
          <BookmarkIcon size={18} color={isCurrentSaved ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          className="w-11 h-11 items-center justify-center rounded-figma-full"
          style={{ backgroundColor: colors.surfaceContainerLow }}
          onPress={() => router.push('/saved-searches')}
        >
          <BellIcon size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {serverSearching && !!term && (
        <View className="px-4 pt-1.5">
          <Text className="text-figma-11 font-inter-400 text-secondary">Searching the marketplace…</Text>
        </View>
      )}
      {!serverSearching && serverDown && !!term && (
        <View className="px-4 pt-1.5">
          <Text className="text-figma-11 font-inter-400 text-secondary">Offline — showing listings saved on this device.</Text>
        </View>
      )}

      {!query ? (
        <View className="px-4 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-figma-16 font-inter-600 text-textPrimary">Recent Searches</Text>
            {recentSearches.length > 0 && (
              <TouchableOpacity onPress={clearRecentSearches} hitSlop={8}>
                <Text className="text-figma-12 font-inter-500 text-primary">Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentLoaded && recentSearches.length === 0 ? (
            <Text className="text-figma-14 font-inter-400 text-secondary py-3">No recent searches</Text>
          ) : (
            recentSearches.map((item) => (
              <TouchableOpacity key={item} className="py-3 border-b border-surfaceContainer" onPress={() => setQuery(item)}>
                <View className="flex-row items-center gap-3">
                  <SearchIcon size={14} color={colors.secondary} />
                  <Text className="text-figma-14 font-inter-400 text-textSecondary">{item}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            className="flex-row items-center justify-between py-3 mt-2"
            onPress={() => router.push('/saved-searches')}
          >
            <View className="flex-row items-center gap-3">
              <BellIcon size={14} color={colors.secondary} />
              <Text className="text-figma-14 font-inter-500 text-textPrimary">Saved searches & price alerts</Text>
            </View>
            <ChevronRightIcon size={16} color={colors.secondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View className="flex-row px-4 pt-3 pb-2 gap-2">
            {searchTabs.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  className={`px-4 py-2 rounded-figma-full ${active ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'}`}
                  onPress={() => setTab(t.key)}
                >
                  <Text className={`font-inter-600 ${active ? 'text-white' : 'text-textSecondary'}`} style={{ fontSize: 13, lineHeight: 16 }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'products' && (
            <FlatList
              key="products"
              data={results}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperClassName="gap-3"
              contentContainerClassName="px-4 pb-24 pt-3"
              contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
              renderItem={renderProductCard}
              ListEmptyComponent={renderEmpty(`No results for "${query}"`)}
            />
          )}

          {tab === 'sellers' && (
            <FlatList
              key="sellers"
              data={sellers}
              keyExtractor={(item) => item.sellerUsername}
              contentContainerClassName="px-4 pb-24 pt-3"
              contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
              renderItem={renderSellerRow}
              ListEmptyComponent={renderEmpty(`No sellers for "${query}"`)}
            />
          )}

          {tab === 'communities' && (
            <FlatList
              key="communities"
              data={communityHits}
              keyExtractor={(item) => item.id}
              contentContainerClassName="px-4 pb-24 pt-3"
              contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
              renderItem={renderCommunityRow}
              ListEmptyComponent={renderEmpty(`No communities for "${query}"`)}
            />
          )}

          {tab === 'hashtags' && (
            <FlatList
              key="hashtags"
              data={hashtagHits}
              keyExtractor={(item) => item.tag}
              contentContainerClassName="px-4 pb-24 pt-3"
              contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
              renderItem={renderHashtagRow}
              ListEmptyComponent={renderEmpty(`No hashtags for "${query}"`)}
            />
          )}
        </>
      )}
    </View>
  );
}
