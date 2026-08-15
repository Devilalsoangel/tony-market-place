import { useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon } from '../utils/icons';
import { colors } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB = (SCREEN_WIDTH - 40 - 12) / 4; // 4 cols with 12px gap

export const MY_REELS_KEY = '@susej_my_reels';
export const MY_REELS_LIMIT = 5;

export interface MyReel {
  id: string;
  image: string;
  caption: string;
  time: number;
}

const REEL_SEEDS = [
  'reel-1',
  'reel-2',
  'reel-3',
  'reel-4',
  'reel-5',
  'reel-6',
  'reel-7',
  'reel-8',
  'reel-9',
  'reel-10',
  'reel-11',
  'reel-12',
];

const REEL_URI = (seed: string) => `https://picsum.photos/seed/${seed}/400/700`;

export default function CreateReelScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPublish = !!selected && !publishing;

  const handlePublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    try {
      const reel: MyReel = {
        id: `myreel_${Date.now()}`,
        image: selected as string,
        caption: caption.trim() || 'New reel',
        time: Date.now(),
      };
      const existingRaw = await AsyncStorage.getItem(MY_REELS_KEY);
      let existing: MyReel[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed)) existing = parsed;
        } catch {
          existing = [];
        }
      }
      const next = [reel, ...existing].slice(0, MY_REELS_LIMIT);
      await AsyncStorage.setItem(MY_REELS_KEY, JSON.stringify(next));
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
        {/* Large preview */}
        <View style={{ width: SCREEN_WIDTH, height: 320 }} className="bg-surfaceContainer">
          {selected ? (
            <Image source={{ uri: selected }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-figma-14 font-inter-400 text-textSecondary">
                Pick an image to start your reel
              </Text>
            </View>
          )}
        </View>

        <View className="px-5 pt-5">
          {/* Image grid */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mb-3">Choose image</Text>
          {error ? (
            <View className="bg-errorContainer rounded-figma-16 px-4 py-3 mb-3">
              <Text className="text-figma-12 font-inter-500" style={{ color: colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {REEL_SEEDS.map((seed) => {
              const active = selected === REEL_URI(seed);
              return (
                <TouchableOpacity
                  key={seed}
                  style={{ width: THUMB, height: THUMB }}
                  className="rounded-figma-8 overflow-hidden"
                  activeOpacity={0.8}
                  onPress={() => setSelected(REEL_URI(seed))}
                >
                  <Image source={{ uri: REEL_URI(seed) }} className="w-full h-full" />
                  {active && (
                    <View className="absolute inset-0 items-center justify-center bg-primaryContainer/40">
                      <CheckIcon size={22} color={colors.surfaceContainerLowest} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

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
