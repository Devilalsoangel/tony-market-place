import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverApi } from '../utils/serverApi';
import { useAuth } from './AuthContext';

const FOLLOWED_KEY_BASE = '@susej_followed_sellers';

interface FollowContextType {
  /** Set of usernames the current user follows */
  followedSellers: Set<string>;
  /** Array of usernames the current user follows (derived from followedSellers) */
  followedList: string[];
  /** REAL follower counts per username from the server Follow table (empty when offline) */
  followerCounts: Record<string, number>;
  /** Usernames of people who follow the current user (server truth) */
  followersList: string[];
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
  const { user, tokenSeq } = useAuth();
  const [followedSellers, setFollowedSellers] = useState<Set<string>>(new Set());
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [followersList, setFollowersList] = useState<string[]>([]);
  // STATE (not ref): the server-sync effect depends on it, so a login that
  // lands before AsyncStorage resolves still triggers the fetch afterwards.
  const [cacheLoaded, setCacheLoaded] = useState(false);

  const getFollowKey = useCallback(() => {
    const u = user?.username;
    return u ? `${FOLLOWED_KEY_BASE}:${u}` : FOLLOWED_KEY_BASE;
  }, [user?.username]);

  // Load from per-user AsyncStorage key on mount / identity switch, then reconcile with server.
  useEffect(() => {
    const key = getFollowKey();
    AsyncStorage.getItem(key)
      .then((data) => {
        if (data) {
          try {
            const arr = JSON.parse(data) as string[];
            setFollowedSellers(new Set(arr));
          } catch {
            // corrupted data, reset
          }
        } else {
          setFollowedSellers(new Set());
        }
        setCacheLoaded(true);
      })
      .catch(() => {
        setCacheLoaded(true);
      });
  }, [getFollowKey]);

  useEffect(() => {
    if (!user?.username || !cacheLoaded) return;
    const key = getFollowKey();
    serverApi.getFollows().then((res) => {
      if (res.ok && res.data) {
        setFollowedSellers(new Set(res.data.followed));
        if (res.data.followerCounts) setFollowerCounts(res.data.followerCounts);
        if (res.data.followers) setFollowersList(res.data.followers);
        AsyncStorage.setItem(key, JSON.stringify(res.data.followed)).catch(() => {});
      }
      // On failure keep the cached values — the AsyncStorage mirror is the
      // offline source of truth and must not be wiped by a transient 401.
    });
  }, [user?.username, cacheLoaded, tokenSeq, getFollowKey]);

  // Persist whenever followedSellers changes (per-user key)
  const persist = useCallback((updated: Set<string>) => {
    const arr = Array.from(updated);
    AsyncStorage.setItem(getFollowKey(), JSON.stringify(arr)).catch(() => {});
  }, [getFollowKey]);

  // Adopt server counts after a successful mutation — other followers change
  // totals independently, so local +1/-1 math drifts until next login.
  const refreshCounts = useCallback(() => {
    serverApi.getFollows().then((res) => {
      if (res.ok && res.data?.followerCounts) setFollowerCounts(res.data.followerCounts);
    }).catch(() => {});
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
      setFollowerCounts((prev) => ({ ...prev, [username]: (prev[username] ?? 0) + 1 }));
      serverApi.follow(username).then((res) => {
        if (res.ok) refreshCounts();
        else {
          // Rollback optimistic +1 so a 401/offline never leaves ghost followers
          setFollowedSellers((prev) => {
            const next = new Set(prev);
            next.delete(username);
            persist(next);
            return next;
          });
          setFollowerCounts((prev) => ({ ...prev, [username]: Math.max(0, (prev[username] ?? 1) - 1) }));
        }
      }).catch(() => {
        setFollowedSellers((prev) => {
          const next = new Set(prev);
          next.delete(username);
          persist(next);
          return next;
        });
        setFollowerCounts((prev) => ({ ...prev, [username]: Math.max(0, (prev[username] ?? 1) - 1) }));
      });
    },
    [persist, refreshCounts]
  );

  const unfollow = useCallback(
    (username: string) => {
      setFollowedSellers((prev) => {
        const next = new Set(prev);
        next.delete(username);
        persist(next);
        return next;
      });
      setFollowerCounts((prev) => ({ ...prev, [username]: Math.max(0, (prev[username] ?? 1) - 1) }));
      const rollbackUnfollow = () => {
        setFollowedSellers((prev) => {
          const next = new Set(prev);
          next.add(username);
          persist(next);
          return next;
        });
        setFollowerCounts((prev) => ({ ...prev, [username]: (prev[username] ?? 0) + 1 }));
      };
      serverApi.follow(username, true).then((res) => {
        if (res.ok) refreshCounts();
        else rollbackUnfollow();
      }).catch(rollbackUnfollow);
    },
    [persist, refreshCounts]
  );

  const toggleFollow = useCallback(
    (username: string) => {
      const currently = followedSellers.has(username);
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
      setFollowerCounts((prev) => ({
        ...prev,
        [username]: currently ? Math.max(0, (prev[username] ?? 1) - 1) : (prev[username] ?? 0) + 1,
      }));
      const rollbackToggle = () => {
        setFollowedSellers((prev) => {
          const next = new Set(prev);
          if (currently) next.add(username); else next.delete(username);
          persist(next);
          return next;
        });
        setFollowerCounts((prev) => ({
          ...prev,
          [username]: currently ? (prev[username] ?? 0) + 1 : Math.max(0, (prev[username] ?? 1) - 1),
        }));
      };
      serverApi.follow(username, currently).then((res) => {
        if (res.ok) refreshCounts();
        else rollbackToggle();
      }).catch(rollbackToggle);
    },
    [persist, followedSellers, refreshCounts]
  );

  return (
    <FollowContext.Provider
      value={{ followedSellers, followedList, followerCounts, followersList, isFollowing, follow, unfollow, toggleFollow }}
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
