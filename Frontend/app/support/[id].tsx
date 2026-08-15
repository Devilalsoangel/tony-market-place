import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, SendIcon } from '../../utils/icons';
import { colors, shadows } from '../../utils/theme';
import type { SupportTicket } from '../support';

const TICKETS_KEY = '@susej_tickets';

function SupportAvatar({ size = 30 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryContainer }}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <Path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z" fill={colors.primary} />
      </Svg>
    </View>
  );
}

const PRIORITY_COLOR: Record<SupportTicket['priority'], string> = {
  low: colors.secondary,
  medium: colors.tertiary,
  high: colors.error,
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(TICKETS_KEY)
      .then((data) => {
        if (!data) return;
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            setTicket(parsed.find((t: SupportTicket) => t.id === id) ?? null);
          }
        } catch {
          // corrupted — no ticket
        }
      })
      .catch(() => {});
  }, [id]);

  const persist = (next: SupportTicket) => {
    AsyncStorage.getItem(TICKETS_KEY)
      .then((data) => {
        let all: SupportTicket[] = [];
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) all = parsed;
          } catch {
            all = [];
          }
        }
        const idx = all.findIndex((t) => t.id === next.id);
        if (idx >= 0) all[idx] = next;
        else all = [next, ...all];
        AsyncStorage.setItem(TICKETS_KEY, JSON.stringify(all)).catch(() => {});
      })
      .catch(() => {});
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text || !ticket) return;
    const now = new Date();
    const next: SupportTicket = {
      ...ticket,
      messages: [
        ...ticket.messages,
        { id: ticket.messages.length + 1, from: 'me', text, time: now.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
      ],
    };
    setTicket(next);
    persist(next);
    setReply('');
  };

  if (!ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 pb-3" style={{ gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text className="font-inter-700" style={{ fontSize: 18, color: colors.textPrimary }}>
            Ticket
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 13, color: colors.textSecondary }}>
            Ticket not found.
          </Text>
        </View>
      </View>
    );
  }

  const open = ticket.status === 'open';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-5 pb-3">
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text className="font-inter-700" style={{ fontSize: 17, lineHeight: 22, color: colors.textPrimary }}>
              {ticket.id}
            </Text>
            <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>
              {ticket.category} · support desk
            </Text>
          </View>
        </View>
        <View
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: ticket.status === 'open' ? colors.primaryContainer : ticket.status === 'resolved' ? colors.successBg : colors.surfaceContainer }}
        >
          <Text
            className="font-inter-600"
            style={{ fontSize: 11, lineHeight: 14, color: ticket.status === 'open' ? colors.onPrimary : ticket.status === 'resolved' ? colors.success : colors.textSecondary }}
          >
            {ticket.status === 'open' ? 'OPEN' : ticket.status === 'resolved' ? 'RESOLVED' : 'CLOSED'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View className="px-4 py-4" style={[shadows.card, { borderRadius: 16, backgroundColor: colors.surfaceContainerLowest }]}>
          <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}>
            {ticket.subject}
          </Text>
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY_COLOR[ticket.priority] }} />
            <Text className="font-inter-500 capitalize" style={{ fontSize: 11, color: PRIORITY_COLOR[ticket.priority] }}>
              {ticket.priority} priority
            </Text>
            <Text className="font-inter-400" style={{ fontSize: 11, color: colors.textTertiary }}>
              · raised {ticket.createdAt}
            </Text>
          </View>
        </View>

        <View className="mt-5">
          {ticket.messages.map((m) => {
            const mine = m.from === 'me';
            return (
              <View key={m.id} className="mb-3" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && (
                  <View className="flex-row items-center mb-1 ml-1" style={{ gap: 6 }}>
                    <SupportAvatar size={20} />
                    <Text className="font-inter-600" style={{ fontSize: 10, color: colors.textTertiary }}>
                      susej support
                    </Text>
                  </View>
                )}
                <View className="px-3.5 py-2.5" style={{ maxWidth: '82%', borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, backgroundColor: mine ? colors.primaryContainer : colors.surfaceContainerLow }}>
                  <Text className="font-inter-400" style={{ fontSize: 13, lineHeight: 18, color: mine ? colors.onPrimary : colors.textPrimary }}>
                    {m.text}
                  </Text>
                  <Text className="font-inter-400 mt-1" style={{ fontSize: 9, lineHeight: 11, color: mine ? colors.onPrimary + '99' : colors.textTertiary }}>
                    {m.time}
                  </Text>
                </View>
              </View>
            );
          })}
          {open && (
            <View className="items-center py-3">
              <Text className="font-inter-400" style={{ fontSize: 11, color: colors.textTertiary }}>
                We usually reply within 24 hours.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 8, paddingHorizontal: 14, backgroundColor: colors.surface }}>
        <View className="flex-row items-center" style={[shadows.card, { borderRadius: 22, backgroundColor: colors.surfaceContainerLowest, padding: 6 }]}>
          <TextInput
            className="flex-1 px-3 font-inter-400"
            placeholder={open ? 'Write a reply...' : 'Ticket closed — raise a new one for more help.'}
            placeholderTextColor={colors.textTertiary}
            style={{ fontSize: 13, color: colors.textPrimary }}
            value={reply}
            onChangeText={setReply}
            editable={open}
            maxLength={500}
          />
          <TouchableOpacity
            className="items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: open && reply.trim() ? colors.primary : colors.surfaceContainer }}
            onPress={sendReply}
            disabled={!open || !reply.trim()}
          >
            <SendIcon size={17} color={open && reply.trim() ? colors.onPrimary : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
