import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useMemo } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors, formatPrice } from '../utils/theme';
import { StarIcon, PlusIcon, MapPinIcon, CheckIcon, BagIcon, ShopIcon } from '../utils/icons';
import { useOrders } from '../contexts/OrderContext';
import { useAuth } from '../contexts/AuthContext';
import type { StorefrontChip, StorefrontDeal, MenuItem, ServiceItem, JobItem, ListingItem, BulkProduct, ShopProfile } from '../utils/storefronts';

// Functional status colors (no matching theme token — same exemption as
// message status labels elsewhere in the app).
const VEG = '#22c55e';
const NONVEG = '#d32f2f';

export const SEED_REVIEWS = [
  { id: 'r1', reviewer: 'Ananya Sharma', rating: 5, text: 'Gorgeous quality and fast shipping. Would buy again!', time: '2 weeks ago' },
  { id: 'r2', reviewer: 'Raj Patel', rating: 5, text: 'Item exactly as described, beautifully packed.', time: '1 month ago' },
  { id: 'r3', reviewer: 'Meera K.', rating: 4, text: 'Lovely piece — took a few extra days to ship though.', time: '2 months ago' },
  { id: 'r4', reviewer: 'Vikram N.', rating: 5, text: 'Trusted seller, verified and super prompt.', time: '3 months ago' },
];

// ─── Chip rail (category chips / filters / listing types / menu chips) ──────
export function ChipRail({
  chips,
  active,
  onSelect,
}: {
  chips: StorefrontChip[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
    >
      {chips.map((c) => {
        const on = active === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => onSelect(c.id)}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}
          >
            <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 18, color: on ? colors.onPrimary : colors.textPrimary }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Info chips (service archetype: walk-ins, parking, etc.) ────────────────
export function InfoChipRow({ labels }: { labels: string[] }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {labels.map((label) => (
        <View key={label} className="px-3 py-1.5 rounded-full flex-row items-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <CheckIcon size={12} color={colors.primaryContainer} />
          <Text className="font-inter-500 ml-1.5 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Marketing banner (gradient overlay + headline + CTA) ───────────────────
export function MarketingBanner({
  banner,
  height = 168,
}: {
  banner: ShopProfile['banner'];
  height?: number;
}) {
  return (
    <View className="mx-5 overflow-hidden rounded-figma-24" style={{ height }}>
      {banner.image ? (
        <Image source={banner.image} className="w-full h-full" resizeMode="cover" />
      ) : (
        <View className="w-full h-full" style={{ backgroundColor: colors.surfaceContainer }} />
      )}
      <View
        className="absolute inset-0 justify-end px-5 pb-4"
        style={{ backgroundColor: banner.gradient[0], opacity: 0.92 }}
      >
        <View className="absolute inset-0" style={{ backgroundColor: banner.gradient[1], opacity: 0.45 }} />
        <Text className="font-inter-700 text-white" style={{ fontSize: 20, lineHeight: 26 }}>
          {banner.headline}
        </Text>
        <Text className="font-inter-400 text-white/90 mt-0.5" style={{ fontSize: 13, lineHeight: 18 }}>
          {banner.sub}
        </Text>
        <TouchableOpacity
          className="mt-3 self-start px-4 py-2 rounded-figma-12"
          style={{ backgroundColor: colors.onPrimary }}
        >
          <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primary }}>
            {banner.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Stats bar (3 stats with dividers) ─────────────────────────────────────
export function StatsBar({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 24, backgroundColor: colors.surfaceContainerLow }}
    >
      {stats.map((s, i) => (
        <View key={s.label} className="flex-1 items-center">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
            {s.value}
          </Text>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
            {s.label}
          </Text>
          {i < stats.length - 1 && (
            <View style={{ position: 'absolute', right: 0, width: 1, height: 32, backgroundColor: colors.surfaceContainer }} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Action row (primary + secondary) ──────────────────────────────────────
export function ActionRow({
  primary,
  secondary,
  primaryFilled = true,
  onPrimary,
  onSecondary,
}: {
  primary: string;
  secondary: string;
  primaryFilled?: boolean;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) {
  return (
    <View className="flex-row gap-3">
      <TouchableOpacity
        className="flex-1 h-12 items-center justify-center rounded-figma-12"
        style={{ backgroundColor: primaryFilled ? colors.primaryContainer : colors.surfaceContainer }}
        onPress={onPrimary}
      >
        <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: primaryFilled ? colors.onPrimary : colors.textPrimary }}>
          {primary}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="flex-1 h-12 items-center justify-center rounded-figma-12"
        style={{ backgroundColor: colors.surfaceContainer }}
        onPress={onSecondary}
      >
        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
          {secondary}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Deals rail (horizontal scroll cards, 169 wide) ─────────────────────────
export function DealsRail({ deals, priceLabel }: { deals: StorefrontDeal[]; priceLabel?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
      {deals.map((d) => (
        <TouchableOpacity
          key={d.id}
          className="overflow-hidden rounded-figma-16"
          style={{ width: 169, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        >
          <View className="w-full" style={{ height: 169 }}>
            <Image source={d.image} className="w-full h-full" resizeMode="cover" />
            {d.tag && (
              <View className="absolute top-2 left-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                <Text className="font-inter-600 text-white" style={{ fontSize: 10, lineHeight: 14 }}>
                  {d.tag}
                </Text>
              </View>
            )}
          </View>
          <View className="px-3 py-3">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
              {d.title}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 20 }}>
                {priceLabel ? `${priceLabel} ${formatPrice(d.price)}` : formatPrice(d.price)}
              </Text>
              {d.oldPrice ? (
                <Text className="font-inter-400 text-secondary ml-1.5 line-through" style={{ fontSize: 12, lineHeight: 16 }}>
                  {formatPrice(d.oldPrice)}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── 2-column product grid (goods archetype) ────────────────────────────────
export function ProductGridSection({ items, onPress }: { items: { id: string; image?: any; title: string; price: number }[]; onPress?: (id: string) => void }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 12 }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          className="overflow-hidden rounded-figma-16"
          style={{ width: (392 - 40 - 12) / 2, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          onPress={() => onPress?.(item.id)}
        >
          {item.image ? (
            <Image source={item.image} className="w-full aspect-square" resizeMode="cover" />
          ) : (
            <View className="w-full aspect-square" style={{ backgroundColor: colors.surfaceContainer }} />
          )}
          <View className="px-3 pt-2.5 pb-3">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="font-inter-700 text-textPrimary mt-1" style={{ fontSize: 16, lineHeight: 20 }}>
              {formatPrice(item.price)}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Food menu list ─────────────────────────────────────────────────────────
export function MenuListSection({ items }: { items: MenuItem[] }) {
  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {items.map((item) => (
        <View key={item.id} className="flex-row items-center p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
          <View className="flex-1 mr-3">
            <View className="flex-row items-center">
              <View
                className="w-3.5 h-3.5 rounded-sm mr-2 items-center justify-center"
                style={{ borderWidth: 1.5, borderColor: item.veg ? VEG : NONVEG }}
              >
                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.veg ? VEG : NONVEG }} />
              </View>
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
                {item.name}
              </Text>
              {item.tag && (
                <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-500 text-tertiary" style={{ fontSize: 10, lineHeight: 12 }}>
                    {item.tag}
                  </Text>
                </View>
              )}
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
              {item.desc}
            </Text>
            <Text className="font-inter-600 text-textPrimary mt-1.5" style={{ fontSize: 15, lineHeight: 20 }}>
              {formatPrice(item.price)}
            </Text>
          </View>
          <TouchableOpacity className="px-4 py-2 rounded-figma-12 items-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.primaryContainer }}>
              ADD
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Service categories (3-col grid) ────────────────────────────────────────
export function ServiceCategoryGrid({ categories }: { categories: StorefrontChip[] }) {
  return (
    <View className="flex-row flex-wrap mx-5" style={{ gap: 10 }}>
      {categories.map((c) => (
        <TouchableOpacity
          key={c.id}
          className="items-center justify-center"
          style={{ width: (392 - 40 - 20) / 3, height: 64, borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
        >
          <View className="w-8 h-8 rounded-full items-center justify-center mb-1" style={{ backgroundColor: colors.surfaceContainerLowest }}>
            <ShopIcon size={16} color={colors.primaryContainer} />
          </View>
          <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 12, lineHeight: 14 }}>
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Trending services rail (horizontal) ────────────────────────────────────
export function TrendingRail({ items, onBook }: { items: ServiceItem[]; onBook?: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
      {items.map((s) => (
        <TouchableOpacity
          key={s.id}
          className="p-4 rounded-figma-16"
          style={{ width: 169, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          onPress={() => onBook?.(s.id)}
        >
          <View className="w-10 h-10 rounded-full items-center justify-center mb-2" style={{ backgroundColor: colors.surfaceContainer }}>
            <StarIcon size={16} color={colors.primaryContainer} />
          </View>
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
            {s.name}
          </Text>
          <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 11, lineHeight: 14 }}>
            {s.duration}
          </Text>
          <Text className="font-inter-700 text-textPrimary mt-1.5" style={{ fontSize: 16, lineHeight: 20 }}>
            {formatPrice(s.price)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Service list rows ──────────────────────────────────────────────────────
export function ServicesListSection({ items, onBook }: { items: ServiceItem[]; onBook?: (id: string) => void }) {
  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {items.map((s) => (
        <View key={s.id} className="flex-row items-center p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
          <View className="flex-1 mr-3">
            <View className="flex-row items-center">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
                {s.name}
              </Text>
              {s.rating && (
                <View className="flex-row items-center ml-2">
                  <StarIcon size={11} color={colors.primaryContainer} />
                  <Text className="font-inter-500 text-textSecondary ml-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
                    {s.rating}
                  </Text>
                </View>
              )}
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 16 }}>
              {s.duration}
            </Text>
            <Text className="font-inter-600 text-textPrimary mt-1.5" style={{ fontSize: 15, lineHeight: 20 }}>
              {formatPrice(s.price)}
            </Text>
          </View>
          <TouchableOpacity className="px-4 py-2 rounded-figma-12" style={{ backgroundColor: colors.primaryContainer }} onPress={() => onBook?.(s.id)}>
            <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 16 }}>
              Book
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Job list (jobs archetype) ──────────────────────────────────────────────
export function JobListSection({ jobs, onApply }: { jobs: JobItem[]; onApply?: (id: string) => void }) {
  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {jobs.map((j) => (
        <View key={j.id} className="p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
          <View className="flex-row items-start">
            <View className="flex-1 mr-3">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                {j.role}
              </Text>
              <View className="flex-row items-center mt-1">
                <MapPinIcon size={12} color={colors.secondary} />
                <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 12, lineHeight: 16 }}>
                  {j.location} · {j.exp}
                </Text>
              </View>
            </View>
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
              <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.primaryContainer }}>
                {j.salary}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
            {j.tags.map((t) => (
              <View key={t} className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
                <Text className="font-inter-500 text-tertiary" style={{ fontSize: 11, lineHeight: 14 }}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            className="mt-3 h-10 rounded-figma-12 items-center justify-center"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={() => onApply?.(j.id)}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
              Apply Now
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Real-estate listing cards ──────────────────────────────────────────────
export function ListingsListSection({ listings, onPress }: { listings: ListingItem[]; onPress?: (id: string) => void }) {
  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {listings.map((l) => (
        <TouchableOpacity
          key={l.id}
          className="flex-row overflow-hidden rounded-figma-16"
          style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
          onPress={() => onPress?.(l.id)}
        >
          <View className="w-[104px] h-full">
            <Image source={l.image} className="w-full h-full" resizeMode="cover" />
          </View>
          <View className="flex-1 p-3">
            <View className="flex-row items-center">
              <Text className="font-inter-600 text-textPrimary flex-1" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                {l.title}
              </Text>
              {l.tag && (
                <View className="ml-1 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-500 text-tertiary" style={{ fontSize: 9, lineHeight: 11 }}>
                    {l.tag}
                  </Text>
                </View>
              )}
            </View>
            <Text className="font-inter-700 text-textPrimary mt-1" style={{ fontSize: 16, lineHeight: 20 }}>
              ₹{l.price}{l.suffix}
            </Text>
            <View className="flex-row items-center mt-1">
              <MapPinIcon size={11} color={colors.secondary} />
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={1}>
                {l.locality}
              </Text>
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 11, lineHeight: 14 }}>
              {l.beds > 0 ? `${l.beds} Beds · ` : ''}{l.baths} Baths · {l.sqft} sq.ft
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── B2B bulk deals rail ────────────────────────────────────────────────────
export function BulkDealsRail({ deals }: { deals: StorefrontDeal[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
      {deals.map((d) => (
        <View key={d.id} className="overflow-hidden rounded-figma-16" style={{ width: 200, backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View className="w-full" style={{ height: 112 }}>
            <Image source={d.image} className="w-full h-full" resizeMode="cover" />
          </View>
          <View className="p-3">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
              {d.title}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                {formatPrice(d.price)}
              </Text>
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 11, lineHeight: 14 }}>
                /m
              </Text>
              {d.tag && (
                <Text className="font-inter-500 ml-2" style={{ fontSize: 10, lineHeight: 12, color: colors.tertiary }}>
                  {d.tag}
                </Text>
              )}
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── B2B product rows ───────────────────────────────────────────────────────
export function BulkProductList({ products, onQuote }: { products: BulkProduct[]; onQuote?: (id: string) => void }) {
  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {products.map((p) => (
        <View key={p.id} className="flex-row items-center p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
          <View className="flex-1 mr-3">
            <View className="flex-row items-center">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
                {p.name}
              </Text>
              {p.tag && (
                <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-500 text-tertiary" style={{ fontSize: 10, lineHeight: 12 }}>
                    {p.tag}
                  </Text>
                </View>
              )}
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
              {p.desc}
            </Text>
            <View className="flex-row items-center mt-1.5">
              <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                {formatPrice(p.price)}
              </Text>
              <Text className="font-inter-400 text-textSecondary ml-1" style={{ fontSize: 12, lineHeight: 16 }}>
                {p.unit}
              </Text>
              <Text className="font-inter-500 ml-2 text-tertiary" style={{ fontSize: 11, lineHeight: 14 }}>
                {p.moq}
              </Text>
            </View>
          </View>
          <TouchableOpacity className="px-4 py-2 rounded-figma-12" style={{ backgroundColor: colors.primaryContainer }} onPress={() => onQuote?.(p.id)}>
            <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 16 }}>
              Quote
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Empty storefront (new seller) ──────────────────────────────────────────
export function EmptyStorefront({ isOwner }: { isOwner: boolean }) {
  return (
    <View className="mx-5 items-center px-6 py-10 rounded-figma-24" style={{ backgroundColor: colors.surfaceContainerLow }}>
      <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.surfaceContainer }}>
        <BagIcon size={28} color={colors.primaryContainer} />
      </View>
      <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 24 }}>
        {isOwner ? 'Your shop is live!' : 'No products yet'}
      </Text>
      <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 13, lineHeight: 20 }}>
        {isOwner
          ? 'Add your first product to start selling on susej.'
          : 'This shop hasn\u2019t listed anything yet. Check back soon.'}
      </Text>
      {isOwner && (
        <TouchableOpacity className="mt-5 px-6 h-11 rounded-figma-12 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
          <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
            Add your first product
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Reviews section (shared) ───────────────────────────────────────────────
// Real reviews first (orders the buyer rated for this seller), then seeded
// filler so a storefront never looks empty.
export function ReviewsSection({ username }: { username?: string }) {
  const { orders } = useOrders();
  const { user } = useAuth();

  const realReviews = useMemo(() => {
    if (!username) return [];
    return orders
      .filter((o) => o.sellerUsername === username && o.reviewed && o.rating && o.rating > 0)
      .sort((a, b) => b.placedAt - a.placedAt)
      .map((o) => ({
        id: `order_${o.id}`,
        reviewer: user?.name || 'Verified buyer',
        rating: o.rating as number,
        text: o.reviewComment || 'Great seller — smooth transaction.',
        time: new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      }));
  }, [orders, username, user]);

  const reviews = realReviews.length >= 2 ? realReviews : [...realReviews, ...SEED_REVIEWS];

  return (
    <View className="mx-5" style={{ gap: 12 }}>
      {reviews.length === 0 && (
        <View className="items-center py-10 px-6 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 14, lineHeight: 20 }}>
            No reviews yet
          </Text>
        </View>
      )}
      {reviews.map((review) => (
        <View key={review.id} className="p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest }}>
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 rounded-full mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
              <Text className="font-inter-600 text-center" style={{ fontSize: 13, lineHeight: 36, color: colors.textSecondary }}>
                {review.reviewer[0]}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16 }}>
                {review.reviewer}
              </Text>
              <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 11, lineHeight: 14 }}>
                {review.time}
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 2 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon key={star} size={13} color={star <= review.rating ? colors.primary : colors.surfaceContainerHigh} />
              ))}
            </View>
          </View>
          <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 21 }}>
            {review.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── About section (bio + location) ─────────────────────────────────────────
export function AboutSection({ profile }: { profile: ShopProfile }) {
  return (
    <View className="mx-5">
      <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 24 }}>
        {profile.bio}
      </Text>
      <View className="flex-row items-center mt-4 p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
        <MapPinIcon size={16} color={colors.primaryContainer} />
        <Text className="font-inter-500 text-textSecondary ml-2" style={{ fontSize: 13, lineHeight: 18 }}>
          Bengaluru, Karnataka, India
        </Text>
      </View>
    </View>
  );
}

// ─── Sticky booking bar (service archetype) ─────────────────────────────────
export function StickyActionBar({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <View
      className="px-5 pt-3 pb-2"
      style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.04, shadowRadius: 12 }}
    >
      <TouchableOpacity
        className="h-14 rounded-figma-16 items-center justify-center"
        style={{ backgroundColor: colors.primaryContainer }}
        onPress={onPress}
      >
        <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Status badge (food archetype) ──────────────────────────────────────────
export function StatusBadge({ label }: { label: string }) {
  return (
    <View className="flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
      <Svg width={8} height={8} viewBox="0 0 8 8">
        <Circle cx="4" cy="4" r="4" fill={VEG} />
      </Svg>
      <Text className="font-inter-600 text-textPrimary ml-1.5" style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Section title ──────────────────────────────────────────────────────────
export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View className="flex-row items-center justify-between mx-5">
      <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
        {title}
      </Text>
      {action ? (
        <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.primaryContainer }}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Plus icon chip (used by menu add buttons in Figma) ─────────────────────
export function AddButton() {
  return (
    <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
      <PlusIcon size={14} color={colors.onPrimary} />
    </View>
  );
}
