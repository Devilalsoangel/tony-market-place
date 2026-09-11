import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const RECENTLY_VIEWED_KEY_BASE = '@susej_recently_viewed';
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
  const { user } = useAuth();
  const username = user?.username?.trim() ?? null;
  const recentsKey = username ? `${RECENTLY_VIEWED_KEY_BASE}:${username}` : RECENTLY_VIEWED_KEY_BASE;
  const prevKeyRef = useRef<string>(recentsKey);

  // Load per-user recents; race-safe with cancellation on key flip.
  useEffect(() => {
    let cancelled = false;
    const key = recentsKey;
    loadedRef.current = false;
    AsyncStorage.getItem(key)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const parsed = JSON.parse(data) as RecentlyViewedEntry[];
            if (Array.isArray(parsed)) {
              setRecents(parsed.slice(0, MAX_RECENTS));
            } else {
              setRecents([]);
            }
          } catch {
            if (!cancelled) setRecents([]);
          }
        } else {
          setRecents([]);
        }
        loadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) setRecents([]);
        loadedRef.current = true;
      });
    prevKeyRef.current = key;
    return () => { cancelled = true; };
  }, [recentsKey]);

  // Persist to per-user key; migrate away from legacy global key on first write.
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(recentsKey, JSON.stringify(recents)).catch(() => {});
    if (recentsKey !== RECENTLY_VIEWED_KEY_BASE) {
      AsyncStorage.removeItem(RECENTLY_VIEWED_KEY_BASE).catch(() => {});
    }
  }, [recents, recentsKey]);

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
