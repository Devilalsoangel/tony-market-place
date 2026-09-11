import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './AuthContext';

const HASHTAGS_KEY_BASE = '@susej_followed_hashtags';

const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/^#/, '');

interface HashtagContextType {
  /** Tags (lowercase, no '#') the current user follows */
  followedHashtags: string[];
  /** Follow/unfollow a hashtag */
  toggleHashtag: (tag: string) => void;
  /** Check if the user follows a given hashtag */
  isFollowingHashtag: (tag: string) => boolean;
}

const HashtagContext = createContext<HashtagContextType | null>(null);

export function HashtagProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const [followedHashtags, setFollowedHashtags] = useState<string[]>([]);
  const dirty = useRef(false);

  const getKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${HASHTAGS_KEY_BASE}:${u}` : HASHTAGS_KEY_BASE;
  }, [user?.username]);

  // Reset in-memory state on account switch so User A's hashtags never flash for User B
  useEffect(() => {
    setFollowedHashtags([]);
    dirty.current = false;
  }, [tokenSeq]);

  // Load from per-user AsyncStorage key on mount / identity switch and on focus
  const load = useCallback(() => {
    if (dirty.current) return;
    const key = getKey();
    AsyncStorage.getItem(key)
      .then((data) => {
        if (!data) { setFollowedHashtags([]); return; }
        try {
          const arr = JSON.parse(data) as string[];
          setFollowedHashtags(arr.map(normalizeTag).filter(Boolean));
        } catch {
          setFollowedHashtags([]);
        }
      })
      .catch(() => { setFollowedHashtags([]); });
  }, [getKey]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const persist = useCallback((updated: string[]) => {
    AsyncStorage.setItem(getKey(), JSON.stringify(updated)).catch(() => {});
  }, [getKey]);

  const isFollowingHashtag = useCallback(
    (tag: string) => followedHashtags.includes(normalizeTag(tag)),
    [followedHashtags]
  );

  const toggleHashtag = useCallback(
    (tag: string) => {
      const normalized = normalizeTag(tag);
      if (!normalized) return;
      dirty.current = true;
      setFollowedHashtags((prev) => {
        const next = prev.includes(normalized)
          ? prev.filter((t) => t !== normalized)
          : [...prev, normalized];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <HashtagContext.Provider value={{ followedHashtags, toggleHashtag, isFollowingHashtag }}>
      {children}
    </HashtagContext.Provider>
  );
}

export function useHashtags() {
  const ctx = useContext(HashtagContext);
  if (!ctx) {
    throw new Error('useHashtags must be used within a HashtagProvider');
  }
  return ctx;
}
