import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENTLY_VIEWED_KEY = '@susej_recently_viewed';
const MAX_RECENTS = 12;

export interface RecentlyViewedEntry {
  postId: string;
  viewedAt: number;
}

interface RecentlyViewedContextType {
  recents: RecentlyViewedEntry[];
  record: (postId: string) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType | null>(null);

export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
  const [recents, setRecents] = useState<RecentlyViewedEntry[]>([]);
  const loadedRef = useRef(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENTLY_VIEWED_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data) as RecentlyViewedEntry[];
            if (Array.isArray(parsed)) {
              setRecents(parsed.slice(0, MAX_RECENTS));
            }
          } catch {
            // corrupted data — start fresh
          }
        }
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
  }, []);

  // Persist whenever recents change (skip the pre-load empty state)
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recents)).catch(() => {});
  }, [recents]);

  const record = useCallback((postId: string) => {
    if (!postId) return;
    setRecents((prev) => {
      const next = [
        { postId, viewedAt: Date.now() },
        ...prev.filter((r) => r.postId !== postId),
      ];
      return next.slice(0, MAX_RECENTS);
    });
  }, []);

  return (
    <RecentlyViewedContext.Provider value={{ recents, record }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed(): RecentlyViewedContextType {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) {
    return { recents: [], record: () => {} };
  }
  return ctx;
}
