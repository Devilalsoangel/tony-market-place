import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CloseIcon } from '../utils/icons';
import { colors, formatPrice, shadows } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { useOrders } from '../contexts/OrderContext';
import { loadMarketplaceConfig, sellerNetForOrders, sellerGoodsForOrders, isApprovedSeller } from '../utils/marketplace';
import { getWallet, saveWallet, syncWalletFromServer, type WalletTx } from '../utils/walletStore';
import { getWithdrawalStatuses } from '../utils/adminSync';

const WITHDRAWALS_KEY_BASE = '@susej_withdrawals';

const AMOUNT_PRESETS = [100, 500, 1000];

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  requestedAt: number;
  respondedAt?: string;
}

const DAY = 86400000;
const HOUR = 3600000;

type Transaction = WalletTx;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatTxDate = (ts: number): string => {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  const time = new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type ListRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'tx'; key: string; tx: Transaction };

const groupTransactions = (items: Transaction[]): ListRow[] => {
  const sorted = [...items].sort((a, b) => b.ts - a.ts);
  const todayStart = startOfDay(Date.now());
  const yesterdayStart = todayStart - DAY;
  const rows: ListRow[] = [];
  let lastGroup: string | null = null;
  for (const tx of sorted) {
    const group = tx.ts >= todayStart ? 'Today' : tx.ts >= yesterdayStart ? 'Yesterday' : 'Earlier';
    if (lastGroup !== group) {
      rows.push({ kind: 'section', key: `s:${group}`, title: group });
      lastGroup = group;
    }
    rows.push({ kind: 'tx', key: tx.id, tx });
  }
  return rows;
};

function WalletPathIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6a2 2 0 012-2h12v2H5v12h16V8a2 2 0 00-2-2h-1V4h1a4 4 0 014 4v8a4 4 0 01-4 4H5a2 2 0 01-2-2V6z" fill={color} />
      <Path d="M15 12a1 1 0 011-1h3v2h-3a1 1 0 01-1-1z" fill={color} />
    </Svg>
  );
}

// Neutral per-type transaction icons — no human faces on wallet activity.
function ArrowDownCircleIcon({ size = 22, color = colors.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.8" />
      <Path d="M12 7.5v8m0 0l3.4-3.4M12 15.5l-3.4-3.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowUpCircleIcon({ size = 22, color = colors.error }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.8" />
      <Path d="M12 16.5v-8m0 0l3.4 3.4M12 8.5l-3.4 3.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiptIcon({ size = 18, color = colors.primaryContainer }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3.5h14v16.2c0 .6-.7.95-1.2.58L15.5 18.6l-2.3 1.72a2 2 0 01-2.4 0L8.5 18.6l-2.3 1.68A.75.75 0 015 19.7V3.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

// Order / promotion activity gets a receipt mark; everything else is a plain
// credit (arrow down, green) or debit (arrow up, error red) direction icon.
const isReceiptTx = (t: Transaction) => /order|promo/i.test(t.title);

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders } = useOrders();
  const [loaded, setLoaded] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [preset, setPreset] = useState<number | null>(500);
  const [custom, setCustom] = useState('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [showPayout, setShowPayout] = useState(false);
  // In-flight payout guard (SELLER-C4): double-tap used to fire two PUTs =
  // two debits. The button disables while submitting AND the server dedupes
  // same-amount requests inside 60s — either layer alone stops it.
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
  const [payoutVpa, setPayoutVpa] = useState('');
  // UPI destination: explicit VPA per request — a phone number is NOT a VPA
  // (handles change, non-UPI phones exist). Bank goes to the KYC-verified
  // account on file, chosen server-side, never typed here.
  // Live payout fee from the admin panel (falls back to local constants).
  // (No commission-rate state: the headline shows the blended settled rate,
  // and all math routes through the shared sellerNetForOrders legs.)
  const [payoutFee, setPayoutFee] = useState(20);

  useEffect(() => {
    loadMarketplaceConfig().then((c) => {
      setPayoutFee(c.payoutFee);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    getWallet()
      .then((state) => {
        if (cancelled) return;
        setBalance(state.balance);
        setTransactions(state.transactions);
        setLoaded(true);
        syncWalletFromServer().then((synced) => {
          if (cancelled || !synced) return;
          getWallet().then((fresh) => {
            if (cancelled) return;
            setBalance(fresh.balance);
            setTransactions(fresh.transactions);
          });
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user?.username]);

  useEffect(() => {
    const key = user?.username ? `${WITHDRAWALS_KEY_BASE}:${user.username}` : WITHDRAWALS_KEY_BASE;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((data) => {
        if (cancelled) return;
        if (!data) { setWithdrawals([]); return; }
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            setWithdrawals(parsed.filter((w: any) => w && typeof w.id === 'string' && typeof w.amount === 'number'));
          } else {
            setWithdrawals([]);
          }
        } catch {
          if (!cancelled) setWithdrawals([]);
        }
      })
      .catch(() => { if (!cancelled) setWithdrawals([]); });
    return () => { cancelled = true; };
  }, [user?.username]);

  // Payout verdicts (industry payout flow): the app submits, the admin desk
  // decides (requested → approved/rejected → completed), the app reflects the
  // outcome. On rejection the desk refunds the debit server-side, so we pull
  // the fresh wallet balance too — money never silently disappears.
  useEffect(() => {
    if (!loaded || !user?.username) return;
    let cancelled = false;
    const poll = async () => {
      const serverRows = await getWithdrawalStatuses();
      if (cancelled || !serverRows) return;
      setWithdrawals((prev) => {
        const byId = new Map(serverRows.map((w) => [w.id, w]));
        let changed = false;
        let refundLanded = false;
        const next = prev.map((w) => {
          const s = byId.get(w.id);
          if (!s || s.status === w.status) return w;
          changed = true;
          if (s.status === 'rejected') refundLanded = true;
          return {
            ...w,
            status: s.status as WithdrawalRequest['status'],
            respondedAt: s.respondedAt ?? undefined,
          };
        });
        if (refundLanded) {
          void syncWalletFromServer().then((ok) => {
            if (!ok || cancelled) return;
            getWallet().then((fresh) => {
              if (cancelled) return;
              setBalance(fresh.balance);
              setTransactions(fresh.transactions);
            });
          });
        }
        return changed ? next : prev;
      });
    };
    poll();
    const timer = setInterval(poll, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [loaded, user?.username]);

  useEffect(() => {
    if (!loaded) return;
    saveWallet({ balance, transactions }).catch(() => {});
  }, [balance, transactions, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const key = user?.username ? `${WITHDRAWALS_KEY_BASE}:${user.username}` : WITHDRAWALS_KEY_BASE;
    AsyncStorage.setItem(key, JSON.stringify(withdrawals)).catch(() => {});
  }, [withdrawals, loaded, user?.username]);

  const confirmAdd = async () => {
    const amount = Math.round(preset ?? Number(custom));
    if (!amount || amount <= 0) return;
    setShowAdd(false);
    setCustom('');
    // Single guarded path (reconcile-on-ambiguous, server-truth balance):
    // the old inline walletTx + local-mint fallback could fabricate a credit
    // the server never saw. creditWallet is the only client top-up writer.
    try {
      const w = await import('../utils/walletStore');
      const ref = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
      const updated = await w.creditWallet(amount, { title: 'Wallet top-up', detail: 'Added via susej Wallet', ref });
      setBalance(updated.balance);
      setTransactions(updated.transactions);
    } catch (e) {
      // Honest failure copy: a certain server reject (e.g. top-ups disabled
      // in production — no gateway rail exists yet) is NOT a connection
      // problem and must never blame the user's internet. Transport failures
      // keep the connection copy via transportMessage at the call sites.
      const msg = e instanceof Error ? e.message : '';
      if (/disabled in production|payment gateway/i.test(msg)) {
        Alert.alert('Adding money is unavailable', 'Online top-ups are not live yet — a payment partner is still being connected. Your earnings, refunds, and rewards still land in this wallet.');
      } else {
        Alert.alert('Top-up failed', msg || 'Could not add money. Check your connection and try again.');
      }
    }
  };

  const rows = useMemo(() => groupTransactions(transactions), [transactions]);

  // Seller earnings from the seller's own delivered orders (real order data).
  // Case-insensitive like every other seller surface (server keeps exact casing).
  const sellerOrders = useMemo(() => {
    const me = (user?.username ?? '').trim().toLowerCase();
    if (!me) return [];
    return orders.filter((o) => (o.sellerUsername ?? '').toLowerCase() === me);
  }, [orders, user]);
  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  // Goods-only net, EXACTLY like the server credits it: sum(items price×qty)
  // per delivered order, commission on merchandise (never the delivery float
  // — the old chargedTotal basis let sellers withdraw money never credited).
  // Single shared definitions (no inline second formula to drift).
  const goodsTotal = (list: typeof sellerOrders) => sellerGoodsForOrders(list);
  // Single net definition everywhere (hub + dashboard + seller-orders +
  // wallet): per-line settled legs (category overrides at sale time), legacy
  // fallback to live rate. Delivered-only is inside the shared fn. The old
  // goods×flatRate recompute diverged whenever an override existed — sellers
  // saw different earnings on the same orders.
  const earningsTotal = goodsTotal(sellerOrders);
  const earningsMonth = goodsTotal(sellerOrders.filter((o) => o.placedAt >= monthStart));
  const netEarnings = sellerNetForOrders(sellerOrders);
  // 7-day settlement hold (mirrors the server payout guard exactly): delivered
  // legs unlock 7 days after actualDelivery (return window). Missing stamp =
  // UNMATURED (still settling) — counting it as matured let a seller tap Mark
  // Delivered and withdraw the same second, bypassing the hold entirely.
  const HOLD_MS = 7 * 24 * 3600 * 1000;
  // Maturity matches the server payout guard exactly: a missing stamp means
  // pre-hold-era = matured (every deliver path stamps new rows server-side,
  // so unstamped can only be legacy). Unparseable garbage stays unmatured
  // (fail-closed, distinct from legacy-empty).
  const isMatured = (o: { actualDelivery?: string }) => {
    const raw = String(o.actualDelivery ?? '');
    if (!raw) return true;
    const s = Date.parse(raw);
    return Number.isFinite(s) && Date.now() - s >= HOLD_MS;
  };
  const maturedOrders = sellerOrders.filter((o) => isMatured(o));
  // Frozen-under-dispute legs unlock on ruling, never before (server excludes
  // them from lifetimeNet — the client gate must too, or the button enables
  // and the server 400s). Only MATURED-frozen is subtracted from maturedNet:
  // unmatured-frozen was never inside it (subtracting all frozen understated
  // withdrawable by the unmatured slice).
  const frozenOrders = sellerOrders.filter((o) => o.status === 'delivered' && (o as { disputeFrozen?: boolean }).disputeFrozen === true);
  const frozenNet = sellerNetForOrders(frozenOrders);
  const frozenMaturedNet = sellerNetForOrders(frozenOrders.filter((o) => isMatured(o)));
  const maturedNet = Math.max(0, sellerNetForOrders(maturedOrders) - frozenMaturedNet);
  const settlingNet = Math.max(0, netEarnings - maturedNet - frozenNet);
  // Next unlock date ("available on"): the earliest settling leg's unlock day.
  const nextUnlock = (() => {
    let earliest = Infinity;
    for (const o of sellerOrders) {
      if (o.status !== 'delivered' || o.paymentStatus === 'refunded' || (o as { disputeFrozen?: boolean }).disputeFrozen === true) continue;
      const s = Date.parse((o.actualDelivery ?? '') as string);
      if (!Number.isFinite(s)) continue;
      const unlock = s + HOLD_MS;
      if (unlock > Date.now() && unlock < earliest) earliest = unlock;
    }
    return Number.isFinite(earliest) ? new Date(earliest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
  })();
  // Withdrawable = lifetime settled net MINUS already-committed payouts
  // (requested/approved/completed), mirroring the server earnings guard.
  // Committed in TOTAL-DEBIT terms (amount + fee): the gate below compares
  // balance against amount+fee, so committing amount-only let two sequential
  // max-withdrawals both pass while the second dies on balance.
  const committedPayouts = withdrawals
    .filter((w) => w.status === 'requested' || w.status === 'approved' || w.status === 'completed')
    .reduce((s, w) => s + Math.max(0, Math.round(Number(w.amount) || 0)) + payoutFee, 0);
  const withdrawableEarnings = Math.max(0, maturedNet - committedPayouts);
  // Display commission = goods − settled net (matches the shared fn exactly).
  const commissionTotal = Math.max(0, earningsTotal - netEarnings);
  const submitPayout = async () => {
    if (payoutBusy) return;
    const amount = Math.round(Number(payoutAmount));
    if (!amount || amount < 100 || amount > withdrawableEarnings) {
      if (amount && amount < 100) Alert.alert('Minimum payout', `Minimum withdrawal is ${formatPrice(100)}.`);
      else if (amount > withdrawableEarnings) Alert.alert('Exceeds withdrawable earnings', `You can withdraw up to ${formatPrice(withdrawableEarnings)} (delivered earnings minus pending payouts).`);
      return;
    }
    setPayoutBusy(true);
    try {
    const totalDebit = amount + payoutFee;
    if (balance < totalDebit) {
      Alert.alert('Insufficient wallet balance', `Need ${formatPrice(totalDebit)} (incl. ${formatPrice(payoutFee)} fee) but you have ${formatPrice(balance)}.`);
      return;
    }
    // Single transactional server call: debit (amount + fee) + desk row commit
    // atomically — no two-phase client orchestration that can strand a debit.
    // The chosen rail travels so the desk pays the right destination; UPI
    // carries an explicit VPA (validated here AND server-side), bank resolves
    // to the KYC-verified account on file server-side.
    const vpa = payoutVpa.trim();
    if (payoutMethod === 'upi' && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(vpa)) {
      Alert.alert('Invalid UPI ID', 'Enter your UPI ID in name@bank format (e.g. name@okhdfc).');
      return;
    }
    const mod = await import('../utils/serverApi');
    // Sticky idempotency key (promo-checkoutRef pattern): a FRESH ref per tap
    // made every timeout-retry a NEW deterministic server title — i.e. a
    // second full debit for the same intent. The ref persists per INTENT
    // (amount+method+destination) until the server acks; retries reuse it so
    // the server dedupes instead of double-debiting. TTL 24h bounds orphans.
    // Per-intent slots (not one global): switching intents mid-flight must
    // not overwrite (or resurrect) another intent's ref.
    const destKey = payoutMethod === 'upi' ? vpa : 'bank';
    const PAYOUT_REF_KEY = `@susej_payout_ref:${amount}:${payoutMethod}:${destKey}`;
    let payoutRef: string | null = null;
    try {
      const raw = await AsyncStorage.getItem(PAYOUT_REF_KEY);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p.ref === 'string' && typeof p.at === 'number' && Date.now() - p.at < 24 * 3600 * 1000) {
            payoutRef = p.ref;
          }
        } catch {}
      }
    } catch {}
    if (!payoutRef) {
      payoutRef = `po-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      try {
        await AsyncStorage.setItem(PAYOUT_REF_KEY, JSON.stringify({ ref: payoutRef, at: Date.now() }));
      } catch {}
    }
    const res = await mod.serverApi.requestPayout(amount, payoutMethod, payoutRef, payoutMethod === 'upi' ? vpa : undefined).catch(() => null);
    if (!res?.ok || !res.data?.withdrawalId) {
      Alert.alert('Withdrawal failed', res?.error || 'Could not submit payout. Check your connection and try again. Safe to retry — the same attempt can never debit twice.');
      // Re-sync so the UI reflects server truth (the debit never happened on
      // failure — the transaction rolled back).
      void syncWalletFromServer().then(() => getWallet().then((fresh) => { setBalance(fresh.balance); setTransactions(fresh.transactions); }));
      return;
    }
    // Acked: the intent settled, the ref must never be reused.
    try { await AsyncStorage.removeItem(PAYOUT_REF_KEY); } catch {}
    // Optimistic local mirror, then authoritative re-sync.
    const now = Date.now();
    const req: WithdrawalRequest = {
      id: res.data.withdrawalId,
      amount,
      status: 'requested',
      requestedAt: now,
    };
    setWithdrawals((prev) => [req, ...prev]);
    void syncWalletFromServer().then((ok) => {
      if (!ok) return;
      getWallet().then((fresh) => { setBalance(fresh.balance); setTransactions(fresh.transactions); });
    });
    setShowPayout(false);
    setPayoutAmount('');
    setPayoutVpa('');
    Alert.alert(
      'Withdrawal requested',
      payoutMethod === 'upi'
        ? `${formatPrice(amount)} to ${vpa} (${req.id}) is submitted. The platform team reviews it — you'll see the status here.`
        : `${formatPrice(amount)} to your verified bank account on file (${req.id}) is submitted. The platform team reviews it — you'll see the status here.`,
      [{ text: 'OK' }]
    );
    } finally {
      setPayoutBusy(false);
    }
  };

  const PAYOUT_CHIP: Record<WithdrawalRequest['status'], { label: string; bg: string; fg: string }> = {
    requested: { label: 'Requested', bg: colors.primaryFixed, fg: colors.primary },
    approved: { label: 'Approved', bg: colors.tertiaryContainer, fg: colors.tertiary },
    rejected: { label: 'Rejected', bg: colors.errorContainer, fg: colors.error },
    completed: { label: 'Completed', bg: colors.successBg, fg: colors.success },
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const credit = item.amount > 0;
    return (
      <View className="flex-row items-center px-5 py-3">
        <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
          {isReceiptTx(item) ? (
            <ReceiptIcon size={18} color={credit ? colors.success : colors.error} />
          ) : credit ? (
            <ArrowDownCircleIcon size={22} color={colors.success} />
          ) : (
            <ArrowUpCircleIcon size={22} color={colors.error} />
          )}
        </View>
        <View className="flex-1 pr-3">
          <Text className="font-inter-600" numberOfLines={1} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}>
            {item.title}
          </Text>
          <Text className="font-inter-400 mt-0.5" numberOfLines={1} style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
            {item.detail}
          </Text>
          <Text className="font-inter-400 mt-0.5" style={{ fontSize: 11, lineHeight: 12, color: colors.textTertiary }}>
            {formatTxDate(item.ts)}
          </Text>
        </View>
        <Text className="font-inter-700" style={{ fontSize: 15, lineHeight: 20, color: credit ? colors.success : colors.textPrimary }}>
          {credit ? `+${formatPrice(item.amount)}` : `-${formatPrice(Math.abs(item.amount))}`}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <BackIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.textPrimary }}>
          Wallet
        </Text>
        <WalletPathIcon size={20} color={colors.primary} />
      </View>

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Loading wallet…
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerClassName="pb-24"
          ListHeaderComponent={
            <View className="px-5 pt-2 pb-4">
              <View style={{ borderRadius: 24, backgroundColor: colors.primaryContainer, padding: 24, ...shadows.card }}>
                <View className="flex-row items-center gap-2">
                  <WalletPathIcon size={18} color={colors.onPrimary} />
                  <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                    susej Wallet
                  </Text>
                </View>
                <Text className="font-inter-700 mt-3" style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.onPrimary }}>
                  {formatPrice(balance)}
                </Text>
                <TouchableOpacity
                  className="mt-5 h-12 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.onPrimary }}
                  onPress={() => setShowAdd(true)}
                >
                  <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.primary }}>
                    Add Money
                  </Text>
                </TouchableOpacity>
              </View>

              {isApprovedSeller(user) && (
                <View className="mt-4" style={{ borderRadius: 24, backgroundColor: colors.inverseSurface, padding: 20 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.inverseOnSurface }}>
                      Seller Earnings
                    </Text>
                    <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.7 }}>
                      {formatPrice(earningsMonth)} this month
                    </Text>
                  </View>
                  <Text className="font-inter-700 mt-2" style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.4, color: colors.inverseOnSurface }}>
                    {formatPrice(netEarnings)}
                  </Text>
                  <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface, opacity: 0.7 }}>
                    Goods {formatPrice(earningsTotal)} · −{formatPrice(commissionTotal)} susej commission (blended rate incl. category offers)
                  </Text>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.55 }}>
                    From {sellerOrders.filter((o) => o.status === 'delivered' && (o as { paymentStatus?: string }).paymentStatus !== 'refunded').length} delivered order{sellerOrders.filter((o) => o.status === 'delivered' && (o as { paymentStatus?: string }).paymentStatus !== 'refunded').length === 1 ? '' : 's'}
                  </Text>
                  {settlingNet > 0 ? (
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.8 }}>
                      {formatPrice(settlingNet)} settling — withdrawable 7 days after delivery
                    </Text>
                  ) : null}
                  {frozenNet > 0 ? (
                    <Text className="font-inter-500 mt-1" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface, opacity: 0.8 }}>
                      {formatPrice(frozenNet)} frozen under dispute — unlocks on ruling
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    className="mt-4 h-11 items-center justify-center"
                    style={{ borderRadius: 12, backgroundColor: colors.inverseOnSurface }}
                    disabled={withdrawableEarnings <= 0}
                    onPress={() => setShowPayout(true)}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.inverseSurface }}>
                      Withdraw to bank
                    </Text>
                  </TouchableOpacity>
                  {withdrawals.length > 0 && (
                    <View className="mt-4">
                      <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.3, color: colors.inverseOnSurface, opacity: 0.7 }}>
                        PAYOUT REQUESTS
                      </Text>
                      {withdrawals.slice(0, 4).map((w) => {
                        const chip = PAYOUT_CHIP[w.status];
                        return (
                          <View key={w.id} className="flex-row items-center mt-2">
                            <Text className="font-inter-500 flex-1" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface }}>
                              {w.id}
                            </Text>
                            <Text className="font-inter-500 mr-2" style={{ fontSize: 12, lineHeight: 16, color: colors.inverseOnSurface }}>
                              {formatPrice(w.amount)}
                            </Text>
                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: chip.bg }}>
                              <Text className="font-inter-600" style={{ fontSize: 9, lineHeight: 12, color: chip.fg }}>
                                {chip.label}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <Text className="font-inter-700 mt-6 mb-2" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                Transactions
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'section' ? (
              <Text
                className="font-inter-600 px-5 pt-3 pb-1"
                style={{ fontSize: 13, lineHeight: 16, letterSpacing: 0.26, color: colors.textTertiary }}
              >
                {item.title}
              </Text>
            ) : (
              renderTransaction({ item: item.tx })
            )
          }
          ListEmptyComponent={
            <View className="items-center py-20 px-8">
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                <WalletPathIcon size={22} color={colors.textSecondary} />
              </View>
              <Text className="font-inter-600 mt-4 text-center" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                No transactions yet
              </Text>
              <Text className="font-inter-400 mt-1 text-center" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                Add money or shop with susej to see your activity here.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
            <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setShowAdd(false)} />
            <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
              </View>
              <View className="flex-row items-center px-5 pt-3 pb-2">
                <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                  Add Money
                </Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <CloseIcon size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="px-5 pb-4">
                <View className="flex-row" style={{ gap: 8 }}>
                  {AMOUNT_PRESETS.map((amt) => {
                    const active = preset === amt;
                    return (
                      <TouchableOpacity
                        key={amt}
                        className="flex-1 items-center py-3"
                        style={{ borderRadius: 16, backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                        onPress={() => {
                          setPreset(amt);
                          setCustom('');
                        }}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: active ? colors.onPrimary : colors.textPrimary }}>
                          {formatPrice(amt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="mt-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput
                    className="px-4 h-14 font-inter-500"
                    placeholder="Custom amount"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}
                    value={custom}
                    onChangeText={(text) => {
                      setCustom(text.replace(/[^0-9]/g, ''));
                      if (text) setPreset(null);
                    }}
                  />
                </View>
                <TouchableOpacity
                  className="mt-4 h-14 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                  onPress={confirmAdd}
                >
                  <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPayout} transparent animationType="slide" onRequestClose={() => setShowPayout(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
            <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setShowPayout(false)} />
            <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
              </View>
              <View className="flex-row items-center px-5 pt-3 pb-2">
                <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 28, color: colors.textPrimary }}>
                  Withdraw to bank
                </Text>
                <TouchableOpacity onPress={() => setShowPayout(false)}>
                  <CloseIcon size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="px-5 pb-6">
                <View className="flex-row" style={{ gap: 8 }}>
                  {(['bank','upi'] as const).map((m) => {
                    const active = payoutMethod === m;
                    return (
                      <TouchableOpacity key={m} onPress={() => setPayoutMethod(m)} className="flex-1 h-11 items-center justify-center" style={{ borderRadius: 12, backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer, borderWidth: 1, borderColor: active ? colors.primaryContainer : colors.outlineVariant }}>
                        <Text className="font-inter-600" style={{ fontSize: 13, color: active ? colors.onPrimary : colors.textPrimary }}>{m === 'bank' ? 'Bank Transfer' : 'UPI'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="mt-3 px-4 py-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Transfer to {payoutMethod === 'bank' ? 'Bank account' : 'UPI ID'} · {payoutMethod === 'bank' ? '1-2 business days' : 'After approval, usually same day'}
                  </Text>
                  <Text className="font-inter-600 mt-0.5" style={{ fontSize: 13, lineHeight: 18, color: colors.textPrimary }}>
                    {payoutMethod === 'bank' ? 'Business KYC account on file — request fails honestly if none is verified (use UPI if unsure)' : 'Paid to the UPI ID you enter below'}
                  </Text>
                  <Text className="font-inter-400 mt-1.5" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                    Withdrawable {formatPrice(withdrawableEarnings)}{settlingNet > 0 ? ` · ${formatPrice(settlingNet)} settling${nextUnlock ? ` (next unlocks ${nextUnlock})` : ''}` : ''}{frozenNet > 0 ? ` · ${formatPrice(frozenNet)} frozen under dispute` : ''}
                  </Text>
                </View>
                {payoutMethod === 'upi' ? (
                  <View className="mt-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                    <TextInput
                      className="px-4 h-14 font-inter-500"
                      placeholder="UPI ID (name@bank)"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}
                      value={payoutVpa}
                      onChangeText={setPayoutVpa}
                    />
                  </View>
                ) : null}
                <View className="mt-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                  <TextInput
                    className="px-4 h-14 font-inter-500"
                    placeholder={`Amount (max ${formatPrice(withdrawableEarnings)} · min ${formatPrice(100)})`}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={{ fontSize: 15, lineHeight: 20, color: colors.textPrimary }}
                    value={payoutAmount}
                    onChangeText={(text) => setPayoutAmount(text.replace(/[^0-9]/g, ''))}
                  />
                </View>
                {payoutAmount ? (
                  <View className="mt-3 px-4 py-3" style={{ borderRadius: 12, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant }}>
                    <View className="flex-row justify-between">
                      <Text className="font-inter-400" style={{ fontSize: 12, color: colors.textSecondary }}>Payout amount</Text>
                      <Text className="font-inter-500" style={{ fontSize: 12, color: colors.textPrimary }}>{formatPrice(Number(payoutAmount) || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="font-inter-400" style={{ fontSize: 12, color: colors.textSecondary }}>Platform fee</Text>
                      <Text className="font-inter-500" style={{ fontSize: 12, color: colors.textPrimary }}>{formatPrice(payoutFee)}</Text>
                    </View>
                    <View className="h-px my-2" style={{ backgroundColor: colors.outlineVariant }} />
                    <View className="flex-row justify-between">
                      <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textPrimary }}>Total debit from wallet</Text>
                      <Text className="font-inter-700" style={{ fontSize: 13, color: colors.primary }}>{formatPrice((Number(payoutAmount) || 0) + payoutFee)}</Text>
                    </View>
                    <Text className="font-inter-400 mt-2" style={{ fontSize: 11, lineHeight: 14, color: colors.textTertiary }}>Estimated arrival: {payoutMethod === 'bank' ? '1-2 business days · 9am-6pm IST' : 'After approval, usually same day'} · Fee deducted at source. Requests are manually reviewed.</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  className="mt-4 h-14 items-center justify-center"
                  style={{ borderRadius: 16, backgroundColor: colors.primaryContainer, opacity: payoutBusy ? 0.4 : payoutAmount && Number(payoutAmount) >= 100 && Number(payoutAmount) <= withdrawableEarnings && (Number(payoutAmount) + payoutFee) <= balance ? 1 : 0.4 }}
                  disabled={payoutBusy || !payoutAmount || (payoutMethod === 'upi' && !payoutVpa.trim()) || Number(payoutAmount) < 100 || Number(payoutAmount) > withdrawableEarnings || (Number(payoutAmount) + payoutFee) > balance}
                  onPress={submitPayout}
                >
                  <Text className="font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.onPrimary }}>
                    {payoutBusy ? 'Submitting…' : `Request payout ${payoutAmount ? `· ${formatPrice(Number(payoutAmount) + payoutFee)} debit` : ''}`}
                  </Text>
                </TouchableOpacity>
                <Text className="font-inter-400 mt-2 text-center" style={{ fontSize: 11, lineHeight: 15, color: colors.textTertiary }}>
                  Minimum {formatPrice(100)} · Requests are reviewed by the platform. Status appears on your Seller Earnings card. {Number(payoutAmount) + payoutFee > balance ? `Need ${formatPrice((Number(payoutAmount) || 0) + payoutFee)} in wallet.` : ''}
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
