import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CameraPlusIcon, MapPinIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostContext';
import { CATEGORY_TREE } from '../utils/categories';

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

const SHOP_PROFILE_KEY_BASE = '@susej_shop_profile';

// Edit Shop Profile (Figma 245:2051) — store photo, profile fields, hours,
// danger zone. Persists to AuthContext + full shop profile to AsyncStorage so
// nothing entered is lost. The shop category drives the storefront archetype
// (goods/food/service/job/realestate/b2b UI).
export default function EditShopScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, tokenSeq } = useAuth();
  const { posts, updatePost } = usePosts();
  const username = user?.username ?? null;
  // Real deactivation primitive: hidden listings leave every buyer's feed
  // (the server only serves published). Deactivate hides all own listings;
  // reactivate republishes them. The id list persists because hidden posts
  // vanish from the local cache on next sync (server truth) — without it,
  // deactivation would be one-way with nothing left to reactivate.
  const deactivatedKey = username ? `${SHOP_PROFILE_KEY_BASE}:deactivated:${username}` : null;
  const [deactivatedIds, setDeactivatedIds] = useState<string[] | null>(null);
  const deactivated = deactivatedIds !== null;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!deactivatedKey) {
        if (!cancelled) setDeactivatedIds(null);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(deactivatedKey);
        if (!cancelled) setDeactivatedIds(raw ? (JSON.parse(raw) as string[]) : null);
      } catch {
        if (!cancelled) setDeactivatedIds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deactivatedKey]);
  const shopKey = username ? `${SHOP_PROFILE_KEY_BASE}:${username}` : SHOP_PROFILE_KEY_BASE;
  const [name, setName] = useState(user?.businessName || '');
  const [tagline, setTagline] = useState('');
  const [about, setAbout] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [category, setCategory] = useState(() => {
    const raw = user?.category ?? '';
    // legacy label -> id migration (become-seller stored label, CATEGORY_TREE uses id)
    const byId = CATEGORY_TREE.find((c) => c.id === raw);
    if (byId) return byId.id;
    const byLabel = CATEGORY_TREE.find((c) => c.label === raw);
    return byLabel ? byLabel.id : raw;
  });
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // One-shop-one-category: approved sellers cannot switch the primary industry after verification.
  const isCategoryLocked = user?.verification === 'approved' && !!user?.category;
  const lockedLabel =
    CATEGORY_TREE.find((c) => c.id === user?.category)?.label ??
    CATEGORY_TREE.find((c) => c.label === user?.category)?.label ??
    user?.category ?? '';

  // Resync when account switches (buyer A -> B) — prevents stale cross-account values.
  useEffect(() => {
    setName(user?.businessName || '');
    const raw = user?.category ?? '';
    const byId = CATEGORY_TREE.find((c) => c.id === raw);
    const byLabel = CATEGORY_TREE.find((c) => c.label === raw);
    setCategory(byId ? byId.id : byLabel ? byLabel.id : raw);
  }, [user?.username, user?.businessName, user?.category]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(shopKey);
        if (!raw && shopKey !== SHOP_PROFILE_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(SHOP_PROFILE_KEY_BASE);
          if (legacy) raw = legacy;
        }
        if (!raw || !active) return;
        const saved = JSON.parse(raw);
        if (typeof saved === 'object' && saved !== null && active) {
          if (typeof saved.tagline === 'string') setTagline(saved.tagline);
          if (typeof saved.about === 'string') setAbout(saved.about);
          if (typeof saved.address === 'string') setAddress(saved.address);
          if (typeof saved.email === 'string') setEmail(saved.email);
          if (typeof saved.phone === 'string') setPhone(saved.phone);
          if (typeof saved.hours === 'string') setHours(saved.hours);
          if (typeof saved.photoUri === 'string' && saved.photoUri) setPhotoUri(saved.photoUri);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [shopKey, tokenSeq]);

  const save = async () => {
    try {
      const nextCategory = isCategoryLocked ? (user?.category ?? category) : category;
      await updateUser({ businessName: name, category: nextCategory });
      if (!isCategoryLocked) setCategory(nextCategory);
      await AsyncStorage.setItem(
        shopKey,
        JSON.stringify({ tagline, about, address, email, phone, hours, photoUri })
      );
      Alert.alert('Saved', 'Shop profile updated.');
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    }
  };

  const pickStorePhoto = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        Alert.alert(
          'Photo library unavailable',
          'Photo selection is not available in this preview build. Update Expo Go to enable it.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Photo library unavailable', "We couldn't open your photo library. Please try again.");
    }
  };

  const Field = ({ label, hint, value, onChange, prefix }: { label: string; hint?: string; value: string; onChange: (t: string) => void; prefix?: string }) => (
    <View className="mb-4">
      <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
        {label}
      </Text>
      <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
        {prefix && (
          <Text className="font-inter-500 text-textSecondary mr-1" style={{ fontSize: 14 }}>
            {prefix}
          </Text>
        )}
        <TextInput
          className="flex-1 font-inter-400 text-textPrimary"
          style={{ fontSize: 14 }}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={colors.secondary}
        />
      </View>
      {hint && (
        <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 11, lineHeight: 14 }}>
          {hint}
        </Text>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-textPrimary" style={{ fontSize: 18, lineHeight: 24 }}>
          Edit Shop Profile
        </Text>
        <TouchableOpacity onPress={save}>
          <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryContainer }}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* Store photo */}
        <View className="items-center my-6">
          <TouchableOpacity onPress={pickStorePhoto}>
            <View
              className="w-24 h-24 rounded-full items-center justify-center overflow-hidden"
              style={{ backgroundColor: colors.surfaceContainer }}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} className="w-24 h-24 rounded-full" />
              ) : (
                <CameraPlusIcon size={32} color={colors.primary} />
              )}
            </View>
            <View
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.surface }}
            >
              <CameraPlusIcon size={14} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickStorePhoto}>
            <Text className="font-inter-500 text-textSecondary mt-2" style={{ fontSize: 12, lineHeight: 16 }}>
              {photoUri ? 'Change store photo' : 'Add store photo'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mx-5">
          <Field label="Official Store Name" hint="Shown to buyers instead of your username" value={name} onChange={setName} />
          <View className="mb-4">
            <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>Username</Text>
            <View className="flex-row items-center px-4" style={{ height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainerLow, opacity: 0.7 }}>
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 14 }}>@{user?.username ?? ''}</Text>
            </View>
            <Text className="font-inter-400 text-textSecondary mt-1.5" style={{ fontSize: 11, lineHeight: 14 }}>Used for links and follows only — cannot be changed</Text>
          </View>
          <Field label="Tagline" value={tagline} onChange={setTagline} />
          <Text className="font-inter-600 text-textPrimary mb-2" style={{ fontSize: 13, lineHeight: 18 }}>
            About your store
          </Text>
          <View className="px-4 py-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
            <TextInput
              className="font-inter-400 text-textPrimary"
              style={{ fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              value={about}
              onChangeText={setAbout}
              multiline
              placeholderTextColor={colors.secondary}
            />
          </View>

          <View className="mt-5">
            <Field label="Business Address" value={address} onChange={setAddress} />
            <TouchableOpacity className="flex-row items-center mb-5" onPress={() => router.push('/map')}>
              <MapPinIcon size={14} color={colors.primaryContainer} />
              <Text className="font-inter-500 ml-1.5" style={{ fontSize: 12, lineHeight: 16, color: colors.primaryContainer }}>
                Use current location
              </Text>
            </TouchableOpacity>
            <Field label="Contact Email" value={email} onChange={setEmail} />
            <Field
              label="Contact Phone"
              value={phone}
              onChange={setPhone}
            />
            <Field
              label="Store Hours"
              hint="e.g. Mon-Sat, 10:00-20:00 - shown on your storefront"
              value={hours}
              onChange={setHours}
            />
          </View>

          {/* Shop Category — drives the storefront UI (17 industries) */}
          <View className="mt-2 mb-4">
            <Text className="font-inter-600 text-textPrimary mb-1" style={{ fontSize: 13, lineHeight: 18 }}>
              Shop Category {isCategoryLocked ? '· Locked' : ''}
            </Text>
            <Text className="font-inter-400 text-textSecondary mb-2.5" style={{ fontSize: 11, lineHeight: 14 }}>
              {isCategoryLocked
                ? `Approved as ${lockedLabel} — one category per shop. Contact support to change.`
                : 'Your storefront, banner CTA and deals adapt to this category.'}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {CATEGORY_TREE.map((c) => {
                const on = (isCategoryLocked ? user?.category : category) === c.id;
                const disabled = isCategoryLocked;
                return (
                  <TouchableOpacity
                    key={c.id}
                    disabled={disabled}
                    onPress={() => setCategory(on ? '' : c.id)}
                    className="px-3.5 py-2 rounded-full"
                    style={{ backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer, opacity: disabled && !on ? 0.45 : 1 }}
                  >
                    <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: on ? colors.onPrimary : colors.textPrimary }}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Store Hours — sourced from the saved shop profile */}
          <View className="p-4 rounded-figma-16 mt-2" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 18 }}>
                  Store Hours
                </Text>
                <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
                  {hours.trim() ? hours.trim() : 'Hours not set'}
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
                  {hours.trim() ? 'Saved' : 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          {/* Danger zone — real shop deactivation: every own listing flips to
          hidden (leaves all buyer feeds via the published-only server feed),
          reactivate republishes. Syncs to the server per listing; offline it
          applies locally and converges on next sync. */}
          <TouchableOpacity
            className="mt-6 p-4 rounded-figma-16"
            style={{ borderWidth: 1, borderColor: colors.error }}
            onPress={() => {
              const own = posts.filter((p) => username && p.sellerUsername === username);
              if (!deactivated && own.length === 0) {
                Alert.alert('Deactivate Shop', 'You have no listings yet — nothing to hide.');
                return;
              }
              Alert.alert(
                deactivated ? 'Reactivate Shop' : 'Deactivate Shop',
                deactivated
                  ? 'Your listings will be visible to buyers again.'
                  : 'Your listings will be hidden from buyers. You can reactivate from this screen.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: deactivated ? 'Reactivate' : 'Deactivate',
                    style: deactivated ? 'default' : 'destructive',
                    onPress: async () => {
                      try {
                        if (deactivated) {
                          for (const id of deactivatedIds ?? []) updatePost(id, { status: 'published' });
                          if (deactivatedKey) await AsyncStorage.removeItem(deactivatedKey);
                          setDeactivatedIds(null);
                          Alert.alert('Shop live', 'Your listings are visible to buyers again.');
                        } else {
                          const ids = own.map((p) => p.id);
                          for (const p of own) updatePost(p.id, { status: 'hidden' });
                          if (deactivatedKey) await AsyncStorage.setItem(deactivatedKey, JSON.stringify(ids));
                          setDeactivatedIds(ids);
                          Alert.alert('Shop hidden', 'Your listings are now hidden from buyers.');
                        }
                      } catch {
                        Alert.alert('Something went wrong', 'Please try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
              {deactivated ? 'Reactivate Shop' : 'Deactivate Shop'}
            </Text>
            <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
              {deactivated ? 'Your shop is currently hidden' : 'Temporarily hide your listings'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View className="px-5 pt-3 pb-2" style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
        <TouchableOpacity className="h-14 rounded-figma-16 items-center justify-center" style={{ backgroundColor: colors.primaryContainer }} onPress={save}>
          <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 24 }}>
            Save Changes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}