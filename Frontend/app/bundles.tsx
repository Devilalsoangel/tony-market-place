import { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart } from '../contexts/CartContext';
import { usePosts } from '../contexts/PostContext';
import { serverApi } from '../utils/serverApi';
import { resolveListingImage } from '../utils/productImages';

interface BundleItem {
  listingId: string;
  name: string;
  price: number;
  seller: string;
  sellerUsername: string;
}

interface Bundle {
  id: string;
  title: string;
  tagline: string;
  originalPrice: number;
  bundlePrice: number;
  thumbnails: string[];
  items: BundleItem[];
}

const thumbSource = (key: string) =>
  key.startsWith('__listing_')
    ? resolveListingImage(null, key.slice('__listing_'.length) || 'bundle')
    : { uri: key };

const savePct = (bundle: Bundle) => {
  const originalSum = bundle.items.reduce((sum, i) => sum + i.price, 0);
  if (originalSum <= 0) return 0;
  return Math.round(((originalSum - bundle.bundlePrice) / originalSum) * 100);
};

export default function BundlesScreen() {
  const insets = useSafeAreaInsets();
  const { addToCart } = useCart();
  const { posts } = usePosts();
  const [loading, setLoading] = useState(true);
  const [serverBundles, setServerBundles] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await serverApi.getBundles();
          if (active && res.ok && res.data?.bundles) setServerBundles(res.data.bundles);
        } catch {
          // offline: honest empty state below
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const postById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of posts as any[]) m.set(p.id, p);
    return m;
  }, [posts]);

  // Server rows -> render cards. Item images resolve from the live feed when
  // the listing is in memory, else the deterministic listing placeholder.
  // Legacy rows without items link the seller's shop instead of cart.
  const bundles: Bundle[] = useMemo(
    () =>
      serverBundles.map((b) => {
        const rawItems: any[] = Array.isArray(b.items) ? b.items : [];
        const items: BundleItem[] = rawItems.map((i) => {
          const post = postById.get(String(i.listingId ?? ''));
          return {
            listingId: String(i.listingId ?? ''),
            name: String(i.name ?? ''),
            price: Number(i.price ?? 0),
            seller: b.sellerName,
            sellerUsername: post?.sellerUsername ?? '',
          };
        });
        const thumbs = items
          .map((i) => {
            const post = postById.get(i.listingId);
            const img = post?.images?.[0] ?? post?.image;
            return typeof img === 'string' && img ? img : null;
          })
          .filter((u): u is string => !!u);
        while (thumbs.length < Math.min(3, Math.max(items.length, 1))) thumbs.push('');
        const originalPrice = b.discount > 0 ? Math.round(Number(b.price) / (1 - Number(b.discount) / 100)) : Number(b.price);
        return {
          id: b.id,
          title: b.title,
          tagline: `${b.sellerName} · ${b.discount}% off combo`,
          originalPrice,
          bundlePrice: Number(b.price),
          thumbnails: thumbs.slice(0, 3).map((u, i) => (u || `__listing_${items[i]?.listingId ?? b.id}_${i}`)),
          items,
        };
      }),
    [serverBundles, postById]
  );

  const addBundle = (bundle: Bundle) => {
    const n = bundle.items.length;
    const share = n > 0 ? Math.floor(bundle.bundlePrice / n) : 0;
    bundle.items.forEach((item, i) => {
      addToCart({
        listingId: item.listingId,
        type: 'product',
        name: item.name,
        price: i === 0 ? bundle.bundlePrice - share * (n - 1) : share,
        seller: item.seller,
        sellerUsername: item.sellerUsername,
      });
    });
    router.push('/cart');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Bundle Deals
        </Text>
        <View className="w-5" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-24">
        <Text className="font-inter-400 mt-2 mb-4 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
          Hand-picked combos at a better price — one tap adds the whole set.
        </Text>
        {loading && bundles.length === 0 && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color={colors.primaryContainer} />
          </View>
        )}
        {!loading && bundles.length === 0 && (
          <View className="items-center py-16 px-8">
            <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
              No bundle deals right now. Check back soon — sellers bundle bestsellers here.
            </Text>
          </View>
        )}
        {bundles.map((bundle) => {
          const pct = savePct(bundle);
          return (
            <View
              key={bundle.id}
              className="rounded-[24px] p-4 mb-4"
              style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3 }}
            >
              {/* Thumbnail row */}
              <View className="flex-row" style={{ gap: 8 }}>
                {bundle.thumbnails.slice(0, 3).map((t, i) => (
                  <Image
                    key={`${bundle.id}_${i}`}
                    source={thumbSource(t)}
                    className="rounded-[12px]"
                    style={{ width: 84, height: 84, backgroundColor: colors.surfaceContainerLow }}
                  />
                ))}
              </View>
              {/* Title + Save badge */}
              <View className="flex-row items-center mt-3">
                <Text className="flex-1 font-inter-600 text-textPrimary mr-2" style={{ fontSize: 16, lineHeight: 22, letterSpacing: 0.14 }} numberOfLines={1}>
                  {bundle.title}
                </Text>
                <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.tertiary }}>
                  <Text className="text-white font-inter-600" style={{ fontSize: 11, lineHeight: 14 }}>
                    Save {pct}%
                  </Text>
                </View>
              </View>
              <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
                {bundle.items.length > 0 ? `${bundle.items.length} items · ${bundle.tagline}` : bundle.tagline}
              </Text>
              {/* Price row */}
              <View className="flex-row items-baseline mt-2" style={{ gap: 8 }}>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 20, textDecorationLine: 'line-through' }}>
                  {formatPrice(bundle.originalPrice)}
                </Text>
                <Text className="font-inter-700" style={{ fontSize: 20, lineHeight: 28, color: colors.primaryContainer }}>
                  {formatPrice(bundle.bundlePrice)}
                </Text>
              </View>
              {/* CTA */}
              {bundle.items.length > 0 ? (
                <TouchableOpacity
                  className="w-full items-center justify-center mt-4"
                  style={{ height: 48, borderRadius: 16, backgroundColor: colors.primaryContainer }}
                  onPress={() => addBundle(bundle)}
                >
                  <Text className="text-white font-inter-600" style={{ fontSize: 15, lineHeight: 20 }}>
                    Add bundle to cart
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text className="font-inter-400 text-textSecondary mt-4" style={{ fontSize: 13, lineHeight: 18 }}>
                  Curated by {bundle.tagline.split('·')[0]?.trim() ?? 'the seller'} — message them for the full set.
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
