import { useEffect, useMemo, useState, ReactNode } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, VerifiedIcon, HeartIcon } from '../utils/icons';
import { colors, formatPrice, getCategoryColor } from '../utils/theme';
import { usePosts, Post } from '../contexts/PostContext';
import { serverApi } from '../utils/serverApi';

const MAX_COMPARE = 3;
const LABEL_WIDTH = 96;
const VALUE_WIDTH = 140;

const CompareIcon = ({ size = 16, color = '#464555' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
      fill={color}
    />
  </Svg>
);

const imgSource = (img: string | number | undefined | null): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
};

const conditionOf = (post: Post): string => {
  if (typeof post.condition === 'string' && post.condition.trim()) return post.condition.trim();
  // Same word-boundary derivation as Explore — naive includes('new')
  // mislabeled "renewed" as New on this surface only.
  const d = (post.description ?? '').toLowerCase();
  if (/\blike new\b/.test(d) || /\bmint\b/.test(d)) return 'Like New';
  if (/\brefurbished\b/.test(d) || /\brefurb\b/.test(d)) return 'Refurbished';
  if (/\bnew\b/.test(d)) return 'New';
  if (/\bused\b/.test(d) || /\bpre-owned\b/.test(d) || /\bpre owned\b/.test(d) || /\bsecond hand\b/.test(d)) return 'Used';
  return 'Unknown';
};

const deliveryOf = (post: Post): string => {
  if (post.type === 'food_item') return '—';
  if (post.type === 'service') return 'On booking';
  // No courier/SLA source: honest estimate label, seller confirms at checkout.
  return '~3 days (est.)';
};

export default function CompareScreen() {
  // Global RecentlyViewed store lives at the app root — a nested provider
  // here shadowed it with an empty inner store.
  return <CompareContent />;
}

function CompareContent() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ids?: string | string[] }>();
  const { posts } = usePosts();

  const ids = useMemo(() => {
    const raw = Array.isArray(params.ids) ? params.ids.join(',') : params.ids ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARE);
  }, [params.ids]);

  // Server fallback (PDP parity): shared /compare?ids= links opened on a
  // fresh install resolved nothing — "Nothing to compare yet" for listings
  // that exist. Missing ids are fetched once each.
  const [fetched, setFetched] = useState<Post[]>([]);
  useEffect(() => {
    const byId = new Set([...posts.map((p) => p.id), ...fetched.map((p) => p.id)]);
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const rows: Post[] = [];
      for (const id of missing) {
        try {
          const res = await serverApi.getPost(id);
          const p = (res as { ok?: boolean; data?: { post?: any } })?.data?.post;
          if (res.ok && p && p.id) {
            rows.push({
              type: 'product',
              id: String(p.id),
              title: String(p.title ?? ''),
              description: String(p.description ?? ''),
              price: Number(p.price ?? 0),
              mrp: typeof p.mrp === 'number' ? p.mrp : undefined,
              category: String(p.category ?? 'General'),
              subCategories: undefined,
              hashtags: [],
              likes: 0,
              comments: 0,
              createdAt: Date.now(),
              image: typeof p.image === 'string' ? p.image : '',
              images: Array.isArray(p.images) ? p.images.filter((u: unknown): u is string => typeof u === 'string') : [],
              status: typeof p.status === 'string' ? p.status : undefined,
              sellerUsername: String(p.sellerUsername ?? ''),
              sellerName: String(p.sellerName ?? ''),
              sellerLocation: String(p.sellerLocation ?? ''),
              verified: Boolean(p.verified),
            });
          }
        } catch {}
      }
      if (!cancelled && rows.length) setFetched((prev) => [...prev, ...rows.filter((r) => !prev.some((x) => x.id === r.id))]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, posts]);

  const products = useMemo(() => {
    const byId = new Map([...posts, ...fetched].map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [ids, posts, fetched]);

  const rows: { label: string; render: (post: Post) => ReactNode }[] = useMemo(
    () => [
      {
        label: 'Price',
        render: (post: Post) => (
          <Text className="text-figma-16 font-inter-700 text-textPrimary">{formatPrice(post.price)}</Text>
        ),
      },
      {
        label: 'Seller',
        render: (post: Post) => (
          <View className="flex-row items-start gap-1">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13 }}>{post.sellerName}</Text>
            {post.verified && <VerifiedIcon size={13} />}
          </View>
        ),
      },
      {
        label: 'Category',
        render: (post: Post) => (
          <View
            className="self-start rounded-figma-full px-2 py-1"
            style={{ backgroundColor: getCategoryColor(post.category) + '22' }}
          >
            <Text className="text-figma-12 font-inter-600" style={{ color: getCategoryColor(post.category), letterSpacing: 0.24 }}>
              {post.category}
            </Text>
          </View>
        ),
      },
      {
        label: 'Condition',
        render: (post: Post) => (
          <Text className="text-figma-12 font-inter-500 text-textSecondary" style={{ letterSpacing: 0.24 }}>
            {conditionOf(post)}
          </Text>
        ),
      },
      {
        label: 'Delivery',
        render: (post: Post) => (
          <Text className="text-figma-12 font-inter-500 text-textSecondary" style={{ letterSpacing: 0.24 }}>
            {deliveryOf(post)}
          </Text>
        ),
      },
      {
        label: 'Likes',
        render: (post: Post) => (
          <View className="flex-row items-center gap-1">
            <HeartIcon size={14} color={colors.textSecondary} />
            <Text className="text-figma-12 font-inter-500 text-textSecondary" style={{ letterSpacing: 0.24 }}>
              {post.likes}
            </Text>
          </View>
        ),
      },
    ],
    []
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 bg-surface"
        style={{ height: 52 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <BackIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="text-figma-16 font-inter-600 text-textPrimary" style={{ letterSpacing: -0.3 }}>Compare</Text>
        <View className="w-9 h-9 items-center justify-center">
          <CompareIcon size={16} color={colors.textSecondary} />
        </View>
      </View>

      {products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10" style={{ paddingBottom: insets.bottom }}>
          <View className="w-16 h-16 rounded-full bg-surfaceContainer items-center justify-center mb-4">
            <CompareIcon size={24} color={colors.textSecondary} />
          </View>
          <Text className="text-figma-16 font-inter-600 text-textPrimary text-center mb-2">Nothing to compare yet</Text>
          <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 13 }}>
            Select at least two products from your Recently viewed rail to compare price, seller, category and more.
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {products.length === 1 && (
            <View className="mx-4 mt-2 mb-1 px-4 py-2.5 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
              <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                Only one product — open another listing and tap Compare to add it here.
              </Text>
            </View>
          )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 pb-8" style={{ paddingTop: 8 }}>
          <View className="flex-row">
            {/* Label column */}
            <View style={{ width: LABEL_WIDTH, marginRight: 8 }}>
              <View style={{ height: 180 }} />
              {rows.map((row) => (
                <View
                  key={row.label}
                  className="justify-end"
                  style={{ minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, paddingBottom: 10 }}
                >
                  <Text className="text-figma-12 font-inter-600 text-textSecondary" style={{ letterSpacing: 0.24 }}>
                    {row.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Value columns */}
            {products.map((post) => {
              const image = post.image;
              return (
                <View key={post.id} style={{ width: VALUE_WIDTH, marginRight: 12 }}>
                  <TouchableOpacity onPress={() => router.push(`/product/${post.id}`)}>
                    <View className="w-full h-[180px] rounded-figma-16 overflow-hidden bg-surfaceContainer">
                      {image ? (
                        <Image source={imgSource(image)} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Text className="text-figma-24 font-inter-500 text-primaryContainer">+</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {rows.map((row) => (
                    <View
                      key={row.label}
                      className="justify-center"
                      style={{ minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
                    >
                      {row.render(post)}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
        </View>
      )}
    </View>
  );
}
