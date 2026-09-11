import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionStorage } from '../utils/sessionStorage';
import { serverApi } from '../utils/serverApi';

const ONBOARDED_KEY = '@susej_has_onboarded';
const ONBOARDED_PREFIX = '@susej_has_onboarded:';
const FEED_WELCOME_KEY_BASE = '@susej_feed_welcome_seen';
const FEED_WELCOME_KEY = FEED_WELCOME_KEY_BASE;
const FEED_WELCOME_PREFIX = '@susej_feed_welcome_seen:';
const ONBOARDING_STEP_KEY_BASE = '@susej_onboarding_step';
const ONBOARDING_STEP_KEY = ONBOARDING_STEP_KEY_BASE;

export interface User {
  name: string;
  username: string;
  phone?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  role?: 'buyer' | 'seller' | 'both';
  isSeller?: boolean;
  businessName?: string;
  category?: string;
  verification?: 'none' | 'pending' | 'approved' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  hasOnboarded: boolean;
  hasSeenFeedWelcome: boolean;
  onboardingStep: number;
  /** Bumps on every login/logout — contexts use it to refetch server data
   *  even when the new account has the SAME username (POV re-switch). */
  sessionSeq: number;
  /** Bumps AFTER the real susej_ token is persisted — safe trigger for
   *  authenticated fetches (sessionSeq can fire while token is still mock). */
  tokenSeq: number;
  login: (user: User) => Promise<void>;
  /** Real server login via OTP — falls back to local demo identity when offline. */
  serverLogin: (phone: string, code: string) => Promise<{ ok: boolean; offline?: boolean; error?: string }>;
  serverEmailLogin: (action: 'login' | 'register', email: string, password: string, name?: string) => Promise<{ ok: boolean; offline?: boolean; error?: string }>;
  serverGoogleLogin: (idToken: string, devBypass?: { email: string; name?: string }) => Promise<{ ok: boolean; offline?: boolean; error?: string }>;
  logout: () => Promise<void>;
  setOnboardingStep: (step: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setHasSeenFeedWelcome: () => Promise<void>;
  // Returns true when saved (or optimistically kept through a transport
  // blip, which reconciles on next login). Returns the SERVER's rejection
  // reason string on validation failure so screens show the truth instead
  // of a generic line — industry standard: errors name the cause.
  updateUser: (patch: Partial<User>) => Promise<true | string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [hasSeenFeedWelcome, setHasSeenFeedWelcomeState] = useState(false);
  const [onboardingStep, setOnboardingStepState] = useState(1);
  const [sessionSeq, setSessionSeq] = useState(0);
  const [tokenSeq, setTokenSeq] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await sessionStorage.getUser();
        const session = await sessionStorage.getSession();
        if (storedUser && session) {
          setUser(storedUser);
          setIsLoggedIn(true);
          const perUser = await AsyncStorage.getItem(ONBOARDED_PREFIX + storedUser.username);
          const global = await AsyncStorage.getItem(ONBOARDED_KEY);
          setHasOnboarded(perUser === 'true' || global === 'true');
          const wPer = await AsyncStorage.getItem(FEED_WELCOME_PREFIX + storedUser.username);
          const wGlob = await AsyncStorage.getItem(FEED_WELCOME_KEY_BASE);
          if (wPer === 'true' || wGlob === 'true') setHasSeenFeedWelcomeState(true);
          if (wPer === null && wGlob === 'true') {
            try { await AsyncStorage.setItem(FEED_WELCOME_PREFIX + storedUser.username, 'true'); } catch {}
          }
        } else {
          const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
          setHasOnboarded(onboarded === 'true');
        }
      } catch {
      }
      // onboardingStep is per-user when logged in, global fallback when logged out
      const uForStep = (await sessionStorage.getUser())?.username ?? null;
      const stepKey = uForStep ? `${ONBOARDING_STEP_KEY_BASE}:${uForStep}` : ONBOARDING_STEP_KEY_BASE;
      const legacyStepKey = ONBOARDING_STEP_KEY_BASE;
      const [welcome, step, legacyStep] = await Promise.all([
        AsyncStorage.getItem(FEED_WELCOME_KEY_BASE),
        AsyncStorage.getItem(stepKey),
        stepKey !== legacyStepKey ? AsyncStorage.getItem(legacyStepKey) : Promise.resolve(null),
      ]);
      // Only use global welcome when no user is loaded yet; per-user check above handles logged-in case
      if (!hasSeenFeedWelcome) setHasSeenFeedWelcomeState(welcome === 'true');
      let rawStep: string | null = step;
      if (rawStep === null && legacyStep !== null) {
        rawStep = legacyStep;
        if (uForStep) { try { await AsyncStorage.setItem(stepKey, legacyStep); } catch {} }
      }
      const parsedStep = rawStep ? parseInt(rawStep, 10) : 1;
      setOnboardingStepState(Number.isNaN(parsedStep) ? 1 : parsedStep);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (nextUser: User) => {
    if (!nextUser?.username || String(nextUser.username).trim().length < 2) {
      throw new Error('login requires valid username');
    }
    // Internal only: serverLogin/serverEmailLogin use this to seed local state
    // before overwriting with real susej_ token. Direct UI calls with mock users
    // will create an unverified mock-token session that cannot access server.
    setUser(nextUser);
    setIsLoggedIn(true);
    setSessionSeq((n) => n + 1);
    await sessionStorage.saveUser(nextUser);
    await sessionStorage.saveSession(
      { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
      1
    );
    const perUser = await AsyncStorage.getItem(ONBOARDED_PREFIX + nextUser.username);
    if (perUser === null) {
      const global = await AsyncStorage.getItem(ONBOARDED_KEY);
      if (global === 'true') {
        await AsyncStorage.setItem(ONBOARDED_PREFIX + nextUser.username, 'true');
        setHasOnboarded(true);
      } else {
        setHasOnboarded(false);
      }
    } else {
      setHasOnboarded(perUser === 'true');
    }
    // feed welcome per-user migration
    const wPer = await AsyncStorage.getItem(FEED_WELCOME_PREFIX + nextUser.username);
    if (wPer === null) {
      const wGlob = await AsyncStorage.getItem(FEED_WELCOME_KEY_BASE);
      if (wGlob === 'true') {
        await AsyncStorage.setItem(FEED_WELCOME_PREFIX + nextUser.username, 'true');
        setHasSeenFeedWelcomeState(true);
      } else {
        setHasSeenFeedWelcomeState(false);
      }
    } else {
      setHasSeenFeedWelcomeState(wPer === 'true');
    }
  }, []);

  // Identity-bound state must never render as another account's truth when
  // the server sync lags or fails (wallet lesson Aug 22; cart/draft/saves
  // family found during the Aug 26 tester walk). Called on logout AND on any
  // identity switch. Per-account keyed storage (@key:<username>) is NOT
  // listed here - it cannot leak across accounts by construction.
  const clearMoneyCache = useCallback(async () => {
    await AsyncStorage.multiRemove([
      '@susej_wallet', // WALLET_KEY (utils/walletStore) - kept literal to avoid an import cycle
      '@susej_withdrawals',
      '@susej_cart',
      '@susej_orders',
      '@susej_addresses',
      '@susej_selected_address',
      '@susej_shop_profile',
      '@susej_bookmarked_products',
      '@susej_saved_collections',
      '@susej_saved_for_later',
      '@susej_liked_posts',
      '@susej_hidden_posts',
      '@susej_muted_sellers',
      '@susej_deleted_post_ids',
      '@susej_followed_sellers',
      '@susej_recently_viewed',
      '@susej_recent_searches',
      '@susej_saved_searches',
      '@susej_notifications',
      '@susej_my_story',
      '@susej_my_reels',
      '@susej_tickets',
      '@susej_disputes',
      '@susej_referrals',
      '@susej_loyalty',
      '@susej_applied_promo',
      '@susej_redeemed_coupons',
      '@susej_blocked',
      '@susej_chat_unread',
      '@susej_community_polls',
      '@susej_reports',
      '@susej_broadcast_joined',
      '@susej_broadcast_posts',
      '@susej_payment',
      '@susej_feed_posts', // legacy global feed cache — now per-user, must not leak
      '@susej_promotions', // legacy global promotions cache
      '@susej_communities',
      '@susej_community_messages',
      '@susej_followed_hashtags',
      '@susej_settings',
    ]);
  }, []);

  // Identity reconciliation: once the real token is on disk, pull the
  // authoritative /users/me row and replace the stored snapshot. This heals
  // any partial/stale login payload (older server build, KYC verdict racing
  // the verify response) so isSeller/businessName/verification always reflect
  // server truth - role-based nav reads user.isSeller directly. Silent on
  // failure: the verify payload already stored stays authoritative offline.
  const reconcileIdentity = useCallback(async (expectedToken?: string) => {
    const me = await serverApi.getMe();
    if (!me.ok || !me.data?.user) return;
    // Apply only if the session that requested this refresh is still current
    // (a logout or account switch must never resurrect stale identity).
    const session = await sessionStorage.getSession();
    if (!session?.accessToken.startsWith('susej_')) return;
    if (expectedToken && session.accessToken !== expectedToken) return;
    setUser(me.data.user as unknown as User);
    await sessionStorage.saveUser(me.data.user);
  }, []);

  const serverLogin = useCallback(
    async (phone: string, code: string) => {
      const digits = phone.replace(/\D/g, '');
      // 1. Try the real server first - creates/logs in a REAL user row.
      const res = await serverApi.verifyOtp(digits, code);
      if (res.ok && res.data?.token) {
        // Identity is about to change - drop the outgoing account's cached
        // money state so it can never flash as the new account's truth.
        await clearMoneyCache();
        await login(res.data.user as unknown as User);
        // login() writes a mock token — overwrite it with the REAL server token
        // so every serverApi call authenticates (getToken() only accepts susej_).
        await sessionStorage.saveSession({ accessToken: res.data.token, refreshToken: '' }, 0);
        // Signal contexts AFTER the real token is on disk so their refetch
        // actually authenticates.
        setTokenSeq((n) => n + 1);
        void reconcileIdentity(res.data.token);
        return { ok: true };
      }
      // 2. Server reachable but rejected -> surface the reason (wrong code,
      //    expired, throttled). Only a network failure is reported as offline.
      if (res.error && res.error !== 'offline') {
        return { ok: false, error: res.error };
      }
      // 3. Offline fallback: NO local identity exists for an unknown number -
      //    sign-in simply fails honestly until connectivity returns.
      return { ok: false, offline: true };
    },
    [login, clearMoneyCache, reconcileIdentity]
  );

  const serverEmailLogin = useCallback(
    async (action: 'login' | 'register', email: string, password: string, name?: string) => {
      const res = await serverApi.emailAuth(action, email.trim().toLowerCase(), password, name);
      if (res.ok && res.data?.token) {
        await clearMoneyCache();
        await login(res.data.user as unknown as User);
        await sessionStorage.saveSession({ accessToken: res.data.token, refreshToken: '' }, 0);
        setTokenSeq((n) => n + 1);
        void reconcileIdentity(res.data.token);
        return { ok: true };
      }
      if (res.error && res.error !== 'offline') return { ok: false, error: res.error };
      return { ok: false, offline: true };
    },
    [login, clearMoneyCache, reconcileIdentity]
  );

  const serverGoogleLogin = useCallback(
    async (idToken: string, devBypass?: { email: string; name?: string }) => {
      const res = await serverApi.googleAuth(idToken, devBypass);
      if (res.ok && res.data?.token) {
        await clearMoneyCache();
        await login(res.data.user as unknown as User);
        await sessionStorage.saveSession({ accessToken: res.data.token, refreshToken: '' }, 0);
        setTokenSeq((n) => n + 1);
        void reconcileIdentity(res.data.token);
        return { ok: true };
      }
      if (res.error && res.error !== 'offline') return { ok: false, error: res.error };
      return { ok: false, offline: true };
    },
    [login, clearMoneyCache, reconcileIdentity]
  );

  const logout = useCallback(async () => {
    // Revoke the Bearer server-side FIRST so a stolen token dies with the
    // session instead of lingering for its 30-day TTL. Fire-and-forget:
    // local wipe below must run even when offline.
    try {
      await serverApi.revokeSession(false);
    } catch {}
    setUser(null);
    setIsLoggedIn(false);
    setHasOnboarded(false);
    setSessionSeq((n) => n + 1);
    await sessionStorage.clearSession();
    await AsyncStorage.removeItem(ONBOARDED_KEY);
    // Also drop the global onboarding mirrors: otherwise the next account on
    // this device inherits the previous account's step/welcome/completion via
    // the login migration (cross-account leak). Per-user keys are namespaced
    // and safe; globals are the leak vector.
    await AsyncStorage.multiRemove([ONBOARDING_STEP_KEY_BASE, FEED_WELCOME_KEY_BASE]).catch(() => {});
    await clearMoneyCache();
  }, [clearMoneyCache]);

  const setOnboardingStep = useCallback(async (step: number) => {
    setOnboardingStepState(step);
    const u = (await sessionStorage.getUser())?.username?.trim();
    const key = u ? `${ONBOARDING_STEP_KEY_BASE}:${u}` : ONBOARDING_STEP_KEY_BASE;
    await AsyncStorage.setItem(key, String(step)).catch(() => {});
    // No global mirror: it leaked the step into the next account's login
    // migration. Logged-out reads fall back to step 1, which is correct.
  }, []);

  const completeOnboarding = useCallback(async () => {
    setHasOnboarded(true);
    const u = await sessionStorage.getUser();
    if (u?.username) {
      await AsyncStorage.setItem(ONBOARDED_PREFIX + u.username, 'true');
    }
    // No global write: it fed the next account's login migration
    // (cross-account completion leak). Legacy global residue still migrates
    // once via login(), then logout clears it for good.
  }, []);

  const setHasSeenFeedWelcome = useCallback(async () => {
    setHasSeenFeedWelcomeState(true);
    const u = await sessionStorage.getUser();
    const key = u?.username ? FEED_WELCOME_PREFIX + u.username : FEED_WELCOME_KEY_BASE;
    await AsyncStorage.setItem(key, 'true');
    // No global mirror: same cross-account leak class as the onboarding step.
  }, []);

  const updateUser = useCallback(
    async (patch: Partial<User>): Promise<true | string> => {
      const prevUser = user;
      setUser((prev) => {
        const next = { ...(prev ?? ({} as User)), ...patch };
        sessionStorage.saveUser(next);
        return next;
      });
      // Mirror profile edits to the shared Postgres user row so every
      // device + the admin panel see the same identity. If server rejects
      // (409 username taken, validation), rollback optimistic local update
      // so local/admin do not diverge (HIGH-03 fix).
      // Returns true on save AND on transient transport trouble (offline /
      // our server down — optimistic edit kept, reconciles on next login).
      // Returns the server's reason string on real rejection so the caller
      // can show WHAT failed instead of a dummy line.
      const token = await sessionStorage.getSession();
      if (token?.accessToken?.startsWith('susej_')) {
        try {
          // Strip client-only / server-immutable keys before mirroring: phone
          // lives in the auth layer, username + verification are immutable via
          // PATCH (a 400 here used to roll back the whole optimistic edit).
          const { phone: _phone, username: _username, verification: _verification, ...serverPatch } =
            patch as Record<string, unknown>;
          if (!Object.keys(serverPatch).length) return true;
          const res = await serverApi.updateProfile(serverPatch);
          if (!res.ok) {
            // Transient transport (truly offline OR our server down): keep the
            // optimistic edit, it reconciles on next login. Roll back ONLY on
            // a real server rejection (validation/409) so a blip never wipes
            // what the user just typed.
            if (res.error === 'offline' || res.error === 'server-unreachable') return true;
            setUser(prevUser ?? null);
            if (prevUser) void sessionStorage.saveUser(prevUser);
            return typeof res.error === 'string' && res.error
              ? res.error
              : 'Something went wrong. Please try again.';
          }
          if (res.data?.user) {
            setUser(res.data.user as unknown as User);
            void sessionStorage.saveUser(res.data.user as unknown as User);
          }
          return true;
        } catch {
          setUser(prevUser ?? null);
          if (prevUser) void sessionStorage.saveUser(prevUser);
          return 'Something went wrong. Please try again.';
        }
      }
      return true;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        isLoading,
        hasOnboarded,
        hasSeenFeedWelcome,
        onboardingStep,
        sessionSeq,
        tokenSeq,
        login,
        serverLogin,
    serverEmailLogin,
    serverGoogleLogin,
        logout,
        setOnboardingStep,
        completeOnboarding,
        setHasSeenFeedWelcome,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
