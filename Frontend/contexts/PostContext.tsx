import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { productDetailImages } from '../utils/screenImages';

const POSTS_KEY = '@susej_feed_posts';
const HIDDEN_KEY = '@susej_hidden_posts';
const MUTED_KEY = '@susej_muted_sellers';
const REPORTS_KEY = '@susej_reports';
const LIKED_KEY = '@susej_liked_posts';
const TOMBSTONE_KEY = '@susej_deleted_post_ids';

export interface PostReport {
  id: string;
  postId: string;
  reason: string;
  time: number;
}

export interface PostVariantValue {
  label: string;
  priceDelta?: number;
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
  /** Seller-flagged storefront deal (Top Deal rail). */
  featured?: boolean;
  condition?: string;
  brand?: string;
  delivery?: boolean;
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
}

const SEED_POSTS: Post[] = [
  {
    id: 'post_001',
    sellerName: 'NeoDrip Fashion',
    sellerUsername: 'luxe',
    sellerLocation: 'Mumbai, India',
    verified: true,
    price: 4999,
    mrp: 6999,
    stockLeft: 3,
    description: 'Vintage silk saree with hand-embroidered border. Perfect for weddings and festive occasions. #vintage #silk #handmade',
    category: 'Fashion',
    hashtags: ['#vintage', '#silk', '#handmade'],
    likes: 42,
    comments: 8,
    commentList: [
      { author: 'Ananya Sharma', text: 'Gorgeous piece! Is the border hand-done?', time: Date.now() - 86400000 * 2 },
      { author: 'Raj Patel', text: 'Beautiful! Can you hold it till Friday?', time: Date.now() - 3600000 * 20 },
      { author: 'Meera K.', text: 'The colour is so rich in person too.', time: Date.now() - 3600000 * 5 },
    ],
    images: [
      'https://picsum.photos/seed/susejsaree1/800/1000',
      'https://picsum.photos/seed/susejsaree2/800/1000',
      'https://picsum.photos/seed/susejsaree3/800/1000',
    ],
    variants: [
      {
        name: 'Size',
        values: [
          { label: 'S' },
          { label: 'M', priceDelta: 300 },
          { label: 'L', priceDelta: 600 },
          { label: 'XL', priceDelta: 900 },
        ],
      },
      {
        name: 'Colour',
        values: [
          { label: 'Maroon' },
          { label: 'Royal Blue', priceDelta: 150 },
          { label: 'Emerald', priceDelta: 150 },
        ],
      },
    ],
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'post_002',
    sellerName: 'TechVault',
    sellerUsername: 'techvault',
    sellerLocation: 'Bangalore, India',
    verified: false,
    price: 45999,
    mrp: 52999,
    stockLeft: 1,
    description: 'MacBook Pro M3 - 16GB RAM, 512GB SSD. Like new condition, bill included. #electronics #macbook',
    category: 'Electronics',
    hashtags: ['#electronics', '#macbook'],
    likes: 128,
    comments: 23,
    commentList: [
      { author: 'Sara T.', text: 'Battery health percentage?', time: Date.now() - 86400000 },
      { author: 'Vikram N.', text: 'Any scratches on the lid?', time: Date.now() - 3600000 * 8 },
    ],
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'post_003',
    sellerName: 'Urban Jungle',
    sellerUsername: 'urbanjungle',
    sellerLocation: 'Delhi, India',
    verified: true,
    price: 1299,
    mrp: 1599,
    description: 'Handmade ceramic plant pot set of 3. Each piece is uniquely glazed. #homedecor #ceramic #plants',
    category: 'Home',
    hashtags: ['#homedecor', '#ceramic', '#plants'],
    image: 'https://picsum.photos/seed/urbanjungle/800/1000',
    likes: 67,
    comments: 12,
    commentList: [
      { author: 'Priya Singh', text: 'Love the glaze! Do you ship to Chennai?', time: Date.now() - 3600000 * 6 },
      { author: 'Aisha R.', text: 'Got mine last week — so well packed.', time: Date.now() - 3600000 * 3 },
    ],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'post_004',
    sellerName: 'Brush & Style Studio',
    sellerUsername: 'brushstyle',
    sellerLocation: 'Mumbai, India',
    verified: true,
    price: 7999,
    description: 'Professional interior painting & home styling. Free consultation, premium finishes. #homeservices #interior #styling',
    category: 'Home Services',
    type: 'service',
    hashtags: ['#homeservices', '#interior', '#styling'],
    likes: 31,
    comments: 6,
    commentList: [
      { author: 'Karan M.', text: 'Do you also do exterior painting?', time: Date.now() - 86400000 * 3 },
      { author: 'Neha D.', text: 'Booked a consultation, very responsive!', time: Date.now() - 86400000 },
    ],
    createdAt: Date.now() - 86400000 * 4,
    image: 'https://picsum.photos/seed/homeservice/800/1000',
  },
  {
    id: 'post_005',
    sellerName: 'FreshBasket',
    sellerUsername: 'freshbasket',
    sellerLocation: 'Pune, India',
    verified: true,
    price: 499,
    description: 'Organic farm-fresh vegetable box — 5kg seasonal produce delivered today. #organic #groceries #freshtoday',
    category: 'Food',
    type: 'food_item',
    hashtags: ['#organic', '#groceries', '#freshtoday'],
    likes: 89,
    comments: 14,
    commentList: [
      { author: 'Rohit J.', text: 'The box is a steal at this price.', time: Date.now() - 3600000 * 10 },
      { author: 'Sneha P.', text: 'Got it in 40 mins today. So fresh!', time: Date.now() - 3600000 * 4 },
      { author: 'Aman V.', text: 'Does the seasonal mix change weekly?', time: Date.now() - 1800000 },
    ],
    createdAt: Date.now() - 86400000,
    image: 'https://picsum.photos/seed/organicveg/800/1000',
  },
  {
    id: 'post_006',
    sellerName: 'TechNova Labs',
    sellerUsername: 'technova',
    sellerLocation: 'Bengaluru, India',
    verified: true,
    price: 10,
    description: 'React Native Developer\n#jobs #technology\nTechNova Labs, Bengaluru — 1–3 yrs, ₹8–12 LPA.',
    category: 'Jobs',
    type: 'product',
    hashtags: ['#jobs', '#technology'],
    jobType: 'Full-time',
    experience: '1–3 yrs',
    company: 'TechNova Labs',
    salaryRange: '8–12',
    likes: 15,
    comments: 3,
    commentList: [
      { author: 'Riya K.', text: 'Remote or on-site?', time: Date.now() - 3600000 * 2 },
    ],
    image: 'https://picsum.photos/seed/devjob/800/1000',
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'post_007',
    sellerName: 'HomeSquare Realty',
    sellerUsername: 'homesquare',
    sellerLocation: 'Bengaluru, India',
    verified: true,
    price: 18000,
    description: '2BHK Apartment for Rent\n#realestate #rental\nNear Indiranagar Metro — ₹18,000/mo, semi-furnished.',
    category: 'Real Estate',
    hashtags: ['#realestate', '#rental'],
    listingFor: 'rent',
    negotiable: true,
    likes: 54,
    comments: 9,
    commentList: [
      { author: 'Aditya R.', text: 'Is the rent inclusive of maintenance?', time: Date.now() - 3600000 * 5 },
      { author: 'Farah S.', text: 'Pet friendly?', time: Date.now() - 3600000 },
    ],
    image: 'https://picsum.photos/seed/2bhkflat/800/1000',
    createdAt: Date.now() - 3600000 * 4,
  },
  {
    id: 'post_008',
    sellerName: 'WeaveRight Textiles',
    sellerUsername: 'weaveright',
    sellerLocation: 'Surat, India',
    verified: true,
    price: 850,
    description: 'Cotton Fabric (Wholesale)\n#b2b #textiles\nBulk pricing — MOQ 100 kg, dispatch in 7 days.',
    category: 'B2B',
    hashtags: ['#b2b', '#textiles'],
    moq: '100 kg',
    leadTime: '7 days',
    likes: 22,
    comments: 4,
    commentList: [
      { author: 'Prakash M.', text: 'Do you ship pan-India?', time: Date.now() - 3600000 * 8 },
    ],
    image: 'https://picsum.photos/seed/cottonfabric/800/1000',
    createdAt: Date.now() - 3600000 * 7,
  },
  {
    id: 'post_009',
    sellerName: 'SmileCraft Dental Clinic',
    sellerUsername: 'smilecraft',
    sellerLocation: 'Pune, India',
    verified: true,
    price: 500,
    description: 'Dental Consultation\n#medical #health\nGeneral & cosmetic dental check-up — ₹500.',
    category: 'Medical',
    type: 'service',
    hashtags: ['#medical', '#health'],
    duration: '30 min',
    availability: 'Weekdays',
    likes: 31,
    comments: 6,
    commentList: [
      { author: 'Tanvi P.', text: 'Do you do root canals too?', time: Date.now() - 3600000 * 3 },
      { author: 'Harsh V.', text: 'Booked for Thursday, thanks!', time: Date.now() - 1800000 },
    ],
    image: 'https://picsum.photos/seed/dentalclinic/800/1000',
    createdAt: Date.now() - 3600000 * 6,
  },
  {
    id: 'post_010',
    sellerName: 'FluentFirst Academy',
    sellerUsername: 'fluentfirst',
    sellerLocation: 'Delhi, India',
    verified: false,
    price: 2500,
    description: 'Spoken English Course\n#education #learning\n8-week weekend batch — ₹2,500.',
    category: 'Education',
    type: 'service',
    hashtags: ['#education', '#learning'],
    duration: '8 weeks',
    availability: 'Weekends',
    likes: 47,
    comments: 11,
    commentList: [
      { author: 'Ishaan G.', text: 'Certificate provided at the end?', time: Date.now() - 3600000 * 12 },
      { author: 'Nisha T.', text: 'Morning or evening batches?', time: Date.now() - 3600000 * 2 },
    ],
    image: 'https://picsum.photos/seed/englishclass/800/1000',
    createdAt: Date.now() - 3600000 * 5,
  },
];

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
  reportPost: (postId: string, reason: string) => void;
}

const PostContext = createContext<PostContextType | null>(null);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [loaded, setLoaded] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const likedRef = useRef<Record<string, boolean>>({});
  const [tombstones, setTombstones] = useState<string[]>([]);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [mutedSellers, setMutedSellers] = useState<string[]>([]);
  const [reports, setReports] = useState<PostReport[]>([]);
  const [modLoaded, setModLoaded] = useState(false);

  // Load from AsyncStorage on mount, merging with seed posts
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(POSTS_KEY), AsyncStorage.getItem(TOMBSTONE_KEY)])
      .then(([data, tombData]) => {
        const tombstoneIds: string[] = [];
        if (tombData) {
          try {
            const parsed = JSON.parse(tombData) as string[];
            if (Array.isArray(parsed)) tombstoneIds.push(...parsed);
          } catch {}
        }
        setTombstones(tombstoneIds);
        if (data) {
          try {
            const parsed = JSON.parse(data) as Post[];
            // Sanitize: drop posts whose image/issue is a raw require() NUMBER —
            // RN new-arch crashes on numeric source from persisted state
            // ("Value for uri cannot be cast from Double to String").
            const saved = parsed.filter(
              (p) => p && typeof p.image !== 'number' && !(Array.isArray(p.images) && p.images.some((i) => typeof i === 'number'))
            );
            // Merge saved posts with seeds — saved take priority by id.
            // Deleted (tombstoned) ids are never re-inserted, so removed seed posts stay removed.
            const merged = new Map<string, Post>();
            for (const p of SEED_POSTS) {
              if (!tombstoneIds.includes(p.id)) merged.set(p.id, p);
            }
            for (const p of saved) {
              if (!tombstoneIds.includes(p.id)) merged.set(p.id, p);
            }
            // Backfill commentList for seed posts saved before comments existed
            for (const seed of SEED_POSTS) {
              const existing = merged.get(seed.id);
              if (existing && !existing.commentList && seed.commentList) {
                merged.set(seed.id, { ...existing, commentList: seed.commentList });
              }
              // Backfill images/variants for seeds saved before those fields existed
              if (existing && !existing.images && seed.images) {
                merged.set(seed.id, { ...existing, images: seed.images });
              }
              if (existing && !existing.variants && seed.variants) {
                merged.set(seed.id, { ...existing, variants: seed.variants });
              }
              // Backfill mrp/stockLeft for seeds saved before those fields existed
              if (existing && existing.mrp == null && seed.mrp != null) {
                merged.set(seed.id, { ...existing, mrp: seed.mrp });
              }
              if (existing && existing.stockLeft == null && seed.stockLeft != null) {
                merged.set(seed.id, { ...existing, stockLeft: seed.stockLeft });
              }
            }
            // Sort by createdAt descending
            const sorted = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
            setPosts(sorted);
          } catch {
            // corrupted data, use seeds
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

// Demo-friendly: if the logged-in user has NO listings yet, seed 3 authored posts
  // (local bundled images — offline-safe) so their Profile grid never looks broken.
  // NOTE: use resolveAssetSource().uri — raw require() numbers stored in data crash
  // RN new-arch ImageView ("Value for uri cannot be cast from Double to String").
  useEffect(() => {
    if (!loaded || !user?.username) return;
    if (posts.some((p) => p.sellerUsername === user.username)) return;
    const ts = Date.now();
    const name = user.name || 'My Store';
    const loc = user.location || 'Mumbai, India';
    const uriOf = (asset: any): string => Image.resolveAssetSource(asset)?.uri ?? '';
    const g0 = uriOf(productDetailImages.gallery[0]);
    const g1 = uriOf(productDetailImages.gallery[1]);
    const g2 = uriOf(productDetailImages.gallery[2]);
    const demo: Post[] = [
      {
        id: `demo_${user.username}_1_${ts}`,
        sellerName: name,
        sellerUsername: user.username,
        sellerLocation: loc,
        verified: true,
        price: 4999,
        description: 'Freshly listed from my shop — handpicked & ready to ship. #newdrop #handpicked #susej',
        category: 'Fashion',
        hashtags: ['newdrop', 'handpicked', 'susej'],
        likes: 24,
        comments: 6,
        commentList: [
          { author: 'Priya', text: 'Obsessed with this piece!', time: ts - 3600000 },
          { author: 'Rohan', text: 'Shipping available?', time: ts - 1800000 },
        ],
        createdAt: ts - 7200000,
        image: g0,
        images: [g0],
      },
      {
        id: `demo-${user.username}-2-${ts}`,
        sellerName: name,
        sellerUsername: user.username,
        sellerLocation: loc,
        verified: true,
        price: 1499,
        description: 'Studio pick — minimal, premium, made to last. #minimal #premium #susej',
        category: 'Electronics',
        hashtags: ['minimal', 'premium', 'susej'],
        likes: 17,
        comments: 4,
        createdAt: ts - 3600000 * 5,
        image: g1,
        images: [g1],
      },
      {
        id: `demo_${user.username}_3_${ts}`,
        sellerName: name,
        sellerUsername: user.username,
        sellerLocation: loc,
        verified: false,
        price: 799,
        description: 'Community favourite back in stock. #restocked #susejpicks',
        category: 'Fashion',
        hashtags: ['restocked', 'susejpicks'],
        likes: 9,
        comments: 2,
        createdAt: ts - 3600000 * 7,
        image: g2,
        images: [g2],
      },
    ];
    setPosts((prev) => [...demo, ...prev]);
  }, [loaded, user?.username, user?.name, user?.location]);

  // Load moderation state (hidden posts, muted sellers, reports, liked posts) from AsyncStorage
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(HIDDEN_KEY),
      AsyncStorage.getItem(MUTED_KEY),
      AsyncStorage.getItem(REPORTS_KEY),
      AsyncStorage.getItem(LIKED_KEY),
    ])
      .then(([hidden, muted, rep, likedData]) => {
        try {
          const parsed = hidden ? JSON.parse(hidden) : null;
          if (Array.isArray(parsed)) setHiddenPostIds(parsed);
        } catch {}
        try {
          const parsed = muted ? JSON.parse(muted) : null;
          if (Array.isArray(parsed)) setMutedSellers(parsed);
        } catch {}
        try {
          const parsed = rep ? JSON.parse(rep) : null;
          if (Array.isArray(parsed)) setReports(parsed);
        } catch {}
        try {
          const parsed = likedData ? JSON.parse(likedData) : null;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setLiked(parsed);
            likedRef.current = parsed;
          }
        } catch {}
        setModLoaded(true);
      })
      .catch(() => {
        setModLoaded(true);
      });
  }, []);

  // Persist whenever posts change (skip initial seed load)
  const persist = useCallback((updated: Post[]) => {
    AsyncStorage.setItem(POSTS_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

  const persistMod = useCallback((key: string, value: unknown) => {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, []);

  // Persist posts + tombstones via effects once loaded (no side-effects inside updaters)
  useEffect(() => {
    if (!loaded) return;
    persist(posts);
  }, [posts, loaded, persist]);

  useEffect(() => {
    if (!loaded) return;
    persistMod(TOMBSTONE_KEY, tombstones);
  }, [tombstones, loaded, persistMod]);

  const hidePost = useCallback(
    (id: string) => {
      setHiddenPostIds((prev) => {
        if (prev.includes(id)) return prev;
        const updated = [...prev, id];
        if (modLoaded) persistMod(HIDDEN_KEY, updated);
        return updated;
      });
    },
    [modLoaded, persistMod]
  );

  const toggleMuteSeller = useCallback(
    (username: string) => {
      setMutedSellers((prev) => {
        const updated = prev.includes(username)
          ? prev.filter((u) => u !== username)
          : [...prev, username];
        if (modLoaded) persistMod(MUTED_KEY, updated);
        return updated;
      });
    },
    [modLoaded, persistMod]
  );

  const reportPost = useCallback(
    (postId: string, reason: string) => {
      setReports((prev) => {
        const updated = [
          ...prev,
          { id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, postId, reason, time: Date.now() },
        ];
        if (modLoaded) persistMod(REPORTS_KEY, updated);
        return updated;
      });
    },
    [modLoaded, persistMod]
  );

  const addPost = useCallback(
    (input: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments'>) => {
      const newPost: Post = {
        type: 'product',
        ...input,
        id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        likes: 0,
        comments: 0,
        createdAt: Date.now(),
      };
      setPosts((prev) => [newPost, ...prev]);
    },
    []
  );

  const removePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setTombstones((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setTombstones((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const updatePost = useCallback(
    (id: string, patch: Partial<Post>) => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    []
  );

  const toggleSold = useCallback(
    (id: string) => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, isSold: !p.isSold } : p)));
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
    },
    []
  );

  const toggleLike = useCallback(
    (postId: string): boolean => {
      // Derive from the latest liked map (ref keeps rapid taps race-free)
      const nextLiked = !likedRef.current[postId];
      likedRef.current = { ...likedRef.current, [postId]: nextLiked };
      setLiked((prev) => ({ ...prev, [postId]: nextLiked }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)) } : p
        )
      );
      if (modLoaded) persistMod(LIKED_KEY, likedRef.current);
      return nextLiked;
    },
    [modLoaded, persistMod]
  );

  const isLiked = useCallback((postId: string) => !!liked[postId], [liked]);

  return (
    <PostContext.Provider value={{ posts, loaded, addPost, removePost, deletePost, addComment, toggleLike, isLiked, updatePost, toggleSold, hiddenPostIds, hidePost, mutedSellers, toggleMuteSeller, reportPost }}>
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
