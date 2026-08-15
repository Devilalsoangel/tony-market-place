import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, BagIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useCart } from '../contexts/CartContext';
import { productImages } from '../utils/productImages';

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

const SEED_BUNDLES: Bundle[] = [
  {
    id: 'bundle_home',
    title: 'Home Starter Kit',
    tagline: 'Kit out your kitchen & living space',
    originalPrice: 6999,
    bundlePrice: 5499,
    thumbnails: ['post_001', 'post_002', 'bundle_home_3'],
    items: [
      { listingId: 'bundle_home_1', name: 'Ceramic Dinner Set (12pc)', price: 1833, seller: 'Nest & Nook', sellerUsername: 'nestnook' },
      { listingId: 'bundle_home_2', name: 'Cotton Kitchen Towels (6pc)', price: 1833, seller: 'Nest & Nook', sellerUsername: 'nestnook' },
      { listingId: 'bundle_home_3', name: 'Scented Soy Candle Trio', price: 1833, seller: 'WarmWicks', sellerUsername: 'warmwicks' },
    ],
  },
  {
    id: 'bundle_fashion',
    title: 'Fashion Fest Combo',
    tagline: 'Mix & match streetwear staples',
    originalPrice: 4500,
    bundlePrice: 3299,
    thumbnails: ['bundle_fashion_1', 'bundle_fashion_2'],
    items: [
      { listingId: 'bundle_fashion_1', name: 'Oversized Graphic Tee', price: 1650, seller: 'ThreadTheory', sellerUsername: 'threadtheory' },
      { listingId: 'bundle_fashion_2', name: 'Slim Fit Denim Jeans', price: 1650, seller: 'ThreadTheory', sellerUsername: 'threadtheory' },
    ],
  },
  {
    id: 'bundle_tech',
    title: 'Tech Essentials',
    tagline: 'Everyday carry for the modern desk',
    originalPrice: 12000,
    bundlePrice: 9999,
    thumbnails: ['post_002', 'bundle_tech_2', 'bundle_tech_3'],
    items: [
      { listingId: 'bundle_tech_1', name: 'Wireless Charging Pad', price: 3333, seller: 'TechVault', sellerUsername: 'techvault' },
      { listingId: 'bundle_tech_2', name: 'Noise Cancelling Earbuds', price: 3333, seller: 'TechVault', sellerUsername: 'techvault' },
      { listingId: 'bundle_tech_3', name: 'Smart LED Desk Lamp', price: 3333, seller: 'TechVault', sellerUsername: 'techvault' },
    ],
  },
  {
    id: 'bundle_selfcare',
    title: 'Self-Care Set',
    tagline: 'Unwind with a spa day at home',
    originalPrice: 2400,
    bundlePrice: 1799,
    thumbnails: ['bundle_selfcare_1', 'bundle_selfcare_2'],
    items: [
      { listingId: 'bundle_selfcare_1', name: 'Vitamin-C Face Serum', price: 900, seller: 'GlowLab', sellerUsername: 'glowlab' },
      { listingId: 'bundle_selfcare_2', name: 'Bamboo Bath Essentials', price: 900, seller: 'GlowLab', sellerUsername: 'glowlab' },
    ],
  },
];

const thumbSource = (key: string) =>
  productImages[key] ?? { uri: `https://picsum.photos/seed/${key}/96/96` };

const savePct = (bundle: Bundle) => {
  const originalSum = bundle.items.reduce((sum, i) => sum + i.price, 0);
  if (originalSum <= 0) return 0;
  return Math.round(((originalSum - bundle.bundlePrice) / originalSum) * 100);
};

export default function BundlesScreen() {
  const insets = useSafeAreaInsets();
  const { addToCart } = useCart();

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
        <BagIcon size={18} color={colors.primary} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-24">
        <Text className="font-inter-400 mt-2 mb-4 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
          Hand-picked combos at a better price — one tap adds the whole set.
        </Text>
        {SEED_BUNDLES.map((bundle) => {
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
                {bundle.items.length} items · {bundle.tagline}
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
              <TouchableOpacity
                className="w-full items-center justify-center mt-4"
                style={{ height: 48, borderRadius: 16, backgroundColor: colors.primaryContainer }}
                onPress={() => addBundle(bundle)}
              >
                <Text className="text-white font-inter-600" style={{ fontSize: 15, lineHeight: 20 }}>
                  Add bundle to cart
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
