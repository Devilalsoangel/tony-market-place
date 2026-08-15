import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, StarIcon, CheckIcon, BagIcon, ChevronRightIcon, CloseIcon } from '../utils/icons';
import { colors, shadows } from '../utils/theme';

const LOYALTY_KEY = '@susej_loyalty';

interface LoyaltyTx {
  id: string;
  title: string;
  detail: string;
  points: number;
  date: string;
}

interface Reward {
  id: string;
  title: string;
  desc: string;
  cost: number;
}

interface Coupon {
  rewardId: string;
  rewardTitle: string;
  code: string;
  createdAt: number;
}

const SEED_HISTORY: LoyaltyTx[] = [
  { id: 'l1', title: 'Referral reward · Priya S.', detail: 'Joined with your code', points: 200, date: 'Jul 31' },
  { id: 'l2', title: 'Purchase reward · Order #SJ-102938', detail: '₹2,000+ spend', points: 100, date: 'Jul 30' },
  { id: 'l3', title: 'Product review reward', detail: 'Rated & reviewed a purchase', points: 25, date: 'Jul 29' },
  { id: 'l4', title: 'Referral reward · Arjun K.', detail: 'Joined with your code', points: 200, date: 'Jul 27' },
  { id: 'l5', title: 'Purchase reward · Order #SJ-102731', detail: '₹2,000+ spend', points: 100, date: 'Jul 26' },
  { id: 'l6', title: 'Purchase reward · Order #SJ-102620', detail: '₹2,000+ spend', points: 100, date: 'Jul 24' },
];

interface LoyaltyTx {
  id: string;
  title: string;
  detail: string;
  points: number;
  date: string;
}

interface Reward {
  id: string;
  title: string;
  desc: string;
  cost: number;
}

const TIERS = {
  Bronze: { min: 0, next: 500, nextName: 'Silver' },
  Silver: { min: 500, next: 1500, nextName: 'Gold' },
  Gold: { min: 1500, next: null, nextName: null },
} as const;

const EARN_RULES = [
  { title: 'Buy items', detail: 'Earn 50 points per ₹1,000 spent', points: 50, route: '/(tabs)/explore' },
  { title: 'Refer a friend', detail: 'Earn 200 points when they join', points: 200, route: '/refer' },
  { title: 'Review a product', detail: 'Earn 25 points per review', points: 25, route: '/orders' },
];

const COUPON_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCouponCode = () => {
  let code = '';
  for (let i = 0; i < 4; i++) code += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)];
  return `SASUKE15K-${code}`;
};

const REWARDS: Reward[] = [
  { id: 'rw1', title: 'Free delivery', desc: 'On your next order', cost: 300 },
  { id: 'rw2', title: '₹50 off', desc: 'On orders above ₹999', cost: 500 },
  { id: 'rw3', title: '₹100 off', desc: 'On orders above ₹1,499', cost: 900 },
  { id: 'rw4', title: '₹250 off', desc: 'On orders above ₹2,999', cost: 2000 },
];

function GiftIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill={color} />
    </Svg>
  );
}

function TruckIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z" fill={color} />
      <Circle cx="6" cy="18.5" r="2.5" fill={color} />
      <Circle cx="18" cy="18.5" r="2.5" fill={color} />
    </Svg>
  );
}

function TagIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" fill={color} />
    </Svg>
  );
}

export default function LoyaltyScreen() {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LoyaltyTx[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [lastCoupon, setLastCoupon] = useState<Coupon | null>(null);
  const [couponsOpen, setCouponsOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOYALTY_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed.balance === 'number') {
              setBalance(parsed.balance);
              setHistory(Array.isArray(parsed.history) ? parsed.history : SEED_HISTORY);
              // legacy shape stored reward ids as plain strings — migrate them
              setCoupons(
                Array.isArray(parsed.coupons)
                  ? parsed.coupons
                  : Array.isArray(parsed.redeemed)
                    ? parsed.redeemed.map((id: string) => ({
                        rewardId: id,
                        rewardTitle: 'Reward',
                        code: genCouponCode(),
                        createdAt: Date.now(),
                      }))
                    : []
              );
              setLoaded(true);
              return;
            }
          } catch {
            // corrupted data — fall through to seed
          }
        }
        setBalance(725);
        setHistory(SEED_HISTORY);
        setCoupons([]);
        setLoaded(true);
      })
      .catch(() => {
        setBalance(725);
        setHistory(SEED_HISTORY);
        setCoupons([]);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(LOYALTY_KEY, JSON.stringify({ balance, history, coupons })).catch(() => {});
  }, [balance, history, coupons, loaded]);

  const tier = balance >= 1500 ? 'Gold' : balance >= 500 ? 'Silver' : 'Bronze';
  const tierInfo = TIERS[tier];
  const progress = tierInfo.next ? Math.min(1, (balance - tierInfo.min) / (tierInfo.next - tierInfo.min)) : 1;

  const redeem = (reward: Reward) => {
    if (balance < reward.cost || coupons.some((c) => c.rewardId === reward.id)) return;
    const coupon: Coupon = { rewardId: reward.id, rewardTitle: reward.title, code: genCouponCode(), createdAt: Date.now() };
    setBalance((prev) => prev - reward.cost);
    setHistory((prev) => [
      { id: `l${Date.now()}`, title: `Redeemed · ${reward.title}`, detail: `${reward.cost} points used`, points: -reward.cost, date: 'Just now' },
      ...prev,
    ]);
    setCoupons((prev) => [coupon, ...prev]);
    setLastCoupon(coupon);
  };

  const renderTx = ({ item }: { item: LoyaltyTx }) => {
    const credit = item.points > 0;
    return (
      <View className="flex-row items-center px-5 py-3">
        <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
          {credit ? <StarIcon size={18} color={colors.primary} /> : <GiftIcon size={18} color={colors.textTertiary} />}
        </View>
        <View className="flex-1 pr-3">
          <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
            {item.title}
          </Text>
          <Text className="font-inter-400 mt-0.5" numberOfLines={1} style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
            {item.detail}
          </Text>
          <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, lineHeight: 12, color: colors.textTertiary }}>
            {item.date}
          </Text>
        </View>
        <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: credit ? colors.primary : colors.textTertiary }}>
          {credit ? `+${item.points}` : `-${Math.abs(item.points)}`}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Loyalty Points
        </Text>
        <StarIcon size={20} color={colors.primary} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading loyalty points…
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerClassName="pb-24"
          ListHeaderComponent={
            <View className="px-5 pt-2 pb-4">
              <View style={{ borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 24, ...shadows.card }}>
                <View className="flex-row items-center gap-2">
                  <StarIcon size={18} color={colors.onPrimary} />
                  <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                    susej Loyalty
                  </Text>
                </View>
                <View className="flex-row items-end mt-3">
                  <Text className="font-inter-700" style={{ fontSize: 40, lineHeight: 48, letterSpacing: -0.5, color: colors.onPrimary }}>
                    {balance}
                  </Text>
                  <Text className="font-inter-500 ml-2 mb-2" style={{ fontSize: 14, lineHeight: 20, color: colors.onPrimary }}>
                    points
                  </Text>
                </View>
                <Text className="font-inter-500 mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.onPrimary }}>
                  {tier} tier
                </Text>
              </View>

              <View className="mt-4 px-5 py-4" style={{ borderRadius: 24, backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                <View className="flex-row justify-between">
                  {(['Bronze', 'Silver', 'Gold'] as const).map((name) => {
                    const active = tier === name;
                    return (
                      <View key={name} className="items-center" style={{ gap: 4 }}>
                        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerHigh }} />
                        <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: active ? colors.textPrimary : colors.textTertiary }}>
                          {name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
                  <View className="h-full rounded-full" style={{ backgroundColor: colors.primaryContainer, width: `${Math.round(progress * 100)}%` }} />
                </View>
                <Text className="font-inter-400 mt-3 text-center" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                  {tierInfo.next
                    ? `${tierInfo.next - balance} points to ${tierInfo.nextName} tier`
                    : 'Top tier — enjoy all Gold perks!'}
                </Text>
              </View>

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                How to earn
              </Text>
              <View className="px-5 py-2" style={{ borderRadius: 24, backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                {EARN_RULES.map((rule) => (
                  <TouchableOpacity
                    key={rule.title}
                    className="flex-row items-center py-3"
                    activeOpacity={0.7}
                    onPress={() => router.push(rule.route as never)}
                  >
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainerLow }}>
                      <BagIcon size={18} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                        {rule.title}
                      </Text>
                      <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                        {rule.detail}
                      </Text>
                    </View>
                    <Text className="font-inter-700 mr-2" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
                      +{rule.points}
                    </Text>
                    <ChevronRightIcon size={12} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row items-center justify-between mt-6 mb-2">
                <Text className="font-inter-700" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                  Rewards
                </Text>
                <TouchableOpacity
                  className="flex-row items-center px-3 h-8"
                  style={{ borderRadius: 100, backgroundColor: colors.surfaceContainer }}
                  onPress={() => setCouponsOpen(true)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: colors.primary }}>
                    Coupons ({coupons.length})
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 10 }}>
                {REWARDS.map((reward) => {
                  const affordable = balance >= reward.cost;
                  const isRedeemed = coupons.some((c) => c.rewardId === reward.id);
                  return (
                    <View key={reward.id} className="flex-row items-center px-4 py-3" style={{ borderRadius: 20, backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                      <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainerLow }}>
                        {reward.id === 'rw1' ? <TruckIcon size={18} color={colors.primary} /> : <TagIcon size={18} color={colors.primary} />}
                      </View>
                      <View className="flex-1">
                        <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                          {reward.title}
                        </Text>
                        <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                          {reward.desc}
                        </Text>
                      </View>
                      <Text className="font-inter-600 mr-3" style={{ fontSize: 12, lineHeight: 14, color: affordable ? colors.textPrimary : colors.textTertiary }}>
                        {reward.cost} pts
                      </Text>
                      {isRedeemed ? (
                        <View className="flex-row items-center px-3 h-10" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer }}>
                          <CheckIcon size={14} color={colors.primary} />
                          <Text className="font-inter-600 ml-1.5" style={{ fontSize: 12, lineHeight: 14, color: colors.primary }}>
                            Redeemed ✓
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          className="px-4 h-10 items-center justify-center"
                          style={{ borderRadius: 12, backgroundColor: affordable ? colors.primaryContainer : colors.surfaceContainer }}
                          disabled={!affordable}
                          onPress={() => redeem(reward)}
                        >
                          <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: affordable ? colors.onPrimary : colors.disabledText }}>
                            Redeem
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                Points history
              </Text>
            </View>
          }
          renderItem={renderTx}
          ListEmptyComponent={
            <View className="items-center py-16 px-8">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <StarIcon size={22} color={colors.textSecondary} />
              </View>
              <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                No points activity yet
              </Text>
              <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                Shop, refer friends and review products to start earning points.
              </Text>
            </View>
          }
        />
      )}

      {/* Redeem result — shows the generated coupon code */}
      <Modal visible={lastCoupon !== null} transparent animationType="fade" onRequestClose={() => setLastCoupon(null)}>
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.overlay }}>
          <View className="w-full items-center px-6 py-8" style={{ borderRadius: 24, backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
            <View className="w-12 h-12 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.primaryBg }}>
              <CheckIcon size={22} color={colors.primary} />
            </View>
            <Text className="font-inter-700 text-center" style={{ fontSize: 18, lineHeight: 26, color: colors.textPrimary }}>
              Reward redeemed
            </Text>
            <Text className="font-inter-400 text-center mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              {lastCoupon?.rewardTitle}
            </Text>
            <View className="w-full items-center mt-5 py-4" style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}>
              <Text className="font-inter-700" style={{ fontSize: 22, lineHeight: 30, letterSpacing: 1.5, color: colors.onPrimary }}>
                {lastCoupon?.code}
              </Text>
            </View>
            <Text className="font-inter-400 text-center mt-3" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
              Apply this code at checkout — saved in My Coupons.
            </Text>
            <TouchableOpacity
              className="mt-5 w-full h-12 items-center justify-center"
              style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
              onPress={() => setLastCoupon(null)}
            >
              <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* My Coupons — all redeemed codes */}
      <Modal visible={couponsOpen} transparent animationType="slide" onRequestClose={() => setCouponsOpen(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <Pressable className="flex-1" onPress={() => setCouponsOpen(false)} />
          <View className="max-h-[70%]" style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
            </View>
            <View className="flex-row items-center px-5 pt-3 pb-2">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                My Coupons ({coupons.length})
              </Text>
              <TouchableOpacity onPress={() => setCouponsOpen(false)} hitSlop={8}>
                <CloseIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {coupons.length === 0 ? (
              <View className="items-center px-6 pt-8 pb-12">
                <Text className="font-inter-600 text-center" style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}>
                  No coupons yet
                </Text>
                <Text className="font-inter-400 text-center mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
                  Redeem a reward above to generate your first coupon code.
                </Text>
              </View>
            ) : (
              <FlatList
                data={coupons}
                keyExtractor={(item) => item.code}
                contentContainerClassName="px-5 pb-8"
                renderItem={({ item }) => (
                  <View className="flex-row items-center px-4 py-3 mb-2" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}>
                    <View className="flex-1">
                      <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                        {item.rewardTitle}
                      </Text>
                      <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {item.code}
                      </Text>
                    </View>
                    <View className="px-3 py-1.5" style={{ borderRadius: 8, backgroundColor: colors.primaryContainer }}>
                      <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 14, color: colors.onPrimary }}>
                        {item.code}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
