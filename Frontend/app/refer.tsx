import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Share } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, ShareIcon, CheckIcon } from '../utils/icons';
import { colors, shadows } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

const REFERRALS_KEY_BASE = '@susej_referrals';

const REFER_CODE = 'SUSEJ100';

interface Referral {
  id: string;
  name: string;
  date: string;
  reward: number;
  status: 'paid' | 'pending';
}

const STEPS = [
  { title: 'Share your code', detail: 'Send SUSEJ100 to a friend on WhatsApp or anywhere else.' },
  { title: 'Friend joins & buys', detail: 'They sign up with susej and place their first order.' },
  { title: 'Rewards are on the way', detail: 'Referral rewards are coming soon — your code is ready to share today.' },
];

function GiftIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" fill={color} />
    </Svg>
  );
}

function CopyIcon({ size = 16, color = colors.onPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill={color} />
    </Svg>
  );
}

function ChatIcon({ size = 18, color = colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill={color} />
    </Svg>
  );
}

export default function ReferScreen() {
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const getKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${REFERRALS_KEY_BASE}:${u}` : REFERRALS_KEY_BASE;
  }, [user?.username]);
  const [loaded, setLoaded] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = getKey();
    setLoaded(false);
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              const real = (parsed as Referral[]).filter((r) => r && !/^r[12]$/.test(String(r.id)));
              setReferrals(real);
              setLoaded(true);
              return;
            }
          } catch {}
        }
        if (key !== REFERRALS_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(REFERRALS_KEY_BASE);
          if (!cancelled && legacy) {
            try {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed)) {
                const real = (parsed as Referral[]).filter((r) => r && !/^r[12]$/.test(String(r.id)));
                if (real.length) {
                  setReferrals(real);
                  try { await AsyncStorage.setItem(key, JSON.stringify(real)); } catch {}
                  setLoaded(true);
                  return;
                }
              }
            } catch {}
          }
        }
        if (!cancelled) { setReferrals([]); setLoaded(true); }
      } catch { if (!cancelled) { setReferrals([]); setLoaded(true); } }
    };
    load();
    return () => { cancelled = true; };
  }, [getKey, tokenSeq]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(getKey(), JSON.stringify(referrals)).catch(() => {});
  }, [referrals, loaded, getKey]);

  // No clipboard dependency installed - share sheet is the real system action.
  const handleShareCode = () => {
    Share.share({ message: REFER_CODE })
      .then((res) => {
        if (res.action !== 'sharedAction' && res.action !== 'dismissedAction') return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const handleShare = (channel: 'whatsapp' | 'generic') => {
    const message =
      channel === 'whatsapp'
        ? `Join me on susej — India's social marketplace! Use my code ${REFER_CODE}.`
        : `Check out susej — shop, sell and socialise. Use my code ${REFER_CODE} when you sign up.`;
    Share.share({ message }).catch(() => {});
  };

  const renderReferral = ({ item }: { item: Referral }) => {
    const paid = item.status === 'paid';
    return (
      <View className="flex-row items-center px-5 py-3">
        <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
          <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: colors.primary }}>
            {item.name.charAt(0)}
          </Text>
        </View>
        <View className="flex-1 pr-3">
          <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
            {item.name}
          </Text>
          <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
            Joined {item.date}
          </Text>
        </View>
        <View className="items-end">
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: paid ? colors.primaryContainer : colors.surfaceContainer }}>
            <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: paid ? colors.onPrimary : colors.textTertiary }}>
              {paid ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>
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
          Refer & Earn
        </Text>
        <GiftIcon size={20} color={colors.primary} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading referrals…
          </Text>
        </View>
      ) : (
        <FlatList
          data={referrals}
          keyExtractor={(item) => item.id}
          contentContainerClassName="pb-24"
          ListHeaderComponent={
            <View className="px-5 pt-2 pb-4">
              <View style={{ borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 24, ...shadows.card }}>
                <View className="flex-row items-center gap-2">
                  <GiftIcon size={18} color={colors.onPrimary} />
                  <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                    susej Referrals
                  </Text>
                </View>
                <Text className="font-inter-700 mt-3" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.5, color: colors.onPrimary }}>
                  Invite friends to susej
                </Text>
                <Text className="font-inter-400 mt-1" style={{ fontSize: 13, lineHeight: 18, color: colors.onPrimary }}>
                  Referral rewards coming soon.
                </Text>

                <View className="mt-5 flex-row items-center px-4 py-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLowest }}>
                  <View className="flex-1">
                    <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>
                      Your referral code
                    </Text>
                    <Text className="font-inter-700 mt-0.5" style={{ fontSize: 20, lineHeight: 24, letterSpacing: 1, color: colors.textPrimary }}>
                      {REFER_CODE}
                    </Text>
                  </View>
                  {copied ? (
                    <View className="flex-row items-center px-4 h-10" style={{ borderRadius: 999, backgroundColor: colors.primaryContainer }}>
                      <CheckIcon size={14} color={colors.onPrimary} />
                      <Text className="font-inter-600 ml-1.5" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                        Shared
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity className="flex-row items-center px-4 h-10" style={{ borderRadius: 999, backgroundColor: colors.primary }} onPress={handleShareCode}>
                      <CopyIcon size={14} color={colors.onPrimary} />
                      <Text className="font-inter-600 ml-1.5" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                        Share
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text className="font-inter-400 mt-3" style={{ fontSize: 11, lineHeight: 14, color: colors.onPrimary }}>
                  Referral rewards are coming soon — sharing your code today gets you ready.
                </Text>
              </View>

              <View className="flex-row mt-4" style={{ gap: 8 }}>
                <TouchableOpacity className="flex-1 h-12 flex-row items-center justify-center" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }} onPress={() => handleShare('whatsapp')}>
                  <ChatIcon size={18} color={colors.textPrimary} />
                  <Text className="font-inter-600 ml-2" style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 h-12 flex-row items-center justify-center" style={{ borderRadius: 16, backgroundColor: colors.primary }} onPress={() => handleShare('generic')}>
                  <ShareIcon size={18} color={colors.onPrimary} />
                  <Text className="font-inter-600 ml-2" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                How it works
              </Text>
              <View className="px-5 py-4" style={{ borderRadius: 24, backgroundColor: colors.surfaceContainerLowest, ...shadows.card }}>
                {STEPS.map((step, i) => (
                  <View key={step.title} className="flex-row py-2" style={{ gap: 12 }}>
                    <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
                      <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 14, color: colors.onPrimaryFixedVariant }}>
                        {i + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                        {step.title}
                      </Text>
                      <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                        {step.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                Referral history
              </Text>
            </View>
          }
          renderItem={renderReferral}
          ListEmptyComponent={
            <View className="items-center py-16 px-8">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <GiftIcon size={22} color={colors.textSecondary} />
              </View>
              <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                No referrals yet
              </Text>
              <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                Share your code with friends — referral rewards are coming soon.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
