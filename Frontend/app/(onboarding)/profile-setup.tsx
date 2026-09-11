import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, CameraPlusIcon, PencilIcon, ChevronRightIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { serverApi } from '../../utils/serverApi';
import { uploadToServer } from '../../utils/mediaUpload';
import { profileImages, notificationImages } from '../../utils/screenImages';

type RawSource = number | { uri?: string };

// react-native-web 0.21 does NOT implement Image.resolveAssetSource, and this
// file previously called it at module scope - crashing the ENTIRE web bundle
// during expo-router route validation (TypeError before any screen renders).
// Resolution is therefore fail-soft: object sources carry .uri already; native
// uses the classic Image.resolveAssetSource; platforms lacking the API return
// an empty uri and the caller renders the RAW source directly instead.
const resolveAssetUri = (src: RawSource): string => {
  if (src && typeof src === 'object') {
    return typeof src.uri === 'string' ? src.uri : '';
  }
  const resolver = (
    Image as unknown as {
      resolveAssetSource?: (s: unknown) => { uri?: string } | null;
    }
  ).resolveAssetSource;
  return typeof resolver === 'function' ? resolver(src)?.uri ?? '' : '';
};

const REAL_AVATARS = [...profileImages.highlights, ...notificationImages];
const AVATAR_OPTIONS: { key: string; uri: string; src: RawSource }[] = Array.from(
  { length: 10 },
  (_, i) => {
    const src = REAL_AVATARS[i % REAL_AVATARS.length] as RawSource;
    return { key: String(i), uri: resolveAssetUri(src), src };
  },
);

type NameStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

export default function ProfileSetupScreen() {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const serverHandle = typeof user?.username === 'string' ? user.username : '';
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  // Blank by design: the handle is the user's free choice (Instagram
  // pattern), never a server-prefilled placeholder. The server keeps an
  // auto fallback row-side only so identity can never be null.
  const [username, setUsername] = useState('');
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live DB availability check (debounced, Instagram pattern). The auto
  // fallback handle counts as ours (mine → ok) if the user retypes it.
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const typed = username.trim().toLowerCase();
    if (!typed) {
      setNameStatus('idle');
      return;
    }
    if (typed === serverHandle.toLowerCase() && serverHandle) {
      setNameStatus('ok');
      return;
    }
    if (!/^[a-z0-9._]{3,20}$/.test(typed)) {
      setNameStatus('invalid');
      return;
    }
    setNameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await serverApi.checkUsername(typed);
        if (!res.ok) {
          setNameStatus('idle');
          return;
        }
        setNameStatus(res.data?.available ? 'ok' : 'taken');
      } catch {
        setNameStatus('idle');
      }
    }, 600);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [username, serverHandle]);

  // Gallery pick with system crop (square, auto-centered) → upload first so
  // only a hosted URL is ever persisted (local file:// URIs are unviewable
  // on other devices and rejected by the server).
  const pickFromGallery = async () => {
    setPhotoError('');
    try {
      const ImagePicker = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync?.();
      if (perm && perm.granted === false) {
        setPhotoError('Gallery permission is needed to add a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = String(result.assets[0].uri ?? '');
      if (!uri) return;
      setUploading(true);
      try {
        const hosted = await uploadToServer(uri);
        setAvatar(hosted);
      } catch (e) {
        // Surface the server's reason (e.g. unsupported type) instead of a
        // generic line — the user can act on the truth.
        const msg = e instanceof Error && e.message ? e.message : '';
        setPhotoError(msg || 'Could not upload that photo. Try another one.');
      } finally {
        setUploading(false);
      }
    } catch {
      setPhotoError('Could not open the gallery. Try again.');
    }
  };

  const typedHandle = username.trim().toLowerCase();
  const canContinue =
    !uploading &&
    !saving &&
    !!avatar &&
    name.trim().length > 0 &&
    (nameStatus === 'ok' || (typedHandle !== '' && typedHandle === serverHandle.toLowerCase()));

  const continuePressed = async () => {
    if (uploading || saving) return;
    if (!avatar) {
      setPhotoError('Please add a profile photo to continue.');
      return;
    }
    if (!name.trim()) {
      setSaveError('Please enter your name to continue.');
      return;
    }
    const typed = username.trim().toLowerCase();
    if (!typed || nameStatus === 'invalid') {
      setSaveError('Please choose a valid username (3-20 characters: letters, numbers, dots, underscores).');
      return;
    }
    if (nameStatus !== 'ok' && typed !== serverHandle.toLowerCase()) {
      setSaveError(
        nameStatus === 'taken' ? 'That username is already taken.' : 'Waiting for username check — try again in a moment.'
      );
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      // Claim a changed handle first (409 when someone grabbed it meanwhile).
      if (typed && typed !== serverHandle.toLowerCase()) {
        const claim = await serverApi.claimUsername(typed);
        if (!claim.ok) {
          setSaveError(claim.error ?? 'That username is already taken.');
          return;
        }
      }
      // updateUser returns true, or the server's reason — shown verbatim so
      // the user learns WHAT failed (encoding, validation) instead of a
      // dummy red line blaming their connection.
      const saved = await updateUser({
        name: name.trim(),
        ...(bio.trim() ? { bio: bio.trim().slice(0, 150) } : {}),
        ...(avatar ? { avatar } : {}),
      });
      if (saved !== true) {
        setSaveError(saved || 'Could not save your profile. Please try again.');
        return;
      }
      router.push('/(onboarding)/interests');
    } finally {
      setSaving(false);
    }
  };

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

        {/* Profile Photo — tap the circle for the gallery (square crop built
            in); presets below are one-tap alternatives. A photo is required. */}
        <View className="items-center mb-8">
          <TouchableOpacity className="relative mb-3" activeOpacity={0.7} onPress={pickFromGallery} disabled={uploading}>
            <View
              className="w-[100px] h-[100px] rounded-full items-center justify-center overflow-hidden"
              style={{ backgroundColor: avatar ? 'transparent' : '#efecff' }}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} className="w-full h-full" resizeMode="cover" />
              ) : uploading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <CameraPlusIcon size={44} color={colors.primary} />
              )}
            </View>
            <View
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface }}
            >
              <PencilIcon size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickFromGallery} disabled={uploading}>
            <Text
              className="font-inter-600"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.primary }}
            >
              {uploading ? 'Uploading…' : avatar ? 'Change Photo' : 'Add Photo *'}
            </Text>
          </TouchableOpacity>
          {photoError ? (
            <Text
              className="font-inter-500 mt-2 text-center"
              style={{ fontSize: 12, lineHeight: 16, color: colors.error }}
            >
              {photoError}
            </Text>
          ) : null}

          {/* Avatar presets — always visible, no dropdown. */}
          <View className="w-full mt-5 rounded-figma-16 p-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text
              className="font-inter-600 mb-3"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
            >
              Or pick an avatar
            </Text>
            <View className="flex-row flex-wrap justify-center gap-[10px]">
              {AVATAR_OPTIONS.map((opt) => {
                const selected = opt.uri !== '' && avatar === opt.uri;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    className="w-[52px] h-[52px] rounded-full items-center justify-center"
                    style={{
                      borderWidth: selected ? 3 : 0,
                      borderColor: selected ? colors.primaryContainer : 'transparent',
                    }}
                    activeOpacity={0.7}
                    onPress={() => setAvatar(opt.uri || undefined)}
                  >
                    <Image source={opt.src} className="w-[46px] h-[46px] rounded-full" resizeMode="cover" />
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
              maxLength={80}
            />
          </View>
        </View>

        {/* Username — free choice, checked live against the DB (industry
            standard: no two accounts share a handle). Claimed on Continue. */}
        <View className="mb-4">
          <Text
            className="font-inter-600 mb-2"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
          >
            Username
          </Text>
          <View
            className="flex-row items-center h-[56px] px-4 rounded-figma-16"
            style={{
              backgroundColor: colors.surfaceContainer,
              borderWidth: nameStatus === 'taken' || nameStatus === 'invalid' ? 1.5 : 0,
              borderColor: nameStatus === 'taken' || nameStatus === 'invalid' ? colors.error : 'transparent',
            }}
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
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {nameStatus === 'checking' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : nameStatus === 'ok' ? (
              <Text style={{ fontSize: 18, color: '#16a34a' }}>✓</Text>
            ) : nameStatus === 'taken' || nameStatus === 'invalid' ? (
              <Text style={{ fontSize: 18, color: colors.error }}>✕</Text>
            ) : null}
          </View>
          <Text
            className="font-inter-400 mt-2"
            style={{
              fontSize: 12,
              lineHeight: 16,
              color: nameStatus === 'taken' ? colors.error : colors.textSecondary,
            }}
          >
            {nameStatus === 'taken'
              ? 'That username is already taken.'
              : nameStatus === 'invalid'
                ? 'Use 3-20 characters: lowercase letters, numbers, dots, underscores.'
                : nameStatus === 'checking'
                  ? 'Checking availability…'
                  : 'Your unique public handle — no two accounts share one.'}
          </Text>
        </View>

        {/* Bio (optional, Instagram pattern with counter). */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text
              className="font-inter-600"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textSecondary }}
            >
              Bio
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{bio.trim().length}/150</Text>
          </View>
          <View
            className="px-4 py-3 rounded-figma-16"
            style={{ backgroundColor: colors.surfaceContainer, minHeight: 88 }}
          >
            <TextInput
              className="font-inter-400"
              style={{ fontSize: 16, color: colors.textPrimary, textAlignVertical: 'top' }}
              placeholder="Tell people what you love…"
              placeholderTextColor="rgba(70,69,85,0.4)"
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 150))}
              multiline
              numberOfLines={3}
              maxLength={150}
            />
          </View>
        </View>

        {/* Save error — never advance silently. */}
        {saveError ? (
          <Text
            className="font-inter-500 text-center mb-3"
            style={{ fontSize: 13, lineHeight: 18, color: colors.error }}
          >
            {saveError}
          </Text>
        ) : null}

        {/* Continue Button */}
        <TouchableOpacity
          className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-4"
          style={{ backgroundColor: colors.primary, opacity: saving || uploading ? 0.7 : 1 }}
          onPress={continuePressed}
          disabled={saving || uploading}
        >
          <Text
            className="font-inter-600 mr-2"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </Text>
          {!saving && <ChevronRightIcon size={16} color="#FFFFFF" />}
        </TouchableOpacity>

        {/* Terms */}
        <Text
          className="font-inter-500 text-center mb-8"
          style={{ fontSize: 12, lineHeight: 20, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
        >
          By continuing, you agree to our{' '}
          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => router.push('/terms')}>
            Terms of Service
          </Text>
          {'\n'}and{' '}
          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => router.push('/privacy')}>
            Privacy Policy
          </Text>.
        </Text>
      </ScrollView>
    </View>
  );
}
