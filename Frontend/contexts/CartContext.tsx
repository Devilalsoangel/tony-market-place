import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const CART_KEY_BASE = '@susej_cart';

// ─── PRICING POLICY ────────────────────────────────────────────
// Single source of truth for cart-level fees until backend quoting exists.
export const DELIVERY_FEES = {
  product: 12,
  food_item: 30,
  service: 0,
} as const;

export type ListingType = 'product' | 'service' | 'food_item';

export interface CartItem {
  listingId: string;
  type: ListingType;
  name: string;
  price: number;
  quantity: number;
  seller: string;
  sellerUsername: string;
  imageUrl?: string;
  /** Chosen variant labels (e.g. "Size:M") — carried to the order so the
   *  server can reject stale out-of-stock selections at placement. */
  variantLabel?: string;
  /** Bundle row id when this line is part of an advertised combo. The
   *  Bundle row (not the cart price) is the price authority — the server
   *  re-prices bundle lines from the bundle at placement, so checkout
   *  revalidation and updatePrices must never overwrite them. */
  bundleId?: string;
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  itemInCart: (listingId: string) => boolean;
  /** Returns false when rejected by the single-seller guard so callers can
   *  explain (industry-standard: never silently ignore an add-to-cart tap). */
  addToCart: (item: Omit<CartItem, 'quantity'>) => boolean;
  /** Reprice items to server truth at checkout (industry-standard: never
   *  charge a stale cart price). Keys are line keys (listing+variant+bundle);
   *  returns the line keys whose price changed. */
  updatePrices: (prices: Record<string, number>) => string[];
  removeFromCart: (listingId: string, opts?: { variantLabel?: string; bundleId?: string }) => void;
  updateQuantity: (listingId: string, quantity: number, opts?: { variantLabel?: string; bundleId?: string }) => void;
  /**
   * Saved-for-later restore in ONE state transition: inserts with the saved
   * quantity (or sets it when already present). The old add-then-setTimeout
   * patch raced batched updates and clobbered quantities. Single-seller
   * guard applies; returns false when rejected.
   */
  restoreSavedItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => boolean;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

/** Cart line identity: distinct variants (and bundle rows) of one listing are
 * distinct lines. Matching on listingId alone merged Size:M into Size:L —
 * wrong item sold, wrong stock decremented. */
export function cartLineKey(item: { listingId: string; bundleId?: string; variantLabel?: string }): string {
  return `${item.listingId}|${item.bundleId ?? ''}|${item.variantLabel ?? ''}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user, tokenSeq } = useAuth();
  const username = user?.username ?? null;
  const cartKey = username ? `${CART_KEY_BASE}:${username}` : CART_KEY_BASE;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(cartKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            setCart(JSON.parse(data) as CartItem[]);
          } catch {}
        } else {
          setCart([]);
        }
      })
      .catch(() => { if (!cancelled) setCart([]); });
    return () => { cancelled = true; };
  }, [cartKey, tokenSeq]);

  const persist = useCallback((next: CartItem[]) => {
    AsyncStorage.setItem(cartKey, JSON.stringify(next)).catch(() => {});
  }, [cartKey]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));

  const itemInCart = useCallback(
    (listingId: string) => cart.some((item) => item.listingId === listingId),
    [cart]
  );

  const addToCart = useCallback(
    (item: Omit<CartItem, 'quantity'>) => {
      // Single-seller guard runs synchronously HERE (not inside the async
      // setCart updater, whose return value the caller can never see).
      // CRITICAL: Cart is single-seller only. Orders can only be placed with one seller.
      if (cart.length > 0 && cart[0].sellerUsername !== item.sellerUsername) {
        return false;
      }
      setCart((prev) => {
        // Re-check inside the updater for back-to-back rapid taps.
        if (prev.length > 0 && prev[0].sellerUsername !== item.sellerUsername) {
          return prev;
        }
        const key = cartLineKey(item);
        const existing = prev.find((i) => cartLineKey(i) === key);
        const next = existing
          ? prev.map((i) =>
              cartLineKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
            )
          : [...prev, { ...item, quantity: 1 }];
        persist(next);
        return next;
      });
      return true;
    },
    [persist, cart]
  );

  const removeFromCart = useCallback(
    (listingId: string, opts?: { variantLabel?: string; bundleId?: string }) => {
      setCart((prev) => {
        const next = prev.filter((item) => cartLineKey(item) !== cartLineKey({ listingId, bundleId: opts?.bundleId, variantLabel: opts?.variantLabel }));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateQuantity = useCallback(
    (listingId: string, quantity: number, opts?: { variantLabel?: string; bundleId?: string }) => {
      setCart((prev) => {
        const key = cartLineKey({ listingId, bundleId: opts?.bundleId, variantLabel: opts?.variantLabel });
        const next = quantity <= 0
          ? prev.filter((item) => cartLineKey(item) !== key)
          : prev.map((item) =>
              cartLineKey(item) === key ? { ...item, quantity } : item
            );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const restoreSavedItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity: number) => {
      const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
      if (cart.length > 0 && cart[0].sellerUsername !== item.sellerUsername) {
        return false;
      }
      setCart((prev) => {
        if (prev.length > 0 && prev[0].sellerUsername !== item.sellerUsername) {
          return prev;
        }
        const existing = prev.find((i) => cartLineKey(i) === cartLineKey(item));
        const next = existing
          ? prev.map((i) => (cartLineKey(i) === cartLineKey(item) ? { ...i, quantity: Math.max(i.quantity, qty) } : i))
          : [...prev, { ...item, quantity: qty }];
        persist(next);
        return next;
      });
      return true;
    },
    [persist, cart]
  );

  const updatePrices = useCallback(
    (prices: Record<string, number>) => {
      const changed: string[] = [];
      for (const item of cart) {
        // Bundle lines are priced by the Bundle row at placement — a mirror
        // reprice here would false-positive every combo as "changed".
        // Variant lines ARE repriced: the server now charges base+delta, so
        // the truth map carries variant truth per line key (see checkout).
        if (item.bundleId) continue;
        const key = cartLineKey(item);
        const next = prices[key] ?? prices[item.listingId];
        if (typeof next === 'number' && Number.isFinite(next) && next >= 0 && next !== item.price) {
          changed.push(key);
        }
      }
      if (changed.length) {
        const changedSet = new Set(changed);
        setCart((prev) => {
          const next = prev.map((item) => {
            const key = cartLineKey(item);
            if (!changedSet.has(key)) return item;
            const price = prices[key] ?? prices[item.listingId];
            return { ...item, price };
          });
          persist(next);
          return next;
        });
      }
      return changed;
    },
    [persist, cart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    persist([]);
  }, [persist]);

  return (
    <CartContext.Provider
      value={{ cart, cartCount, subtotal, itemInCart, addToCart, updatePrices, removeFromCart, updateQuantity, restoreSavedItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
