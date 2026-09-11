import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CloseIcon, VerifiedIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { serverApi } from '../../utils/serverApi';

const AUCTIONS_KEY = '@susej_auctions';
const MIN_INCREMENT = 100;

interface AuctionBid {
  id: string;
  bidder: string;
  amount: number;
  time: string;
  you?: boolean;
}

interface Auction {
  id: string;
  title: string;
  seller: string;
  verified: boolean;
  startPrice: number;
  currentBid: number;
  endTime: number;
  bidsCount: number;
  status: 'live' | 'upcoming' | 'ended';
  imageKey: string;
  startsLabel?: string;
  reminder?: boolean;
  bids: AuctionBid[];
}

function normalizeAuction(a: any): Auction {
  return {
    id: String(a.id),
    title: a.title ?? 'Untitled auction',
    seller: a.seller ?? 'susej seller',
    verified: !!a.verified,
    startPrice: Number(a.startPrice) || 0,
    currentBid: Number(a.currentBid) || 0,
    endTime: Number(a.endTime) || 0,
    bidsCount: Number(a.bidsCount) || 0,
    status: a.status === 'ended' ? 'ended' : a.status === 'upcoming' ? 'upcoming' : 'live',
    imageKey: a.imageKey ?? String(a.id),
    startsLabel: a.startsLabel,
    reminder: !!a.reminder,
    bids: Array.isArray(a.bids) ? a.bids : [],
  };
}

function findAuction(data: string | null, auctionId: string): Auction | null {
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Real auctions only — legacy demo seeds (auc_001..004) are ignored.
        const hit = parsed.find(
          (a: any) => a && a.id === auctionId && !/^auc_00[1-4]$/.test(String(a.id))
        );
        if (hit) return normalizeAuction(hit);
      }
    } catch {
      // corrupted cache — server sync repopulates
    }
  }
  return null;
}

function auctionImage(key: string) {
  return { uri: `https://picsum.photos/seed/${key}/600/600` };
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function TimerIcon({ size = 14, color = colors.secondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="14" r="8" stroke={color} strokeWidth="2.2" />
      <Path d="M12 9.5V14l3 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 2h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export default function AuctionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auctionId = String(id ?? '');
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showBidInput, setShowBidInput] = useState(false);
  const [bidAmount, setBidAmount] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(AUCTIONS_KEY)
      .then((data) => {
        const found = findAuction(data, auctionId);
        if (found) setAuction(found);
        else setNotFound(true);
        setLoaded(true);
      })
      .catch(() => {
        const found = findAuction(null, auctionId);
        if (found) setAuction(found);
        else setNotFound(true);
        setLoaded(true);
      });
  }, [auctionId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const endTime = auction?.endTime ?? 0;
  const remaining = Math.max(0, endTime - now);
  const ended = !!auction && (auction.status === 'ended' || (auction.status === 'live' && endTime > 0 && remaining <= 0));
  const canBid = !!auction && auction.status === 'live' && !ended;

  const winnerBid = useMemo(() => {
    if (!auction || !ended || !auction.bids.length) return null;
    return [...auction.bids].sort((x, y) => y.amount - x.amount)[0];
  }, [auction, ended]);

  const minBid = auction ? auction.currentBid + MIN_INCREMENT : 0;
  const bidValid = /^\d+$/.test(bidAmount) && Number(bidAmount) >= minBid;

  const persistAuction = (updated: Auction) => {
    AsyncStorage.getItem(AUCTIONS_KEY)
      .then((data) => {
        let list: Auction[] = [];
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            // corrupted data — start fresh list
          }
        }
        const idx = list.findIndex((a) => a.id === updated.id);
        if (idx >= 0) list[idx] = updated;
        else list.push(updated);
        AsyncStorage.setItem(AUCTIONS_KEY, JSON.stringify(list)).catch(() => {});
      })
      .catch(() => {});
  };

  const openBidInput = () => {
    if (!auction) return;
    setBidAmount(String(auction.currentBid + MIN_INCREMENT));
    setShowBidInput(true);
  };

  const confirmBid = () => {
    if (!auction || !bidValid || !canBid) return;
    const amount = Number(bidAmount);
    const updated: Auction = {
      ...auction,
      currentBid: amount,
      bidsCount: auction.bidsCount + 1,
      bids: [{ id: `b${Date.now()}`, bidder: 'You', amount, time: 'Just now', you: true }, ...auction.bids],
    };
    setAuction(updated);
    setShowBidInput(false);
    persistAuction(updated);
    // Real bid on the shared backend for server auctions (cuid ids) — the
    // seller + all bidders see the same current price.
    if (!auction.id.startsWith('auc_')) {
      serverApi.placeBid(auction.id, amount).catch(() => {});
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Auction
        </Text>
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading auction…
          </Text>
        </View>
      ) : notFound || !auction ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
            <TimerIcon size={22} color={colors.textSecondary} />
          </View>
          <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
            Auction not found
          </Text>
          <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            This auction may have been removed or the link is broken.
          </Text>
          <TouchableOpacity
            className="mt-6 h-12 px-8 items-center justify-center"
            style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
            onPress={() => router.back()}
          >
            <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          {/* Hero image */}
          <View className="mx-5" style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceContainer }}>
            <Image source={auctionImage(auction.imageKey)} style={{ width: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" />
            <View
              className="absolute top-3 left-3 px-2.5 py-1 rounded-figma-full"
              style={{ backgroundColor: auction.status === 'live' ? colors.error : auction.status === 'ended' ? colors.surfaceContainer : colors.tertiary }}
            >
              <Text
                className="font-inter-700"
                style={{ fontSize: 10, lineHeight: 12, letterSpacing: 1, color: auction.status === 'live' ? colors.onError : auction.status === 'ended' ? colors.textSecondary : colors.onTertiary }}
              >
                {auction.status === 'ended' ? 'ENDED' : auction.status === 'live' ? (ended ? 'ENDED' : 'LIVE') : 'UPCOMING'}
              </Text>
            </View>
          </View>

          {/* Title + seller */}
          <View className="px-5 pt-4">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3 }}>
              {auction.title}
            </Text>
            <View className="flex-row items-center mt-2" style={{ gap: 5 }}>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                {auction.seller}
              </Text>
              {auction.verified ? <VerifiedIcon size={14} /> : null}
            </View>
          </View>

          {/* Current bid panel */}
          <View className="mx-5 mt-4" style={{ borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 20 }}>
            {auction.status === 'live' || auction.status === 'ended' ? (
              <>
                <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 1.2, color: colors.onPrimary }}>
                  {ended ? 'FINAL BID' : 'CURRENT BID'}
                </Text>
                <Text className="font-inter-700 mt-1" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.onPrimary }}>
                  {formatPrice(auction.currentBid)}
                </Text>
                <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
                  <TimerIcon size={14} color={colors.onPrimary} />
                  <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                    {ended ? 'Auction ended' : `${auction.bidsCount} bids · ${formatCountdown(remaining)} left`}
                  </Text>
                </View>
                <Text className="font-inter-400 mt-1" style={{ fontSize: 12, lineHeight: 14, color: colors.onPrimary }}>
                  Started at {formatPrice(auction.startPrice)}
                </Text>
              </>
            ) : (
              <>
                <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 1.2, color: colors.onPrimary }}>
                  STARTS
                </Text>
                <Text className="font-inter-700 mt-1" style={{ fontSize: 22, lineHeight: 30, color: colors.onPrimary }}>
                  {auction.startsLabel}
                </Text>
                <Text className="font-inter-500 mt-2" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                  Starting at {formatPrice(auction.startPrice)}
                </Text>
              </>
            )}
          </View>

          {/* Countdown strip */}
          {auction.status === 'live' && !ended ? (
            <View
              className="mx-5 mt-4 flex-row items-center justify-between px-4 py-3"
              style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}
            >
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                Time left
              </Text>
              <Text
                className="font-inter-700"
                style={{ fontSize: 18, lineHeight: 24, letterSpacing: 1, color: remaining < 5 * 60 * 1000 ? colors.error : colors.primaryContainer }}
              >
                {formatCountdown(remaining)}
              </Text>
            </View>
          ) : null}

          {/* Ended banner */}
          {ended ? (
            <View
              className="mx-5 mt-4 px-5 py-4"
              style={{ borderRadius: 16, backgroundColor: winnerBid?.you ? colors.primaryFixed : colors.errorContainer }}
            >
              <Text
                className="font-inter-700"
                style={{ fontSize: 16, lineHeight: 22, color: winnerBid?.you ? colors.onPrimaryFixedVariant : colors.onErrorContainer }}
              >
                {winnerBid?.you ? 'You won!' : 'Auction ended'}
              </Text>
              <Text
                className="font-inter-400 mt-0.5"
                style={{ fontSize: 13, lineHeight: 18, color: winnerBid?.you ? colors.onPrimaryFixedVariant : colors.onErrorContainer }}
              >
                {winnerBid?.you
                  ? `Won at ${formatPrice(winnerBid.amount)}`
                  : `Won by ${winnerBid?.bidder ?? '—'} at ${winnerBid ? formatPrice(winnerBid.amount) : '—'}`}
              </Text>
            </View>
          ) : null}

          {/* Bid CTA */}
          {auction.status === 'live' && !ended && !showBidInput ? (
            <View className="mx-5 mt-4">
              <TouchableOpacity
                className="h-14 items-center justify-center"
                style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                onPress={openBidInput}
              >
                <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                  Bid {formatPrice(minBid)} or more
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Inline bid input */}
          {auction.status === 'live' && !ended && showBidInput ? (
            <View className="mx-5 mt-4" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow, padding: 16 }}>
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                Place your bid
              </Text>
              <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 12, lineHeight: 16 }}>
                Minimum {formatPrice(minBid)} · increments of {formatPrice(MIN_INCREMENT)}
              </Text>
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                <View
                  className="flex-1 flex-row items-center h-12 px-3"
                  style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLowest }}
                >
                  <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 20, color: colors.textPrimary }}>
                    ₹
                  </Text>
                  <TextInput
                    className="flex-1 ml-2 font-inter-600 text-textPrimary"
                    style={{ fontSize: 16, lineHeight: 20 }}
                    keyboardType="number-pad"
                    value={bidAmount}
                    onChangeText={(t) => setBidAmount(t.replace(/[^0-9]/g, ''))}
                    placeholder="Amount"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <TouchableOpacity
                  className="h-12 px-5 items-center justify-center"
                  style={{ borderRadius: 12, backgroundColor: bidValid ? colors.primaryContainer : colors.surfaceContainer }}
                  disabled={!bidValid}
                  onPress={confirmBid}
                >
                  <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: bidValid ? colors.onPrimary : colors.disabledText }}>
                    Confirm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-12 w-12 items-center justify-center"
                  style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer }}
                  onPress={() => setShowBidInput(false)}
                >
                  <CloseIcon size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Bid history */}
          <View className="px-5 mt-6">
            <Text className="font-inter-700 text-textPrimary mb-1" style={{ fontSize: 16, lineHeight: 24 }}>
              Bid history
            </Text>
            {auction.bids.length ? (
              auction.bids.map((b) => (
                <View key={b.id} className="flex-row items-center py-3" style={{ gap: 12 }}>
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: b.you ? colors.primaryFixed : colors.surfaceContainer }}
                  >
                    <Text
                      className="font-inter-600"
                      style={{ fontSize: b.you ? 10 : 14, lineHeight: 16, color: b.you ? colors.onPrimaryFixedVariant : colors.textSecondary }}
                    >
                      {b.you ? 'You' : b.bidder.replace('@', '').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, color: b.you ? colors.primaryContainer : colors.textPrimary }}>
                      {b.you ? 'You' : b.bidder}
                    </Text>
                    <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 14, color: colors.textTertiary }}>
                      {b.time}
                    </Text>
                  </View>
                  <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: b.you ? colors.primaryContainer : colors.textPrimary }}>
                    {formatPrice(b.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="font-inter-400 text-textSecondary py-4" style={{ fontSize: 13, lineHeight: 18 }}>
                No bids yet.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
