import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '../../utils/theme';
import { resolveAvatar } from '../../utils/productImages';
import { serverApi } from '../../utils/serverApi';

// Live room deep link — resolves against REAL active streams from
// /api/app/live. Unknown/ended ids render the honest unavailable state.
export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [room, setRoom] = useState<{ title: string; hostName: string; hostUsername: string } | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    serverApi.getLiveStreams().then((res) => {
      if (!active) return;
      const found = res.ok && res.data?.streams ? res.data.streams.find((s: { id: string }) => s.id === id) : null;
      setRoom(found ? { title: found.title, hostName: found.hostName, hostUsername: found.hostUsername } : null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (room === undefined) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  if (!room) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.surface }}>
        <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 18, lineHeight: 26 }}>
          Stream ended or no longer available
        </Text>
        <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 14, lineHeight: 20 }}>
          This live room is not broadcasting right now.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 rounded-full px-6 py-2.5 items-center justify-center"
          style={{ backgroundColor: colors.primaryContainer }}
        >
          <Text className="font-inter-700" style={{ fontSize: 14, lineHeight: 16, color: colors.onPrimary }}>
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 px-5" style={{ backgroundColor: colors.surface, paddingTop: 80 }}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="absolute top-12 left-5">
        <Text className="font-inter-600 text-primary" style={{ fontSize: 15, lineHeight: 20 }}>
          Back
        </Text>
      </TouchableOpacity>

      <View className="items-center">
        <Image source={resolveAvatar(room.hostUsername)} className="w-24 h-24 rounded-full" />
        <View className="flex-row items-center mt-4 self-center px-2 rounded-full" style={{ backgroundColor: colors.error }}>
          <Text className="font-inter-700 text-white" style={{ fontSize: 10, lineHeight: 14, letterSpacing: 0.8 }}>
            LIVE NOW
          </Text>
        </View>
        <Text className="font-inter-700 text-textPrimary text-center mt-3" style={{ fontSize: 20, lineHeight: 27 }}>
          {room.title}
        </Text>
        <Text className="font-inter-400 text-secondary text-center mt-1" style={{ fontSize: 14, lineHeight: 19 }}>
          {room.hostName} is live shopping
        </Text>

        <TouchableOpacity
          onPress={() => router.replace(`/seller/${room.hostUsername}`)}
          className="mt-8 h-12 px-8 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primaryContainer }}
        >
          <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
            View shop
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
