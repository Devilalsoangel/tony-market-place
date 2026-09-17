import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackIcon, CheckIcon, VerifiedIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';

const VERIFIED_KEY = '@susej_admin_verified';
const REJECTED_KEY = '@susej_admin_rejected';
const APPLICANTS_KEY = '@susej_seller_applicants';

interface PendingSeller {
  username: string;
  name: string;
  businessName: string;
  category: string;
  submitted: string;
  docs: string[];
}

// Real applications only — sellers who actually applied via become-seller.
// No fabricated seed queue.

export default function AdminVerifyScreen() {
  const insets = useSafeAreaInsets();
  const [verified, setVerified] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [applicants, setApplicants] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const { user, updateUser } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const [v, r, a] = await Promise.all([
          AsyncStorage.getItem(VERIFIED_KEY),
          AsyncStorage.getItem(REJECTED_KEY),
          AsyncStorage.getItem(APPLICANTS_KEY),
        ]);
        if (v) setVerified(JSON.parse(v) as string[]);
        if (r) setRejected(JSON.parse(r) as string[]);
        if (a) {
          try {
            const parsed = JSON.parse(a);
            if (Array.isArray(parsed)) setApplicants(parsed as PendingSeller[]);
          } catch {
            // corrupted — ignore
          }
        }
      } catch {
      } finally {
        loadedRef.current = true;
        setLoading(false);
      }
    })();
  }, []);

  const persist = (key: string, list: string[]) => {
    AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
  };

  const approve = (username: string) => {
    if (!loadedRef.current) return;
    setVerified((prev) => {
      const next = prev.includes(username) ? prev : [...prev, username];
      persist(VERIFIED_KEY, next);
      return next;
    });
    setRejected((prev) => {
      if (!prev.includes(username)) return prev;
      const next = prev.filter((u) => u !== username);
      persist(REJECTED_KEY, next);
      return next;
    });
    settleApplicant(username, 'approved');
  };

  const reject = (seller: PendingSeller) => {
    if (!loadedRef.current) return;
    const doReject = (reason?: string) => {
      setRejected((prev) => {
        const next = prev.includes(seller.username) ? prev : [...prev, seller.username];
        persist(REJECTED_KEY, next);
        return next;
      });
      setVerified((prev) => {
        if (!prev.includes(seller.username)) return prev;
        const next = prev.filter((u) => u !== seller.username);
        persist(VERIFIED_KEY, next);
        return next;
      });
      settleApplicant(seller.username, 'rejected');
    };
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Reject verification?',
        `${seller.businessName} (${seller.name}) will be marked as rejected. Optional reason for the seller.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: (reason?: string) => doReject(reason || undefined) },
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Reject verification?',
        `${seller.businessName} (${seller.name}) will be marked as rejected.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: () => doReject() },
        ]
      );
    }
  };

  // Remove the applicant from the live queue after a verdict, and reflect the
  // verdict on the seller's own account when the applicant is this device's
  // user — so the seller dashboard flips from PENDING to VERIFIED in-app.
  const settleApplicant = async (username: string, verdict: 'approved' | 'rejected') => {
    try {
      const raw = await AsyncStorage.getItem(APPLICANTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter((a) => a.username !== username);
      await AsyncStorage.setItem(APPLICANTS_KEY, JSON.stringify(next));
      setApplicants(next);
    } catch {
      // non-fatal
    }
    if (user?.username === username) {
      updateUser({ verification: verdict === 'approved' ? 'approved' : 'rejected' });
    }
  };

  const pending = applicants.filter(
    (s) => !verified.includes(s.username) && !rejected.includes(s.username)
  );
  const approvedList = applicants.filter((s) => verified.includes(s.username));
  const rejectedList = applicants.filter((s) => rejected.includes(s.username));

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between h-[52px] px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">Verification</Text>
        <View className="w-5" />
      </View>

      <View className="px-5">
        <View className="flex-row bg-surfaceContainer rounded-figma-full p-1 mb-4">
          <View className="flex-1 bg-primaryContainer rounded-figma-full py-2 items-center">
            <Text className="text-figma-12 font-inter-600 text-white">Verification</Text>
          </View>
          <TouchableOpacity
            className="flex-1 py-2 items-center"
            onPress={() => router.push('/admin/reports')}
          >
            <Text className="text-figma-12 font-inter-600 text-textSecondary">Reports</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Pending</Text>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{pending.length}</Text>
          </View>
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Approved</Text>
            <Text className="text-figma-20 font-inter-700 text-primaryContainer">{approvedList.length}</Text>
          </View>
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Rejected</Text>
            <Text className="text-figma-20 font-inter-700 text-error">{rejectedList.length}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
          <Text className="text-figma-12 font-inter-400 text-textSecondary mt-3">Loading queue…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3">Pending Requests</Text>

          {pending.length === 0 ? (
            <View className="bg-surfaceContainerLow rounded-figma-24 p-6 items-center mb-4">
              <View className="w-12 h-12 rounded-figma-full bg-surfaceContainer items-center justify-center mb-3">
                <CheckIcon size={22} color={colors.primaryContainer} />
              </View>
              <Text className="text-figma-14 font-inter-600 text-textPrimary mb-1">Queue clear — all caught up</Text>
              <Text className="text-figma-12 font-inter-400 text-textSecondary text-center">
                New seller verification requests will appear here.
              </Text>
            </View>
          ) : (
            pending.map((seller) => (
              <View
                key={seller.username}
                className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-11 h-11 rounded-figma-full bg-surfaceContainerLow items-center justify-center mr-3">
                    <Text className="text-figma-14 font-inter-700 text-primaryContainer">
                      {seller.name.split(' ').map((w) => w[0]).join('')}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-figma-14 font-inter-600 text-textPrimary">{seller.businessName}</Text>
                    <Text className="text-figma-12 font-inter-400 text-textSecondary">
                      @{seller.username} · {seller.name}
                    </Text>
                  </View>
                  <Text className="text-figma-10 font-inter-500 text-textTertiary">{seller.submitted}</Text>
                </View>

                <View className="flex-row items-center justify-between mb-3">
                  <View className="bg-surfaceContainerLow rounded-figma-12 px-3 py-1.5">
                    <Text className="text-figma-11 font-inter-500 text-tertiary">{seller.category}</Text>
                  </View>
                  <Text className="text-figma-10 font-inter-500 text-textTertiary">Submitted {seller.submitted}</Text>
                </View>

                <View className="flex-row flex-wrap gap-2 mb-4">
                  {seller.docs.map((doc: any, i: number) => {
                    // Scrubbed records file docs as {type,label,fileName} stubs
                    // (URLs stripped on ack) — render the label, never the object.
                    const label = typeof doc === 'string' ? doc : String(doc?.label ?? doc?.type ?? 'Document');
                    return (
                      <View key={`${label}-${i}`} className="flex-row items-center gap-1 bg-surfaceContainer rounded-figma-full px-2.5 py-1">
                        <CheckIcon size={10} color={colors.success} />
                        <Text className="text-figma-11 font-inter-500 text-textPrimary">{label} ✓</Text>
                      </View>
                    );
                  })}
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 h-11 bg-primaryContainer rounded-figma-12 items-center justify-center"
                    onPress={() => approve(seller.username)}
                  >
                    <Text className="text-figma-12 font-inter-600 text-white">Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 h-11 rounded-figma-12 items-center justify-center"
                    style={{ borderWidth: 1, borderColor: colors.error }}
                    onPress={() => reject(seller)}
                  >
                    <Text className="text-figma-12 font-inter-600 text-error">Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {approvedList.length > 0 && (
            <>
              <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3 mt-2">
                Approved
              </Text>
              {approvedList.map((seller) => (
                <View
                  key={seller.username}
                  className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                >
                  <View className="flex-row items-center">
                    <View className="w-11 h-11 rounded-figma-full bg-surfaceContainerLow items-center justify-center mr-3">
                      <Text className="text-figma-14 font-inter-700 text-primaryContainer">
                        {seller.name.split(' ').map((w) => w[0]).join('')}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-figma-14 font-inter-600 text-textPrimary">{seller.businessName}</Text>
                        <VerifiedIcon size={14} />
                      </View>
                      <Text className="text-figma-12 font-inter-400 text-textSecondary">@{seller.username}</Text>
                    </View>
                    <View className="flex-row items-center gap-1 bg-primaryContainer/10 rounded-figma-full px-2.5 py-1">
                      <CheckIcon size={10} color={colors.primaryContainer} />
                      <Text className="text-figma-11 font-inter-600 text-primaryContainer">Verified</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {rejectedList.length > 0 && (
            <>
              <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3 mt-2">
                Rejected
              </Text>
              {rejectedList.map((seller) => (
                <View
                  key={seller.username}
                  className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                >
                  <View className="flex-row items-center">
                    <View className="w-11 h-11 rounded-figma-full bg-surfaceContainerLow items-center justify-center mr-3">
                      <Text className="text-figma-14 font-inter-700 text-textSecondary">
                        {seller.name.split(' ').map((w) => w[0]).join('')}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-figma-14 font-inter-600 text-textPrimary">{seller.businessName}</Text>
                      <Text className="text-figma-12 font-inter-400 text-textSecondary">@{seller.username}</Text>
                    </View>
                    <View className="bg-errorContainer rounded-figma-full px-2.5 py-1">
                      <Text className="text-figma-11 font-inter-600 text-error">Rejected</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
