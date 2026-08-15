import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = '@susej_cart';

// ─── DEMO PRICING POLICY ───────────────────────────────────────
// Single source of truth for cart-level fees until backend quoting exists.
export const DELIVERY_FEES = {
  product: 12,
  food_item: 30,
} as const;

export const DEMO_DISCOUNT = 20;

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
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  itemInCart: (listingId: string) => boolean;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((data) => {
        if (data) {
          try {
            setCart(JSON.parse(data) as CartItem[]);
          } catch {
          }
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const itemInCart = useCallback(
    (listingId: string) => cart.some((item) => item.listingId === listingId),
    [cart]
  );

  const addToCart = useCallback(
    (item: Omit<CartItem, 'quantity'>) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.listingId === item.listingId);
        const next = existing
          ? prev.map((i) =>
              i.listingId === item.listingId ? { ...i, quantity: i.quantity + 1 } : i
            )
          : [...prev, { ...item, quantity: 1 }];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeFromCart = useCallback(
    (listingId: string) => {
      setCart((prev) => {
        const next = prev.filter((item) => item.listingId !== listingId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateQuantity = useCallback(
    (listingId: string, quantity: number) => {
      setCart((prev) => {
        const next = quantity <= 0
          ? prev.filter((item) => item.listingId !== listingId)
          : prev.map((item) =>
              item.listingId === listingId ? { ...item, quantity } : item
            );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    persist([]);
  }, [persist]);

  return (
    <CartContext.Provider
      value={{ cart, cartCount, subtotal, itemInCart, addToCart, removeFromCart, updateQuantity, clearCart }}
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
