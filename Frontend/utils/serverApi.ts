/**
 * Unified server API client — the app talks to the shared PostgreSQL backend
 * (admin panel Next.js server on :3000) for real multi-user data.
 * Offline-first: every call fails silently (6s timeout) and callers fall back
 * to their AsyncStorage cache. The token comes from the app session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { sessionStorage } from './sessionStorage';
import { getAdminUrl, getAppKey } from './adminSync';

/**
 * Industry-standard transport classification (Instagram/WhatsApp pattern):
 * 'offline' ONLY when the device truly has no connectivity (NetInfo truth),
 * 'server-unreachable' when the network is fine but OUR server doesn't answer
 * (dead local preview server, outage, tunnel down). Never blame the user's
 * internet for our own server being down.
 */
async function classifyTransportError(): Promise<'offline' | 'server-unreachable'> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  } catch {
    // NetInfo itself failed — fail open to server-side; the retry will tell.
  }
  return 'server-unreachable';
}

/**
 * Honest user-facing copy for transport failures. Real offline blames the
 * connection (true); our server being down says so (never the user's fault).
 */
export function transportMessage(error: string | undefined, action: string): string {
  if (error === 'offline') return `You're offline. Check your connection and ${action}.`;
  if (error === 'server-unreachable') return `Couldn't reach the susej server. Please ${action}.`;
  return error || `Something went wrong. Please ${action}.`;
}

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  /** Set on 404 from OTP verify: unknown number, signup consent required. */
  needsSignup?: boolean;
}

export interface ServerComment {
  id: string;
  author: string;
  username?: string | null;
  parentId?: string | null;
  text: string;
  likes?: number;
  likedByMe?: boolean;
  time: number;
}

async function getToken(): Promise<string | null> {
  const session = await sessionStorage.getSession();
  return session?.accessToken && session.accessToken.startsWith('susej_') ? session.accessToken : null;
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const base = await getAdminUrl();
    const token = await getToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/api/app${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      const needsSignup = (json as { needsSignup?: boolean } | null)?.needsSignup;
      return { ok: false, data: null, error: err, ...(needsSignup ? { needsSignup: true } : {}) };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, data: null, error: await classifyTransportError() };
  }
}

// App-key request against the admin /api/v1/* surface (platform-curated home
// content). Carries BOTH x-app-key AND a Bearer token so the server's
// parseWriteSession can resolve the real user identity.
async function requestWithAppKey<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const [base, key, token] = await Promise.all([getAdminUrl(), getAppKey(), getToken()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-app-key': key,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      return { ok: false, data: null, error: err };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, data: null, error: await classifyTransportError() };
  }
}

export const serverApi = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  sendOtp: (phone: string) => request<{ ok: boolean; message?: string; devCode?: string; error?: string }>('/auth', { method: 'POST', body: { phone } }),
  /** Sign-in existence probe: does this number have an account? Boolean only,
   *  throttled server-side. Lets login redirect unknown numbers to signup. */
  checkPhone: (phone: string) => request<{ exists: boolean }>('/auth/check', { method: 'POST', body: { phone } }),
  // create:true = explicit signup intent (signup screens only). Sign-in
  // screens omit it, so a typo'd number gets 404 needsSignup instead of a
  // silently minted ghost account + welcome money.
  verifyOtp: (phone: string, code: string, create?: boolean) =>
    request<{ token: string; user: Record<string, unknown>; needsSignup?: boolean }>('/auth/verify', { method: 'POST', body: create ? { phone, code, create: true } : { phone, code } }),
  emailAuth: (action: 'login' | 'register', email: string, password: string, name?: string) =>
    request<{ token: string; user: Record<string, unknown> }>('/auth/email', { method: 'POST', body: { action, email, password, name } }),
  googleAuth: (idToken: string, devBypass?: { email: string; name?: string }) =>
    // Dev backdoor is DEV-ONLY: prod builds must never send devBypass (server
    // also rejects it unless GOOGLE_DEV_BYPASS=on AND not production). Without
    // this gate a prod client could mint sessions with any chosen email.
    __DEV__ && devBypass
      ? request<{ token: string; user: Record<string, unknown> }>('/auth/google', { method: 'POST', body: { devBypass: true, email: devBypass.email, name: devBypass.name } })
      : request<{ token: string; user: Record<string, unknown> }>('/auth/google', { method: 'POST', body: { idToken } }),
  /** Authoritative profile for the current token - used to self-heal identity after login. */
  getMe: () => request<{ user: Record<string, unknown> }>('/users/me'),
  /** Revoke the current session token server-side (logout). all=true burns every session on the account. */
  revokeSession: (all = false) =>
    request<{ ok: boolean }>(`/auth${all ? '?all=1' : ''}`, { method: 'DELETE' }),


  // ── Posts / feed ─────────────────────────────────────────────────────────
  getPosts: (params: { seller?: string; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.seller) qs.set('seller', params.seller);
    if (params.category) qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ posts: any[] }>(`/posts${suffix}`);
  },
  createPost: (post: Record<string, unknown>) => request<{ post: any }>('/posts', { method: 'POST', body: post }),
  getPost: (id: string) => request<{ post: any }>(`/posts/${encodeURIComponent(id)}`),
  updatePost: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  deletePost: (id: string) => request<{ ok: boolean }>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggleLike: (id: string) => request<{ liked: boolean; likes: number }>(`/posts/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  getComments: (id: string) => request<{ comments: ServerComment[] }>(`/posts/${encodeURIComponent(id)}/comments`),
  addComment: (id: string, text: string, parentId?: string, displayName?: string) =>
    request<{ comment: any }>(`/posts/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: { text, ...(parentId ? { parentId } : {}), ...(displayName ? { displayName } : {}) },
    }),
  likeComment: (id: string, cid: string) =>
    request<{ likes: number; likedByMe: boolean }>(`/posts/${encodeURIComponent(id)}/comments/${encodeURIComponent(cid)}/like`, { method: 'POST' }),
  getLikers: (id: string) =>
    request<{ likes: Array<{ username: string; name: string }> }>(`/posts/${encodeURIComponent(id)}/like`),
  // ── Reels (server-distributed; device cache is offline mirror only) ──
  getReels: (seller?: string) => {
    const qs = seller ? `?seller=${encodeURIComponent(seller)}` : '';
    return request<{
      reels: Array<{
        id: string; title: string; caption: string; mediaUrl: string;
        creatorName: string; creatorUsername: string; views: number; likes: number; createdAt: number;
      }>;
    }>(`/reels${qs}`);
  },
  createReel: (body: { mediaUrl: string; caption?: string }) =>
    request<{ reel: { id: string } }>('/reels', { method: 'POST', body }),
  /** Count one watch (server increments; throttled per IP). Fire-and-forget. */
  viewReel: (id: string) =>
    request<{ ok: boolean }>('/reels', { method: 'PATCH', body: { id, action: 'view' } }),
  endPromotion: (id: string, postId?: string) =>
    request<{ ok: boolean; status: string }>('/promotions', {
      method: 'PATCH',
      body: { id, ...(postId ? { postId } : {}) },
    }),
  reportPost: (postId: string, reason: string) =>
    request<{ ok: boolean; id: string; reports: number }>('/reports', {
      method: 'POST',
      body: { postId, reason },
    }),

  // ── Follows ──────────────────────────────────────────────────────────────
  getFollows: () =>
    request<{ followed: string[]; followerCounts?: Record<string, number>; followers?: string[] }>('/follows'),
  follow: (followed: string, unfollow = false) =>
    request<{ following: boolean }>('/follows', { method: 'POST', body: { followed, unfollow } }),

  // ── Orders ───────────────────────────────────────────────────────────────
  getOrders: (mine?: 'buyer' | 'seller' | 'all') =>
    request<{ orders: any[] }>(`/orders${mine ? `?mine=${mine}` : ''}`),
  /** Ownership-scoped single order (deep links, cold cache). 404 when the
   *  row doesn't exist OR isn't yours — same shape, no existence oracle. */
  getOrder: (id: string) => request<{ order: any }>(`/orders/${encodeURIComponent(id)}`),
  placeOrder: (order: Record<string, unknown>) => request<{ order: any }>('/orders', { method: 'POST', body: order }),
  updateOrder: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  /** Seller refund decision — settles real money server-side (single writer).
   *  Rejects when the caller isn't the seller or no request is pending. */
  respondRefund: (id: string, decision: 'approved' | 'rejected') =>
    request<{ ok: boolean }>(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { refundDecision: decision } }),

  // ── Wallet ───────────────────────────────────────────────────────────────
  getWallet: () => request<{ balance: number; loyaltyPoints: number; transactions: any[] }>('/wallet'),
  // Positive amounts are only accepted as gated top-ups (type: 'topup');
  // debits (negative) mirror real spend from checkout/promotions/payouts.
  walletTx: (amount: number, title: string, detail: string, type?: string, ref?: string) =>
    request<{ balance: number }>('/wallet', { method: 'POST', body: { amount, title, detail, ...(type ? { type } : {}), ...(ref ? { ref } : {}) } }),

  // ── Chat ─────────────────────────────────────────────────────────────────
  getThreads: () => request<{ threads: any[] }>('/chat/threads'),
  createThread: (participant: string) =>
    request<{ thread: any }>('/chat/threads', { method: 'POST', body: { participant } }),
  getMessages: (threadId: string) =>
    request<{ threadId: string; messages: any[] }>(`/chat/threads/${encodeURIComponent(threadId)}/messages`),
  sendMessage: (threadId: string, body: string, offer?: { amount: number; productId: string; productName: string }) =>
    request<{ message: any }>(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      body: offer ? { body, offer } : { body },
    }),
  /** Seller hero banners (public read): the cross-device truth. The editor
   *  syncs here; per-device AsyncStorage is fallback only. */
  getStorefrontBanners: (seller: string) =>
    request<{ banners: { id: string; title: string; subtitle?: string | null; ctaLabel?: string | null; imageUrl?: string | null }[] }>(
      `/storefront-banners?seller=${encodeURIComponent(seller)}`
    ),
  /** My own seller application (server truth — survives reopen/relogin).
   *  null = never applied or withdrawn. */
  getSellerApplication: () =>
    request<{ application: {
      id: string; businessName: string; category: string; status: string;
      submittedAt: number; docCount: number; verifiedDocs: number;
      lastDecision: { action: string; note: string; at: number } | null;
    } | null }>('/sellers/me'),
  /** Withdraw my own pending application (owner only, pending only). */
  withdrawSellerApplication: () =>
    request<{ ok: boolean; withdrawn: boolean }>('/sellers/me', { method: 'DELETE' }),
  /** My disputes (raised by or against me) — cross-device truth. */
  getDisputes: () => request<{ disputes: any[] }>('/disputes'),
  /** Raise a dispute on my order (server row — the desk sees it). Idempotent
   *  per open dispute: re-raising returns the existing row. */
  createDispute: (dispute: { orderRef: string; reason: string; description?: string }) =>
    request<{ dispute: any }>('/disputes', { method: 'POST', body: dispute }),
  /** Server-owned campaign purchase: debit + ACTIVE placement in one tx.
   *  Idempotent on checkoutRef — safe to retry after a timeout. */
  purchasePromotion: (order: { packageId: string; postId: string; checkoutRef: string }) =>
    request<{ purchase: any }>('/promotions', { method: 'POST', body: order }),
  /** Accept / decline / counter a pending offer (either participant). */
  updateOfferStatus: (threadId: string, messageId: string, status: 'accepted' | 'declined' | 'countered') =>
    request<{ ok: boolean }>(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'PATCH',
      body: { messageId, status },
    }),
  /** Pinned-chat VAS: the SERVER owns the debit (atomic debit + pin, server
   *  price). The client must not pre-debit — doing both charged 2x per pin. */
  pinThread: (threadId: string, days: number, ref?: string) =>
    request<{ pinnedUntil: number; days: number }>(`/chat/threads/${encodeURIComponent(threadId)}/pin`, {
      method: 'POST',
      body: { days, ...(ref ? { ref } : {}) },
    }),

  // ── Stories (REAL 24h stories, not post-derived) ──────────────────────────
  getStories: () => request<{ stories: any[] }>('/stories'),
  createStory: (payload: {
    image: string;
    caption?: string;
    durationMs?: number;
    overlays?: { text: string; zone: 'top' | 'middle' | 'bottom' }[];
    productRef?: { id: string; title: string; image?: string; price?: number };
  }) => request<{ story: any }>('/stories', { method: 'POST', body: payload }),

  // ── Paid promotion placements (feed source of truth; read-only) ──────────
  getPromotions: () => request<{ promotions: any[] }>('/promotions'),

  // ── Live shopping (REAL LiveStream rows; video broadcasting arrives with a
  //    streaming backend — rooms, lifecycle and listing are real) ─────────────
  getLiveStreams: () => request<{ streams: any[] }>('/live'),
  startLiveStream: (title: string) =>
    request<{ stream: any }>('/live', { method: 'POST', body: { title } }),
  endLiveStream: (id: string) =>
    request<{ ok: boolean }>(`/live/${encodeURIComponent(id)}`, { method: 'PATCH' }),

  // ── Auctions ─────────────────────────────────────────────────────────────
  getAuctions: () => request<{ auctions: any[] }>('/auctions'),
  /** Single auction with server-resolved top bid (winner truth — the local
   *  thread never sees rival phones' bids). */
  getAuction: (auctionId: string) =>
    request<{ auction: any }>(`/auctions/${encodeURIComponent(auctionId)}`),
  placeBid: (auctionId: string, amount: number) =>
    request<{ bid: any; currentBid: number }>('/auctions', { method: 'POST', body: { auctionId, amount } }),
  /** Seller creates a live auction (server row — every device sees it). */
  createAuction: (payload: { title: string; startPrice: number; durationHours?: number; imageKey?: string }) =>
    request<{ auction: any }>('/auctions', { method: 'POST', body: payload }),

  // ── Bundle deals (server catalog; legacy rows without items link shop) ───
  getBundles: () => request<{ bundles: any[] }>('/bundles'),

  // ── Broadcast channels (server directory; joins stay local prefs) ─────────
  getBroadcasts: () => request<{ broadcasts: any[] }>('/broadcasts'),

  // ── Communities ──────────────────────────────────────────────────────────
  getCommunities: () => request<{ communities: any[] }>('/communities'),
  toggleCommunityJoin: (communityId: string, joined: boolean) =>
    request<{ ok: boolean }>(`/communities/${encodeURIComponent(communityId)}/join`, { method: 'POST', body: { joined } }),
  sendCommunityMessage: (communityId: string, text: string) =>
    request<{ message: any }>('/communities', { method: 'POST', body: { communityId, text } }),
  /** Room history (server truth — every member sees every message). */
  getCommunityMessages: (communityId: string) =>
    request<{ messages: any[] }>(`/communities/${encodeURIComponent(communityId)}/messages`),
  /** Create a shared community (server row — everyone sees it). Offline falls
   *  back to a local-only row in the caller. */
  createCommunity: (community: { name: string; description?: string; type?: string }) =>
    request<{ community: any }>('/communities', { method: 'POST', body: community }),

  // ── Notifications ────────────────────────────────────────────────────────
  getNotifications: (before?: number) =>
    request<{ notifications: any[]; unreadCount: number }>(
      typeof before === 'number' && Number.isFinite(before) ? `/notifications?before=${before}` : '/notifications'
    ),
  markNotificationsRead: (id?: string) =>
    request<{ ok: boolean }>('/notifications', { method: 'POST', body: id ? { id } : {} }),

  // ── Users ────────────────────────────────────────────────────────────────
  getUserProfile: (username: string) =>
    request<{
      user: any;
      posts: any[];
      reviews?: Array<{ id: string; reviewer: string; rating: number; text?: string; product?: string; createdAt: number }>;
    }>(`/users/${encodeURIComponent(username)}`),
  updateProfile: (patch: Record<string, unknown>) =>
    request<{ user: Record<string, unknown> }>('/users/me', { method: 'PATCH', body: patch }),
  /** Live DB availability probe for a signup handle (debounced by caller). */
  checkUsername: (username: string) =>
    request<{ available: boolean; reason?: string; mine?: boolean }>(
      `/users/check-username?u=${encodeURIComponent(username)}`
    ),
  /** One-time handle claim for fresh accounts (409 taken, 403 active). */
  claimUsername: (username: string) =>
    request<{ user: Record<string, unknown> }>('/users/claim-username', {
      method: 'POST',
      body: { username },
    }),

  // ─── Platform-curated home content (admin home-management) ─────────────
  getHome: () =>
    requestWithAppKey<{
      topSellers: Array<{ sellerId: string; sellerName: string; sellerLogo?: string | null; totalSales?: number; rating?: number; reviewCount?: number; position?: number }>;
      hotDeals: Array<{ productId: string; productName: string; productImage?: string | null; originalPrice?: number; discountedPrice?: number; discountPercentage?: number; priority?: number }>;
      marketingBanners: Array<{
        id: string;
        sellerUsername: string;
        sellerName: string;
        title: string;
        subtitle?: string | null;
        ctaLabel?: string | null;
        imageUrl?: string | null;
        size?: string | null;
        position?: number | null;
      }>;
      featuredPosts?: Array<{
        id: string;
        postId: string;
        title: string;
        excerpt?: string | null;
        imageUrl?: string | null;
        position?: number | null;
        isPinned?: boolean | null;
      }>;
      spotlight?: {
        id: string;
        postId?: string | null;
        productId?: string | null;
        sellerId: string;
        sellerName: string;
        sellerLogo?: string | null;
        title: string;
        imageUrl?: string | null;
      } | null;
      // Admin rail visibility ("Show on home page"). Missing key = ON —
      // the server defaults every rail on; OFF hides the rail client-side.
      sections?: Record<string, boolean>;
      degraded?: boolean;
    }>('/api/v1/home'),

  // ── Address book (server truth, cross-device; device cache is offline mirror)
  getAddresses: () =>
    requestWithAppKey<{ addresses: { id: string; type: string; name: string; street: string; city: string; phone: string; isDefault: boolean }[] }>('/api/app/addresses'),
  addAddress: (body: { type: string; street: string; city: string; phone: string; isDefault?: boolean }) =>
    requestWithAppKey<{ address: { id: string } }>('/api/app/addresses', { method: 'POST', body }),
  /** Edit an owned address (server validates + persists; owner-checked). */
  updateAddress: (body: { id: string; type?: string; street?: string; city?: string; phone?: string }) =>
    requestWithAppKey<{ ok: boolean }>('/api/app/addresses', { method: 'PATCH', body }),
  /** Delete an owned address (server re-homes the default). */
  deleteAddress: (id: string) =>
    requestWithAppKey<{ ok: boolean }>(`/api/app/addresses?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // ─── Marketing banners (seller dashboard → admin sync) ─────────────────
  // Upload a banner image picked in the seller dashboard. Returns a
  // root-relative URL served by the admin panel (prefix with getAdminUrl()).
  // ── Wallet payouts (read-your-records; ownership enforced server-side) ────
  getWithdrawals: () => requestWithAppKey<{ withdrawals: { id: string; amount: number; status: string; requestedAt: string; respondedAt: string | null }[] }>('/api/app/withdrawals'),

  // Submit a payout request. TRANSACTIONAL on the server: the wallet debit
  // (amount + payout fee) and the desk row (status "requested") commit in one
  // database transaction — the client never orchestrates two-phase money moves.
  // method travels to the server so the desk pays the chosen rail (bank/UPI).
  // ref is a per-tap idempotency key (reused across timeout-retries): the
  // server mints a deterministic walletTx title per ref so a retry collides
  // instead of double-debiting.
  // feePreview is the fee the gate showed: the server 400s when the live fee
  // moved since (fail-closed reconfirm, never a surprise debit).
  requestPayout: (amount: number, method: 'bank' | 'upi' = 'bank', ref?: string, destination?: string, feePreview?: number) =>
    requestWithAppKey<{ ok: boolean; withdrawalId: string; deduped?: boolean; destination?: string }>('/api/app/wallet/payout', { method: 'PUT', body: { amount, method, ...(ref ? { ref } : {}), ...(destination ? { destination } : {}), ...(typeof feePreview === 'number' ? { feePreview } : {}) } }),

  // Upload a local image and get back a hosted /uploads/... URL (root-relative
  // — prefix with getAdminUrl()). Used by the shared media upload pipeline.
  uploadBannerImage: (dataUrl: string) =>
    requestWithAppKey<{ ok: boolean; url: string }>('/api/app/upload', { method: 'POST', body: { dataUrl } }),

  // Sync one marketing banner to the admin (POST=create with flat payload,
  // PATCH=update with { id, data } wrapper).
  syncStorefrontBanner: (banner: {
    id: string;
    sellerUsername: string;
    sellerName: string;
    title: string;
    subtitle?: string;
    ctaLabel?: string;
    imageUrl?: string;
    imageIndex?: number;
    size?: string;
    status?: string;
  }, method: 'POST' | 'PATCH' = 'POST') =>
    method === 'POST'
      ? requestWithAppKey<{ row?: Record<string, unknown> }>('/api/data/storefront-banners', { method, body: banner })
      : requestWithAppKey<{ row?: Record<string, unknown> }>('/api/data/storefront-banners', {
          method,
          // PATCH contract is { id, data } — and `data` must NOT carry the id
          // itself (Prisma update payload).
          body: (() => {
            const { id: _stripped, ...rest } = banner;
            void _stripped;
            return { id: banner.id, data: rest };
          })(),
        }),

  // Remove a marketing banner from the admin.
  deleteStorefrontBanner: (id: string) =>
    requestWithAppKey<{ ok?: boolean }>('/api/data/storefront-banners', { method: 'DELETE', body: { id } }),

  // ─── Asset upload (dedicated area for entire app, later S3 bucket) ──────
  // ─── Coupons (live from DB, replaces hardcoded client values) ───────
  getCoupons: () =>
    request<{ coupons: Array<{ code: string; type: string; value: number; expiresAt: string }> }>('/coupons'),

  // ─── Categories (admin-owned catalog: name/slug/banner image/tree) ──────
  getCategories: () =>
    requestWithAppKey<{
      categories: Array<{ id: string; name: string; slug: string; icon?: string | null; bannerImage?: string | null; featured?: boolean; productCount?: number; children?: Array<{ name: string; slug: string }> }>;
    }>('/api/app/categories'),
};