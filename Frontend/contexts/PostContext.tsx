import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { serverApi } from '../utils/serverApi';

const POSTS_KEY_BASE = '@susej_feed_posts';
const HIDDEN_KEY_BASE = '@susej_hidden_posts';
const MUTED_KEY_BASE = '@susej_muted_sellers';
const REPORTS_KEY_BASE = '@susej_reports';
const LIKED_KEY_BASE = '@susej_liked_posts';
const TOMBSTONE_KEY_BASE = '@susej_deleted_post_ids';

export interface PostReport {
  id: string;
  postId: string;
  reason: string;
  time: number;
}

export interface PostVariantValue {
  label: string;
  priceDelta?: number;
  /** Per-value stock (Shopify-style inventory). Undefined = untracked. */
  stock?: number;
}

export interface PostVariant {
  name: string;
  values: PostVariantValue[];
}

export interface Post {
  id: string;
  sellerName: string;
  sellerUsername: string;
  sellerLocation: string;
  verified: boolean;
  price: number;
  description: string;
  category: string;
  /** User-picked (or typed) sub-categories under the main category. */
  subCategories?: string[];
  type?: 'product' | 'service' | 'food_item';
  hashtags: string[];
  likes: number;
  comments: number;
  commentList?: { author: string; text: string; time: number }[];
  createdAt: number;
  /** Seller-inventory state — true once the seller marks the listing sold. */
  isSold?: boolean;
  /** Visibility: 'published' (default) or 'hidden' (seller-deactivated or
   *  moderated). The server feed only serves published; hidden lives on here
   *  for the seller's own management screens. */
  status?: string;
  /** Seller-flagged storefront deal (Top Deal rail). */
  featured?: boolean;
  condition?: string;
  brand?: string;
  delivery?: boolean;
  /** Fulfillment mode picked at listing creation (pickup/shipping/local). */
  deliveryMode?: string;
  /** Seller-declared shipping fee (applies when deliveryMode is shipping). */
  shippingFee?: number;
  duration?: string;
  availability?: string;
  jobType?: string;
  experience?: string;
  company?: string;
  salaryRange?: string;
  listingFor?: 'sale' | 'rent';
  negotiable?: boolean;
  moq?: string;
  leadTime?: string;
  image?: string;
  /** Multi-photo carousel — first entry is the primary image (`image`). */
  images?: string[];
  /** Variant selector — e.g. Size/Colour with optional per-value price deltas. */
  variants?: PostVariant[];
  /** MRP (list price) for strikethrough discount display — optional, goods only. */
  mrp?: number;
  /** Remaining stock for scarcity badges — optional, goods only. */
  stockLeft?: number;
  /**
   * Optional per-listing SELLING location picked on the live map (separate
   * from the seller's store address) — powers delivery-area context.
   */
  listingLat?: number;
  listingLng?: number;
  listingLocation?: string;
  /** Server truth: whether the CURRENT user liked this post (synced). */
  likedByMe?: boolean;
}



interface PostContextType {
  posts: Post[];
  loaded: boolean;
  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments'>) => void;
  removePost: (id: string) => void;
  deletePost: (id: string) => void;
  addComment: (postId: string, comment: { author: string; text: string }) => void;
  toggleLike: (postId: string) => boolean;
  isLiked: (postId: string) => boolean;
  updatePost: (id: string, patch: Partial<Post>) => void;
  toggleSold: (id: string) => void;
  hiddenPostIds: string[];
  hidePost: (id: string) => void;
  mutedSellers: string[];
  toggleMuteSeller: (username: string) => void;
  /**
   * Files a moderation report that lands in the admin queue (ReportedProduct).
   * Resolves true only when the server stored it — callers must show success
   * or failure honestly, never a blind "submitted".
   */
  reportPost: (postId: string, reason: string) => Promise<boolean>;
  /** Real user-filed reports (admin/reports queue reads these). */
  reports: PostReport[];
  /** Re-fetch + reconcile server posts (pull-to-refresh). Cache wins on failure. */
  refresh: () => Promise<void>;
}

const PostContext = createContext<PostContextType | null>(null);

/** Server posts use Prisma cuid ids (no prefix); local demo posts are `post_...`. */
function isServerPostId(id: string): boolean {
  return !id.startsWith('post_') && !/^\d+$/.test(id);
}

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const likedRef = useRef<Record<string, boolean>>({});
  const [tombstones, setTombstones] = useState<string[]>([]);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [mutedSellers, setMutedSellers] = useState<string[]>([]);
  const [reports, setReports] = useState<PostReport[]>([]);
  const [modLoaded, setModLoaded] = useState(false);

  const getPostsKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${POSTS_KEY_BASE}:${u}` : POSTS_KEY_BASE;
  }, [user?.username]);

  // Load cached posts per-user (offline mirror). Falls back to legacy global key on first run per account.
  useEffect(() => {
    let cancelled = false;
    const key = getPostsKey();
    const load = async () => {
      let data: string | null = null;
      try { data = await AsyncStorage.getItem(key); } catch {}
      if (!data && key !== POSTS_KEY_BASE) {
        try { data = await AsyncStorage.getItem(POSTS_KEY_BASE); } catch {}
        if (data) { try { await AsyncStorage.setItem(key, data); } catch {} }
      }
      if (cancelled) return;
      if (data) {
        try {
          const parsed = JSON.parse(data) as Post[];
          const LEGACY_SEED_ID = /^post_\d{1,6}$|^demo/;
          const saved = parsed.filter(
            (p) =>
              p &&
              typeof p.image !== 'number' &&
              !(Array.isArray(p.images) && p.images.some((i) => typeof i === 'number')) &&
              !LEGACY_SEED_ID.test(p.id)
          );
          const sorted = saved.sort((a, b) => b.createdAt - a.createdAt);
          setPosts(sorted);
        } catch {
          // corrupted cache — start empty; server sync will repopulate
        }
      }
      if (!cancelled) setLoaded(true);
    };
    setLoaded(false);
    setPosts([]);
    load();
    return () => { cancelled = true; };
  }, [getPostsKey, tokenSeq]);


  const getHiddenKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${HIDDEN_KEY_BASE}:${u}` : HIDDEN_KEY_BASE;
  }, [user?.username]);
  const getMutedKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${MUTED_KEY_BASE}:${u}` : MUTED_KEY_BASE;
  }, [user?.username]);
  const getReportsKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${REPORTS_KEY_BASE}:${u}` : REPORTS_KEY_BASE;
  }, [user?.username]);
  const getLikedKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${LIKED_KEY_BASE}:${u}` : LIKED_KEY_BASE;
  }, [user?.username]);
  const getTombstoneKey = useCallback(() => {
    const u = user?.username?.trim();
    return u ? `${TOMBSTONE_KEY_BASE}:${u}` : TOMBSTONE_KEY_BASE;
  }, [user?.username]);

  const persistMod = useCallback((key: string, value: unknown) => {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, []);

  // Reset moderation state on account switch (tokenSeq) to prevent
  // cross-account data leaks: User A's hidden/muted/liked/tombstone state
  // must not appear for User B after logout -> login.
  useEffect(() => {
    setHiddenPostIds([]);
    setMutedSellers([]);
    setReports([]);
    setLiked({});
    likedRef.current = {};
    setTombstones([]);
    setModLoaded(false);
  }, [tokenSeq]);

  // Load moderation state per-user (hidden posts, muted sellers, reports, liked posts, tombstones)
  useEffect(() => {
    let cancelled = false;
    const hiddenKey = getHiddenKey();
    const mutedKey = getMutedKey();
    const reportsKey = getReportsKey();
    const likedKey = getLikedKey();
    const tombKey = getTombstoneKey();
    Promise.all([
      AsyncStorage.getItem(hiddenKey),
      AsyncStorage.getItem(mutedKey),
      AsyncStorage.getItem(reportsKey),
      AsyncStorage.getItem(likedKey),
      AsyncStorage.getItem(tombKey),
    ])
      .then(([hidden, muted, rep, likedData, tombData]) => {
        if (cancelled) return;
        try {
          const parsed = hidden ? JSON.parse(hidden) : null;
          if (Array.isArray(parsed)) setHiddenPostIds(parsed); else setHiddenPostIds([]);
        } catch { if (!cancelled) setHiddenPostIds([]); }
        try {
          const parsed = muted ? JSON.parse(muted) : null;
          if (Array.isArray(parsed)) setMutedSellers(parsed); else setMutedSellers([]);
        } catch { if (!cancelled) setMutedSellers([]); }
        try {
          const parsed = rep ? JSON.parse(rep) : null;
          if (Array.isArray(parsed)) setReports(parsed); else setReports([]);
        } catch { if (!cancelled) setReports([]); }
        try {
          const parsed = likedData ? JSON.parse(likedData) : null;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setLiked(parsed);
            likedRef.current = parsed;
          } else { setLiked({}); likedRef.current = {}; }
        } catch { if (!cancelled) { setLiked({}); likedRef.current = {}; } }
        try {
          const parsed = tombData ? JSON.parse(tombData) : null;
          if (Array.isArray(parsed)) setTombstones(parsed.filter((x: unknown) => typeof x === 'string')); else setTombstones([]);
        } catch { if (!cancelled) setTombstones([]); }
        if (!cancelled) setModLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setModLoaded(true);
      });
    return () => { cancelled = true; };
  }, [getHiddenKey, getMutedKey, getReportsKey, getLikedKey, getTombstoneKey, tokenSeq]);

  // Persist whenever posts change (skip initial seed load)
  const persist = useCallback((updated: Post[]) => {
    AsyncStorage.setItem(getPostsKey(), JSON.stringify(updated)).catch(() => {});
  }, [getPostsKey]);

  // Persist posts + tombstones via effects once loaded (no side-effects inside updaters)
  useEffect(() => {
    if (!loaded) return;
    persist(posts);
  }, [posts, loaded, persist]);

  useEffect(() => {
    if (!loaded || !modLoaded) return;
    persistMod(getTombstoneKey(), tombstones);
  }, [tombstones, loaded, modLoaded, getTombstoneKey, persistMod]);

  // ── Server sync: pull the shared backend's posts once per login, merge the
  // real multi-user feed with local cache (server wins, tombstones respected).
  const normalizeServerPost = useCallback((p: any): Post | null => {
    if (!p || !p.id) return null;
    return {
      type: (p.type as Post["type"]) ?? 'product',
      id: String(p.id),
      description: String(p.description ?? p.title ?? 'Untitled'),
      price: Number(p.price ?? 0),
      mrp: p.mrp != null && Number(p.mrp) > Number(p.price ?? 0) ? Number(p.mrp) : undefined,
      category: String(p.category ?? 'General'),
      subCategories: Array.isArray(p.subCategories) ? p.subCategories.map(String) : undefined,
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : [],
      likes: Number(p.likes ?? 0),
      comments: Number(p.comments ?? 0),
      createdAt: typeof p.createdAt === 'string' ? Date.parse(p.createdAt) : Number(p.createdAt ?? Date.now()),
      image: String(p.image ?? ''),
      images: Array.isArray(p.images) ? p.images.map(String) : [],
      isSold: Boolean(p.isSold),
      status: typeof p.status === 'string' ? p.status : undefined,
      verified: Boolean(p.verified),
      featured: Boolean(p.featured),
      sellerUsername: String(p.sellerUsername ?? 'user'),
      sellerName: String(p.sellerName ?? p.sellerUsername ?? 'susej user'),
      sellerLocation: String(p.sellerLocation ?? ''),
      variants: Array.isArray(p.variants) ? p.variants : undefined,
      stockLeft: typeof p.stockLeft === 'number' ? p.stockLeft : undefined,
      condition: p.condition ? String(p.condition) : undefined,
      brand: p.brand ? String(p.brand) : undefined,
      delivery: p.deliveryMode ? true : undefined,
      deliveryMode: typeof p.deliveryMode === 'string' ? p.deliveryMode : undefined,
      shippingFee: typeof p.shippingFee === 'number' ? p.shippingFee : undefined,
      negotiable: typeof p.negotiable === 'boolean' ? p.negotiable : undefined,
      listingLat: typeof p.listingLat === 'number' ? p.listingLat : undefined,
      listingLng: typeof p.listingLng === 'number' ? p.listingLng : undefined,
      listingLocation: p.listingLocation ? String(p.listingLocation) : undefined,
      likedByMe: Boolean(p.likedByMe),
    };
  }, []);

  // Re-seed on every account switch (tokenSeq) so the feed reflects the
  // new account's likedByMe + server posts, even with an identical username.
  const serverSeeded = useRef(-1);
  useEffect(() => {
    if (!loaded || !modLoaded || !user?.username) return;
    if (serverSeeded.current === tokenSeq) return;
    serverSeeded.current = tokenSeq;
    serverApi.getPosts().then((res) => {
      // An EMPTY server feed is still the truth — it must clear cached
      // server-sourced posts (e.g. after a data reset). Only !ok skips.
      if (!res.ok) return;
      const serverPosts = (res.data?.posts ?? []).map(normalizeServerPost).filter(Boolean) as Post[];
      // Seed liked map from server truth — REPLACE, not merge, so an
      // unlike on another device clears the local entry.
      const serverLikedIds = new Set(serverPosts.filter((sp) => sp.likedByMe).map((sp) => sp.id));
      const nextLiked: Record<string, boolean> = {};
      for (const sp of serverPosts) if (sp.likedByMe) nextLiked[sp.id] = true;
      // Keep only local-only (post_*) likes that server doesn't know about;
      // drop stale server likes where server says not liked.
      for (const [k, v] of Object.entries(likedRef.current)) {
        if (k.startsWith('post_') && v) nextLiked[k] = true;
      }
      likedRef.current = nextLiked;
      setLiked(nextLiked);
      if (Object.keys(nextLiked).length) persistMod(getLikedKey(), nextLiked);
      else persistMod(getLikedKey(), {});
      // Reconcile: the server response IS the truth for everything it manages.
      // Previously-cached server posts that are absent from the response were
      // deleted/removed server-side and must vanish from every device.
      // Only offline-created local posts ('post_' ids, not yet synced) survive.
      setPosts((prev) => {
        const localOnly = prev.filter((p) => p.id.startsWith('post_') && p.sellerUsername === user.username);
        const visible = serverPosts.filter((sp) => !tombstones.includes(sp.id));
        return [...visible, ...localOnly];
      });
    });
  }, [loaded, modLoaded, user?.username, tokenSeq, tombstones, normalizeServerPost, getLikedKey, persistMod]);

  // User-initiated full refresh (pull-to-refresh): re-fetch server posts and reconcile —
  // same merge as the seed above (cache wins on request failure — honest no-spinner-lie).
  const refresh = useCallback(async () => {
    if (!user?.username) return;
    const res = await serverApi.getPosts();
    if (!res.ok) return;
    const rawPosts = ((res.data?.posts ?? []) as any[]);
    const serverPosts = rawPosts
      .map((p) => normalizeServerPost(p))
      .filter((p) => p !== null) as Post[];
    const nextLiked: Record<string, boolean> = {};
    for (const sp of serverPosts) {
      if (sp.likedByMe) nextLiked[sp.id] = true;
    }
    for (const [k, v] of Object.entries(likedRef.current)) {
      if (k.startsWith('post_') && v) nextLiked[k] = true;
    }
    likedRef.current = nextLiked;
    setLiked(nextLiked);
    if (Object.keys(nextLiked).length > 0) persistMod(getLikedKey(), nextLiked);
    else persistMod(getLikedKey(), {});
    setPosts((prev) => {
      const localOnly = prev.filter((p) => p.id.startsWith('post_') && p.sellerUsername === user.username);
      const visible = serverPosts.filter((sp) => !tombstones.includes(sp.id));
      return [...visible, ...localOnly];
    });
  }, [normalizeServerPost, user?.username, tombstones, getLikedKey, persistMod]);
 
  const hidePost = useCallback(
    (id: string) => {
      setHiddenPostIds((prev) => {
        if (prev.includes(id)) return prev;
        const updated = [...prev, id];
        if (modLoaded) persistMod(getHiddenKey(), updated);
        return updated;
      });
    },
    [modLoaded, persistMod, getHiddenKey]
  );

  const toggleMuteSeller = useCallback(
    (username: string) => {
      setMutedSellers((prev) => {
        const updated = prev.includes(username)
          ? prev.filter((u) => u !== username)
          : [...prev, username];
        if (modLoaded) persistMod(getMutedKey(), updated);
        return updated;
      });
    },
    [modLoaded, persistMod, getMutedKey]
  );

  const reportPost = useCallback(
    async (postId: string, reason: string): Promise<boolean> => {
      const row = {
        id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        postId,
        reason,
        time: Date.now(),
      };
      setReports((prev) => {
        const updated = [...prev, row];
        if (modLoaded) persistMod(getReportsKey(), updated);
        return updated;
      });
      try {
        const res = await serverApi.reportPost(postId, reason);
        if (res.ok) return true;
      } catch {}
      // Server refused/offline: retract the local mirror so the user is never
      // told a report was filed when the moderation queue never got it.
      setReports((prev) => {
        const updated = prev.filter((r) => r.id !== row.id);
        if (modLoaded) persistMod(getReportsKey(), updated);
        return updated;
      });
      return false;
    },
    [modLoaded, persistMod, getReportsKey]
  );

  const addPost = useCallback(
    (input: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments'>) => {
      const localId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newPost: Post = {
        type: 'product',
        ...input,
        id: localId,
        likes: 0,
        comments: 0,
        createdAt: Date.now(),
      };
      setPosts((prev) => [newPost, ...prev]);
      // Push to the shared backend — on success the local id is replaced by the
      // real server id so likes/comments/delete all hit the same row.
      serverApi
        .createPost({
          title: String(input.description ?? '').split('\n')[0].slice(0, 200) || 'New listing',
          price: input.price,
          description: input.description,
          category: input.category,
          image: input.image,
          images: input.images,
          hashtags: input.hashtags,
          mrp: input.mrp,
          stockLeft: input.stockLeft,
          condition: input.condition,
          brand: input.brand,
          negotiable: input.negotiable,
          deliveryMode: input.deliveryMode,
          shippingFee: input.shippingFee,
          listingFor: input.listingFor,
          listingLat: input.listingLat,
          listingLng: input.listingLng,
          listingLocation: input.listingLocation,
        })
        .then((res) => {
          if (res.ok && res.data?.post?.id) {
            const serverId = String(res.data.post.id);
            setPosts((prev) => prev.map((p) => (p.id === localId ? { ...p, id: serverId } : p)));
          }
        })
        .catch(() => {});
    },
    []
  );

  const removePost = useCallback(
    (id: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTombstones((prev) => (prev.includes(id) ? prev : [...prev, id]));
      if (isServerPostId(id)) {
        serverApi.deletePost(id).catch(() => {});
      }
    },
    []
  );

  const deletePost = useCallback(
    (id: string) => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTombstones((prev) => (prev.includes(id) ? prev : [...prev, id]));
      if (isServerPostId(id)) {
        serverApi.deletePost(id).catch(() => {});
      }
    },
    []
  );

  const updatePost = useCallback(
    (id: string, patch: Partial<Post>) => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      if (isServerPostId(id)) {
        const sp: Record<string, unknown> = {};
        if (patch.description !== undefined) {
          sp.title = String(patch.description).split('\n')[0].slice(0, 200);
          sp.description = patch.description;
        }
        if (patch.price !== undefined) sp.price = patch.price;
        if (patch.category !== undefined) sp.category = patch.category;
        if (patch.isSold !== undefined) sp.isSold = patch.isSold;
        // Shop deactivation: the server accepts author-set hidden/published
        // (featured stays engine-owned and is ignored there).
        if (patch.status !== undefined) sp.status = patch.status;
        if (patch.featured !== undefined) sp.featured = patch.featured;
        // Edit parity: seller-side edits to media/inventory/fulfillment must
        // reach the server or the storefront silently diverges per device.
        if (patch.images !== undefined) sp.images = patch.images;
        if (patch.image !== undefined && patch.images === undefined) sp.images = [patch.image];
        if (patch.variants !== undefined) sp.variants = patch.variants;
        if (patch.stockLeft !== undefined) sp.stockLeft = patch.stockLeft;
        if (patch.negotiable !== undefined) sp.negotiable = patch.negotiable;
        if (patch.condition !== undefined) sp.condition = patch.condition;
        if (patch.deliveryMode !== undefined) sp.deliveryMode = patch.deliveryMode;
        if (patch.shippingFee !== undefined) sp.shippingFee = patch.shippingFee;
        if (Object.keys(sp).length) serverApi.updatePost(id, sp).catch(() => {});
      }
    },
    []
  );

  const toggleSold = useCallback(
    (id: string) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const nextSold = !p.isSold;
          if (isServerPostId(id)) {
            serverApi.updatePost(id, { isSold: nextSold }).catch(() => {});
          }
          return { ...p, isSold: nextSold };
        })
      );
    },
    []
  );

  const addComment = useCallback(
    (postId: string, comment: { author: string; text: string }) => {
      setPosts((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== postId) return p;
          const entry = { author: comment.author, text: comment.text, time: Date.now() };
          return {
            ...p,
            comments: p.comments + 1,
            commentList: p.commentList ? [...p.commentList, entry] : [entry],
          };
        });
        return updated;
      });
      if (isServerPostId(postId)) {
        serverApi.addComment(postId, comment.text).catch(() => {});
      }
    },
    []
  );

  const toggleLike = useCallback(
    (postId: string): boolean => {
      // Derive from the latest liked map (ref keeps rapid taps race-free)
      const nextLiked = !likedRef.current[postId];
      const prevLiked = !!likedRef.current[postId];
      likedRef.current = { ...likedRef.current, [postId]: nextLiked };
      setLiked((prev) => ({ ...prev, [postId]: nextLiked }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)) } : p
        )
      );
      if (modLoaded) persistMod(getLikedKey(), likedRef.current);
      if (isServerPostId(postId)) {
        serverApi.toggleLike(postId).catch(() => {
          // Server rejected (offline/401/409): rollback optimistic like to keep truth.
          likedRef.current = { ...likedRef.current, [postId]: prevLiked };
          setLiked((prev) => ({ ...prev, [postId]: prevLiked }));
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, likes: Math.max(0, p.likes + (nextLiked ? -1 : 1)) } : p
            )
          );
          // Revert persisted liked map (posts effect will persist posts separately)
          persistMod(getLikedKey(), likedRef.current);
        });
      }
      return nextLiked;
    },
    [modLoaded, persistMod, getLikedKey]
  );

  const isLiked = useCallback((postId: string) => !!liked[postId], [liked]);

  return (
    <PostContext.Provider value={{ posts, loaded, refresh, addPost, removePost, deletePost, addComment, toggleLike, isLiked, updatePost, toggleSold, hiddenPostIds, hidePost, mutedSellers, toggleMuteSeller, reportPost, reports }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePosts() {
  const ctx = useContext(PostContext);
  if (!ctx) {
    throw new Error('usePosts must be used within a PostProvider');
  }
  return ctx;
}
