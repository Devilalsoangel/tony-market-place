import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const BOOKMARKS_KEY_BASE = '@susej_bookmarked_products';

export interface BookmarkedProduct {
  productId: string;
  sellerName: string;
  sellerUsername?: string;
  price: number;
  description: string;
  imageUrl?: string;
  savedAt: number;
}

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
  const { user, tokenSeq } = useAuth();
  const getKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${BOOKMARKS_KEY_BASE}:${u}` : BOOKMARKS_KEY_BASE;
  }, [user?.username]);

  // Load per-user bookmarks — race-safe: token gates stale async loads when username flips quickly.
  // tokenSeq forces reload on same-username re-switch (stale cache would otherwise survive).
  useEffect(() => {
    const key = getKey();
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((data) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          try {
            const arr = JSON.parse(data) as BookmarkedProduct[];
            const map = new Map<string, BookmarkedProduct>();
            for (const item of arr) {
              if (item && item.productId && !String(item.productId).startsWith('post_0')) {
                map.set(item.productId, item);
              }
            }
            setBookmarks(map);
          } catch {
            if (!cancelled) setBookmarks(new Map());
          }
        } else {
          setBookmarks(new Map());
        }
      })
      .catch(() => { if (!cancelled) setBookmarks(new Map()); });
    return () => { cancelled = true; };
  }, [getKey, tokenSeq]);

  // Identity-bound saves: per-user key; reload when username changes.
  const persist = useCallback((updated: Map<string, BookmarkedProduct>) => {
    const arr = Array.from(updated.values());
    AsyncStorage.setItem(getKey(), JSON.stringify(arr)).catch(() => {});
  }, [getKey]);

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
