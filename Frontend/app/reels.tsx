import { useState, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Animated, Share } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import PagerView from 'react-native-pager-view';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// v8 PagerView ships NativeProps with `orientation`; the ambient @types shim
// only declares initialPage/onPageSelected — augment the missing props here.
declare module 'react-native-pager-view' {
  interface PagerViewProps {
    orientation?: 'horizontal' | 'vertical';
  }
}
import {
  BackIcon,
  CloseIcon,
  HeartIcon,
  CommentIcon,
  ShareIcon,
  BookmarkIcon,
  VerifiedIcon,
  PlusIcon,
} from '../utils/icons';
import { colors } from '../utils/theme';
import { productImages } from '../utils/productImages';
import { usePosts, Post } from '../contexts/PostContext';
import { useCart } from '../contexts/CartContext';
import { useBookmark } from '../contexts/BookmarkContext';
import { MY_REELS_KEY, MyReel } from './create-reel';

// Helper for Image source — handles both require() (number) and uri strings
const imgSource = (img: string | number | undefined | null): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
};

// ─── Like animations: icon pop + floating heart burst ──────
type Burst = {
  id: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
  offsetX: number;
  index: number;
};

function useLikeAnimation() {
  const scale = useRef(new Animated.Value(1)).current;
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);

  const pop = useCallback(() => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scale]);

  const spawnBurst = useCallback(() => {
    const base = ++burstId.current;
    const next: Burst[] = [];
    for (let i = 0; i < 3; i++) {
      next.push({
        id: base * 10 + i,
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(1),
        offsetX: i - 1,
        index: i,
      });
    }
    setBursts((prev) => [...prev, ...next]);
    next.forEach((b, i) => {
      Animated.sequence([
        Animated.delay(i * 90),
        Animated.parallel([
          Animated.timing(b.translateY, { toValue: -80, duration: 900, useNativeDriver: true }),
          Animated.timing(b.opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setBursts((prev) => prev.filter((x) => x.id !== b.id));
      });
    });
  }, []);

  return { scale, bursts, pop, spawnBurst };
}

// Floating hearts layer — rendered inside the rail, above the like button
function BurstLayer({ bursts }: { bursts: Burst[] }) {
  return (
    <View pointerEvents="none" className="absolute items-center" style={{ bottom: 132 }}>
      {bursts.map((b) => (
        <Animated.View
          key={b.id}
          style={{
            position: 'absolute',
            bottom: 4 + b.index * 16,
            opacity: b.opacity,
            transform: [{ translateY: b.translateY }, { translateX: b.offsetX * 20 }],
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={colors.error}
            />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function useDoubleTapLike(onLike: () => void) {
  const lastPress = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastPress.current < 300) {
      lastPress.current = 0;
      onLike();
    } else {
      lastPress.current = now;
    }
  }, [onLike]);
}

function ReelCard({ post }: { post: Post }) {
  const { isLiked, toggleLike } = usePosts();
  const { scale, bursts, pop, spawnBurst } = useLikeAnimation();
  const { addToCart } = useCart();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const saved = isBookmarked(post.id);
  const liked = isLiked(post.id);
  const likeCount = post.likes;

  const handleToggleLike = () => {
    const nowLiked = toggleLike(post.id);
    if (nowLiked) {
      pop();
      spawnBurst();
    }
  };

  const handleDoubleTapLike = useDoubleTapLike(handleToggleLike);

  const handleShare = () => {
    const name = post.description.split('#')[0].trim();
    Share.share({ message: `Check this on susej: ${name} — https://susej.app/product/${post.id}` }).catch(
      () => {},
    );
  };

  const imageSource =
    imgSource(post.image ?? productImages[post.id]) ??
    ({ uri: `https://picsum.photos/seed/${post.id}/400/700` } as any);

  const handleBuy = () => {
    addToCart({
      listingId: post.id,
      type: post.type ?? 'product',
      name: post.description.split('#')[0].trim(),
      price: post.price,
      seller: post.sellerName,
      sellerUsername: post.sellerUsername,
    });
    router.push('/cart');
  };

  return (
    <View className="flex-1">
      {/* Full-bleed media */}
      <Image source={imageSource} className="absolute inset-0 w-full h-full" resizeMode="cover" />

      {/* Double-tap-to-like layer over the video area */}
      <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={handleDoubleTapLike} />

      {/* Bottom dark gradient + caption */}
      <LinearGradient
        colors={['transparent', colors.inverseSurface]}
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 320 }}
      />
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: 48 }}>
        <View className="pr-16">
          {post.type !== 'service' ? (
            <TouchableOpacity
              className="self-start bg-primaryContainer rounded-full px-6 py-2.5 mb-3"
              onPress={handleBuy}
            >
              <Text className="text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                Buy Now
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="self-start bg-primaryContainer rounded-full px-6 py-2.5 mb-3"
              onPress={() => router.push('/book-service')}
            >
              <Text className="text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                Book Now
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="flex-row items-center gap-1 mb-1 self-start"
            onPress={() => router.push(`/seller/${post.sellerUsername}`)}
          >
            <Text className="text-white font-inter-700" style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16 }}>
              @{post.sellerUsername}
            </Text>
            {post.verified && <VerifiedIcon size={14} />}
          </TouchableOpacity>
          <Text className="text-white font-inter-400" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
            {post.description}
          </Text>
        </View>
      </View>

      {/* Right action rail */}
      <View className="absolute right-4 items-center" style={{ bottom: 72, gap: 20 }}>
        <BurstLayer bursts={bursts} />

        <TouchableOpacity className="items-center" onPress={handleToggleLike} style={{ gap: 4 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <HeartIcon size={30} color={liked ? colors.error : colors.surfaceContainerLowest} />
          </Animated.View>
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center" onPress={() => router.push(`/product/${post.id}`)} style={{ gap: 4 }}>
          <CommentIcon size={28} color={colors.surfaceContainerLowest} />
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>{post.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center" onPress={handleShare} style={{ gap: 4 }}>
          <ShareIcon size={28} color={colors.surfaceContainerLowest} />
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center"
          style={{ gap: 4 }}
          onPress={() =>
            toggleBookmark({
              productId: post.id,
              sellerName: post.sellerName,
              sellerUsername: post.sellerUsername,
              price: post.price,
              description: post.description,
              imageUrl: typeof post.image === 'string' ? post.image : undefined,
              savedAt: Date.now(),
            })
          }
        >
          <BookmarkIcon size={28} color={saved ? colors.primaryContainer : colors.surfaceContainerLowest} />
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UserReelCard({ reel }: { reel: MyReel }) {
  const [liked, setLiked] = useState(false);
  const { scale, bursts, pop, spawnBurst } = useLikeAnimation();

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    if (next) {
      pop();
      spawnBurst();
    }
  };

  const handleDoubleTapLike = useDoubleTapLike(toggleLike);

  const handleShare = () => {
    Share.share({ message: `Check this on susej: ${reel.caption} — https://susej.app/reels` }).catch(
      () => {},
    );
  };

  return (
    <View className="flex-1">
      {/* Full-bleed media */}
      <Image source={{ uri: reel.image }} className="absolute inset-0 w-full h-full" resizeMode="cover" />

      {/* Double-tap-to-like layer over the video area */}
      <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={handleDoubleTapLike} />

      {/* Bottom dark gradient + caption */}
      <LinearGradient
        colors={['transparent', colors.inverseSurface]}
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 320 }}
      />
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: 48 }}>
        <View className="pr-16">
          <TouchableOpacity
            className="flex-row items-center gap-1 mb-1 self-start"
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text className="text-white font-inter-700" style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16 }}>
              @you
            </Text>
          </TouchableOpacity>
          <Text className="text-white font-inter-400" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
            {reel.caption}
          </Text>
        </View>
      </View>

      {/* Right action rail — simple like + share */}
      <View className="absolute right-4 items-center" style={{ bottom: 72, gap: 20 }}>
        <BurstLayer bursts={bursts} />

        <TouchableOpacity className="items-center" onPress={toggleLike} style={{ gap: 4 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <HeartIcon size={30} color={liked ? colors.error : colors.surfaceContainerLowest} />
          </Animated.View>
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>{liked ? 1 : 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center" onPress={handleShare} style={{ gap: 4 }}>
          <ShareIcon size={28} color={colors.surfaceContainerLowest} />
          <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 14 }}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const { posts } = usePosts();
  const insets = useSafeAreaInsets();
  const [myReels, setMyReels] = useState<MyReel[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(MY_REELS_KEY)
        .then((data) => {
          if (!active) return;
          if (data) {
            try {
              const parsed = JSON.parse(data);
              setMyReels(Array.isArray(parsed) ? (parsed as MyReel[]) : []);
            } catch {
              setMyReels([]);
            }
          } else {
            setMyReels([]);
          }
        })
        .catch(() => {
          if (active) setMyReels([]);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  if (posts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.inverseSurface, gap: 12 }}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
        <Text className="text-white font-inter-500" style={{ fontSize: 14, lineHeight: 20 }}>
          Loading reels...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.inverseSurface }}>
      <PagerView style={{ flex: 1 }} orientation="vertical">
        {myReels.map((reel) => (
          <View key={reel.id} style={{ flex: 1 }}>
            <UserReelCard reel={reel} />
          </View>
        ))}
        {posts.map((post) => (
          <View key={post.id} style={{ flex: 1 }}>
            <ReelCard post={post} />
          </View>
        ))}
      </PagerView>

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-4 bg-transparent" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={16} color={colors.surfaceContainerLowest} />
        </TouchableOpacity>
        <Text className="text-white font-inter-700" style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.5 }}>
          Reels
        </Text>
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/create-reel')}>
            <PlusIcon size={18} color={colors.surfaceContainerLowest} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <CloseIcon size={22} color={colors.surfaceContainerLowest} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
