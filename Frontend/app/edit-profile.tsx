import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Image, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../contexts/AuthContext';
import { editProfileImages } from '../utils/screenImages';

// Expo Go SDK 57 builds can be missing the expo-image-picker native module
// ('Cannot find native module ExponentImagePicker'); importing at module scope
// would redbox the whole screen. Lazy-load with a fallback instead.
type ImagePickerLike = typeof import('expo-image-picker');

function getImagePicker(): ImagePickerLike | null {
  try {
    return require('expo-image-picker') as ImagePickerLike;
  } catch {
    return null;
  }
}

const PROFILE_SETTINGS_KEY_BASE = '@susej_profile_settings';

const CATEGORIES = [
  'Fashion', 'Electronics', 'Real Estate', 'Automobiles',
  'Food', 'Beauty', 'Fitness', 'Education',
  'Home Services', 'Art & Crafts', 'Pets', 'Kids',
] as const;

export default function EditProfileScreen() {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [category, setCategory] = useState(user?.category ?? '');
  const [shopName, setShopName] = useState(user?.businessName ?? '');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [address, setAddress] = useState(user?.location ?? '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(true);
  const [showLocation, setShowLocation] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [addrDraft, setAddrDraft] = useState(user?.location ?? '');
  const insets = useSafeAreaInsets();
  const profileKey = (() => {
    const u = user?.username?.trim();
    return u ? `${PROFILE_SETTINGS_KEY_BASE}:${u}` : PROFILE_SETTINGS_KEY_BASE;
  })();

  useEffect(() => {
    let cancelled = false;
    const key = profileKey;
    AsyncStorage.getItem(key)
      .then(async (raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (saved.privateAccount !== undefined) setPrivateAccount(!!saved.privateAccount);
            if (saved.showPhone !== undefined) setShowPhone(!!saved.showPhone);
            if (saved.showEmail !== undefined) setShowEmail(!!saved.showEmail);
            if (saved.showLocation !== undefined) setShowLocation(!!saved.showLocation);
            if (saved.readReceipts !== undefined) setReadReceipts(!!saved.readReceipts);
            return;
          } catch {}
        }
        if (key !== PROFILE_SETTINGS_KEY_BASE) {
          try {
            const legacy = await AsyncStorage.getItem(PROFILE_SETTINGS_KEY_BASE);
            if (!cancelled && legacy) {
              try {
                const saved = JSON.parse(legacy);
                if (saved && typeof saved === 'object') {
                  if (saved.privateAccount !== undefined) setPrivateAccount(!!saved.privateAccount);
                  if (saved.showPhone !== undefined) setShowPhone(!!saved.showPhone);
                  if (saved.showEmail !== undefined) setShowEmail(!!saved.showEmail);
                  if (saved.showLocation !== undefined) setShowLocation(!!saved.showLocation);
                  if (saved.readReceipts !== undefined) setReadReceipts(!!saved.readReceipts);
                  try { await AsyncStorage.setItem(key, legacy); } catch {}
                }
              } catch {}
            }
          } catch {}
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profileKey]);

  const pickAvatar = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        Alert.alert('Photo library unavailable', 'Photo selection is not available in this preview build. Update Expo Go to enable it.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await updateUser({ avatar: result.assets[0].uri });
      }
    } catch {
      Alert.alert('Photo library unavailable', "We couldn't open your photo library. Please try again.");
    }
  };

  const handleSave = async () => {
    // username is IMMUTABLE server-side (15+ tables key by it) — sending it
    // 400s the entire patch and used to silently revert name/bio/shop edits.
    const patch: Partial<User> = {
      name: name.trim(),
      bio,
      category,
    };
    if (shopName.trim()) patch.businessName = shopName.trim();
    if (address.trim()) patch.location = address.trim();
    const saved = await updateUser(patch);
    if (saved !== true) {
      Alert.alert('Could not save', saved || 'The server rejected these changes. Nothing was updated — please try again.');
      return;
    }
    await AsyncStorage.setItem(
      profileKey,
      JSON.stringify({ privateAccount, showPhone, showEmail, showLocation, readReceipts })
    ).catch(() => {});
    router.back();
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate account?',
      'Your profile and listings will be hidden until you reactivate.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
      ]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header - Edit Profile + Save */}
      <View className="flex-row items-center justify-between h-[52px] px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Edit Profile
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text className="font-inter-700 text-primaryContainer" style={{ fontSize: 14, lineHeight: 16 }}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Profile Photo Section */}
        <View className="items-center pt-8 pb-8">
          <View className="w-24 h-24 rounded-full bg-surfaceContainerLow items-center justify-center mb-4">
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-[88px] h-[88px] rounded-full" resizeMode="cover" />
            ) : (
              <Image source={editProfileImages.avatar} className="w-[88px] h-[88px] rounded-full" resizeMode="cover" />
            )}
          </View>
          <TouchableOpacity onPress={pickAvatar}>
            <Text className="font-inter-400 text-primaryContainer" style={{ fontSize: 16, lineHeight: 24 }}>
              Change profile photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View className="px-5" style={{ gap: 32 }}>
          {/* Basic Information */}
          <View style={{ gap: 24 }}>
            {/* Name */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Name
            </Text>
            <TextInput
              className="h-14 rounded-figma-16 bg-surfaceContainerLow px-4 font-inter-400 text-textPrimary"
              style={{ fontSize: 16, lineHeight: 24 }}
              value={name}
              onChangeText={setName}
            />

            {/* Username */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Username
            </Text>
            <View className="h-14 rounded-figma-16 bg-surfaceContainerLow px-4 flex-row items-center">
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
                @
              </Text>
              <TextInput
                className="flex-1 font-inter-400 text-textPrimary"
                style={{ fontSize: 16, lineHeight: 24 }}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            {/* Bio */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Bio
            </Text>
            <View className="rounded-figma-16 bg-surfaceContainerLow p-4 min-h-[80px]">
              <TextInput
                className="font-inter-400 text-textPrimary"
                style={{ fontSize: 16, lineHeight: 24 }}
                value={bio}
                onChangeText={setBio}
                multiline
              />
            </View>
          </View>

          {/* Business Info — sellers only (buyers have no shop to configure) */}
          {user?.isSeller && (
          <View style={{ gap: 24, paddingTop: 32 }}>
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
              Business Info
            </Text>

            {/* Category */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Category
            </Text>
            {showCategoryPicker ? (
              <View className="flex-row flex-wrap rounded-figma-16 bg-surfaceContainerLow p-3" style={{ gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                    className="px-4 py-2 rounded-full"
                    style={{ backgroundColor: cat === category ? colors.primaryContainer : colors.surfaceContainer }}
                  >
                    <Text className="font-inter-500" style={{ fontSize: 14, color: cat === category ? colors.surfaceContainerLowest : colors.textPrimary }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(true)}
                className="h-14 rounded-figma-16 bg-surfaceContainerLow px-4 justify-center"
              >
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                  {category}
                </Text>
              </TouchableOpacity>
            )}

            {/* Shop Name */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Shop Name
            </Text>
            <TextInput
              className="h-14 rounded-figma-16 bg-surfaceContainerLow px-4 font-inter-400 text-textPrimary"
              style={{ fontSize: 16, lineHeight: 24 }}
              placeholder="Susej Atelier"
              placeholderTextColor={colors.textSecondary}
              value={shopName}
              onChangeText={setShopName}
            />

            {/* Business Address */}
            <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 16, lineHeight: 24 }}>
              Business Address
            </Text>
            <TouchableOpacity
              className="h-14 rounded-figma-16 bg-surfaceContainerLow px-4 justify-center"
              onPress={() => {
                setAddrDraft(address);
                setShowAddressEditor(true);
              }}
            >
              <Text
                className="font-inter-400"
                style={{ fontSize: 16, lineHeight: 24, color: address ? colors.textPrimary : colors.textSecondary }}
              >
                {address || 'Add your business address'}
              </Text>
            </TouchableOpacity>
          </View>
          )}

          {/* Privacy Section */}
          <View style={{ gap: 24, paddingTop: 32 }}>
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 20, lineHeight: 28 }}>
              Privacy
            </Text>

            {/* Private Account toggle */}
            <View className="flex-row items-center justify-between" style={{ paddingVertical: 8 }}>
              <View className="flex-1 mr-4">
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                  Private Account
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                  Only followers can see your posts
                </Text>
              </View>
              <Switch
                value={privateAccount}
                onValueChange={setPrivateAccount}
                trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
                thumbColor={colors.surfaceContainerLowest}
              />
            </View>

            {/* Show Contact Info toggle */}
            <View className="flex-row items-center justify-between" style={{ paddingVertical: 8 }}>
              <View className="flex-1 mr-4">
                <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                  Show Contact Info
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                  Let customers email you directly
                </Text>
              </View>
              <Switch
                value={showEmail}
                onValueChange={setShowEmail}
                trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
                thumbColor={colors.surfaceContainerLowest}
              />
            </View>
          </View>

          {/* Deactivate — wording matches the account type */}
          <TouchableOpacity
            onPress={handleDeactivate}
            className="h-14 rounded-figma-16 items-center justify-center mt-4 mb-6"
            style={{ borderWidth: 1, borderColor: '#ffdad6' }}
          >
            <Text className="font-inter-400" style={{ fontSize: 16, lineHeight: 24, color: colors.error }}>
              {user?.isSeller ? 'Deactivate Shop Account' : 'Deactivate Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showAddressEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressEditor(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View
            className="px-5 pt-6"
            style={{
              backgroundColor: colors.surfaceContainerLowest,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 24 + insets.bottom,
            }}
          >
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
              Business Address
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
              Used to show your shop location to buyers.
            </Text>
            <TextInput
              className="mt-4 rounded-figma-16 bg-surfaceContainerLow px-4 font-inter-400 text-textPrimary"
              style={{ fontSize: 16, lineHeight: 24, paddingVertical: 16 }}
              value={addrDraft}
              onChangeText={setAddrDraft}
              multiline
              placeholder="Street, City, PIN code"
              placeholderTextColor={colors.textSecondary}
            />
            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <TouchableOpacity
                className="flex-1 h-12 items-center justify-center rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainer }}
                onPress={() => setShowAddressEditor(false)}
              >
                <Text className="font-inter-600 text-textSecondary" style={{ fontSize: 14, lineHeight: 18 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 items-center justify-center rounded-figma-16"
                style={{ backgroundColor: colors.primaryContainer }}
                onPress={() => {
                  setAddress(addrDraft.trim());
                  setShowAddressEditor(false);
                }}
              >
                <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.surfaceContainerLowest }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
