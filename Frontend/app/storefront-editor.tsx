import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, PencilIcon, CloseIcon, PlusIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { serverApi } from '../utils/serverApi';
import { getAdminUrl } from '../utils/adminSync';
import { foodHubImages, sellerImages, productDetailImages } from '../utils/screenImages';

// Banner & Deals Editor — MANAGES MARKETING BANNERS + live Hot-Deal placements.
// Banners are REAL uploaded images (seller picks from device → uploaded to the
// admin panel) with a SIZE preset matching the user feed banner slot. Every
// banner is synced to the admin home-management "Marketing Banners" section,
// which is the ONLY hero source in the user feed (no post marketing).
// Storage is keyed PER SELLER so each shop's banners are its own.
// Hot Deals are NOT authored here: they are paid placements bought in
// Promotions and read live from the server (same rows buyers see).

// Numeric cover indexes (legacy banner rows) resolve against these presets.
const IMAGE_OPTIONS = [
  foodHubImages.popular[0],
  foodHubImages.popular[1],
  sellerImages.products[0],
  sellerImages.products[1],
  productDetailImages.similar[0],
  productDetailImages.similar[1],
];

// Banner size presets — 'hero' matches the user feed banner slot exactly.
const BANNER_SIZES: Array<{ key: BannerSize; label: string; ratio: [number, number]; hint: string }> = [
  { key: 'hero', label: 'Feed hero 2:1', ratio: [2, 1], hint: 'Fits the user feed banner · best at 1080×540px' },
  { key: 'wide', label: 'Wide 16:9', ratio: [16, 9], hint: 'Wide strip · best at 1080×608px' },
  { key: 'tall', label: 'Tall 4:5', ratio: [4, 5], hint: 'Tall banner · best at 1080×1350px' },
];

type BannerSize = 'hero' | 'wide' | 'tall';
type Banner = { id: string; title: string; sub?: string; image?: number; cta?: string; imageUrl?: string; size?: BannerSize; synced?: boolean };

type Draft = {
  kind: 'banner';
  id: string;
  title: string;
  sub: string;
  cta: string;
  price: string;
  oldPrice: string;
  tag: string;
  image: number;
  imageUrl: string;
  size: BannerSize;
};

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, paddingHorizontal: 14, justifyContent: 'center' }}>
        <TextInput
          className="font-inter-400"
          style={{ fontSize: 14, color: colors.textPrimary, padding: 0 }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.secondary}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

export default function StorefrontEditorScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const ownerKey = user?.username || '';
  const [tab, setTab] = useState<'banners' | 'deals'>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Live Hot-Deal placements owned by this seller (server truth — the buyer
  // Hot Deals rail reads the same rows). Refreshed on focus + after ends.
  const [liveDeals, setLiveDeals] = useState<Array<{
    id: string; postTitle?: string | null; productName?: string | null;
    endsAt?: number | null; amountPaid: number;
  }>>([]);
  const refreshLiveDeals = useCallback(() => {
    if (!ownerKey) {
      setLiveDeals([]);
      return;
    }
    serverApi.getPromotions().then((res) => {
      const rows = res.ok && Array.isArray((res.data as { promotions?: unknown })?.promotions)
        ? (res.data as { promotions: Array<{ id: string; kind: string; sellerId?: string; postTitle?: string; productName?: string; endsAt?: number | null; amountPaid: number }> }).promotions
        : [];
      setLiveDeals(
        rows
          .filter((p) => p.kind === 'hotDeal' && p.sellerId === ownerKey)
          .map((p) => ({ id: p.id, postTitle: p.postTitle, productName: p.productName, endsAt: p.endsAt ?? null, amountPaid: p.amountPaid }))
      );
    }).catch(() => {});
  }, [ownerKey]);
  useEffect(() => {
    refreshLiveDeals();
  }, [refreshLiveDeals, tab]);
  const endLiveDeal = (id: string) => {
    Alert.alert('End this deal?', 'It leaves the Hot Deals rail immediately. Paid time is not refunded.', [
      { text: 'Keep running', style: 'cancel' },
      {
        text: 'End early',
        style: 'destructive',
        onPress: () => {
          serverApi.endPromotion(id).then((res) => {
            if (!res.ok) {
              Alert.alert('Could not end deal', String(res.error ?? 'Please try again.'));
              return;
            }
            refreshLiveDeals();
          }).catch(() => {
            Alert.alert('Could not end deal', 'Check your connection and try again.');
          });
        },
      },
    ]);
  };
  // Admin base URL resolved ONCE into state. getAdminUrl() is async — the old
  // code interpolated the Promise directly into template strings, producing
  // "[object Promise]/uploads/…" broken image URLs in preview + thumbs.
  const [adminBase, setAdminBase] = useState('');
  useEffect(() => {
    let alive = true;
    getAdminUrl().then((u) => {
      if (alive) setAdminBase(u.replace(/\/$/, ''));
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const absolutize = (url: string) =>
    url.startsWith('http') || !adminBase ? url : `${adminBase}${url.startsWith('/') ? '' : '/'}${url}`;

  useEffect(() => {
    if (!ownerKey) {
      setLoaded(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const bRaw = await AsyncStorage.getItem(`@susej_store_banners:${ownerKey}`);
        if (!alive) return;
        if (bRaw) {
          const arr = JSON.parse(bRaw);
          if (Array.isArray(arr)) setBanners(arr);
        }
      } catch {}
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [ownerKey]);

  useEffect(() => {
    if (!loaded || !ownerKey) return;
    AsyncStorage.setItem(`@susej_store_banners:${ownerKey}`, JSON.stringify(banners)).catch(() => {});
  }, [banners, loaded, ownerKey]);

  const openBannerEdit = (b: Banner) => {
    setTab('banners');
    setDraft({ kind: 'banner', id: b.id, title: b.title, sub: b.sub || '', cta: b.cta || 'Shop', price: '', oldPrice: '', tag: '', image: b.image ?? 0, imageUrl: b.imageUrl || '', size: b.size || 'hero' });
  };

  const addBanner = () => {
    const b: Banner = { id: `b${Date.now()}`, title: 'New banner', sub: '', cta: 'Shop', image: 0, size: 'hero' };
    setBanners((prev) => [...prev, b]);
    setPendingId(b.id);
    setDraft({ kind: 'banner', id: b.id, title: b.title, sub: b.sub || '', cta: b.cta || 'Shop', price: '', oldPrice: '', tag: '', image: b.image ?? 0, imageUrl: b.imageUrl || '', size: b.size || 'hero' });
  };

  // ── Marketing banner sync (single source of truth) ────────────────────────
  // ONE mapping used by BOTH commitDraft ("Done") and handleSave ("Save") so
  // the two paths can never drift apart again.
  const applyBannerDraft = (b: Banner, d: Draft): Banner => ({
    ...b,
    title: d.title.trim() || b.title,
    sub: d.sub.trim(),
    cta: d.cta.trim() || 'Shop',
    image: d.image,
    imageUrl: d.imageUrl || undefined,
    size: d.size,
  });

  // Push one banner to the admin Marketing Banners table. The admin section is
  // the ONLY hero source in the user feed — a banner that fails to sync is
  // saved locally but flagged honestly to the seller.
  const syncBannerToServer = (b: Banner, wasSynced: boolean) => {
    if (!ownerKey) return;
    const payload = {
      id: b.id,
      sellerUsername: ownerKey,
      sellerName: user?.name || ownerKey,
      title: b.title,
      subtitle: b.sub || undefined,
      ctaLabel: b.cta || undefined,
      imageUrl: b.imageUrl || undefined,
      imageIndex: b.image,
      size: b.size || 'hero',
      status: 'active',
    };
    serverApi.syncStorefrontBanner(payload, wasSynced ? 'PATCH' : 'POST').then((res) => {
      if (!res.ok) {
        Alert.alert('Admin sync failed', res.error || 'Banner saved on this device only.');
        return;
      }
      setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, synced: true } : x)));
    });
  };

  // Pick a REAL image from the device, upload it to the admin panel and store
  // the returned URL on the draft. Marketing banners NEVER use stock images —
  // the seller uploads their own creative.
  const pickBannerImage = async () => {
    if (!draft || draft.kind !== 'banner' || uploading) return;
    try {
      const IP: any = require('expo-image-picker');
      const perm = await IP.requestMediaLibraryPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert('Permission needed', 'Allow photo access to upload a banner image.');
        return;
      }
      const preset = BANNER_SIZES.find((s) => s.key === draft.size) || BANNER_SIZES[0];
      const res = await IP.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
        allowsEditing: true,
        aspect: preset.ratio,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      let dataUrl = '';
      if (asset.base64) {
        dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      } else if (typeof FileReader !== 'undefined') {
        // Fallback only where FileReader exists (web): React Native has no
        // FileReader — without this guard the reference itself throws.
        const blob = await (await fetch(asset.uri)).blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      } else {
        throw new Error('Image has no readable data — try another photo.');
      }
      setUploading(true);
      const up = await serverApi.uploadBannerImage(dataUrl);
      if (up.ok && up.data?.url) {
        setDraft({ ...draft, imageUrl: up.data.url });
      } else {
        Alert.alert('Upload failed', up.error || 'Try a smaller image.');
      }
    } catch {
      Alert.alert('Upload failed', 'Could not read the selected image.');
    } finally {
      setUploading(false);
    }
  };

  const commitDraft = () => {
    if (!draft) return;
    // Drafts are banner-only now (deals are live server placements).
    const target = banners.find((b) => b.id === draft.id);
    if (target) {
      const updated = applyBannerDraft(target, draft);
      setBanners((prev) => prev.map((b) => (b.id === draft.id ? updated : b)));
      syncBannerToServer(updated, !!target.synced);
    }
    setPendingId(null);
    setDraft(null);
  };

  const cancelEdit = () => {
    if (pendingId) {
      setBanners((prev) => prev.filter((b) => b.id !== pendingId));
    }
    setPendingId(null);
    setDraft(null);
  };

  const deleteBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    // Best-effort server delete — requestWithAppKey never throws, and the
    // local state is already correct either way.
    serverApi.deleteStorefrontBanner(id).then(() => {});
    if (draft && draft.kind === 'banner' && draft.id === id) setDraft(null);
    if (pendingId === id) setPendingId(null);
  };

  const handleSave = () => {
    let nextBanners = banners;
    if (draft) {
      const target = nextBanners.find((b) => b.id === draft.id);
      if (target) {
        const updated = applyBannerDraft(target, draft);
        nextBanners = nextBanners.map((b) => (b.id === draft.id ? updated : b));
        setBanners(nextBanners);
        syncBannerToServer(updated, !!target.synced);
      }
      setPendingId(null);
      setDraft(null);
    }
    if (ownerKey) {
      AsyncStorage.setItem(`@susej_store_banners:${ownerKey}`, JSON.stringify(nextBanners)).catch(() => {});
    }
    Alert.alert('Saved', 'Storefront banners updated.');
  };

  const segPills = [
    { key: 'banners' as const, label: 'Banners' },
    { key: 'deals' as const, label: 'Hot Deals' },
  ];

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 26, color: colors.primary }}>
          Banner &amp; Deals Editor
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {/* Segmented control */}
      <View className="mx-5 mt-4 flex-row" style={{ borderRadius: 9999, backgroundColor: colors.surfaceContainer, padding: 4, gap: 4 }}>
        {segPills.map((p) => {
          const on = tab === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              className="flex-1 items-center justify-center"
              style={{ height: 36, borderRadius: 9999, backgroundColor: on ? colors.primaryContainer : colors.surfaceContainerLow }}
              onPress={() => setTab(p.key)}
            >
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: on ? colors.onPrimary : colors.textSecondary }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 96 }}>
        {/* ─── BANNERS TAB ─── */}
        {tab === 'banners' && (
          <View>
            {draft && draft.kind === 'banner' ? (
              <View style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: colors.inverseSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 }}>
                <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginBottom: 12 }}>
                  {pendingId === draft.id ? 'New banner' : 'Edit banner'}
                </Text>
                <EditField label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="New banner" />
                <EditField label="Subtitle" value={draft.sub} onChangeText={(t) => setDraft({ ...draft, sub: t })} placeholder="Short offer line" />
                <EditField label="Button label" value={draft.cta} onChangeText={(t) => setDraft({ ...draft, cta: t })} placeholder="Shop" />
                {/* Banner size — presets match the user feed banner slots */}
                <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 6 }}>
                  Banner size
                </Text>
                <View className="flex-row" style={{ gap: 8, marginBottom: 6 }}>
                  {BANNER_SIZES.map((s) => {
                    const on = draft.size === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        className="flex-1 items-center justify-center"
                        style={{ height: 36, borderRadius: 12, backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer }}
                        onPress={() => setDraft({ ...draft, size: s.key })}
                      >
                        <Text className="font-inter-600 text-center" style={{ fontSize: 10, lineHeight: 13, color: on ? colors.onPrimary : colors.textSecondary }}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary, marginBottom: 10 }}>
                  {(BANNER_SIZES.find((s) => s.key === draft.size) || BANNER_SIZES[0]).hint}
                </Text>
                {/* Live preview rendered at the EXACT ratio used in the user feed */}
                {(() => {
                  const preset = BANNER_SIZES.find((s) => s.key === draft.size) || BANNER_SIZES[0];
                  const W = Dimensions.get('window').width - 72; // screen margins 40 + card padding 32
                  const H = Math.round((W * preset.ratio[1]) / preset.ratio[0]);
                  const uri = draft.imageUrl ? absolutize(draft.imageUrl) : '';
                  return (
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ width: '100%', height: H, borderRadius: 12, backgroundColor: colors.surfaceContainer, overflow: 'hidden' }}>
                        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                      </View>
                      <TouchableOpacity
                        style={{ marginTop: 10, height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
                        onPress={pickBannerImage}
                        disabled={uploading}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.primary }}>
                          {uploading ? 'Uploading…' : draft.imageUrl ? 'Replace image' : 'Upload banner image'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                <View className="flex-row" style={{ gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
                    onPress={cancelEdit}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.textSecondary }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
                    onPress={commitDraft}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {banners.length === 0 ? (
              <View className="items-center px-6" style={{ paddingVertical: 40 }}>
                <Text className="font-inter-500" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                  No banners yet
                </Text>
                <Text className="font-inter-400 text-center" style={{ fontSize: 12, lineHeight: 18, color: colors.secondary, marginTop: 4 }}>
                  Add a marketing banner to promote your storefront.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {banners.map((b) => (
                  <View key={b.id} className="flex-row items-center" style={{ height: 96, borderRadius: 16, backgroundColor: colors.surfaceContainerLowest, paddingLeft: 4, shadowColor: colors.inverseSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 }}>
                    {b.imageUrl ? (
                      <Image
                        source={{ uri: absolutize(b.imageUrl) }}
                        style={{ width: 88, height: 88, borderRadius: 14 }}
                        resizeMode="cover"
                      />
                    ) : b.image != null && IMAGE_OPTIONS[b.image] ? (
                      <Image source={IMAGE_OPTIONS[b.image]} style={{ width: 88, height: 88, borderRadius: 14 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 88, height: 88, borderRadius: 14, backgroundColor: colors.surfaceContainer }} />
                    )}
                    <View className="flex-1" style={{ marginLeft: 12, marginRight: 4 }}>
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }} numberOfLines={1}>
                        {b.sub || ' '}
                      </Text>
                      <View className="flex-row items-center" style={{ gap: 6, marginTop: 6 }}>
                        <View className="self-start" style={{ borderRadius: 9999, backgroundColor: colors.surfaceContainerLow, paddingHorizontal: 10, paddingVertical: 3 }}>
                          <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                            {b.cta || 'Shop'}
                          </Text>
                        </View>
                        <Text className="font-inter-400" style={{ fontSize: 10, lineHeight: 13, color: colors.textSecondary }}>
                          {(BANNER_SIZES.find((s) => s.key === b.size) || BANNER_SIZES[0]).label}
                          {b.synced ? ' · in admin' : ' · not synced'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row" style={{ gap: 2 }}>
                      <TouchableOpacity className="w-9 h-9 items-center justify-center" onPress={() => openBannerEdit(b)}>
                        <PencilIcon size={15} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity className="w-9 h-9 items-center justify-center" onPress={() => deleteBanner(b.id)}>
                        <CloseIcon size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ width: 8 }} />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              className="flex-row items-center justify-center"
              style={{ height: 52, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, gap: 8, marginTop: 16 }}
              onPress={addBanner}
            >
              <PlusIcon size={14} color={colors.primary} />
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
                Add banner
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── DEALS TAB: live Hot-Deal placements (server truth) ────
            Local deal cards never reached any buyer surface, so the tab now
            manages the seller's real paid Hot-Deal campaigns. New deals are
            bought in Promotions (wallet-charged, server-placed); ending one
            here deactivates it server-side too. */}
        {tab === 'deals' && (
          <View>
            {liveDeals.length === 0 ? (
              <View className="items-center px-6" style={{ paddingVertical: 40 }}>
                <Text className="font-inter-500" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                  No hot deals running
                </Text>
                <Text className="font-inter-400 text-center" style={{ fontSize: 12, lineHeight: 18, color: colors.secondary, marginTop: 4 }}>
                  Promote a listing to pin it in the Hot Deals rail buyers see.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {liveDeals.map((d) => (
                  <View key={d.id} className="flex-row items-center" style={{ minHeight: 84, borderRadius: 16, backgroundColor: colors.surfaceContainerLowest, padding: 10, shadowColor: colors.inverseSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 }}>
                    <View className="flex-1" style={{ marginLeft: 4 }}>
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                        {d.postTitle || d.productName || 'Hot deal'}
                      </Text>
                      <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 4 }}>
                        {d.endsAt ? `Ends ${new Date(d.endsAt).toLocaleDateString()}` : 'No end date'} · {formatPrice(d.amountPaid)} paid
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="px-4 h-9 items-center justify-center"
                      style={{ borderRadius: 12, backgroundColor: colors.surfaceContainer }}
                      onPress={() => endLiveDeal(d.id)}
                    >
                      <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.error }}>
                        End early
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              className="flex-row items-center justify-center"
              style={{ height: 52, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, gap: 8, marginTop: 16 }}
              onPress={() => router.push('/promotions?kind=hotDeal')}
            >
              <PlusIcon size={14} color={colors.primary} />
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
                Promote as Hot Deal
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating save bar */}
      <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceContainer }}>
        <TouchableOpacity style={{ height: 48, borderRadius: 14, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }} onPress={handleSave}>
          <Text className="font-inter-600" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
            Save changes
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}