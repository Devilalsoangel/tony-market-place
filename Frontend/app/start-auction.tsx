import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CheckIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';
import { usePosts } from '../contexts/PostContext';
import { resolveListingImage } from '../utils/productImages';
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
  const { posts, updatePost } = usePosts();

  // Logged-out fallback is '' (matches nobody): 'user' previously attached
  // auctions to seller "user" (C2). Case-insensitive like seller-orders (C3).
  const username = user?.username ?? '';
  const sellerName = user?.businessName || user?.name || username;
  const isSeller = isApprovedSeller(user);
  const myPosts = useMemo(() => {
    const me = username.trim().toLowerCase();
    if (!me) return [];
    return posts.filter((p) => (p.sellerUsername ?? '').toLowerCase() === me);
  }, [posts, username]);

  const [title, setTitle] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [duration, setDuration] = useState<number>(DURATIONS[1].ms);
  const [imageKey, setImageKey] = useState<string>('auc_new');
  const [submitting, setSubmitting] = useState(false);

  // Fix stale init: myPosts loads async from PostContext tokenSeq effect. Seed from first listing when available.
  // Plain effect (not useMemo): render-phase setState double-fires under
  // StrictMode and turns any added side effect into a landmine.
  useEffect(() => {
    if (myPosts.length > 0 && imageKey === 'auc_new') {
      setImageKey(myPosts[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPosts]);

  // eBay-grade: an auction MUST attach to one of the seller's real listings
  // so bidders see the actual item photo. No listing = no auction.
  const canSubmit = isSeller && title.trim().length > 2 && (Number(startPrice) || 0) > 0 && imageKey !== 'auc_new' && myPosts.length > 0;

  const submit = async () => {
    // No double-fire: rapid taps used to mint N local + N server rows.
    if (submitting) return;
    if (!isSeller) {
      Alert.alert('Sellers only', 'Only verified sellers can start auctions. Become a seller to launch live auctions.');
      return;
    }
    if (myPosts.length === 0 || imageKey === 'auc_new') {
      Alert.alert('Select a listing', 'Auctions must show your real listing photo — create a listing first, then pick it below.');
      return;
    }
    setSubmitting(true);
    const now = Date.now();
    const auction: Auction = {
      id: `auc_${now}`,
      title: title.trim(),
      seller: sellerName,
      // Stable identity (not the display name): renames must not orphan rows
      // and collisions must not merge two sellers' lots.
      sellerUsername: username,
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
      // Publish to the shared backend so the Auction House is cross-device
      // (server row is the source of truth; the local mirror is offline fallback).
      // Adopt the server id — a divergent local id forks the row forever.
      // The outcome copy MUST reflect the publish result: "live" is only true
      // when the server acked, otherwise the row exists on this device only.
      let publishState: 'live' | 'offline' | 'rejected' = 'live';
      try {
        const { serverApi } = await import('../utils/serverApi');
        const res = await serverApi.createAuction({
          title: auction.title,
          startPrice: auction.startPrice,
          durationHours: Math.max(1, Math.round(duration / 3600000)),
          imageKey: auction.imageKey,
        });
        const serverId = (res as { ok?: boolean; data?: { auction?: { id?: unknown } } })?.data?.auction?.id;
        if (res.ok && typeof serverId === 'string' && serverId) {
          const adopted: Auction = { ...auction, id: serverId };
          const cur = await AsyncStorage.getItem(AUCTIONS_KEY).catch(() => null);
          if (cur) {
            try {
              const parsed = JSON.parse(cur);
              if (Array.isArray(parsed)) {
                await AsyncStorage.setItem(
                  AUCTIONS_KEY,
                  JSON.stringify(parsed.map((a: Auction) => (a.id === auction.id ? adopted : a)))
                ).catch(() => {});
              }
            } catch {}
          }
        } else {
          const err = String((res as { error?: unknown })?.error ?? '');
          publishState = err === 'offline' || err === 'server-unreachable' ? 'offline' : 'rejected';
        }
      } catch {
        publishState = 'offline';
      }
      // Device-only flag: offline/rejected rows must never render as live
      // (they accepted local bids that could never settle). The flag rides
      // the stored row; the detail + list screens gate bidding on it.
      if (publishState !== 'live') {
        try {
          const cur = await AsyncStorage.getItem(AUCTIONS_KEY).catch(() => null);
          if (cur) {
            const parsed = JSON.parse(cur);
            if (Array.isArray(parsed)) {
              await AsyncStorage.setItem(
                AUCTIONS_KEY,
                JSON.stringify(parsed.map((a: { id?: unknown }) => (a.id === auction.id ? { ...a, localOnly: true } : a)))
              ).catch(() => {});
            }
          }
        } catch {}
      }
      if (publishState === 'live') {
        // Under-the-hammer: hide the backing listing from direct sale while
        // the auction runs (server also rejects direct orders on live lots).
        // The seller can unhide it after the hammer falls.
        void updatePost(imageKey, { status: 'hidden' }).catch(() => {});
        Alert.alert('Auction is live', `"${auction.title}" is now open for bidding on the Auction House. The listing is hidden from direct sale while under the hammer.`, [
          { text: 'View auctions', onPress: () => router.replace('/auctions') },
        ]);
      } else if (publishState === 'offline') {
        Alert.alert('Saved on this device', `"${auction.title}" will publish to the Auction House when you're back online.`, [
          { text: 'View auctions', onPress: () => router.replace('/auctions') },
        ]);
      } else {
        Alert.alert('Could not publish', 'The server refused this auction. It stays on this device only — check the details and try again.', [
          { text: 'OK' },
        ]);
      }
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Approved sellers only (C11: pending applicants must not mint auctions).
  // Shared gate (SELLER-C1) instead of the local sellers-only view.
  if (!isSeller) return <SellerGate title="Start an auction" user={user} />;

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
                // Primary photo = images[0] first (edit-listing parity) — the
                // old p.image-only read showed placeholder thumbs for listings
                // whose primary lives in the array.
                const primary = Array.isArray((p as any).images) && typeof (p as any).images[0] === 'string' && (p as any).images[0]
                  ? (p as any).images[0]
                  : p.image;
                const src = primary
                  ? { uri: primary }
                  : resolveListingImage(p, p.id);
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
          style={{ height: 48, borderRadius: 14, backgroundColor: canSubmit && !submitting ? colors.primaryContainer : colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
          disabled={!canSubmit || submitting}
          onPress={submit}
        >
          <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: canSubmit && !submitting ? colors.onPrimary : colors.textTertiary }}>
            {submitting ? 'Starting…' : 'Start Auction'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
