import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, Modal, Share, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ChevronRightIcon, VerifiedIcon, ShopIcon, SendIcon, BellIcon, CloseIcon, HeartIcon, ShareIcon, MapPinIcon, CheckIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { getPostFlow, formatFlowPrice } from '../../utils/categoryFlow';
import { usePosts } from '../../contexts/PostContext';
import { useFollow } from '../../contexts/FollowContext';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { useBookmark } from '../../contexts/BookmarkContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { productDetailImages } from '../../utils/screenImages';
import { productImages } from '../../utils/productImages';

const FALLBACK = {
  title: 'Aura Minimalist Satchel',
  category: 'Accessories · New with tags',
  price: 420,
  description:
    'Elevate your daily ensemble with the Aura Satchel.\nCrafted from premium Italian pebble-grain leather',
  sellerName: 'Julianne V.',
  sellerUsername: 'juliannev',
  sellerLocation: '4.9 (128 reviews)',
  verified: false,
};

const BLOCKED_KEY = '@susej_blocked';
const SEARCHES_KEY = '@susej_saved_searches';
const ALERTS_FIRED_KEY = '@susej_alerts_fired';

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
  const { posts, addComment, reportPost, loaded } = usePosts();
  const { isFollowing, toggleFollow } = useFollow();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { recents, record: recordView } = useRecentlyViewed();
  const { isBookmarked, toggleBookmark, removeBookmark } = useBookmark();
  const { addNotification } = useNotifications();
  const [commentText, setCommentText] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [alertDrop, setAlertDrop] = useState<{ previous: number } | null>(null);
  const alertChecked = useRef<string>('');
  const [applyVisible, setApplyVisible] = useState(false);
  const [applyName, setApplyName] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [enquireVisible, setEnquireVisible] = useState(false);
  const [enquireNote, setEnquireNote] = useState('');
  const [enquireDay, setEnquireDay] = useState('');
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteQty, setQuoteQty] = useState('');
  const [quoteNote, setQuoteNote] = useState('');

  // Record view for the Recently Viewed rail
  useEffect(() => {
    if (postId) recordView(postId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Price-drop alert simulation: match saved searches (priceAlert on) against
  // product name/description; a deterministic "previous price" (price * 1.15)
  // models a drop. Fires once per product — consumed ids live in AsyncStorage.
  useEffect(() => {
    if (!postId || !post || alertChecked.current === postId) return;
    alertChecked.current = postId;
    const prevPrice = Math.round(price * 1.15);
    (async () => {
      try {
        const [rawSearches, rawFired] = await Promise.all([
          AsyncStorage.getItem(SEARCHES_KEY),
          AsyncStorage.getItem(ALERTS_FIRED_KEY),
        ]);
        const searches = rawSearches ? (JSON.parse(rawSearches) as SavedSearch[]) : [];
        let fired: string[] = [];
        if (rawFired) {
          try {
            const parsed = JSON.parse(rawFired);
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
        await AsyncStorage.setItem(ALERTS_FIRED_KEY, JSON.stringify(fired));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const post = posts.find((p) => p.id === postId);
  const title = post ? post.description.split('\n')[0] : FALLBACK.title;
  const sellerName = post ? post.sellerName : FALLBACK.sellerName;
  const sellerUsername = post ? post.sellerUsername : FALLBACK.sellerUsername;
  const sellerLocation = post ? `${post.sellerLocation} · ${post.likes} likes` : FALLBACK.sellerLocation;
  const price = post ? post.price : FALLBACK.price;
  const category = post ? `${post.category}` : FALLBACK.category;
  const description = post ? post.description : FALLBACK.description;
  const verified = post ? post.verified : FALLBACK.verified;
  const following = isFollowing(sellerUsername);

  const sellerAvatar = productDetailImages.sellerAvatar;
  const flow = getPostFlow(post ?? {});
  const isFood = post?.type === 'food_item';

  const saved = isBookmarked(postId);
  const mrp = post?.mrp && post.mrp > price ? post.mrp : null;
  const offPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;
  const stockLeft = post?.stockLeft;
  const deliveryCity = user?.location?.split(',')[0].trim() || 'your area';
  const arrival = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  // Real post media first, canned figma assets as fallback — never fake per-item images.
  const resolveImage = (p: { image?: string; images?: string[] } | undefined, pid: string) =>
    p?.image ?? p?.images?.[0] ?? productImages[pid] ?? { uri: `https://picsum.photos/seed/${pid}/800/1000` };

  const recentProducts = recents
    .map((r) => posts.find((p) => p.id === r.postId))
    .filter((p): p is (typeof posts)[number] => Boolean(p && p.id !== postId))
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
    Share.share({ message: `${title} — ${formatPrice(effectivePrice)} on susej` }).catch(() => {});
  };

  // Multi-photo gallery: real post media first (industry), Figma pager as fallback.
  // Honest volume: only show dots when the post actually has >1 photo.
  const gallery =
    post?.images && post.images.length > 0
      ? post.images.map((uri) => ({ uri }))
      : post?.image
        ? [{ uri: post.image }]
        : productDetailImages.gallery;
  const showCarousel = gallery.length > 1;

  // Variant selection → adjusted price
  const selectedDelta =
    post?.variants?.reduce((sum, v) => {
      const chosen = variantSelections[v.name];
      if (!chosen) return sum;
      const match = v.values.find((val) => val.label === chosen);
      return sum + (match?.priceDelta ?? 0);
    }, 0) ?? 0;
  const effectivePrice = price + selectedDelta;

  const comments = post?.commentList ?? [];

  const similarItems = (() => {
    if (!post) return [];
    const sameCat = posts.filter((p) => p.id !== post.id && p.category === post.category);
    const rest = posts.filter((p) => p.id !== post.id && p.category !== post.category);
    return [...sameCat, ...rest].slice(0, 4);
  })();

  const handlePrimaryAction = () => {
    switch (flow.archetype) {
      case 'goods':
      case 'food':
        if (!post) return;
        addToCart({
          listingId: post.id,
          type: flow.archetype === 'food' ? 'food_item' : 'product',
          name: title,
          price: effectivePrice,
          seller: post.sellerName,
          sellerUsername: post.sellerUsername,
        });
        router.push('/cart');
        return;
      case 'service':
        router.push('/book-service');
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

  const handleSendComment = () => {
    const text = commentText.trim();
    if (!post || !text) return;
    addComment(post.id, { author: user?.name || 'You', text });
    setCommentText('');
  };

  const handleBlockSeller = async () => {
    try {
      const raw = await AsyncStorage.getItem(BLOCKED_KEY);
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
        await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(list));
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
        onPress: () => {
          if (postId) reportPost(postId, 'Reported from product page');
          Alert.alert('Report submitted', 'We will review this listing and take action within 24 hours.');
        },
      },
    ]);
  };

  // Honest states: spinner while loading, not-found instead of a fake fallback product
  if (postId && !loaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.surface }}>
        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
          Loading…
        </Text>
      </View>
    );
  }

  if (postId && loaded && !post) {
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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surfaceContainerLowest }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ backgroundColor: colors.surface, height: 64 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="font-inter-700 text-primary" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.8 }}>
          susej
        </Text>
        <TouchableOpacity onPress={() => router.push('/cart')}>
          <ShopIcon size={22} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
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
          ) : null}
          {/* Price overlay */}
          <View className="absolute top-4 right-4 z-10">
            <View className="bg-primaryContainer rounded-full px-3 py-1">
              <Text className="font-inter-700 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                {flow.archetype === 'goods'
                  ? formatPrice(effectivePrice)
                  : `${flow.priceLabel} ${formatFlowPrice(effectivePrice, flow.priceSuffix)}`}
              </Text>
            </View>
          </View>

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
                <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
                  {formatPrice(effectivePrice)}
                </Text>
                {mrp ? (
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 13, lineHeight: 18, textDecorationLine: 'line-through' }}>
                    {formatPrice(mrp)}
                  </Text>
                ) : null}
                {offPct ? (
                  <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.success }}>
                    {offPct}% off
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                {flow.priceLabel} {formatFlowPrice(effectivePrice, flow.priceSuffix)}
              </Text>
            )}
          </View>

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
                <View className="flex-row items-center">
                  <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                    Deliver to {deliveryCity}
                  </Text>
                  {post?.delivery !== false ? (
                    <Text className="font-inter-600 ml-2" style={{ fontSize: 12, lineHeight: 16, color: colors.success }}>
                      Free
                    </Text>
                  ) : null}
                </View>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                  Arrives by {arrival}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Trust strip */}
          <View className="flex-row items-center justify-between mb-4 px-4 py-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
            {['Verified Seller', 'Secure Payment', 'Easy Returns'].map((label) => (
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
                      return (
                        <TouchableOpacity
                          key={val.label}
                          className="px-4 py-2 rounded-full"
                          style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
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
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          ) : null}

          {/* Food delivery ETA */}
          {isFood ? (
            <View className="flex-row items-center mb-4">
              <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.success }} />
              <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: colors.success }}>
                Arriving in 30–40 min
              </Text>
            </View>
          ) : null}

          {/* Seller Info */}
          <View className="flex-row items-center mb-6 px-4 py-3 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
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
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                  Replies in ~1 hour
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

          {/* Report link */}
          <TouchableOpacity className="self-end -mt-4 mb-6" onPress={handleReport}>
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

          {/* Comments */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
              Comments
            </Text>
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
              {post ? post.comments : 0}
            </Text>
          </View>

          {comments.length === 0 ? (
            <View className="items-center py-6 mb-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
                No comments yet — be the first
              </Text>
            </View>
          ) : (
            comments.map((c, i) => (
              <View key={`${c.time}_${i}`} className="mb-4">
                <View className="flex-row items-center mb-1">
                  <View className="w-8 h-8 rounded-full mr-2" style={{ backgroundColor: colors.surfaceContainer }} />
                  <Text className="font-inter-600 text-textPrimary flex-1" style={{ fontSize: 13, lineHeight: 16 }}>
                    {c.author}
                  </Text>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                    {formatCommentTime(c.time)}
                  </Text>
                </View>
                <Text className="font-inter-400 text-textPrimary ml-10" style={{ fontSize: 14, lineHeight: 20 }}>
                  {c.text}
                </Text>
              </View>
            ))
          )}

          {/* Comment composer */}
          <View className="flex-row items-center mb-8">
            <TextInput
              className="flex-1 h-12 px-4 mr-3 rounded-figma-16"
              style={{ backgroundColor: colors.surfaceContainerLow, color: colors.textPrimary }}
              placeholder="Add a comment…"
              placeholderTextColor={colors.secondary}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              className="w-12 h-12 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: commentText.trim() ? colors.primaryContainer : colors.surfaceContainer }}
              onPress={handleSendComment}
            >
              <SendIcon size={20} color={commentText.trim() ? colors.onPrimary : colors.secondary} />
            </TouchableOpacity>
          </View>

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
            onPress={() => router.push(`/(tabs)/chat?seller=${encodeURIComponent(sellerUsername)}`)}
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
    </View>
  );
}
