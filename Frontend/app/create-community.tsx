import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useCommunities } from '../contexts/CommunityContext';

const COMMUNITY_CATEGORIES = ['Technology', 'Fashion', 'Art', 'Wellness', 'Sports', 'Food'];

export default function CreateCommunityScreen() {
  const insets = useSafeAreaInsets();
  const { addCommunity } = useCommunities();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && category.length > 0 && description.trim().length > 0 && !creating;

  const handleCreate = () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    addCommunity({
      id: `community_${Date.now()}`,
      name: name.trim(),
      category,
      memberCount: 1,
      joined: true,
      description: description.trim(),
      rules: rules.trim() || undefined,
    });
    router.replace('/communities');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-textPrimary" style={{ letterSpacing: -0.5 }}>
          Create Community
        </Text>
        <View className="w-5" />
      </View>

      <ScrollView className="flex-1" bounces={false} keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-5">
          {error ? (
            <View className="bg-errorContainer rounded-figma-16 px-4 py-3 mb-4">
              <Text className="text-figma-12 font-inter-500" style={{ color: colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Name */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mb-2">Name</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
            placeholder="e.g. Pune Vintage Collectors"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={40}
          />

          {/* Category */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Category</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {COMMUNITY_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  className={`px-4 py-2 rounded-full ${active ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}
                  onPress={() => setCategory(active ? '' : cat)}
                >
                  <Text className={`text-figma-12 font-inter-500 ${active ? 'text-white' : 'text-textSecondary'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Description</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter', minHeight: 80, textAlignVertical: 'top' }}
            placeholder="What is this community about?"
            placeholderTextColor={colors.textTertiary}
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={200}
          />

          {/* Rules */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Rules (optional)</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter', minHeight: 80, textAlignVertical: 'top' }}
            placeholder="One rule per line, e.g. No spam posts"
            placeholderTextColor={colors.textTertiary}
            multiline
            value={rules}
            onChangeText={setRules}
            maxLength={300}
          />

          {/* Create button */}
          <TouchableOpacity
            className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
            style={{ backgroundColor: canCreate ? colors.primaryContainer : colors.surfaceContainer }}
            activeOpacity={0.85}
            onPress={handleCreate}
            disabled={!canCreate}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.surfaceContainerLowest} />
            ) : (
              <Text className="text-figma-16 font-inter-600" style={{ color: canCreate ? colors.surfaceContainerLowest : colors.textTertiary }}>
                Create Community
              </Text>
            )}
          </TouchableOpacity>
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  );
}
