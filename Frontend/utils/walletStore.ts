/**
 * Shared wallet store — single source of truth for the buyer/seller wallet
 * (@susej_wallet). Used by the Wallet screen, Promotions (debit on purchase),
 * Refund detail (credit on refund) and Checkout (wallet payment method).
 *
 * Default state: ₹0 balance + EMPTY history. Every visible rupee comes from
 * real user actions or the server wallet — no seeded demo money.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverApi } from './serverApi';

export const WALLET_KEY = '@susej_wallet';
export const WALLET_KEY_BASE = WALLET_KEY;

async function getWalletKey(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('app_user');
    if (raw) {
      const u = JSON.parse(raw) as { username?: string };
      const name = typeof u?.username === 'string' ? u.username.trim() : '';
      if (name) return `${WALLET_KEY_BASE}:${name}`;
    }
  } catch {}
  return WALLET_KEY_BASE;
}

async function readWalletRaw(key: string): Promise<WalletState | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const maybe = parsed as { balance?: unknown; transactions?: unknown };
      if (typeof maybe.balance === 'number') {
        const list: unknown[] = Array.isArray(maybe.transactions) ? maybe.transactions : [];
        return {
          balance: maybe.balance,
          transactions: list
            .filter(
              (t): t is WalletTx =>
                !!t && typeof t === 'object' && typeof (t as WalletTx).id === 'string'
            )
            .map((t) => ({
              id: t.id,
              title: typeof t.title === 'string' ? t.title : 'Wallet activity',
              detail: typeof t.detail === 'string' ? t.detail : '',
              amount: Number(t.amount) || 0,
              ts: typeof t.ts === 'number' ? t.ts : Date.now(),
            })),
        };
      }
    }
  } catch {}
  return null;
}

export interface WalletTx {
  id: string;
  title: string;
  detail: string;
  amount: number;
  ts: number;
}

export interface WalletState {
  balance: number;
  transactions: WalletTx[];
}

/** Read the wallet; per-user when logged in, otherwise global legacy key. */
export async function getWallet(): Promise<WalletState> {
  const key = await getWalletKey();
  const found = await readWalletRaw(key);
  if (found) return found;
  if (key !== WALLET_KEY_BASE) {
    const legacy = await readWalletRaw(WALLET_KEY_BASE);
    if (legacy) {
      // migrate legacy global once to per-user
      try { await AsyncStorage.setItem(key, JSON.stringify(legacy)); } catch {}
      return legacy;
    }
  }
  return { balance: 0, transactions: [] };
}

export async function saveWallet(state: WalletState): Promise<void> {
  try {
    const key = await getWalletKey();
    await AsyncStorage.setItem(key, JSON.stringify(state));
  } catch {
    // best-effort persistence
  }
}

// NOTE: a client-side debitWallet() used to live here. It was deleted (zero
// callers — the server owns all debits atomically; a client debit lane would
// re-open the chat-pin double-charge class). Timeout discipline for the
// remaining paths: on AMBIGUOUS failure reconcile against server truth by
// unique ref before reverting, never revert blind.

/**
 * Credit the wallet via a TOP-UP (the only client-initiated credit the server accepts).
 * Refunds, referral rewards and settlements are credited SERVER-SIDE only — never
 * from the client (the server rejects non-topup credits with 400).
 * `dedupeByTitle` prevents double-crediting the same event on re-render.
 *
 * NOTE: title MUST contain "top-up" (case-insensitive) or the server rejects it,
 * except the whitelisted local reversal "Promotion refund" which is a debit compensation
 * when promotion creation fails after a successful debit (see promotions.tsx).
 * For server-side credits (refunds/rewards), call the appropriate server API directly.
 */
export async function creditWallet(
  amount: number,
  tx: { title: string; detail: string; dedupeByTitle?: string; ref?: string }
): Promise<WalletState> {
  if (amount <= 0) return getWallet();
  // Guard: client can only credit via top-up. Server rejects everything else.
  // Whitelist: "Promotion refund" is a legitimate reversal of a just-debited promotion
  // purchase where createPromotion failed — treat as top-up for server acceptance.
  if (!/top-up/i.test(tx.title) && !/promotion refund/i.test(tx.title)) {
    throw new Error('Client credits are top-up only. Refunds/rewards are server-side.');
  }
  const state = await getWallet();
  if (tx.dedupeByTitle && state.transactions.some((t) => t.title === tx.dedupeByTitle)) {
    return state;
  }
  const ref = typeof tx.ref === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(tx.ref)
    ? tx.ref
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const detail = `${tx.detail} · ref ${ref}`;
  const next: WalletState = {
    balance: state.balance + amount,
    transactions: [
      { id: `w${Date.now()}`, title: tx.title, detail, amount, ts: Date.now() },
      ...state.transactions,
    ],
  };
  await saveWallet(next);
  const res: any = await serverApi.walletTx(amount, tx.title, detail, 'topup', ref);
  if (res?.ok) {
    const synced: WalletState = {
      balance: Number((res as { balance?: unknown }).balance ?? next.balance),
      transactions: next.transactions,
    };
    await saveWallet(synced);
    return synced;
  }
  // Certain server reject only — transport errors reconcile, never revert
  // (a lost response after commit must not roll back local truth while the
  // server keeps the money).
  if (res?.error !== 'offline' && res?.error !== 'server-unreachable') {
    const cur = await getWallet();
    if (cur.balance === next.balance) await saveWallet(state);
    // Preserve the server's reason (e.g. top-ups disabled in production) so
    // callers can show honest copy instead of blaming the connection.
    const reason = typeof res?.error === 'string' && res.error ? res.error : 'Wallet credit failed - server did not persist';
    throw new Error(reason);
  }
  // AMBIGUOUS (timeout/offline/server-down after send): a top-up may already have minted
  // server-side — retrying blind would double-mint free money. Reconcile by
  // our unique ref; only revert + throw when the server proves it didn't land.
  try {
    if (await syncWalletFromServer()) {
      const after = await getWallet();
      if (after.transactions.some((t) => t.amount === amount && t.detail.includes(ref))) {
        return after;
      }
    }
  } catch {}
  const cur = await getWallet();
  if (cur.balance === next.balance) await saveWallet(state);
  throw new Error('Wallet credit failed - server did not persist');
}

/**
 * Pull the real server wallet for the logged-in user. SERVER TRUTH WINS:
 * when the server returns rows they REPLACE the local list (this also purges
 * any legacy demo rows that may still sit in storage). Local rows are kept
 * only while the server has none yet (offline-created activity).
 * Returns true when the server responded.
 */
export async function syncWalletFromServer(): Promise<boolean> {
  const res = await serverApi.getWallet();
  if (!res.ok || !res.data) return false;
  const serverTxs: WalletTx[] = (res.data.transactions ?? []).map((t: any) => ({
    id: String(t.id ?? `st${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    title: String(t.title ?? 'Wallet activity'),
    detail: String(t.detail ?? ''),
    amount: Number(t.amount ?? 0),
    ts: typeof t.ts === 'string' ? Date.parse(t.ts) : Number(t.ts ?? Date.now()),
  }));
  const local = await getWallet();
  const next: WalletState =
    serverTxs.length > 0
      ? { balance: Number(res.data.balance ?? local.balance), transactions: serverTxs }
      : {
          balance: Number(res.data.balance ?? local.balance),
          // server empty → keep only real locally-created rows
          transactions: local.transactions,
        };
  await saveWallet(next);
  return true;
}

export async function clearWalletCache(): Promise<void> {
  try {
    const key = await getWalletKey();
    await AsyncStorage.removeItem(key);
    if (key !== WALLET_KEY_BASE) await AsyncStorage.removeItem(WALLET_KEY_BASE);
  } catch {}
}