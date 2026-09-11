import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../../utils/icons';
import { colors, shadows } from '../../utils/theme';
import { serverApi } from '../../utils/serverApi';

const QR_SIZE = 21;
const CELL = 8;
const QR_PX = QR_SIZE * CELL;

function hashCode(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildQrMatrix(seed: number): boolean[][] {
  const rand = mulberry32(seed);
  const m: boolean[][] = Array.from({ length: QR_SIZE }, () =>
    Array.from({ length: QR_SIZE }, () => rand() < 0.48),
  );
  const finder = (fy: number, fx: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = y === 0 || y === 6 || x === 0 || x === 6;
        const core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        m[fy + y][fx + x] = border || core;
      }
    }
    for (let i = 0; i < 7; i++) {
      const rx = fx + 7;
      const ry = fy + 7;
      if (rx < QR_SIZE) m[fy + i][rx] = false;
      if (ry < QR_SIZE) m[ry][fx + i] = false;
    }
  };
  finder(0, 0);
  finder(0, QR_SIZE - 7);
  finder(QR_SIZE - 7, 0);
  return m;
}

export default function ShopQrScreen() {
  const p = useLocalSearchParams<{ username: string | string[] }>();
  const username = Array.isArray(p.username) ? p.username[0] : p.username;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const handle = useMemo(() => (username || '').toLowerCase().trim(), [username]);
  const fallbackName = handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : '';
  const [sellerName, setSellerName] = useState(fallbackName);

  // Resolve the REAL display name from the server profile (fallback: handle).
  useEffect(() => {
    if (!handle) return;
    let active = true;
    serverApi
      .getUserProfile(handle)
      .then((res) => {
        if (!active || !res.ok || !res.data?.user?.name) return;
        setSellerName(String(res.data.user.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [handle]);
  const matrix = useMemo(() => buildQrMatrix(hashCode(handle || 'susej')), [handle]);

  const onShare = async () => {
    try {
      await Share.share({
        message: `Find my shop on susej: search @${handle} in the app`,
      });
    } catch {}
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Header - TopAppBar 52px */}
      <View
        className="flex-row items-center px-5"
        style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 28, color: colors.textPrimary }}>
          Shop Card
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : !handle ? (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32 }}>
          <Text className="text-center font-inter-600" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
            No seller selected
          </Text>
          <Text className="text-center font-inter-400 mt-2" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
            Open this card from a seller profile to see their shop QR.
          </Text>
          <TouchableOpacity
            className="mt-6 h-12 items-center justify-center rounded-figma-16"
            style={{ backgroundColor: colors.primaryContainer, paddingHorizontal: 32 }}
            onPress={() => router.back()}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 24, alignItems: 'center' }}>
          <View
            className="w-full items-center"
            style={{ borderRadius: 24, backgroundColor: colors.surfaceContainerLowest, paddingVertical: 28, paddingHorizontal: 20, ...shadows.card }}
          >
            {/* Decorative shop-card tile — NOT a scannable QR code */}
            <View
              className="items-center justify-center"
              style={{ width: QR_PX + 24, height: QR_PX + 24, borderRadius: 12, backgroundColor: colors.surfaceContainerLowest }}
            >
              {matrix.map((row, y) => (
                <View key={y} className="flex-row">
                  {row.map((dark, x) => (
                    <View
                      key={x}
                      style={{ width: CELL, height: CELL, backgroundColor: dark ? colors.inverseSurface : 'transparent' }}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Text className="font-inter-700 mt-6" style={{ fontSize: 18, lineHeight: 26, color: colors.textPrimary }}>
              @{handle}
            </Text>
            <Text className="font-inter-400 mt-1" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              {sellerName}
            </Text>
            <Text className="font-inter-400 mt-4 text-center" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              Shop share card — invite people to find your shop
            </Text>

            <TouchableOpacity
              className="mt-6 w-full h-12 items-center justify-center rounded-figma-16"
              style={{ backgroundColor: colors.primaryContainer }}
              onPress={onShare}
            >
              <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16 }}>
                Share
              </Text>
            </TouchableOpacity>

            <Text className="font-inter-400 mt-4 text-center" style={{ fontSize: 12, lineHeight: 16, color: colors.textTertiary }}>
              Friends can search this handle in the app to follow your shop
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
