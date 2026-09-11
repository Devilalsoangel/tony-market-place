import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../utils/theme';
import { resolveAvatar } from '../utils/productImages';

function BackIcon({ size = 18, color = colors.inverseOnSurface }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={color} d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </Svg>
  );
}

function MicIcon({ size = 22, color = colors.inverseSurface }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"
      />
    </Svg>
  );
}

function CameraIcon({ size = 22, color = colors.inverseSurface }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"
      />
    </Svg>
  );
}

function PhoneIcon({ size = 24, color = colors.onError }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      />
    </Svg>
  );
}

const formatTimer = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const raw = Array.isArray(params.name) ? params.name[0] : params.name;
  const partnerName = raw && raw.trim() ? raw.trim() : 'Contact';
  const avatarSeed = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'susejcall';

  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.inverseSurface }}>
      <StatusBar barStyle="light-content" />
      {/* Top bar */}
      <View
        className="flex-row items-center justify-between px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity
          className="w-10 h-10 items-center justify-center rounded-figma-full"
          style={{ backgroundColor: colors.inverseOnSurface }}
          onPress={() => router.back()}
        >
          <BackIcon size={18} color={colors.inverseSurface} />
        </TouchableOpacity>
        <View className="flex-1 items-center" style={{ marginRight: 40 }}>
          <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.inverseOnSurface }}>
            susej Call
          </Text>
          <Text className="font-inter-500 mt-0.5" style={{ fontSize: 13, lineHeight: 16, color: colors.inversePrimary }}>
            {formatTimer(seconds)}
          </Text>
        </View>
        <View className="w-10" />
      </View>

      {/* Center — partner */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="rounded-full" style={{ borderWidth: 4, borderColor: colors.primaryContainer, padding: 6 }}>
          <Image
            source={resolveAvatar(avatarSeed)}
            className="w-36 h-36 rounded-full"
            resizeMode="cover"
          />
        </View>
        <Text className="font-inter-700 mt-8" style={{ fontSize: 24, lineHeight: 30, color: colors.inverseOnSurface }}>
          {partnerName}
        </Text>
        <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? colors.success : colors.inversePrimary }}
          />
          <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.inversePrimary }}>
            {connected ? 'Demo call' : 'Connecting…'}
          </Text>
        </View>
        {connected && (
          <View
            className="mt-4 items-center justify-center"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: colors.inverseOnSurface,
            }}
          >
            <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.inversePrimary }}>
              Demo preview
            </Text>
          </View>
        )}
        <Text className="font-inter-400 mt-6 text-center" style={{ fontSize: 12, lineHeight: 16, color: colors.inversePrimary }}>
          {connected
            ? 'Preview only - this screen demonstrates the call UI. No live audio or video.'
            : 'Waiting for the other person to join…'}
        </Text>
      </View>

      {/* Bottom controls */}
      <View
        className="flex-row items-center justify-center px-8"
        style={{ gap: 32, paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <View className="items-center">
          <TouchableOpacity
            className="w-16 h-16 items-center justify-center rounded-figma-full"
            style={{ backgroundColor: colors.inverseOnSurface }}
            onPress={() => setMuted((v) => !v)}
          >
            <View style={{ opacity: muted ? 0.4 : 1 }}>
              <MicIcon size={22} color={colors.inverseSurface} />
            </View>
          </TouchableOpacity>
          <Text className="font-inter-500 mt-2" style={{ fontSize: 11, lineHeight: 13, color: colors.inversePrimary }}>
            {muted ? 'Unmute' : 'Mute'}
          </Text>
        </View>
        <View className="items-center">
          <TouchableOpacity
            className="w-16 h-16 items-center justify-center rounded-figma-full"
            style={{ backgroundColor: colors.inverseOnSurface }}
            onPress={() => setCameraOff((v) => !v)}
          >
            <View style={{ opacity: cameraOff ? 0.4 : 1 }}>
              <CameraIcon size={22} color={colors.inverseSurface} />
            </View>
          </TouchableOpacity>
          <Text className="font-inter-500 mt-2" style={{ fontSize: 11, lineHeight: 13, color: colors.inversePrimary }}>
            {cameraOff ? 'Camera on' : 'Camera off'}
          </Text>
        </View>
        <View className="items-center">
          <TouchableOpacity
            className="w-16 h-16 items-center justify-center rounded-figma-full"
            style={{ backgroundColor: colors.error }}
            onPress={() => router.back()}
          >
            <PhoneIcon size={24} color={colors.onError} />
          </TouchableOpacity>
          <Text className="font-inter-500 mt-2" style={{ fontSize: 11, lineHeight: 13, color: colors.error }}>
            End
          </Text>
        </View>
      </View>
    </View>
  );
}
