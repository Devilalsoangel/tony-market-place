import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { ChevronLeftIcon, SearchIcon, PlusIcon, StarIcon, EyeIcon, PencilIcon, CheckIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostContext';
import { resolveListingImage, hasRealImage, listingTitle } from '../utils/productImages';
import { useNotifications } from '../contexts/NotificationContext';
import { useEffect, useRef } from 'react';
import { isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';

// My Listings Manager (Figma 245:1567) — status tabs, search, 4-action cards.
// Wired to PostContext: every card is the seller's real post, and the
// Top Deal / Sold / Delete actions persist through the context.

function TrashIcon({ size = 18, color = '#464555' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M9.5 7V5C9.5 4.45 9.95 4 10.5 4H13.5C14.05 4 14.5 4.45 14.5 5V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M6 7L6.8 18.5C6.86 19.35 7.56 20 8.4 20H15.6C16.44 20 17.14 19.35 17.2 18.5L18 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function RefreshIcon({ size = 18, color = '#464555' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 11C19.5 6.5 16 3.5 11.8 3.5C7.4 3.5 3.9 7 3.9 11.5C3.9 16 7.4 19.5 11.8 19.5C15.2 19.5 18 17.6 19.3 14.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M20 5.5V11H14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TABS = ['All', 'Active', 'Sold'] as const;

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function ListingsManagerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, deletePost, toggleSold } = usePosts();
  const { addNotification } = useNotifications();
  // Warned set persists per account: the old in-memory ref re-minted one
  // warning notification per imageless listing on EVERY cold start, forever.
  const warnedKey = user?.username ? `@susej_imageless_warned:${user.username}` : null;
  const warnedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!warnedKey) return;
    let alive = true;
    AsyncStorage.getItem(warnedKey).then((raw) => {
      if (!alive || !raw) return;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) warnedRef.current = new Set(arr.filter((x) => typeof x === 'string'));
      } catch {}
    }).catch(() => {});
    return () => { alive = false; };
  }, [warnedKey]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [category, setCategory] = useState('All Categories');
  const [query, setQuery] = useState('');

  // Logged-out fallback is '' (matches nobody): 'user' previously rendered
  // seller "user"'s listings to logged-out viewers (cross-account leak, C2).
  // Case-insensitive like seller-orders (server keeps exact casing, C3).
  const username = user?.username ?? '';
  const myPosts = useMemo(() => {
    const me = username.trim().toLowerCase();
    if (!me) return [];
    return posts.filter((p) => (p.sellerUsername ?? '').toLowerCase() === me);
  }, [posts, username]);

  // Industry standard: warn seller for imageless listings (no real image = not sellable)
  const imagelessIds = useMemo(() => myPosts.filter((p) => !hasRealImage(p)).map((p) => p.id), [myPosts]);

  useEffect(() => {
    let added = false;
    for (const p of myPosts) {
      if (!hasRealImage(p) && !warnedRef.current.has(p.id)) {
        warnedRef.current.add(p.id);
        added = true;
        const title = listingTitle(p, 'your listing').slice(0, 32);
        addNotification({
          type: 'warning',
          userName: 'susej',
          action: `⚠ Your listing "${title}" has no image and is hidden from buyers. Add an image to make it visible.`,
          targetId: p.id,
        });
      }
    }
    if (added && warnedKey) {
      AsyncStorage.setItem(warnedKey, JSON.stringify([...warnedRef.current])).catch(() => {});
    }
  }, [myPosts, addNotification, warnedKey]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of myPosts) if (p.category) set.add(p.category);
    return ['All Categories', ...set];
  }, [myPosts]);

  const filtered = myPosts.filter((l) => {
    if (tab === 'Active' && l.isSold) return false;
    if (tab === 'Sold' && !l.isSold) return false;
    if (category !== 'All Categories' && l.category !== category) return false;
    if (query) {
      const title = listingTitle(l).toLowerCase();
      if (!title.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const activeCount = myPosts.filter((l) => !l.isSold).length;
  const soldCount = myPosts.filter((l) => l.isSold).length;

  const openBoost = () => {
    // Featuring is a PAID placement owned by the Promotions engine — the
    // server deliberately ignores author-set featured flags, so a local star
    // only lied to this device. Route to the real paid flow instead.
    router.push('/promotions');
  };

  const removeListing = (id: string, title: string) => {
    Alert.alert('Delete listing', `"${title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(id) },
    ]);
  };

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="My listings" user={user} />;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 54 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 17, lineHeight: 22 }}>
            My Listings
          </Text>
        </View>
        <TouchableOpacity className="flex-row items-center" onPress={() => router.push('/(tabs)/create')}>
          <PlusIcon size={14} color={colors.primary} />
          <Text className="font-inter-600 text-primary ml-0.5" style={{ fontSize: 14, lineHeight: 18 }}>
            New
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        {/* Search */}
        <View className="mx-5 flex-row items-center px-4" style={{ height: 50, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
          <SearchIcon size={20} color={colors.secondary} />
          <TextInput
            className="flex-1 ml-2 font-inter-400 text-textPrimary"
            style={{ fontSize: 14 }}
            placeholder="Search listings..."
            placeholderTextColor={colors.secondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* Status tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, marginTop: 16 }}>
          {TABS.map((t) => {
            const on = tab === t;
            const activeTab = t === 'Active';
            const count = t === 'All' ? myPosts.length : t === 'Active' ? activeCount : soldCount;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                className="flex-row items-center px-4 h-9 rounded-full"
                style={{
                  backgroundColor: on ? colors.primaryContainer : activeTab ? colors.surfaceContainerLowest : 'transparent',
                  borderWidth: on ? 0 : 1,
                  borderColor: colors.outlineVariant,
                }}
              >
                {activeTab && (
                  <View className="mr-1.5" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? '#ffffff' : '#22c55e' }} />
                )}
                <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : activeTab ? '#22c55e' : colors.textSecondary }}>
                  {t}
                </Text>
                <View className="ml-1.5 px-1.5 rounded-full" style={{ backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.surfaceContainerLow }}>
                  <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 14, color: on ? colors.onPrimary : colors.textSecondary }}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category filter — outlined capsules */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, marginTop: 14 }}>
          {categories.map((c) => {
            const on = category === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                className="px-4 h-9 rounded-full items-center justify-center"
                style={{
                  backgroundColor: on ? colors.primaryContainer : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? colors.primaryContainer : colors.outlineVariant,
                }}
              >
                <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : colors.textSecondary }}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Seller warning banner for imageless listings */}
        {imagelessIds.length > 0 && (
          <View className="mx-5 mt-3 rounded-figma-16 px-4 py-3 flex-row items-center" style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: colors.error }}>
            <Text className="font-inter-600" style={{ fontSize: 13, color: colors.error }}>⚠ {imagelessIds.length} listing{imagelessIds.length > 1 ? 's' : ''} without image — hidden from buyers until you add an image.</Text>
          </View>
        )}

        {/* Listing cards */}
        <View className="mx-5 mt-4" style={{ gap: 12 }}>
          {filtered.length === 0 && (
            <View className="items-center py-12 px-6 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 22 }}>
                No listings here
              </Text>
              <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 13, lineHeight: 19 }}>
                {myPosts.length === 0
                  ? 'Create your first post to start selling.'
                  : 'Nothing matches this filter — try another tab or search.'}
              </Text>
              <TouchableOpacity
                className="mt-4 px-5 h-10 rounded-figma-12 items-center justify-center"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={() => router.push('/(tabs)/create')}
              >
                <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.onPrimary }}>
                  + New Listing
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {filtered.map((l) => {
            const title = listingTitle(l);
            const img = resolveListingImage(l, l.id);
            const noImage = !hasRealImage(l);
            return (
              <View
                key={l.id}
                className="p-3 rounded-figma-20"
                style={{
                  backgroundColor: colors.surfaceContainerLowest,
                  borderWidth: noImage ? 2 : 1,
                  borderColor: noImage ? colors.error : colors.outlineVariant,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  elevation: 1,
                }}
              >
                <TouchableOpacity className="flex-row" activeOpacity={0.8} onPress={() => router.push(`/product/${l.id}`)}>
                  <View>
                    <Image
                      source={img}
                      style={{ width: 92, height: 92, borderRadius: 14 }}
                      resizeMode="cover"
                    />
                    {l.isSold && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(47,46,67,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text className="font-inter-700" style={{ fontSize: 15, letterSpacing: 2.5, color: '#ffffff', transform: [{ rotate: '-12deg' }] }}>
                          SOLD
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row">
                      <Text className="flex-1 font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text className="font-inter-700 text-primary ml-2" style={{ fontSize: 15, lineHeight: 20 }}>
                        {formatPrice(l.price)}
                      </Text>
                    </View>
                    <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 12, lineHeight: 16 }}>
                      {l.category ? `${l.category} · ` : ''}{l.isSold ? 'Sold' : 'Active'} · {timeAgo(l.createdAt)}
                    </Text>
                    <View className="flex-row mt-2 flex-wrap" style={{ gap: 6 }}>
                      {noImage && (
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: colors.error }}>
                          <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: colors.error }}>
                            ⚠ No image — hidden from buyers
                          </Text>
                        </View>
                      )}
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: l.isSold ? colors.surfaceContainer : colors.surfaceContainerLow }}>
                        <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 12, color: l.isSold ? colors.secondary : '#22c55e' }}>
                          {l.isSold ? 'Sold Out' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    {noImage && (
                      <TouchableOpacity className="mt-2 self-start px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.primary }} onPress={() => router.push(`/edit-listing/${l.id}`)}>
                        <Text className="font-inter-600" style={{ fontSize: 11, color: '#fff' }}>Add image</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {/* 4-cell action toolbar */}
                <View className="flex-row mt-3" style={{ borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
                  <TouchableOpacity
                    className="flex-1 items-center py-2.5"
                    accessibilityRole="button"
                    accessibilityLabel="Boost listing with a paid promotion"
                    onPress={openBoost}
                  >
                    <StarIcon size={16} color={colors.textSecondary} />
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                      Boost
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center py-2.5"
                    style={{ borderLeftWidth: 1, borderLeftColor: colors.surfaceContainer }}
                    accessibilityRole="button"
                    accessibilityLabel={`View listing ${l.id}`}
                    onPress={() => router.push(`/product/${l.id}`)}
                  >
                    <EyeIcon size={16} color={colors.textSecondary} />
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                      View
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center py-2.5"
                    style={{ borderLeftWidth: 1, borderLeftColor: colors.surfaceContainer }}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit listing ${l.id}`}
                    onPress={() => router.push(`/edit-listing/${l.id}`)}
                  >
                    <PencilIcon size={16} color={colors.textSecondary} />
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center py-2.5"
                    style={{ borderLeftWidth: 1, borderLeftColor: colors.surfaceContainer }}
                    accessibilityRole="button"
                    accessibilityLabel={l.isSold ? 'Restock listing' : 'Mark as sold'}
                    onPress={() => { void toggleSold(l.id).then((ok) => { if (!ok) Alert.alert('Not saved', 'Check your connection — the listing was restored.'); }); }}
                  >
                    {l.isSold ? (
                      <RefreshIcon size={16} color={colors.primary} />
                    ) : (
                      <CheckIcon size={16} color={colors.textSecondary} />
                    )}
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: l.isSold ? colors.primary : colors.textSecondary }}>
                      {l.isSold ? 'Restock' : 'Sold'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center py-2.5"
                    style={{ borderLeftWidth: 1, borderLeftColor: colors.surfaceContainer }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete listing"
                    onPress={() => removeListing(l.id, title)}
                  >
                    <TrashIcon size={16} color={colors.error} />
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.error }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating summary pill */}
      <View
        className="absolute right-5 rounded-full px-4 py-2.5"
        style={{
          bottom: insets.bottom + 24,
          backgroundColor: colors.primaryContainer,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        }}
        pointerEvents="none"
      >
        <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: '#ffffff' }}>
          ● {activeCount} active · {soldCount} sold
        </Text>
      </View>
    </View>
  );
}
