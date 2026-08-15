import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { ChevronLeftIcon, SendIcon, HeartIcon, CommentIcon } from '../../utils/icons';
import { colors, formatCount, formatPrice } from '../../utils/theme';
import { productImages } from '../../utils/productImages';
import { BROADCAST_CHANNELS } from '../broadcasts';

const JOINED_KEY = '@susej_broadcast_joined';
const POSTS_KEY = '@susej_broadcast_posts';

interface BroadcastPost {
  id: string;
  author: string;
  time: string;
  text: string;
  image?: any;
  likes: number;
  comments: number;
}

const SEED_POSTS: Record<string, BroadcastPost[]> = {
  bc_saree: [
    {
      id: 'bp_s1',
      author: 'Luxe Thread Studio',
      time: '2h',
      text: 'New Kanjivaram collection — 30% off. Pure silk, handloom weaves, 40+ new designs live now. Use code FEST30 at checkout.',
      image: productImages['post_001'],
      likes: 1284,
      comments: 96,
    },
    {
      id: 'bp_s2',
      author: 'Luxe Thread Studio',
      time: '1d',
      text: 'Behind the loom: how our Kanjivaram sarees are woven. Full video up on the feed!',
      likes: 4862,
      comments: 210,
    },
    {
      id: 'bp_s3',
      author: 'Luxe Thread Studio',
      time: '2d',
      text: 'Festival styling tip: pair a plain blouse with a printed saree for a modern look.',
      likes: 952,
      comments: 41,
    },
  ],
  bc_tech: [
    {
      id: 'bp_t1',
      author: 'TechVault',
      time: '5h',
      text: `Apple Watch S9 refurb drop — ${formatPrice(24999)}. 90-day warranty, certified battery health.`,
      image: productImages['post_002'],
      likes: 731,
      comments: 58,
    },
    {
      id: 'bp_t2',
      author: 'TechVault',
      time: '1d',
      text: `Refurb MacBook Air M1 back in stock — ${formatPrice(54999)}. Only 12 units, first come first served.`,
      likes: 1102,
      comments: 87,
    },
    {
      id: 'bp_t3',
      author: 'TechVault',
      time: '3d',
      text: 'Cleaning hack: 70% isopropyl + microfiber for screens. Never use alcohol wipes on coated displays.',
      likes: 388,
      comments: 22,
    },
  ],
  bc_home: [
    {
      id: 'bp_h1',
      author: 'Urban Nest',
      time: '6h',
      text: '5 living room hacks for small spaces — foldable tables, wall mirrors, and smart lighting.',
      likes: 2103,
      comments: 134,
    },
    {
      id: 'bp_h2',
      author: 'Urban Nest',
      time: '1d',
      text: "Today's palette: warm beige + terracotta + olive. Instant cozy, zero renovation.",
      likes: 1567,
      comments: 102,
    },
    {
      id: 'bp_h3',
      author: 'Urban Nest',
      time: '2d',
      text: `Budget makeover: a ${formatPrice(5000)} living room refresh — here's what we changed.`,
      likes: 2894,
      comments: 176,
    },
  ],
};

function PinIcon({ size = 14, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
        fill={color}
      />
    </Svg>
  );
}

export default function BroadcastChannelScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const channelId = Array.isArray(id) ? id[0] : id ?? '';
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BroadcastPost[] | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');

  const channel = BROADCAST_CHANNELS.find((c) => c.id === channelId);

  useEffect(() => {
    AsyncStorage.getItem(JOINED_KEY)
      .then((data) => {
        if (data) {
          try {
            const map = JSON.parse(data) as Record<string, boolean>;
            setJoined(!!map[channelId]);
          } catch {}
        }
      })
      .catch(() => {});
  }, [channelId]);

  useEffect(() => {
    AsyncStorage.getItem(POSTS_KEY)
      .then((data) => {
        if (data) {
          try {
            const map = JSON.parse(data) as Record<string, BroadcastPost[]>;
            setPosts(map[channelId] ?? SEED_POSTS[channelId] ?? []);
          } catch {
            setPosts(SEED_POSTS[channelId] ?? []);
          }
        } else {
          setPosts(SEED_POSTS[channelId] ?? []);
        }
      })
      .catch(() => {
        setPosts(SEED_POSTS[channelId] ?? []);
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  const join = useCallback(() => {
    const next = { [channelId]: true };
    AsyncStorage.getItem(JOINED_KEY)
      .then((data) => {
        if (data) {
          try {
            Object.assign(next, JSON.parse(data) as Record<string, boolean>);
          } catch {}
        }
        next[channelId] = true;
        AsyncStorage.setItem(JOINED_KEY, JSON.stringify(next)).catch(() => {});
      })
      .catch(() => {});
    setJoined(true);
  }, [channelId]);

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    const post: BroadcastPost = {
      id: `bp_${Date.now()}`,
      author: 'You',
      time: 'Just now',
      text: text.trim(),
      likes: 0,
      comments: 0,
    };
    setPosts((prev) => {
      const next = [post, ...(prev ?? [])];
      AsyncStorage.getItem(POSTS_KEY)
        .then((data) => {
          const map = data ? (JSON.parse(data) as Record<string, BroadcastPost[]>) : {};
          map[channelId] = next;
          AsyncStorage.setItem(POSTS_KEY, JSON.stringify(map)).catch(() => {});
        })
        .catch(() => {});
      return next;
    });
    setText('');
  }, [text, channelId]);

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
            {channel ? `${formatCount(channel.memberCount)} members` : 'Channel unavailable'}
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
              {/* Pinned announcement banner */}
              <View
                className="rounded-figma-16 px-4 py-3 mb-5 flex-row items-start"
                style={{ backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.surfaceContainer }}
              >
                <View className="mt-0.5 mr-2">
                  <PinIcon size={14} color={colors.primaryContainer} />
                </View>
                <View className="flex-1">
                  <Text className="text-figma-11 font-inter-600 text-primary">PINNED</Text>
                  <Text className="text-figma-12 font-inter-400 text-textPrimary mt-1" style={{ lineHeight: 17 }}>
                    {channel.pinned}
                  </Text>
                </View>
              </View>

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
