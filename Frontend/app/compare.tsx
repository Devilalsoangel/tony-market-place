import { useMemo, ReactNode } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, VerifiedIcon, HeartIcon } from '../utils/icons';
import { colors, formatPrice, getCategoryColor } from '../utils/theme';
import { usePosts, Post } from '../contexts/PostContext';
import { RecentlyViewedProvider } from '../contexts/RecentlyViewedContext';

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
  const d = post.description.toLowerCase();
  if (d.includes('like new')) return 'Like New';
  if (d.includes('new')) return 'New';
  if (d.includes('used')) return 'Used';
  return '—';
};

const deliveryOf = (post: Post): string => {
  if (post.type === 'food_item') return '—';
  if (post.type === 'service') return 'On booking';
  return '2-5 days';
};

export default function CompareScreen() {
  return (
    <RecentlyViewedProvider>
      <CompareContent />
    </RecentlyViewedProvider>
  );
}

function CompareContent() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ids?: string | string[] }>();
  const { posts } = usePosts();

  const products = useMemo(() => {
    const raw = Array.isArray(params.ids) ? params.ids.join(',') : params.ids ?? '';
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARE);
    const byId = new Map(posts.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [params.ids, posts]);

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
      )}
    </View>
  );
}
