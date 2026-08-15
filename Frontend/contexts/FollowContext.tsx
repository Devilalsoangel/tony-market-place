import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FOLLOWED_KEY = '@susej_followed_sellers';

interface FollowContextType {
  /** Set of usernames the current user follows */
  followedSellers: Set<string>;
  /** Array of usernames the current user follows (derived from followedSellers) */
  followedList: string[];
  /** Check if the user follows a given seller */
  isFollowing: (username: string) => boolean;
  /** Follow a seller */
  follow: (username: string) => void;
  /** Unfollow a seller */
  unfollow: (username: string) => void;
  /** Toggle follow/unfollow for a seller */
  toggleFollow: (username: string) => void;
}

const FollowContext = createContext<FollowContextType | null>(null);

export function FollowProvider({ children }: { children: React.ReactNode }) {
  const [followedSellers, setFollowedSellers] = useState<Set<string>>(new Set());
  const loaded = useRef(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(FOLLOWED_KEY)
      .then((data) => {
        if (data) {
          try {
            const arr = JSON.parse(data) as string[];
            setFollowedSellers(new Set(arr));
          } catch {
            // corrupted data, reset
          }
        }
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  // Persist whenever followedSellers changes (skip initial load)
  const persist = useCallback((updated: Set<string>) => {
    const arr = Array.from(updated);
    AsyncStorage.setItem(FOLLOWED_KEY, JSON.stringify(arr)).catch(() => {});
  }, []);

  const isFollowing = useCallback(
    (username: string) => followedSellers.has(username),
    [followedSellers]
  );

  const followedList = useMemo(() => Array.from(followedSellers), [followedSellers]);

  const follow = useCallback(
    (username: string) => {
      setFollowedSellers((prev) => {
        const next = new Set(prev);
        next.add(username);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const unfollow = useCallback(
    (username: string) => {
      setFollowedSellers((prev) => {
        const next = new Set(prev);
        next.delete(username);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleFollow = useCallback(
    (username: string) => {
      setFollowedSellers((prev) => {
        const next = new Set(prev);
        if (next.has(username)) {
          next.delete(username);
        } else {
          next.add(username);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <FollowContext.Provider
      value={{ followedSellers, followedList, isFollowing, follow, unfollow, toggleFollow }}
    >
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return ctx;
}
