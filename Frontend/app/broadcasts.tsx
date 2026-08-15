import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeftIcon } from '../utils/icons';
import { colors, formatCount } from '../utils/theme';

const JOINED_KEY = '@susej_broadcast_joined';

export interface BroadcastChannel {
  id: string;
  name: string;
  owner: string;
  memberCount: number;
  tagline: string;
  lastPost: string;
  pinned: string;
}

export const BROADCAST_CHANNELS: BroadcastChannel[] = [
  {
    id: 'bc_saree',
    name: 'Saree Festival Deals',
    owner: 'Luxe Thread Studio',
    memberCount: 12400,
    tagline: 'New drop every Friday',
    lastPost: 'New Kanjivaram collection — 30% off',
    pinned: 'Kanjivaram Festival Sale — flat 30% off all handloom sarees. Ends Sunday!',
  },
  {
    id: 'bc_tech',
    name: 'Tech Tuesday Drops',
    owner: 'TechVault',
    memberCount: 8100,
    tagline: 'Refurb + new gear weekly',
    lastPost: 'Apple Watch S9 refurb — ₹24,999',
    pinned: 'Tech Tuesday: refurbished MacBooks + fresh gear drops every Tuesday at 11 AM.',
  },
  {
    id: 'bc_home',
    name: 'Home Decor Ideas',
    owner: 'Urban Nest',
    memberCount: 5300,
    tagline: 'Daily styling tips',
    lastPost: '5 living room hacks for small spaces',
    pinned: 'Tip of the week: swap plain cushions for textured throws — instant cozy upgrade.',
  },
];

export default function BroadcastChannelsScreen() {
  const insets = useSafeAreaInsets();
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(JOINED_KEY)
      .then((data) => {
        if (data) {
          try {
            setJoined(JSON.parse(data) as Record<string, boolean>);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleJoin = useCallback((id: string) => {
    setJoined((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(JOINED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <View className="flex-1 bg-white">
      {/* Header — back + title */}
      <View
        className="flex-row items-center px-5 bg-surface"
        style={{
          height: 68 + insets.top,
          paddingTop: insets.top,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text
          className="text-figma-20 font-inter-700 text-textPrimary flex-1 text-center mr-5"
          style={{ letterSpacing: -0.4 }}
        >
          Broadcast Channels
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={BROADCAST_CHANNELS}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pt-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-4">
              Announcements from sellers and communities you follow. Join a channel to get updates in your feed.
            </Text>
          }
          ListEmptyComponent={
            <View className="items-center justify-center pt-16 px-8">
              <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
                No broadcast channels yet. Check back soon.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isJoined = !!joined[item.id];
            return (
              <TouchableOpacity
                className="bg-white rounded-figma-16 mb-4 overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: colors.surfaceContainer,
                  shadowColor: colors.textPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 3,
                }}
                onPress={() => router.push(`/broadcast/${item.id}`)}
              >
                <View className="p-4">
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="w-11 h-11 rounded-full bg-primaryContainer items-center justify-center">
                      <Text className="text-figma-14 font-inter-700 text-white">{item.name.charAt(0)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-figma-14 font-inter-600 text-textPrimary">{item.name}</Text>
                      <Text className="text-figma-12 font-inter-400 text-textSecondary">
                        {item.owner} · {formatCount(item.memberCount)} members
                      </Text>
                    </View>
                    <TouchableOpacity
                      className={`px-4 py-1.5 rounded-figma-full ${isJoined ? 'bg-surfaceContainerLow' : 'bg-primaryContainer'}`}
                      onPress={() => toggleJoin(item.id)}
                    >
                      <Text className={`text-figma-12 font-inter-600 ${isJoined ? 'text-secondary' : 'text-white'}`}>
                        {isJoined ? 'Joined' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="text-figma-12 font-inter-500 text-primary mt-3">{item.tagline}</Text>
                  <View className="bg-surfaceContainerLow rounded-figma-12 px-3 py-2 mt-2">
                    <Text className="text-figma-12 font-inter-400 text-textSecondary" numberOfLines={2}>
                      {item.lastPost}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
