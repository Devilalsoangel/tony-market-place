import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet } from 'react-native';
// react-native-web throws "Cannot manually set color scheme" unless darkMode flag is 'class'.
// Expo's web bootstrap sets data-color-scheme; this flag makes manual scheme setting legal.
if (Platform.OS === 'web') {
  try {
    // setFlag is an undocumented RN-internal API — cast for TS
    (StyleSheet as unknown as { setFlag: (flag: string, value: string) => void }).setFlag('darkMode', 'class');
  } catch {}
}
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, AppearanceContext, THEME_STORAGE_KEY, type ThemeMode } from '../utils/theme';
import { setLocale, LOCALE_STORAGE_KEY } from '../utils/i18n';
import { AuthProvider } from '../contexts/AuthContext';
import { FollowProvider } from '../contexts/FollowContext';
import { BookmarkProvider } from '../contexts/BookmarkContext';
import { PostProvider } from '../contexts/PostContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { CartProvider } from '../contexts/CartContext';
import { OrderProvider } from '../contexts/OrderContext';
import { CommunityProvider } from '../contexts/CommunityContext';
import { RecentlyViewedProvider } from '../contexts/RecentlyViewedContext';
import { HashtagProvider } from '../contexts/HashtagContext';
import { PromotionProvider } from '../contexts/PromotionContext';
import { OfflineBanner } from '../components/OfflineBanner';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setThemeMode(storedTheme);
        }
        const storedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (storedLocale === 'en' || storedLocale === 'hi') {
          setLocale(storedLocale);
        }
      } catch {
        // storage unavailable — defaults are fine
      }
    })();
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AppearanceContext.Provider value={{ themeMode, setThemeMode }}>
      <AuthProvider>
      <FollowProvider>
      <BookmarkProvider>
        <PostProvider>
          <NotificationProvider>
            <SettingsProvider>
              <CartProvider>
                <OrderProvider>
                  <CommunityProvider>
  <RecentlyViewedProvider>
  <HashtagProvider>
<PromotionProvider>

                        {/* Global offline strip — sits above every screen when device is offline */}
                        <OfflineBanner />
                        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
                        <Stack key={themeMode} screenOptions={{ headerShown: false }} />
</PromotionProvider>
  </HashtagProvider>
  </RecentlyViewedProvider>

                  </CommunityProvider>
                </OrderProvider>
              </CartProvider>
            </SettingsProvider>
          </NotificationProvider>
        </PostProvider>
      </BookmarkProvider>
    </FollowProvider>
    </AuthProvider>
      </AppearanceContext.Provider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
