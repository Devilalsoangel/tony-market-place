import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { serverApi } from '../utils/serverApi';

const AUCTIONS_KEY = '@susej_auctions';

export interface AuctionBid {
  id: string;
  bidder: string;
  amount: number;
  time: string;
  you?: boolean;
}

export interface Auction {
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

function auctionImage(key: string) {
  return { uri: `https://picsum.photos/seed/${key}/600/600` };
}

function formatEndsIn(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
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

export default function AuctionsScreen() {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [auctions, setAuctions] = useState<Auction[]>([]);

  const loadAuctions = useCallback(() => {
    AsyncStorage.getItem(AUCTIONS_KEY)
      .then((data) => {
        let merged: Auction[] = [];
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              const byId = new Map<string, Auction>();
              parsed.forEach((a: any) => {
                // Real auctions only — drop legacy demo seeds (auc_001..004).
                if (a && typeof a.id === 'string' && !/^auc_00[1-4]$/.test(a.id)) {
                  byId.set(a.id, normalizeAuction(a));
                }
              });
              merged = [...byId.values()];
            }
          } catch {
            // corrupted cache — start empty; server sync repopulates
          }
        }
        setAuctions(merged);
        setLoaded(true);
      })
      .catch(() => {
        setAuctions([]);
        setLoaded(true);
      });
  }, []);

  useFocusEffect(loadAuctions);

  // Merge the shared backend's live auctions (real multi-user bids) into the
  // list once per focus — server rows win on id, local seeds fill the rest.
  useFocusEffect(
    useCallback(() => {
      serverApi.getAuctions().then((res) => {
        if (!res.ok || !res.data?.auctions?.length) return;
        const serverRows = res.data.auctions
          .filter((a: any) => a && a.id)
          .map((a: any) => ({
            id: String(a.id),
            title: String(a.title ?? 'Auction'),
            seller: String(a.seller ?? a.sellerName ?? a.sellerUsername ?? ''),
            sellerUsername: String(a.sellerUsername ?? ''),
            currentBid: Number(a.currentBid ?? a.startingBid ?? 0),
            startPrice: Number(a.startPrice ?? a.startingBid ?? 0),
            status: (a.status === 'live' || a.status === 'upcoming' || a.status === 'ended' ? a.status : 'live') as Auction['status'],
            imageKey: String(a.imageKey ?? ''),
            bidsCount: Number(a.bidsCount ?? a.bids ?? 0),
            endTime: typeof a.endTime === 'string' ? Date.parse(a.endTime) : Number(a.endTime ?? Date.now() + 3600000),
            verified: false,
            bids: [],
            winner: a.winner ? String(a.winner) : undefined,
          }));
        setAuctions((prev) => {
          const known = new Set(prev.map((p) => p.id));
          const fresh = serverRows.filter((sa) => !known.has(sa.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      });
    }, [])
  );

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(AUCTIONS_KEY, JSON.stringify(auctions)).catch(() => {});
  }, [auctions, loaded]);

  const toggleReminder = (id: string) => {
    setAuctions((prev) => prev.map((a) => (a.id === id ? { ...a, reminder: !a.reminder } : a)));
  };

  const live = auctions.filter((a) => a.status === 'live');
  const upcoming = auctions.filter((a) => a.status === 'upcoming');
  const endedList = auctions.filter((a) => a.status === 'ended');

  const renderCard = (a: Auction) => {
    const remaining = a.endTime ? a.endTime - Date.now() : 0;
    const ended = a.status === 'ended' || (a.status === 'live' && remaining <= 0);
    return (
      <TouchableOpacity
        key={a.id}
        className="bg-surfaceContainerLowest rounded-figma-24 overflow-hidden mb-4"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        activeOpacity={0.8}
        onPress={() => router.push(`/auction/${a.id}`)}
      >
        <View className="w-full bg-surfaceContainer" style={{ aspectRatio: 4 / 3 }}>
          <Image source={auctionImage(a.imageKey)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
          <View
            className="absolute top-3 left-3 px-2.5 py-1 rounded-figma-full"
            style={{ backgroundColor: a.status === 'live' ? colors.error : a.status === 'ended' ? colors.surfaceContainer : colors.tertiary }}
          >
            <Text
              className="font-inter-700"
              style={{ fontSize: 10, lineHeight: 12, letterSpacing: 1, color: a.status === 'live' ? colors.onError : a.status === 'ended' ? colors.textSecondary : colors.onTertiary }}
            >
              {a.status === 'ended' ? 'ENDED' : a.status === 'live' ? (ended ? 'ENDED' : 'LIVE') : 'UPCOMING'}
            </Text>
          </View>
        </View>
        <View className="p-3">
          <Text className="font-inter-600 text-textPrimary" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
            {a.title}
          </Text>
          {a.status === 'live' || a.status === 'ended' ? (
            <>
              <View className="flex-row items-end mt-1" style={{ gap: 6 }}>
                <Text className="font-inter-700 text-primaryContainer" style={{ fontSize: 20, lineHeight: 26 }}>
                  {formatPrice(a.currentBid)}
                </Text>
                <Text className="font-inter-400 text-textSecondary mb-0.5" style={{ fontSize: 12, lineHeight: 14 }}>
                  {a.bidsCount} bids
                </Text>
              </View>
              <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
                <TimerIcon size={12} color={ended ? colors.textTertiary : colors.primaryContainer} />
                <Text
                  className="font-inter-500"
                  style={{ fontSize: 12, lineHeight: 14, color: ended ? colors.textTertiary : colors.textSecondary }}
                >
                  {ended ? 'Ended' : `Ends in ${formatEndsIn(remaining)}`}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text className="font-inter-500 mt-1" style={{ fontSize: 13, lineHeight: 16, color: colors.textSecondary }}>
                {a.startsLabel}
              </Text>
              <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 14, color: colors.textTertiary }}>
                Starting at {formatPrice(a.startPrice)}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
                  {a.reminder ? 'Reminder set' : 'Set a reminder'}
                </Text>
                <Switch
                  value={!!a.reminder}
                  onValueChange={() => toggleReminder(a.id)}
                  trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
                  thumbColor={colors.surfaceContainerLowest}
                />
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
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
          Auctions
        </Text>
        <TimerIcon size={20} color={colors.primary} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading auctions…
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" contentContainerClassName="pb-24">
          <Text className="font-inter-400 mt-2 mb-4 text-textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
            Bid live on rare finds — or set reminders for upcoming lots.
          </Text>
          {live.length || upcoming.length || endedList.length ? (
            <>
              {live.length ? (
                <>
                  <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.error }} />
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 22, letterSpacing: 0.2 }}>
                      LIVE NOW
                    </Text>
                  </View>
                  {live.map(renderCard)}
                </>
              ) : null}
              {upcoming.length ? (
                <>
                  <View className="flex-row items-center mb-3 mt-2" style={{ gap: 6 }}>
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.tertiary }} />
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 22, letterSpacing: 0.2 }}>
                      UPCOMING
                    </Text>
                  </View>
                  {upcoming.map(renderCard)}
                </>
              ) : null}
              {endedList.length ? (
                <>
                  <View className="flex-row items-center mb-3 mt-2" style={{ gap: 6 }}>
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
                    <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 22, letterSpacing: 0.2 }}>
                      ENDED
                    </Text>
                  </View>
                  {endedList.map(renderCard)}
                </>
              ) : null}
            </>
          ) : (
            <View className="items-center py-20 px-8">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <TimerIcon size={22} color={colors.textSecondary} />
              </View>
              <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                No auctions right now
              </Text>
              <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                Check back soon for new live lots and upcoming auctions.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
