import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, CameraPlusIcon, MapPinIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { isApprovedSeller } from '../utils/marketplace';
import SellerGate from '../components/SellerGate';
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
  // Offline-deactivate replay: updatePost resolves offline as success with no
  // queue, so an airplane-mode deactivation never reached the server — and
  // the next pull reseeds published rows over the local hidden paint. On
  // entry, re-hide any persisted id the server still shows as published.
  // (Deleted ids vanish from the persisted set on the next reactivate pass,
  // which prunes via owner-visible GET.)
  useEffect(() => {
    if (!deactivatedKey || !deactivatedIds || deactivatedIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { serverApi } = await import('../utils/serverApi');
        const res = await serverApi.getPosts({ seller: username ?? '' }).catch(() => null);
        if (cancelled || !res?.ok) return;
        const rows = ((res.data as { posts?: Array<{ id?: unknown; status?: unknown }> } | null)?.posts ?? []);
        const stillPublished = new Set(
          rows.filter((r) => String(r.status ?? '') === 'published').map((r) => String(r.id ?? ''))
        );
        for (const id of deactivatedIds) {
          if (cancelled) return;
          if (stillPublished.has(id)) {
            await updatePost(id, { status: 'hidden' }).catch(() => false);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deactivatedKey, deactivatedIds === null]);
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
      // Server-backed identity: businessName/category via updateUser (mirrors
      // to Postgres); about->bio, address->location, photo->avatar so the
      // storefront is identical on every device. upload FIRST — a local
      // file:// URI is unviewable on any other phone.
      let hostedPhoto: string | null = null;
      if (photoUri && !/^https?:\/\//i.test(photoUri)) {
        try {
          const { uploadToServer } = await import('../utils/mediaUpload');
          hostedPhoto = await uploadToServer(photoUri);
          setPhotoUri(hostedPhoto);
        } catch {
          Alert.alert('Photo upload failed', 'Your text changes were not saved — retry with connection so the store photo uploads first.');
          return;
        }
      }
      const avatar = hostedPhoto ?? (photoUri && /^https?:\/\//i.test(photoUri) ? photoUri : undefined);
      const res = await updateUser({
        businessName: name,
        category: nextCategory,
        bio: about,
        location: address,
        ...(avatar ? { avatar } : {}),
      });
      if (typeof res === 'string') {
        Alert.alert('Could not save', res);
        return;
      }
      if (!isCategoryLocked) setCategory(nextCategory);
      // Device-only extras (no server column yet): tagline/email/phone/hours.
      // Kept locally so nothing typed is lost; labelled as this-device-only.
      await AsyncStorage.setItem(
        shopKey,
        JSON.stringify({ tagline, about, address, email, phone, hours, photoUri: hostedPhoto ?? photoUri })
      );
      Alert.alert('Saved', 'Store name, photo, about and address synced to all devices. Tagline, email, phone and hours stay on this device for now.');
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

  // Approved sellers only (SELLER-C1): buyers/pending deep-links get status,
  // never tools. Matches server 403s. After all hooks (rules-of-hooks safe).
  if (!isApprovedSeller(user)) return <SellerGate title="Edit shop" user={user} />;

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
            {/* No map shortcut: the /map screen is buyer discovery with no
                seller pick-and-return mode — the old button stranded sellers
                on a map with no path back. Type the address manually. */}
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
              // Case-insensitive like every other seller surface (a mixed-case
              // account owns its listings everywhere — including here).
              const me = (username ?? '').trim().toLowerCase();
              const own = posts.filter((p) => me && (p.sellerUsername ?? '').toLowerCase() === me);
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
                      // Sequential, not Promise.all: every updatePost snapshots
                      // for its own revert — concurrent snapshots wipe each
                      // other's optimistic paints on a single refusal (bulk
                      // over-revert). Slower, exact per-row accounting.
                      try {
                        if (deactivated) {
                          const ids = deactivatedIds ?? [];
                          // Republish by PERSISTED id, not cache intersection:
                          // hidden server rows vanish from the cache on reseed,
                          // so intersecting stranded every reseed-then-reactivate
                          // behind a false "Shop live". updatePost PATCHes
                          // hidden rows fine (owner lane). Truly deleted ids
                          // (GET 200 with status removed — owners see removed)
                          // are pruned, never republished (republishing them
                          // resurrected deleted listings).
                          const { serverApi: api } = await import('../utils/serverApi');
                          const aliveIds: string[] = [];
                          for (const id of ids) {
                            if (posts.some((p) => p.id === id)) {
                              aliveIds.push(id);
                              continue;
                            }
                            try {
                              const res = await api.getPost(id);
                              const st = String((res.data as { post?: { status?: unknown } } | null)?.post?.status ?? '');
                              if (res.ok && st !== 'removed') aliveIds.push(id);
                            } catch {
                              aliveIds.push(id);
                            }
                          }
                          const failed: string[] = [];
                          for (const id of aliveIds) {
                            const ok = await updatePost(id, { status: 'published' }).catch(() => false);
                            if (!ok) failed.push(id);
                          }
                          if (failed.length === 0) {
                            if (deactivatedKey) await AsyncStorage.removeItem(deactivatedKey);
                            setDeactivatedIds(null);
                            Alert.alert('Shop live', 'Your listings are visible to buyers again.');
                          } else {
                            // Keep the failed set for retry — clearing it
                            // strands server-hidden stragglers behind a "live"
                            // claim recoverable only via a full hide-all cycle.
                            if (deactivatedKey) await AsyncStorage.setItem(deactivatedKey, JSON.stringify(failed));
                            setDeactivatedIds(failed);
                            Alert.alert('Partially live', `${ids.length - failed.length} of ${ids.length} republished — ${failed.length} failed and reverted. Check your connection and retry.`);
                          }
                        } else {
                          // Union cache + server ids: a fresh install (or
                          // partial cache) hides only what it can see while
                          // buyers still see the rest — and reports full
                          // success. The server list is truth for scope.
                          const { serverApi: api2 } = await import('../utils/serverApi');
                          const serverIds: string[] = await api2.getPosts({ seller: username ?? '' })
                            .then((res) => {
                              const rows = res.ok ? ((res.data as { posts?: Array<{ id?: unknown }> } | null)?.posts ?? []) : [];
                              return rows.map((r) => String(r.id ?? '')).filter(Boolean);
                            })
                            .catch(() => []);
                          const idSet = new Set<string>([...own.map((p) => p.id), ...serverIds]);
                          const ids = [...idSet];
                          const failed: string[] = [];
                          for (const id of ids) {
                            const ok = await updatePost(id, { status: 'hidden' }).catch(() => false);
                            if (!ok) failed.push(id);
                          }
                          if (failed.length === 0) {
                            if (deactivatedKey) await AsyncStorage.setItem(deactivatedKey, JSON.stringify(ids));
                            setDeactivatedIds(ids);
                          }
                          Alert.alert(
                            'Shop hidden',
                            failed.length > 0
                              ? `${ids.length - failed.length} of ${ids.length} hidden — ${failed.length} failed and reverted. Check your connection and retry.`
                              : 'Your listings are now hidden from buyers.'
                          );
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