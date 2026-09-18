import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, Modal, Share, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ChevronRightIcon, VerifiedIcon, ShopIcon, SendIcon, BellIcon, CloseIcon, HeartIcon, ShareIcon, MapPinIcon, CheckIcon, StarIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { getPostFlow, formatFlowPrice } from '../../utils/categoryFlow';
import { usePosts } from '../../contexts/PostContext';
import { useFollow } from '../../contexts/FollowContext';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { useBookmark } from '../../contexts/BookmarkContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { hasRealImage, resolveAvatar, resolveListingImage } from '../../utils/productImages';
import { serverApi } from '../../utils/serverApi';
import { CommentsSheet } from '../../components/sheets/PostEngagementSheets';

const BLOCKED_KEY_BASE = '@susej_blocked';
const SEARCHES_KEY_BASE = '@susej_saved_searches';
const ALERTS_FIRED_KEY_BASE = '@susej_alerts_fired';

interface SavedSearch {
  id: string;
  query: string;
  savedAt: number;
  priceAlert: boolean;
}

interface BlockedUser {
  username: string;
  name?: string;
}

const formatCommentTime = (time: number): string => {
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
};

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const postId = Array.isArray(id) ? id[0] : id ?? '';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { posts, addComment, reportPost, loaded, hiddenPostIds = [], mutedSellers = [] } = usePosts() as unknown as { posts: import('../../contexts/PostContext').Post[]; addComment: any; reportPost: (id: string, reason: string) => Promise<boolean>; loaded: boolean; hiddenPostIds?: string[]; mutedSellers?: string[] };
  const { isFollowing, toggleFollow } = useFollow();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { recents, record: recordView } = useRecentlyViewed();
  const { isBookmarked, toggleBookmark, removeBookmark } = useBookmark();
  const { addNotification } = useNotifications();
  const [commentText, setCommentText] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  // OLX-style compact sticky header: back + truncated title + price + share
  // once the user scrolls past the gallery.
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [alertDrop, setAlertDrop] = useState<{ previous: number } | null>(null);
  const alertChecked = useRef<string>('');
  const getBlockedKey = () => {
    const u = user?.username?.trim();
    return u ? `${BLOCKED_KEY_BASE}:${u}` : BLOCKED_KEY_BASE;
  };
  const getSearchesKey = () => {
    const u = user?.username?.trim();
    return u ? `${SEARCHES_KEY_BASE}:${u}` : SEARCHES_KEY_BASE;
  };
  const getAlertsKey = () => {
    const u = user?.username?.trim();
    return u ? `${ALERTS_FIRED_KEY_BASE}:${u}` : ALERTS_FIRED_KEY_BASE;
  };
  const [applyVisible, setApplyVisible] = useState(false);
  const [applyName, setApplyName] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyNote, setApplyNote] = useState('');
  // Server fallback: when the listing is not in the local cache (deep link,
  // fresh install, other-device post), fetch it directly so we never show a
  // false "not found" for a listing that exists (industry-standard PDP).
  const [serverPost, setServerPost] = useState<import('../../contexts/PostContext').Post | null>(null);
  const [sellerRating, setSellerRating] = useState<{ avg: number; count: number } | null>(null);
  const [serverMiss, setServerMiss] = useState(false);
  const localPost = posts.find((p) => p.id === postId);
  useEffect(() => {
    setServerPost(null);
    setServerMiss(false);
  }, [postId]);
  useEffect(() => {
    if (localPost || !postId || serverPost || serverMiss) return;
    let alive = true;
    serverApi
      .getPost(postId)
      .then((res) => {
        if (!alive) return;
        const p = res.ok ? (res.data as { post?: any } | null)?.post : null;
        if (p && p.id) {
          setServerPost({
            type: (p.type as import('../../contexts/PostContext').Post['type']) ?? 'product',
            id: String(p.id),
            title: String(p.title ?? '').trim() || String(p.description ?? '').split('\n')[0].slice(0, 200) || 'New listing',
            description: String(p.description ?? p.title ?? 'Untitled'),
            price: Number(p.price ?? 0),
            mrp: p.mrp != null && Number(p.mrp) > Number(p.price ?? 0) ? Number(p.mrp) : undefined,
            category: String(p.category ?? 'General'),
            subCategories: Array.isArray(p.subCategories) ? p.subCategories.map(String) : undefined,
            hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : [],
            likes: Number(p.likes ?? 0),
            comments: Number(p.comments ?? 0),
            createdAt: typeof p.createdAt === 'string' ? Date.parse(p.createdAt) : Number(p.createdAt ?? Date.now()),
            image: String(p.image ?? ''),
            images: Array.isArray(p.images) ? p.images.map(String) : [],
            isSold: Boolean(p.isSold),
            verified: Boolean(p.verified),
            featured: Boolean(p.featured),
            sellerUsername: String(p.sellerUsername ?? 'user'),
            sellerName: String(p.sellerName ?? p.sellerUsername ?? 'susej user'),
            sellerLocation: String(p.sellerLocation ?? ''),
            variants: Array.isArray(p.variants) ? p.variants : undefined,
            stockLeft: typeof p.stockLeft === 'number' ? p.stockLeft : undefined,
            negotiable: typeof p.negotiable === 'boolean' ? p.negotiable : undefined,
            condition: p.condition ? String(p.condition) : undefined,
            brand: p.brand ? String(p.brand) : undefined,
            deliveryMode: typeof p.deliveryMode === 'string' ? p.deliveryMode : undefined,
          });
        } else {
          setServerMiss(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [localPost, postId, serverPost, serverMiss]);
  const [enquireVisible, setEnquireVisible] = useState(false);
  const [enquireNote, setEnquireNote] = useState('');
  const [enquireDay, setEnquireDay] = useState('');
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteQty, setQuoteQty] = useState('');
  const [quoteNote, setQuoteNote] = useState('');

  // ── Comments bottom sheet — SHARED component (identical to feed cards) so
  // count/list/avatars/replies can never drift between surfaces again.
  // Delta tracks sends made through the sheet this visit so the page badge
  // stays consistent with what the user actually sees posted.
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDelta, setCommentDelta] = useState(0);
  useEffect(() => {
    setCommentDelta(0);
  }, [postId]);
  const openComments = () => setCommentsOpen(true);
  const closeComments = () => setCommentsOpen(false);

  // Record view for the Recently Viewed rail
  useEffect(() => {
    if (postId) recordView(postId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Price-drop alert: fires ONLY when the listing has a REAL mrp above the
  // current price (a genuine drop). No invented previous prices. Fires once
  // per product per user — consumed ids live in per-user AsyncStorage.
  useEffect(() => {
    const alertKey = `${postId}:${user?.username ?? ''}`;
    if (!postId || !post || alertChecked.current === alertKey) return;
    if (!(post.mrp && post.mrp > post.price)) return;
    alertChecked.current = alertKey;
    const prevPrice = post.mrp;
    (async () => {
      try {
        const sKey = getSearchesKey();
        const aKey = getAlertsKey();
        const [rawSearches, rawFired, legacySearches, legacyFired] = await Promise.all([
          AsyncStorage.getItem(sKey),
          AsyncStorage.getItem(aKey),
          sKey !== SEARCHES_KEY_BASE ? AsyncStorage.getItem(SEARCHES_KEY_BASE) : Promise.resolve(null),
          aKey !== ALERTS_FIRED_KEY_BASE ? AsyncStorage.getItem(ALERTS_FIRED_KEY_BASE) : Promise.resolve(null),
        ]);
        let effSearches = rawSearches;
        if (effSearches === null && legacySearches !== null) {
          effSearches = legacySearches;
          try { await AsyncStorage.setItem(sKey, legacySearches); } catch {}
        }
        let effFired = rawFired;
        if (effFired === null && legacyFired !== null) {
          effFired = legacyFired;
          try { await AsyncStorage.setItem(aKey, legacyFired); } catch {}
        }
        const searches = effSearches ? (JSON.parse(effSearches) as SavedSearch[]) : [];
        let fired: string[] = [];
        if (effFired) {
          try {
            const parsed = JSON.parse(effFired);
            if (Array.isArray(parsed)) fired = parsed as string[];
          } catch {
            // corrupted data — start fresh
          }
        }
        if (!Array.isArray(searches)) return;
        const match = searches.find(
          (s) =>
            s.priceAlert &&
            !fired.includes(`${s.id}:${postId}`) &&
            (title.toLowerCase().includes(s.query.toLowerCase()) ||
              description.toLowerCase().includes(s.query.toLowerCase())),
        );
        if (!match) return;
        if (prevPrice <= price) return;
        fired = [...fired, `${match.id}:${postId}`];
        await AsyncStorage.setItem(getAlertsKey(), JSON.stringify(fired));
        addNotification({
          type: 'promotion',
          userName: sellerName,
          action: `Price drop: ${title}`,
          target: `Now ${formatPrice(price)} — was ${formatPrice(prevPrice)}`,
          targetId: postId,
        });
        setAlertDrop({ previous: prevPrice });
      } catch {
        // alert simulation is best-effort
      }
    })();
    // localPost/serverPost in deps (not the merged `post` below — it is
    // declared after this effect and referencing it here is a TDZ crash):
    // late-arriving cached/server rows must re-evaluate (the old
    // [postId, username] pair never refired, so cached listings never
    // alerted). The alertChecked ref keeps it once-per-product-per-user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.username, localPost, serverPost]);

  const post = posts.find((p) => p.id === postId) ?? serverPost;
  // Server title wins (create/edit persist it); legacy first-line fallback
  // only when no title travelled with the post.
  const title = post ? (post.title?.trim() || post.description.split('\n')[0]) : '';
  const sellerName = post ? post.sellerName : '';
  const sellerUsername = post ? post.sellerUsername : '';
  // Seller proof line: only surface likes when there is something real to show
  const sellerLocation = post
    ? post.likes > 0
      ? `${post.sellerLocation} · ${post.likes} ${post.likes === 1 ? 'like' : 'likes'}`
      : post.sellerLocation
    : '';
  const price = post ? post.price : 0;
  const category = post ? `${post.category}` : '';
  const description = post ? post.description : '';
  const verified = post ? post.verified : false;
  const following = isFollowing(sellerUsername);

  // Deterministic per-seller avatar (same derivation as the feed) — never one
  // shared stock face for every seller.
  const sellerAvatar = sellerUsername ? resolveAvatar(sellerUsername) : null;
  // Amazon-style trust row data: the users route aggregates EVERY delivered-order
  // review for this seller (avgRating/reviewCount). Silent on failure — a missing
  // rating must never block the PDP, and a seller with zero reviews shows nothing
  // (never a fabricated score).
  useEffect(() => {
    setSellerRating(null);
    if (!sellerUsername) return;
    let alive = true;
    serverApi
      .getUserProfile(sellerUsername)
      .then((res) => {
        if (!alive) return;
        const avg = Number(res.data?.user?.avgRating);
        const count = Number(res.data?.user?.reviewCount);
        if (Number.isFinite(avg) && avg > 0 && count > 0) setSellerRating({ avg, count });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sellerUsername]);
  const flow = getPostFlow(post ?? {});
  const isFood = post?.type === 'food_item';

  const saved = isBookmarked(postId);
  const mrp = post?.mrp && post.mrp > price ? post.mrp : null;
  // Discount recomputed from the SELECTED variant price below (offPctEff) —
  // the base-derived figure here is a fallback until variants resolve.
  const offPctBase = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;
  const stockLeft = post?.stockLeft;

  // Real post media first, deterministic seeded fallback last — never fake per-item images.
  const resolveImage = (p: { image?: string; images?: string[] } | undefined, pid: string) => ({
    uri: p?.image ?? p?.images?.[0] ?? resolveListingImage(p, pid).uri,
  });

  const recentProducts = recents
    .map((r) => posts.find((p) => p.id === r.postId))
    .filter((p): p is (typeof posts)[number] => Boolean(p && p.id !== postId && !hiddenPostIds.includes(p.id) && !mutedSellers.includes(p.sellerUsername) && hasRealImage(p)))
    .slice(0, 8);

  const handleToggleSave = () => {
    if (!post) return;
    if (saved) {
      removeBookmark(postId);
    } else {
      toggleBookmark({
        productId: postId,
        sellerName,
        sellerUsername,
        price: effectivePrice,
        description: title,
        savedAt: Date.now(),
      });
    }
  };

  const handleShare = () => {
    // Openable deep link (expo-router resolves susej://product/<id>): a bare
    // name+price string left recipients with nothing to tap.
    Share.share({ message: `${title} — ${formatPrice(effectivePrice)} on susej\nsusej://product/${postId}` }).catch(() => {});
  };

  // Multi-photo gallery: real post media only. Imageless listings render an
  // honest placeholder tile — never a stock/fake photo as product imagery.
  const gallery =
    post?.images && post.images.length > 0
      ? post.images.map((uri) => ({ uri }))
      : post?.image
        ? [{ uri: post.image }]
        : [];
  const showCarousel = gallery.length > 1;

  // Variant selection → adjusted price. Case-insensitive like checkout (a
  // seller case-rename used to show the base price / skip OOS here while
  // checkout charged the delta).
  const selectedDelta =
    post?.variants?.reduce((sum, v) => {
      const chosen = variantSelections[v.name];
      if (!chosen) return sum;
      const match = v.values.find((val) => String(val.label ?? '').trim().toLowerCase() === String(chosen).trim().toLowerCase());
      return sum + (match?.priceDelta ?? 0);
    }, 0) ?? 0;
  const effectivePrice = price + selectedDelta;
  // Per-SKU discount (Amazon parity): a +₹ premium variant is less off MRP
  // than the base — the badge and strikethrough must use effectivePrice.
  const offPct = mrp ? Math.round(((mrp - effectivePrice) / mrp) * 100) : offPctBase;

  const comments = post?.commentList ?? [];

  const similarItems = (() => {
    if (!post) return [];
    const base = posts.filter((p) => !hiddenPostIds.includes(p.id) && !mutedSellers.includes(p.sellerUsername) && hasRealImage(p));
    const sameCat = base.filter((p) => p.id !== post.id && p.category === post.category);
    const rest = base.filter((p) => p.id !== post.id && p.category !== post.category);
    return [...sameCat, ...rest].slice(0, 4);
  })();

  const handlePrimaryAction = () => {
    switch (flow.archetype) {
      case 'goods':
      case 'food':
        if (!post) return;
        // Industry-standard: sold-out listings cannot enter the cart.
        if (post.isSold) {
          Alert.alert('Sold out', 'This listing is no longer available.');
          return;
        }
        if (typeof stockLeft === 'number' && stockLeft <= 0) {
          Alert.alert('Out of stock', 'This listing is out of stock right now.');
          return;
        }
        // Per-variant stock: a selected value at 0 cannot be bought.
        const oosVariant = (post.variants ?? []).find((v) => {
          const chosen = variantSelections[v.name];
          if (!chosen) return false;
          const match = v.values.find((val) => String(val.label ?? '').trim().toLowerCase() === String(chosen).trim().toLowerCase());
          return !!match && typeof match.stock === 'number' && match.stock <= 0;
        });
        if (oosVariant) {
          Alert.alert('Out of stock', `“${variantSelections[oosVariant.name]}” is out of stock. Please choose another option.`);
          return;
        }
        // Tracked options REQUIRE a pick: the server rejects unlabeled lines
        // on stock-tracked variant listings (it can neither check nor
        // decrement an unpicked option) — surface "choose options" HERE, not
        // as a failed order.
        const trackedVariants = (post.variants ?? []).some((v) =>
          Array.isArray(v?.values) && v.values.some((x) => typeof x?.stock === 'number')
        );
        const pickedCount = Object.values(variantSelections).filter((s) => !!s).length;
        if (trackedVariants && pickedCount === 0 && (post.variants ?? []).some((v) => (v?.values ?? []).length > 0)) {
          Alert.alert('Choose options', 'This listing has options (size, color, …) — pick one before adding to cart.');
          return;
        }
        // Single-seller cart: explain instead of silently landing on an
        // unchanged cart (CartContext.addToCart returns false on reject).
        // Variant choices travel with the item so the server can reject a
        // selection that went out of stock after this page loaded.
        const variantLabel = Object.entries(variantSelections)
          .filter(([, label]) => label)
          .map(([group, label]) => `${group}:${label}`)
          .join(', ');
        const added = addToCart({
          listingId: post.id,
          type: flow.archetype === 'food' ? 'food_item' : 'product',
          name: title,
          price: effectivePrice,
          seller: post.sellerName,
          sellerUsername: post.sellerUsername,
          ...(variantLabel ? { variantLabel } : {}),
        });
        if (!added) {
          Alert.alert(
            'Cart belongs to another seller',
            'Your cart already has items from a different store. Checkout or clear it before adding this item.'
          );
          return;
        }
        router.push('/cart');
        return;
      case 'service':
        // Carry the listing context so booking knows WHAT is being booked.
        router.push(`/book-service?listingId=${encodeURIComponent(post?.id ?? '')}&title=${encodeURIComponent(title)}`);
        return;
      case 'job':
        setApplyName(user?.name ?? '');
        setApplyPhone('');
        setApplyNote('');
        setApplyVisible(true);
        return;
      case 'enquire':
        setEnquireNote(`Hi ${sellerName}, I'm interested in ${title}.`);
        setEnquireDay('');
        setEnquireVisible(true);
        return;
      case 'quote':
        setQuoteQty('');
        setQuoteNote('');
        setQuoteVisible(true);
        return;
    }
  };

  const handleSubmitApplication = () => {
    setApplyVisible(false);
    const msg = `Hi ${sellerName}, I'd like to apply for "${title}". Details: ${applyName || '—'}${applyPhone ? `, ${applyPhone}` : ''}.${applyNote ? ` ${applyNote}` : ''}`;
    router.push(`/(tabs)/chat?to=${encodeURIComponent(sellerUsername)}&msg=${encodeURIComponent(msg)}`);
  };

  const handleSubmitEnquiry = () => {
    setEnquireVisible(false);
    const msg = `${enquireNote || `Hi ${sellerName}, I'm interested in ${title}.`}${enquireDay ? ` Preferred day: ${enquireDay}.` : ''}`;
    router.push(`/(tabs)/chat?to=${encodeURIComponent(sellerUsername)}&msg=${encodeURIComponent(msg)}`);
  };

  const handleSubmitQuote = () => {
    setQuoteVisible(false);
    const msg = `Hi ${sellerName}, I'd like a quote for "${title}".${quoteQty ? ` Quantity: ${quoteQty}.` : ''}${quoteNote ? ` ${quoteNote}` : ''}`;
    router.push(`/(tabs)/chat?to=${encodeURIComponent(sellerUsername)}&msg=${encodeURIComponent(msg)}`);
  };

  const handleBlockSeller = async () => {
    try {
      const bKey = getBlockedKey();
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
          // corrupted data — start fresh
        }
      }
      if (!list.some((b) => b.username === sellerUsername)) {
        list = [...list, { username: sellerUsername, name: sellerName }];
        await AsyncStorage.setItem(getBlockedKey(), JSON.stringify(list));
      }
      Alert.alert('User blocked', `@${sellerUsername} can no longer see your profile, posts or message you.`);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const handleReport = () => {
    Alert.alert('Report this listing', `Flag "${title}" for review by our safety team?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block seller', style: 'destructive', onPress: handleBlockSeller },
      {
        text: 'Report',
        onPress: async () => {
          if (!postId) return;
          const filed = await reportPost(postId, 'Reported from product page');
          Alert.alert(
            filed ? 'Report submitted' : 'Report not sent',
            filed
              ? 'Our team will review this report.'
              : 'Check your connection and try again — nothing was filed.'
          );
        },
      },
    ]);
  };

  // Honest states: spinner while loading, not-found for unknown/missing ids —
  // never a fake fallback product.
  if (!loaded || (!post && !serverMiss)) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.surface }}>
        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
          Loading…
        </Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.surface }}>
        <TouchableOpacity
          className="absolute flex-row items-center"
          style={{ top: insets.top + 16, left: 20 }}
          onPress={() => router.back()}
        >
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ opacity: 0.35 }}>
          <ShopIcon size={40} color={colors.textSecondary} />
        </View>
        <Text className="font-inter-700 mt-4 text-textPrimary" style={{ fontSize: 18, lineHeight: 28 }}>
          Listing not found
        </Text>
        <Text className="font-inter-400 text-center mt-1 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
          This listing may have been removed by the seller or is no longer available.
        </Text>
        <TouchableOpacity
          className="mt-6 px-6 h-12 items-center justify-center rounded-figma-16"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => router.replace('/(tabs)/feed')}
        >
          <Text className="font-inter-600 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
            Browse the feed
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Industry standard: imageless listings hidden from everyone (even seller in user feed) — only in seller dashboard under review until image added
  const noImage = !hasRealImage(post);
  if (noImage) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.surface }}>
        <TouchableOpacity className="absolute flex-row items-center" style={{ top: insets.top + 16, left: 20 }} onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: colors.error }}>
          <Text style={{ fontSize: 28 }}>⚠</Text>
        </View>
        <Text className="font-inter-700 text-center" style={{ fontSize: 18, lineHeight: 24, color: colors.textPrimary }}>Listing hidden</Text>
        <Text className="font-inter-400 text-center mt-2" style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
          This listing has no image and is hidden from the feed until the seller adds one. Sellers can fix it in My Listings → Needs Image.
        </Text>
        <TouchableOpacity className="mt-6 px-6 h-12 items-center justify-center rounded-figma-16" style={{ backgroundColor: colors.primaryContainer }} onPress={() => router.replace('/(tabs)/feed')}>
          <Text className="font-inter-600" style={{ fontSize: 14, color: '#fff' }}>Back to feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surfaceContainerLowest }}>
      {/* Header — collapses from brand logo to OLX-style detail header
          (back + truncated title + price + share) once scrolled past the gallery */}
      <View className="flex-row items-center justify-between px-5" style={{ backgroundColor: colors.surface, height: 64 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        {showCompactHeader ? (
          <>
            <Text className="flex-1 font-inter-600 text-textPrimary text-center mx-3" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
              {title}
            </Text>
            {flow.archetype === 'goods' ? (
              <Text className="font-inter-700 text-primary mr-3" style={{ fontSize: 15, lineHeight: 20 }}>
                {formatPrice(effectivePrice)}
              </Text>
            ) : (
              <View className="mr-3" />
            )}
            <TouchableOpacity onPress={handleShare}>
              <ShareIcon size={18} color={colors.secondary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="font-inter-700 text-primary" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.8 }}>
              susej
            </Text>
            <TouchableOpacity onPress={() => router.push('/cart')}>
              <ShopIcon size={22} color={colors.secondary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const past = e.nativeEvent.contentOffset.y > 360;
          if (past !== showCompactHeader) setShowCompactHeader(past);
        }}
      >
        {/* Price alert banner */}
        {alertDrop ? (
          <View
            className="flex-row items-center mx-5 mt-4 px-4 py-3 rounded-figma-16"
            style={{ backgroundColor: colors.surfaceContainerLow }}
          >
            <BellIcon size={16} color={colors.primaryContainer} />
            <Text className="flex-1 font-inter-500 ml-2.5" style={{ fontSize: 13, lineHeight: 18, color: colors.tertiary }}>
              Price alert: down from {formatPrice(alertDrop.previous)} to {formatPrice(price)}
            </Text>
          </View>
        ) : null}
        {/* Product Image */}
        <View className="w-full aspect-square bg-surfaceContainer relative">
          {gallery.length > 0 ? (
            showCarousel ? (
              <View className="w-full h-full">
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const page = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                    setActiveImage(Math.max(0, Math.min(page, gallery.length - 1)));
                  }}
                >
                  {gallery.map((src, i) => (
                    <View key={i} style={{ width: screenWidth }}>
                      <Image source={src} className="w-full h-full" resizeMode="cover" />
                    </View>
                  ))}
                </ScrollView>
                {/* Page dots */}
                {gallery.length > 1 && (
                  <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center" style={{ gap: 6 }}>
                    {gallery.map((_, i) => (
                      <View
                        key={i}
                        className="rounded-full"
                        style={{
                          width: i === activeImage ? 18 : 6,
                          height: 6,
                          backgroundColor: i === activeImage ? colors.onPrimary : 'rgba(255,255,255,0.6)',
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <Image source={gallery[0]} className="w-full h-full" resizeMode="cover" />
            )
          ) : (
            <View className="w-full h-full items-center justify-center" accessibilityLabel="No product photo provided">
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
                No photo provided by seller
              </Text>
            </View>
          )}
          {/* Amazon-style circular discount badge on the image */}
          {offPct ? (
            <View
              className="absolute top-4 left-4 z-10 w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primaryContainer }}
            >
              <Text className="font-inter-700 text-white" style={{ fontSize: 12, lineHeight: 15 }}>
                {offPct}%
              </Text>
              <Text className="font-inter-500 text-white" style={{ fontSize: 8, lineHeight: 10, letterSpacing: 0.5 }}>
                OFF
              </Text>
            </View>
          ) : null}

          {/* Save + Share gallery controls (industry-standard) */}
          <View className="absolute bottom-4 right-4 z-10 flex-row" style={{ gap: 8 }}>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 }}
              onPress={handleToggleSave}
            >
              <HeartIcon size={20} color={saved ? colors.error : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 }}
              onPress={handleShare}
            >
              <ShareIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 pt-6">
          {/* Product Info */}
          <Text className="font-inter-400 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 24 }}>
            {title}
          </Text>

          {/* Category (left) + Price with MRP strikethrough + % off (right) */}
          <View className="flex-row items-center mb-3">
            <Text className="flex-1 font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              {category}
            </Text>
            {flow.archetype === 'goods' ? (
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 24, lineHeight: 30 }}>
                  {formatPrice(effectivePrice)}
                </Text>
                {mrp ? (
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 18, textDecorationLine: 'line-through' }}>
                    {formatPrice(mrp)}
                  </Text>
                ) : null}
                {offPct ? (
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.success }}>
                    {offPct}% off
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 20, lineHeight: 26 }}>
                {flow.priceLabel} {formatFlowPrice(effectivePrice, flow.priceSuffix)}
              </Text>
            )}
          </View>

          {/* Seller identity — Amazon-style progressive trust funnel: who sells
              it is established right after what it costs, before the buy decision */}
          <View className="flex-row items-center mb-4 px-4 py-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <TouchableOpacity
              className="flex-row items-center flex-1"
              onPress={() => router.push(`/seller/${sellerUsername}`)}
            >
              <View className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                {sellerAvatar ? (
                  <Image source={sellerAvatar} className="w-12 h-12 rounded-full" />
                ) : (
                  <View className="w-9 h-9 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
                )}
              </View>
              <View className="flex-1 mr-1">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
                    {sellerName}
                  </Text>
                  {verified && <VerifiedIcon size={16} />}
                </View>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                  {sellerLocation}
                </Text>
              </View>
              <ChevronRightIcon size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              className="px-5 py-2 rounded-figma-full"
              style={{ backgroundColor: following ? colors.surfaceContainer : colors.primaryContainer }}
              onPress={() => toggleFollow(sellerUsername)}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Seller rating — REAL aggregate from the users route (Amazon trust row);
              hidden entirely when the seller has no reviews yet (never fabricated) */}
          {sellerRating && (
            <TouchableOpacity
              className="flex-row items-center mb-3 px-4 py-2 rounded-figma-16"
              style={{ backgroundColor: colors.surfaceContainerLow }}
              onPress={() => router.push(`/seller/${sellerUsername}`)}
              accessibilityRole="button"
              accessibilityLabel={'Seller rating ' + sellerRating.avg + ' out of 5 from ' + sellerRating.count + ' reviews'}
            >
              <StarIcon size={14} color="#f59e0b" />
              <Text className="font-inter-600 text-textPrimary ml-1.5" style={{ fontSize: 13, lineHeight: 16 }}>
                {sellerRating.avg}
              </Text>
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 12, lineHeight: 16 }}>
                ({sellerRating.count} review{sellerRating.count === 1 ? '' : 's'})
              </Text>
              <View className="flex-1" />
              <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.tertiary }}>
                See reviews
              </Text>
            </TouchableOpacity>
          )}

          {/* Stock scarcity hint */}
          {stockLeft != null && stockLeft <= 5 ? (
            <Text className="font-inter-500 mb-3" style={{ fontSize: 12, lineHeight: 16, color: colors.tertiary }}>
              Only {stockLeft} left in stock — order soon
            </Text>
          ) : null}

          {/* Delivery card (goods only — food shows ETA below, services book via calendar) */}
          {flow.archetype === 'goods' ? (
            <View className="flex-row items-center mb-3 px-4 py-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <MapPinIcon size={16} color={colors.primaryContainer} />
              <View className="flex-1 ml-2">
                <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
                  {post?.deliveryMode === 'pickup'
                    ? `Pickup from ${post.sellerLocation || post.listingLocation || 'seller'}`
                    : post?.deliveryMode === 'shipping'
                      ? `Ships from ${post.sellerLocation || post.listingLocation || 'seller'}`
                      : post?.deliveryMode === 'local'
                        ? `Local delivery${post.listingLocation || post.sellerLocation ? ` in ${post.listingLocation || post.sellerLocation}` : ' in your area'}`
                        : post?.listingLocation ? `Selling from ${post.listingLocation}` : 'Deliver to your area'}
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                  {post?.deliveryMode === 'pickup'
                    ? 'Arrange pickup with the seller'
                    : post?.deliveryMode === 'shipping'
                      ? 'Seller ships this item · delivery fee at checkout'
                      : post?.deliveryMode === 'local'
                        ? 'Local delivery · fee at checkout'
                        : 'Delivery fee at checkout'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Trust strip — 'Verified Seller' only when the seller really is */}
          <View className="flex-row items-center justify-between mb-4 px-4 py-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
            {[
              ...(verified ? ['Verified Seller'] : []),
              'Wallet & COD',
              'Refund support',
            ].map((label) => (
              <View key={label} className="flex-row items-center" style={{ gap: 4 }}>
                <CheckIcon size={12} color={colors.primaryContainer} />
                <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Variant selector */}
          {post?.variants && post.variants.length > 0 ? (
            post.variants.map((v) => {
              const selected = variantSelections[v.name];
              return (
                <View key={v.name} className="mb-4">
                  <Text className="font-inter-500 mb-2" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textSecondary }}>
                    {v.name.toUpperCase()}
                  </Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {v.values.map((val) => {
                      const active = selected === val.label;
                      // Per-value stock: 0 = sold out (dimmed, still tappable
                      // so the buyer sees WHY it can't be added).
                      const oos = typeof val.stock === 'number' && val.stock <= 0;
                      return (
                        <TouchableOpacity
                          key={val.label}
                          className="px-4 py-2 rounded-full"
                          style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer, opacity: oos && !active ? 0.45 : 1 }}
                          onPress={() =>
                            setVariantSelections((prev) => ({ ...prev, [v.name]: active ? '' : val.label }))
                          }
                        >
                          <Text
                            className="font-inter-600"
                            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: active ? colors.onPrimaryContainer : colors.textSecondary }}
                          >
                            {val.label}
                            {val.priceDelta ? `  +${formatPrice(val.priceDelta)}` : ''}
                            {oos ? ' · out' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          ) : null}

          {/* Food timing — no logistics integration exists, so no invented
              ETA. Timing is arranged with the seller (chat CTA below). */}
          {isFood ? (
            <View className="flex-row items-center mb-4">
              <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.success }} />
              <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: colors.success }}>
                Food order · delivery time confirmed in chat
              </Text>
            </View>
          ) : null}

          {/* Report link */}
          <TouchableOpacity className="self-end mb-6" onPress={handleReport}>
            <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
              Report listing
            </Text>
          </TouchableOpacity>

          {/* DESCRIPTION */}
          <Text className="font-inter-400 text-textSecondary mb-2" style={{ fontSize: 11, lineHeight: 16.5, letterSpacing: 0.55 }}>
            DESCRIPTION
          </Text>
          <Text className="font-inter-400 text-textPrimary mb-8" style={{ fontSize: 14, lineHeight: 22.75 }}>
            {description}
          </Text>

          {/* Comments — IG pattern: summary row opens the bottom-sheet thread */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openComments}
            className="flex-row items-center justify-between mb-4 px-4 py-3.5 rounded-figma-16"
            style={{ backgroundColor: colors.surfaceContainerLow }}
          >
            <View className="flex-row items-center">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                Comments
              </Text>
              <View className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                  {(postId.startsWith('post_') ? (Array.isArray(post?.commentList) ? post.commentList.length : 0) : post ? post.comments : 0) + commentDelta}
                </Text>
              </View>
            </View>
            <Text className="font-inter-500 text-primary" style={{ fontSize: 13, lineHeight: 16 }}>
              View all
            </Text>
          </TouchableOpacity>

          {/* Similar Items Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              Similar Items
            </Text>
            <TouchableOpacity onPress={() => router.push(`/category/${post?.category?.toLowerCase().replace(/\s+/g, '-') ?? 'all'}`)}>
              <Text className="font-inter-600 text-primary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {/* Similar Items Grid */}
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {similarItems.map((item) => {
              const simSaved = isBookmarked(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  className="rounded-figma-12 overflow-hidden"
                  style={{ width: (392 - 40 - 8) / 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, backgroundColor: colors.surfaceContainerLowest }}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <View className="w-full aspect-square bg-surfaceContainer">
                    <Image source={resolveImage(item, item.id)} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      className="absolute top-2 right-2 w-8 h-8 items-center justify-center rounded-figma-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (isBookmarked(item.id)) removeBookmark(item.id);
                        else
                          toggleBookmark({
                            productId: item.id,
                            sellerName: item.sellerName,
                            sellerUsername: item.sellerUsername,
                            price: item.price,
                            description: item.description.split('\n')[0],
                            savedAt: Date.now(),
                          });
                      }}
                    >
                      <HeartIcon size={16} color={simSaved ? colors.error : colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View className="p-3">
                    <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }} numberOfLines={1}>
                      {item.description.split('\n')[0]}
                    </Text>
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                      {formatPrice(item.price)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Recently viewed rail (industry standard after similar items) */}
          {recentProducts.length > 0 ? (
            <View className="mt-8">
              <Text className="font-inter-600 text-textPrimary mb-3" style={{ fontSize: 16, lineHeight: 24 }}>
                Recently viewed
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {recentProducts.map((rp) => (
                  <TouchableOpacity key={rp.id} style={{ width: 96 }} onPress={() => router.push(`/product/${rp.id}`)}>
                    <View className="w-[96px] h-[96px] rounded-figma-16 overflow-hidden bg-surfaceContainer">
                      <Image source={resolveImage(rp, rp.id)} className="w-full h-full" resizeMode="cover" />
                    </View>
                    <Text className="font-inter-600 text-textPrimary mt-2" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }} numberOfLines={1}>
                      {rp.description.split('\n')[0]}
                    </Text>
                    <Text className="font-inter-700 text-textPrimary mt-0.5" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
                      {formatPrice(rp.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View
        className="px-5 pt-3"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.surfaceContainerLowest,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceContainer,
        }}
      >
        <View className="flex-row gap-3">
          <TouchableOpacity className="flex-1 h-14 items-center justify-center rounded-figma-12" style={{ backgroundColor: colors.primaryContainer }} onPress={handlePrimaryAction}>
            <Text className="font-inter-400 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
              {flow.primaryCta}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 h-14 items-center justify-center rounded-figma-12 border"
            style={{ borderColor: colors.outlineVariant }}
            onPress={() =>
              router.push(
                `/(tabs)/chat?seller=${encodeURIComponent(sellerUsername)}&product=${encodeURIComponent(title)}&listing=${encodeURIComponent(String(id))}`
              )
            }
          >
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              {flow.secondaryCta}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Job application modal */}
      <Modal visible={applyVisible} transparent animationType="slide" onRequestClose={() => setApplyVisible(false)}>
        <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setApplyVisible(false)} />
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 24 }}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
            </View>
            <View className="flex-row items-center px-5 pt-3 pb-2">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                Apply for {title}
              </Text>
              <TouchableOpacity onPress={() => setApplyVisible(false)}>
                <CloseIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5" style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Text className="font-inter-600 text-textPrimary mb-2 mt-4" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                FULL NAME
              </Text>
              <TextInput
                className="h-12 px-4 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary }}
                placeholder="Full name"
                placeholderTextColor={colors.secondary}
                value={applyName}
                onChangeText={setApplyName}
              />
              <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                PHONE
              </Text>
              <TextInput
                className="h-12 px-4 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary }}
                placeholder="Phone number"
                placeholderTextColor={colors.secondary}
                keyboardType="phone-pad"
                value={applyPhone}
                onChangeText={setApplyPhone}
              />
              <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                WHY YOU'RE A FIT
              </Text>
              <TextInput
                className="px-4 py-3 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary, minHeight: 96, textAlignVertical: 'top' }}
                placeholder="Tell the employer why you're a fit"
                placeholderTextColor={colors.secondary}
                multiline
                value={applyNote}
                onChangeText={setApplyNote}
              />
              <TouchableOpacity
                className="h-14 items-center justify-center rounded-figma-12 mb-4"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={handleSubmitApplication}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
                  {flow.primaryCta}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Enquiry modal */}
      <Modal visible={enquireVisible} transparent animationType="slide" onRequestClose={() => setEnquireVisible(false)}>
        <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setEnquireVisible(false)} />
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 24 }}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
            </View>
            <View className="flex-row items-center px-5 pt-3 pb-2">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                Enquire
              </Text>
              <TouchableOpacity onPress={() => setEnquireVisible(false)}>
                <CloseIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5" style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Text className="font-inter-600 text-textPrimary mb-2 mt-4" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                MESSAGE
              </Text>
              <TextInput
                className="px-4 py-3 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary, minHeight: 96, textAlignVertical: 'top' }}
                multiline
                value={enquireNote}
                onChangeText={setEnquireNote}
              />
              {flow.secondaryCta.includes('Visit') || flow.secondaryCta.includes('Test Drive') ? (
                <>
                  <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                    PREFERRED DAY
                  </Text>
                  <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                    {['Today', 'Tomorrow', 'This weekend'].map((d) => {
                      const active = enquireDay === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          className="px-4 h-10 items-center justify-center rounded-figma-full"
                          style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                          onPress={() => setEnquireDay(active ? '' : d)}
                        >
                          <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: active ? colors.onPrimary : colors.textSecondary }}>
                            {d}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <TouchableOpacity
                className="h-14 items-center justify-center rounded-figma-12 mb-4"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={handleSubmitEnquiry}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
                  {flow.primaryCta}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quote request modal */}
      <Modal visible={quoteVisible} transparent animationType="slide" onRequestClose={() => setQuoteVisible(false)}>
        <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setQuoteVisible(false)} />
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 24 }}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
            </View>
            <View className="flex-row items-center px-5 pt-3 pb-2">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                Get Quote
              </Text>
              <TouchableOpacity onPress={() => setQuoteVisible(false)}>
                <CloseIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5" style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Text className="font-inter-600 text-textPrimary mb-2 mt-4" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                QUANTITY
              </Text>
              <TextInput
                className="h-12 px-4 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary }}
                placeholder="How many units?"
                placeholderTextColor={colors.secondary}
                keyboardType="numeric"
                value={quoteQty}
                onChangeText={setQuoteQty}
              />
              <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.2 }}>
                NOTE
              </Text>
              <TextInput
                className="px-4 py-3 mb-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary, minHeight: 96, textAlignVertical: 'top' }}
                placeholder="Any specifications or delivery requirements?"
                placeholderTextColor={colors.secondary}
                multiline
                value={quoteNote}
                onChangeText={setQuoteNote}
              />
              <TouchableOpacity
                className="h-14 items-center justify-center rounded-figma-12 mb-4"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={handleSubmitQuote}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
                  {flow.primaryCta}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comments bottom sheet — SHARED with feed cards (single implementation:
          real thread fetch, avatar images, per-comment like, replies) */}
      <CommentsSheet
        visible={commentsOpen}
        postId={postId ?? ''}
        onClose={closeComments}
        onCountChange={(d) => setCommentDelta((x) => x + d)}
        fallbackComments={Array.isArray(post?.commentList) ? post.commentList : []}
      />
    </View>
  );
}

