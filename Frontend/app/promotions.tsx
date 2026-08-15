import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CheckIcon, StarIcon } from '../utils/icons';
import { colors, formatPrice, shadows } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts, type Post } from '../contexts/PostContext';
import { usePromotions } from '../contexts/PromotionContext';
import {
  PROMO_PACKAGES,
  PROMOTION_KIND_LABEL,
  PROMOTION_KIND_BLURB,
  getPackage,
  type PromotionKind,
} from '../utils/marketplace';
import { getWallet, saveWallet } from '../utils/walletStore';

const MegaphoneIcon = ({ size = 18, color = '#4343d5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1ZM15 8.5a4 4 0 0 1 0 7M17.5 6a8 8 0 0 1 0 12"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ZapIcon = ({ size = 16, color = '#ba1a1a' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: 'ACTIVE', bg: colors.primaryContainer, fg: colors.onPrimary },
  expired: { label: 'EXPIRED', bg: colors.surfaceContainer, fg: colors.textSecondary },
  refunded: { label: 'REFUNDED', bg: colors.errorContainer, fg: colors.error },
  pending_payment: { label: 'PENDING PAYMENT', bg: colors.tertiaryContainer, fg: colors.tertiary },
};

const KIND_ORDER: PromotionKind[] = ['featuredPost', 'hotDeal', 'topSeller'];

export default function PromotionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts } = usePosts();
  const { promotions, createPromotion, endPromotion } = usePromotions();

  const [balance, setBalance] = useState(0);
  const [selectedKind, setSelectedKind] = useState<PromotionKind>('featuredPost');
  const [selectedPkg, setSelectedPkg] = useState<string | null>('featured-post-7');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const myPromos = useMemo(
    () =>
      promotions
        .filter((p) => p.sellerUsername === (user?.username || 'user'))
        .sort((a, b) => b.startsAt - a.startsAt),
    [promotions, user]
  );

  const myPosts = useMemo(
    () => posts.filter((p) => p.sellerUsername === (user?.username || 'user')),
    [posts, user]
  );

  useEffect(() => {
    if (myPosts.length > 0 && !selectedPost) setSelectedPost(myPosts[0]);
  }, [myPosts, selectedPost]);

  useEffect(() => {
    (async () => {
      try {
        const state = await getWallet();
        setBalance(state.balance);
      } catch {}
    })();
  }, []);

  const pkg = getPackage(selectedPkg ?? '');
  const total = pkg?.price ?? 0;

  const pay = async () => {
    if (!pkg || !selectedPost) {
      Alert.alert('Select a listing', 'Pick one of your listings and a package to promote.');
      return;
    }
    if (balance < pkg.price) {
      Alert.alert('Insufficient balance', `This campaign costs ${formatPrice(pkg.price)}. Add money to your wallet first.`);
      return;
    }
    const promo = createPromotion({
      packageId: pkg.id,
      postId: selectedPost.id,
      productTitle: selectedPost.description.slice(0, 44),
      sellerUsername: user?.username || 'user',
    });
    if (!promo) return;
    // Single atomic debit through the shared wallet store.
    const state = await getWallet();
    const newBalance = state.balance - pkg.price;
    await saveWallet({
      balance: newBalance,
      transactions: [
        {
          id: `prm${Date.now()}`,
          title: `Promotion · ${PROMOTION_KIND_LABEL[pkg.kind]}`,
          detail: `${pkg.name} · ${selectedPost.description.slice(0, 24)}`,
          amount: -pkg.price,
          ts: Date.now(),
        },
        ...state.transactions,
      ],
    });
    setBalance(newBalance);
    // Mirror the purchase to the admin campaign queue (fire-and-forget).
    void import('../utils/adminSync').then((m) =>
      m.syncPromotion({
        id: promo.id,
        kind: promo.kind,
        packageName: pkg.name,
        price: pkg.price,
        days: pkg.days,
        sellerUsername: user?.username,
        postId: selectedPost.id,
        postTitle: selectedPost.description.slice(0, 44),
        createdAt: Date.now(),
      })
    );
    Alert.alert(
      'Campaign is live',
      `${PROMOTION_KIND_LABEL[pkg.kind]} started for "${selectedPost.description.slice(0, 24)}" — ${
        pkg.days
      } days, ${formatPrice(pkg.price)} paid from wallet. Buyers will see it right away.`,
      [{ text: 'Done' }]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Promotions & Ads
        </Text>
        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.onPrimary }}>
            {formatPrice(balance)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Text className="font-inter-400 mt-3 text-textSecondary" style={{ fontSize: 12.5, lineHeight: 18 }}>
          Get more views and orders — like Instagram boosts, OLX featured ads and Facebook promoted posts.
          Every campaign is pay-per-duration from your wallet and reviewed by susej Finance.
        </Text>

        {/* My campaigns */}
        <Text className="font-inter-700 mt-6 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
          My campaigns
        </Text>
        {myPromos.length === 0 ? (
          <View className="mt-2 items-center py-6 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 13, lineHeight: 18 }}>
              No campaigns yet — start one below.
            </Text>
          </View>
        ) : (
          <View className="mt-2" style={{ gap: 10 }}>
            {myPromos.map((p) => {
              const chip = STATUS_CHIP[p.status] ?? STATUS_CHIP.active;
              const ctr = p.views > 0 ? ((p.clicks / p.views) * 100).toFixed(1) : '0.0';
              const daysLeft = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 864e5));
              return (
                <View key={p.id} className="p-4 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <MegaphoneIcon size={16} color={colors.primary} />
                    <Text className="font-inter-600 flex-1 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                      {p.packageName}
                    </Text>
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: chip.bg }}>
                      <Text className="font-inter-600" style={{ fontSize: 9, lineHeight: 12, letterSpacing: 0.5, color: chip.fg }}>
                        {chip.label}
                      </Text>
                    </View>
                  </View>
                  {p.productTitle ? (
                    <Text className="font-inter-400 mt-1 text-textSecondary" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                      {p.productTitle}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center mt-2.5" style={{ gap: 14 }}>
                    <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                      {p.views.toLocaleString()} views
                    </Text>
                    <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                      {p.clicks.toLocaleString()} clicks · {ctr}% CTR
                    </Text>
                    {p.status === 'active' && (
                      <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                        {daysLeft}d left
                      </Text>
                    )}
                  </View>
                  {p.status === 'active' && (
                    <TouchableOpacity className="mt-3 self-start" onPress={() => endPromotion(p.id)}>
                      <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.error }}>
                        End early
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Listing picker */}
        <Text className="font-inter-700 mt-6 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
          Promote a listing
        </Text>
        {myPosts.length === 0 ? (
          <View className="mt-2 items-center py-6 rounded-figma-16" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 13, lineHeight: 18 }}>
              You don't have listings yet.{'\n'}Create one from the + tab, then come back to promote it.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }}>
            {myPosts.map((p) => {
              const on = selectedPost?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  className="px-3.5 py-2.5 rounded-figma-full"
                  style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainerLow }}
                  onPress={() => setSelectedPost(p)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: on ? colors.onPrimary : colors.textPrimary }} numberOfLines={1}>
                    {p.description.slice(0, 26)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Packages by kind */}
        <View className="mt-5" style={{ gap: 16 }}>
          {KIND_ORDER.map((kind) => {
            const pkgs = PROMO_PACKAGES.filter((p) => p.kind === kind);
            const open = selectedKind === kind;
            return (
              <View key={kind} className="rounded-figma-16 overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                <TouchableOpacity className="flex-row items-center px-4 py-3.5" onPress={() => setSelectedKind(kind)}>
                  <View className="w-9 h-9 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                    {kind === 'topSeller' ? <StarIcon size={17} color={colors.primaryContainer} /> : kind === 'hotDeal' ? <ZapIcon size={17} /> : <MegaphoneIcon size={17} color={colors.primaryContainer} />}
                  </View>
                  <View className="flex-1">
                    <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }}>
                      {PROMOTION_KIND_LABEL[kind]}
                    </Text>
                    <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 15 }}>
                      {PROMOTION_KIND_BLURB[kind]}
                    </Text>
                  </View>
                </TouchableOpacity>
                {open && (
                  <View className="px-4 pb-4" style={{ gap: 8 }}>
                    {pkgs.map((p) => {
                      const on = selectedPkg === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          className="flex-row items-center p-3.5"
                          style={{ borderRadius: 14, borderWidth: 1.5, borderColor: on ? colors.primary : colors.surfaceContainer, backgroundColor: on ? colors.primaryFixed : colors.surface }}
                          onPress={() => setSelectedPkg(p.id)}
                        >
                          <View className="flex-1 pr-3">
                            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 17 }}>
                              {p.name}
                            </Text>
                            <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 15 }}>
                              {p.desc}
                            </Text>
                          </View>
                          <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 15, lineHeight: 20 }}>
                            {formatPrice(p.price)}
                          </Text>
                          <View className="w-5 h-5 rounded-full items-center justify-center ml-3" style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}>
                            {on && <CheckIcon size={11} color={colors.onPrimary} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Pay */}
        <TouchableOpacity
          className="mt-6 items-center justify-center"
          style={{ borderRadius: 16, backgroundColor: total > 0 && selectedPost ? colors.primaryContainer : colors.surfaceContainerHigh, height: 52 }}
          disabled={!total || !selectedPost}
          onPress={pay}
        >
          <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: total > 0 && selectedPost ? colors.onPrimary : colors.textTertiary }}>
            {selectedPost ? `Pay ${formatPrice(total)} from wallet` : 'Select a listing to continue'}
          </Text>
        </TouchableOpacity>
        <Text className="font-inter-400 mt-2 text-textSecondary text-center" style={{ fontSize: 11, lineHeight: 15 }}>
          Paid from wallet balance · refunded if the campaign is cancelled by susej Finance
        </Text>
      </ScrollView>
    </View>
  );
}
