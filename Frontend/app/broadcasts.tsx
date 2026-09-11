import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { serverApi } from '../utils/serverApi';

const JOINED_KEY_BASE = '@susej_broadcast_joined';
const JOINED_KEY = JOINED_KEY_BASE;

export interface BroadcastChannel {
  id: string;
  name: string;
  tagline: string;
}

// Server directory with local-only fallback (offline-first). The export stays
// for the detail screen's synchronous first paint; live data flows via state.
export const BROADCAST_CHANNELS: BroadcastChannel[] = [];

export default function BroadcastChannelsScreen() {
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await serverApi.getBroadcasts();
          if (active && res.ok && res.data?.broadcasts) {
            setChannels(
              res.data.broadcasts.map((c: any) => ({
                id: String(c.id),
                name: String(c.name ?? c.title ?? 'Channel'),
                tagline: String(c.tagline ?? ''),
              }))
            );
          }
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

  const joinedKey = user?.username ? `${JOINED_KEY_BASE}:${user.username}` : JOINED_KEY_BASE;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AsyncStorage.getItem(joinedKey)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          try { setJoined(JSON.parse(data) as Record<string, boolean>); return; } catch {}
        }
        if (joinedKey !== JOINED_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(JOINED_KEY_BASE);
          if (!cancelled && legacy) {
            try { const p = JSON.parse(legacy) as Record<string, boolean>; setJoined(p); try { await AsyncStorage.setItem(joinedKey, legacy); } catch {} return; } catch {}
          }
        }
        if (!cancelled) setJoined({});
      })
      .catch(() => { if (!cancelled) setJoined({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [joinedKey, tokenSeq]);

  const toggleJoin = useCallback((id: string) => {
    setJoined((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(joinedKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [joinedKey]);

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
          data={channels}
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
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
