import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

const BLOCKED_KEY_BASE = '@susej_blocked';

export interface BlockedUser {
  username: string;
  name?: string;
  at?: number;
}

const formatTime = (time?: number): string => {
  if (!time) return '';
  const days = Math.floor((Date.now() - time) / 86400000);
  if (days < 1) return 'Blocked today';
  if (days < 7) return `Blocked ${days}d ago`;
  return `Blocked ${new Date(time).toLocaleDateString()}`;
};

export default function BlockedScreen() {
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const username = user?.username ?? null;
  const blockedKey = username ? `${BLOCKED_KEY_BASE}:${username}` : BLOCKED_KEY_BASE;
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  useEffect(() => {
    setBlocked([]);
    setLoaded(false);
  }, [tokenSeq]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let data = await AsyncStorage.getItem(blockedKey);
        if (!data && blockedKey !== BLOCKED_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(BLOCKED_KEY_BASE);
          if (legacy) data = legacy;
        }
        if (data && active) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            const real = (parsed as BlockedUser[]).filter(
              (b) => b && b.username && b.username !== 'hype_vault'
            );
            setBlocked(real);
          }
        }
      } catch {
        // corrupted cache — start empty
      }
      if (active) setLoaded(true);
    })();
    return () => { active = false; };
  }, [blockedKey, tokenSeq]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(blockedKey, JSON.stringify(blocked)).catch(() => {});
  }, [blocked, loaded, blockedKey]);

  const unblock = (user: BlockedUser) => {
    Alert.alert(
      `Unblock @${user.username}?`,
      'They will be able to see your profile, posts and message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => setBlocked((prev) => prev.filter((b) => b.username !== user.username)),
        },
      ]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Blocked Users
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : blocked.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.surfaceContainer }}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z" fill={colors.surfaceContainerHigh} />
            </Svg>
          </View>
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
            No blocked users
          </Text>
          <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 13, lineHeight: 18 }}>
            Users you block won't be able to see your profile, posts or message you.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 + insets.bottom }}>
          <Text className="font-inter-400 text-textSecondary mb-4" style={{ fontSize: 13, lineHeight: 18 }}>
            Users you block can't see your profile, posts or send you messages.
          </Text>
          {blocked.map((user) => (
            <View
              key={user.username}
              className="flex-row items-center mb-3 px-4 py-4"
              style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            >
              <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-600" style={{ fontSize: 16, color: colors.textSecondary }}>
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 pr-3">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                  {user.name || user.username}
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                  @{user.username} · {formatTime(user.at)}
                </Text>
              </View>
              <TouchableOpacity
                className="px-4 items-center justify-center border"
                style={{ height: 38, borderRadius: 12, borderColor: colors.outlineVariant }}
                onPress={() => unblock(user)}
              >
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                  Unblock
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
