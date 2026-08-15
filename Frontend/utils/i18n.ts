/**
 * Internationalization (i18n) configuration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt';

export const i18nStrings: Record<Locale, Record<string, string>> = {
  en: {
    'app.title': 'susej',
    'app.tagline': 'Connect, shop, and trade in one place',
    'nav.home': 'Home',
    'nav.market': 'Market',
    'nav.shop': 'Shop',
    'nav.chat': 'Chat',
    'nav.profile': 'Profile',
    'feed.title': 'Your Daily Feed',
    'feed.subtitle': 'Curated social updates from your communities',
    'market.title': 'Trade Smarter',
    'market.subtitle': 'Monitor stocks and your portfolio in one place',
    'btn.buy': 'Buy',
    'btn.sell': 'Sell',
    'btn.loading': 'Loading...',
    'error.network': 'Network error. Please try again.',
    'error.auth': 'Authentication failed.',
    'success.tradeComplete': 'Trade completed successfully',
    'placeholder.search': 'Search...',
    'label.price': 'Price',
    'label.change24h': '24h Change',
    'label.marketCap': 'Market Cap',
  },
  es: {
    'app.title': 'susej',
    'nav.home': 'Inicio',
    'nav.market': 'Mercado',
    'nav.shop': 'Tienda',
    'nav.chat': 'Chat',
    'nav.profile': 'Perfil',
    'btn.buy': 'Comprar',
    'btn.sell': 'Vender',
  },
  fr: {
    'app.title': 'susej',
    'nav.home': 'Accueil',
    'nav.market': 'Marché',
    'nav.shop': 'Boutique',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    'btn.buy': 'Acheter',
    'btn.sell': 'Vendre',
  },
  de: {
    'app.title': 'susej',
    'nav.home': 'Startseite',
    'nav.market': 'Markt',
    'nav.shop': 'Shop',
    'nav.chat': 'Chat',
    'nav.profile': 'Profil',
    'btn.buy': 'Kaufen',
    'btn.sell': 'Verkaufen',
  },
  pt: {
    'app.title': 'susej',
    'nav.home': 'Início',
    'nav.market': 'Mercado',
    'nav.shop': 'Loja',
    'nav.chat': 'Chat',
    'nav.profile': 'Perfil',
    'btn.buy': 'Comprar',
    'btn.sell': 'Vender',
  },
};

export const getLocalizedString = (key: string, locale: Locale = 'en'): string => {
  return i18nStrings[locale][key] || i18nStrings.en[key] || key;
};

export const formatNumber = (num: number, locale: Locale = 'en'): string => {
  const formatterMap: Record<Locale, Intl.Locale> = {
    en: new Intl.Locale('en-US'),
    es: new Intl.Locale('es-ES'),
    fr: new Intl.Locale('fr-FR'),
    de: new Intl.Locale('de-DE'),
    pt: new Intl.Locale('pt-BR'),
  };
  return new Intl.NumberFormat(formatterMap[locale].toString()).format(num);
};

export const formatCurrency = (num: number, locale: Locale = 'en'): string => {
  const currencyMap: Record<Locale, string> = {en: 'USD', es: 'EUR', fr: 'EUR', de: 'EUR', pt: 'BRL'};
  return new Intl.NumberFormat(locale, {style: 'currency', currency: currencyMap[locale]}).format(num);
};

// ─── APP-LEVEL i18n (EN/HI — settings-facing) ───────────────
export type AppLocale = 'en' | 'hi';
export const LOCALE_STORAGE_KEY = '@susej_locale';

let currentLocale: AppLocale = 'en';
const localeListeners = new Set<(locale: AppLocale) => void>();

export const getLocale = (): AppLocale => currentLocale;

export function subscribeLocale(fn: (locale: AppLocale) => void): () => void {
  localeListeners.add(fn);
  return () => {
    localeListeners.delete(fn);
  };
}

export function setLocale(locale: AppLocale): void {
  currentLocale = locale;
  AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale).catch(() => {});
  localeListeners.forEach((fn) => fn(locale));
}

const translations: Record<AppLocale, Record<string, string>> = {
  en: {
    app_name: 'susej',
    settings: 'Settings',
    profile: 'Profile',
    feed: 'Feed',
    explore: 'Explore',
    create: 'Create',
    chat: 'Chat',
    orders: 'Orders',
    saved: 'Saved',
    wallet: 'Wallet',
    dark_mode: 'Dark Mode',
    dark_mode_subtitle: 'Applies a dark theme across the app',
    language: 'Language',
    refer: 'Refer',
    loyalty: 'Loyalty',
    search: 'Search',
    search_settings: 'Search settings',
    notifications: 'Notifications',
    cart: 'Cart',
    check_out: 'Checkout',
    buy_now: 'Buy Now',
    message: 'Message',
    follow: 'Follow',
    following: 'Following',
    followers: 'Followers',
    live: 'Live',
    reels: 'Reels',
    home: 'Home',
    back: 'Back',
    cancel: 'Cancel',
    save: 'Save',
    apply: 'Apply',
    clear: 'Clear',
    account: 'Account',
    privacy: 'Privacy',
    marketplace: 'Marketplace',
    support: 'Support',
    appearance: 'Appearance',
    edit_profile: 'Edit Profile',
    password_security: 'Password & Security',
    blocked_users: 'Blocked Users',
    private_account: 'Private Account',
    private_subtitle: 'Only followers can see your posts',
    push_notifications: 'Push Notifications',
    email_notifications: 'Email Notifications',
    my_orders: 'My Orders',
    shipping_address: 'Shipping Address',
    payment_methods: 'Payment Methods',
    disputes_refunds: 'Disputes & Refunds',
    logout: 'Log Out',
    english: 'English',
    hindi: 'हिंदी',
  },
  hi: {
    app_name: 'सुसेज',
    settings: 'सेटिंग्स',
    profile: 'प्रोफ़ाइल',
    feed: 'फ़ीड',
    explore: 'एक्सप्लोर',
    create: 'बनाएं',
    chat: 'चैट',
    orders: 'ऑर्डर',
    saved: 'सेव किए',
    wallet: 'वॉलेट',
    dark_mode: 'डार्क मोड',
    dark_mode_subtitle: 'पूरे ऐप पर डार्क थीम लागू करें',
    language: 'भाषा',
    refer: 'रेफ़र',
    loyalty: 'लॉयल्टी',
    search: 'खोजें',
    search_settings: 'सेटिंग्स खोजें',
    notifications: 'सूचनाएं',
    cart: 'कार्ट',
    check_out: 'चेकआउट',
    buy_now: 'अभी खरीदें',
    message: 'संदेश',
    follow: 'फ़ॉलो करें',
    following: 'फ़ॉलो कर रहे हैं',
    followers: 'फ़ॉलोअर्स',
    live: 'लाइव',
    reels: 'रील्स',
    home: 'होम',
    back: 'वापस',
    cancel: 'रद्द करें',
    save: 'सेव करें',
    apply: 'लागू करें',
    clear: 'साफ़ करें',
    account: 'खाता',
    privacy: 'गोपनीयता',
    marketplace: 'मार्केटप्लेस',
    support: 'सहायता',
    appearance: 'रूप-रंग',
    edit_profile: 'प्रोफ़ाइल संपादित करें',
    password_security: 'पासवर्ड और सुरक्षा',
    blocked_users: 'ब्लॉक किए गए उपयोगकर्ता',
    private_account: 'निजी खाता',
    private_subtitle: 'केवल फ़ॉलोअर ही आपकी पोस्ट देख सकते हैं',
    push_notifications: 'पुश सूचनाएं',
    email_notifications: 'ईमेल सूचनाएं',
    my_orders: 'मेरे ऑर्डर',
    shipping_address: 'शिपिंग पता',
    payment_methods: 'भुगतान के तरीके',
    disputes_refunds: 'विवाद और रिफंड',
    logout: 'लॉग आउट',
    english: 'English',
    hindi: 'हिंदी',
  },
};

export const t = (key: string): string => {
  return translations[currentLocale][key] ?? translations.en[key] ?? key;
};
