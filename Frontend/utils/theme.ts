/**
 * susej Design System — Stitch-Matched Token Library
 *
 * Based on: Modern Violet App Design (Google Stitch)
 * Primary: #4343d5 (Modern Purple-Blue)
 * Surface: #fcf8ff (warm white)
 * Typography: Geist (headings) + Inter (body)
 * Style: Modern Minimalism with Soft Tactility — extreme rounding, ambient shadows
 */

import { Platform, Dimensions } from 'react-native';
import { createContext, useContext } from 'react';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── SPACING (4px base grid) ───────────────────────────────
export const spacing = {
  /** 2px */ xxs: 2,
  /** 4px */ xs: 4,
  /** 8px */ sm: 8,
  /** 12px */ md: 12,
  /** 16px */ lg: 16,
  /** 20px */ xl: 20,
  /** 24px */ xxl: 24,
  /** 32px */ xxxl: 32,
  /** 40px */ huge: 40,
  /** 48px */ giant: 48,
  /** 20px — outer margin */ containerMargin: 20,
  /** 12px — grid gutter */ gutter: 12,
} as const;

// ─── TYPOGRAPHY (Geist + Inter) ─────────────────────────────
export const typography = {
  fontFamily: {
    regular: 'Inter',
    medium: 'Inter',
    bold: 'Inter',
    // Structured elements
    heading: 'Inter',
    label: 'Inter',
  },
  fontSize: {
    /** 10px — tiny labels */ xs: 10,
    /** 12px — label-sm, timestamps, badges */ sm: 12,
    /** 14px — label-md, usernames, buttons */ md: 14,
    /** 14px — body-sm, secondary text */ base: 14,
    /** 16px — body-md, descriptions */ lg: 16,
    /** 20px — headline-lg-mobile, section titles */ xl: 20,
    /** 24px — headline-lg, prominent titles */ xxl: 24,
    /** 32px — headline-xl, hero prices */ hero: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
  // Stitch typography tokens
  headlineXl: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.02 },
  headlineLg: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: -0.01 },
  headlineLgMobile: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  bodyMd: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  labelMd: { fontSize: 14, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.01 },
  labelSm: { fontSize: 12, fontWeight: '500' as const, lineHeight: 14, letterSpacing: 0.02 },
} as const;

// ─── BORDER RADIUS (Extreme Rounding — Premium Feel) ────────
export const radii = {
  /** 4px — subtle rounding, checkboxes */ xs: 4,
  /** 6px — small elements */ sm: 6,
  /** 8px — small chips, inputs at rest */ md: 8,
  /** 12px — rounded-xl: buttons, nav items, small cards */ lg: 12,
  /** 16px — rounded-[16px]: search bars, inputs, chips */ xl: 16,
  /** 20px — rounded-[20px]: bottom sheets */ xxl: 20,
  /** 24px — rounded-[24px]: FEED CARDS, major containers */ huge: 24,
  /** 9999px — full pill: avatars, badges, tags */ full: 9999,
} as const;

// ─── SHADOWS (Ambient — subtle depth) ──────────────────────
const createShadow = (
  elevation: number,
  shadowColor: string,
  shadowOpacity: number,
  shadowRadius: number,
  shadowOffsetY: number,
) =>
  Platform.select({
    web: {
      boxShadow: `0px ${shadowOffsetY}px ${shadowRadius}px ${shadowColor}${Math.round(shadowOpacity * 255)
        .toString(16)
        .padStart(2, '0')}`,
    },
    default: {
      shadowColor,
      shadowOffset: { width: 0, height: shadowOffsetY },
      shadowOpacity,
      shadowRadius,
      elevation,
    },
  }) as any;

export const shadows = {
  /** None */
  none: createShadow(0, '#000', 0, 0, 0),
  /** Level 1 — Cards: soft, diffused ambient shadow */
  card: createShadow(2, '#1a1a2e', 0.04, 20, 4),
  /** Level 2 — Overlays/Modals: deeper focus pull */
  overlay: createShadow(4, '#1a1a2e', 0.08, 30, 10),
  /** Bottom nav: subtle top shadow */
  bottomNav: createShadow(2, '#1a1a2e', 0.04, 20, -4),
  /** Button shadow */
  button: createShadow(3, '#1a1a2e', 0.06, 8, 2),
  /** FAB shadow */
  fab: createShadow(6, '#4343d5', 0.2, 16, 4),
  /** Price badge */
  badge: createShadow(4, '#1a1a2e', 0.12, 16, 4),
  /** Inner shadow for depth */
  inset: Platform.select({
    web: { boxShadow: 'inset 0 1px 3px rgba(26,26,46,0.06)' } as any,
    default: {
      shadowColor: '#1a1a2e',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 0,
    } as any,
  }),
  // Legacy aliases
  xs: createShadow(1, '#1a1a2e', 0.04, 4, 1),
  sm: createShadow(2, '#1a1a2e', 0.04, 8, 2),
  md: createShadow(4, '#1a1a2e', 0.06, 12, 4),
  lg: createShadow(6, '#1a1a2e', 0.08, 20, 6),
  xl: createShadow(8, '#1a1a2e', 0.1, 24, 8),
  glow: createShadow(4, '#4343d5', 0.2, 12, 4),
} as const;

// ─── COLORS (Stitch Modern Violet) ──────────────────────────
export const lightColors = {
  // Brand — Modern Purple-Blue
  primary: '#4343d5',
  primaryLight: '#6968e0',
  primaryDark: '#3535b8',
  primaryBg: 'rgba(67, 67, 213, 0.08)',
  primaryBgHover: 'rgba(67, 67, 213, 0.14)',

  // Stitch named colors
  primaryContainer: '#5d5fef',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#faf7ff',

  secondary: '#5c5e63',
  secondaryContainer: '#dedfe5',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#606368',

  tertiary: '#50519b',
  tertiaryContainer: '#696ab5',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#faf6ff',

  // Deal / promo badges (Home Feed hot deals)
  dealBadgeBg: '#e1dfff',
  dealBadgeText: '#3d3e87',

  // Surface
  surface: '#fcf8ff',
  surfaceDim: '#dad7f3',
  surfaceBright: '#fcf8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f2ff',
  surfaceContainer: '#efecff',
  surfaceContainerHigh: '#e8e5ff',
  surfaceContainerHighest: '#e2e0fc',
  surfaceVariant: '#e2e0fc',
  surfaceTint: '#4849da',

  // Inverse
  inverseSurface: '#2f2e43',
  inverseOnSurface: '#f2efff',
  inversePrimary: '#c1c1ff',

  // Outline
  outline: '#767586',
  outlineVariant: '#c7c4d7',

  // Text
  textPrimary: '#1a1a2e',
  textSecondary: '#5c5e63',
  textTertiary: '#767586',
  textInverse: '#ffffff',
  textLink: '#4343d5',

  // Aliases for backward compatibility
  bg: '#ffffff',
  screenBg: '#fcf8ff',

  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',
  success: '#22c55e',
  successBg: 'rgba(67, 67, 213, 0.08)',
  warning: '#e65100',
  warningBg: 'rgba(118, 117, 134, 0.1)',
  info: '#1565c0',
  infoBg: 'rgba(67, 67, 213, 0.08)',

  // Stitch fixed-color tokens (for badges, selection states)
  primaryFixed: '#e1e0ff',
  primaryFixedDim: '#c1c1ff',
  onPrimaryFixed: '#07006c',
  onPrimaryFixedVariant: '#2e2bc2',

  secondaryFixed: '#e1e2e8',
  secondaryFixedDim: '#c5c6cc',
  onSecondaryFixed: '#191c20',
  onSecondaryFixedVariant: '#44474c',

  tertiaryFixed: '#e1dfff',
  tertiaryFixedDim: '#c1c1ff',
  onTertiaryFixed: '#0f0d5a',
  onTertiaryFixedVariant: '#3d3e87',

  // Interactive
  disabled: '#e2e0fc',
  disabledText: '#767586',
  placeholder: '#767586',
  inputBg: '#f5f2ff',
  inputBorder: '#c7c4d7',
  activeButton: '#5d5fef',

  // Borders
  border: '#c7c4d7',
  borderLight: '#e2e0fc',
  borderFocus: '#4343d5',
  borderError: '#ba1a1a',

  // Overlay
  overlay: 'rgba(26, 26, 46, 0.5)',
  overlayLight: 'rgba(26, 26, 46, 0.3)',
  shimmer: '#e2e0fc',

  // Accent (use tertiary for brand accent)
  accent: '#50519b',
  accentLight: 'rgba(80, 81, 155, 0.1)',
  onAccent: '#ffffff',

  // Legacy aliases (used by App.tsx bottom nav + styles/index.ts)
  chipBg: '#f5f2ff',
  muted: '#767586',
  cardBorder: '#c7c4d7',
  cardBg: '#f5f2ff',
  surfaceBg: '#fcf8ff',
  actionBg: '#f5f2ff',

  // Hero section
  heroBg: '#4343d5',
  heroTitle: '#ffffff',
  heroSubtitle: '#e0e0ff',
  heroIconBg: '#5d5fef',

  // News strip
  newsBorder: '#c7c4d7',

  // Shadow helpers (for styles/index.ts)
  shadowLight: 'rgba(26,26,46,0.04)',
  shadowBlue: 'rgba(96,165,250,0.3)',
  shadowDark: 'rgba(0,0,0,0.2)',

  // Category colors (17 industries — refined for violet theme)
  categories: {
    fashion: '#9b6dff',
    electronics: '#4a7dff',
    realEstate: '#6b5fef',
    automobiles: '#5d5fef',
    food: '#43d5a5',
    beauty: '#d56bf0',
    fitness: '#ef5d6b',
    education: '#5fa8ef',
    homeServices: '#a08060',
    art: '#9b6dcc',
    pets: '#d5a060',
    agriculture: '#43b56b',
    kids: '#efb043',
    services: '#50b5a0',
    b2b: '#708090',
    job: '#5080c0',
    medical: '#40c0a0',
  } as Record<string, string>,
} as const;

export const darkColors = {
  // Brand
  primary: '#c1c1ff',
  primaryLight: '#e1e0ff',
  primaryDark: '#a5a6f6',
  primaryBg: 'rgba(193, 193, 255, 0.12)',
  primaryBgHover: 'rgba(193, 193, 255, 0.2)',

  primaryContainer: '#7577f5',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#faf7ff',

  secondary: '#c5c6cc',
  secondaryContainer: '#44474c',
  onSecondary: '#1a1a2e',
  onSecondaryContainer: '#dedfe5',

  tertiary: '#c1c1ff',
  tertiaryContainer: '#3d3e87',
  onTertiary: '#1a1a2e',
  onTertiaryContainer: '#faf6ff',

  dealBadgeBg: '#2b2b45',
  dealBadgeText: '#b9b9ff',

  surface: '#1a1a2e',
  surfaceDim: '#121225',
  surfaceBright: '#1a1a2e',
  surfaceContainerLowest: '#0d0d1a',
  surfaceContainerLow: '#1e1e35',
  surfaceContainer: '#222238',
  surfaceContainerHigh: '#2d2d44',
  surfaceContainerHighest: '#383850',
  surfaceVariant: '#2d2d44',
  surfaceTint: '#c1c1ff',

  inverseSurface: '#e2e0fc',
  inverseOnSurface: '#2f2e43',
  inversePrimary: '#4343d5',

  outline: '#9090a0',
  outlineVariant: '#3d3d55',

  textPrimary: '#f2efff',
  textSecondary: '#c5c6cc',
  textTertiary: '#9090a0',
  textInverse: '#1a1a2e',
  textLink: '#c1c1ff',

  bg: '#0d0d1a',
  screenBg: '#1a1a2e',
  surfaceElevated: '#2d2d44',
  surfaceHover: '#2d2d44',

  error: '#ffb4ab',
  errorContainer: '#93000a',
  onError: '#690005',
  onErrorContainer: '#ffdad6',
  success: '#22c55e',
  successBg: 'rgba(193, 193, 255, 0.12)',
  warning: '#e65100',
  warningBg: 'rgba(144, 144, 160, 0.12)',
  info: '#1565c0',
  infoBg: 'rgba(193, 193, 255, 0.12)',

  primaryFixed: '#e1e0ff',
  primaryFixedDim: '#c1c1ff',
  onPrimaryFixed: '#07006c',
  onPrimaryFixedVariant: '#2e2bc2',

  secondaryFixed: '#e1e2e8',
  secondaryFixedDim: '#c5c6cc',
  onSecondaryFixed: '#191c20',
  onSecondaryFixedVariant: '#44474c',

  tertiaryFixed: '#e1dfff',
  tertiaryFixedDim: '#c1c1ff',
  onTertiaryFixed: '#0f0d5a',
  onTertiaryFixedVariant: '#3d3e87',

  disabled: '#2d2d44',
  disabledText: '#555570',
  placeholder: '#9090a0',
  inputBg: '#222238',
  inputBorder: '#3d3d55',
  activeButton: '#c1c1ff',

  border: '#3d3d55',
  borderLight: '#2d2d44',
  borderFocus: '#c1c1ff',
  borderError: '#ffb4ab',

  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#2d2d44',

  accent: '#c1c1ff',
  accentLight: 'rgba(193, 193, 255, 0.15)',
  onAccent: '#1a1a2e',

  // Legacy aliases (used by App.tsx bottom nav + styles/index.ts)
  chipBg: '#2d2d44',
  muted: '#9090a0',
  cardBorder: '#3d3d55',
  cardBg: '#1e1e35',
  surfaceBg: '#1a1a2e',
  actionBg: '#1e1e35',

  // Hero section
  heroBg: '#2f2e43',
  heroTitle: '#e2e0fc',
  heroSubtitle: '#c7c4d7',
  heroIconBg: '#4343d5',

  // News strip
  newsBorder: '#3d3d55',

  // Shadow helpers (for styles/index.ts)
  shadowLight: 'rgba(0,0,0,0.1)',
  shadowBlue: 'rgba(96,165,250,0.15)',
  shadowDark: 'rgba(0,0,0,0.3)',

  categories: {
    fashion: '#b69dff',
    electronics: '#7ba3ff',
    realEstate: '#9b8fef',
    automobiles: '#8d8ff5',
    food: '#6bebc5',
    beauty: '#e59bf0',
    fitness: '#ef8d8d',
    education: '#8fc5ef',
    homeServices: '#c0a880',
    art: '#bb8dec',
    pets: '#e5c080',
    agriculture: '#6bd58b',
    kids: '#efc063',
    services: '#70d5c0',
    b2b: '#90a0b0',
    job: '#70a0d0',
    medical: '#60d5c0',
  } as Record<string, string>,
} as const;

// ─── CATEGORY CONFIG (icon + color + label) ─────────────────
export const CATEGORIES = [
  { id: 'fashion', label: 'Fashion', icon: 'hanger', color: '#9b6dff' },
  { id: 'electronics', label: 'Electronics', icon: 'cellphone', color: '#4a7dff' },
  { id: 'realEstate', label: 'Real Estate', icon: 'home-city', color: '#6b5fef' },
  { id: 'automobiles', label: 'Automobiles', icon: 'car', color: '#5d5fef' },
  { id: 'food', label: 'Food', icon: 'food-apple', color: '#43d5a5' },
  { id: 'beauty', label: 'Beauty', icon: 'face-woman-shimmer', color: '#d56bf0' },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', color: '#ef5d6b' },
  { id: 'education', label: 'Education', icon: 'school', color: '#5fa8ef' },
  { id: 'homeServices', label: 'Home Services', icon: 'hammer-wrench', color: '#a08060' },
  { id: 'art', label: 'Art & Crafts', icon: 'palette', color: '#9b6dcc' },
  { id: 'pets', label: 'Pets', icon: 'dog', color: '#d5a060' },
  { id: 'agriculture', label: 'Agriculture', icon: 'sprout', color: '#43b56b' },
  { id: 'kids', label: 'Kids', icon: 'baby-face', color: '#efb043' },
  { id: 'services', label: 'Services', icon: 'briefcase', color: '#50b5a0' },
  { id: 'b2b', label: 'B2B', icon: 'domain', color: '#708090' },
  { id: 'job', label: 'Jobs', icon: 'account-tie', color: '#5080c0' },
  { id: 'medical', label: 'Medical', icon: 'medical-bag', color: '#40c0a0' },
] as const;

// ─── ANIMATION CONFIGS ──────────────────────────────────────
export const animation = {
  fast: { duration: 150 },
  normal: { duration: 250 },
  slow: { duration: 400 },
  spring: { damping: 15, stiffness: 150, mass: 1 },
  bounce: { damping: 12, stiffness: 200, mass: 0.8 },
} as const;

// ─── LAYOUT CONSTANTS ───────────────────────────────────────
export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  paddingHorizontal: 20,
  cardGap: 12,
  gutter: 12,
  borderWidth: 1,
  bottomNavHeight: 64,
  headerHeight: 56,
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
    xxl: 72,
    hero: 96,
  },
  image: {
    square: 1,
    portrait: 1.25,
    feed: 1.25,
    story: 0.5625,
    banner: 2,
  },
  cardImageHeight: SCREEN_WIDTH * 0.65,
} as const;

// ─── COMPLETE THEME TYPE ────────────────────────────────────
export type ThemeColors = typeof lightColors;
export type Theme = {
  colors: ThemeColors;
  isDark: boolean;
};

// ─── ACTIVE THEME (mutable — applyTheme swaps it in place) ───
// Every screen imports `colors` directly; Object.assign on this
// object makes dark mode work with ZERO changes to those imports.
export const colors: ThemeColors = { ...lightColors };

// ─── THEME MODE STATE + LISTENER REGISTRY ───────────────────
export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = '@susej_theme';

let currentThemeMode: ThemeMode = 'light';
const themeListeners = new Set<(mode: ThemeMode) => void>();

export const getThemeMode = (): ThemeMode => currentThemeMode;

export function subscribeTheme(fn: (mode: ThemeMode) => void): () => void {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
}

export function applyTheme(mode: ThemeMode): void {
  currentThemeMode = mode;
  Object.assign(colors, mode === 'dark' ? darkColors : lightColors);
  themeListeners.forEach((fn) => fn(mode));
}

// ─── APPEARANCE CONTEXT (settings toggle → _layout remount) ─
export const AppearanceContext = createContext<{
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}>({
  themeMode: 'light',
  setThemeMode: () => {},
});

export const useAppearance = (): {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
} => useContext(AppearanceContext);

// ─── useTheme HOOK ──────────────────────────────────────────
export const useTheme = (): Theme => ({
  colors,
  isDark: getThemeMode() === 'dark',
});

// ─── HELPER: GET CATEGORY COLOR ─────────────────────────────
export const getCategoryColor = (category: string): string => {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  for (const [catKey, color] of Object.entries(lightColors.categories)) {
    if (catKey.toLowerCase() === key || catKey.toLowerCase().includes(key) || key.includes(catKey.toLowerCase())) {
      return color;
    }
  }
  return lightColors.primary;
};

// ─── HELPER: FORMAT PRICE ───────────────────────────────────
export const formatPrice = (price: number): string => {
  if (!Number.isFinite(price) || price < 0) return '₹0';
  const rounded = Math.round(price);
  if (rounded >= 100000) return `₹${(rounded / 100000).toFixed(1)}L`;
  if (rounded >= 1000) return `₹${rounded.toLocaleString('en-IN')}`;
  return `₹${rounded}`;
};

// ─── HELPER: FORMAT COUNT ───────────────────────────────────
export const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return `${count}`;
};
