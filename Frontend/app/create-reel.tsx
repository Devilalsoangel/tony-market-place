import { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { isApprovedSeller, sellerPendingReview } from '../utils/marketplace';
import { serverApi } from '../utils/serverApi';
import { uploadAllToServer } from '../utils/mediaUpload';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB = (SCREEN_WIDTH - 40 - 12) / 4; // 4 cols with 12px gap

// Expo Go SDK 57 builds can be missing the expo-image-picker native module;
// lazy-load with a fallback instead of importing at module scope (repo pattern).
type ImagePickerLike = typeof import('expo-image-picker');

function getImagePicker(): ImagePickerLike | null {
  try {
    return require('expo-image-picker') as ImagePickerLike;
  } catch {
    return null;
  }
}

export const MY_REELS_KEY_BASE = '@susej_my_reels';
export const MY_REELS_KEY = MY_REELS_KEY_BASE;
export const MY_REELS_LIMIT = 5;
function getMyReelsKey(username?: string | null) {
  const u = username?.trim();
  return u ? `${MY_REELS_KEY_BASE}:${u}` : MY_REELS_KEY_BASE;
}

export interface MyReel {
  id: string;
  image: string;
  caption: string;
  time: number;
  /** Server row id once published — used to dedupe the local mirror. */
  serverId?: string;
  /** Owner username for headers (was hardcoded @you). */
  owner?: string;
}



export default function CreateReelScreen() {
  const insets = useSafeAreaInsets();
  // Camera shell hand-off: /creator lands here with a captured/picked cover.
  const cameraParams = useLocalSearchParams<{ cameraImage?: string | string[] }>();
  const seededFromCamera: string | null = (() => {
    const raw = cameraParams.cameraImage;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  })();
  const [selected, setSelected] = useState<string | null>(seededFromCamera);
  // OLD-PATH KILL: post-capture editor only. No cover image = old entry point,
  // bounce to the camera-first shell in reel mode (IG pattern).
  useEffect(() => {
    if (!seededFromCamera) router.replace('/(tabs)/creator?mode=reel');
  }, [seededFromCamera]);
  const [caption, setCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sample backgrounds appear ONLY when the device photo picker is unavailable.
  const [pickerFailed, setPickerFailed] = useState(false);

  const canPublish = !!selected && !publishing;

  // ROLE-BASED GUARD: reel publishing needs an APPROVED seller (matches the
  // server 403). Logged-out users fail closed; pending applicants see status.
  const { user } = useAuth();
  if (!isApprovedSeller(user)) {
    const pending = sellerPendingReview(user);
    return (
      <View className="flex-1" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <CloseIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 18, lineHeight: 26 }}>
            Reels are for sellers
          </Text>
          <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 14, lineHeight: 20 }}>
            {pending
              ? 'Your seller application is under review. Reels unlock the moment you are approved.'
              : 'Become a seller to publish reels, list products and go live.'}
          </Text>
          {!pending && (
            <TouchableOpacity
              onPress={() => router.push('/become-seller')}
              className="mt-6 rounded-full px-6 h-11 items-center justify-center"
              style={{ backgroundColor: colors.primaryContainer }}
            >
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                Become a Seller
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const pickFromGallery = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        setPickerFailed(true);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.length) {
        setSelected(result.assets[0].uri);
        setError(null);
      }
    } catch {
      setPickerFailed(true);
    }
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    try {
      // Cover must be hosted BEFORE publishing — a local file:// cover is
      // unviewable on any other device and the server rejects it.
      const hosted = await uploadAllToServer([selected as string]);
      if (hosted.length === 0) {
        setError('Could not upload your cover. Check your connection and try again.');
        setPublishing(false);
        return;
      }
      const res = await serverApi.createReel({
        mediaUrl: hosted[0],
        caption: caption.trim() || 'New reel',
      });
      if (!res.ok) {
        setError(
          res.error === 'offline' || res.error === 'server-unreachable'
            ? 'You are offline — the reel stays on this device and will publish on retry.'
            : (res.error ?? 'Could not publish your reel. Please try again.')
        );
        setPublishing(false);
        return;
      }
      const reel: MyReel = {
        id: `myreel_${Date.now()}`,
        image: hosted[0],
        caption: caption.trim() || 'New reel',
        time: Date.now(),
        serverId: (res.data as { reel?: { id?: string } })?.reel?.id,
        owner: user?.username ?? undefined,
      };
      const key = getMyReelsKey(user?.username);
      let raw = await AsyncStorage.getItem(key);
      if (!raw && key !== MY_REELS_KEY_BASE) raw = await AsyncStorage.getItem(MY_REELS_KEY_BASE);
      let existing: MyReel[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) existing = parsed;
        } catch {
          existing = [];
        }
      }
      const next = [reel, ...existing].slice(0, MY_REELS_LIMIT);
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (raw && key !== MY_REELS_KEY_BASE) {
        // leave legacy for migration; next login migrates via reels.tsx
      }
      router.back();
    } catch {
      setError('Could not publish your reel. Please try again.');
      setPublishing(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-textPrimary" style={{ letterSpacing: -0.5 }}>
          Create Reel
        </Text>
        <TouchableOpacity onPress={handlePublish} disabled={!canPublish}>
          <Text
            className="font-inter-700"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: canPublish ? colors.primary : colors.textTertiary }}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" bounces={false} keyboardShouldPersistTaps="handled">
        {/* Large preview — video from gallery */}
        <View style={{ width: SCREEN_WIDTH, height: 320 }} className="bg-surfaceContainer items-center justify-center">
          {selected ? (
            <View className="w-full h-full items-center justify-center px-6">
              <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: colors.primaryContainer }}>
                <Text style={{ fontSize: 28, color: colors.onPrimary }}>▶</Text>
              </View>
              <Text className="text-figma-12 font-inter-600 text-textSecondary text-center" numberOfLines={2}>
                Video selected from gallery
              </Text>
              <Text className="text-figma-11 font-inter-400 text-textTertiary text-center mt-1" numberOfLines={1}>
                {selected.split('/').pop()}
              </Text>
            </View>
          ) : (
            <View className="w-full h-full items-center justify-center px-6">
              <Text className="text-figma-14 font-inter-400 text-textSecondary text-center">
                Pick a video from your phone gallery to create a reel
              </Text>
              <Text className="text-figma-11 font-inter-400 text-textTertiary text-center mt-2">
                Gallery videos only — no demo content
              </Text>
            </View>
          )}
        </View>

        <View className="px-5 pt-5">
          {/* Real gallery picker — primary path */}
          <TouchableOpacity
            className="w-full h-12 rounded-figma-16 items-center justify-center flex-row"
            style={{ backgroundColor: colors.primaryContainer }}
            activeOpacity={0.85}
            onPress={pickFromGallery}
          >
            <Text className="text-figma-14 font-inter-600" style={{ color: colors.onPrimary }}>
              Choose video from gallery
            </Text>
          </TouchableOpacity>
          {error ? (
            <View className="bg-errorContainer rounded-figma-16 px-4 py-3 mb-3 mt-4">
              <Text className="text-figma-12 font-inter-500" style={{ color: colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          ) : null}
          {pickerFailed ? (
            <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3 mt-4">
              <Text className="text-figma-12 font-inter-500 text-textSecondary text-center">
                Gallery unavailable — please allow media permissions in system settings and try again. No demo videos are included.
              </Text>
            </View>
          ) : null}

          {/* Caption */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Caption</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
            placeholder="Add a caption to your reel..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={caption}
            onChangeText={setCaption}
          />

          {/* Publish button */}
          <TouchableOpacity
            className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
            style={{ backgroundColor: canPublish ? colors.primaryContainer : colors.surfaceContainer }}
            activeOpacity={0.85}
            onPress={handlePublish}
            disabled={!canPublish}
          >
            {publishing ? (
              <ActivityIndicator size="small" color={colors.surfaceContainerLowest} />
            ) : (
              <Text className="text-figma-16 font-inter-600" style={{ color: canPublish ? colors.surfaceContainerLowest : colors.textTertiary }}>
                Publish to Reels
              </Text>
            )}
          </TouchableOpacity>
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  );
}
