import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Animated, Alert, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SearchIcon, HamburgerIcon, ChevronLeftIcon, ChevronRightIcon, SendIcon, BagIcon } from '../../utils/icons';
import { colors, formatCount, formatPrice } from '../../utils/theme';
import { useCommunities } from '../../contexts/CommunityContext';
import { useOrders } from '../../contexts/OrderContext';
import { messageAvatars } from '../../utils/screenImages';

type TabType = 'messages' | 'community';

interface ChatItem {
  id: string;
  name: string;
  time: string;
  message: string;
  messageWeight: 400 | 600;
  status: string;
  statusBg: string;
  statusColor: string;
  hasUnread: boolean;
  username?: string;
  productName?: string;
  hasPendingOffer?: boolean;
}

const chats: ChatItem[] = [
  { id: '1', name: 'Julian Rossi', username: 'julian.rossi', time: '2m ago', message: "Is the vintage leather jacket still available? I'm...", messageWeight: 600, status: 'NEGOTIATING', statusBg: colors.primaryFixed, statusColor: colors.onPrimaryFixedVariant, hasUnread: true, productName: 'Vintage Leather Jacket', hasPendingOffer: true },
  { id: '2', name: 'Elena Vance', username: 'elena.vance', time: '1h ago', message: 'The tracking number has been updated. You should get it by...', messageWeight: 400, status: 'OFFER ACCEPTED', statusBg: colors.successBg, statusColor: colors.success, hasUnread: true },
  { id: '3', name: 'Marcus Chen', username: 'marcus.chen', time: '3h ago', message: 'I can do $45 if we meet today near the downtown center.', messageWeight: 400, status: 'INQUIRY', statusBg: colors.secondaryContainer, statusColor: colors.secondary, hasUnread: false, hasPendingOffer: true },
  { id: '4', name: 'Sarah Jenkins', username: 'sarah.jenkins', time: 'Yesterday', message: 'Thanks again! The packaging was absolutely beautiful.', messageWeight: 400, status: 'COMPLETED', statusBg: colors.primaryFixed, statusColor: colors.onPrimaryFixedVariant, hasUnread: false },
  { id: '5', name: 'Robert Miller', username: 'robert.miller', time: 'Yesterday', message: 'Will you be listing any more of those limited edition prints?', messageWeight: 400, status: 'CANCELLED', statusBg: colors.errorContainer, statusColor: colors.onErrorContainer, hasUnread: false },
];

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

interface ThreadOffer {
  amount: number;
  productName: string;
  productId: string;
  status: OfferStatus;
}

interface ThreadMessage {
  id: string;
  senderId?: string;
  text?: string;
  mine: boolean;
  system?: boolean;
  offer?: ThreadOffer;
  status?: 'sent' | 'delivered' | 'seen';
  voice?: { duration: string; durationMs: number };
}

const SEED_REPLIES = [
  'Sounds good — when are you free to meet?',
  "Yes, it's still available! Would you like more photos?",
  'Let me check the details and get back to you in a bit.',
  'Thanks for reaching out! Happy to negotiate in the chat.',
  'Sure, I can do that. What time works for you?',
];

const WAVE_HEIGHTS = [8, 14, 20, 12, 24, 16, 10, 22, 14, 18, 12, 20, 16, 10, 14, 8];

const OFFER_STATUS_META: Record<OfferStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: colors.primaryFixed, color: colors.onPrimaryFixedVariant },
  countered: { label: 'Countered', bg: colors.tertiaryFixed, color: colors.onTertiaryFixedVariant },
  accepted: { label: 'Accepted', bg: colors.successBg, color: colors.success },
  declined: { label: 'Declined', bg: colors.errorContainer, color: colors.onErrorContainer },
};

function RupeeIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M13.66 7c-.56-1.18-1.76-2-3.16-2H6V3h12v2h-3.26c.48.58.84 1.26 1.05 2H18v2h-2.02c-.25 2.8-2.61 5-5.48 5h-.73l6.73 7h-2.77L7 14v-2h3.5c1.76 0 3.22-1.3 3.46-3H6V7h7.66z"
      />
    </Svg>
  );
}

function MicIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"
      />
    </Svg>
  );
}

function StopIcon({ size = 16, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={color} d="M6 6h12v12H6z" />
    </Svg>
  );
}

function PlayIcon({ size = 13, color = colors.surfaceContainerLowest }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={color} d="M8 5v14l11-7z" />
    </Svg>
  );
}

function VideoCallIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"
      />
    </Svg>
  );
}

function BlockIcon({ size = 18, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z"
      />
    </Svg>
  );
}

type ChatFilter = 'all' | 'unread' | 'offers';

const UNREAD_KEY = '@susej_chat_unread';

const BLOCKED_KEY = '@susej_blocked';

interface BlockedUser {
  username: string;
  name?: string;
  at?: number;
}

const CHAT_FILTERS: { key: ChatFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'offers', label: 'Offers' },
];

function TypingIndicator({ name }: { name: string }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(d, { toValue: 1, duration: 350, delay: i * 150, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 350, delay: (2 - i) * 150, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View className="flex-row items-center">
      <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
        {name} is typing
      </Text>
      <View className="flex-row ml-2" style={{ gap: 3 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textSecondary, opacity: d }} />
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [readChatIds, setReadChatIds] = useState<string[]>([]);
  const [readLoaded, setReadLoaded] = useState(false);
  const [tab, setTab] = useState<TabType>('messages');
  const insets = useSafeAreaInsets();
  const { communities, joinedCommunities } = useCommunities();
  const { placeOrders } = useOrders();
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [offerMode, setOfferMode] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [countering, setCountering] = useState<ThreadMessage | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [offerProduct, setOfferProduct] = useState<string | undefined>(undefined);
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replyIndex = useRef(0);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);

  const params = useLocalSearchParams<{ product?: string | string[]; seller?: string | string[]; to?: string | string[]; msg?: string | string[] }>();
  const rawProduct = Array.isArray(params.product) ? params.product[0] : params.product;
  const rawSeller = Array.isArray(params.seller) ? params.seller[0] : params.seller;
  const rawTo = Array.isArray(params.to) ? params.to[0] : params.to;
  const rawMsg = Array.isArray(params.msg) ? params.msg[0] : params.msg;

  useEffect(() => {
    AsyncStorage.getItem(UNREAD_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setReadChatIds(parsed);
        } catch {}
      })
      .catch(() => {})
      .finally(() => setReadLoaded(true));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(BLOCKED_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setBlockedUsers(parsed as BlockedUser[]);
              setBlockedLoaded(true);
              return;
            }
          } catch {
            // corrupted data — fall through to empty list
          }
        }
        setBlockedLoaded(true);
      })
      .catch(() => setBlockedLoaded(true));
  }, []);

  useEffect(() => {
    if (!blockedLoaded) return;
    AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(blockedUsers)).catch(() => {});
  }, [blockedUsers, blockedLoaded]);

  useEffect(() => {
    if (!readLoaded) return;
    AsyncStorage.setItem(UNREAD_KEY, JSON.stringify(readChatIds)).catch(() => {});
  }, [readChatIds, readLoaded]);

  const blockUser = () => {
    if (!activeChat) return;
    const username = activeChat.username ?? activeChat.name.toLowerCase().replace(/\s+/g, '.');
    Alert.alert(`Block ${activeChat.name}?`, "They won't be able to message you.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          setBlockedUsers((prev) =>
            prev.some((b) => b.username.toLowerCase() === username.toLowerCase())
              ? prev
              : [...prev, { username, name: activeChat.name, at: Date.now() }]
          );
          Alert.alert('User blocked');
          setActiveChat(null);
        },
      },
    ]);
  };

  const markChatRead = (id: string) => {
    setReadChatIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  useEffect(() => {
    if (rawTo) return;
    if (!rawProduct && !rawSeller) return;
    const sellerName = rawSeller ?? 'Seller';
    const chat: ChatItem = {
      id: `seller_${sellerName}`,
      name: sellerName,
      username: sellerName.toLowerCase().replace(/\s+/g, '.'),
      time: '',
      message: '',
      messageWeight: 400,
      status: 'NEGOTIATING',
      statusBg: colors.primaryFixed,
      statusColor: colors.onPrimaryFixedVariant,
      hasUnread: false,
      productName: rawProduct,
    };
    setActiveChat(chat);
    setOfferProduct(rawProduct);
    markChatRead(chat.id);
    setOfferMode(false);
    setCountering(null);
    setThreadMessages([
      {
        id: 'welcome',
        mine: false,
        text: `Hi ${sellerName}! I'm interested in ${rawProduct ?? 'your item'}. Would you accept an offer?`,
      },
    ]);
  }, [rawProduct, rawSeller]);

  // Deep link `to=<sellerUsername>`: focus an existing thread for that seller
  // or open a fresh enquiry thread (with optional prefilled `msg`).
  useEffect(() => {
    if (!rawTo || !blockedLoaded) return;
    const normalized = rawTo.toLowerCase();
    if (blockedUsers.some((b) => b.username.toLowerCase() === normalized)) return;
    const existing = chats.find((c) => (c.username ?? '').toLowerCase() === normalized);
    const displayName =
      existing?.name ??
      rawTo
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    const chat: ChatItem = existing
      ? { ...existing, hasUnread: false }
      : {
          id: `seller_${rawTo}`,
          name: displayName,
          username: rawTo,
          time: '',
          message: '',
          messageWeight: 400,
          status: 'INQUIRY',
          statusBg: colors.secondaryContainer,
          statusColor: colors.secondary,
          hasUnread: false,
        };
    setActiveChat(chat);
    setOfferProduct(chat.productName ?? undefined);
    markChatRead(chat.id);
    setOfferMode(false);
    setCountering(null);
    setThreadMessages([
      {
        id: `welcome_${Date.now()}`,
        mine: false,
        text: rawMsg && rawMsg.trim() ? rawMsg.trim() : `Hi ${displayName}! I'd like to know more about your store.`,
      },
    ]);
  }, [rawTo, rawMsg, blockedLoaded, blockedUsers]);

  useEffect(() => {
    if (!activeChat) return;
    startTypingAndReply();
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = null;
      setIsTyping(false);
    };
  }, [activeChat]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (recTimer.current) clearInterval(recTimer.current);
      if (playTimer.current) clearInterval(playTimer.current);
    };
  }, []);

  const q = search.trim().toLowerCase();
  const blockedSet = new Set(blockedUsers.map((b) => b.username.toLowerCase()));
  const blockedCount = chats.filter((c) => c.username && blockedSet.has(c.username.toLowerCase())).length;
  const visibleChats = chats
    .filter((c) => !c.username || !blockedSet.has(c.username.toLowerCase()))
    .map((c) => ({ ...c, hasUnread: c.hasUnread && !readChatIds.includes(c.id) }));
  const filteredChats = visibleChats
    .filter((c) => (filter === 'all' ? true : filter === 'unread' ? c.hasUnread : c.hasPendingOffer === true))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.message.toLowerCase().includes(q));

  const communityRows: ChatItem[] = joinedCommunities.map((c) => ({
    id: c.id,
    name: c.name,
    time: '',
    message: `${formatCount(c.memberCount)} members · ${c.description}`,
    messageWeight: 400,
    status: 'COMMUNITY',
    statusBg: colors.surfaceContainerLow,
    statusColor: colors.secondary,
    hasUnread: false,
  }));
  const visibleCommunityRows = communityRows.filter((c) => !q || c.name.toLowerCase().includes(q));

  const openChat = (chat: ChatItem) => {
    markChatRead(chat.id);
    setActiveChat(chat);
    setOfferProduct(chat.productName);
    setOfferMode(false);
    setCountering(null);
    setThreadMessages([{ id: 'seed', text: chat.message, mine: false }]);
  };

  const sendMessage = () => {
    const text = composer.trim();
    if (!text) return;
    const id = String(Date.now());
    setThreadMessages((prev) => [...prev, { id, text, mine: true, status: 'sent' }]);
    setComposer('');
    scheduleStatusFlow(id);
    startTypingAndReply();
  };

  const updateStatus = (id: string, status: 'delivered' | 'seen') => {
    setThreadMessages((prev) => prev.map((m) => (m.id === id && m.mine ? { ...m, status } : m)));
  };

  const scheduleStatusFlow = (id: string, seenDelay = 3800) => {
    setTimeout(() => updateStatus(id, 'delivered'), 800);
    setTimeout(() => updateStatus(id, 'seen'), seenDelay);
  };

  const startTypingAndReply = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setIsTyping(true);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      typingTimer.current = null;
      const reply = SEED_REPLIES[replyIndex.current % SEED_REPLIES.length];
      replyIndex.current += 1;
      setThreadMessages((prev) => [
        ...prev.map((m) => (m.mine && m.status === 'delivered' ? { ...m, status: 'seen' as const } : m)),
        { id: `reply_${Date.now()}`, mine: false, text: reply },
      ]);
    }, 2500);
  };

  const startRecording = () => {
    if (recTimer.current) clearInterval(recTimer.current);
    setRecSeconds(0);
    setRecording(true);
    recTimer.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = null;
    setRecording(false);
    const secs = Math.max(7, recSeconds);
    const id = String(Date.now());
    setThreadMessages((prev) => [
      ...prev,
      { id, mine: true, status: 'sent', voice: { duration: `0:${String(secs).padStart(2, '0')}`, durationMs: secs * 1000 } },
    ]);
    scheduleStatusFlow(id, 2200);
  };

  const toggleVoice = (msg: ThreadMessage) => {
    if (!msg.voice) return;
    if (playingVoiceId === msg.id) {
      if (playTimer.current) clearInterval(playTimer.current);
      playTimer.current = null;
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      return;
    }
    setPlayingVoiceId(msg.id);
    setVoiceProgress(0);
    playTimer.current = setInterval(() => {
      setVoiceProgress((p) => {
        const next = p + 0.05;
        if (next >= 1) {
          if (playTimer.current) clearInterval(playTimer.current);
          playTimer.current = null;
          setPlayingVoiceId(null);
          return 1;
        }
        return next;
      });
    }, Math.max(60, msg.voice.durationMs / 20));
  };

  const productName = offerProduct ?? 'Product offer';

  const submitOffer = () => {
    const amount = Number(offerAmount);
    if (!amount || amount <= 0 || creatingOrder) return;
    const now = Date.now();
    const offer: ThreadOffer = {
      amount,
      productName,
      productId: `offer_${now}`,
      status: 'pending',
    };
    setThreadMessages((prev) => {
      const next = countering
        ? prev.map((m) =>
            m.id === countering.id && m.offer
              ? { ...m, offer: { ...m.offer, status: 'countered' as OfferStatus } }
              : m
          )
        : prev;
      return [...next, { id: `offer_${now}`, senderId: 'me', mine: true, offer }];
    });
    setOfferMode(false);
    setCountering(null);
    setOfferAmount('');
  };

  const handleAccept = (messageId: string, offer: ThreadOffer) => {
    if (creatingOrder || !activeChat) return;
    setCreatingOrder(true);
    const created = placeOrders([
      {
        listingId: offer.productId,
        type: 'product',
        name: offer.productName,
        price: offer.amount,
        quantity: 1,
        seller: activeChat.name,
        sellerUsername: activeChat.username ?? activeChat.name.toLowerCase().replace(/\s+/g, '.'),
      },
    ]);
    const order = created[0];
    setThreadMessages((prev) => [
      ...prev.map((m) =>
        m.id === messageId && m.offer
          ? { ...m, offer: { ...m.offer, status: 'accepted' as OfferStatus } }
          : m
      ),
      {
        id: `deal_${Date.now()}`,
        mine: true,
        system: true,
        text: `Deal accepted — order ${order.orderNumber} created`,
      },
    ]);
    setCreatingOrder(false);
    setTimeout(() => router.push(`/track-order?id=${order.id}`), 400);
  };

  const handleDecline = (messageId: string) => {
    setThreadMessages((prev) => [
      ...prev.map((m) =>
        m.id === messageId && m.offer
          ? { ...m, offer: { ...m.offer, status: 'declined' as OfferStatus } }
          : m
      ),
      { id: `declined_${Date.now()}`, mine: true, system: true, text: 'Offer declined' },
    ]);
  };

  const startCounter = (msg: ThreadMessage) => {
    if (creatingOrder) return;
    setCountering(msg);
    setOfferAmount(String(msg.offer?.amount ?? ''));
    setOfferMode(true);
  };

  const renderOfferCard = (msg: ThreadMessage) => {
    const offer = msg.offer!;
    const meta = OFFER_STATUS_META[offer.status];
    const actionable = !msg.mine && offer.status === 'pending' && !creatingOrder;
    return (
      <View
        className="mb-2 self-start max-w-[85%]"
        style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 14, width: 280 }}
      >
        <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 15, letterSpacing: 0.5, color: colors.textTertiary }}>
          {msg.mine ? 'YOUR OFFER' : 'OFFER'}
        </Text>
        <Text className="font-inter-600 text-textPrimary mt-0.5" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={2}>
          {offer.productName}
        </Text>
        <Text className="font-inter-700 text-primary mt-1" style={{ fontSize: 20, lineHeight: 24 }}>
          {formatPrice(offer.amount)}
        </Text>
        <View className="self-start px-2 py-0.5 mt-2 rounded-full" style={{ backgroundColor: meta.bg }}>
          <Text style={{ fontSize: 10, lineHeight: 15, letterSpacing: 0.5, color: meta.color }}>{meta.label}</Text>
        </View>
        {offer.status === 'pending' && msg.mine && (
          <Text className="font-inter-400 mt-2" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            Waiting for {activeChat?.name}…
          </Text>
        )}
        {actionable && (
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            <TouchableOpacity
              className="flex-1 h-10 items-center justify-center rounded-figma-12"
              style={{ backgroundColor: colors.primaryContainer, opacity: creatingOrder ? 0.5 : 1 }}
              disabled={creatingOrder}
              onPress={() => handleAccept(msg.id, offer)}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                {creatingOrder ? 'Creating…' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-10 items-center justify-center rounded-figma-12"
              style={{ backgroundColor: colors.surfaceContainer }}
              disabled={creatingOrder}
              onPress={() => startCounter(msg)}
            >
              <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>
                Counter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="h-10 px-3 items-center justify-center rounded-figma-12 border"
              style={{ borderColor: colors.outlineVariant }}
              disabled={creatingOrder}
              onPress={() => handleDecline(msg.id)}
            >
              <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                Decline
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (activeChat) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.surface }}>
        {/* Thread header */}
        <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={() => setActiveChat(null)}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <View className="flex-1 ml-4">
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 16, lineHeight: 20 }} numberOfLines={1}>
              {activeChat.name}
            </Text>
            <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: colors.secondary }}>
              {activeChat.status}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: colors.surfaceContainerLow }}
              onPress={blockUser}
            >
              <BlockIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: colors.surfaceContainerLow }}
              onPress={() => router.push(`/call?name=${encodeURIComponent(activeChat.name)}`)}
            >
              <VideoCallIcon size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={threadMessages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 py-4"
          renderItem={({ item }) => {
            if (item.offer) {
              return renderOfferCard(item);
            }
            if (item.system) {
              return (
                <View className="items-center mb-2">
                  <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                    {item.text}
                  </Text>
                </View>
              );
            }
            if (item.voice) {
              const playing = playingVoiceId === item.id;
              return (
                <View className="mb-2 self-end" style={{ maxWidth: '85%', alignItems: 'flex-end' }}>
                  <TouchableOpacity
                    className="px-4 py-3 flex-row items-center"
                    style={{
                      backgroundColor: colors.primaryContainer,
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      borderBottomLeftRadius: 16,
                      borderBottomRightRadius: 4,
                    }}
                    onPress={() => toggleVoice(item)}
                  >
                    <View
                      className="w-9 h-9 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: colors.surfaceContainerLowest, opacity: 0.22 }}
                    >
                      <PlayIcon size={13} color={colors.surfaceContainerLowest} />
                    </View>
                    <View className="flex-row mr-3" style={{ gap: 3, alignItems: 'center', height: 26 }}>
                      {WAVE_HEIGHTS.map((h, i) => {
                        const frac = (i + 1) / WAVE_HEIGHTS.length;
                        return (
                          <View
                            key={i}
                            style={{
                              width: 3,
                              height: h,
                              borderRadius: 2,
                              backgroundColor: colors.surfaceContainerLowest,
                              opacity: playing && voiceProgress >= frac ? 1 : 0.45,
                            }}
                          />
                        );
                      })}
                    </View>
                    <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 13, color: colors.surfaceContainerLowest }}>
                      {item.voice.duration}
                    </Text>
                  </TouchableOpacity>
                  <Text className="font-inter-400 mt-1" style={{ fontSize: 10, lineHeight: 12, color: colors.textSecondary }}>
                    {item.status === 'seen' ? 'Seen' : item.status === 'delivered' ? 'Delivered' : 'Sent'}
                  </Text>
                </View>
              );
            }
            return (
              <View className={`mb-2 ${item.mine ? 'self-end' : 'self-start'}`} style={{ maxWidth: '85%', alignItems: item.mine ? 'flex-end' : 'flex-start' }}>
                <View
                  className="px-4 py-3"
                  style={{
                    backgroundColor: item.mine ? colors.primaryContainer : colors.surfaceContainerLow,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderBottomLeftRadius: item.mine ? 16 : 4,
                    borderBottomRightRadius: item.mine ? 4 : 16,
                  }}
                >
                  <Text
                    className="font-inter-400"
                    style={{ fontSize: 14, lineHeight: 20, color: item.mine ? colors.surfaceContainerLowest : colors.textPrimary }}
                  >
                    {item.text}
                  </Text>
                </View>
                {item.mine && (
                  <Text className="font-inter-400 mt-1" style={{ fontSize: 10, lineHeight: 12, color: colors.textSecondary }}>
                    {item.status === 'seen' ? 'Seen' : item.status === 'delivered' ? 'Delivered' : 'Sent'}
                  </Text>
                )}
              </View>
            );
          }}
        />

        {/* Offer input panel */}
        {offerMode && (
          <View
            className="mx-4 mb-3 px-4 py-3"
            style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 16 }}
          >
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
              {countering ? `Counter offer for ${countering.offer?.productName}` : `Make an offer — ${productName}`}
            </Text>
            <View className="flex-row items-center mt-2">
              <View className="flex-1 h-11 flex-row items-center px-3" style={{ backgroundColor: colors.surfaceContainer, borderRadius: 12 }}>
                <Text className="font-inter-700 text-primary mr-1" style={{ fontSize: 16, lineHeight: 20 }}>
                  ₹
                </Text>
                <TextInput
                  className="flex-1 font-inter-500 text-textPrimary"
                  style={{ fontSize: 16 }}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={offerAmount}
                  onChangeText={setOfferAmount}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                className="ml-2 h-11 px-4 items-center justify-center rounded-figma-12"
                style={{ backgroundColor: colors.primaryContainer, opacity: creatingOrder ? 0.5 : 1 }}
                disabled={creatingOrder}
                onPress={submitOffer}
              >
                <Text className="font-inter-600 text-white" style={{ fontSize: 13, lineHeight: 16 }}>
                  Send Offer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="ml-2 h-11 px-3 items-center justify-center rounded-figma-12 border"
                style={{ borderColor: colors.outlineVariant }}
                onPress={() => {
                  setOfferMode(false);
                  setCountering(null);
                  setOfferAmount('');
                }}
              >
                <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 13, lineHeight: 16 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <View className="px-5 pb-1">
            <TypingIndicator name={activeChat.name} />
          </View>
        )}

        {/* Composer */}
        <View className="flex-row items-center px-4 pt-3 pb-4" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          <TouchableOpacity
            className="mr-3 w-11 h-11 items-center justify-center rounded-figma-full"
            style={{ backgroundColor: offerMode ? colors.primaryContainer : colors.surfaceContainer }}
            onPress={() => {
              setOfferMode((v) => !v);
              if (!offerMode) {
                setCountering(null);
                setOfferAmount('');
              }
            }}
          >
            <RupeeIcon size={20} color={offerMode ? colors.surfaceContainerLowest : colors.primary} />
          </TouchableOpacity>
          {recording ? (
            <View
              className="flex-1 h-11 flex-row items-center justify-center px-4"
              style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 22 }}
            >
              <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.error }} />
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                Recording
              </Text>
              <Text className="font-inter-500 mx-2" style={{ fontSize: 13, lineHeight: 16, color: colors.textSecondary }}>
                {`0:${String(Math.max(0, recSeconds)).padStart(2, '0')}`}
              </Text>
              <TouchableOpacity
                className="w-8 h-8 items-center justify-center rounded-figma-full"
                style={{ backgroundColor: colors.surfaceContainer }}
                onPress={stopRecording}
              >
                <StopIcon size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                className="mr-3 w-11 h-11 items-center justify-center rounded-figma-full"
                style={{ backgroundColor: colors.surfaceContainer }}
                onPress={startRecording}
              >
                <MicIcon size={18} color={colors.primary} />
              </TouchableOpacity>
              <TextInput
                className="flex-1 h-11 px-4 font-inter-400 text-textPrimary"
                style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 22 }}
                placeholder="Message..."
                placeholderTextColor={colors.textTertiary}
                value={composer}
                onChangeText={setComposer}
                onSubmitEditing={sendMessage}
              />
            </>
          )}
          <TouchableOpacity className="ml-3 w-11 h-11 bg-primaryContainer rounded-figma-full items-center justify-center" onPress={sendMessage}>
            <SendIcon size={18} color={colors.surfaceContainerLowest} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surfaceContainerLowest }}>
      {/* Header - TopAppBar — Figma 1:3387: hamburger, left-aligned susej, bag icon right */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity>
          <HamburgerIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="ml-3 font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5 }}>
          susej
        </Text>
        <View className="flex-1" />
        <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BagIcon size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View className="h-[49px]" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center h-full" style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity className="mr-6" onPress={() => setTab('messages')}>
            <Text
              className="font-inter-700"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: tab === 'messages' ? colors.primary : colors.secondary }}
            >
              Messages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('community')}>
            <Text
              className="font-inter-600"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: tab === 'community' ? colors.primary : colors.secondary }}
            >
              Community Chats
            </Text>
          </TouchableOpacity>
        </View>
        {/* Active tab divider */}
        <View style={{ width: 243, height: 2, backgroundColor: tab === 'messages' ? colors.primaryContainer : colors.outlineVariant, marginLeft: 20 }} />
      </View>

      <FlatList
        data={tab === 'messages' ? filteredChats : visibleCommunityRows}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-40"
        ListEmptyComponent={
          <View className="px-8 py-12 items-center">
            <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
              {tab === 'community'
                ? 'Join communities from the Communities Hub to chat with members'
                : filter === 'unread'
                ? 'No unread chats'
                : filter === 'offers'
                ? 'No offers yet'
                : 'No conversations match your search'}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View className="px-5 pt-3 pb-2">
            <View className="flex-row items-center h-12 px-4" style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 12 }}>
              <SearchIcon size={16} color={colors.secondary} style={{ opacity: 0.4 }} />
              <TextInput
                className="flex-1 ml-3 font-inter-400 text-textPrimary h-full"
                style={{ fontSize: 16 }}
                placeholder="Search conversations..."
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            {tab === 'messages' && (
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                {CHAT_FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      className="px-4 h-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow }}
                      onPress={() => setFilter(f.key)}
                    >
                      <Text
                        className="font-inter-600"
                        style={{ fontSize: 12, lineHeight: 14, color: active ? colors.surfaceContainerLowest : colors.textSecondary }}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {tab === 'messages' && blockedCount > 0 && (
              <View className="mt-2">
                <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>
                  {blockedCount} blocked conversation{blockedCount > 1 ? 's' : ''} hidden
                </Text>
              </View>
            )}
            {tab === 'messages' && communities.length > 0 && (
              <View className="mt-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 0.1 }}>
                    Group Chats
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/communities')}>
                    <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                      See all
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Compact avatar rail (industry pattern — keeps DM list high in viewport) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {communities.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      className="items-center"
                      style={{ width: 64 }}
                      onPress={() => router.push(`/community/${c.id}`)}
                    >
                      <View
                        className="w-14 h-14 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant }}
                      >
                        <Text className="font-inter-700 text-primary" style={{ fontSize: 15, lineHeight: 18 }}>
                          {c.name.charAt(0)}
                        </Text>
                      </View>
                      <Text className="font-inter-500 text-textSecondary mt-1 text-center" style={{ fontSize: 10, lineHeight: 12 }} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        }
          renderItem={({ item, index }) => (
          <TouchableOpacity
            className="flex-row items-start mx-5 mb-3"
            style={{
              backgroundColor: colors.surfaceContainerLowest,
              borderRadius: 24,
              padding: 18,
              shadowColor: '#1a1a2e',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 20,
              elevation: 2,
            }}
            onPress={() => {
              if (tab === 'messages') {
                openChat(item);
              } else {
                router.push(`/community/${item.id}`);
              }
            }}
          >
            {/* Avatar */}
            <View className="mr-4 relative">
              <View className="w-[60px] h-[60px] rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: colors.secondaryContainer }}>
                <Image source={messageAvatars[index % messageAvatars.length]} className="w-full h-full" resizeMode="cover" />
              </View>
              {item.hasUnread && (
                <View className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: '#22c55e' }} />
              )}
            </View>
            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-0.5">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                  {item.name}
                </Text>
                <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textTertiary }}>
                  {item.time}
                </Text>
              </View>
              <View className="flex-row items-center justify-between mb-0.5">
                <Text
                  className="flex-1 mr-2"
                  style={{ fontSize: 14, lineHeight: 20, fontWeight: item.messageWeight, color: item.messageWeight === 600 ? colors.textPrimary : colors.textSecondary }}
                  numberOfLines={2}
                >
                  {item.message}
                </Text>
                {item.hasUnread && (
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primaryContainer }} />
                )}
              </View>
              {/* Status badge */}
              <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: item.statusBg }}>
                <Text style={{ fontSize: 10, lineHeight: 15, letterSpacing: 0.5, fontWeight: '400', color: item.statusColor }}>
                  {item.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-24 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ backgroundColor: colors.primaryContainer, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 }}
        onPress={() => router.push('/communities')}
      >
        <Text style={{ fontSize: 22, color: colors.surfaceContainerLowest, fontWeight: '700', marginTop: -2 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
