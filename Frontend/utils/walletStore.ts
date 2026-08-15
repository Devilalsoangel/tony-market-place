/**
 * Shared wallet store — single source of truth for the buyer/seller wallet
 * (@susej_wallet). Used by the Wallet screen, Promotions (debit on purchase),
 * Refund detail (credit on refund) and Checkout (wallet payment method).
 *
 * Default state: ₹500 balance + demo history (matches the Wallet screen's
 * previous seed) so the same balance is visible everywhere from first boot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const WALLET_KEY = '@susej_wallet';

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

export const WALLET_SEED_BALANCE = 500;

const DAY = 86400000;
const HOUR = 3600000;

export const SEED_TRANSACTIONS: WalletTx[] = [
  { id: 't1', title: 'Payment to Luxe Thread Co', detail: 'Order #SJ-102938 · Handmade ceramic pot set', amount: -2499, ts: Date.now() - 25 * 60000 },
  { id: 't2', title: 'Food order · Artisan Burger Loft', detail: 'Delivered · Classic smash burger + fries', amount: -349, ts: Date.now() - 2 * HOUR },
  { id: 't3', title: 'Wallet top-up', detail: 'UPI · HDFC Bank •••• 4521', amount: 2000, ts: Date.now() - 4 * HOUR },
  { id: 't4', title: 'Payment to TechVault', detail: 'Order #SJ-102731 · Wireless earbuds', amount: -1299, ts: Date.now() - 7 * HOUR },
  { id: 't5', title: 'Food order · Golden Chaat', detail: 'Delivered · Masala wrap + filter coffee', amount: -215, ts: Date.now() - 26 * HOUR },
  { id: 't6', title: 'Payment to Velvet & Co', detail: 'Order #SJ-102210 · Embroidered throw', amount: -1299, ts: Date.now() - 30 * HOUR },
  { id: 't7', title: 'Wallet top-up', detail: 'UPI · Kotak Bank •••• 7812', amount: 1000, ts: Date.now() - 2 * DAY },
  { id: 't8', title: 'Payment to FitKart', detail: 'Order #SJ-102115 · Yoga mat + dumbbells set', amount: -1499, ts: Date.now() - 3 * DAY },
  { id: 't9', title: 'Refund · Artisan Burger Loft', detail: 'Item cancelled — money back', amount: 349, ts: Date.now() - 4 * DAY },
  { id: 't10', title: 'Payment to Urban Threads', detail: 'Order #SJ-101845 · Linen shirt + denim', amount: -1099, ts: Date.now() - 5 * DAY },
  { id: 't11', title: 'Payment to Green Crates', detail: 'Order #SJ-102052 · Weekly veg + fruit box', amount: -1850, ts: Date.now() - 6 * DAY },
  { id: 't12', title: 'Payment to BookNook', detail: 'Order #SJ-101428 · Signed novels set', amount: -620, ts: Date.now() - 8 * DAY },
  { id: 't13', title: 'Payment to Dazzle Gadgets', detail: 'Order #SJ-101391 · Bluetooth speaker', amount: -1675, ts: Date.now() - 10 * DAY },
  { id: 't14', title: 'Wallet top-up', detail: 'UPI · HDFC Bank •••• 4521', amount: 2500, ts: Date.now() - 12 * DAY },
];

/** Read the wallet; falls back to the seeded demo state when unset/corrupt. */
export async function getWallet(): Promise<WalletState> {
  try {
    const raw = await AsyncStorage.getItem(WALLET_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const maybe = parsed as { balance?: unknown; transactions?: unknown };
        if (typeof maybe.balance === 'number') {
          const list: unknown[] = Array.isArray(maybe.transactions) ? maybe.transactions : [];
          return {
            balance: maybe.balance,
            transactions:
              list.length > 0
                ? list
                    .filter(
                      (t): t is WalletTx =>
                        !!t && typeof t === 'object' && typeof (t as WalletTx).id === 'string'
                    )
                    .map((t) => ({
                      id: t.id,
                      title: typeof t.title === 'string' ? t.title : 'Wallet activity',
                      detail: typeof t.detail === 'string' ? t.detail : '',
                      amount: Number(t.amount) || 0,
                      // legacy entries carried literal strings — map to a fresh timestamp
                      ts: typeof t.ts === 'number' ? t.ts : Date.now(),
                    }))
                : SEED_TRANSACTIONS,
          };
        }
      }
    }
  } catch {
    // corrupted data — fall through to seed
  }
  return { balance: WALLET_SEED_BALANCE, transactions: SEED_TRANSACTIONS };
}

export async function saveWallet(state: WalletState): Promise<void> {
  try {
    await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(state));
  } catch {
    // best-effort persistence
  }
}

/**
 * Debit the wallet. Returns null when the amount exceeds the balance
 * (callers show an insufficient-balance message) — never a negative balance.
 */
export async function debitWallet(
  amount: number,
  tx: { title: string; detail: string }
): Promise<WalletState | null> {
  if (amount <= 0) return null;
  const state = await getWallet();
  if (state.balance < amount) return null;
  const next: WalletState = {
    balance: state.balance - amount,
    transactions: [
      { id: `w${Date.now()}`, title: tx.title, detail: tx.detail, amount: -amount, ts: Date.now() },
      ...state.transactions,
    ],
  };
  await saveWallet(next);
  return next;
}

/**
 * Credit the wallet (refund issued, referral reward, top-up).
 * `dedupeByTitle` prevents double-crediting the same event on re-render.
 */
export async function creditWallet(
  amount: number,
  tx: { title: string; detail: string; dedupeByTitle?: string }
): Promise<WalletState> {
  if (amount <= 0) return getWallet();
  const state = await getWallet();
  if (tx.dedupeByTitle && state.transactions.some((t) => t.title === tx.dedupeByTitle)) {
    return state;
  }
  const next: WalletState = {
    balance: state.balance + amount,
    transactions: [
      { id: `w${Date.now()}`, title: tx.title, detail: tx.detail, amount, ts: Date.now() },
      ...state.transactions,
    ],
  };
  await saveWallet(next);
  return next;
}