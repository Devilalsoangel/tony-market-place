/**
 * susej — Shared Type Definitions
 * Extracted from App.tsx monolith
 */

// ─── USER TYPES ──────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  pronouns: string;
  location: string;
  website: string;
  company: string;
  jobTitle: string;
  interests: string[];
  language: string;
  timezone: string;
}

export interface EditableProfileState {
  name: string;
  username: string;
  avatar: string;
  bio: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  pronouns: string;
  location: string;
  website: string;
  company: string;
  jobTitle: string;
  interests: string;
  language: string;
  timezone: string;
}

export const buildEditableProfileState = (profile: User): EditableProfileState => ({
  name: profile.name,
  username: profile.username,
  avatar: profile.avatar,
  bio: profile.bio,
  email: profile.email,
  phone: profile.phone,
  dateOfBirth: profile.dateOfBirth,
  gender: profile.gender,
  pronouns: profile.pronouns,
  location: profile.location,
  website: profile.website,
  company: profile.company,
  jobTitle: profile.jobTitle,
  interests: profile.interests.join(', '),
  language: profile.language,
  timezone: profile.timezone,
});

// ─── POST / PRODUCT TYPES ────────────────────────────────────
export interface Post {
  id: number;
  user_id: number;
  username: string;
  avatar: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  timestamp: string;
  price?: number;
  category?: string;
  condition?: string;
  hashtags?: string[];
  seller_name?: string;
  seller_avatar?: string;
}

export interface Product {
  id: number;
  seller_id: number;
  seller_name: string;
  seller_avatar: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  sold: number;
  stock: number;
  shipping_cost: number;
  estimated_delivery: string;
}

export interface CartItem {
  product_id: number;
  seller_id: number;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  user_id: number;
  items: CartItem[];
  total_price: number;
  shipping_address: string;
  status: string;
  created_at: string;
  estimated_delivery: string;
}

// ─── CHAT TYPES ──────────────────────────────────────────────
export interface Conversation {
  user_id: number;
  user: User;
  last_message: string;
  timestamp: string;
  unread: boolean;
}

export interface ChatMessage {
  id: number;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
}

// ─── STORY TYPES ─────────────────────────────────────────────
export interface Story {
  id: number;
  user_id: number;
  username: string;
  avatar: string;
  image: string;
  expires_in: number;
}

// ─── FINANCE / MARKET TYPES ──────────────────────────────────
export interface Stock {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_amount: number;
  market_cap: string;
  volume: string;
  rating: number;
  reviews: number;
  high_52w: number;
  low_52w: number;
  pe_ratio: number;
  dividend_yield: number;
  description: string;
  chart_data: number[];
}

export interface StockCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface StockChartPayload {
  symbol: string;
  range: string;
  interval: string;
  candles: StockCandle[];
  indicators: {
    sma20: Array<number | null>;
    ema20: Array<number | null>;
    rsi14: Array<number | null>;
  };
}

export interface TrendLine {
  id: number;
  startIdx: number;
  endIdx: number;
  startPrice: number;
  endPrice: number;
  slope: number;
  color: string;
}

export interface ForexPair {
  id: number;
  symbol: string;
  name: string;
  rate: number;
  bid: number;
  ask: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  description: string;
  chart_data: number[];
}

export interface Cryptocurrency {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  market_cap: string;
  volume: string;
}

export interface CopyTrader {
  id: number;
  trader_id: number;
  trader_name: string;
  followers: number;
  win_rate: number;
  roi: number;
  total_trades: number;
  created_at: string;
}

// ─── WALLET / LOYALTY TYPES ──────────────────────────────────
export interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  total_spent: number;
  total_earned: number;
  created_at: string;
}

export interface LoyaltyPoints {
  id: number;
  user_id: number;
  points: number;
  tier: string;
  created_at: string;
}

// ─── NOTIFICATION TYPES ──────────────────────────────────────
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

// ─── EXTERNAL DATA TYPES ─────────────────────────────────────
export interface NewsArticle {
  title: string;
  source?: { name?: string };
  url?: string;
  publishedAt?: string;
}

export interface ExternalPhoto {
  id: number;
  src?: { medium?: string; large?: string };
  alt?: string;
}

// ─── WISHLIST TYPE ───────────────────────────────────────────
export interface Wishlist {
  id: number;
  user_id: number;
  product_id: number;
  added_at: string;
  product?: Product;
}

// ─── AUTH TYPES ──────────────────────────────────────────────
export interface AuthAccount {
  id: number;
  fullName: string;
  username: string;
  email: string;
  password: string;
  provider?: string;
}

export interface AuthApiUser {
  id: number;
  full_name: string;
  username: string;
  email: string;
  provider?: string | null;
}

export interface AuthActionResult {
  account: AuthAccount | null;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

// ─── NAVIGATION TYPES ────────────────────────────────────────
export type Screen =
  | 'feed'
  | 'explore'
  | 'create'
  | 'chat'
  | 'profile'
  | 'stories'
  | 'cart'
  | 'orders'
  | 'notifications'
  | 'search'
  | 'settings'
  | 'map'
  | 'categoryDetail'
  | 'communities'
  | 'hashtagDetail'
  | 'reels'
  | 'productDetails'
  | 'sellerProfile'
  | 'editProfile'
  // Onboarding flow
  | 'auth'
  | 'otp'
  | 'location'
  | 'profileSetup'
  | 'interests'
  | 'firstFeed'
  // New commerce screens
  | 'foodHub'
  | 'bookService'
  | 'becomeSeller'
  | 'sellerDashboard'
  | 'rateReview'
  | 'trackOrder'
  | 'vintageResults'
  | 'saved'
  | 'communityChat';

export type ThemeMode = 'System' | 'Light' | 'Dark';

// ─── OPTIONS ARRAYS ──────────────────────────────────────────
export const GENDER_OPTIONS = [
  { label: 'Not specified', value: '' },
  { label: 'Female', value: 'Female' },
  { label: 'Male', value: 'Male' },
  { label: 'Non-binary', value: 'Non-binary' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

export const PRONOUN_OPTIONS = [
  { label: 'Not specified', value: '' },
  { label: 'She/Her', value: 'She/Her' },
  { label: 'He/Him', value: 'He/Him' },
  { label: 'They/Them', value: 'They/Them' },
  { label: 'Other', value: 'Other' },
];

export const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
  { label: 'German', value: 'German' },
  { label: 'Portuguese', value: 'Portuguese' },
];

export const TIMEZONE_OPTIONS = [
  { label: 'Eastern (America/New_York)', value: 'America/New_York' },
  { label: 'Central (America/Chicago)', value: 'America/Chicago' },
  { label: 'Mountain (America/Denver)', value: 'America/Denver' },
  { label: 'Pacific (America/Los_Angeles)', value: 'America/Los_Angeles' },
  { label: 'Alaska (America/Anchorage)', value: 'America/Anchorage' },
  { label: 'Hawaii (Pacific/Honolulu)', value: 'Pacific/Honolulu' },
  { label: 'UTC', value: 'UTC' },
];

export const MONTH_OPTIONS = [
  { label: 'Jan', value: '01' },
  { label: 'Feb', value: '02' },
  { label: 'Mar', value: '03' },
  { label: 'Apr', value: '04' },
  { label: 'May', value: '05' },
  { label: 'Jun', value: '06' },
  { label: 'Jul', value: '07' },
  { label: 'Aug', value: '08' },
  { label: 'Sep', value: '09' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const year = CURRENT_YEAR - index;
  return { label: String(year), value: String(year) };
});

// ─── HELPER FUNCTIONS ────────────────────────────────────────
export const parseInterestTags = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

export const parseBirthDateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return { year: '', month: '', day: '' };
  }
  const year = match[1];
  const monthNumber = Math.max(1, Math.min(Number(match[2]), 12));
  const month = String(monthNumber).padStart(2, '0');
  const day = match[3];
  const maxDays = new Date(Number(year), monthNumber, 0).getDate();
  const safeDay = String(Math.max(1, Math.min(Number(day), maxDays))).padStart(2, '0');
  return { year, month, day: safeDay };
};
