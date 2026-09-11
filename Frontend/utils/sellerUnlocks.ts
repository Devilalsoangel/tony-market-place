import AsyncStorage from '@react-native-async-storage/async-storage';

// Storefront personalization (per seller, public). The old one-time paid
// unlocks (analytics/theme) were REMOVED — marketplaces monetize visibility
// and trust, not cosmetics or reports. Paid SKUs now live in
// utils/marketplace.ts (Feed Spotlight) + the chat pin flow.

// Public storefront accent themes (per seller, visible to every viewer).
export type StoreTheme = { id: string; name: string; accent: string; accentSoft: string };

export const STORE_THEMES: StoreTheme[] = [
  { id: 'violet', name: 'Violet', accent: '#4343d5', accentSoft: '#5d5fef' },
  { id: 'emerald', name: 'Emerald', accent: '#0f7a5a', accentSoft: '#14b789' },
  { id: 'amber', name: 'Amber', accent: '#b45309', accentSoft: '#f59e0b' },
  { id: 'rose', name: 'Rose', accent: '#be123c', accentSoft: '#f43f5e' },
];

const DEFAULT_THEME = STORE_THEMES[0];

const themeKey = (username: string) => `@susej_store_theme:${username}`;

export async function saveStoreTheme(username: string, themeId: string): Promise<void> {
  await AsyncStorage.setItem(themeKey(username), themeId).catch(() => {});
}

/** Public read: resolves a seller's chosen accent theme (defaults to brand violet). */
export async function loadStoreTheme(username: string): Promise<StoreTheme> {
  try {
    const id = await AsyncStorage.getItem(themeKey(username));
    return STORE_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
