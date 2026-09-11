import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CheckIcon, StarIcon } from '../utils/icons';
import { colors, formatPrice, shadows } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts, type Post } from '../contexts/PostContext';
import { usePromotions } from '../contexts/PromotionContext';
import {
  PROMOTION_KIND_LABEL,
  PROMOTION_KIND_BLURB,
  getPackage,
  getPackages,
  loadMarketplaceConfig,
  resetMarketplaceConfig,
  type PromotionKind,
} from '../utils/marketplace';
import { getWallet, syncWalletFromServer } from '../utils/walletStore';
import { serverApi } from '../utils/serverApi';

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

const KIND_ORDER: PromotionKind[] = ['spotlight', 'featuredPost', 'hotDeal', 'topSeller'];

export default function PromotionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts } = usePosts();
  const { promotions, createPromotion, endPromotion } = usePromotions();

  const [balance, setBalance] = useState(0);
  // Deep-link entry (e.g. storefront editor "Promote as Hot Deal"):
  // validated against the known kinds, defaults to no preselection intent.
  const entryParams = useLocalSearchParams<{ kind?: string | string[] }>();
  const entryKind = (() => {
    const raw = Array.isArray(entryParams.kind) ? entryParams.kind[0] : entryParams.kind;
    return raw === 'spotlight' || raw === 'featuredPost' || raw === 'hotDeal' || raw === 'topSeller'
      ? (raw as PromotionKind)
      : 'featuredPost';
  })();
  const [selectedKind, setSelectedKind] = useState<PromotionKind>(entryKind);
  // No preselected package: a default-selected ₹349 spend one tap from Pay is
  // an accidental-purchase trap. The buyer picks explicitly (Meesho pattern).
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const payingRef = useRef(false);
  // Bumps when the admin-managed catalog arrives so prices re-render live.
  const [configTick, setConfigTick] = useState(0);

  // Admin Commission & Fees page is the source of truth for package prices.
  // Refresh on every entry so price edits show up on the next visit, not the
  // next cold start.
  useEffect(() => {
    resetMarketplaceConfig();
    loadMarketplaceConfig()
      .then(() => setConfigTick((t) => t + 1))
      .catch(() => {});
  }, []);

  const promoPackages = useMemo(() => getPackages(), [configTick]);

  const myPromos = useMemo(
    () =>
      promotions
        .filter((p) => p.sellerUsername === (user?.username ?? ''))
        .sort((a, b) => b.startsAt - a.startsAt),
    [promotions, user]
  );

  const myPosts = useMemo(
    () => posts.filter((p) => p.sellerUsername === (user?.username ?? '')),
    [posts, user]
  );

  useEffect(() => {
    if (myPosts.length > 0 && !selectedPost) setSelectedPost(myPosts[0]);
  }, [myPosts, selectedPost]);

  useEffect(() => {
    (async () => {
      try {
        // Fresh server balance for the payment gate — a mount-cached value
        // approves spends against stale money (or blocks real top-ups).
        await syncWalletFromServer().catch(() => {});
        const state = await getWallet();
        setBalance(state.balance);
      } catch {}
    })();
  }, []);

  const pkg = getPackage(selectedPkg ?? '');
  const total = pkg?.price ?? 0;

  const pay = async () => {
    if (payingRef.current) return;
    if (!pkg || !selectedPost) {
      Alert.alert('Select a listing', 'Pick one of your listings and a package to promote.');
      return;
    }
    if (balance < pkg.price) {
      Alert.alert('Insufficient balance', `This campaign costs ${formatPrice(pkg.price)}. Add money to your wallet first.`);
      return;
    }
    payingRef.current = true;
    // Server owns the money: ONE call debits the wallet and creates the
    // ACTIVE placement atomically (server price, ownership-checked). The old
    // client-debit + fire-and-forget mirror burned money whenever the mirror
    // failed, and a double-tap charged twice — both impossible here:
    // checkoutRef makes retries idempotent (same ref returns the purchase,
    // never a second charge).
    const checkoutRef = `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const res = await serverApi.purchasePromotion({
        packageId: pkg.id,
        postId: selectedPost.id,
        checkoutRef,
      });
      if (!res.ok) {
        Alert.alert('Payment failed', res.error === 'offline' ? 'Could not reach the server — no money was charged. Try again when online.' : String(res.error || 'Could not start campaign. No money was charged.'));
        getWallet().then((s) => setBalance(s.balance)).catch(() => {});
        return;
      }
    } catch {
      Alert.alert('Payment failed', 'Could not reach the server — no money was charged. Safe to retry: the same attempt can never bill twice.');
      return;
    } finally {
      payingRef.current = false;
    }
    // Refresh the header balance from SERVER truth (the debit happened
    // server-side; the local cache doesn't know yet).
    await syncWalletFromServer().catch(() => {});
    getWallet().then((s) => setBalance(s.balance)).catch(() => {});
    // Local mirror for instant "My campaigns" reflection (server row is the
    // truth other devices read; this never moves money).
    createPromotion({
      packageId: pkg.id,
      postId: selectedPost.id,
      productTitle: selectedPost.description.slice(0, 44),
      sellerUsername: user?.username || 'user',
    });
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}>
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
            const pkgs = promoPackages.filter((p) => p.kind === kind);
            const open = selectedKind === kind;
            return (
              <View key={kind} className="rounded-figma-16 overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                    <TouchableOpacity className="flex-row items-center px-4 py-3.5" onPress={() => { setSelectedKind(kind); }}>
                  <View className="w-9 h-9 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                    {kind === 'topSeller' ? <StarIcon size={17} color={colors.primaryContainer} /> : kind === 'hotDeal' ? <ZapIcon size={17} /> : kind === 'spotlight' ? <MegaphoneIcon size={17} color={colors.primary} /> : <MegaphoneIcon size={17} color={colors.primaryContainer} />}
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
