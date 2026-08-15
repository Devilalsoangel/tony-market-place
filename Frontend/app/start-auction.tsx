import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CheckIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostContext';
import { productImages } from '../utils/productImages';
import type { Auction } from './auctions';

// Start Auction (seller tool) — creates a live auction persisted to the same
// @susej_auctions store the Auction House reads, so it appears there instantly.

const AUCTIONS_KEY = '@susej_auctions';

const DURATIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];

export default function StartAuctionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts } = usePosts();

  const username = user?.username || 'user';
  const sellerName = user?.businessName || user?.name || username;
  const myPosts = useMemo(() => posts.filter((p) => p.sellerUsername === username), [posts, username]);

  const [title, setTitle] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [duration, setDuration] = useState<number>(DURATIONS[1].ms);
  const [imageKey, setImageKey] = useState<string>(myPosts[0]?.id ?? 'auc_new');

  const canSubmit = title.trim().length > 2 && (Number(startPrice) || 0) > 0;

  const submit = async () => {
    const now = Date.now();
    const auction: Auction = {
      id: `auc_${now}`,
      title: title.trim(),
      seller: sellerName,
      verified: user?.verification === 'approved',
      startPrice: Number(startPrice),
      currentBid: Number(startPrice),
      endTime: now + duration,
      bidsCount: 0,
      status: 'live',
      imageKey,
      bids: [],
    };
    try {
      const raw = await AsyncStorage.getItem(AUCTIONS_KEY);
      let list: Auction[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        } catch {
          list = [];
        }
      }
      await AsyncStorage.setItem(AUCTIONS_KEY, JSON.stringify([auction, ...list]));
      Alert.alert('Auction is live', `"${auction.title}" is now open for bidding on the Auction House.`, [
        { text: 'View auctions', onPress: () => router.replace('/auctions') },
      ]);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 18, lineHeight: 24, color: colors.textPrimary }}>
          Start Auction
        </Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        {/* Item title */}
        <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 6 }}>
          Item title
        </Text>
        <TextInput
          className="font-inter-400"
          style={{ height: 48, borderRadius: 12, backgroundColor: colors.surfaceContainer, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 14 }}
          placeholder="e.g. Vintage leather camera strap"
          placeholderTextColor={colors.secondary}
          value={title}
          onChangeText={setTitle}
        />

        {/* Starting price */}
        <Text className="font-inter-500 mt-5" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 6 }}>
          Starting price (INR)
        </Text>
        <TextInput
          className="font-inter-400"
          style={{ height: 48, borderRadius: 12, backgroundColor: colors.surfaceContainer, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 14 }}
          placeholder="e.g. 500"
          placeholderTextColor={colors.secondary}
          keyboardType="number-pad"
          value={startPrice}
          onChangeText={setStartPrice}
        />

        {/* Duration */}
        <Text className="font-inter-500 mt-5" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 8 }}>
          Auction duration
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {DURATIONS.map((d) => {
            const on = duration === d.ms;
            return (
              <TouchableOpacity
                key={d.label}
                className="px-4 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer, flexDirection: 'row', gap: 5 }}
                onPress={() => setDuration(d.ms)}
              >
                {on && <CheckIcon size={13} color={colors.onPrimary} />}
                <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: on ? colors.onPrimary : colors.textPrimary }}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cover image from own listings */}
        {myPosts.length > 0 && (
          <>
            <Text className="font-inter-500 mt-5" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 8 }}>
              Cover image — pick one of your listings
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {myPosts.map((p) => {
                const src = p.image
                  ? { uri: p.image }
                  : productImages[p.id] ?? { uri: `https://picsum.photos/seed/${p.id}/200/200` };
                const on = imageKey === p.id;
                return (
                  <TouchableOpacity key={p.id} onPress={() => setImageKey(p.id)}>
                    <Image
                      source={src}
                      style={{ width: 64, height: 64, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.outlineVariant }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Summary card */}
        <View className="mt-6 p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 16, marginBottom: 4 }}>
            Summary
          </Text>
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
            {title.trim() || 'Untitled auction'}
          </Text>
          <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
            {sellerName} · Starting {formatPrice(Number(startPrice) || 0)} · Live for {DURATIONS.find((d) => d.ms === duration)?.label}
          </Text>
        </View>
      </ScrollView>

      {/* Floating submit */}
      <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
        <TouchableOpacity
          style={{ height: 48, borderRadius: 14, backgroundColor: canSubmit ? colors.primaryContainer : colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
          disabled={!canSubmit}
          onPress={submit}
        >
          <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: canSubmit ? colors.onPrimary : colors.textTertiary }}>
            Start Auction
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
