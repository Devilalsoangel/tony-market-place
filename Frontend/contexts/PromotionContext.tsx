import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { getPackage, type PromotionKind } from '../utils/marketplace';
import { serverApi } from '../utils/serverApi';

const PROMOTIONS_KEY_BASE = '@susej_promotions';

export type PromotionStatus = 'pending_payment' | 'active' | 'expired' | 'refunded';

export interface Promotion {
  id: string;
  packageId: string;
  kind: PromotionKind;
  packageName: string;
  amountPaid: number;
  durationDays: number;
  sellerUsername: string;
  /** Target listing (featuredPost / hotDeal promos). */
  postId?: string;
  productTitle?: string;
  status: PromotionStatus;
  startsAt: number;
  endsAt: number;
  views: number;
  clicks: number;
}

interface PromotionContextValue {
  promotions: Promotion[];
  loaded: boolean;
  /** Buy a package — returns the created promotion or null if invalid. */
  createPromotion: (input: {
    packageId: string;
    postId?: string;
    productTitle?: string;
    sellerUsername: string;
  }) => Promotion | null;
  endPromotion: (id: string) => void;
}

const PromotionContext = createContext<PromotionContextValue>({
  promotions: [],
  loaded: false,
  createPromotion: () => null,
  endPromotion: () => {},
});

export function PromotionProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  const getKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${PROMOTIONS_KEY_BASE}:${u}` : PROMOTIONS_KEY_BASE;
  }, [user?.username]);

  // Reset on account switch to prevent cross-account campaign leak.
  useEffect(() => {
    setPromotions([]);
    loadedRef.current = false;
    setLoaded(false);
  }, [tokenSeq]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = getKey();
        let raw = await AsyncStorage.getItem(key);
        // Migrate legacy global key on first per-user load.
        if (!raw && key !== PROMOTIONS_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(PROMOTIONS_KEY_BASE);
          if (legacy) raw = legacy;
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!cancelled && Array.isArray(parsed)) {
            const now = Date.now();
            const real = parsed.filter(
              (p: Promotion) => p && !/^PRM-100[1-4]$/.test(String(p.id))
            );
            // Keep only promotions belonging to current user (safety when migrating).
            const u = user?.username?.trim();
            const owned = u ? real.filter((p: Promotion) => !p.sellerUsername || p.sellerUsername === u) : real;
            setPromotions(
              owned.map((p: Promotion) =>
                p && p.status === 'active' && p.endsAt && p.endsAt < now ? { ...p, status: 'expired' } : p
              )
            );
          }
        }
      } catch {
        // corrupted cache — start empty
      }
      if (!cancelled) {
        loadedRef.current = true;
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [getKey, tokenSeq, user?.username]);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(getKey(), JSON.stringify(promotions)).catch(() => {});
  }, [promotions, getKey]);

  const createPromotion = useCallback(
    (input: { packageId: string; postId?: string; productTitle?: string; sellerUsername: string }): Promotion | null => {
      if (input.sellerUsername !== user?.username) return null;
      const pkg = getPackage(input.packageId);
      if (!pkg) return null;
      const now = Date.now();
      const promo: Promotion = {
        id: `PRM-${now}-${Math.random().toString(36).slice(2, 6)}`,
        packageId: pkg.id,
        kind: pkg.kind,
        packageName: pkg.name,
        amountPaid: pkg.price,
        durationDays: pkg.days,
        sellerUsername: input.sellerUsername,
        postId: input.postId,
        productTitle: input.productTitle,
        status: 'active',
        startsAt: now,
        endsAt: now + pkg.days * 864e5,
        views: 0,
        clicks: 0,
      };
      setPromotions((prev) => [promo, ...prev]);
      return promo;
    },
    [user?.username]
  );

  const endPromotion = useCallback((id: string) => {
    const target = { id, postId: undefined as string | undefined };
    setPromotions((prev) => {
      const row = prev.find((p) => p.id === id);
      if (row?.postId) target.postId = row.postId;
      return prev.map((p) => (p.id === id ? { ...p, status: 'expired' } : p));
    });
    // Server owns billing time: ending must deactivate the paid placement
    // there too. Roll back the local mirror on refusal/offline so the two
    // never disagree about what is still running (and billing).
    serverApi.endPromotion(id, target.postId).then((res) => {
      if (!res.ok) {
        setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'active' } : p)));
      }
    }).catch(() => {
      setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'active' } : p)));
    });
  }, []);

  return (
    <PromotionContext.Provider value={{ promotions, loaded, createPromotion, endPromotion }}>
      {children}
    </PromotionContext.Provider>
  );
}

export function usePromotions() {
  return useContext(PromotionContext);
}
