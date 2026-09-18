import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CheckIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import type { Dispute, DisputeTimelineEntry } from '../disputes';
import { useAuth } from '../../contexts/AuthContext';

const DISPUTES_KEY_BASE = '@susej_disputes';

const AUTHOR_LABELS: Record<DisputeTimelineEntry['author'], string> = {
  you: 'You',
  seller: 'Seller',
  platform: 'susej team',
};

const formatTime = (time: number): string => {
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString();
};

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const disputeId = Array.isArray(id) ? id[0] : id ?? '';
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const getKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${DISPUTES_KEY_BASE}:${u}` : DISPUTES_KEY_BASE;
  }, [user?.username]);
  const [loaded, setLoaded] = useState(false);
  const [dispute, setDispute] = useState<Dispute | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = getKey();
    setLoaded(false);
    AsyncStorage.getItem(key)
      .then(async (data) => {
        if (cancelled) return;
        let found: Dispute | null = null;
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // Match temp id OR adopted server id (create adopts async).
            if (Array.isArray(parsed)) found = (parsed as Dispute[]).find((d) => d.id === disputeId || d.serverId === disputeId) ?? null;
          } catch {}
        }
        if (!found && key !== DISPUTES_KEY_BASE) {
          try {
            const legacy = await AsyncStorage.getItem(DISPUTES_KEY_BASE);
            if (!cancelled && legacy) {
              try {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed)) found = (parsed as Dispute[]).find((d) => d.id === disputeId || d.serverId === disputeId) ?? null;
              } catch {}
            }
          } catch {}
        }
        if (!cancelled) { setDispute(found); setLoaded(true); }
      })
      .catch(() => { if (!cancelled) { setDispute(null); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [disputeId, getKey, tokenSeq]);

  // No local reply box: dispute threads have no server backing, so a reply
  // composer faked a conversation nobody else could see. Follow-ups route to
  // Support (server-backed ticket + opener message) with the dispute linked.
  const contactSupport = () => {
    if (!dispute) return;
    router.push(`/support?topic=${encodeURIComponent(`dispute:${dispute.orderRef}`)}`);
  };

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Dispute {dispute ? `#${dispute.orderRef.replace('#', '')}` : ''}
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : !dispute ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
            Dispute not found
          </Text>
          <Text className="font-inter-400 text-textSecondary mt-1 text-center" style={{ fontSize: 13, lineHeight: 18 }}>
            This dispute may have been removed.
          </Text>
          <TouchableOpacity
            className="mt-6 items-center justify-center px-6"
            style={{ height: 48, borderRadius: 12, backgroundColor: colors.primaryContainer }}
            onPress={() => router.back()}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 15, lineHeight: 20 }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 128 + insets.bottom }}>
          {/* Status chip */}
          <View className="items-start mb-4">
            <View
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor:
                  dispute.status === 'resolved'
                    ? colors.successBg
                    : dispute.status === 'under_review'
                    ? colors.surfaceContainer
                    : colors.primaryContainer,
              }}
            >
              <Text
                className="font-inter-600"
                style={{
                  fontSize: 12,
                  lineHeight: 14,
                  color:
                    dispute.status === 'resolved'
                      ? colors.success
                      : dispute.status === 'under_review'
                      ? colors.tertiary
                      : colors.onPrimary,
                }}
              >
                {dispute.status === 'resolved'
                  ? 'Resolved'
                  : dispute.status === 'under_review'
                  ? 'Under review'
                  : 'Open'}
              </Text>
            </View>
          </View>

          {/* Case summary */}
          <View className="mb-6 p-4" style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                {dispute.reason}
              </Text>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14 }}>
                {dispute.orderRef}
              </Text>
            </View>
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 21 }}>
              {dispute.description}
            </Text>
          </View>

          {/* Timeline */}
          <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
            TIMELINE
          </Text>
          <View className="mb-6">
            {dispute.timeline.map((entry, i) => {
              const last = i === dispute.timeline.length - 1;
              const authorColor = entry.author === 'you' ? colors.primaryContainer : entry.author === 'seller' ? colors.tertiary : colors.success;
              return (
                <View key={entry.id} className="flex-row">
                  <View className="items-center mr-3">
                    <View className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: authorColor }} />
                    {!last && <View className="flex-1 w-px" style={{ backgroundColor: colors.surfaceContainerHigh }} />}
                  </View>
                  <View className="flex-1 pb-5">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                        {AUTHOR_LABELS[entry.author]}
                      </Text>
                      <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                        {formatTime(entry.time)}
                      </Text>
                    </View>
                    <View className="mt-1 p-3" style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 12 }}>
                      <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                        {entry.text}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Resolution line */}
          {dispute.status === 'resolved' && dispute.resolution ? (
            <View className="mb-6 p-4 flex-row items-start" style={{ backgroundColor: colors.successBg, borderRadius: 16 }}>
              <CheckIcon size={18} color={colors.success} />
              <View className="flex-1 ml-3">
                <Text className="font-inter-600 mb-1" style={{ fontSize: 14, lineHeight: 16, color: colors.success }}>
                  Resolution
                </Text>
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }}>
                  {dispute.resolution}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Follow-up via Support (server-backed) — never a local-only reply */}
          {dispute.status !== 'resolved' && (
            <TouchableOpacity
              className="flex-row items-center justify-center h-12 px-4"
              style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
              onPress={contactSupport}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 20 }}>
                Add information via Support
              </Text>
            </TouchableOpacity>
          )}
          <Text className="font-inter-400 text-textSecondary mt-3 text-center" style={{ fontSize: 12, lineHeight: 16 }}>
            Replies here reach the susej team through a support ticket linked to this dispute.
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
