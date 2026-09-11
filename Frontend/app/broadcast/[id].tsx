import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { ChevronLeftIcon, SendIcon, HeartIcon, CommentIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { BROADCAST_CHANNELS } from '../broadcasts';
import { serverApi } from '../../utils/serverApi';
import { useAuth } from '../../contexts/AuthContext';

const JOINED_KEY_BASE = '@susej_broadcast_joined';
const POSTS_KEY_BASE = '@susej_broadcast_posts';
const JOINED_KEY = JOINED_KEY_BASE;
const POSTS_KEY = POSTS_KEY_BASE;

interface BroadcastPost {
  id: string;
  author: string;
  time: string;
  text: string;
  image?: any;
  likes: number;
  comments: number;
}

export default function BroadcastChannelScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const channelId = Array.isArray(id) ? id[0] : id ?? '';
  const { user, tokenSeq } = useAuth();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BroadcastPost[] | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');

  const [serverChannel, setServerChannel] = useState<{ id: string; name: string; tagline: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    serverApi
      .getBroadcasts()
      .then((res) => {
        if (cancelled || !res.ok || !res.data?.broadcasts) return;
        const found = (res.data.broadcasts as any[]).find((c) => String(c.id) === channelId);
        if (found) setServerChannel({ id: String(found.id), name: String(found.name ?? 'Channel'), tagline: String(found.tagline ?? '') });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channelId]);
  const channel = serverChannel ?? BROADCAST_CHANNELS.find((c) => c.id === channelId);
  const joinedKey = user?.username ? `${JOINED_KEY_BASE}:${user.username}` : JOINED_KEY_BASE;
  const postsKey = user?.username ? `${POSTS_KEY_BASE}:${user.username}` : POSTS_KEY_BASE;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(joinedKey)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          try { const map = JSON.parse(data) as Record<string, boolean>; setJoined(!!map[channelId]); return; } catch {}
        }
        if (joinedKey !== JOINED_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(JOINED_KEY_BASE);
          if (!cancelled && legacy) {
            try { const map = JSON.parse(legacy) as Record<string, boolean>; if (map[channelId]) { setJoined(true); try { await AsyncStorage.setItem(joinedKey, legacy); } catch {} return; } } catch {}
          }
        }
        if (!cancelled) setJoined(false);
      })
      .catch(() => { if (!cancelled) setJoined(false); });
    return () => { cancelled = true; };
  }, [channelId, joinedKey, tokenSeq]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AsyncStorage.getItem(postsKey)
      .then(async (data) => {
        if (cancelled) return;
        let real: BroadcastPost[] = [];
        let found = false;
        if (data) {
          try {
            const map = JSON.parse(data) as Record<string, BroadcastPost[]>;
            const all = map[channelId] ?? [];
            real = all.filter((p) => p && !String(p.id).startsWith('bp_'));
            found = true;
          } catch {}
        }
        if (!found && postsKey !== POSTS_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(POSTS_KEY_BASE);
          if (!cancelled && legacy) {
            try {
              const map = JSON.parse(legacy) as Record<string, BroadcastPost[]>;
              const all = map[channelId] ?? [];
              real = all.filter((p) => p && !String(p.id).startsWith('bp_'));
              try { await AsyncStorage.setItem(postsKey, legacy); } catch {}
            } catch {}
          }
        }
        if (!cancelled) setPosts(real);
      })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId, postsKey, tokenSeq]);

  const join = useCallback(() => {
    const next = { [channelId]: true };
    AsyncStorage.getItem(joinedKey)
      .then((data) => {
        if (data) {
          try {
            Object.assign(next, JSON.parse(data) as Record<string, boolean>);
          } catch {}
        }
        next[channelId] = true;
        AsyncStorage.setItem(joinedKey, JSON.stringify(next)).catch(() => {});
      })
      .catch(() => {});
    setJoined(true);
  }, [channelId, joinedKey]);

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    const post: BroadcastPost = {
      // Non-bp_ prefix: the load filter drops legacy bp_ demo seeds, so user
      // posts must never use it (they would vanish on reload).
      id: `bc_${Date.now()}`,
      author: 'You',
      time: 'Just now',
      text: text.trim(),
      likes: 0,
      comments: 0,
    };
    setPosts((prev) => {
      const next = [post, ...(prev ?? [])];
      AsyncStorage.getItem(postsKey)
        .then((data) => {
          const map = data ? (JSON.parse(data) as Record<string, BroadcastPost[]>) : {};
          map[channelId] = next;
          AsyncStorage.setItem(postsKey, JSON.stringify(map)).catch(() => {});
        })
        .catch(() => {});
      return next;
    });
    setText('');
  }, [text, channelId, postsKey]);

  const toggleLike = useCallback((postId: string) => {
    setLiked((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }, []);

  return (
    <View className="flex-1 bg-surface">
      {/* Header — back + channel name + members */}
      <View
        className="flex-row items-center px-5"
        style={{ backgroundColor: colors.surface, height: 66 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
            {channel?.name ?? 'Broadcast'}
          </Text>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
            {channel?.tagline ?? 'Channel unavailable'}
          </Text>
        </View>
        <View style={{ width: 18 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : !channel ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
            This broadcast channel doesn't exist or was removed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-32 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 128 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Join gate */}
              {!joined && (
                <View className="rounded-figma-16 px-4 py-4 mb-5 items-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
                  <Text className="text-figma-14 font-inter-600 text-textPrimary">{channel.name}</Text>
                  <Text className="text-figma-12 font-inter-400 text-textSecondary text-center mt-1" style={{ lineHeight: 16 }}>
                    {channel.tagline}. Join to post updates and never miss a drop.
                  </Text>
                  <TouchableOpacity className="mt-3 px-6 py-2 bg-primaryContainer rounded-figma-full" onPress={join}>
                    <Text className="text-figma-12 font-inter-600 text-white">Join Channel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center pt-12 px-8">
              <Text className="font-inter-500 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
                No posts yet in this channel. Be the first to share an update.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isLiked = !!liked[item.id];
            return (
              <View className="bg-white rounded-figma-16 mb-4 overflow-hidden" style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}>
                <View className="p-4">
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="w-9 h-9 rounded-full bg-surfaceContainer items-center justify-center">
                      <Text className="text-figma-12 font-inter-600 text-textSecondary">{item.author.charAt(0)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-figma-13 font-inter-600 text-textPrimary">{item.author}</Text>
                      <Text className="text-figma-11 font-inter-400 text-textSecondary">{item.time} ago</Text>
                    </View>
                  </View>
                  <Text className="text-figma-13 font-inter-400 text-textPrimary mt-3" style={{ lineHeight: 19 }}>
                    {item.text}
                  </Text>
                  {item.image && (
                    <Image source={item.image} className="w-full rounded-figma-12 mt-3" style={{ height: 180, resizeMode: 'cover' }} />
                  )}
                  <View className="flex-row items-center mt-3" style={{ gap: 20 }}>
                    <TouchableOpacity className="flex-row items-center" style={{ gap: 6 }} onPress={() => toggleLike(item.id)}>
                      <HeartIcon size={18} color={isLiked ? colors.error : colors.textSecondary} />
                      <Text className="text-figma-12 font-inter-500 text-textSecondary">{item.likes + (isLiked ? 1 : 0)}</Text>
                    </TouchableOpacity>
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <CommentIcon size={18} color={colors.textSecondary} />
                      <Text className="text-figma-12 font-inter-500 text-textSecondary">{item.comments}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Inline composer — joined only */}
      {joined && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row items-center px-4 py-3"
          style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer, paddingBottom: insets.bottom + 12 }}
        >
          <View className="flex-1 h-11 bg-surfaceContainerLow rounded-figma-16 px-4 justify-center mr-3">
            <TextInput
              className="font-inter-400 text-textPrimary"
              style={{ fontSize: 16, lineHeight: 24 }}
              placeholder="Share an update..."
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
            />
          </View>
          <TouchableOpacity
            className={`w-11 h-11 rounded-figma-full items-center justify-center ${text.trim() ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}
            onPress={handleSend}
          >
            <SendIcon size={18} color={text.trim() ? colors.surfaceContainerLowest : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
