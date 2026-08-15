import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = '@susej_bookmarked_products';

export interface BookmarkedProduct {
  productId: string;
  sellerName: string;
  sellerUsername?: string;
  price: number;
  description: string;
  imageUrl?: string;
  savedAt: number;
}

const SEED_BOOKMARKS: BookmarkedProduct[] = [
  { productId: 'post_001', sellerName: 'NeoDrip Fashion', sellerUsername: 'luxe', price: 4999, description: 'Vintage silk saree with hand-embroidered border', imageUrl: 'https://picsum.photos/seed/susejp1/800/400', savedAt: Date.now() - 86400000 * 8 },
  { productId: 'post_002', sellerName: 'TechVault', sellerUsername: 'techvault', price: 45999, description: 'MacBook Pro M3 - 16GB RAM, 512GB SSD', imageUrl: 'https://picsum.photos/seed/susejp2/800/400', savedAt: Date.now() - 86400000 * 7 },
  { productId: 'post_003', sellerName: 'Urban Jungle', sellerUsername: 'urbanjungle', price: 1299, description: 'Handmade ceramic plant pot set of 3', imageUrl: 'https://picsum.photos/seed/susejp3/800/400', savedAt: Date.now() - 86400000 * 6 },
  { productId: 'post_004', sellerName: 'Brush & Style Studio', sellerUsername: 'brushstyle', price: 7999, description: 'Professional interior painting & home styling', imageUrl: 'https://picsum.photos/seed/susejp4/800/400', savedAt: Date.now() - 86400000 * 5 },
  { productId: 'post_005', sellerName: 'FreshBasket', sellerUsername: 'freshbasket', price: 499, description: 'Organic farm-fresh vegetable box — 5kg seasonal produce', imageUrl: 'https://picsum.photos/seed/susejp5/800/400', savedAt: Date.now() - 86400000 * 4 },
  { productId: 'post_006', sellerName: 'CodeWorks Studio', sellerUsername: 'codeworks', price: 1800000, description: 'React Native developer - 3+ years, remote friendly', imageUrl: 'https://picsum.photos/seed/susejp6/800/400', savedAt: Date.now() - 86400000 * 3 },
  { productId: 'post_007', sellerName: 'Skyline Realty', sellerUsername: 'skyline', price: 35000, description: '2BHK apartment for rent, sea facing', imageUrl: 'https://picsum.photos/seed/susejp7/800/400', savedAt: Date.now() - 86400000 * 2 },
  { productId: 'post_008', sellerName: 'ThreadWorks', sellerUsername: 'threadworks', price: 420, description: 'Cotton grey fabric — 100% Indian raw cotton', imageUrl: 'https://picsum.photos/seed/susejp8/800/400', savedAt: Date.now() - 86400000 * 1 },
  { productId: 'post_009', sellerName: 'Smile Dental', sellerUsername: 'smiledental', price: 500, description: 'Dental checkup with X-ray and cleaning', imageUrl: 'https://picsum.photos/seed/susejp9/800/400', savedAt: Date.now() - 3600000 * 20 },
  { productId: 'post_010', sellerName: 'LearnSphere', sellerUsername: 'learnsphere', price: 25000, description: 'Full-stack web development bootcamp — 6 months', imageUrl: 'https://picsum.photos/seed/susejp10/800/400', savedAt: Date.now() - 3600000 * 10 },
];

interface BookmarkContextType {
  bookmarks: Map<string, BookmarkedProduct>;
  isBookmarked: (productId: string) => boolean;
  bookmarkCount: number;
  addBookmark: (product: BookmarkedProduct) => void;
  removeBookmark: (productId: string) => void;
  toggleBookmark: (product: BookmarkedProduct) => void;
  bookmarksList: BookmarkedProduct[];
}

const BookmarkContext = createContext<BookmarkContextType | null>(null);

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Map<string, BookmarkedProduct>>(new Map());

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(BOOKMARKS_KEY)
      .then((data) => {
        if (data && data.length > 0) {
          try {
            const arr = JSON.parse(data) as BookmarkedProduct[];
            const map = new Map<string, BookmarkedProduct>();
            for (const item of arr) {
              map.set(item.productId, item);
            }
            setBookmarks(map);
          } catch {
            // corrupted, reset
          }
        } else {
          // First run — seed demo volume so saved screens look populated.
          const map = new Map<string, BookmarkedProduct>();
          for (const item of SEED_BOOKMARKS) {
            map.set(item.productId, item);
          }
          setBookmarks(map);
          AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(SEED_BOOKMARKS)).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((updated: Map<string, BookmarkedProduct>) => {
    const arr = Array.from(updated.values());
    AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(arr)).catch(() => {});
  }, []);

  const isBookmarked = useCallback(
    (productId: string) => bookmarks.has(productId),
    [bookmarks]
  );

  const bookmarkCount = bookmarks.size;

  const addBookmark = useCallback(
    (product: BookmarkedProduct) => {
      setBookmarks((prev) => {
        const next = new Map(prev);
        next.set(product.productId, product);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeBookmark = useCallback(
    (productId: string) => {
      setBookmarks((prev) => {
        const next = new Map(prev);
        next.delete(productId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleBookmark = useCallback(
    (product: BookmarkedProduct) => {
      setBookmarks((prev) => {
        const next = new Map(prev);
        if (next.has(product.productId)) {
          next.delete(product.productId);
        } else {
          next.set(product.productId, product);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const bookmarksList = Array.from(bookmarks.values()).sort(
    (a, b) => b.savedAt - a.savedAt
  );

  return (
    <BookmarkContext.Provider
      value={{ bookmarks, isBookmarked, bookmarkCount, addBookmark, removeBookmark, toggleBookmark, bookmarksList }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmark() {
  const ctx = useContext(BookmarkContext);
  if (!ctx) {
    throw new Error('useBookmark must be used within a BookmarkProvider');
  }
  return ctx;
}
