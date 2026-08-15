import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

const HASHTAGS_KEY = '@susej_followed_hashtags';

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
  const [followedHashtags, setFollowedHashtags] = useState<string[]>([]);
  const dirty = useRef(false);

  // Load from AsyncStorage on mount and re-sync whenever the screen regains
  // focus — providers are mounted per-screen (feed + hashtag page), so focus
  // reload keeps both instances in sync with the persisted value.
  const load = useCallback(() => {
    if (dirty.current) return;
    AsyncStorage.getItem(HASHTAGS_KEY)
      .then((data) => {
        if (!data) return;
        try {
          const arr = JSON.parse(data) as string[];
          setFollowedHashtags(arr.map(normalizeTag).filter(Boolean));
        } catch {
          // corrupted data — start fresh
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const persist = useCallback((updated: string[]) => {
    AsyncStorage.setItem(HASHTAGS_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

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
