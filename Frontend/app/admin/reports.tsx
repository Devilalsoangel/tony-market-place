import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { BackIcon, CheckIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';

const RESOLVED_KEY = '@susej_mod_resolved';

interface ReportItem {
  id: string;
  reason: string;
  postTitle: string;
  seller: string;
  reporter: string;
  time: string;
}

const SEED_REPORTS: ReportItem[] = [
  {
    id: 'rep_1',
    reason: 'Spam listing',
    postTitle: 'iPhone 15 Pro Max 256GB — 30% off',
    seller: 'TechVault',
    reporter: 'Anonymous',
    time: '1h ago',
  },
  {
    id: 'rep_2',
    reason: 'Misleading price',
    postTitle: '"24K pure gold" necklace for ₹999',
    seller: 'GoldenVault',
    reporter: 'Anonymous',
    time: '3h ago',
  },
  {
    id: 'rep_3',
    reason: 'Inappropriate image',
    postTitle: 'Home workout gear bundle',
    seller: 'FlexFit India',
    reporter: 'Anonymous',
    time: '6h ago',
  },
  {
    id: 'rep_4',
    reason: 'Fake seller',
    postTitle: 'Vintage Levi\u2019s denim jacket',
    seller: 'vintage_king',
    reporter: 'Anonymous',
    time: '1d ago',
  },
];

function FlagIcon({ size = 16, color = colors.error }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 22v-7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function AdminReportsScreen() {
  const insets = useSafeAreaInsets();
  const [resolved, setResolved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RESOLVED_KEY);
        if (raw) setResolved(JSON.parse(raw) as string[]);
      } catch {
      } finally {
        loadedRef.current = true;
        setLoading(false);
      }
    })();
  }, []);

  const resolve = (id: string) => {
    if (!loadedRef.current) return;
    setResolved((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      AsyncStorage.setItem(RESOLVED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const open = SEED_REPORTS.filter((r) => !resolved.includes(r.id));
  const resolvedList = SEED_REPORTS.filter((r) => resolved.includes(r.id));

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between h-[52px] px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">Reports</Text>
        <View className="w-5" />
      </View>

      <View className="px-5">
        <View className="flex-row bg-surfaceContainer rounded-figma-full p-1 mb-4">
          <TouchableOpacity
            className="flex-1 py-2 items-center"
            onPress={() => router.push('/admin/verify')}
          >
            <Text className="text-figma-12 font-inter-600 text-textSecondary">Verification</Text>
          </TouchableOpacity>
          <View className="flex-1 bg-primaryContainer rounded-figma-full py-2 items-center">
            <Text className="text-figma-12 font-inter-600 text-white">Reports</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Open Reports</Text>
            <Text className="text-figma-20 font-inter-700 text-textPrimary">{open.length}</Text>
          </View>
          <View className="flex-1 bg-surfaceContainerLow rounded-figma-16 p-4">
            <Text className="text-figma-12 font-inter-400 text-textSecondary mb-1">Resolved</Text>
            <Text className="text-figma-20 font-inter-700 text-primaryContainer">{resolvedList.length}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
          <Text className="text-figma-12 font-inter-400 text-textSecondary mt-3">Loading reports…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3">Open Reports</Text>

          {open.length === 0 ? (
            <View className="bg-surfaceContainerLow rounded-figma-24 p-6 items-center mb-4">
              <View className="w-12 h-12 rounded-figma-full bg-surfaceContainer items-center justify-center mb-3">
                <CheckIcon size={22} color={colors.primaryContainer} />
              </View>
              <Text className="text-figma-14 font-inter-600 text-textPrimary mb-1">All clear</Text>
              <Text className="text-figma-12 font-inter-400 text-textSecondary text-center">
                No open reports right now. New community reports will appear here.
              </Text>
            </View>
          ) : (
            open.map((report) => (
              <View
                key={report.id}
                className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-9 h-9 rounded-figma-full bg-errorContainer items-center justify-center mr-3">
                    <FlagIcon size={16} color={colors.error} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-figma-14 font-inter-600 text-textPrimary">{report.reason}</Text>
                    <Text className="text-figma-11 font-inter-400 text-textSecondary">
                      Reported by {report.reporter} · {report.time}
                    </Text>
                  </View>
                  <View className="bg-errorContainer rounded-figma-full px-2.5 py-1">
                    <Text className="text-figma-10 font-inter-600 text-error">OPEN</Text>
                  </View>
                </View>

                <View className="bg-surfaceContainerLow rounded-figma-12 px-3 py-2.5 mb-4">
                  <Text className="text-figma-12 font-inter-500 text-textPrimary" numberOfLines={1}>
                    {report.postTitle}
                  </Text>
                  <Text className="text-figma-11 font-inter-400 text-textSecondary mt-0.5">
                    Listing by {report.seller}
                  </Text>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 h-11 bg-error rounded-figma-12 items-center justify-center"
                    onPress={() => resolve(report.id)}
                  >
                    <Text className="text-figma-12 font-inter-600 text-white">Remove post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 h-11 rounded-figma-12 items-center justify-center"
                    style={{ borderWidth: 1, borderColor: colors.outlineVariant }}
                    onPress={() => resolve(report.id)}
                  >
                    <Text className="text-figma-12 font-inter-600 text-textSecondary">Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {resolvedList.length > 0 && (
            <>
              <Text className="text-figma-12 font-inter-500 text-textSecondary uppercase tracking-wider mb-3 mt-2">
                Resolved
              </Text>
              {resolvedList.map((report) => (
                <View
                  key={report.id}
                  className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                >
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-figma-full bg-surfaceContainer items-center justify-center mr-3">
                      <CheckIcon size={14} color={colors.primaryContainer} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-figma-13 font-inter-600 text-textPrimary">{report.reason}</Text>
                      <Text className="text-figma-11 font-inter-400 text-textSecondary" numberOfLines={1}>
                        {report.postTitle}
                      </Text>
                    </View>
                    <View className="bg-surfaceContainer rounded-figma-full px-2.5 py-1">
                      <Text className="text-figma-10 font-inter-600 text-tertiary">Resolved</Text>
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
