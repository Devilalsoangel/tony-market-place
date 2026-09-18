import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { resolveAvatar } from '../../utils/productImages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadStoreTheme } from '../../utils/sellerUnlocks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerifiedIcon, ChevronLeftIcon, MoreIcon, StarIcon, MapPinIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useFollow } from '../../contexts/FollowContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePosts } from '../../contexts/PostContext';
import { resolveListingImage } from '../../utils/productImages';
import { generateShopProfile } from '../../utils/storefronts';
import type { ShopProfile, StorefrontArchetype, ListingItem, BulkProduct, StorefrontChip } from '../../utils/storefronts';
import { getFlow } from '../../utils/categoryFlow';
import { getChildCategories, findMainCategory } from '../../utils/categories';
import { serverApi } from '../../utils/serverApi';
import {
  ChipRail,
  StoreAccentProvider,
  useStoreAccent,
  StatsBar,
  DealsRail,
  MenuListSection,
  TrendingRail,
  ServiceCategoryGrid,
  ServicesListSection,
  JobListSection,
  BulkDealsRail,
  EmptyStorefront,
  AboutSection,
  SectionTitle,
  StatusBadge,
  StickyActionBar,
  ReviewsSection,
} from '../../components/StorefrontSections';
import type { StorefrontReview } from '../../components/StorefrontSections';

const BLOCKED_KEY_BASE = '@susej_blocked';
const BLOCKED_KEY = BLOCKED_KEY_BASE;
const SELLERS_REGISTRY_KEY = '@susej_sellers';

interface BlockedUser {
  username: string;
  name?: string;
}

// Reviews live in the TOP tab column right next to Products (user mandate,
// Aug 25) - not a buried bottom section. Real post-delivery buyer reviews
// from the server Review table only; anonymous ones show 'Anonymous'.
const ARCHETYPE_TABS: Record<StorefrontArchetype, string[]> = {
  goods: ['Products', 'Reviews'],
  food: ['Menu', 'Reviews'],
  service: ['Services', 'Reviews', 'About'],
  job: ['Jobs', 'Reviews', 'About'],
  realestate: ['Listings', 'Reviews', 'About'],
  b2b: ['Products', 'Reviews', 'About'],
  empty: ['Products', 'Reviews'],
};

const ARCHETYPE_FLOW_CAT: Record<StorefrontArchetype, string> = {
  goods: 'fashion',
  food: 'food',
  service: 'beauty',
  job: 'job',
  realestate: 'realEstate',
  b2b: 'b2b',
  empty: 'fashion',
};

// Main category each storefront archetype maps to (for the child-category
// filter fallback when a shop has no explicit chips).
const ARCHETYPE_MAIN_CAT: Record<StorefrontArchetype, string> = {
  goods: 'fashion',
  food: 'food',
  service: 'beauty',
  job: 'job',
  realestate: 'realEstate',
  b2b: 'b2b',
  empty: '',
};

type ChipIcon = 'verified' | 'clock' | 'pin';

interface GridCard {
  id: string;
  title: string;
  price: number;
  priceText?: string;
  image?: any;
  tag?: string;
  metaLines?: string[];
}

function ProductGrid({ items, actionLabel, onAction, onPress }: { items: GridCard[]; actionLabel?: string; onAction?: (id: string) => void; onPress?: (id: string) => void }) {
  const accent = useStoreAccent();
  return (
    <View className="flex-row flex-wrap mx-5" style={{ gap: 12 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          className="overflow-hidden"
          style={{
            width: (392 - 40 - 12) / 2,
            borderRadius: 24,
            // One strong theme signature per GPT re-verdict: tinted card
            // surface + hairline reads as "Emerald storefront" on scroll.
            backgroundColor: accent ? `${accent}0D` : colors.surfaceContainerLowest,
            borderWidth: accent ? 1 : 0,
            borderColor: accent ? `${accent}40` : 'transparent',
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
          activeOpacity={0.85}
          onPress={() => onPress?.(item.id)}
        >
          <View style={{ width: '100%', aspectRatio: 1 }}>
            {item.image ? (
              <Image source={item.image} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="w-full h-full" style={{ backgroundColor: colors.surfaceContainer }} />
            )}
            {item.tag ? (
              <View className="absolute top-2 left-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: accent ?? colors.primaryContainer }}>
                <Text className="font-inter-600 text-white" style={{ fontSize: 10, lineHeight: 14 }}>
                  {item.tag}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="px-3 pt-2.5 pb-3">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }} numberOfLines={1}>
              {item.title}
            </Text>
            {item.metaLines?.map((line) => (
              <Text key={line} className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={1}>
                {line}
              </Text>
            ))}
            <Text className="font-inter-700 mt-1" style={{ fontSize: 16, lineHeight: 20, color: accent ?? colors.textPrimary }}>
              {item.priceText ?? formatPrice(item.price)}
            </Text>
            {actionLabel ? (
              <TouchableOpacity
                className="mt-2 items-center justify-center"
                style={{ height: 32, borderRadius: 12, backgroundColor: accent ?? colors.primaryContainer }}
                onPress={() => onAction?.(item.id)}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 16 }}>
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SellerProfileScreen() {
  const p = useLocalSearchParams<{ username: string | string[] }>();
  const username = Array.isArray(p.username) ? p.username[0] : p.username;
  const insets = useSafeAreaInsets();
  const { isFollowing, toggleFollow } = useFollow();
  const following = isFollowing(username || '');
  const { posts } = usePosts();

  // Approved-seller registry (@susej_sellers, written by become-seller) so a
  // seller with zero posts still routes to the storefront, never the insta view.
  const [sellers, setSellers] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SELLERS_REGISTRY_KEY)
      .then((raw) => {
        if (!live) return;
        try {
          setSellers(raw ? (JSON.parse(raw) as string[]) : []);
        } catch {
          setSellers([]);
        }
      })
      .catch(() => live && setSellers([]));
    return () => {
      live = false;
    };
  }, []);

  const sellerInfo = { name: username || 'Seller', verified: false, bio: '' };

  const sellerPosts = useMemo(() => {
    if (!username) return [];
    return posts.filter((p) => p.sellerUsername.toLowerCase() === username.toLowerCase());
  }, [posts, username]);

  // Derive the storefront from the seller's REAL categories. Primary key =
  // the seller's own raw post.category labels (server taxonomy); the client
  // CATEGORY_TREE mapping is only an enhancement - when it cannot resolve
  // (e.g. "Furniture"), we still render the seller's actual label and never
  // fall back to a fabricated default like Fashion.
  const rawCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of sellerPosts) {
      const raw = typeof p?.category === 'string' ? p.category.trim() : '';
      if (raw.length > 0) counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [sellerPosts]);

  if (rawCategories.length > 0 || sellerPosts.length > 0 || isRegisteredSellerCheck(sellers, username)) {
    if (sellers === null && rawCategories.length === 0 && sellerPosts.length === 0) return null;
    // Top raw label wins ("Furniture"); mapped id only refines the archetype.
    const topRaw = rawCategories[0];
    const mappedNode = findMainCategory(topRaw);
    const topCategory = mappedNode?.id ?? '';
    const mainLabel = mappedNode?.label ?? topRaw;
    const generated = generateShopProfile(username || '', topCategory, username || 'Seller', sellerPosts, mainLabel);
    return <StorefrontRoute username={username || ''} profile={generated} following={following} toggleFollow={() => toggleFollow(username || '')} sellerPosts={sellerPosts} insets={insets} />;
  }

  // Everyone else is a regular user (no posts, no store). Instagram-style
  // profile: followable, but users cannot post — always zero posts.
  return <UserProfile username={username} sellerInfo={sellerInfo} following={following} toggleFollow={() => toggleFollow(username || '')} insets={insets} />;
}

function isRegisteredSellerCheck(sellers: string[] | null, username: string | undefined): boolean {
  return (sellers ?? []).includes((username || '').toLowerCase());
}

/** File a REAL user report (support ticket): the old button fabricated a
 *  success alert while persisting nothing — a safety feature that filed
 *  nothing. This lands in the admin Support queue with an opener message. */
async function fileUserReport(username: string): Promise<void> {
  try {
    const m = await import('../../utils/adminSync');
    const ok = await m.syncTicket({
      id: `SJ-TK-1${Date.now().toString().slice(-7)}`,
      subject: `User report: @${username}`,
      priority: 'high',
      status: 'open',
      createdAt: new Date().toISOString(),
      messageText: `Reported @${username} from their profile.`,
    });
    Alert.alert(
      ok ? 'Report sent' : 'Report not sent',
      ok ? 'Our team will review this report.' : 'Could not reach the server — please try again later.'
    );
  } catch {
    Alert.alert('Report not sent', 'Could not reach the server — please try again later.');
  }
}

function StorefrontRoute({
  username,
  profile,
  following,
  toggleFollow,
  sellerPosts,
  insets,
}: {
  username: string;
  profile: ShopProfile;
  following: boolean;
  toggleFollow: () => void;
  sellerPosts: any[];
  insets: any;
}) {
  const [activeTab, setActiveTab] = useState<string>(ARCHETYPE_TABS[profile.archetype][0]);
  const [activeChip, setActiveChip] = useState('all');
  // Real post-delivery reviews for the storefront Reviews section (all visitors).
  const [storeReviews, setStoreReviews] = useState<StorefrontReview[]>([]);
  const { user } = useAuth();
  const flow = getFlow(ARCHETYPE_FLOW_CAT[profile.archetype]);
  const primaryCta = flow.primaryCta;

  // REAL metrics from the server (Follow table / Review rows / delivered orders).
  const [realStats, setRealStats] = useState<{
    followers: number;
    avgRating: number;
    reviewCount: number;
    soldUnits: number;
    verified: boolean;
    name?: string;
    businessName?: string;
    bio?: string;
    location?: string;
  } | null>(null);
  useEffect(() => {
    if (!username) return;
    let alive = true;
    serverApi
      .getUserProfile(username)
      .then((res) => {
        if (alive && res.ok && res.data) {
          const u = res.data.user;
          setRealStats({
            followers: u.followers,
            avgRating: u.avgRating ?? 0,
            reviewCount: u.reviewCount ?? 0,
            soldUnits: u.soldUnits ?? 0,
            verified: u.verification === 'approved',
            name: typeof u.name === 'string' ? u.name : undefined,
            businessName: typeof u.businessName === 'string' ? u.businessName : undefined,
            bio: typeof u.bio === 'string' ? u.bio : undefined,
            location: typeof u.location === 'string' ? u.location : undefined,
          });
          const rs = Array.isArray(res.data.reviews) ? res.data.reviews : [];
          setStoreReviews(
            rs.map((r) => ({
              id: String(r.id),
              reviewer: String(r.reviewer || 'Verified buyer'),
              rating: Number(r.rating) || 0,
              comment: r.text ? String(r.text) : undefined,
              time: new Date(Number(r.createdAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [username]);

  const fmtCompact = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  const displayStats = useMemo(() => {
    if (!realStats) return profile.stats;
    return profile.stats.map((s) => {
      const label = s.label.toLowerCase();
      if (label === 'followers') return { ...s, value: fmtCompact(realStats.followers) };
      if (label.includes('review')) return { ...s, value: `${realStats.reviewCount} Reviews` };
      if (label.includes('sold')) return { ...s, value: fmtCompact(realStats.soldUnits) };
      if (label === 'rating') {
        return {
          ...s,
          value: realStats.avgRating > 0 ? String(Math.round(realStats.avgRating * 10) / 10) : '\u2014',
        };
      }
      return s;
    });
  }, [profile.stats, realStats]);

  // Identity from the server when available. Business name wins over the raw
  // signup display name so the storefront matches feed/product surfaces
  // exactly (same seller, same name everywhere).
  const displayName =
    realStats?.businessName?.trim() || realStats?.name?.trim() || profile.name;
  const displayBio = realStats?.bio?.trim() ? realStats.bio : profile.bio;

  // Own-store customization overrides (from the seller editors): customized
  // sub-category filters only apply to the logged-in user's own shop so
  // seeded storefronts are never polluted. Banners are per-seller data and
  // load for EVERY viewer - a storefront banner set up in the seller
  // dashboard is public marketing (audit fix Aug 24).
  const isOwnStore = !!user?.username && username === user.username;
  const [ownChildren, setOwnChildren] = useState<string[] | null>(null);
  const [ownBanners, setOwnBanners] = useState<{ id: string; title: string; sub?: string; image?: any; cta?: string }[] | null>(null);
  // Seller Pro theme accent — null = brand default violet.
  const [themeAccent, setThemeAccent] = useState<string | null>(null);
  // Seller Pro status: any purchased unlock (analytics/theme) shows the PRO
  // pill on the public storefront - a visible marker of the paid tier
  // (user: theme must be WORTH the money, Aug 25).
  const [isProStore, setIsProStore] = useState(false);
  const [themeName, setThemeName] = useState<string | null>(null);
  const [themeSoft, setThemeSoft] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isOwnStore) {
          const catKey = `@susej_store_categories:${username}`;
          let catRaw: string | null = await AsyncStorage.getItem(catKey);
          if (!catRaw) {
            const legacy = await AsyncStorage.getItem('@susej_store_categories');
            if (legacy) {
              catRaw = legacy;
              try { await AsyncStorage.setItem(catKey, legacy); } catch {}
            }
          }
          if (alive && catRaw) {
            const parsed = JSON.parse(catRaw);
            if (parsed && Array.isArray(parsed.children) && parsed.children.length > 0) setOwnChildren(parsed.children);
          }
        }
        const bRaw = await AsyncStorage.getItem(`@susej_store_banners:${username}`);
        if (alive && bRaw) {
          const parsed = JSON.parse(bRaw);
          if (Array.isArray(parsed) && parsed.length > 0) setOwnBanners(parsed);
        }
        // Cross-device truth: the seller's banners live on the server (the
        // editor syncs them there). Viewer-device storage is fallback only —
        // without this, buyers on any other phone never saw the banners.
        try {
          const res = await serverApi.getStorefrontBanners(username || '');
          const rows = res.ok && res.data ? res.data.banners ?? [] : [];
          if (alive && rows.length > 0) {
            const { getAdminUrl } = await import('../../utils/adminSync');
            const base = await getAdminUrl().catch(() => '');
            setOwnBanners(
              rows.map((b) => ({
                id: String(b.id),
                title: String(b.title ?? ''),
                sub: b.subtitle ? String(b.subtitle) : undefined,
                cta: b.ctaLabel ? String(b.ctaLabel) : undefined,
                image: b.imageUrl
                  ? { uri: /^https?:/i.test(b.imageUrl) ? b.imageUrl : `${base}${b.imageUrl}` }
                  : undefined,
              }))
            );
          }
        } catch {}
        const theme = await loadStoreTheme(username);
        if (alive) {
          setThemeAccent(theme.id === 'violet' ? null : theme.accent);
          setThemeName(theme.id === 'violet' ? null : theme.name);
          setThemeSoft(theme.id === 'violet' || !theme.accentSoft ? null : theme.accentSoft);
          // A non-default accent IS the pro look now — themes are free
          // personalization, so no separate entitlement read anymore.
          setIsProStore(theme.id !== 'violet');
        }
      } catch {
        // ignore - fall back to profile defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOwnStore, username]);

  const filterChips = useMemo<StorefrontChip[]>(() => {
    if (ownChildren && ownChildren.length > 0) {
      return [{ id: 'all', label: 'All' }, ...ownChildren.map((c) => ({ id: c, label: c }))];
    }
    const explicit = profile.chips.length > 0 ? profile.chips : profile.jobFilters || profile.listingTypes || profile.categoryFilter;
    if (explicit && explicit.length > 0) return explicit;
    const mainId = ARCHETYPE_MAIN_CAT[profile.archetype];
    const children = mainId ? getChildCategories(mainId) : [];
    if (children.length > 0 && profile.archetype !== 'goods') {
      return [{ id: 'all', label: 'All' }, ...children.map((c) => ({ id: c, label: c }))];
    }
    // Goods sellers with an unmapped category (e.g. "Furniture"): filter by
    // the seller's OWN category labels - never a fabricated default rail.
    const ownCats = [...new Set(sellerPosts.map((p) => (typeof p?.category === 'string' ? p.category.trim() : '')).filter(Boolean))];
    return ownCats.length > 0
      ? [{ id: 'all', label: 'All' }, ...ownCats.map((c) => ({ id: c, label: c }))]
      : [];
  }, [profile, ownChildren, sellerPosts]);

  // Banners the seller actually created in the storefront editor, keyed per
  // seller. Template-generated promo banners are fabrication - never shown.
  const storeBanners = ownBanners && ownBanners.length > 0 ? ownBanners : [];

  const matchesChip = (haystack: string) => {
    if (activeChip === 'all') return true;
    return haystack.toLowerCase().includes(activeChip.toLowerCase());
  };

  const gridItems = useMemo<GridCard[]>(() => {
    if (sellerPosts.length > 0) {
      return sellerPosts.map((post) => ({
        id: post.id,
        title: (post.description || '').split('\n')[0],
        price: post.price || 0,
        image: post.image ? { uri: post.image } : resolveListingImage(post, post.id),
        metaLines: post.category ? [post.category] : undefined,
      }));
    }
    return (profile.deals || []).map((d) => ({
      id: d.id,
      title: d.title,
      price: d.price,
      image: d.image,
      tag: d.tag,
    }));
  }, [sellerPosts, profile.deals]);

  const listingItems = useMemo<GridCard[]>(
    () =>
      (profile.listings || []).map((l: ListingItem) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        priceText: formatPrice(l.price),
        image: l.image,
        tag: l.tag,
        metaLines: [
          // Only real specs — hide the row entirely when unknown
          l.beds > 0 || l.baths > 0 || l.sqft > 0
            ? `${l.beds > 0 ? `${l.beds} Beds \u00B7 ` : ''}${l.baths > 0 ? `${l.baths} Baths \u00B7 ` : ''}${l.sqft > 0 ? `${l.sqft} sq.ft` : ''}`.replace(/ \u00B7 $/, '')
            : '',
          l.locality,
        ].filter((s) => s.length > 0),
      })),
    [profile.listings]
  );

  const bulkImages = useMemo(() => {
    const map: Record<string, any> = {};
    (profile.bulkDeals || []).forEach((d) => {
      map[d.title] = d.image;
    });
    return map;
  }, [profile.bulkDeals]);

  const bulkItems = useMemo<GridCard[]>(
    () =>
      (profile.bulkProducts || []).map((b: BulkProduct) => ({
        id: b.id,
        title: b.name,
        price: b.price,
        priceText: `${formatPrice(b.price)}${b.unit || ''}`,
        image: bulkImages[b.name],
        tag: b.tag,
        metaLines: [b.moq].filter((s) => s && s.length > 0),
      })),
    [profile.bulkProducts, bulkImages]
  );

  const chatWithSeller = (msg?: string) => {
    router.push({ pathname: '/chat', params: msg ? { to: username, msg } : { to: username } });
  };

  const handleCta = (label: string, itemId?: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('buy now')) {
      // Buy Now: open the TAPPED product (itemId), not the first one —
      // tapping Buy on product #2 bought product #1.
      const target =
        (itemId && sellerPosts.find((p) => String(p?.id) === String(itemId))) || sellerPosts[0];
      if (target) {
        router.push(`/product/${target.id}`);
      } else {
        chatWithSeller(`Hi! I'd like to buy from your shop. What's available?`);
      }
      return;
    }
    if (lower.includes('book')) {
      // Booking needs a REAL service listing (book-service fail-closes
      // without listingId): carry the seller's first service row; sellers
      // with no service listing fall back to chat instead of a dead wall.
      const svc = sellerPosts.find((p) => (p as { type?: string })?.type === 'service') ?? sellerPosts[0];
      if (svc) {
        const t = (svc as { title?: string })?.title ?? '';
        router.push(`/book-service?listingId=${encodeURIComponent(String(svc.id))}${t ? `&title=${encodeURIComponent(t)}` : ''}`);
      } else {
        chatWithSeller(`Hi! I'd like to book a service. What's available?`);
      }
      return;
    }
    if (lower.includes('apply')) {
      chatWithSeller(
        itemId
          ? `Hi! I'd like to apply for ${itemId}. Could you share the next steps?`
          : `Hi! I'd like to apply for the role at your shop. Could you share the next steps?`
      );
      return;
    }
    if (lower.includes('quote')) {
      chatWithSeller(
        itemId
          ? `Hi! I'd like a quote for ${itemId}. Could you share MOQ and pricing?`
          : `Hi! I'd like a quote for a bulk order. Could you share MOQ and pricing?`
      );
      return;
    }
    if (lower.includes('enquire')) {
      chatWithSeller(
        itemId
          ? `Hi! I'm interested in ${itemId}. Could you share more details?`
          : `Hi! I'm interested in a listing of yours. Could you share more details?`
      );
      return;
    }
    chatWithSeller(
      lower.includes('order')
        ? `Hi! I'd like to place an order. What are the next steps?`
        : undefined
    );
  };

  const handleBlockUser = async () => {
    try {
      const bKey = user?.username ? `${BLOCKED_KEY_BASE}:${user.username}` : BLOCKED_KEY_BASE;
      const legacyRaw = bKey !== BLOCKED_KEY_BASE ? await AsyncStorage.getItem(BLOCKED_KEY_BASE) : null;
      let raw: string | null = await AsyncStorage.getItem(bKey);
      if (raw === null && legacyRaw !== null) {
        raw = legacyRaw;
        try { await AsyncStorage.setItem(bKey, legacyRaw); } catch {}
      }
      let list: BlockedUser[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed as BlockedUser[];
        } catch {
          list = [];
        }
      }
      if (!list.some((b) => b.username === username)) {
        list = [...list, { username, name: displayName }];
        await AsyncStorage.setItem(bKey, JSON.stringify(list));
      }
      Alert.alert('User blocked', `@${username} is blocked on this device — their messages are hidden here.`);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const handleMore = () => {
    Alert.alert(`@${username}`, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report user', onPress: () => void fileUserReport(username || 'user') },
      { text: 'Block user', style: 'destructive', onPress: handleBlockUser },
    ]);
  };

  const profileHeader = (
    <View>
      <View className="flex-row items-end">
        {/* Themed stores: avatar pokes above the identity card into the hero
            band (classic premium profile framing); default stays flat. */}
        <View style={{ width: 96, height: 96, borderRadius: 9999, borderWidth: 4, borderColor: colors.surfaceContainerLowest, marginTop: themeAccent ? -26 : 0 }}>
          <Image
            source={profile.avatar ?? (themeAccent ? resolveAvatar(username, themeAccent) : resolveAvatar(username))}
            style={{ width: 88, height: 88, borderRadius: 9999, backgroundColor: colors.surfaceContainer }}
          />
          {realStats?.verified && (
            <View
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 28,
                height: 28,
                borderRadius: 9999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceContainerLowest,
              }}
            >
              <VerifiedIcon size={20} />
            </View>
          )}
        </View>
        <View className="flex-1 ml-4 pb-1">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24, flexShrink: 1 }} numberOfLines={1}>
              {displayName}
            </Text>
            {isProStore && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: themeAccent ?? colors.primary }}>
                {themeName ? (
                  <>
                    <View className="flex-row items-center" style={{ gap: 3 }}>
                      <Text className="text-white" style={{ fontSize: 9, lineHeight: 11 }}>✦</Text>
                      <Text className="font-inter-700 text-white" style={{ fontSize: 9, lineHeight: 11, letterSpacing: 0.8 }}>
                        {themeName.toUpperCase()}
                      </Text>
                    </View>
                    <Text className="font-inter-600 text-white" style={{ fontSize: 7, lineHeight: 9, letterSpacing: 1.2, opacity: 0.85 }}>
                      THEME
                    </Text>
                  </>
                ) : (
                  <Text className="font-inter-700 text-white" style={{ fontSize: 9, lineHeight: 12, letterSpacing: 0.8 }}>
                    PRO
                  </Text>
                )}
              </View>
            )}
            {profile.statusBadge && <StatusBadge label={profile.statusBadge} />}
          </View>
          <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 13, lineHeight: 18 }}>
            @{username}
          </Text>
          {(() => {
            // Rating row renders ONLY from real review aggregates — no seeded ratings.
            const rating = realStats?.avgRating ?? 0;
            if (!(rating > 0)) return null;
            return (
              <View className="flex-row items-center mt-0.5">
                <StarIcon size={16} color={themeAccent ?? colors.primary} />
                <Text className="font-inter-600 text-textPrimary ml-1" style={{ fontSize: 14, lineHeight: 18 }}>
                  {rating}
                </Text>
                <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 14, lineHeight: 18 }}>
                  ({realStats?.reviewCount ?? 0})
                </Text>
              </View>
            );
          })()}
        </View>
      </View>

      <View className="mt-4">
        <StatsBar stats={displayStats} />
      </View>

      <Text className="font-inter-400 text-textPrimary mt-3" style={{ fontSize: 14, lineHeight: 22 }}>
        {displayBio}
      </Text>

      {/* Trust chips: ONLY real verification status — no invented response
          times, certifications or locations. */}
      {realStats?.verified && (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: colors.surfaceContainer }}>
            <VerifiedIcon size={13} />
            <Text className="font-inter-500 ml-1.5 text-textPrimary" style={{ fontSize: 12, lineHeight: 16 }}>
              Verified Seller
            </Text>
          </View>
        </View>
      )}

      <View className="flex-row mt-4 mb-6" style={{ gap: 10 }}>
        <TouchableOpacity
          className="flex-1 items-center justify-center"
          style={{
            height: 48,
            borderRadius: 14,
            backgroundColor: following ? colors.surfaceContainerLowest : colors.surfaceContainer,
            borderWidth: following ? 1 : 0,
            borderColor: following ? colors.outlineVariant : 'transparent',
          }}
          onPress={toggleFollow}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: following ? colors.textPrimary : themeAccent ?? colors.primary }}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center justify-center"
          style={{ height: 48, borderRadius: 14, backgroundColor: colors.surfaceContainer }}
          onPress={() => chatWithSeller()}
        >
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
            Message
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const tabBar = (
    <View className="flex-row border-b" style={{ borderBottomColor: colors.surfaceContainer }}>
      {ARCHETYPE_TABS[profile.archetype].map((tab) => (
        <TouchableOpacity key={tab} className="flex-1 items-center" style={{ paddingVertical: 14 }} onPress={() => setActiveTab(tab)}>
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: activeTab === tab ? themeAccent ?? colors.primary : colors.secondary }}>
            {tab}
          </Text>
          {activeTab === tab && (
            <View style={{ position: 'absolute', bottom: 0, height: 2, width: 48, backgroundColor: themeAccent ?? colors.primary, borderRadius: 1 }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const firstTab = () => {
    switch (profile.archetype) {
      case 'food':
        return (
          <>
            <View className="mb-4">
              <ChipRail chips={filterChips} active={activeChip} onSelect={setActiveChip} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Top Deals" />
            </View>
            <View className="mb-6">
              <DealsRail deals={profile.deals || []} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Menu" />
            </View>
            <MenuListSection items={profile.menu || []} />
          </>
        );
      case 'service':
        return (
          <>
            <View className="mb-2">
              <SectionTitle title="Trending Services" />
            </View>
            <View className="mb-6">
              <TrendingRail items={profile.trendingServices || []} />
            </View>
            <View className="mb-2">
              <SectionTitle title="Browse Categories" />
            </View>
            <View className="mb-6">
              <ServiceCategoryGrid categories={profile.serviceCategories || []} />
            </View>
            <View className="mb-2">
              <SectionTitle title="All Services" />
            </View>
            <ServicesListSection items={profile.services || []} onBook={(id) => handleCta('Book Now')} />
          </>
        );
      case 'job':
        {
          const jobs = (profile.jobs || []).filter((j) => matchesChip(`${j.role} ${j.type} ${j.location} ${j.tags.join(' ')}`));
          return (
            <>
              <View className="mb-4">
                <ChipRail chips={filterChips} active={activeChip} onSelect={setActiveChip} />
              </View>
              <View className="mb-2">
                <SectionTitle title="Open Roles" />
              </View>
              {jobs.length > 0 ? (
                <JobListSection jobs={jobs} onApply={() => handleCta('Apply Now')} />
              ) : (
                <Text className="font-inter-400 text-center py-10" style={{ fontSize: 14, color: colors.textSecondary }}>
                  No roles match this filter
                </Text>
              )}
            </>
          );
        }
      case 'realestate':
        {
          const items = listingItems.filter((i) => matchesChip(`${i.title} ${i.metaLines?.[1] ?? ''}`));
          return (
            <>
              <View className="mb-4">
                <ChipRail chips={filterChips} active={activeChip} onSelect={setActiveChip} />
              </View>
              {items.length > 0 ? (
                <ProductGrid
                  items={items}
                  actionLabel="Enquire"
                  onAction={(id) => handleCta('Enquire', id)}
                  onPress={(id) => handleCta('Enquire', id)}
                />
              ) : (
                <Text className="font-inter-400 text-center py-10" style={{ fontSize: 14, color: colors.textSecondary }}>
                  No listings match this filter
                </Text>
              )}
            </>
          );
        }
      case 'b2b':
        {
          const items = bulkItems.filter((i) => matchesChip(i.title));
          return (
            <>
              <View className="mb-4">
                <ChipRail chips={filterChips} active={activeChip} onSelect={setActiveChip} />
              </View>
              <View className="mb-2">
                <SectionTitle title="Hot Deals in Bulk" />
              </View>
              <View className="mb-6">
                <BulkDealsRail deals={profile.bulkDeals || []} />
              </View>
              <View className="mb-2">
                <SectionTitle title="All Products" />
              </View>
              {items.length > 0 ? (
                <ProductGrid
                  items={items}
                  actionLabel="Get Quote"
                  onAction={(id) => handleCta('Get Quote', id)}
                  onPress={(id) => handleCta('Get Quote', id)}
                />
              ) : (
                <Text className="font-inter-400 text-center py-10" style={{ fontSize: 14, color: colors.textSecondary }}>
                  No products match this filter
                </Text>
              )}
            </>
          );
        }
      case 'empty':
        return (
          <>
            <EmptyStorefront isOwner={false} />
            <View className="mt-6">
              <SectionTitle title="Featured" />
            </View>
          </>
        );
      default:
        {
          const items = gridItems.filter((i) => matchesChip(`${i.title} ${i.metaLines?.[0] ?? ''}`));
          return (
            <>
              {filterChips.length > 0 && (
                <View className="mb-4">
                  <ChipRail chips={filterChips} active={activeChip} onSelect={setActiveChip} />
                </View>
              )}
              <View className="mb-2">
                <SectionTitle title="Top Deals" />
              </View>
              <View className="mb-6">
                <DealsRail deals={profile.deals || []} />
              </View>
              <View className="mb-2">
                <SectionTitle title="All Products" />
              </View>
              {items.length > 0 ? (
                <ProductGrid
                  items={items}
                  actionLabel="Buy Now"
                  onAction={(id) => router.push(`/product/${id}`)}
                  onPress={(id) => router.push(`/product/${id}`)}
                />
              ) : (
                <Text className="font-inter-400 text-center py-10" style={{ fontSize: 14, color: colors.textSecondary }}>
                  No products match this filter
                </Text>
              )}
            </>
          );
        }
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'About') return <AboutSection profile={profile} location={realStats?.location} />;
    // Reviews tab: real post-delivery reviews in the top column next to
    // Products - the buyer-facing trust surface (user mandate, Aug 25).
    if (activeTab === 'Reviews') {
      return (
        <View>
          {realStats && realStats.avgRating > 0 ? (
            <Text className="mx-5 mb-3 font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {Math.round(realStats.avgRating * 10) / 10} average from {realStats.reviewCount} delivered-order review{realStats.reviewCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          <ReviewsSection username={username} serverReviews={storeReviews} />
        </View>
      );
    }
    return firstTab();
  };

  const stickyLabel = profile.archetype === 'service' ? 'Book Appointment' : profile.archetype === 'food' ? 'Order Now' : profile.archetype === 'b2b' ? 'Get Quote' : null;

  return (
    <StoreAccentProvider value={themeAccent}>
    {/* Themed stores: barely-visible accent wash across the whole page -
        atmosphere, not recoloring (GPT idea #7, 1-3% tint zones). */}
    <View
      className="flex-1"
      style={{ backgroundColor: themeAccent ? `${themeAccent}0A` : colors.surface }}
    >
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: themeAccent ? `${themeAccent}0A` : colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={themeAccent ?? colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 28, color: themeAccent ?? colors.primary }}>
          susej
        </Text>
        <TouchableOpacity style={{ marginRight: 16 }} onPress={() => router.push(`/qr/${username}`)}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Path d="M14.5 14.5h2.5v2.5h-2.5zM17.5 17.5h2v2h-2zM14.5 18.5h1v1h-1zM19 19.5h1v1h-1zM20.5 14.5h1v1h-1z" fill={colors.textSecondary} />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore}>
          <MoreIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (stickyLabel ? 110 : 40) }}>
        {/* Seller-configured banner (from the storefront editor) renders as the
            hero for every viewer. No seller banner = no hero: identity-first
            layout, never a fabricated template banner (audit Aug 24). */}
        {storeBanners.length > 0 && (
          <View style={{ height: 200, backgroundColor: colors.surfaceContainer }}>
            {storeBanners[0].image ? (
              <Image source={storeBanners[0].image} className="w-full h-full" resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={themeAccent ? [themeAccent, themeAccent] : [colors.primaryContainer, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            )}
            <LinearGradient
              colors={['rgba(47,46,67,0)', 'rgba(47,46,67,0.55)', 'rgba(47,46,67,0.92)']}
              start={{ x: 0, y: 0.35 }}
              end={{ x: 0, y: 1 }}
              // className positioning silently fails on expo-linear-gradient
              // (Aug 8 lesson) - explicit style only.
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View
              className="absolute left-5 right-5"
              style={{ bottom: themeAccent ? 58 : 16 }}
            >
              <Text className="font-inter-700 text-white" style={{ fontSize: 22, lineHeight: 28 }}>
                {storeBanners[0].title}
              </Text>
              {storeBanners[0].sub ? (
                <Text className="font-inter-400 mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.inverseOnSurface }}>
                  {storeBanners[0].sub}
                </Text>
              ) : null}
            </View>
            {/* Theme signature on CUSTOM banners (GPT #1 insight, Aug 25):
                banner stores must still show the paid theme at the hero. */}
            {themeAccent ? (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: themeAccent }} />
            ) : null}
          </View>
        )}
        {/* Themed hero treatment (GPT idea #3, Aug 25): a themed store with NO
            custom banner still gets a hero - real shop name on the seller's
            purchased brand gradient. Honest data only, no CTA button. */}
        {storeBanners.length === 0 && themeAccent && (
          <LinearGradient
            colors={[themeSoft ?? themeAccent, themeAccent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 170 }}
          >
            <View className="flex-1 justify-end px-5 pb-5">
              <Text className="font-inter-700 text-white" style={{ fontSize: 26, lineHeight: 32 }} numberOfLines={1}>
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <Text className="text-white" style={{ fontSize: 12, lineHeight: 14 }}>✦</Text>
                <Text className="font-inter-600 text-white" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 1 }}>
                  SELLER PRO
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}
        {themeAccent ? (
          /* Themed stores get a STRUCTURALLY different identity block: an
             elevated framed card (GPT "Premium Storefront Frame") instead of
             the free flat layout - the paid tier changes architecture. */
          <View
            style={{
              marginHorizontal: 16,
              marginTop: -40,
              backgroundColor: colors.surfaceContainerLowest,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingBottom: 16,
              borderWidth: 1,
              borderColor: `${themeAccent}2E`,
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {profileHeader}
          </View>
        ) : (
          <View className="px-5 pt-4">{profileHeader}</View>
        )}

        <View className="mt-4">{tabBar}</View>

        <View className="mt-5">{renderTabContent()}</View>

        {/* Theme-branded footer - brands the transformation and advertises
            Seller Pro to every visitor of a themed storefront. */}
        {themeName && (
          <View className="items-center mt-8 mb-2">
            <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 14, color: colors.textSecondary, letterSpacing: 0.5 }}>
              {themeName} theme · susej Seller Pro
            </Text>
          </View>
        )}
      </ScrollView>

      {stickyLabel && <StickyActionBar label={stickyLabel} onPress={() => handleCta(stickyLabel)} />}
    </View>
    </StoreAccentProvider>
  );
}

function UserProfile({
  username,
  sellerInfo,
  following,
  toggleFollow,
  insets,
}: {
  username: string | undefined;
  sellerInfo: { name: string; verified: boolean; bio: string };
  following: boolean;
  toggleFollow: () => void;
  insets: any;
}) {
  // REAL stats + identity from the server (Follow table + published posts). '…' while loading.
  const { user: currentUser } = useAuth();
  const accent = useStoreAccent();
  const [stats, setStats] = useState<{ followers: number; following: number; posts: number } | null>(null);
  const [identity, setIdentity] = useState(sellerInfo);
  useEffect(() => {
    if (!username) return;
    let alive = true;
    serverApi.getUserProfile(username).then((res) => {
      if (alive && res.ok && res.data) {
        const u = res.data.user;
        setStats({ followers: u.followers, following: u.following, posts: u.posts });
        setIdentity({
          name: typeof u.name === 'string' && u.name.trim() ? u.name : sellerInfo.name,
          verified: u.verification === 'approved',
          bio: typeof u.bio === 'string' ? u.bio : '',
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [username]);
  const display = (n: number | undefined) =>
    n === undefined ? '…' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const handleBlockUser = async () => {
    const u = username || '';
    try {
      const bKey = currentUser?.username ? `${BLOCKED_KEY_BASE}:${currentUser.username}` : BLOCKED_KEY_BASE;
      const legacyRaw = bKey !== BLOCKED_KEY_BASE ? await AsyncStorage.getItem(BLOCKED_KEY_BASE) : null;
      let raw: string | null = await AsyncStorage.getItem(bKey);
      if (raw === null && legacyRaw !== null) {
        raw = legacyRaw;
        try { await AsyncStorage.setItem(bKey, legacyRaw); } catch {}
      }
      let list: BlockedUser[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed as BlockedUser[];
        } catch {
          list = [];
        }
      }
      if (!list.some((b) => b.username === u)) {
        list = [...list, { username: u, name: identity.name || u }];
        await AsyncStorage.setItem(bKey, JSON.stringify(list));
      }
      Alert.alert('User blocked', `@${u} is blocked on this device — their messages are hidden here.`);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const handleMore = () => {
    Alert.alert(`@${username || 'user'}`, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report user', onPress: () => void fileUserReport(username || 'user') },
      { text: 'Block user', style: 'destructive', onPress: handleBlockUser },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header — back + susej + QR + more */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={accent ?? colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 28, color: accent ?? colors.primary }}>
          susej
        </Text>
        <TouchableOpacity style={{ marginRight: 16 }} onPress={() => username && router.push(`/qr/${username}`)}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={colors.textSecondary} strokeWidth="2" />
            <Path d="M14.5 14.5h2.5v2.5h-2.5zM17.5 17.5h2v2h-2zM14.5 18.5h1v1h-1zM19 19.5h1v1h-1zM20.5 14.5h1v1h-1z" fill={colors.textSecondary} />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore}>
          <MoreIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Instagram-style header: avatar left, stats right, name + bio below */}
        <View className="px-5 mt-4">
          <View className="flex-row items-center">
            <Image
              source={resolveAvatar(username || 'anon')}
              className="w-[86px] h-[86px] rounded-full"
              style={{ backgroundColor: colors.surfaceContainer }}
            />
            <View className="flex-1 ml-4 flex-row">
              {[
                { value: display(stats?.posts ?? 0), label: 'Posts' },
                { value: display(stats?.followers), label: 'Followers' },
                { value: display(stats?.following), label: 'Following' },
              ].map((s, i) => (
                <View key={s.label} className="flex-1 items-center">
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
                    {s.value}
                  </Text>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                    {s.label}
                  </Text>
                  {i < 2 && <View style={{ position: 'absolute', right: 0, width: 1, height: 26, backgroundColor: colors.surfaceContainer }} />}
                </View>
              ))}
            </View>
          </View>

          <Text className="font-inter-700 text-textPrimary mt-3" style={{ fontSize: 16, lineHeight: 22 }}>
            {identity.name || `@${username || 'user'}`}
          </Text>
          <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
            @{username || 'user'}
          </Text>
          {identity.bio ? (
            <Text className="font-inter-400 text-textPrimary mt-2" style={{ fontSize: 13, lineHeight: 19 }}>
              {identity.bio}
            </Text>
          ) : (
            <Text className="font-inter-400 text-textSecondary mt-2" style={{ fontSize: 13, lineHeight: 19 }}>
              Joined susej to buy, sell and connect locally.
            </Text>
          )}

          {/* Follow + Message — users follow other users AND sellers */}
          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <TouchableOpacity
              className="flex-1 h-11 rounded-figma-12 items-center justify-center"
              style={{
                backgroundColor: following ? colors.surfaceContainerLow : accent ?? colors.primaryContainer,
                borderWidth: following ? 1 : 0,
                borderColor: following ? colors.outlineVariant : 'transparent',
              }}
              onPress={toggleFollow}
            >
              <Text className={`font-inter-600 ${following ? 'text-textPrimary' : 'text-white'}`} style={{ fontSize: 14, lineHeight: 16 }}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-11 rounded-figma-12 items-center justify-center"
              style={{ backgroundColor: colors.surfaceContainer }}
              onPress={() => username && router.push({ pathname: '/(tabs)/chat', params: { to: username } })}
            >
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
                Message
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts — users cannot post on susej, so the grid is always empty */}
        <View className="mx-5 mt-5 items-center py-10 px-6 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 22 }}>
            No posts yet
          </Text>
          <Text className="font-inter-400 text-textSecondary text-center mt-1" style={{ fontSize: 13, lineHeight: 19 }}>
            {`@${username || 'user'}`} is a shopper on susej. Sellers post products — users follow, buy and message.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
