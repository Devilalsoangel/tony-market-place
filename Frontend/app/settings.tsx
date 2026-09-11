import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../utils/icons';
import { colors, useAppearance, type ThemeMode } from '../utils/theme';
import { t, getLocale, setLocale, type AppLocale } from '../utils/i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPermStatus, requestPerm, type PermKind, type PermState } from '../utils/permissions';
import { useEffect } from 'react';

const ICON_PATHS: Record<string, string> = {
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z',
  block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C6.45 4.63 6 4.85 6 4v-1h12v1c0 1.85-.63 3.55-1.69 4.9z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  email: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  orders: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 15.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5 1.5-.67 1.5-1.5 1.5zM13.5 8.5H8V7h5.5v1.5zM14.5 11H8V9.5h6.5V11zM18 15.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5 1.5-.67 1.5-1.5 1.5z',
  shipping: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  payment: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  moon: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
};

const T_KEY: Record<string, string> = {
  ACCOUNT: 'account',
  PRIVACY: 'privacy',
  NOTIFICATIONS: 'notifications',
  MARKETPLACE: 'marketplace',
  SUPPORT: 'support',
  'Edit Profile': 'edit_profile',
  'Password & Security': 'password_security',
  'Blocked Users': 'blocked_users',
  'Private Account': 'private_account',
  'Push Notifications': 'push_notifications',
  'Email Notifications': 'email_notifications',
  'My Orders': 'my_orders',
  'Shipping Address': 'shipping_address',
  'Payment Methods': 'payment_methods',
  'Disputes & Refunds': 'disputes_refunds',
};

const tr = (text: string): string => (T_KEY[text] ? t(T_KEY[text]) : text);

function MenuIcon({ icon }: { icon: string }) {
  const path = ICON_PATHS[icon] || ICON_PATHS.person;
  return (
    <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainerLow }}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill={colors.primary}>
        <Path d={path} />
      </Svg>
    </View>
  );
}

type SettingsItem = { label: string; icon: string; route?: string; subtitle?: string };
type SettingsSection = {
  title: string;
  items: SettingsItem[];
  showToggle?: boolean;
  toggleLabel?: string;
  toggleSubtitle?: string;
  toggleIcon?: string;
};

const sections: SettingsSection[] = [
  {
    title: 'ACCOUNT',
    items: [
      { label: 'Edit Profile', icon: 'person', route: '/edit-profile' },
      { label: 'Password & Security', icon: 'lock', route: '/password-security' },
    ],
  },
  {
    title: 'PRIVACY',
    items: [{ label: 'Blocked Users', icon: 'block', route: '/blocked' }],
    showToggle: true,
    toggleLabel: 'Private Account',
    toggleSubtitle: 'Only followers can see your posts',
    toggleIcon: 'shield',
  },
  {
    title: 'NOTIFICATIONS',
    items: [
      { label: 'Push Notifications', icon: 'bell' },
      { label: 'Email Notifications', icon: 'email' },
    ],
  },
  {
    title: 'MARKETPLACE',
    items: [
      { label: 'My Orders', icon: 'orders', route: '/orders' },
      { label: 'Shipping Address', icon: 'shipping', route: '/address-book' },
      { label: 'Payment Methods', icon: 'payment', route: '/payment-methods' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [{ label: 'Disputes & Refunds', icon: 'shield', route: '/disputes' }],
  },
];

export default function SettingsScreen() {
  const [search, setSearch] = useState('');
  const [locale, setLocaleState] = useState<AppLocale>(getLocale());
  const { themeMode, setThemeMode } = useAppearance();
  const { settings, updateSetting } = useSettings();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  // App permissions — live status + tap to fire the OS popup
  const PERMS: Array<{ kind: PermKind; icon: string; title: string; subtitle: string }> = [
    { kind: 'location', icon: 'shipping', title: 'Location', subtitle: 'Find nearby sellers and deliver to your area' },
    { kind: 'media', icon: 'orders', title: 'Photos & Videos', subtitle: 'Pick gallery media for your posts' },
    { kind: 'camera', icon: 'bell', title: 'Camera', subtitle: 'Capture photos for listings and profile' },
  ];
  const [permStates, setPermStates] = useState<Record<string, PermState>>({});

  const refreshPerms = async () => {
    const entries = await Promise.all(
      PERMS.map(async (p) => [p.kind, await getPermStatus(p.kind)] as const)
    );
    setPermStates(Object.fromEntries(entries));
  };

  useEffect(() => {
    refreshPerms();
  }, []);

  const askPerm = async (kind: PermKind) => {
    await requestPerm(kind);
    refreshPerms();
  };

  const changeTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const changeLocale = (next: AppLocale) => {
    setLocale(next);
    setLocaleState(next);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
{/* Header: back + title only (practical: no cart bag in Settings - utility screen) */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="flex-1 ml-4 font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          {t('settings')}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 128 + insets.bottom }}>
        {/* Search Bar â€” compact */}
        <View className="mx-5 mb-5" style={{ height: 40 }}>
          <View className="flex-row items-center h-full rounded-[12px] pl-7 pr-4" style={{ backgroundColor: colors.inputBg }}>
            <View style={{ opacity: 0.6 }}>
              <SearchIcon size={15} color={colors.textSecondary} />
            </View>
            <TextInput
              className="flex-1 ml-3 h-full"
              style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textTertiary }}
              placeholder={t('search_settings')}
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} className="mb-5 mx-5">
            {/* Section Title â€” ALL CAPS, light, letter-spaced (Figma) */}
<Text
              className="font-inter-400 mb-3"
              style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.8, color: colors.secondary }}
            >
              {tr(section.title).toUpperCase()}
            </Text>

            {/* Card â€” grouped white card on lavender bg */}
            <View
              className="rounded-[16px] overflow-hidden"
              style={{
                backgroundColor: colors.surfaceContainerLowest,
                shadowColor: colors.textPrimary,
                shadowOpacity: 0.05,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              {/* Toggle Row: Private Account */}
              {section.showToggle && (
                <View className="flex-row items-center justify-between px-4 py-4">
                  <View className="flex-row items-center flex-1 mr-4">
                    <MenuIcon icon={section.toggleIcon || 'shield'} />
                    <View className="ml-4 flex-1">
                      <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                        {tr(section.toggleLabel || '')}
                      </Text>
                      {section.toggleSubtitle && (
                        <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                          {t('private_subtitle')}
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Toggle */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => updateSetting('privateAccount', !settings.privateAccount)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 9999,
                      backgroundColor: settings.privateAccount ? colors.primaryContainer : colors.secondaryContainer,
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 9999,
                        backgroundColor: colors.surfaceContainerLowest,
                        alignSelf: settings.privateAccount ? 'flex-end' : 'flex-start',
                      }}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Menu Items */}
              {section.items.map((item, i, arr) => (
                <View key={item.label}>
                  <TouchableOpacity className="flex-row items-center justify-between px-4" style={{ height: 56 }} onPress={() => item.route && router.push(item.route)}>
                    <View className="flex-row items-center flex-1 mr-4">
                      <MenuIcon icon={item.icon} />
                      <View className="ml-4 flex-1">
                        <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                          {tr(item.label)}
                        </Text>
                        {item.subtitle && (
                          <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </View>
                    <ChevronRightIcon size={14} color={colors.secondary} style={{ opacity: 0.6 } as any} />
                  </TouchableOpacity>
                  {i < arr.length - 1 && (
                    <View className="mx-4" style={{ height: 1, backgroundColor: colors.surfaceContainerHigh, opacity: 0.3 }} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Appearance */}
        <View className="mb-6 mx-5">
<Text
            className="font-inter-500 text-textSecondary mb-3"
            style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.8, color: colors.secondary }}
          >
            {t('appearance').toUpperCase()}
          </Text>

          <View
            className="rounded-[16px] overflow-hidden"
style={{
                backgroundColor: colors.surfaceContainerLowest,
                shadowColor: colors.textPrimary,
                shadowOpacity: 0.05,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
          >
            {/* Dark Mode Toggle */}
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center flex-1 mr-4">
                <MenuIcon icon="moon" />
                <View className="ml-4 flex-1">
                  <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                    {t('dark_mode')}
                  </Text>
                  <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                    {t('dark_mode_subtitle')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => changeTheme(themeMode === 'dark' ? 'light' : 'dark')}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 9999,
                  backgroundColor: themeMode === 'dark' ? colors.primaryContainer : colors.secondaryContainer,
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 9999,
                    backgroundColor: colors.surfaceContainerLowest,
                    alignSelf: themeMode === 'dark' ? 'flex-end' : 'flex-start',
                  }}
                />
              </TouchableOpacity>
            </View>

            <View className="mx-4" style={{ height: 1, backgroundColor: colors.surfaceContainerHigh, opacity: 0.3 }} />

            {/* Language */}
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center flex-1 mr-4">
                <MenuIcon icon="globe" />
                <Text className="ml-4 font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                  {t('language')}
                </Text>
              </View>
              <View className="flex-row" style={{ borderRadius: 9999, backgroundColor: colors.surfaceContainerLow, padding: 3 }}>
                {(
                  [
                    { code: 'en' as AppLocale, label: 'English' },
                    { code: 'hi' as AppLocale, label: t('hindi') },
                  ]
                ).map((pill) => {
                  const active = locale === pill.code;
                  return (
                    <TouchableOpacity
                      key={pill.code}
                      activeOpacity={0.8}
                      onPress={() => changeLocale(pill.code)}
                      style={{
                        paddingHorizontal: 14,
                        height: 28,
                        borderRadius: 9999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.primaryContainer : 'transparent',
                      }}
                    >
                      <Text
                        className="font-inter-500"
                        style={{
                          fontSize: 13,
                          lineHeight: 16,
                          color: active ? colors.onPrimary : colors.textSecondary,
                        }}
                      >
                        {pill.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

{/* Log Out */}
        <TouchableOpacity
          className="mx-5 items-center justify-center"
          style={{ height: 56, backgroundColor: 'rgba(255, 218, 214, 0.2)', borderRadius: 16 }}
          onPress={() => { logout(); router.replace('/login'); }}
        >
          <Text className="font-inter-500" style={{ fontSize: 16, lineHeight: 24, color: colors.error }}>
            {t('logout')}
          </Text>
        </TouchableOpacity>

        {/* App version — practical footer for support/debugging */}
        <View className="items-center mt-6">
          <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.secondary }}>
            susej v1.0.0 (build 57)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}



