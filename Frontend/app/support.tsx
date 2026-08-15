import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, ChevronRightIcon, SendIcon } from '../utils/icons';
import { colors, shadows } from '../utils/theme';

const TICKETS_KEY = '@susej_tickets';

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  messages: { id: number; from: 'me' | 'support'; text: string; time: string }[];
}

const CATEGORIES = ['Order', 'Payment', 'Account', 'Selling', 'Other'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;

const SEED_TICKETS: SupportTicket[] = [
  {
    id: 'SJ-TK-1002',
    subject: 'Refund not showing in wallet',
    category: 'Payment',
    priority: 'high',
    status: 'open',
    createdAt: 'Aug 13',
    messages: [
      { id: 1, from: 'me', text: 'My refund for order ORD-1004 was approved but the money is not in my wallet yet.', time: 'Aug 13, 10:12' },
    ],
  },
  {
    id: 'SJ-TK-0991',
    subject: 'How do I list an item as an auction?',
    category: 'Selling',
    priority: 'low',
    status: 'resolved',
    createdAt: 'Aug 11',
    messages: [
      { id: 1, from: 'me', text: 'I want to sell a watch as an auction. Which option should I pick in Create Post?', time: 'Aug 11, 18:40' },
      { id: 2, from: 'support', text: 'Hi! Head to your Seller Dashboard → Auctions → Start Auction. Pick the listing, set a starting price and duration, and it goes live immediately.', time: 'Aug 11, 19:02' },
      { id: 3, from: 'me', text: 'That worked, thanks!', time: 'Aug 11, 19:15' },
    ],
  },
  {
    id: 'SJ-TK-0980',
    subject: 'Wrong size delivered — order closed',
    category: 'Order',
    priority: 'medium',
    status: 'closed',
    createdAt: 'Aug 9',
    messages: [
      { id: 1, from: 'me', text: 'My order ORD-0988 arrived in the wrong size. Please help.', time: 'Aug 9, 09:05' },
      { id: 2, from: 'support', text: 'Sorry about that! We have raised a return request with the seller and sent you a prepaid label via email.', time: 'Aug 9, 10:30' },
      { id: 3, from: 'support', text: 'Return picked up and refund issued on Aug 11. This ticket is now closed. Reach out if you need anything else!', time: 'Aug 11, 14:20' },
    ],
  },
];

function LifeBuoyIcon({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill={color} />
    </Svg>
  );
}

function TicketIcon({ size = 18, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V6a2 2 0 0 0-2-2H4zm11 3h6v2h-6V7zm0 4h6v2h-6v-2zm0 4h6v2h-6v-2z" fill={color} />
    </Svg>
  );
}

const PRIORITY_COLOR: Record<SupportTicket['priority'], string> = {
  low: colors.secondary,
  medium: colors.tertiary,
  high: colors.error,
};

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [message, setMessage] = useState('');
  const [justRaised, setJustRaised] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TICKETS_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setTickets(parsed);
              setLoaded(true);
              return;
            }
          } catch {
            // corrupted data — fall through to seed
          }
        }
        setTickets(SEED_TICKETS);
        setLoaded(true);
      })
      .catch(() => {
        setTickets(SEED_TICKETS);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(TICKETS_KEY, JSON.stringify(tickets)).catch(() => {});
  }, [tickets, loaded]);

  const openCount = tickets.filter((t) => t.status === 'open').length;

  const submitTicket = () => {
    const text = message.trim();
    const title = subject.trim();
    if (!title || !text) return;
    const now = new Date();
    const ticket: SupportTicket = {
      id: `SJ-TK-${1000 + tickets.length + 1}`,
      subject: title,
      category,
      priority,
      status: 'open',
      createdAt: now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      messages: [
        { id: 1, from: 'me', text, time: now.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
      ],
    };
    setTickets((prev) => [ticket, ...prev]);
    // Mirror to the admin panel support queue (fire-and-forget).
    void import('../utils/adminSync').then((m) =>
      m.syncTicket({
        id: ticket.id,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: new Date().toISOString(),
        messageText: text,
      })
    );
    setSubject('');
    setMessage('');
    setFormOpen(false);
    setJustRaised(true);
    setTimeout(() => setJustRaised(false), 4000);
  };

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const chip =
      item.status === 'open'
        ? { bg: colors.primaryContainer, fg: colors.onPrimary, label: 'OPEN' }
        : item.status === 'resolved'
        ? { bg: colors.successBg, fg: colors.success, label: 'RESOLVED' }
        : { bg: colors.surfaceContainer, fg: colors.textSecondary, label: 'CLOSED' };
    const lastMsg = item.messages[item.messages.length - 1];
    return (
      <TouchableOpacity
        className="mx-5 px-4 py-4"
        style={[shadows.card, { backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, marginBottom: 10 }]}
        onPress={() => router.push(`/support/${item.id}`)}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text className="font-inter-600" style={{ fontSize: 11, letterSpacing: 0.6, color: colors.textTertiary }}>
              {item.id}
            </Text>
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: chip.bg }}>
              <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 12, color: chip.fg }}>
                {chip.label}
              </Text>
            </View>
          </View>
          <ChevronRightIcon size={14} color={colors.textTertiary} />
        </View>
        <Text className="font-inter-600 mt-2" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
          {item.subject}
        </Text>
        <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
          <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
            {item.category}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.outlineVariant }} />
          <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
            {lastMsg ? lastMsg.time : item.createdAt}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.outlineVariant }} />
          <View className="flex-row items-center" style={{ gap: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY_COLOR[item.priority] }} />
            <Text className="font-inter-500 capitalize" style={{ fontSize: 11, lineHeight: 14, color: PRIORITY_COLOR[item.priority] }}>
              {item.priority}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-5 pb-3">
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text className="font-inter-700" style={{ fontSize: 18, lineHeight: 24, color: colors.textPrimary }}>
            Help & Support
          </Text>
        </View>
        <TouchableOpacity className="px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
            {openCount} open
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        renderItem={renderTicket}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={{ paddingBottom: 14 }}>
            <View className="mx-5 px-5 py-5" style={{ borderRadius: 20, backgroundColor: colors.primaryContainer }}>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
                  <LifeBuoyIcon size={22} color={colors.onPrimary} />
                </View>
                <View className="flex-1">
                  <Text className="font-inter-700" style={{ fontSize: 16, lineHeight: 20, color: colors.onPrimary }}>
                    How can we help?
                  </Text>
                  <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 15, color: colors.onPrimary + 'CC' }}>
                    Tickets go to the susej support desk — average reply under 24h.
                  </Text>
                </View>
              </View>
              {!formOpen && (
                <TouchableOpacity
                  className="mt-4 items-center py-3"
                  style={{ borderRadius: 14, backgroundColor: colors.surfaceContainerLowest }}
                  onPress={() => setFormOpen(true)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.primary }}>
                    Raise a ticket
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {justRaised && (
              <View className="mx-5 mt-3 px-4 py-3" style={{ borderRadius: 12, backgroundColor: colors.primaryFixed }}>
                <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 15, color: colors.onPrimary }}>
                  Ticket raised — our team will get back to you within 24 hours.
                </Text>
              </View>
            )}

            {formOpen && (
              <View className="mx-5 mt-3 px-4 py-4" style={[shadows.card, { borderRadius: 16, backgroundColor: colors.surfaceContainerLowest }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                    Raise a ticket
                  </Text>
                  <TextInput
                    className="font-inter-400 mt-3 px-3 py-2.5"
                    placeholder="Subject"
                    placeholderTextColor={colors.textTertiary}
                    style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow, fontSize: 13, color: colors.textPrimary }}
                    value={subject}
                    onChangeText={setSubject}
                    maxLength={80}
                  />
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                    {CATEGORIES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        className="px-3 py-1.5"
                        style={{ borderRadius: 999, backgroundColor: category === c ? colors.primaryContainer : colors.surfaceContainerLow }}
                        onPress={() => setCategory(c)}
                      >
                        <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: category === c ? colors.onPrimary : colors.textSecondary }}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="flex-row mt-2" style={{ gap: 8 }}>
                    {PRIORITIES.map((p) => (
                      <TouchableOpacity
                        key={p}
                        className="px-3 py-1.5"
                        style={{ borderRadius: 999, backgroundColor: priority === p ? colors.primaryContainer : colors.surfaceContainerLow }}
                        onPress={() => setPriority(p)}
                      >
                        <Text className="font-inter-500 capitalize" style={{ fontSize: 11, lineHeight: 14, color: priority === p ? colors.onPrimary : colors.textSecondary }}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    className="font-inter-400 mt-3 px-3 py-2.5"
                    placeholder="Describe your issue..."
                    placeholderTextColor={colors.textTertiary}
                    style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow, fontSize: 13, color: colors.textPrimary, minHeight: 90, textAlignVertical: 'top' }}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                  />
                  <View className="flex-row mt-3" style={{ gap: 10 }}>
                    <TouchableOpacity
                      className="flex-1 items-center py-3"
                      style={{ borderRadius: 14, backgroundColor: colors.surfaceContainer }}
                      onPress={() => setFormOpen(false)}
                    >
                      <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textSecondary }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 items-center py-3"
                      style={{ borderRadius: 14, backgroundColor: colors.primary }}
                      onPress={submitTicket}
                    >
                      <Text className="font-inter-600" style={{ fontSize: 13, color: colors.onPrimary }}>
                        Submit ticket
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}

            <View className="flex-row items-center mt-4 px-5" style={{ gap: 8 }}>
              <TicketIcon size={16} color={colors.textSecondary} />
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                My tickets
              </Text>
              <Text className="font-inter-400" style={{ fontSize: 12, color: colors.textTertiary }}>
                ({tickets.length})
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-14">
            <TicketIcon size={28} color={colors.outlineVariant} />
            <Text className="font-inter-400 mt-3" style={{ fontSize: 13, color: colors.textSecondary }}>
              No tickets yet — raise one above.
            </Text>
          </View>
        }
      />

      {formOpen && (
        <View className="items-center pb-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <SendIcon size={13} color={colors.textTertiary} />
            <Text className="font-inter-400" style={{ fontSize: 11, color: colors.textTertiary }}>
              Replies appear in the ticket thread
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
