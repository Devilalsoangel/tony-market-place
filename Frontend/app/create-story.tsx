import { useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { saveMyStory, type MyStory } from '../utils/myStory';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB = (SCREEN_WIDTH - 40 - 12) / 4; // 4 cols with 12px gap

const STORY_SEEDS = [
  'story-1',
  'story-2',
  'story-3',
  'story-4',
  'story-5',
  'story-6',
  'story-7',
  'story-8',
  'story-9',
  'story-10',
  'story-11',
  'story-12',
];

const STORY_URI = (seed: string) => `https://picsum.photos/seed/${seed}/400/700`;

export default function CreateStoryScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = !!selected && !posting;

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      const story: MyStory = { image: selected as string, caption: caption.trim(), time: Date.now() };
      await saveMyStory(story);
      router.back();
    } catch {
      setError('Could not save your story. Please try again.');
      setPosting(false);
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
          Create Story
        </Text>
        <TouchableOpacity onPress={handlePost} disabled={!canPost}>
          <Text
            className="font-inter-700"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: canPost ? colors.primary : colors.textTertiary }}
          >
            {posting ? 'Saving…' : 'Post'}
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
                Pick an image to start your story
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
            {STORY_SEEDS.map((seed) => {
              const active = selected === STORY_URI(seed);
              return (
                <TouchableOpacity
                  key={seed}
                  style={{ width: THUMB, height: THUMB }}
                  className="rounded-figma-8 overflow-hidden"
                  activeOpacity={0.8}
                  onPress={() => setSelected(STORY_URI(seed))}
                >
                  <Image source={{ uri: STORY_URI(seed) }} className="w-full h-full" />
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
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Caption (optional)</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
            placeholder="Add a caption to your story..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={caption}
            onChangeText={setCaption}
          />

          {/* Post button */}
          <TouchableOpacity
            className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
            style={{ backgroundColor: canPost ? colors.primaryContainer : colors.surfaceContainer }}
            activeOpacity={0.85}
            onPress={handlePost}
            disabled={!canPost}
          >
            {posting ? (
              <ActivityIndicator size="small" color={colors.surfaceContainerLowest} />
            ) : (
              <Text className="text-figma-16 font-inter-600" style={{ color: canPost ? colors.surfaceContainerLowest : colors.textTertiary }}>
                Post to Story
              </Text>
            )}
          </TouchableOpacity>
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  );
}
