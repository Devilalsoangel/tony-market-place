import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VerifiedIcon, ChevronLeftIcon, MoreIcon, StarIcon, MapPinIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useFollow } from '../../contexts/FollowContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePosts } from '../../contexts/PostContext';
import { productImages } from '../../utils/productImages';
import { sellerImages } from '../../utils/screenImages';
import { getShopProfile, generateShopProfile } from '../../utils/storefronts';
import type { ShopProfile, StorefrontArchetype, ListingItem, BulkProduct, StorefrontChip } from '../../utils/storefronts';
import { getFlow } from '../../utils/categoryFlow';
import { getChildCategories, findMainCategory } from '../../utils/categories';
import {
  ChipRail,
  StatsBar,
  DealsRail,
  MenuListSection,
  TrendingRail,
  ServiceCategoryGrid,
  ServicesListSection,
  JobListSection,
  BulkDealsRail,
  EmptyStorefront,
  ReviewsSection,
  AboutSection,
  SectionTitle,
  StatusBadge,
  StickyActionBar,
} from '../../components/StorefrontSections';

const BLOCKED_KEY = '@susej_blocked';
const SELLERS_REGISTRY_KEY = '@susej_sellers';

interface BlockedUser {
  username: string;
  name?: string;
}

const SELLER_NAMES: Record<string, { name: string; verified: boolean; bio: string }> = {
  elara_finds: { name: 'Elara Finds', verified: true, bio: 'Passionate about sustainable luxury. Dropping weekly collections of authentic vintage and contemporary pieces. Based in Milan.' },
  elara_mod: { name: 'Elara Modern', verified: true, bio: 'Curated sustainable luxury. Weekly drops of authentic vintage and contemporary pieces. Based in Milan.' },
  arc_design: { name: 'Arc Design', verified: true, bio: 'Minimalist furniture and home accessories.\nDesigned in-house, shipped worldwide.' },
  lux_gems: { name: 'Lux Gems', verified: true, bio: 'Authentic jewellery and rare collectibles.\nCertified pieces with worldwide shipping.' },
  hype_vault: { name: 'Hype Vault', verified: false, bio: 'Streetwear and sneakers.\n100% authentic, tagged and boxed.' },
  vintage_loft: { name: 'Vintage Loft', verified: false, bio: 'One-of-a-kind vintage finds.\nClothing, decor and accessories.' },
  luxe: { name: 'Luxe Thread Studio', verified: true, bio: 'Curating the finest minimalist aesthetics.\nSelling rare digital assets and luxury collectibles.' },
  techvault: { name: 'TechVault', verified: false, bio: 'Premium electronics and gadgets.\nCertified refurbished products with warranty.' },
  urbanjungle: { name: 'Urban Jungle', verified: true, bio: 'Handcrafted home decor and plants.\nSustainable materials, unique designs.' },
};

const ARCHETYPE_TABS: Record<StorefrontArchetype, string[]> = {
  goods: ['Products', 'Reviews'],
  food: ['Menu', 'Reviews'],
  service: ['Services', 'Reviews', 'About'],
  job: ['Jobs', 'About'],
  realestate: ['Listings', 'Reviews', 'About'],
  b2b: ['Products', 'Reviews', 'About'],
  empty: ['Products', 'About'],
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

const ARCHETYPE_CHIPS: Record<StorefrontArchetype, { icon: ChipIcon; label: string }[]> = {
  goods: [
    { icon: 'verified', label: 'Verified Seller' },
    { icon: 'clock', label: 'Responds in ~2 hrs' },
    { icon: 'pin', label: 'Mumbai, India' },
  ],
  food: [
    { icon: 'verified', label: 'FSSAI Certified' },
    { icon: 'clock', label: 'Delivery in 30 min' },
    { icon: 'pin', label: 'Jaipur' },
  ],
  service: [
    { icon: 'verified', label: 'Verified Professional' },
    { icon: 'clock', label: 'Responds in ~1 hr' },
    { icon: 'pin', label: 'Delhi NCR' },
  ],
  job: [
    { icon: 'verified', label: 'ISO Certified' },
    { icon: 'clock', label: '50+ Openings' },
    { icon: 'pin', label: 'Bengaluru' },
  ],
  realestate: [
    { icon: 'verified', label: 'RERA Registered' },
    { icon: 'clock', label: 'Responds in ~2 hrs' },
    { icon: 'pin', label: 'Gurugram, Haryana' },
  ],
  b2b: [
    { icon: 'verified', label: 'Verified Manufacturer' },
    { icon: 'clock', label: 'MOQ 100 pcs' },
    { icon: 'pin', label: 'Surat, Gujarat' },
  ],
  empty: [],
};

function ClockIcon({ size = 14, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ChipIconView({ icon, color }: { icon: ChipIcon; color: string }) {
  if (icon === 'verified') return <VerifiedIcon size={13} />;
  if (icon === 'clock') return <ClockIcon size={13} color={color} />;
  return <MapPinIcon size={13} color={color} />;
}

function HeroBanner({ banner, archetype, onCta }: { banner: ShopProfile['banner']; archetype: StorefrontArchetype; onCta: () => void }) {
  return (
    <View style={{ height: 200 }}>
      {banner.image ? (
        <Image source={banner.image} className="w-full h-full" resizeMode="cover" />
      ) : (
        <View className="w-full h-full" style={{ backgroundColor: colors.surfaceContainer }} />
      )}
      <LinearGradient
        colors={[colors.primaryContainer, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
        style={{ opacity: 0.55 }}
      />
      <View className="absolute inset-0 justify-end px-5 pb-5">
        <Text
          className="font-inter-700 text-white"
          style={{
            fontSize: 24,
            lineHeight: 30,
            textTransform: archetype === 'realestate' || archetype === 'b2b' ? 'uppercase' : 'none',
          }}
        >
          {banner.headline}
        </Text>
        {banner.sub ? (
          <Text className="font-inter-400 mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.inverseOnSurface }}>
            {banner.sub}
          </Text>
        ) : null}
        <TouchableOpacity
          className="mt-3 self-start items-center justify-center"
          style={{ height: 40, paddingHorizontal: 20, borderRadius: 9999, backgroundColor: colors.surfaceContainerLowest }}
          onPress={onCta}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
            {banner.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  return (
    <View className="flex-row flex-wrap mx-5" style={{ gap: 12 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          className="overflow-hidden"
          style={{
            width: (392 - 40 - 12) / 2,
            borderRadius: 24,
            backgroundColor: colors.surfaceContainerLowest,
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
              <View className="absolute top-2 left-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
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
            <Text className="font-inter-700 text-textPrimary mt-1" style={{ fontSize: 16, lineHeight: 20 }}>
              {item.priceText ?? formatPrice(item.price)}
            </Text>
            {actionLabel ? (
              <TouchableOpacity
                className="mt-2 items-center justify-center"
                style={{ height: 32, borderRadius: 12, backgroundColor: colors.primaryContainer }}
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

  const sellerInfo = SELLER_NAMES[username || ''] || { name: username || 'Seller', verified: false, bio: '' };

  const sellerPosts = useMemo(() => {
    if (!username) return [];
    return posts.filter((p) => p.sellerUsername.toLowerCase() === username.toLowerCase());
  }, [posts, username]);

  const shopProfile = getShopProfile(username);

  if (shopProfile) {
    return <StorefrontRoute username={username || ''} profile={shopProfile} following={following} toggleFollow={() => toggleFollow(username || '')} sellerPosts={sellerPosts} insets={insets} />;
  }

  // No hand-seeded profile: derive the storefront from the seller's category
  // (their posts' most common main category) so every one of the 17 industries
  // renders its own archetype UI instead of the generic grid.
  const categoryOf = (post: any): string | undefined => findMainCategory(post?.category)?.id;
  const withCategory = sellerPosts.filter((p) => categoryOf(p));
  if (withCategory.length > 0) {
    const counts = new Map<string, number>();
    for (const p of withCategory) {
      const id = categoryOf(p)!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const topCategory = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const main = findMainCategory(topCategory);
    const name = SELLER_NAMES[username || '']?.name || username || 'Seller';
    const generated = generateShopProfile(username || '', topCategory, name, sellerPosts, main?.label);
    return <StorefrontRoute username={username || ''} profile={generated} following={following} toggleFollow={() => toggleFollow(username || '')} sellerPosts={sellerPosts} insets={insets} />;
  }

  // Known demo sellers with zero posts yet are STILL sellers — they get a
  // generated storefront, never the Instagram-style user profile.
  if (SELLER_NAMES[username || '']) {
    const info = SELLER_NAMES[username || '']!;
    const generated = generateShopProfile(username || '', 'fashion', info.name, [], 'Fashion');
    return <StorefrontRoute username={username || ''} profile={generated} following={following} toggleFollow={() => toggleFollow(username || '')} sellerPosts={sellerPosts} insets={insets} />;
  }

  // Registered sellers (approved via become-seller) with zero posts — still a
  // storefront (empty state), never the insta view. Wait for the registry to
  // load so we don't flash the wrong view.
  const isRegisteredSeller = (sellers ?? []).includes((username || '').toLowerCase());
  if (sellerPosts.length > 0 || isRegisteredSeller) {
    if (sellers === null) return null;
    const main = findMainCategory(sellerPosts[0]?.category);
    const name = SELLER_NAMES[username || '']?.name || username || 'Seller';
    const generated = generateShopProfile(username || '', main?.id ?? 'fashion', name, sellerPosts, main?.label);
    return <StorefrontRoute username={username || ''} profile={generated} following={following} toggleFollow={() => toggleFollow(username || '')} sellerPosts={sellerPosts} insets={insets} />;
  }

  // Everyone else is a regular user (no posts, no store). Instagram-style
  // profile: followable, but users cannot post — always zero posts.
  return <UserProfile username={username} sellerInfo={sellerInfo} following={following} toggleFollow={() => toggleFollow(username || '')} insets={insets} />;
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
  const { user } = useAuth();
  const flow = getFlow(ARCHETYPE_FLOW_CAT[profile.archetype]);
  const primaryCta = flow.primaryCta;

  // Own-store customization overrides (from the seller editors): customized
  // sub-category filters and marketing banners only apply to the logged-in
  // user's own shop so seeded storefronts are never polluted.
  const isOwnStore = !!user?.username && username === user.username;
  const [ownChildren, setOwnChildren] = useState<string[] | null>(null);
  const [ownBanners, setOwnBanners] = useState<{ id: string; title: string; sub?: string; image?: any; cta?: string }[] | null>(null);

  useEffect(() => {
    if (!isOwnStore) return;
    let alive = true;
    (async () => {
      try {
        const catRaw = await AsyncStorage.getItem('@susej_store_categories');
        if (alive && catRaw) {
          const parsed = JSON.parse(catRaw);
          if (parsed && Array.isArray(parsed.children) && parsed.children.length > 0) setOwnChildren(parsed.children);
        }
        const bRaw = await AsyncStorage.getItem('@susej_store_banners');
        if (alive && bRaw) {
          const parsed = JSON.parse(bRaw);
          if (Array.isArray(parsed) && parsed.length > 0) setOwnBanners(parsed);
        }
      } catch {
        // ignore — fall back to profile defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOwnStore]);

  const filterChips = useMemo<StorefrontChip[]>(() => {
    if (ownChildren && ownChildren.length > 0) {
      return [{ id: 'all', label: 'All' }, ...ownChildren.map((c) => ({ id: c, label: c }))];
    }
    const explicit = profile.chips.length > 0 ? profile.chips : profile.jobFilters || profile.listingTypes || profile.categoryFilter;
    if (explicit && explicit.length > 0) return explicit;
    const mainId = ARCHETYPE_MAIN_CAT[profile.archetype];
    const children = mainId ? getChildCategories(mainId) : [];
    return children.length > 0 ? [{ id: 'all', label: 'All' }, ...children.map((c) => ({ id: c, label: c }))] : [];
  }, [profile, ownChildren]);

  const storeBanners = ownBanners && ownBanners.length > 0 ? ownBanners : profile.banners;

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
        image: post.image ? { uri: post.image } : productImages[post.id],
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
        priceText: `\u20B9${l.price}${l.suffix}`,
        image: l.image,
        tag: l.tag,
        metaLines: [`${l.beds > 0 ? `${l.beds} Beds \u00B7 ` : ''}${l.baths} Baths \u00B7 ${l.sqft} sq.ft`, l.locality],
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
        metaLines: [b.moq],
      })),
    [profile.bulkProducts, bulkImages]
  );

  const chatWithSeller = (msg?: string) => {
    router.push({ pathname: '/chat', params: msg ? { to: username, msg } : { to: username } });
  };

  const handleCta = (label: string, itemId?: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('book')) {
      router.push('/book-service');
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
      const raw = await AsyncStorage.getItem(BLOCKED_KEY);
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
        list = [...list, { username, name: profile.name }];
        await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(list));
      }
      Alert.alert('User blocked', `@${username} can no longer see your profile, posts or message you.`);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const handleMore = () => {
    Alert.alert(`@${username}`, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report user', onPress: () => Alert.alert('Thanks \u2014 our team will review', `We will review @${username} and take action within 24 hours.`) },
      { text: 'Block user', style: 'destructive', onPress: handleBlockUser },
    ]);
  };

  const profileHeader = (
    <View>
      <View className="flex-row items-end">
        <View style={{ width: 96, height: 96, borderRadius: 9999, borderWidth: 4, borderColor: colors.surfaceContainerLowest }}>
          <Image source={profile.avatar} style={{ width: 88, height: 88, borderRadius: 9999 }} />
          {profile.verified && (
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
              {profile.name}
            </Text>
            {profile.statusBadge && <StatusBadge label={profile.statusBadge} />}
          </View>
          <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 13, lineHeight: 18 }}>
            @{username}
          </Text>
          {profile.rating > 0 && (
            <View className="flex-row items-center mt-0.5">
              <StarIcon size={16} color={colors.primary} />
              <Text className="font-inter-600 text-textPrimary ml-1" style={{ fontSize: 14, lineHeight: 18 }}>
                {profile.rating}
              </Text>
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 14, lineHeight: 18 }}>
                ({profile.reviews})
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-4">
        <StatsBar stats={profile.stats} />
      </View>

      <Text className="font-inter-400 text-textPrimary mt-3" style={{ fontSize: 14, lineHeight: 22 }}>
        {profile.bio}
      </Text>

      {ARCHETYPE_CHIPS[profile.archetype].length > 0 && (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          {ARCHETYPE_CHIPS[profile.archetype].map((chip) => (
            <View key={chip.label} className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: colors.surfaceContainer }}>
              <ChipIconView icon={chip.icon} color={colors.primary} />
              <Text className="font-inter-500 ml-1.5 text-textPrimary" style={{ fontSize: 12, lineHeight: 16 }}>
                {chip.label}
              </Text>
            </View>
          ))}
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
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: following ? colors.textPrimary : colors.primary }}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center justify-center"
          style={{ height: 48, borderRadius: 14, backgroundColor: colors.primaryContainer }}
          onPress={() => (profile.archetype === 'empty' ? router.replace('/(tabs)/feed') : handleCta(primaryCta))}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
            {primaryCta}
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
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: activeTab === tab ? colors.primary : colors.secondary }}>
            {tab}
          </Text>
          {activeTab === tab && (
            <View style={{ position: 'absolute', bottom: 0, height: 2, width: 48, backgroundColor: colors.primary, borderRadius: 1 }} />
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
    if (activeTab === 'Reviews') return <ReviewsSection username={username} />;
    if (activeTab === 'About') return <AboutSection profile={profile} />;
    return firstTab();
  };

  const stickyLabel = profile.archetype === 'service' ? 'Book Appointment' : profile.archetype === 'food' ? 'Order Now' : profile.archetype === 'b2b' ? 'Get Quote' : null;

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
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
        <HeroBanner
          banner={profile.banner}
          archetype={profile.archetype}
          onCta={() => (profile.archetype === 'empty' ? router.replace('/(tabs)/feed') : handleCta(profile.banner.cta))}
        />

        <View className="px-5" style={{ marginTop: -40 }}>
          {profileHeader}
        </View>

        {storeBanners && storeBanners.length > 0 && (
          <View className="mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {storeBanners.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.85}
                  onPress={() => handleCta(b.cta || 'Shop')}
                  style={{ width: 260, height: 104, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceContainer }}
                >
                  {b.image ? <Image source={b.image} className="w-full h-full" resizeMode="cover" /> : null}
                  <LinearGradient
                    colors={[colors.primaryContainer, colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="absolute inset-0"
                    style={{ opacity: 0.78 }}
                  />
                  <View className="absolute inset-0 justify-center px-4">
                    <Text className="font-inter-700 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
                      {b.title}
                    </Text>
                    {b.sub ? (
                      <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface }}>
                        {b.sub}
                      </Text>
                    ) : null}
                    {b.cta ? (
                      <View className="mt-1.5 self-start px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLowest }}>
                        <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                          {b.cta}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="mt-4">{tabBar}</View>

        <View className="mt-5">{renderTabContent()}</View>
      </ScrollView>

      {stickyLabel && <StickyActionBar label={stickyLabel} onPress={() => handleCta(stickyLabel)} />}
    </View>
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
  // Deterministic per-username demo stats (no real follower-back tracking yet)
  const hashOf = (s: string): number => {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    return h;
  };
  const seed = username ? hashOf(username) : 0;
  const followers = seed % 9000 + 240;
  const followingCount = (seed * 7) % 1200 + 120;
  const display = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const handleBlockUser = async () => {
    const u = username || '';
    try {
      const raw = await AsyncStorage.getItem(BLOCKED_KEY);
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
        list = [...list, { username: u, name: sellerInfo.name || u }];
        await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(list));
      }
      Alert.alert('User blocked', `@${u} can no longer see your profile, posts or message you.`);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const handleMore = () => {
    Alert.alert(`@${username || 'user'}`, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report user', onPress: () => Alert.alert('Thanks \u2014 our team will review', `We will review @${username} and take action within 24 hours.`) },
      { text: 'Block user', style: 'destructive', onPress: handleBlockUser },
    ]);
  };

  const highlights = [
    { id: 'saved', label: 'Saved', image: sellerImages.products[0] },
    { id: 'likes', label: 'Likes', image: sellerImages.products[1] },
    { id: 'orders', label: 'Orders', image: sellerImages.products[2] },
  ];

  return (
    <View className="flex-1 bg-surface">
      {/* Header — back + susej + QR + more */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
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
              source={{ uri: `https://picsum.photos/seed/user-${username || 'anon'}/200/200` }}
              className="w-[86px] h-[86px] rounded-full"
              style={{ backgroundColor: colors.surfaceContainer }}
            />
            <View className="flex-1 ml-4 flex-row">
              {[
                { value: '0', label: 'Posts' },
                { value: display(followers), label: 'Followers' },
                { value: display(followingCount), label: 'Following' },
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
            {sellerInfo.name || `@${username || 'user'}`}
          </Text>
          <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
            @{username || 'user'}
          </Text>
          {sellerInfo.bio ? (
            <Text className="font-inter-400 text-textPrimary mt-2" style={{ fontSize: 13, lineHeight: 19 }}>
              {sellerInfo.bio}
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
                backgroundColor: following ? colors.surfaceContainerLow : colors.primaryContainer,
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

        {/* Highlights rail (Instagram look) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20, marginTop: 20 }}>
          {highlights.map((h) => (
            <View key={h.id} className="items-center" style={{ width: 56 }}>
              <View
                className="w-[56px] h-[56px] rounded-full"
                style={{ borderWidth: 1.5, borderColor: colors.surfaceContainerHigh, padding: 2 }}
              >
                <Image source={h.image} className="w-full h-full rounded-full" />
              </View>
              <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 11, lineHeight: 14 }}>
                {h.label}
              </Text>
            </View>
          ))}
        </ScrollView>

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
