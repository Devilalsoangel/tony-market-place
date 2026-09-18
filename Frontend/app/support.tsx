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
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, ChevronRightIcon, SendIcon } from '../utils/icons';
import { colors, shadows } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

const TICKETS_KEY_BASE = '@susej_tickets';
const TICKETS_KEY = TICKETS_KEY_BASE;
// Outbox for admin-queue mirrors that failed (offline at raise time).
// Flushed on every mount; entries are keyed by ticket id (server POST is
// id-shaped, replays converge) so a retry can never duplicate the queue.
// PER-USER key + owner stamp: the old global outbox flushed A's offline
// ticket under B's session after an account switch (wrong attribution).
// Legacy global entries are orphaned, never flushed (one-time, documented).
const TICKET_OUTBOX_KEY_BASE = '@susej_ticket_outbox';
const outboxKey = (username?: string | null) => {
  const u = username?.trim();
  return u ? `${TICKET_OUTBOX_KEY_BASE}:${u}` : TICKET_OUTBOX_KEY_BASE;
};

interface TicketMirrorPayload {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  messageText?: string;
  owner?: string;
}

async function queueTicketMirror(p: TicketMirrorPayload, owner?: string | null): Promise<void> {
  try {
    const key = outboxKey(owner);
    const raw = await AsyncStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const stamped = owner?.trim() ? { ...p, owner: owner.trim() } : p;
      if (!list.some((q) => (q as TicketMirrorPayload).id === stamped.id)) list.push(stamped);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

async function flushTicketOutbox(owner?: string | null): Promise<void> {
  try {
    const me = owner?.trim() ?? '';
    const raw = await AsyncStorage.getItem(outboxKey(owner));
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
    const m = await import('../utils/adminSync');
    const left: unknown[] = [];
    for (const p of list) {
      // Belt-and-braces: never flush another account's ticket even if keys
      // ever collide — skip (don't drop) foreign entries.
      const entryOwner = String((p as TicketMirrorPayload).owner ?? '').trim();
      if (entryOwner && me && entryOwner.toLowerCase() !== me.toLowerCase()) {
        left.push(p);
        continue;
      }
      try {
        const ok = await m.syncTicket(p as TicketMirrorPayload);
        if (!ok) left.push(p);
      } catch {
        left.push(p);
      }
    }
    await AsyncStorage.setItem(outboxKey(owner), JSON.stringify(left));
  } catch {}
}

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
  const { user, tokenSeq } = useAuth();
  const params = useLocalSearchParams<{ topic?: string | string[] }>();
  const [loaded, setLoaded] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [message, setMessage] = useState('');
  const [justRaised, setJustRaised] = useState(false);
  const ticketsKey = user?.username ? `${TICKETS_KEY_BASE}:${user.username}` : TICKETS_KEY_BASE;

  // Dispute handoff prefill (?topic=dispute:<orderRef>): dispute replies have
  // no server thread, so the dispute screen routes follow-ups here where the
  // ticket + opener message ARE server-backed. One-shot per mount.
  useEffect(() => {
    const raw = Array.isArray(params.topic) ? params.topic[0] : params.topic;
    if (!raw) return;
    const m = String(raw).match(/^dispute:(.+)$/);
    if (!m) return;
    setSubject(`Dispute follow-up — order ${m[1]}`);
    setFormOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    AsyncStorage.getItem(ticketsKey)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              const real = (parsed as SupportTicket[]).filter((t) => t && !/^SJ-TK-09\d\d$/.test(String(t.id)));
              setTickets(real);
              setLoaded(true);
              return;
            }
          } catch {}
        }
        // NO legacy-global copy for logged-in accounts: the global key may
        // hold the PRIOR account's tickets (clearMoneyCache wipes globals at
        // login, so a logged-in global hit is someone else's or stale).
        // Logged-out sessions (base key) read their own rows above.
        if (!cancelled) { setTickets([]); setLoaded(true); }
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [ticketsKey, tokenSeq]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ticketsKey, JSON.stringify(tickets)).catch(() => {});
  }, [tickets, loaded, ticketsKey]);

  // Flush any ticket mirrors that failed while offline (raise-time retry).
  // Owner-scoped: never flush another account's outbox after a switch.
  useEffect(() => {
    let dead = false;
    (async () => {
      if (dead) return;
      await flushTicketOutbox(user?.username);
    })();
    return () => { dead = true; };
  }, [tokenSeq, user?.username]);

  const openCount = tickets.filter((t) => t.status === 'open').length;

  const submitTicket = () => {
    const text = message.trim();
    const title = subject.trim();
    if (!title || !text) return;
    const now = new Date();
    const ticket: SupportTicket = {
      // Collision-proof id AND legacy-safe: the leading "1" guarantees the
      // suffix can never start with "09", which is exactly what the legacy
      // seed-drop filter above targets — user tickets can never be filtered.
      id: `SJ-TK-1${Date.now().toString().slice(-7)}`,
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
    // Mirror to the admin panel support queue. Failures queue into the
    // outbox (flushed on mount) instead of stranding the ticket on-device.
    void import('../utils/adminSync').then(async (m) => {
      const payload = {
        id: ticket.id,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: new Date().toISOString(),
        messageText: text,
      };
      try {
        const ok = await m.syncTicket(payload);
        if (!ok) await queueTicketMirror(payload, user?.username);
      } catch {
        await queueTicketMirror(payload, user?.username);
      }
    });
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
                    Tickets go to the susej support desk.
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
                  Ticket raised — our support team will reply here.
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
