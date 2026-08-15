import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPackage, type PromotionKind } from '../utils/marketplace';

const PROMOTIONS_KEY = '@susej_promotions';

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

const SEED_PROMOTIONS: Promotion[] = [
  {
    id: 'PRM-1001',
    packageId: 'featured-post-30',
    kind: 'featuredPost',
    packageName: 'Boost Post · 30 days',
    amountPaid: 999,
    durationDays: 30,
    sellerUsername: 'luxe',
    postId: 'post_001',
    productTitle: 'Velvet Streetwear Hoodie',
    status: 'active',
    startsAt: Date.now() - 4 * 864e5,
    endsAt: Date.now() + 26 * 864e5,
    views: 12840,
    clicks: 412,
  },
  {
    id: 'PRM-1002',
    packageId: 'top-seller-7',
    kind: 'topSeller',
    packageName: 'Top Seller Spotlight · 7 days',
    amountPaid: 599,
    durationDays: 7,
    sellerUsername: 'luxe',
    status: 'active',
    startsAt: Date.now() - 2 * 864e5,
    endsAt: Date.now() + 5 * 864e5,
    views: 42100,
    clicks: 1890,
  },
  {
    id: 'PRM-1003',
    packageId: 'hot-deal-7',
    kind: 'hotDeal',
    packageName: 'Hot Deal · 7 days',
    amountPaid: 499,
    durationDays: 7,
    sellerUsername: 'luxe',
    postId: 'post_002',
    productTitle: 'Chunky Knit Cardigan',
    status: 'active',
    startsAt: Date.now() - 1 * 864e5,
    endsAt: Date.now() + 6 * 864e5,
    views: 9800,
    clicks: 520,
  },
  {
    id: 'PRM-1004',
    packageId: 'featured-post-7',
    kind: 'featuredPost',
    packageName: 'Boost Post · 7 days',
    amountPaid: 349,
    durationDays: 7,
    sellerUsername: 'luxe',
    postId: 'post_003',
    productTitle: 'Oversized Denim Jacket',
    status: 'expired',
    startsAt: Date.now() - 12 * 864e5,
    endsAt: Date.now() - 5 * 864e5,
    views: 5400,
    clicks: 210,
  },
];

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROMOTIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const now = Date.now();
            setPromotions(
              parsed.map((p: Promotion) =>
                p && p.status === 'active' && p.endsAt && p.endsAt < now ? { ...p, status: 'expired' } : p
              )
            );
          }
        } else {
          await AsyncStorage.setItem(PROMOTIONS_KEY, JSON.stringify(SEED_PROMOTIONS));
          setPromotions(SEED_PROMOTIONS);
        }
      } catch {
        setPromotions(SEED_PROMOTIONS);
      }
      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(PROMOTIONS_KEY, JSON.stringify(promotions)).catch(() => {});
  }, [promotions]);

  const createPromotion = useCallback(
    (input: { packageId: string; postId?: string; productTitle?: string; sellerUsername: string }): Promotion | null => {
      const pkg = getPackage(input.packageId);
      if (!pkg) return null;
      const now = Date.now();
      const promo: Promotion = {
        id: `PRM-${now}${String(promotions.length).padStart(2, '0')}`,
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
    [promotions.length]
  );

  const endPromotion = useCallback((id: string) => {
    setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'expired' } : p)));
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
