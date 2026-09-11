import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';

// Global offline banner (industry standard): a slim strip pinned to the top of
// EVERY screen while the device has no connection. Rendered nothing when
// online. Polls NetInfo — zero fabrication, pure device truth.
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);
  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center justify-center"
      style={{ top: insets.top, backgroundColor: colors.error, height: 28, zIndex: 50 }}
    >
      <Text className="text-white font-inter-600" style={{ fontSize: 12, lineHeight: 16 }}>
        No internet connection — showing saved data
      </Text>
    </View>
  );
}