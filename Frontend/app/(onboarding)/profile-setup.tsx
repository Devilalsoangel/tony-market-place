import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, CameraPlusIcon, PencilIcon, ChevronRightIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { profileImages, notificationImages } from '../../utils/screenImages';

const REAL_AVATARS = [...profileImages.highlights, ...notificationImages];
const AVATAR_OPTIONS: { key: string; uri: string }[] = Array.from({ length: 10 }, (_, i) => {
  const resolved = Image.resolveAssetSource(REAL_AVATARS[i % REAL_AVATARS.length]);
  return { key: String(i), uri: resolved.uri };
});

export default function ProfileSetupScreen() {
  const { updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller' | 'both'>('buyer');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center h-[62px] px-5" style={{ backgroundColor: colors.surface, height: 62 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text
          className="flex-1 text-center font-inter-700"
          style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, marginRight: 18, color: colors.primary }}
        >
          susej
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Progress Indicators - 5 of 6 */}
        <View className="flex-row gap-2 mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="flex-1 h-1.5 rounded-full"
              style={{ backgroundColor: i < 5 ? colors.primaryContainer : colors.surfaceContainer }}
            />
          ))}
        </View>

        {/* Header Content */}
        <Text
          className="font-inter-700 mb-2"
          style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.64, color: colors.textPrimary }}
        >
          Set up your profile
        </Text>
        <Text
          className="font-inter-400 mb-8"
          style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}
        >
          Tell us a bit about yourself to get started on{'\n'}susej.
        </Text>

        {/* Profile Photo - Camera + Pencil */}
        <View className="items-center mb-8">
          <TouchableOpacity className="relative mb-3" activeOpacity={0.7} onPress={() => setPickerOpen((o) => !o)}>
            {/* Camera circle */}
            <View
              className="w-[100px] h-[100px] rounded-full items-center justify-center overflow-hidden"
              style={{ backgroundColor: avatar ? 'transparent' : '#efecff' }}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <CameraPlusIcon size={44} color={colors.primary} />
              )}
            </View>
            {/* Pencil badge */}
            <View
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface }}
            >
              <PencilIcon size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPickerOpen((o) => !o)}>
            <Text
              className="font-inter-600"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.primary }}
            >
              {avatar ? 'Change Photo' : 'Add Photo'}
            </Text>
          </TouchableOpacity>

          {/* Avatar picker panel */}
          {pickerOpen && (
            <View className="w-full mt-5 rounded-figma-16 p-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
              <Text
                className="font-inter-600 mb-3"
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
              >
                Choose your avatar
              </Text>
              <View className="flex-row flex-wrap justify-center gap-[10px]">
                {AVATAR_OPTIONS.map((opt) => {
                  const selected = avatar === opt.uri;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      className="w-[52px] h-[52px] rounded-full items-center justify-center"
                      style={{
                        borderWidth: selected ? 3 : 0,
                        borderColor: selected ? colors.primaryContainer : 'transparent',
                      }}
                      activeOpacity={0.7}
                      onPress={() => setAvatar(opt.uri)}
                    >
                      <Image source={{ uri: opt.uri }} className="w-[46px] h-[46px] rounded-full" resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {avatar ? (
                <TouchableOpacity className="self-center mt-4" onPress={() => setAvatar(undefined)}>
                  <Text
                    className="font-inter-600"
                    style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
                  >
                    Remove photo
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Full Name */}
        <View className="mb-4">
          <Text
            className="font-inter-600 mb-2"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
          >
            Full Name
          </Text>
          <View
            className="h-[56px] px-4 rounded-figma-16 justify-center"
            style={{ backgroundColor: colors.surfaceContainer }}
          >
            <TextInput
              className="font-inter-400"
              style={{ fontSize: 16, color: colors.textPrimary }}
              placeholder="Enter your name"
              placeholderTextColor="rgba(70,69,85,0.4)"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Username */}
        <View className="mb-6">
          <Text
            className="font-inter-600 mb-2"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
          >
            Username
          </Text>
          <View
            className="flex-row items-center h-[56px] px-4 rounded-figma-16"
            style={{ backgroundColor: colors.surfaceContainer }}
          >
            <Text
              className="font-inter-400"
              style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}
            >
              @
            </Text>
            <TextInput
              className="flex-1 ml-1 font-inter-400"
              style={{ fontSize: 16, color: colors.textPrimary }}
              placeholder="username"
              placeholderTextColor="rgba(70,69,85,0.4)"
              value={username}
              onChangeText={setUsername}
            />
          </View>
        </View>

        {/* I am a: Segmented Control */}
        <Text
          className="font-inter-600 mb-3"
          style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
        >
          I am a:
        </Text>
        <View
          className="flex-row h-14 rounded-figma-16 mb-10 p-1"
          style={{ backgroundColor: colors.surfaceContainer }}
        >
          {(['buyer', 'seller', 'both'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              className="flex-1 items-center justify-center rounded-figma-8"
              style={{ backgroundColor: role === r ? colors.surfaceContainerLowest : 'transparent' }}
              onPress={() => setRole(r)}
            >
              <Text
                className="font-inter-600"
                style={{
                  fontSize: 14,
                  lineHeight: 16,
                  letterSpacing: 0.14,
                  color: role === r ? colors.primary : colors.textSecondary,
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={() => {
            updateUser({
              name: name.trim() || 'New User',
              username: username.trim() || 'user',
              role,
              isSeller: role === 'seller' || role === 'both',
              ...(avatar ? { avatar } : {}),
            });
            router.push('/(onboarding)/interests');
          }}
        >
          <Text
            className="font-inter-600 mr-2"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
          >
            Continue
          </Text>
          <ChevronRightIcon size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Terms */}
        <Text
          className="font-inter-500 text-center mb-8"
          style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
        >
          By continuing, you agree to our Terms of Service{'\n'}and Privacy Policy.
        </Text>
      </ScrollView>
    </View>
  );
}
