/**
 * susej — API Client Utilities
 * Token management, authenticated fetch, auto-refresh
 */

import { Platform } from 'react-native';

// ─── API BASE URL ────────────────────────────────────────────
export const API_BASE = (
  (
    ((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL as string) ||
    'http://100.92.233.78:8000'
  ).trim() || 'http://100.92.233.78:8000'
).replace(/\/+$/, '');

// ─── TOKEN STATE (module-level singletons) ───────────────────
let ACCESS_TOKEN = '';
let REFRESH_TOKEN = '';
let REFRESH_IN_FLIGHT: Promise<boolean> | null = null;

// ─── TOKEN SETTERS ───────────────────────────────────────────
export const setTokens = (access: string, refresh: string) => {
  ACCESS_TOKEN = access;
  REFRESH_TOKEN = refresh;
};

export const clearTokens = () => {
  ACCESS_TOKEN = '';
  REFRESH_TOKEN = '';
};

export const getAccessToken = () => ACCESS_TOKEN;
export const getRefreshToken = () => REFRESH_TOKEN;

// ─── REQUEST HELPERS ─────────────────────────────────────────
const requestWithToken = (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers ?? {});
  if (ACCESS_TOKEN) {
    headers.set('Authorization', `Bearer ${ACCESS_TOKEN}`);
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
};

const refreshAccessToken = async (): Promise<boolean> => {
  if (!REFRESH_TOKEN) {
    return false;
  }
  if (REFRESH_IN_FLIGHT) {
    return REFRESH_IN_FLIGHT;
  }

  REFRESH_IN_FLIGHT = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: REFRESH_TOKEN }),
      });
      if (!response.ok) {
        ACCESS_TOKEN = '';
        REFRESH_TOKEN = '';
        return false;
      }
      const data = await response.json();
      ACCESS_TOKEN = data.access_token || '';
      REFRESH_TOKEN = data.refresh_token || '';
      return Boolean(ACCESS_TOKEN);
    } catch {
      return false;
    } finally {
      REFRESH_IN_FLIGHT = null;
    }
  })();

  return REFRESH_IN_FLIGHT;
};

// ─── MAIN API FETCH (auto-refreshes on 401) ──────────────────
export const apiFetch = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  const response = await requestWithToken(path, options);
  const isAuthRoute = path.startsWith('/auth/');
  if (response.status !== 401 || isAuthRoute) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  return requestWithToken(path, options);
};

// ─── HELPER: Active User ID (module-level) ───────────────────
let ACTIVE_USER_ID = 1;
export const setActiveUserId = (id: number) => {
  ACTIVE_USER_ID = id;
};
export const getActiveUserId = () => ACTIVE_USER_ID;

// ─── PLATFORM CONSTANTS ──────────────────────────────────────
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
