// storyTray.ts — REAL-data story helpers (IG pattern).
// Stories are FIRST-CLASS entities posted via /api/app/stories (24h lifetime,
// user-chosen display duration). They are NEVER derived from regular feed
// posts — a post is not a story. Consumers: Feed tray row, Story Viewer.

/** Author-placed text overlay on the story image (marketplace markup:
 *  price, condition, "2 left", etc). Zone = vertical placement band. */
export interface StoryOverlay {
  text: string;
  zone: 'top' | 'middle' | 'bottom';
}

/** Product attached to a story — must reference the AUTHOR'S OWN listing
 *  (server validates ownership); tapping it in the viewer opens the listing. */
export interface StoryProductRef {
  id: string;
  title: string;
  image?: string;
  price?: number;
}

export interface AppStory {
  id: string;
  username: string;
  creatorName?: string | null;
  image: string;
  caption?: string | null;
  /** Display duration in ms chosen by the author at posting time */
  durationMs?: number | null;
  overlays?: StoryOverlay[] | null;
  productRef?: StoryProductRef | null;
  views?: number | null;
  createdAt: number;
  expiresAt?: number | null;
}

export type StoryEntry = {
  /** Author username — also the /story/<route> param */
  username: string;
  /** Display label under the ring (business name first, real rows only) */
  name: string;
  /** Latest story image used as the ring thumbnail */
  avatar?: string;
};

/** Group stories by author, newest author first, each author's stories newest first. */
export const groupStoriesByAuthor = (stories: AppStory[], maxAuthors = 10): StoryEntry[] => {
  const byAuthor = new Map<string, { name: string; avatar?: string; latestAt: number }>();
  // Input is already newest-first from the API; keep first-seen order.
  for (const s of stories) {
    if (!s.username || !s.image) continue;
    const cur = byAuthor.get(s.username);
    if (!cur) {
      byAuthor.set(s.username, {
        name: s.creatorName || s.username,
        avatar: s.image,
        latestAt: s.createdAt,
      });
    }
    if (byAuthor.size >= maxAuthors) break;
  }
  return Array.from(byAuthor.entries()).map(([username, v]) => ({
    username,
    name: v.name,
    avatar: v.avatar,
  }));
};

/** Serialize tray usernames into a deep-link param for the viewer (IG-style navigation). */
export const trayParam = (usernames: string[]): string =>
  usernames.filter(Boolean).join(',');

/** Parse a serialized tray param back into ordered usernames (expo-router safe). */
export const parseTrayParam = (param?: string | string[] | null): string[] => {
  const raw = Array.isArray(param) ? param[0] ?? '' : param ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

/** All ACTIVE stories for one author, newest first — the viewer's slides. */
export const storiesByUsername = (stories: AppStory[], username: string): AppStory[] =>
  stories
    .filter((s) => s.username === username && !!s.image)
    .sort((a, b) => b.createdAt - a.createdAt);
