import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { bookServiceImages } from '../utils/screenImages';
import { BackIcon, StarIcon, MapPinIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders } from '../contexts/OrderContext';

const servicePackages = [
  { name: 'Starter', price: 149 },
  { name: 'Premium', price: 299 },
  { name: 'Business', price: 499 },
];

const REVIEWS = [
  { name: 'Priya', stars: 5, time: '2 days ago', text: 'Beautiful product shots — my listings finally look premium. Very quick turnaround.' },
  { name: 'Rohan', stars: 5, time: '5 days ago', text: 'On time, polite, and delivered 12 clean edited photos. Great value for the premium package.' },
  { name: 'Meera', stars: 4, time: '1 week ago', text: 'Great lighting and background removal. Took slightly longer than quoted but the results were worth it.' },
  { name: 'Arjun', stars: 4, time: '2 weeks ago', text: 'Solid work for the price. Communication could be faster, but the shots came out really well.' },
  { name: 'Kabir', stars: 3, time: '3 weeks ago', text: 'Decent photos, though a couple needed a reshoot. Prices are reasonable for the starter pack.' },
  { name: 'Ananya', stars: 5, time: '1 month ago', text: 'Booked the business package for my store launch — flawless studio experience and delivery on time.' },
] as const;

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
const BOOKED_TIMES = new Set(['1:00 PM', '4:00 PM']);

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
            name: 'Professional Photo Shoot',
            price: selectedPackage.price,
            quantity: 1,
            seller: 'Lens & Light Studio',
            sellerUsername: 'lens_light',
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
            <StarIcon size={16} />
            <Text className="text-figma-14 font-inter-600 text-textPrimary">4.9</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary ml-1">Photography</Text>
          </View>
          <Text className="text-figma-22 font-inter-700 text-textPrimary mb-1">Professional Photo Shoot</Text>
          <View className="flex-row items-center gap-2 mb-4">
            <MapPinIcon size={14} color="#5c5e63" />
            <Text className="text-figma-12 font-inter-400 text-textSecondary">2.3 km away</Text>
          </View>
          <Text className="text-figma-14 font-inter-400 text-textSecondary leading-6 mb-6">
            Professional product photography for your listings. Includes 10 edited photos with 
            studio lighting and background removal.
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
          {REVIEWS.map((r) => (
            <View key={r.name} className="flex-row mb-4 pb-4 border-b border-surfaceContainer">
              <View className="w-10 h-10 rounded-full bg-surfaceContainerLow items-center justify-center mr-3">
                <Text className="text-figma-12 font-inter-600 text-textPrimary">{r.name.charAt(0)}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-figma-13 font-inter-600 text-textPrimary">{r.name}</Text>
                  <View className="flex-row">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <StarIcon key={s} size={10} color={s <= r.stars ? undefined : colors.outlineVariant} />
                    ))}
                  </View>
                </View>
                <Text className="text-figma-11 font-inter-400 text-textTertiary mb-1">{r.time}</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary">{r.text}</Text>
              </View>
            </View>
          ))}
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
