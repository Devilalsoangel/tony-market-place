// myStory.ts — the user's OWN uploaded story (create-story -> feed/profile/viewer).
// Saved as JSON under @susej_my_story; feed + profile + story viewer all read it so an
// uploaded story is actually VISIBLE (ring + image + caption) instead of vanishing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoryOverlay, StoryProductRef } from './storyTray';

export const MY_STORY_KEY_BASE = '@susej_my_story';
export const MY_STORY_KEY = MY_STORY_KEY_BASE;

async function getMyStoryKey(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('app_user');
    if (raw) {
      const u = JSON.parse(raw) as { username?: string };
      const name = typeof u?.username === 'string' ? u.username.trim() : '';
      if (name) return `${MY_STORY_KEY_BASE}:${name}`;
    }
  } catch {}
  return MY_STORY_KEY_BASE;
}

export interface MyStory {
  image: string; // uri of the story media
  caption: string;
  time: number; // epoch ms when posted
  /** How long the story stays on screen per view (ms, 3-60s, IG-style choice) */
  duration?: number;
  /** Author text markup rendered over the image (top/middle/bottom bands). */
  overlays?: StoryOverlay[];
  /** Attached own listing — viewer renders a tappable product chip. */
  productRef?: StoryProductRef;
}

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // stories expire after 24h

/** Clamp a chosen display duration to the supported 3-60s window. */
export const clampStoryDuration = (ms: number): number =>
  Math.min(60000, Math.max(3000, Math.round(ms)));

/** True when a story is older than the 24h lifetime (IG behavior). */
export const isStoryExpired = (time: number): boolean => Date.now() - time > STORY_LIFETIME_MS;

export const loadMyStory = async (): Promise<MyStory | null> => {
  try {
    const key = await getMyStoryKey();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      if (key !== MY_STORY_KEY_BASE) {
        const legacy = await AsyncStorage.getItem(MY_STORY_KEY_BASE);
        if (legacy) {
          const p = JSON.parse(legacy) as MyStory;
          if (p && typeof p.image === 'string' && p.image && !isStoryExpired(p.time)) return p;
        }
      }
      return null;
    }
    const parsed = JSON.parse(raw) as MyStory;
    if (!parsed || typeof parsed.image !== 'string' || !parsed.image) return null;
    if (isStoryExpired(parsed.time)) return null; // silently expired
    return parsed;
  } catch {
    return null;
  }
};

export const saveMyStory = async (story: MyStory): Promise<void> => {
  const key = await getMyStoryKey();
  await AsyncStorage.setItem(key, JSON.stringify(story));
};

/** Time ago label for the viewer header, e.g. "Just now", "2h" */
export const storyAge = (time: number): string => {
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};
