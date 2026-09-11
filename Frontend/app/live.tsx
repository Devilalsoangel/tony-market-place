import { useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { BackIcon, CloseIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { resolveAvatar } from '../utils/productImages';
import { useAuth } from '../contexts/AuthContext';
import { serverApi } from '../utils/serverApi';

interface LiveRoom {
  id: string;
  title: string;
  hostName: string;
  hostUsername: string;
  viewers: number;
  status: string;
  startedAt: number;
}

const minutesLabel = (startedAt: number): string => {
  const mins = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (mins < 1) return 'just started';
  if (mins < 60) return `started ${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `started ${h}h ${mins % 60}m ago`;
};

// Live Shopping — REAL seller live rooms from /api/app/live. Rooms are created
// by sellers via Go Live; tapping a room opens that seller's shop. No fake
// viewer counts, no fabricated broadcasts.
export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [streams, setStreams] = useState<LiveRoom[] | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);

  const load = useCallback(async (active: boolean) => {
    const res = await serverApi.getLiveStreams();
    if (!active) return;
    // Legacy seed rows carry no hostUsername — only real app-created rooms list.
    setStreams(res.ok && res.data?.streams ? (res.data.streams.filter((s) => s.hostUsername) as LiveRoom[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(active);
      return () => {
        active = false;
      };
    }, [load])
  );

  const endStream = async (id: string) => {
    if (endingId) return;
    setEndingId(id);
    await serverApi.endLiveStream(id);
    setEndingId(null);
    load(true);
  };

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

      {streams === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primaryContainer} />
        </View>
      ) : streams.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 15, lineHeight: 22 }}>
            No one is live right now. Sellers can start a room from the create row on Home.
          </Text>
        </View>
      ) : (
        <View className="px-5 pt-2" style={{ gap: 12 }}>
          {streams.some((s) => s.status === 'live') && (
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Live now
            </Text>
          )}
          {streams.filter((s) => s.status === 'live').map((s) => {
            const mine = user?.username && s.hostUsername === user.username;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.9}
                className="flex-row items-center rounded-figma-24 p-4"
                style={{ backgroundColor: colors.surfaceContainerLowest, gap: 12 }}
                onPress={() => !mine && router.push(`/seller/${s.hostUsername}`)}
              >
                <Image source={resolveAvatar(s.hostUsername)} className="w-14 h-14 rounded-full" />
                <View className="flex-1">
                  <View className="flex-row items-center self-start px-1.5 rounded-full" style={{ backgroundColor: colors.error }}>
                    <Text className="font-inter-700 text-white" style={{ fontSize: 9, lineHeight: 13, letterSpacing: 0.6 }}>
                      LIVE
                    </Text>
                  </View>
                  <Text className="font-inter-600 text-textPrimary mt-1" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text className="font-inter-400 text-secondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                    {s.hostName} · {minutesLabel(s.startedAt)}
                  </Text>
                </View>
                {mine ? (
                  <TouchableOpacity
                    onPress={() => endStream(s.id)}
                    disabled={endingId === s.id}
                    className="h-9 px-4 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.surfaceContainer }}
                  >
                    <Text className="font-inter-600 text-error" style={{ fontSize: 13, lineHeight: 17 }}>
                      {endingId === s.id ? 'Ending…' : 'End'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="h-9 px-4 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
                    <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 17 }}>
                      View shop
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {streams.some((s) => s.status !== 'live') && (
            <Text className="font-inter-700 text-textPrimary mt-2" style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Recently live
            </Text>
          )}
          {streams.filter((s) => s.status !== 'live').map((s) => (
            <TouchableOpacity
              key={s.id}
              activeOpacity={0.9}
              className="flex-row items-center rounded-figma-24 p-4"
              style={{ backgroundColor: colors.surfaceContainerLowest, gap: 12, opacity: 0.85 }}
              onPress={() => router.push(`/seller/${s.hostUsername}`)}
            >
              <Image source={resolveAvatar(s.hostUsername)} className="w-14 h-14 rounded-full" />
              <View className="flex-1">
                <View className="flex-row items-center self-start px-1.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-700 text-secondary" style={{ fontSize: 9, lineHeight: 13, letterSpacing: 0.6 }}>
                    ENDED
                  </Text>
                </View>
                <Text className="font-inter-600 text-textPrimary mt-1" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text className="font-inter-400 text-secondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                  {s.hostName} · {minutesLabel(s.startedAt)}
                </Text>
              </View>
              <View className="h-9 px-4 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-600 text-secondary" style={{ fontSize: 13, lineHeight: 17 }}>
                  View shop
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
