import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { resolveAvatar } from '../../utils/productImages';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, Image, ScrollView, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, SendIcon } from '../../utils/icons';
import { colors, formatCount, formatPrice } from '../../utils/theme';
import { useCommunities } from '../../contexts/CommunityContext';

import { useAuth } from '../../contexts/AuthContext';
import { serverApi } from '../../utils/serverApi';
import { BROADCAST_CHANNELS } from '../broadcasts';
import { loadMarketplaceConfig, getChatPinPrice, getChatPinDays, resetMarketplaceConfig } from '../../utils/marketplace';
import { setImmersiveNav } from '../../utils/immersiveNav';

type TabType = 'messages' | 'community' | 'broadcast';

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
  /** Set when this chat is backed by a real server thread (multi-user sync). */
  serverThreadId?: string;
  /** Paid Pinned-chat VAS: ms epoch while the seller's pin window is active. */
  pinnedUntil?: number;
}

// No demo chats — every conversation in the list is a REAL server thread
// shared between actual registered users (offline shows an honest empty state).

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'consumed';

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
}

/** Relative time for server thread timestamps (ms epoch -> "2m ago"). */
function formatThreadTime(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const OFFER_STATUS_META: Record<OfferStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: colors.primaryFixed, color: colors.onPrimaryFixedVariant },
  countered: { label: 'Countered', bg: colors.tertiaryFixed, color: colors.onTertiaryFixedVariant },
  accepted: { label: 'Accepted', bg: colors.successBg, color: colors.success },
  // Consumed = accepted deal already converted to an order (single-use).
  // Displays as Accepted; never returns to Pending.
  consumed: { label: 'Accepted', bg: colors.successBg, color: colors.success },
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

/** Map a server chat message to local render shape, including structured
 *  offers (OLX-style negotiation renders/accepts the SAME offer both sides). */
function mapServerMessage(m: any, myUsername?: string): ThreadMessage {
  const o = m.offer as { amount?: unknown; productId?: unknown; productName?: unknown; status?: unknown } | null | undefined;
  const st = String(o?.status ?? '');
  const offer: ThreadOffer | undefined =
    o && typeof o.amount === 'number'
      ? {
          amount: o.amount,
          productName: String(o.productName ?? 'Item'),
          productId: String(o.productId ?? ''),
          status: (st === 'accepted' || st === 'consumed' || st === 'declined' || st === 'countered' ? st : 'pending') as OfferStatus,
        }
      : undefined;
  return {
    id: String(m.id),
    senderId: m.sender,
    text: m.body,
    mine: m.sender === myUsername,
    status: (m.status === 'seen' ? 'seen' : m.status === 'delivered' ? 'delivered' : 'sent') as ThreadMessage['status'],
    ...(offer ? { offer } : {}),
  };
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

function PinIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M16 3l5 5-1.41 1.41L18.17 8 14.9 11.27l.7 4.13-1.41 1.41-3.04-3.04L6.4 18.5 5 17.09l4.73-4.75-3.04-3.04 1.41-1.41 4.13.7L15.5 5.33l-1.41-1.41L16 3z"
      />
    </Svg>
  );
}

type ChatFilter = 'all' | 'unread' | 'offers';

const UNREAD_KEY_BASE = '@susej_chat_unread';
const UNREAD_KEY = UNREAD_KEY_BASE;
const BLOCKED_KEY_BASE = '@susej_blocked';
const BLOCKED_KEY = BLOCKED_KEY_BASE;

function unreadKeyFor(username?: string): string {
  const n = typeof username === 'string' ? username.trim() : '';
  return n ? `${UNREAD_KEY_BASE}:${n}` : UNREAD_KEY_BASE;
}
function blockedKeyFor(username?: string): string {
  const n = typeof username === 'string' ? username.trim() : '';
  return n ? `${BLOCKED_KEY_BASE}:${n}` : BLOCKED_KEY_BASE;
}

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

export default function ChatScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [readChatIds, setReadChatIds] = useState<string[]>([]);
  const [readLoaded, setReadLoaded] = useState(false);
  const [tab, setTab] = useState<TabType>('messages');
  const insets = useSafeAreaInsets();
  const { user, tokenSeq } = useAuth();
  const { communities, joinedCommunities } = useCommunities();
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  // Immersive thread view: hide the bottom tab bar while a DM is open and
  // make Android hardware back close the thread instead of leaving the app.
  useEffect(() => {
    setImmersiveNav(!!activeChat);
    if (!activeChat) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveChat(null);
      return true;
    });
    return () => sub.remove();
  }, [activeChat]);
  useEffect(() => () => setImmersiveNav(false), []);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [serverChats, setServerChats] = useState<ChatItem[]>([]);
  const serverChatsLoaded = useRef<string | null>(null);
  const [composer, setComposer] = useState('');
  const [offerMode, setOfferMode] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [countering, setCountering] = useState<ThreadMessage | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  // Double-tap guard: submitOffer is fire-and-forget, so a rapid second tap
  // used to mint a duplicate offer (two cards, two server rows, two prices).
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerProduct, setOfferProduct] = useState<string | undefined>(undefined);
  const [offerListingId, setOfferListingId] = useState<string | undefined>(undefined);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  // Pinned-chat VAS pricing — admin-editable via the Commission & Fees page.
  const [pinPrice, setPinPrice] = useState(79);
  const [pinDays, setPinDays] = useState(7);

  useEffect(() => {
    // Refresh on every entry so admin price edits land on the next visit.
    resetMarketplaceConfig();
    loadMarketplaceConfig()
      .then(() => {
        setPinPrice(getChatPinPrice());
        setPinDays(getChatPinDays());
      })
      .catch(() => {});
  }, []);

    const params = useLocalSearchParams<{ product?: string | string[]; seller?: string | string[]; to?: string | string[]; msg?: string | string[]; listing?: string | string[] }>();
    const rawProduct = Array.isArray(params.product) ? params.product[0] : params.product;
    const rawSeller = Array.isArray(params.seller) ? params.seller[0] : params.seller;
    const rawTo = Array.isArray(params.to) ? params.to[0] : params.to;
    const rawMsg = Array.isArray(params.msg) ? params.msg[0] : params.msg;
    const rawListing = Array.isArray(params.listing) ? params.listing[0] : params.listing;

  useEffect(() => {
    let cancelled = false;
    const key = unreadKeyFor(user?.username);
    setReadLoaded(false);
    AsyncStorage.getItem(key)
      .then(async (raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) { setReadChatIds(parsed); return; }
          } catch {}
        }
        if (key !== UNREAD_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(UNREAD_KEY_BASE);
          if (!cancelled && legacy) {
            try {
              const p = JSON.parse(legacy);
              if (Array.isArray(p)) { setReadChatIds(p); try { await AsyncStorage.setItem(key, legacy); } catch {} return; }
            } catch {}
          }
        }
        if (!cancelled) setReadChatIds([]);
      })
      .catch(() => { if (!cancelled) setReadChatIds([]); })
      .finally(() => { if (!cancelled) setReadLoaded(true); });
    return () => { cancelled = true; };
  }, [user?.username, tokenSeq]);

  useEffect(() => {
    let cancelled = false;
    const key = blockedKeyFor(user?.username);
    setBlockedLoaded(false);
    AsyncStorage.getItem(key)
      .then(async (raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) { setBlockedUsers(parsed as BlockedUser[]); setBlockedLoaded(true); return; }
          } catch {}
        }
        if (key !== BLOCKED_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(BLOCKED_KEY_BASE);
          if (!cancelled && legacy) {
            try {
              const p = JSON.parse(legacy);
              if (Array.isArray(p)) { setBlockedUsers(p as BlockedUser[]); try { await AsyncStorage.setItem(key, legacy); } catch {} setBlockedLoaded(true); return; }
            } catch {}
          }
        }
        if (!cancelled) { setBlockedUsers([]); setBlockedLoaded(true); }
      })
      .catch(() => { if (!cancelled) { setBlockedUsers([]); setBlockedLoaded(true); } });
    return () => { cancelled = true; };
  }, [user?.username, tokenSeq]);

  useEffect(() => {
    if (!blockedLoaded) return;
    const key = blockedKeyFor(user?.username);
    AsyncStorage.setItem(key, JSON.stringify(blockedUsers)).catch(() => {});
  }, [blockedUsers, blockedLoaded, user?.username]);

  useEffect(() => {
    if (!readLoaded) return;
    const key = unreadKeyFor(user?.username);
    AsyncStorage.setItem(key, JSON.stringify(readChatIds)).catch(() => {});
  }, [readChatIds, readLoaded, user?.username]);

  // Server-backed threads: pull real multi-user conversations (silent offline fallback).
  // Refetches on EVERY tab focus (cheap idempotent GET) so threads appear as soon as
  // the session/token is ready and stay live across devices. Ref is only a guard against
  // duplicate in-flight fetches, not a one-shot latch.
  const fetchServerThreads = () => {
    if (!user?.username) return;
    const guardKey = `${user.username}:${tokenSeq}`;
    if (serverChatsLoaded.current === guardKey) return;
    serverChatsLoaded.current = guardKey;
    serverApi
      .getThreads()
      .then((res) => {
        if (!res.ok || !res.data?.threads) return;
        const items: ChatItem[] = res.data.threads.map((t) => ({
          id: t.id,
          name: t.otherName ?? t.otherUsername ?? 'User',
          username: t.otherUsername,
          time: formatThreadTime(t.lastAt),
          message: t.lastMessage ?? 'Say hello',
          messageWeight: 400,
          status: 'MESSAGE',
          statusBg: colors.surfaceContainerLow,
          statusColor: colors.secondary,
          hasUnread: (t.unread ?? 0) > 0,
          // Server-computed: an inbound pending offer exists in this thread.
          // Powers the Offers filter honestly on every device.
          hasPendingOffer: t.hasPendingOffer === true,
          serverThreadId: t.id,
          pinnedUntil: typeof t.pinnedUntil === 'number' ? t.pinnedUntil : undefined,
        }));
        setServerChats(items);
      })
      .catch(() => {});
  };

  // Refetch whenever the tab regains focus (covers both login->tab and tunnel recovery)
  // AND on every real token acquisition (tokenSeq) so POV re-switches refresh instantly.
  useFocusEffect(
    useCallback(() => {
      if (!user?.username) return;
      // Keep the ref guard for identity changes, but release it after a failed fetch
      // so the next focus retries (offline/tunnel-down windows don't permanently starve it).
      fetchServerThreads();
      const retry = setTimeout(() => {
        serverChatsLoaded.current = null;
        fetchServerThreads();
      }, 8000);
      return () => clearTimeout(retry);
    }, [user?.username, tokenSeq])
  );

  const blockUser = () => {
    if (!activeChat) return;
    if (!activeChat.username) {
      Alert.alert('Cannot block', 'This conversation has no linked account to block.');
      return;
    }
    const username = activeChat.username;
    // Device-local hide (cross-device enforcement needs a server block list
    // that doesn't exist yet — the copy must not promise it). Abuse still
    // reaches the platform through Support → report the conversation there.
    Alert.alert(`Block ${activeChat.name}?`, "Their messages will be hidden on this device. To stop them everywhere, report the chat via Support.", [
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
          Alert.alert('Blocked on this device', 'Their messages are hidden here. Report via Support to stop them everywhere.');
          setActiveChat(null);
        },
      },
    ]);
  };

  const markChatRead = (id: string) => {
    setReadChatIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Pinned-chat VAS (OLX Elite pattern): the SELLER pays to pin this thread at
  // the top of the buyer's inbox. Confirm-first — one tap can never spend.
  // The SERVER owns the debit (atomic debit + pin in one transaction, server
  // price): the client must NOT pre-debit — doing both charged 2x per pin.
  const purchaseChatPin = () => {
    const chat = activeChat;
    if (!chat?.serverThreadId) return;
    Alert.alert(
      'Pin this chat?',
      `${chat.name} will see this conversation at the top of their inbox for ${pinDays} days · ${formatPrice(pinPrice)} from wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay ${formatPrice(pinPrice)}`,
          onPress: async () => {
            const threadId = chat.serverThreadId!;
            const ref = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
            try {
              const res = await serverApi.pinThread(threadId, pinDays, ref);
              if (!res.ok || !res.data?.pinnedUntil) {
                const msg = res.error === 'offline'
                  ? 'Could not reach the server — no money was charged.'
                  : String(res.error || 'The pin could not be saved — no money was charged.');
                Alert.alert('Pin not applied', msg);
                return;
              }
              const until = res.data.pinnedUntil;
              setServerChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, pinnedUntil: until } : c)));
              setActiveChat((cur) => (cur && cur.id === chat.id ? { ...cur, pinnedUntil: until } : cur));
              Alert.alert('Chat pinned', `This conversation stays at the top of ${chat.name}'s inbox for ${pinDays} days.`);
            } catch {
              Alert.alert('Pin not applied', 'Could not reach the server — no money was charged.');
            }
          },
        },
      ]
    );
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
      // Honest neutral state — no fabricated NEGOTIATING/INQUIRY chips.
      status: 'New conversation',
      statusBg: colors.surfaceContainerLow,
      statusColor: colors.secondary,
      hasUnread: false,
      productName: rawProduct,
    };
    setActiveChat(chat);
    setOfferProduct(rawProduct);
    setOfferListingId(rawListing);
    markChatRead(chat.id);
    setOfferMode(false);
    setCountering(null);
    // Resolve the seller's real identity (businessName || name) so the header
    // never shows a raw handle like "user0011" — same preference as the list.
    serverApi
      .getUserProfile(sellerName)
      .then((res) => {
        if (!res.ok || !res.data?.user) return;
        const u = res.data.user;
        const display = (typeof u.businessName === 'string' && u.businessName.trim()) || u.name;
        if (!display) return;
        // Match by id OR username: createThread may already have upgraded the
        // local `seller_*` id to a server cuid, and an id-only guard would
        // silently drop this rename if the thread-upgrade won the race.
        setActiveChat((cur) => {
          if (!cur) return cur;
          const matches =
            cur.id === chat.id ||
            (!!chat.username && !!cur.username && cur.username.toLowerCase() === String(chat.username).toLowerCase());
          return matches ? { ...cur, name: String(display) } : cur;
        });
      })
      .catch(() => {});
    // Prefill the composer — nothing is "sent" until the user actually sends.
    setComposer(
      `Hi ${sellerName}! I'm interested in ${rawProduct ?? 'your item'}. Would you accept an offer?`
    );
    // Industry-standard: a product-page enquiry MUST reach the seller.
    // Upgrade this local thread to a real server thread (same as the `to=`
    // path below) so sendMessage persists instead of staying device-local.
    // Pass the EXACT username from the route (chat.username is a lowercased
    // display derivative and may miss mixed-case handles server-side).
    serverApi
      .createThread(sellerName)
      .then((res) => {
        if (!res.ok || !res.data?.thread) return;
        const threadId = res.data.thread.id as string;
        setActiveChat((cur) =>
          cur
            ? { ...cur, id: threadId, serverThreadId: threadId }
            : cur
        );
      })
      .catch(() => {});
  }, [rawProduct, rawSeller]);

  // Deep link `to=<sellerUsername>`: focus an existing thread for that seller
  // or open a fresh enquiry thread (with optional prefilled `msg`).
  const blockedAlertRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rawTo || !blockedLoaded) return;
    const normalized = rawTo.toLowerCase();
    if (blockedUsers.some((b) => b.username.toLowerCase() === normalized)) {
      // Blocked target: say so (was a silent dead tap — no chat, no message).
      if (blockedAlertRef.current !== normalized) {
        blockedAlertRef.current = normalized;
        Alert.alert('Blocked', 'You blocked this seller. Unblock them from Blocked Users to message again.');
      }
      return;
    }
    const existing = allChats.find((c) => (c.username ?? '').toLowerCase() === normalized);
    if (existing?.serverThreadId) {
      // Real thread exists on the server — open it directly.
      setActiveChat({ ...existing, hasUnread: false });
      setOfferProduct(existing.productName ?? undefined);
      setOfferListingId(undefined);
      markChatRead(existing.id);
      setOfferMode(false);
      setCountering(null);
      serverApi
        .getMessages(existing.serverThreadId)
        .then((res) => {
          if (!res.ok || !res.data?.messages) return;
          setThreadMessages(res.data.messages.map((m) => mapServerMessage(m, user?.username)));
        })
        .catch(() => {});
      return;
    }
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
          // Honest neutral state — no fabricated INQUIRY chip.
          status: 'New conversation',
          statusBg: colors.surfaceContainerLow,
          statusColor: colors.secondary,
          hasUnread: false,
        };
    setActiveChat(chat);
    setOfferProduct(chat.productName ?? undefined);
    setOfferListingId(undefined);
    markChatRead(chat.id);
    setOfferMode(false);
    setCountering(null);
    // Prefer the real identity (businessName || name) over the raw handle —
    // same preference the thread list already applies via otherName.
    serverApi
      .getUserProfile(normalized)
      .then((res) => {
        if (!res.ok || !res.data?.user) return;
        const u = res.data.user;
        const display = (typeof u.businessName === 'string' && u.businessName.trim()) || u.name;
        if (!display) return;
        // Same id-or-username guard as the product path: createThread may
        // have already swapped the local id for a server cuid mid-flight.
        setActiveChat((cur) => {
          if (!cur) return cur;
          const matches =
            cur.id === chat.id ||
            (!!chat.username && !!cur.username && cur.username.toLowerCase() === String(chat.username).toLowerCase());
          return matches ? { ...cur, name: String(display) } : cur;
        });
      })
      .catch(() => {});
    // When logged into the real backend, upgrade the enquiry to a server thread.
    serverApi
      .createThread(normalized)
      .then((res) => {
        if (!res.ok || !res.data?.thread) return;
        const threadId = res.data.thread.id as string;
        setActiveChat((cur) =>
          cur
            ? {
                ...cur,
                id: threadId,
                serverThreadId: threadId,
                status: 'MESSAGE',
                statusBg: colors.surfaceContainerLow,
                statusColor: colors.secondary,
              }
            : cur
        );
      })
      .catch(() => {});
    // Prefill the composer with the deep-link message (or a store enquiry) —
    // nothing is injected into the thread until the user actually sends it.
    setComposer(
      rawMsg && rawMsg.trim() ? rawMsg.trim() : `Hi ${displayName}! I'd like to know more about your store.`
    );
  }, [rawTo, rawMsg, blockedLoaded, blockedUsers]);

  // Late upgrade: a `to=` stub opened before threads loaded swaps to the real
  // server thread once it arrives (createThread dedupes server-side, so this
  // is a display upgrade, never a second thread).
  useEffect(() => {
    if (!rawTo || !activeChat || !activeChat.id.startsWith('seller_')) return;
    const normalized = rawTo.toLowerCase();
    const real = allChats.find(
      (c) => (c.username ?? '').toLowerCase() === normalized && !!c.serverThreadId
    );
    if (real) {
      setActiveChat({ ...real, hasUnread: false });
      markChatRead(real.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTo, serverChats]);

  const q = search.trim().toLowerCase();
  const blockedSet = new Set(blockedUsers.map((b) => b.username.toLowerCase()));
  const allChats = serverChats;
  const blockedCount = allChats.filter((c) => c.username && blockedSet.has(c.username.toLowerCase())).length;
  const nowMs = Date.now();
  const visibleChats = allChats
    .filter((c) => !c.username || !blockedSet.has(c.username.toLowerCase()))
    .map((c) => ({ ...c, hasUnread: c.hasUnread && !readChatIds.includes(c.id) }));
  // Pinned-chat VAS: active paid pins float to the top of the inbox (OLX Elite
  // pattern), most recent pin first; everything else keeps server recency order.
  const filteredChats = visibleChats
    .filter((c) => (filter === 'all' ? true : filter === 'unread' ? c.hasUnread : c.hasPendingOffer === true))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.message.toLowerCase().includes(q))
    .sort((a, b) => {
      const aPin = (a.pinnedUntil ?? 0) > nowMs ? 1 : 0;
      const bPin = (b.pinnedUntil ?? 0) > nowMs ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return 0;
    });

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
    // List threads never carry a real listing id — negotiation stays off until
    // the thread is opened from a product with its listing id.
    setOfferListingId(undefined);
    setOfferMode(false);
    setCountering(null);
    if (chat.serverThreadId) {
      // Real thread: load the server history (offline -> empty thread, local send still works).
      setThreadMessages([]);
      serverApi
        .getMessages(chat.serverThreadId)
        .then((res) => {
          if (!res.ok || !res.data?.messages) return;
          setThreadMessages(res.data.messages.map((m) => mapServerMessage(m, user?.username)));
        })
        .catch(() => {});
      return;
    }
    // No server thread and no history: start the thread honestly EMPTY.
    setThreadMessages([]);
  };

  const sendMessage = () => {
    const text = composer.trim();
    if (!text) return;
    // Unique echo id (timestamp + random): same-ms double-sends used to mint
    // one id for two echoes, and the ack-swap then fused them into one row.
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setThreadMessages((prev) => [...prev, { id, text, mine: true, status: 'sent' }]);
    setComposer('');
    // Real thread: persist to the server (fire-and-forget, offline falls back
    // to local only). No auto-replies — sent messages keep their sent status.
    // Ack-swap: replace the echo with the server row so the next poll can't
    // render the same text twice.
    if (activeChat?.serverThreadId) {
      const tid = activeChat.serverThreadId;
      const who = user?.username;
      serverApi
        .sendMessage(tid, text)
        .then((res) => {
          const msg = (res as { ok?: boolean; data?: { message?: unknown } })?.data?.message;
          if (res.ok && msg) {
            setThreadMessages((prev) => prev.map((m) => (m.id === id ? { ...mapServerMessage(msg, who), mine: true } : m)));
          }
        })
        .catch(() => {});
    } else if (activeChat?.username) {
      // No server thread yet (e.g. product-page enquiry before upgrade
      // completes): create it now so the message reaches the seller instead
      // of staying device-local, then persist this message.
      const uname = activeChat.username;
      serverApi
        .createThread(uname)
        .then((res) => {
          const threadId = res.ok ? (res.data?.thread?.id as string | undefined) : undefined;
          if (!threadId) return;
          setActiveChat((cur) => (cur ? { ...cur, id: threadId, serverThreadId: threadId } : cur));
          return serverApi.sendMessage(threadId, text).then((sent) => {
            // Ack-swap like the main path (twin-kill) — the fallback path
            // never swapped, so every pre-upgrade enquiry rendered twice.
            const msg = (sent as { ok?: boolean; data?: { message?: unknown } })?.data?.message;
            if ((sent as { ok?: boolean })?.ok && msg) {
              const who = user?.username;
              setThreadMessages((prev) => prev.map((m) => (m.id === id ? { ...mapServerMessage(msg, who), mine: true } : m)));
            }
          });
        })
        .catch(() => {});
    }
  };

  // Delivery receipts: local sends stay 'sent' until real server status arrives
  // via getMessages — no simulated delivered/seen timers and no canned
  // auto-replies. Incoming messages only ever come from the real other user.
  // NOTE: no voice-note button is rendered — the mic action is not wired, and
  // a dead "coming soon" tap is a trust violation on a core chat surface.
  // Live incoming path (WhatsApp/IG parity): poll the open thread every 6s so
  // buyer and seller staring at an open thread see each other without a
  // manual back-and-forth. Merges by id — server rows win; acked echoes are
  // id-swapped at send time, and an unsynced offer_ echo is dropped once the
  // server represents the same deal (same side + amount + listing).
  useEffect(() => {
    const threadId = activeChat?.serverThreadId;
    if (!threadId) return;
    let cancelled = false;
    const pull = () => {
      serverApi
        .getMessages(threadId)
        .then((res) => {
          if (cancelled || !res.ok || !res.data?.messages) return;
          const mine = user?.username;
          setThreadMessages((prev) => {
            const server = (res.data as { messages: unknown[] }).messages.map((m) =>
              mapServerMessage(m, mine)
            );
            const serverIds = new Set(server.map((s) => s.id));
            const localOnly = prev.filter((p) => {
              // Fresh server row replaces any local with the same id (kills
              // the ack-race twin where the poll beat the send ack).
              if (serverIds.has(p.id)) return false;
              if (p.id.startsWith('offer_') && p.offer) {
                const represented = server.some(
                  (s) => s.mine && s.offer && s.offer.amount === p.offer!.amount && s.offer.productId === p.offer!.productId
                );
                // Unsynced offer echoes stay (offline/composer state); synced
                // ones drop — the server card renders instead. Never two cards.
                return !represented;
              }
              // Unacked text echoes stay visible (the send may have failed
              // silently); ack-swapped rows carry server ids and drop above.
              if (p.mine && !p.system && !p.offer) return true;
              return false;
            });
            const merged = [...server, ...localOnly];
            if (
              merged.length === prev.length &&
              merged.every(
                (m, i) =>
                  m.id === prev[i]?.id &&
                  m.status === prev[i]?.status &&
                  m.text === prev[i]?.text &&
                  (m.offer?.status ?? null) === (prev[i]?.offer?.status ?? null) &&
                  (m.offer?.amount ?? null) === (prev[i]?.offer?.amount ?? null)
              )
            )
              return prev;
            return merged;
          });
        })
        .catch(() => {});
    };
    const t = setInterval(pull, 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activeChat?.serverThreadId, user?.username]);

  const productName = offerProduct ?? 'Product offer';

  const submitOffer = () => {
    const amount = Number(offerAmount);
    // Offers are anchored to a REAL listing — no product attached, no negotiation.
    // Upper bound matches the server's order-placement clamp (absurd cards rejected).
    if (!offerProduct || !offerListingId) return;
    if (!amount || amount <= 0 || amount > 10000000 || creatingOrder || sendingOffer) return;
    setSendingOffer(true);
    const now = Date.now();
    const offer: ThreadOffer = {
      amount,
      productName,
      productId: offerListingId,
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
    // Sync the offer to the server so the OTHER side sees and can act on it
    // (OLX-style negotiation). Fire-and-forget: the local card already renders.
    // A counter both closes the old offer server-side AND posts the new terms.
    // The in-flight guard releases when the send settles (or after 8s so an
    // offline tap never wedges the composer).
    if (activeChat?.serverThreadId) {
      const tid = activeChat.serverThreadId;
      const who = user?.username;
      const echoId = `offer_${now}`;
      const counteredId = countering?.id && !String(countering.id).startsWith('offer_') ? String(countering.id) : null;
      if (counteredId) {
        // Revert the optimistic 'countered' flip if the server refuses
        // (already-decided/validation) — a false countered card on both sides
        // is a negotiation lie. Guarded to still-countered rows: the 6s poll
        // may have flipped it to accepted meanwhile, which must never be
        // clobbered back to pending.
        const revertCounter = () => {
          setThreadMessages((prev) => prev.map((m) =>
            m.id === counteredId && m.offer && m.offer.status === 'countered'
              ? { ...m, offer: { ...m.offer, status: 'pending' as OfferStatus } }
              : m
          ));
        };
        void serverApi.updateOfferStatus(tid, counteredId, 'countered').then((res) => {
          if (!res.ok) revertCounter();
        }).catch(revertCounter);
      }
      void serverApi
        .sendMessage(
          tid,
          `Offer ${amount} for ${productName}`,
          { amount, productId: offerListingId, productName }
        )
        .then((res) => {
          // Ack-swap the echo for the server row (same twin-kill as texts).
          const msg = (res as { ok?: boolean; data?: { message?: unknown } })?.data?.message;
          if (res.ok && msg) {
            setThreadMessages((prev) => prev.map((m) => (m.id === echoId ? { ...mapServerMessage(msg, who), mine: true } : m)));
          }
        })
        .catch(() => {})
        .finally(() => setSendingOffer(false));
      setTimeout(() => setSendingOffer(false), 8000);
    } else {
      setSendingOffer(false);
    }
    setOfferMode(false);
    setCountering(null);
    setOfferAmount('');
  };

  // Accepted offers NEVER mint orders here (BUYER-C1: the old code created a
  // real order with no address, no payment method, no delivery fee, and a
  // buyer-typed price — a 1-rupee offer became a real row). Accept locks the
  // deal server-side; then the BUYER completes address + payment + fee in
  // checkout, where the offer lock prices the order instead of the listing.
  const handleAccept = async (messageId: string, offer: ThreadOffer) => {
    if (creatingOrder || !activeChat) return;
    if (!activeChat.username) {
      Alert.alert('Cannot accept offer', 'Seller identity missing — reopen this chat from the product page.');
      return;
    }
    // Local-only echoes and missing threads can't lock a deal server-side.
    if (!activeChat.serverThreadId || messageId.startsWith('offer_')) {
      Alert.alert('Still syncing', 'Wait for the offer to sync, then accept.');
      return;
    }
    if (!offer.productId || !Number.isFinite(offer.amount) || offer.amount <= 0) return;
    setCreatingOrder(true);
    try {
      // Accept FIRST so the row can't be double-accepted from another device
      // (409 already-decided / 400 self-accept fail closed with no order).
      const acc = await serverApi
        .updateOfferStatus(activeChat.serverThreadId, messageId, 'accepted')
        .catch(() => null);
      if (!acc || !acc.ok) {
        Alert.alert('Offer unavailable', 'This offer was already decided or could not sync. Refresh the chat.');
        return;
      }
      const markAccepted = (extra?: ThreadMessage) =>
        setThreadMessages((prev) => [
          ...prev.map((m) =>
            m.id === messageId && m.offer
              ? { ...m, offer: { ...m.offer, status: 'accepted' as OfferStatus } }
              : m
          ),
          ...(extra ? [extra] : []),
        ]);
      // Role split: only the BUYER pays. The listing owner is the seller —
      // resolved from the server post (offers carry no owner field). The post
      // type also rides to checkout so service offers carry no delivery fee.
      let owner: string | null = null;
      let postType = '';
      try {
        const pr = await serverApi.getPost(offer.productId);
        const p = (pr.data as { post?: { authorUsername?: unknown; sellerUsername?: unknown; type?: unknown } } | null)?.post;
        owner = String((p as { authorUsername?: unknown } | null)?.authorUsername ?? (p as { sellerUsername?: unknown } | null)?.sellerUsername ?? '') || null;
        postType = String((p as { type?: unknown } | null)?.type ?? '');
      } catch {}
      const me = user?.username ?? '';
      if (owner && me && owner === me) {
        // I'm the seller: deal struck, money moves when the BUYER pays.
        markAccepted({
          id: `deal_${Date.now()}`,
          mine: true,
          system: true,
          text: `Deal accepted at ${formatPrice(offer.amount)} — waiting for buyer payment.`,
        });
        return;
      }
      // I'm the buyer — or fail CLOSED when the role is unresolvable. Routing
      // an unverified identity into checkout turns a seller tapping Accept on
      // their own listing (offline/corrupt post fetch) into a buyer payment
      // for their own item; the server would 400 it only AFTER deep-linking
      // the user into payment. Reconnect and retry instead.
      if (!owner || !me) {
        Alert.alert('Could not verify listing', 'Reconnect and retry — the seller could not be verified.');
        return;
      }
      markAccepted({
        id: `deal_${Date.now()}`,
        mine: true,
        system: true,
        text: `Deal accepted at ${formatPrice(offer.amount)} — complete payment to lock it in.`,
      });
      router.push({
        pathname: '/checkout',
        params: {
          offerListing: offer.productId,
          offerPrice: String(Math.round(offer.amount)),
          offerName: offer.productName,
          offerThread: activeChat.serverThreadId,
          offerMsg: messageId,
          offerSeller: activeChat.username,
          offerSellerName: activeChat.name,
          ...(postType === 'service' || postType === 'food_item' ? { offerType: postType } : {}),
        },
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDecline = (messageId: string) => {
    // Sync the decision so the counterparty's thread updates everywhere
    // (6s poll renders the flipped card; there is no tab-level Offers badge —
    // thread-local state is the propagation path).
    // Revert on server refusal (already-decided/offline): a declined card the
    // server rejected is a decision that never happened.
    const synced = !!activeChat?.serverThreadId && !messageId.startsWith('offer_');
    if (synced) {
      const tid = activeChat!.serverThreadId!;
      // Only mark locally after the server confirms (prevents false-decline
      // twins); the 6s poll renders the flipped card everywhere anyway.
      serverApi.updateOfferStatus(tid, messageId, 'declined').then((res) => {
        if (res.ok) {
          setThreadMessages((prev) => [
            ...prev.map((m) =>
              m.id === messageId && m.offer
                ? { ...m, offer: { ...m.offer, status: 'declined' as OfferStatus } }
                : m
            ),
            { id: `declined_${Date.now()}`, mine: true, system: true, text: 'Offer declined' },
          ]);
        } else {
          Alert.alert('Could not decline', 'This offer was already decided or could not sync. Refresh the chat.');
        }
      }).catch(() => {
        Alert.alert('Could not decline', 'Check your connection — the decision was not recorded.');
      });
      return;
    }
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
            {user?.isSeller && activeChat.serverThreadId && (
              <TouchableOpacity
                className="w-10 h-10 items-center justify-center rounded-figma-full"
                style={{ backgroundColor: colors.surfaceContainerLow }}
                onPress={purchaseChatPin}
              >
                <PinIcon size={18} color={(activeChat.pinnedUntil ?? 0) > Date.now() ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-figma-full"
              style={{ backgroundColor: colors.surfaceContainerLow }}
              onPress={blockUser}
            >
              <BlockIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={{ flex: 1 }}
        >
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
                style={{ backgroundColor: colors.primaryContainer, opacity: creatingOrder || sendingOffer ? 0.5 : 1 }}
                disabled={creatingOrder || sendingOffer}
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

        {/* Composer */}
        <View className="flex-row items-center px-4 pt-3 pb-4" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          {/* Make-an-offer: only when the thread carries a REAL listing to negotiate on */}
          {offerProduct && offerListingId ? (
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
          ) : null}
          <TextInput
            className="flex-1 h-11 px-4 font-inter-400 text-textPrimary"
            style={{ backgroundColor: colors.surfaceContainerLow, borderRadius: 22 }}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            value={composer}
            onChangeText={setComposer}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity className="ml-3 w-11 h-11 bg-primaryContainer rounded-figma-full items-center justify-center" onPress={sendMessage}>
            <SendIcon size={18} color={colors.surfaceContainerLowest} />
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surfaceContainerLowest }}>
      {/* Header - TopAppBar — Figma 1:3387: hamburger, left-aligned susej, bag icon right */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <Text className="font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5 }}>
          susej
        </Text>
        <View className="flex-1" />
      </View>

      {/* Tab Navigation */}
      <View className="h-[49px]" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center h-full" style={{ paddingHorizontal: 20, gap: 24 }}>
          {([
            { key: 'messages', label: 'Messages' },
            { key: 'community', label: 'Community Chats' },
            { key: 'broadcast', label: 'Broadcast' },
          ] as const).map((t) => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}>
              <Text
                className={tab === t.key ? 'font-inter-700' : 'font-inter-500'}
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: tab === t.key ? colors.primary : colors.secondary }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Active tab underline */}
        <View style={{ height: 2, backgroundColor: colors.primaryContainer }} />
      </View>

      <FlatList
        data={tab === 'messages' ? filteredChats : tab === 'community' ? visibleCommunityRows : BROADCAST_CHANNELS.map((c) => ({ id: c.id, name: c.name, message: c.tagline, time: '', status: 'CHANNEL', statusBg: colors.surfaceContainerLow, statusColor: colors.secondary, hasUnread: false, messageWeight: 400 as const }))}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-40"
        ListEmptyComponent={
          <View className="px-8 py-12 items-center">
            <Text className="font-inter-400 text-textSecondary text-center" style={{ fontSize: 14, lineHeight: 20 }}>
              {tab === 'broadcast'
                ? 'No broadcast channels yet. Sellers create channels to announce drops and deals.'
                : tab === 'community'
                ? 'Join communities from the Communities Hub to chat with members'
                : filter === 'unread'
                ? 'No unread chats'
                : filter === 'offers'
                ? 'No offers yet'
                : q
                ? 'No conversations match your search'
                : 'No conversations yet — tap Message on any product to start one'}
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
                placeholder={tab === 'community' ? 'Search communities...' : tab === 'broadcast' ? 'Search broadcast channels...' : 'Search conversations...'}
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
              <TouchableOpacity className="mt-2 self-start" onPress={() => router.push('/blocked')}>
                <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>
                  {blockedCount} blocked conversation{blockedCount > 1 ? 's' : ''} hidden — manage
                </Text>
              </TouchableOpacity>
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
          renderItem={({ item }) => (
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
              } else if (tab === 'community') {
                router.push(`/community/${item.id}`);
              } else {
                router.push(`/broadcast/${item.id}`);
              }
            }}
          >
            {/* Avatar */}
            <View className="mr-4 relative">
              <View className="w-[60px] h-[60px] rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: tab === 'broadcast' ? colors.primaryContainer : colors.secondaryContainer }}>
                {item.username ? (
                  <Image
                    source={resolveAvatar(item.username)}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="font-inter-700" style={{ fontSize: 20, lineHeight: 24, color: tab === 'broadcast' ? colors.surfaceContainerLowest : colors.primary }}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                )}
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
              {/* Status badge + Pinned-chat VAS chip */}
              <View className="flex-row items-center" style={{ gap: 6 }}>
                {(item.pinnedUntil ?? 0) > nowMs && (
                  <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                    <Text style={{ fontSize: 10, lineHeight: 15, letterSpacing: 0.5, fontWeight: '600', color: colors.onPrimary }}>PINNED</Text>
                  </View>
                )}
                <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: item.statusBg }}>
                  <Text style={{ fontSize: 10, lineHeight: 15, letterSpacing: 0.5, fontWeight: '400', color: item.statusColor }}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
