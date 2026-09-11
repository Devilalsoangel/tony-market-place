import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { bookServiceImages } from '../utils/screenImages';
import { BackIcon, StarIcon, MapPinIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders } from '../contexts/OrderContext';

const servicePackages = [
  { name: 'Starter', price: 149 },
  { name: 'Premium', price: 299 },
  { name: 'Business', price: 499 },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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
// All slots honestly available — no phantom "booked" times.
const BOOKED_TIMES = new Set<string>();

const DAY_MS = 86400000;
const BOOKING_WINDOW_DAYS = 14;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildMonthGrid(now: Date): (Date | null)[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(now.getFullYear(), now.getMonth(), d));
  return cells;
}

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    seller?: string | string[];
    sellerUsername?: string | string[];
    title?: string | string[];
    description?: string | string[];
    category?: string | string[];
  }>();
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
  const [selectedPackage, setSelectedPackage] = useState(servicePackages[1]);
  const [placing, setPlacing] = useState(false);

  const today = startOfDay(new Date());
  const monthDays = buildMonthGrid(new Date());
  const windowStart = today.getTime();
  const windowEnd = windowStart + (BOOKING_WINDOW_DAYS - 1) * DAY_MS;
  const canBook = !!selectedDate && !!selectedTime && !placing;

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || placing) return;
    setPlacing(true);
    try {
      const [order] = placeOrders(
        [
          {
            listingId: 'service-photo-shoot',
            type: 'service',
            name: serviceTitle,
            price: selectedPackage.price,
            quantity: 1,
            seller: sellerNameParam || 'Service Provider',
            sellerUsername: sellerUsernameParam || 'service_provider',
          },
        ],
        undefined,
        undefined,
        { bookingDate: toISODate(selectedDate), bookingTime: selectedTime }
      );
      if (order) {
        router.push(`/track-order?id=${order.id}`);
      }
    } catch {
      Alert.alert("Couldn't place booking", 'Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
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
        <View className="w-full h-48 bg-surfaceContainer overflow-hidden">
          <Image source={bookServiceImages.hero} className="w-full h-full" resizeMode="cover" />
        </View>

        <View className="px-4 pt-4">
          <View className="flex-row items-center gap-1 mb-2">
            <Image source={bookServiceImages.avatar} className="w-10 h-10 rounded-full" style={{ backgroundColor: colors.surfaceContainer }} />
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{sellerNameParam || 'Service Provider'}</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary ml-1">{serviceCategory}</Text>
          </View>
          <Text className="text-figma-22 font-inter-700 text-textPrimary mb-1">{serviceTitle}</Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary leading-6 mb-6">
            {serviceDescription}
          </Text>

          <View className="flex-row gap-3 mb-6">
            {servicePackages.map((pkg) => {
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

          <Text className="text-figma-16 font-inter-600 text-textPrimary mb-3">Select Date & Time</Text>

          <View className="bg-surfaceContainerLowest rounded-figma-16 p-3 mb-4">
            <Text className="text-figma-14 font-inter-600 text-textPrimary text-center mb-3">
              {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
            </Text>
            <View className="flex-row mb-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <View key={i} className="items-center" style={{ width: `${100 / 7}%` }}>
                  <Text className="text-figma-11 font-inter-500 text-textTertiary">{label}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {monthDays.map((day, i) => {
                if (!day) {
                  return <View key={`empty-${i}`} style={{ width: `${100 / 7}%` }} />;
                }
                const time = day.getTime();
                const inWindow = time >= windowStart && time <= windowEnd;
                const isToday = sameDay(day, today);
                const isSelected = !!selectedDate && sameDay(selectedDate, day);
                const disabled = !inWindow;
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={disabled}
                    onPress={() => setSelectedDate(day)}
                    className="items-center justify-center py-1"
                    style={{ width: `${100 / 7}%` }}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isSelected
                          ? 'bg-primaryContainer'
                          : isToday
                            ? 'bg-surfaceContainerLow'
                            : disabled
                              ? ''
                              : 'bg-surfaceContainerLow'
                      }`}
                      style={isToday && !isSelected ? { borderWidth: 1, borderColor: colors.primaryContainer } : undefined}
                    >
                      <Text
                        className={`text-figma-12 ${
                          isSelected
                            ? 'text-white font-inter-600'
                            : disabled
                              ? 'text-textTertiary font-inter-400'
                              : isToday
                                ? 'text-primary font-inter-600'
                                : 'text-textPrimary font-inter-400'
                        }`}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text className="text-figma-12 font-inter-400 text-textSecondary mb-3">Available slots (next 14 days)</Text>
          <View className="flex-row flex-wrap gap-3 mb-4">
            {TIME_SLOTS.map((t) => {
              const booked = BOOKED_TIMES.has(t);
              const active = selectedTime === t;
              return (
                <TouchableOpacity
                  key={t}
                  disabled={booked}
                  onPress={() => setSelectedTime(t)}
                  className={`px-5 py-2 rounded-figma-full ${
                    active ? 'bg-primaryContainer' : booked ? 'bg-surfaceContainer' : 'bg-surfaceContainerLow'
                  }`}
                >
                  <Text
                    className={`text-figma-12 font-inter-500 ${
                      active ? 'text-white' : booked ? 'text-textTertiary' : 'text-textSecondary'
                    }`}
                    style={booked ? { textDecorationLine: 'line-through' } : undefined}
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
          <Text className="text-figma-14 font-inter-400 text-textSecondary mb-6">
            No reviews yet. Book this service and be the first to leave one.
          </Text>
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
