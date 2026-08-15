import { useEffect, useState } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, PencilIcon, CloseIcon, PlusIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { foodHubImages, sellerImages, productDetailImages } from '../utils/screenImages';

// Banner & Deals Editor (Stitch 13fdf327) — manages storefront marketing banners + hot deals.
const BANNERS_KEY = '@susej_store_banners';
const DEALS_KEY = '@susej_store_deals';

// Six pickable cover images for banners/deals (2 per array).
const IMAGE_OPTIONS = [
  foodHubImages.popular[0],
  foodHubImages.popular[1],
  sellerImages.products[0],
  sellerImages.products[1],
  productDetailImages.similar[0],
  productDetailImages.similar[1],
];

type Banner = { id: string; title: string; sub?: string; image?: number; cta?: string };
type Deal = { id: string; title: string; price: number; oldPrice?: number; tag?: string; image?: number };

type Draft = {
  kind: 'banner' | 'deal';
  id: string;
  title: string;
  sub: string;
  cta: string;
  price: string;
  oldPrice: string;
  tag: string;
  image: number;
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

function ImagePicker({ image, onPick }: { image: number; onPick: (i: number) => void }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginBottom: 8 }}>
        Cover image
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {IMAGE_OPTIONS.map((asset, i) => (
          <TouchableOpacity key={i} onPress={() => onPick(i)}>
            <Image
              source={asset}
              resizeMode="cover"
              className="w-14 h-14"
              style={{ borderRadius: 12, borderWidth: i === image ? 2 : 0, borderColor: colors.primary }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function StorefrontEditorScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'banners' | 'deals'>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [bRaw, dRaw] = await Promise.all([
          AsyncStorage.getItem(BANNERS_KEY),
          AsyncStorage.getItem(DEALS_KEY),
        ]);
        if (bRaw) {
          const arr = JSON.parse(bRaw);
          if (Array.isArray(arr)) setBanners(arr);
        }
        if (dRaw) {
          const arr = JSON.parse(dRaw);
          if (Array.isArray(arr)) setDeals(arr);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(BANNERS_KEY, JSON.stringify(banners)).catch(() => {});
    AsyncStorage.setItem(DEALS_KEY, JSON.stringify(deals)).catch(() => {});
  }, [banners, deals, loaded]);

  const openBannerEdit = (b: Banner) => {
    setTab('banners');
    setDraft({ kind: 'banner', id: b.id, title: b.title, sub: b.sub || '', cta: b.cta || 'Shop', price: '', oldPrice: '', tag: '', image: b.image ?? 0 });
  };

  const openDealEdit = (d: Deal) => {
    setTab('deals');
    setDraft({ kind: 'deal', id: d.id, title: d.title, sub: '', cta: '', price: d.price != null ? String(d.price) : '', oldPrice: d.oldPrice != null ? String(d.oldPrice) : '', tag: d.tag || '', image: d.image ?? 0 });
  };

  const addBanner = () => {
    const b: Banner = { id: `b${Date.now()}`, title: 'New banner', sub: '', cta: 'Shop', image: 0 };
    setBanners((prev) => [...prev, b]);
    setPendingId(b.id);
    setDraft({ kind: 'banner', id: b.id, title: b.title, sub: b.sub || '', cta: b.cta || 'Shop', price: '', oldPrice: '', tag: '', image: b.image ?? 0 });
  };

  const addDeal = () => {
    const d: Deal = { id: `d${Date.now()}`, title: 'New deal', price: 1299, oldPrice: 1699, tag: '-23%', image: 1 };
    setDeals((prev) => [...prev, d]);
    setPendingId(d.id);
    setDraft({ kind: 'deal', id: d.id, title: d.title, sub: '', cta: '', price: String(d.price), oldPrice: String(d.oldPrice), tag: d.tag || '', image: d.image ?? 0 });
  };

  const commitDraft = () => {
    if (!draft) return;
    if (draft.kind === 'banner') {
      setBanners((prev) =>
        prev.map((b) =>
          b.id === draft.id
            ? { ...b, title: draft.title.trim() || b.title, sub: draft.sub.trim(), cta: draft.cta.trim() || 'Shop', image: draft.image }
            : b
        )
      );
    } else {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === draft.id
            ? {
                ...d,
                title: draft.title.trim() || d.title,
                price: Math.max(0, Number(draft.price) || 0),
                oldPrice: draft.oldPrice.trim() ? Math.max(0, Number(draft.oldPrice) || 0) : undefined,
                tag: draft.tag.trim(),
                image: draft.image,
              }
            : d
        )
      );
    }
    setPendingId(null);
    setDraft(null);
  };

  const cancelEdit = () => {
    if (pendingId) {
      setBanners((prev) => prev.filter((b) => b.id !== pendingId));
      setDeals((prev) => prev.filter((d) => d.id !== pendingId));
    }
    setPendingId(null);
    setDraft(null);
  };

  const deleteBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    if (draft && draft.kind === 'banner' && draft.id === id) setDraft(null);
    if (pendingId === id) setPendingId(null);
  };

  const deleteDeal = (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    if (draft && draft.kind === 'deal' && draft.id === id) setDraft(null);
    if (pendingId === id) setPendingId(null);
  };

  const handleSave = () => {
    let nextBanners = banners;
    let nextDeals = deals;
    if (draft) {
      if (draft.kind === 'banner') {
        nextBanners = nextBanners.map((b) =>
          b.id === draft.id ? { ...b, title: draft.title.trim() || b.title, sub: draft.sub.trim(), cta: draft.cta.trim() || 'Shop', image: draft.image } : b
        );
        setBanners(nextBanners);
      } else {
        nextDeals = nextDeals.map((d) =>
          d.id === draft.id
            ? {
                ...d,
                title: draft.title.trim() || d.title,
                price: Math.max(0, Number(draft.price) || 0),
                oldPrice: draft.oldPrice.trim() ? Math.max(0, Number(draft.oldPrice) || 0) : undefined,
                tag: draft.tag.trim(),
                image: draft.image,
              }
            : d
        );
        setDeals(nextDeals);
      }
      setPendingId(null);
      setDraft(null);
    }
    AsyncStorage.setItem(BANNERS_KEY, JSON.stringify(nextBanners)).catch(() => {});
    AsyncStorage.setItem(DEALS_KEY, JSON.stringify(nextDeals)).catch(() => {});
    Alert.alert('Saved', 'Storefront banners and deals updated.');
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
                  Edit banner
                </Text>
                <EditField label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="New banner" />
                <EditField label="Subtitle" value={draft.sub} onChangeText={(t) => setDraft({ ...draft, sub: t })} placeholder="Short offer line" />
                <EditField label="Button label" value={draft.cta} onChangeText={(t) => setDraft({ ...draft, cta: t })} placeholder="Shop" />
                <ImagePicker image={draft.image} onPick={(i) => setDraft({ ...draft, image: i })} />
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
                    {b.image != null && IMAGE_OPTIONS[b.image] ? (
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
                      <View className="self-start" style={{ borderRadius: 9999, backgroundColor: colors.surfaceContainerLow, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 }}>
                        <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.primary }}>
                          {b.cta || 'Shop'}
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

        {/* ─── DEALS TAB ─── */}
        {tab === 'deals' && (
          <View>
            {draft && draft.kind === 'deal' ? (
              <View style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: colors.inverseSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 }}>
                <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginBottom: 12 }}>
                  Edit deal
                </Text>
                <EditField label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} placeholder="New deal" />
                <EditField label="Price" value={draft.price} onChangeText={(t) => setDraft({ ...draft, price: t })} placeholder="1299" keyboardType="numeric" />
                <EditField label="Old price" value={draft.oldPrice} onChangeText={(t) => setDraft({ ...draft, oldPrice: t })} placeholder="1699" keyboardType="numeric" />
                <EditField label="Tag" value={draft.tag} onChangeText={(t) => setDraft({ ...draft, tag: t })} placeholder="-23%" />
                <ImagePicker image={draft.image} onPick={(i) => setDraft({ ...draft, image: i })} />
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

            {deals.length === 0 ? (
              <View className="items-center px-6" style={{ paddingVertical: 40 }}>
                <Text className="font-inter-500" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
                  No hot deals yet
                </Text>
                <Text className="font-inter-400 text-center" style={{ fontSize: 12, lineHeight: 18, color: colors.secondary, marginTop: 4 }}>
                  Add deals to show them in your storefront deals rail.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {deals.map((d) => (
                  <View key={d.id} className="flex-row items-center" style={{ height: 84, borderRadius: 16, backgroundColor: colors.surfaceContainerLowest, paddingLeft: 10, shadowColor: colors.inverseSurface, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 }}>
                    {d.image != null && IMAGE_OPTIONS[d.image] ? (
                      <Image source={IMAGE_OPTIONS[d.image]} style={{ width: 64, height: 64, borderRadius: 14 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: colors.surfaceContainer }} />
                    )}
                    <View className="flex-1" style={{ marginLeft: 12 }}>
                      <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                        {d.title}
                      </Text>
                      <View className="flex-row items-center" style={{ marginTop: 4, gap: 6 }}>
                        <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
                          {formatPrice(d.price)}
                        </Text>
                        {d.oldPrice != null ? (
                          <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, textDecorationLine: 'line-through' }}>
                            {formatPrice(d.oldPrice)}
                          </Text>
                        ) : null}
                        {d.tag ? (
                          <View style={{ borderRadius: 9999, backgroundColor: colors.primaryContainer, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 13, color: colors.onPrimary }}>
                              {d.tag}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-row" style={{ gap: 2 }}>
                      <TouchableOpacity className="w-9 h-9 items-center justify-center" onPress={() => openDealEdit(d)}>
                        <PencilIcon size={15} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity className="w-9 h-9 items-center justify-center" onPress={() => deleteDeal(d.id)}>
                        <CloseIcon size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ width: 6 }} />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              className="flex-row items-center justify-center"
              style={{ height: 52, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, gap: 8, marginTop: 16 }}
              onPress={addDeal}
            >
              <PlusIcon size={14} color={colors.primary} />
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.primary }}>
                Add deal
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