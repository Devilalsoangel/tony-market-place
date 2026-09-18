import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { bookServiceImages } from '../utils/screenImages';
import { AvatarView } from '../components/AvatarView';
import { BackIcon, StarIcon, MapPinIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders } from '../contexts/OrderContext';
import { serverApi } from '../utils/serverApi';
import { getWallet, syncWalletFromServer } from '../utils/walletStore';

const servicePackages = [
  { name: 'Starter', price: 149 },
  { name: 'Premium', price: 299 },
  { name: 'Business', price: 499 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TIME_SLOTS = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
];
/** Minutes since midnight for a 'h:MM AM/PM' slot (NaN when unparseable). */
function slotMinutes(slot: string): number {
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);
  if (!m) return NaN;
  let h = Number(m[1]) % 12;
  if (/P/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

const DAY_MS = 86400000;
const BOOKING_WINDOW_DAYS = 14;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rolling 14-day strip (Urban Company parity): the old single-month grid
// could not render next-month days, so up to 10 of the 14 window days were
// unselectable at month-end.
function buildWindowDays(now: Date): Date[] {
  const start = startOfDay(now);
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => new Date(start.getTime() + i * DAY_MS));
}

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    listingId?: string | string[];
    seller?: string | string[];
    sellerUsername?: string | string[];
    title?: string | string[];
    description?: string | string[];
    category?: string | string[];
  }>();
  const listingIdParam = Array.isArray(params.listingId) ? params.listingId[0] : params.listingId;
  const sellerNameParam = Array.isArray(params.seller) ? params.seller[0] : params.seller;
  const sellerUsernameParam = Array.isArray(params.sellerUsername) ? params.sellerUsername[0] : params.sellerUsername;
  const titleParam = Array.isArray(params.title) ? params.title[0] : params.title;
  const descriptionParam = Array.isArray(params.description) ? params.description[0] : params.description;
  const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category;

  // Listing context comes from the caller; fall back to generic honest copy.
  const serviceTitle = titleParam?.trim() || 'Service booking';
  const serviceDescription = descriptionParam?.trim() || 'Details provided by the seller.';
  const serviceCategory = categoryParam?.trim() || 'Service';
  const { placeOrders } = useOrders();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  // Packages come from the REAL listing price (server truth) — the old
  // hardcoded Starter/Premium/Business tiers charged invented prices for a
  // fake 'service-photo-shoot' id the server always rejected (dead flow).
  const [pkgs, setPkgs] = useState<{ name: string; price: number }[]>(servicePackages);
  const [selectedPackage, setSelectedPackage] = useState(servicePackages[1]);
  const [listingLoading, setListingLoading] = useState(!!listingIdParam);
  const [listingGone, setListingGone] = useState(false);
  const [listingOwner, setListingOwner] = useState<string | null>(null);
  const [listingImage, setListingImage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // Real seller rating (PDP parity: users-route aggregate of delivered-order
  // reviews). Silent on failure; zero-review sellers keep the honest empty
  // line — never a fabricated score, never a hardcoded "none".
  // NOTE: the fetch effect lives below bookingSeller (declared after the
  // listing effect) — referencing it up here would be a TDZ crash.
  const [sellerRating, setSellerRating] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    if (!listingIdParam) {
      // No listing context (category/seller entry points): nothing real to
      // book — say so instead of minting a fake-listing order the server 400s.
      setListingGone(true);
      setListingLoading(false);
      return;
    }
    let cancelled = false;
    serverApi.getPost(listingIdParam).then((res) => {
      if (cancelled) return;
      const post = (res.data as { post?: { price?: unknown; isSold?: unknown; status?: unknown; sellerUsername?: unknown; authorUsername?: unknown; type?: unknown; image?: unknown; images?: unknown } } | null)?.post;
      const price = Math.round(Number(post?.price ?? NaN));
      const gone = !res.ok || !post || post.isSold === true || (typeof post.status === 'string' && post.status !== 'published' && post.status !== 'active');
      if (gone || !Number.isFinite(price) || price <= 0) {
        setListingGone(true);
      } else {
        const owner = String((post as { authorUsername?: unknown })?.authorUsername ?? (post as { sellerUsername?: unknown })?.sellerUsername ?? '');
        if (owner) setListingOwner(owner);
        // Real listing photo (not stock art): the hero shows what is booked.
        const imgs = Array.isArray(post?.images) ? (post.images as unknown[]).filter((u): u is string => typeof u === 'string' && !!u) : [];
        const cover = typeof post?.image === 'string' && post.image ? post.image : imgs[0] ?? null;
        if (cover) setListingImage(cover);
        const single = [{ name: 'Standard', price }];
        setPkgs(single);
        setSelectedPackage(single[0]);
      }
      setListingLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setListingGone(true);
        setListingLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [listingIdParam]);

  const today = startOfDay(new Date());
  const windowDays = buildWindowDays(new Date());
  // Seller identity fail-closed (chat-parity): an ownerless booking skips the
  // server's seller binding as falsy — refuse instead of minting a stroker row.
  const bookingSeller = listingOwner || sellerUsernameParam || '';
  const ownerless = !!listingIdParam && !listingLoading && !listingGone && !bookingSeller;
  const canBook = !!selectedDate && !!selectedTime && !placing && !listingLoading && !listingGone && !!listingIdParam && !!bookingSeller;

  useEffect(() => {
    setSellerRating(null);
    if (!bookingSeller) return;
    let alive = true;
    serverApi
      .getUserProfile(bookingSeller)
      .then((res) => {
        if (!alive) return;
        const avg = Number((res.data as { user?: { avgRating?: unknown } } | null)?.user?.avgRating);
        const count = Number((res.data as { user?: { reviewCount?: unknown } } | null)?.user?.reviewCount);
        if (Number.isFinite(avg) && avg > 0 && count > 0) setSellerRating({ avg, count });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bookingSeller]);

  // Same-day past slots are unbookable (a 10 AM slot at 9 PM used to mint a
  // real order row in the past).
  const slotInPast = (slot: string): boolean => {
    if (!selectedDate || !sameDay(selectedDate, new Date())) return false;
    const mins = slotMinutes(slot);
    if (!Number.isFinite(mins)) return false;
    const now = new Date();
    return mins <= now.getHours() * 60 + now.getMinutes();
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || placing || !listingIdParam || listingGone || !bookingSeller) return;
    if (slotInPast(selectedTime)) {
      Alert.alert('Slot passed', 'That time already passed today — pick a later slot.');
      return;
    }
    // Wallet pre-check (checkout parity): bookings debit the wallet on the
    // server, so a ₹0 wallet must hear "top up" BEFORE the confirm screen —
    // not a live tracking page for a doomed order that later syncFails.
    const price = Math.round(selectedPackage.price);
    await syncWalletFromServer().catch(() => {});
    const wallet = await getWallet().catch(() => null);
    if (wallet && wallet.balance < price) {
      Alert.alert(
        'Insufficient wallet balance',
        `Your wallet has ${formatPrice(wallet.balance)} but this booking costs ${formatPrice(price)}. Add money in the Wallet tab first.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Wallet', onPress: () => router.push('/wallet') },
        ]
      );
      return;
    }
    // Consent gate (Urban Company parity): one tap used to instant-charge the
    // wallet with no total/method confirmation. Confirm price + wallet debit
    // + slot BEFORE anything moves.
    Alert.alert(
      'Confirm booking',
      `${serviceTitle}\n${summaryLine}\n${formatPrice(Math.round(selectedPackage.price))} · pays from Wallet`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay ${formatPrice(Math.round(selectedPackage.price))}`,
          onPress: () => {
            setPlacing(true);
            try {
              const [order] = placeOrders(
                [
                  {
                    listingId: listingIdParam,
                    type: 'service',
                    name: serviceTitle,
                    price: Math.round(selectedPackage.price),
                    quantity: 1,
                    seller: sellerNameParam || 'Service Provider',
                    sellerUsername: bookingSeller,
                  },
                ],
                undefined,
                'wallet',
                { bookingDate: toISODate(selectedDate), bookingTime: selectedTime, deliveryFee: 0 }
              );
              if (order) {
                router.push(`/track-order?id=${order.id}`);
              }
            } catch {
              Alert.alert("Couldn't place booking", 'Something went wrong. Please try again.');
            } finally {
              setPlacing(false);
            }
          },
        },
      ]
    );
  };

  const summaryLine =
    selectedDate && selectedTime
      ? `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} · ${selectedTime}`
      : 'Select a date & time';

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between h-[52px] px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">Book Service</Text>
        <View className="w-5" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-32" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {listingLoading && (
          <View className="mx-4 mt-4 px-4 py-3 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
            <Text className="text-figma-13 font-inter-500 text-textSecondary">Loading service details…</Text>
          </View>
        )}
        {!listingLoading && listingGone && (
          <View className="mx-4 mt-4 px-4 py-3 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
            <Text className="text-figma-14 font-inter-600 text-textPrimary">This service isn&apos;t bookable</Text>
            <Text className="text-figma-13 font-inter-400 text-textSecondary mt-1">
              Open it from the service listing to book — walk-in entries carry no real listing.
            </Text>
          </View>
        )}
        {!listingLoading && !listingGone && ownerless && (
          <View className="mx-4 mt-4 px-4 py-3 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainer }}>
            <Text className="text-figma-14 font-inter-600 text-textPrimary">Seller unverified</Text>
            <Text className="text-figma-13 font-inter-400 text-textSecondary mt-1">
              This listing has no seller attached — booking is disabled until the seller verifies the listing.
            </Text>
          </View>
        )}
        <View className="w-full h-48 bg-surfaceContainer overflow-hidden">
          {listingImage ? (
            <Image source={{ uri: listingImage }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Image source={bookServiceImages.hero} className="w-full h-full" resizeMode="cover" />
          )}
        </View>

        <View className="px-4 pt-4">
          <View className="flex-row items-center gap-1 mb-2">
            {/* Deterministic initials avatar (map/feed parity) — never one
                shared stock face for every provider. */}
            <AvatarView name={sellerNameParam || bookingSeller || 'Service Provider'} size={40} />
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{sellerNameParam || 'Service Provider'}</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary ml-1">{serviceCategory}</Text>
          </View>
          <Text className="text-figma-22 font-inter-700 text-textPrimary mb-1">{serviceTitle}</Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary leading-6 mb-6">
            {serviceDescription}
          </Text>

          {!listingGone && (
          <View className="flex-row gap-3 mb-6">
            {pkgs.map((pkg) => {
              const active = selectedPackage.name === pkg.name;
              return (
                <TouchableOpacity
                  key={pkg.name}
                  className={`flex-1 ${active ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'} rounded-figma-12 p-3 items-center`}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <Text className={`text-figma-20 font-inter-700 ${active ? 'text-white' : 'text-textPrimary'}`}>{formatPrice(pkg.price)}</Text>
                  <Text className={`text-figma-11 font-inter-400 ${active ? 'text-white/80' : 'text-textSecondary'}`}>{pkg.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          <Text className="text-figma-16 font-inter-600 text-textPrimary mb-3">Select Date & Time</Text>

          {/* Rolling 14-day strip: every window day is selectable, including
              across month boundaries. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
            {windowDays.map((day) => {
              const isToday = sameDay(day, today);
              const isSelected = !!selectedDate && sameDay(selectedDate, day);
              return (
                <TouchableOpacity
                  key={toISODate(day)}
                  onPress={() => setSelectedDate(day)}
                  className={`items-center justify-center px-3 py-2 rounded-figma-12 ${
                    isSelected ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'
                  }`}
                  style={isToday && !isSelected ? { borderWidth: 1, borderColor: colors.primaryContainer } : undefined}
                >
                  <Text className={`text-figma-11 font-inter-500 ${isSelected ? 'text-white' : 'text-textTertiary'}`}>
                    {WEEKDAYS[day.getDay()]}
                  </Text>
                  <Text className={`text-figma-14 font-inter-600 ${isSelected ? 'text-white' : 'text-textPrimary'}`}>
                    {day.getDate()} {MONTHS[day.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text className="text-figma-12 font-inter-400 text-textSecondary mb-3">Available slots (next 14 days — seller confirms your pick)</Text>
          <View className="flex-row flex-wrap gap-3 mb-4">
            {TIME_SLOTS.map((t) => {
              // No seller calendar exists (capacity unmodeled — the seller
              // confirms the slot after booking); same-day past slots are the
              // only honest disable.
              const past = slotInPast(t);
              const disabled = past;
              const active = selectedTime === t;
              return (
                <TouchableOpacity
                  key={t}
                  disabled={disabled}
                  onPress={() => setSelectedTime(t)}
                  className={`px-5 py-2 rounded-figma-full ${
                    active ? 'bg-primaryContainer' : disabled ? 'bg-surfaceContainer' : 'bg-surfaceContainerLow'
                  }`}
                >
                  <Text
                    className={`text-figma-12 font-inter-500 ${
                      active ? 'text-white' : disabled ? 'text-textTertiary' : 'text-textSecondary'
                    }`}
                    style={disabled ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="bg-surfaceContainerLow rounded-figma-12 px-4 py-3 mb-6">
            <Text className="text-figma-11 font-inter-500 text-textSecondary mb-1">Booking summary</Text>
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{summaryLine}</Text>
          </View>

          <Text className="text-figma-18 font-inter-700 text-textPrimary mb-3">Reviews</Text>
          {sellerRating ? (
            <Text className="text-figma-14 font-inter-600 text-textPrimary mb-6">
              ★ {sellerRating.avg.toFixed(1)} · {sellerRating.count} verified review{sellerRating.count === 1 ? '' : 's'}
            </Text>
          ) : (
            <Text className="text-figma-14 font-inter-400 text-textSecondary mb-6">
              No reviews yet. Book this service and be the first to leave one.
            </Text>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-surface px-4 pt-3 pb-8 border-t border-surfaceContainer" style={{ paddingBottom: insets.bottom + 32 }}>
        <TouchableOpacity
          disabled={!canBook}
          className={`w-full h-14 ${canBook ? 'bg-primaryContainer' : 'bg-surfaceContainer'} rounded-figma-16 items-center justify-center`}
          onPress={handleBook}
        >
          {placing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text className={`text-figma-16 font-inter-600 ${canBook ? 'text-white' : 'text-textTertiary'}`}>
              Book Now · {formatPrice(selectedPackage.price)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
