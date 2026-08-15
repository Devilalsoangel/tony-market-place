import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon, BellIcon, ChevronRightIcon, CloseIcon } from '../utils/icons';
import { colors, formatCount } from '../utils/theme';
import { productImages } from '../utils/productImages';

export interface LiveRoom {
  id: string;
  sellerName: string;
  sellerUsername: string;
  title: string;
  viewers: number;
  category: string;
  scheduled?: string;
}

export const LIVE_ROOMS: LiveRoom[] = [
  { id: 'live_001', sellerName: 'Luxe Thread Studio', sellerUsername: 'luxe', title: 'Unboxing new saree arrivals', viewers: 1200, category: 'Fashion' },
  { id: 'live_002', sellerName: 'TechVault', sellerUsername: 'techvault', title: 'MacBook deals — live Q&A', viewers: 3400, category: 'Electronics' },
  { id: 'live_003', sellerName: 'Urban Jungle', sellerUsername: 'urbanjungle', title: 'Plant care tips + sale', viewers: 890, category: 'Home' },
  { id: 'live_004', sellerName: 'FreshBasket', sellerUsername: 'freshbasket', title: 'Farm fresh veggies unboxing', viewers: 2100, category: 'Food' },
];

export const UPCOMING_ROOMS: LiveRoom[] = [
  { id: 'live_005', sellerName: 'Brush & Style Studio', sellerUsername: 'brushstyle', title: 'Home makeover before & after', viewers: 0, category: 'Home Services', scheduled: 'Today 7 PM' },
  { id: 'live_006', sellerName: 'Hype Vault', sellerUsername: 'hypevault', title: 'Sneaker drops live', viewers: 0, category: 'Fashion', scheduled: 'Tomorrow 11 AM' },
];

const roomImage = (id: string): any => productImages[id] ?? { uri: `https://picsum.photos/seed/${id}/400/500` };

function EyeIcon({ size = 12, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

function LiveNowCard({ room }: { room: LiveRoom }) {
  return (
    <TouchableOpacity
      className="bg-surfaceContainerLowest rounded-figma-24 mb-4 overflow-hidden"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
      onPress={() => router.push(`/live/${room.id}`)}
    >
      <View className="w-full aspect-square bg-surfaceContainer">
        <Image source={roomImage(room.id)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        <LinearGradient colors={['transparent', colors.overlayLight]} className="absolute left-0 right-0 bottom-0" style={{ height: 120 }} />
        {/* LIVE badge */}
        <View className="absolute top-3 left-3 flex-row items-center px-2 py-1 rounded-md" style={{ backgroundColor: colors.error, gap: 4 }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.onError }} />
          <Text className="font-inter-700" style={{ fontSize: 11, lineHeight: 13, color: colors.onError, letterSpacing: 0.4 }}>LIVE</Text>
        </View>
        {/* Category chip */}
        <View className="absolute top-3 right-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLowest, opacity: 0.92 }}>
          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 13, color: colors.tertiary }}>{room.category}</Text>
        </View>
        {/* Viewer count pill */}
        <View className="absolute bottom-3 left-3 flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.overlay, gap: 5 }}>
          <EyeIcon size={12} color={colors.surfaceContainerLowest} />
          <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: colors.surfaceContainerLowest }}>
            {formatCount(room.viewers)} watching
          </Text>
        </View>
      </View>
      <View className="p-3">
        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20, letterSpacing: 0.14 }} numberOfLines={1}>
          {room.title}
        </Text>
        <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 13, lineHeight: 18 }}>
          {room.sellerName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function UpcomingCard({ room, reminded, onToggleRemind }: { room: LiveRoom; reminded: boolean; onToggleRemind: () => void }) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-surfaceContainerLowest rounded-figma-24 p-3 mb-3"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
      onPress={() => router.push(`/live/${room.id}`)}
    >
      <View className="w-16 h-16 rounded-figma-16 overflow-hidden bg-surfaceContainer">
        <Image source={roomImage(room.id)} className="w-full h-full" resizeMode="cover" />
      </View>
      <View className="flex-1 ml-3 pr-2">
        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18, letterSpacing: 0.14 }} numberOfLines={1}>
          {room.title}
        </Text>
        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
          {room.sellerName}
        </Text>
        <View className="self-start mt-1.5 px-2 py-0.5 rounded-md" style={{ backgroundColor: colors.primaryFixed }}>
          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.onPrimaryFixedVariant }}>
            {room.scheduled}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        className="flex-row items-center px-3 py-2 rounded-full"
        style={{ backgroundColor: reminded ? colors.primaryContainer : colors.surfaceContainerLow, gap: 5 }}
        onPress={onToggleRemind}
      >
        <BellIcon size={14} color={reminded ? colors.onPrimary : colors.textSecondary} />
        <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: reminded ? colors.onPrimary : colors.textSecondary }}>
          {reminded ? 'Set' : 'Remind'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const [reminded, setReminded] = useState<Record<string, boolean>>({});

  const toggleRemind = (id: string) => setReminded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-4 bg-surface" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <BackIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.5 }}>
          Live Shopping
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <CloseIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {LIVE_ROOMS.length === 0 && UPCOMING_ROOMS.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 15, lineHeight: 22 }}>
            No live rooms right now. Sellers will go live soon — check back later.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
          {/* LIVE NOW */}
          <View className="flex-row items-center mb-3 mt-2" style={{ gap: 8 }}>
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
              LIVE NOW
            </Text>
            <View className="flex-row items-center px-2 py-0.5 rounded-md" style={{ backgroundColor: colors.error, gap: 5 }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.onError }} />
              <Text className="font-inter-700" style={{ fontSize: 11, lineHeight: 13, color: colors.onError, letterSpacing: 0.4 }}>LIVE</Text>
            </View>
            <View className="flex-1" />
            <ChevronRightIcon size={14} color={colors.secondary} />
          </View>

          {LIVE_ROOMS.length === 0 ? (
            <View className="items-center py-10 px-6 bg-surfaceContainerLow rounded-figma-24 mb-4">
              <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
                No sellers are live right now.
              </Text>
            </View>
          ) : (
            LIVE_ROOMS.map((room) => <LiveNowCard key={room.id} room={room} />)
          )}

          {/* Upcoming */}
          <Text className="font-inter-700 text-textPrimary mb-3 mt-2" style={{ fontSize: 20, lineHeight: 28 }}>
            Upcoming
          </Text>
          {UPCOMING_ROOMS.map((room) => (
            <UpcomingCard
              key={room.id}
              room={room}
              reminded={!!reminded[room.id]}
              onToggleRemind={() => toggleRemind(room.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
