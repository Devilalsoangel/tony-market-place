import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Alert } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon, ChevronLeftIcon, MapPinIcon, CameraIcon, PencilIcon, BagIcon, ShopIcon } from '../../utils/icons';
import { colors, CATEGORIES, formatPrice, getCategoryColor } from '../../utils/theme';
import { serverApi } from '../../utils/serverApi';
import { getFlow } from '../../utils/categoryFlow';
import { isApprovedSeller, sellerPendingReview } from '../../utils/marketplace';
import CategoryPicker from '../../components/CategoryPicker';
import { MapLocationPicker, type PickedLocation } from '../../components/MapLocationPicker';
import { useAuth } from '../../contexts/AuthContext';
import { usePosts } from '../../contexts/PostContext';
import { getPermStatus, permCanAskAgain, requestPerm } from '../../utils/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERM_ASKED_KEY = '@susej_media_perm_asked';
const STEPS = [
  { key: 'media', label: 'Choose Media' },
  { key: 'details', label: 'Product Details' },
  { key: 'price', label: 'Price' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'location', label: 'Location' },
  { key: 'preview', label: 'Preview & Post' },
] as const;

const CONDITIONS = ['New', 'Like New', 'Used', 'Refurbished'];

const EXTRA_FIELD_LABELS: Record<string, string> = {
  condition: 'Condition',
  brand: 'Brand',
  delivery: 'Delivery',
  duration: 'Duration',
  availability: 'Availability',
  jobType: 'Job Type',
  experience: 'Experience',
  company: 'Company',
  salaryRange: 'Salary Range',
  listingFor: 'Listing For',
  negotiable: 'Negotiation',
  moq: 'Minimum Order Quantity',
  leadTime: 'Lead Time',
};

const EXTRA_CHIP_OPTIONS: Record<string, string[]> = {
  condition: ['New', 'Like New', 'Used'],
  availability: ['Weekdays', 'Weekends', 'Evenings'],
  jobType: ['Full-time', 'Part-time', 'Internship'],
  experience: ['Fresher', '1–3 yrs', '3–5 yrs', '5+ yrs'],
  listingFor: ['For Sale', 'For Rent'],
};

const EXTRA_TEXT_PLACEHOLDERS: Record<string, string> = {
  brand: 'Brand (optional)',
  duration: 'e.g. 1 hr / 8 weeks',
  company: 'Company name',
  salaryRange: 'e.g. 8–12 (LPA)',
  moq: 'Minimum order qty, e.g. 100',
  leadTime: 'e.g. 7 days',
};

const EXTRA_TOGGLE_LABELS: Record<string, string> = {
  delivery: 'Delivery available',
  negotiable: 'Price negotiable',
};
const CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Jaipur'];
const DELIVERY_OPTIONS = [
  { key: 'pickup', label: 'Pickup', icon: 'shop' },
  { key: 'shipping', label: 'Shipping', icon: 'truck' },
  { key: 'local', label: 'Local Delivery', icon: 'pin' },
] as const;

type DeliveryKey = (typeof DELIVERY_OPTIONS)[number]['key'];

interface VariantDraft {
  name: string;
  values: { label: string; priceDelta?: number; stock?: number }[];
}

const MAX_IMAGES = 10;
const MAX_VARIANTS = 3;
const MAX_VALUES = 4;

function ChevronDownIcon({ size = 16, color = '#5c5e63' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8" fill="none">
      <Path d="M0 2L4 6L8 2L7.2 1.2L4 4.4L0.8 1.2L0 2Z" fill={color} />
    </Svg>
  );
}

function TruckIcon({ size = 18, color = '#5c5e63' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 3h15v13H1z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Path d="M16 8h4l3 3v5h-7" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Circle cx="6" cy="18" r="2" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="18" cy="18" r="2" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export default function CreateScreen() {
  const { user } = useAuth();
  const { addPost } = usePosts();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;
  // Camera shell hand-off: /creator shutter|gallery lands here with pre-picked
  // media ('|'-joined uris) so the wizard opens with images already attached.
  const cameraParams = useLocalSearchParams<{ cameraImages?: string | string[] }>();
  const seededFromCamera: string[] = (() => {
    const raw = cameraParams.cameraImages;
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('|') : [];
    return list.map((s) => s.trim()).filter(Boolean);
  })();

  const [step, setStep] = useState(1);
  const [selectedImages, setSelectedImages] = useState<(string | number)[]>(seededFromCamera);
  const [mediaMeta, setMediaMeta] = useState<Record<string, { isVideo: boolean; seconds?: number }>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState('');
  const [price, setPrice] = useState('');
  // Optional was-price (MRP): enables strikethrough + % off + price-drop alerts.
  const [mrp, setMrp] = useState('');
  // Simple quantity (stock) for non-variant listings. Empty = single unique
  // item (OLX pattern, defaults to 1 at publish); variants carry per-value
  // stock instead and ignore this field.
  const [quantity, setQuantity] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryKey | null>(null);
  const [city, setCity] = useState('');
  // Optional per-listing SELLING spot on the live map (separate from the
  // seller's mandatory store location). Prefilled from the store pick so the
  // seller can accept or move it - never fabricated.
  const [sellLoc, setSellLoc] = useState<PickedLocation | null>(null);
  useEffect(() => {
    let alive = true;
    const u = user?.username;
    if (!u) return;
    AsyncStorage.getItem(`@susej_store_location:${u}`)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const v = JSON.parse(raw);
          if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
            setSellLoc((prev) => prev ?? { lat: v.lat, lng: v.lng, label: v.label ?? '' });
          }
        } catch {}
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.username]);
  const [showVariants, setShowVariants] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [extra, setExtra] = useState<Record<string, string | boolean>>({});
  const [previewPage, setPreviewPage] = useState(0);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  const flow = getFlow(category);

  // Category chips come from the ADMIN-OWNED catalog in Postgres
  // (/api/app/categories) so every listing lands in a real storefront.
  // Local CATEGORIES stay only as the offline fallback.
  const [adminCats, setAdminCats] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    serverApi.getCategories().then((res) => {
      if (!alive) return;
      if (res.ok && res.data?.categories?.length) {
        setAdminCats(res.data.categories.map((c) => ({ id: c.slug, label: c.name })));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const categoryChips = adminCats.length > 0 ? adminCats : CATEGORIES;

  // One-shop-one-category: a seller with a store category can only list in
  // it (their shop IS one category). Buyers never reach this screen, but the
  // guard keeps honest behavior if state ever drifts.
  const storeCategory = (user?.category ?? '').trim();
  const lockedCategory = !!user?.isSeller && storeCategory.length > 0;
  useEffect(() => {
    if (!lockedCategory) return;
    // Prefill when empty AND force-correct if state ever drifts: a locked
    // seller's listings always start from (and stay in) their store category.
    if (!category || category !== storeCategory) {
      setCategory(storeCategory);
      setSubCategories([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedCategory]);

  // First visit to Create: fire the gallery permission popup once, contextually.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asked = await AsyncStorage.getItem(PERM_ASKED_KEY);
        if (asked === '1' || cancelled) return;
        await AsyncStorage.setItem(PERM_ASKED_KEY, '1');
        const status = await getPermStatus('media');
        if (status !== 'granted' && (await permCanAskAgain('media'))) {
          await requestPerm('media');
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const numericPrice = Number(price);
  const priceValid = Number.isFinite(numericPrice) && numericPrice > 0;
  // MRP valid only when strictly above the selling price (real discount)
  const numericMrp = Number(mrp);
  const validMrp = mrp.trim().length > 0 && Number.isFinite(numericMrp) && numericMrp > numericPrice;
  const canPost =
    selectedImages.length > 0 && title.trim().length > 0 && category.length > 0 && priceValid && !!delivery && city.trim().length > 0;

  // Variants with a name and at least one labelled value (per-value stock
  // included when set — Shopify-style inventory, optional per value).
  const cleanVariants = variants
    .map((v) => ({
      name: v.name.trim(),
      values: v.values
        .filter((val) => val.label.trim().length > 0)
        .map((val) => ({
          label: val.label.trim(),
          ...(val.priceDelta && val.priceDelta > 0 ? { priceDelta: Math.round(val.priceDelta) } : {}),
          ...(typeof val.stock === 'number' && Number.isFinite(val.stock) && val.stock >= 0
            ? { stock: Math.min(100000, Math.floor(val.stock)) }
            : {}),
        })),
    }))
    .filter((v) => v.name.length > 0 && v.values.length > 0);

  const stepValid = (s: number): boolean => {
    switch (s) {
      case 1:
        return selectedImages.length > 0;
      case 2:
        return title.trim().length > 0 && category.length > 0;
      case 3:
        return priceValid;
      case 4:
        return !!delivery;
      case 5:
        return city.trim().length > 0;
      case 6:
        return canPost;
      default:
        return false;
    }
  };

  const toggleImage = (uri: string | number) => {
    setSelectedImages((prev) => {
      if (prev.includes(uri)) return prev.filter((u) => u !== uri);
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, uri];
    });
  };

  const toSource = (img: string | number) => (typeof img === 'string' ? { uri: img } : img);

  const setExtraChip = (key: string, value: string) =>
    setExtra((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));

  const setExtraToggle = (key: string, value: boolean) => setExtra((prev) => ({ ...prev, [key]: value }));

  const pickFromGallery = async () => {
    try {
      const ImagePicker: any = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const remaining = MAX_IMAGES - selectedImages.length;
      if (remaining <= 0) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        mediaTypes: ['images', 'videos'],
        quality: 0.82,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.length) {
        const metas: Record<string, { isVideo: boolean; seconds?: number }> = {};
        const uris: string[] = [];
        for (const a of res.assets as any[]) {
          const u = typeof a?.uri === 'string' ? a.uri : '';
          if (!u || uris.includes(u)) continue;
          uris.push(u);
          const dur = typeof a.duration === 'number' ? Math.round(a.duration) : undefined;
          metas[u] = { isVideo: a.type === 'video' || a.mediaType === 'video', seconds: dur };
        }
        setMediaMeta((prev) => ({ ...prev, ...metas }));
        setSelectedImages((prev) => {
          const merged = [...prev];
          for (const u of uris) {
            if (merged.length >= MAX_IMAGES) break;
            if (!merged.includes(u)) merged.push(u);
          }
          return merged;
        });
      }
    } catch {}
  };

  const updateVariantName = (i: number, name: string) =>
    setVariants((prev) => prev.map((v, vi) => (vi === i ? { ...v, name } : v)));

  const updateVariantValue = (i: number, vi: number, patch: Partial<{ label: string; priceDelta?: number; stock?: number }>) =>
    setVariants((prev) =>
      prev.map((v, vIndex) =>
        vIndex === i ? { ...v, values: v.values.map((val, valIndex) => (valIndex === vi ? { ...val, ...patch } : val)) } : v
      )
    );

  const addVariantValue = (i: number) =>
    setVariants((prev) =>
      prev.map((v, vIndex) =>
        vIndex === i && v.values.length < MAX_VALUES ? { ...v, values: [...v.values, { label: '' }] } : v
      )
    );

  const removeVariantValue = (i: number, vi: number) =>
    setVariants((prev) =>
      prev.map((v, vIndex) =>
        vIndex === i ? { ...v, values: v.values.filter((_, valIndex) => valIndex !== vi) } : v
      )
    );

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    setVariants((prev) => [...prev, { name: '', values: [{ label: '' }] }]);
  };

  const removeVariant = (i: number) => setVariants((prev) => prev.filter((_, vIndex) => vIndex !== i));

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    await new Promise((r) => setTimeout(r, 700));
    const parsedTags = Array.from(
      new Set((description.match(/#(\w+)/g) ?? []).map((t) => t.toLowerCase()))
    );
    const extraPayload = Object.fromEntries(
      flow.extraFields
        .filter((k) => extra[k] !== undefined && extra[k] !== '')
        .map((k) => [k, extra[k]])
    );
    const localUris = selectedImages.filter((s): s is string => typeof s === 'string');
    // NOTE: the platform delivery fee (flat, server-authoritative) is charged
    // at checkout — the wizard no longer asks sellers for a figure that never
    // charges (bait). Mode + area still travel.
    // Simple-quantity stock: explicit number when typed (0..100000, 0 = out
    // of stock); when the listing has no variants and no quantity typed,
    // default to 1 (single unique item — OLX pattern) so scarcity/inventory
    // is never dead on arrival. An explicit 0 is honored, never coerced to 1.
    const qtyNum = quantity.trim() ? Math.max(0, Math.min(100000, Math.floor(Number(quantity)))) : NaN;
    const stockNum = cleanVariants.length > 0
      ? undefined
      : Number.isFinite(qtyNum) ? qtyNum : 1;
    // Upload FIRST (industry standard: DB stores hosted http(s) URLs only —
    // the server now rejects file://, content:// and data: references, which
    // previously leaked into the feed as broken images on every other device).
    const { uploadAllToServer } = require('../../utils/mediaUpload');
    const hadLocal = localUris.some((u) => !u.startsWith('http'));
    const hostedImages = await uploadAllToServer(localUris);
    if (hadLocal && hostedImages.length === 0) {
      setPosting(false);
      Alert.alert('Upload failed', 'Could not upload your images. Check your connection and try again.');
      return;
    }
    addPost({
      title: title.trim().slice(0, 80),
      sellerName: user?.businessName || user?.name || 'My Store',
      sellerUsername: user?.username || 'user',
      sellerLocation: city.trim() ? `${city.trim()}, India` : (user?.location || 'India'),
      verified: user?.verification === 'approved',
      price: Math.round(numericPrice),
      mrp: validMrp ? Math.round(numericMrp) : undefined,
      description,
      category,
      subCategories: subCategories.length > 0 ? subCategories : undefined,
      type: 'product',
      hashtags: parsedTags,
      image: hostedImages[0] || undefined,
      images: hostedImages.length > 1 ? hostedImages : undefined,
      variants: cleanVariants.length > 0 ? cleanVariants : undefined,
      stockLeft: stockNum,
      // Fulfillment data the wizard collects — previously dropped before the
      // order (buyer never saw condition, delivery mode, or shipping fee).
      condition: condition || undefined,
      negotiable,
      delivery: delivery !== null,
      deliveryMode: delivery ?? undefined,
      ...extraPayload,
      ...(sellLoc && sellLoc.label && sellLoc.label !== 'Resolving address…'
        ? { listingLat: sellLoc.lat, listingLng: sellLoc.lng, listingLocation: sellLoc.label }
        : {}),
    });
    setPosting(false);
    setPosted(true);
    setTimeout(() => router.replace('/(tabs)/feed'), 1200);
  };

  const renderStepLabel = (s: number) => (
    <View className="flex-row items-center justify-between px-5 mt-1">
      <Text style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.01, fontWeight: '600', color: colors.textPrimary }}>
        {STEPS[s - 1].label}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 14, fontWeight: '500', color: colors.textTertiary }}>
        Step {s} of 6
      </Text>
    </View>
  );

  const renderFooter = () => {
    const valid = stepValid(step);
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceContainer,
        }}
      >
        {step > 1 && !posted && (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            disabled={posting}
            activeOpacity={0.8}
            className="h-14 px-5 rounded-figma-16 items-center justify-center"
            style={{ backgroundColor: colors.surfaceContainer }}
          >
            <ChevronLeftIcon size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={step === 6 ? handlePost : () => setStep(step + 1)}
          disabled={!valid || posting}
          activeOpacity={0.85}
          className="flex-1 h-14 rounded-figma-16 items-center justify-center"
          style={{ backgroundColor: valid && !posting ? colors.primaryContainer : colors.surfaceContainer }}
        >
          {posting ? (
            <ActivityIndicator color={colors.onPrimaryContainer} />
          ) : (
            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                fontWeight: '600',
                color: valid ? colors.onPrimaryContainer : colors.disabledText,
              }}
            >
              {step === 6 ? 'Post to Feed' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Publishing requires APPROVED sellers (matches server 403s). Pending
  // applicants see their review status — never a working wizard that fails
  // at publish time, and never a fake local seller session.
  if (!isApprovedSeller(user)) {
    const pending = sellerPendingReview(user);
    return (
      <View className="flex-1" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center px-5" style={{ height: 64 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={() => router.back()}>
            <View className="w-[14px] h-[20px] items-center justify-center">
              <CloseIcon size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <View className="flex-1 items-center" style={{ marginLeft: -14 }}>
            <Text style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.8, fontWeight: '700', color: colors.primary }}>
              Create New Post
            </Text>
          </View>
          <View className="w-5" />
        </View>

        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <View className="w-16 h-16 rounded-full bg-surfaceContainer items-center justify-center mb-5">
            <ShopIcon size={28} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 18, lineHeight: 24, letterSpacing: 0.18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
            {pending ? 'Verification under review' : 'Become a seller to list products'}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
            {pending
              ? 'Our team is reviewing your documents. Listing unlocks the moment you are approved.'
              : 'Create your seller profile and start listing products to thousands of local buyers.'}
          </Text>
          {!pending && (
            <TouchableOpacity
              className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
              style={{ backgroundColor: colors.primaryContainer }}
              activeOpacity={0.85}
              onPress={() => router.push('/become-seller')}
            >
              <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.surfaceContainerLowest }}>
                Become a Seller
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (posted) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.surface }}>
        <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: colors.primaryContainer }}>
          <CheckIcon size={40} color={colors.onPrimaryContainer} />
        </View>
        <Text style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.01, fontWeight: '700', color: colors.textPrimary }}>
          Posted!
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
          Your listing is now live in the feed.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View className="flex-row items-center px-5" style={{ height: 64 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} disabled={posting}>
          <View className="w-[14px] h-[20px] items-center justify-center">
            <CloseIcon size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
        <View className="flex-1 items-center" style={{ marginLeft: -14 }}>
          <Text style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.01, fontWeight: '700', color: colors.primary }}>
            Create Post
          </Text>
        </View>
        <View className="w-5" />
      </View>

      <View className="flex-row items-center px-5 py-3">
        {STEPS.map((s, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <View key={s.key} className="flex-1 flex-row items-center">
              <View className="flex-1 items-center">
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={{ backgroundColor: active || done ? colors.primaryContainer : colors.surfaceContainer }}
                >
                  {done ? (
                    <CheckIcon size={12} color={colors.onPrimaryContainer} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 10,
                        lineHeight: 12,
                        fontWeight: '700',
                        color: active ? colors.onPrimaryContainer : colors.textTertiary,
                      }}
                    >
                      {num}
                    </Text>
                  )}
                </View>
              </View>
              {i < STEPS.length - 1 && (
                <View className="flex-1 h-0.5" style={{ backgroundColor: done ? colors.primaryContainer : colors.surfaceContainer }} />
              )}
            </View>
          );
        })}
      </View>

      {renderStepLabel(step)}

      <ScrollView className="flex-1" bounces={false} keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-4" style={{ paddingBottom: 24 }}>
          {step === 1 && (
            <View>
              {selectedImages.length > 0 ? (
                <View>
                  <View className="rounded-figma-24 overflow-hidden" style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceContainer }}>
                    <Image source={toSource(selectedImages[0])} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => setSelectedImages([])}
                      activeOpacity={0.85}
                      className="absolute bottom-3 right-3 flex-row items-center gap-2 px-4 h-10 rounded-full"
                      style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.inverseSurface, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                    >
                      <PencilIcon size={13} color={colors.primary} />
                      <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.primary }}>Change</Text>
                    </TouchableOpacity>
                    <View
                      className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.primaryContainer, shadowColor: colors.inverseSurface, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
                    >
                      <Text style={{ fontSize: 12, lineHeight: 14, fontWeight: '700', color: colors.onPrimaryContainer }}>
                        {selectedImages.length} selected
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    {selectedImages.map((uri, i) => (
                      <View key={String(uri)} className="mr-2 rounded-figma-12 overflow-hidden" style={{ width: 72, height: 90, backgroundColor: colors.surfaceContainer }}>
                        <Image source={toSource(uri)} className="w-full h-full" resizeMode="cover" />
                        {i === 0 && (
                          <View className="absolute top-1 left-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.primaryContainer }}>
                            <Text style={{ fontSize: 9, lineHeight: 12, fontWeight: '700', color: colors.onPrimaryContainer }}>MAIN</Text>
                          </View>
                        )}
                        {mediaMeta[String(uri)]?.isVideo && (
                          <View className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                            <Text style={{ fontSize: 9, lineHeight: 12, fontWeight: '700', color: '#ffffff' }}>
                              {mediaMeta[String(uri)].seconds ? `${mediaMeta[String(uri)].seconds}s` : 'VIDEO'}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => toggleImage(uri)}
                          activeOpacity={0.85}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full items-center justify-center"
                          style={{ backgroundColor: colors.overlayLight }}
                        >
                          <Text style={{ fontSize: 11, lineHeight: 13, color: colors.textInverse, fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {selectedImages.length < MAX_IMAGES && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={pickFromGallery}
                        className="rounded-figma-12 items-center justify-center"
                        style={{ width: 72, height: 90, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, borderStyle: 'dashed' }}
                      >
                        <CameraIcon size={18} color={colors.primary} />
                        <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '600', color: colors.primary, marginTop: 4 }}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                  {selectedImages.length >= MAX_IMAGES && (
                    <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 8 }}>
                      Maximum {MAX_IMAGES} photos reached.
                    </Text>
                  )}
                </View>
              ) : (
                <View
                  className="rounded-figma-24 items-center justify-center py-10 px-6"
                  style={{ backgroundColor: colors.surfaceContainer, borderWidth: 1.2, borderColor: colors.outlineVariant, borderStyle: 'dashed' }}
                >
                  <View className="w-14 h-14 rounded-full items-center justify-center mb-3" style={{ backgroundColor: colors.surfaceContainerLowest }}>
                    <CameraIcon size={26} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>No media selected</Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 14 }}>
                    Choose photos or videos from your phone's gallery — no demo images.
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={pickFromGallery}
                    className="px-6 h-12 rounded-figma-16 items-center justify-center"
                    style={{ backgroundColor: colors.primaryContainer }}
                  >
                    <Text style={{ fontSize: 14, lineHeight: 16, fontWeight: '600', color: colors.onPrimaryContainer }}>Choose from gallery</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedImages.length > 0 && (
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 8 }}>
                  First item is the main cover — tap ✕ on thumbnails to remove. Mixed photos + video stays a product post; video-only becomes a Reel.
                </Text>
              )}
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Title
              </Text>
              <TextInput
                className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
                style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
                placeholder="What are you selling?"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
                maxLength={80}
              />
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>
                Category
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {categoryChips.map((cat) => {
                  const active = category === cat.label;
                  const blocked = lockedCategory && cat.label !== storeCategory;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={blocked ? 1 : 0.8}
                      disabled={blocked}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer, opacity: blocked ? 0.45 : 1 }}
                      onPress={() => {
                        setCategory(active ? '' : cat.label);
                        if (active) setSubCategories([]);
                      }}
                    >
                      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: active ? colors.onPrimaryContainer : colors.textSecondary }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {lockedCategory && (
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textTertiary, marginTop: 8 }}>
                  Your store sells {storeCategory} - one category per shop.
                </Text>
              )}
              {category.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text
                    className="font-inter-600"
                    style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary, marginBottom: 8 }}
                  >
                    Sub-categories (optional)
                  </Text>
                  <CategoryPicker value={subCategories} onChange={setSubCategories} mainCategory={category} hideMains />
                </View>
              )}
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>
                Condition
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CONDITIONS.map((c) => {
                  const active = condition === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      activeOpacity={0.8}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                      onPress={() => setCondition(active ? '' : c)}
                    >
                      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: active ? colors.onPrimaryContainer : colors.textSecondary }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>
                Description
              </Text>
              <TextInput
                className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
                style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
                placeholder="Describe your product..."
                placeholderTextColor={colors.textTertiary}
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Price (₹)
              </Text>
              <View className="bg-surfaceContainerLow rounded-figma-16 px-5 py-4 flex-row items-center">
                <Text style={{ fontSize: 32, lineHeight: 40, fontWeight: '700', color: colors.primary }}>₹</Text>
                <TextInput
                  className="flex-1 ml-2"
                  style={{ fontSize: 32, lineHeight: 40, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Inter' }}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                />
              </View>
              {priceValid && (
                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.success, marginTop: 8 }}>
                  {formatPrice(numericPrice)} · shown to buyers
                </Text>
              )}
              {/* Optional was-price — Flipkart/OLX-style discount display */}
              {priceValid && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Original price (optional)
                  </Text>
                  <View className="bg-surfaceContainerLow rounded-figma-16 px-5 py-4 flex-row items-center">
                    <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.textTertiary }}>₹</Text>
                    <TextInput
                      className="flex-1 ml-2"
                      style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Inter' }}
                      placeholder="Was price, if on sale"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={mrp}
                      onChangeText={(t) => setMrp(t.replace(/[^0-9]/g, ''))}
                    />
                  </View>
                  {mrp.trim().length > 0 && !validMrp && (
                    <Text style={{ fontSize: 12, lineHeight: 16, color: colors.error, marginTop: 6 }}>
                      Original price must be higher than the selling price
                    </Text>
                  )}
                  {validMrp && (
                    <Text style={{ fontSize: 13, lineHeight: 18, color: colors.success, marginTop: 8 }}>
                      Buyers see {formatPrice(numericMrp)} struck through · {Math.round(((numericMrp - numericPrice) / numericMrp) * 100)}% off
                    </Text>
                  )}
                </View>
              )}
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>
                Quantity in stock (optional — defaults to 1)
              </Text>
              <View className="bg-surfaceContainerLow rounded-figma-16 px-5 py-4 flex-row items-center">
                <TextInput
                  className="flex-1"
                  style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Inter' }}
                  placeholder="e.g. 10 (leave empty for a single item)"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, '').slice(0, 6))}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setNegotiable(!negotiable)}
                className="flex-row items-center justify-between mt-6 px-5 py-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow }}
              >
                <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textPrimary }}>
                  Negotiable
                </Text>
                <View
                  className="justify-center"
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    padding: 2,
                    backgroundColor: negotiable ? colors.primaryContainer : colors.surfaceContainer,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.surfaceContainerLowest,
                      marginLeft: negotiable ? 18 : 0,
                    }}
                  />
                </View>
              </TouchableOpacity>
              {negotiable && (
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 8 }}>
                  Buyers can make offers in chat — you can accept, decline or counter.
                </Text>
              )}

              {/* Variants (collapsible) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowVariants(!showVariants)}
                className="flex-row items-center justify-between mt-6 px-5 py-4 rounded-figma-16"
                style={{ backgroundColor: colors.surfaceContainerLow }}
              >
                <View className="flex-row items-center">
                  <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textPrimary }}>
                    Add variants
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginLeft: 8 }}>
                    {variants.length > 0 ? `${cleanVariants.length} added` : 'Sizes, colours…'}
                  </Text>
                </View>
                <View style={{ transform: [{ rotate: showVariants ? '180deg' : '0deg' }] }}>
                  <ChevronDownIcon size={14} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {showVariants && (
                <View className="mt-4" style={{ gap: 12 }}>
                  {variants.map((v, vi) => (
                    <View key={vi} className="rounded-figma-16 px-4 py-4" style={{ backgroundColor: colors.surfaceContainerLow }}>
                      <View className="flex-row items-center">
                        <TextInput
                          className="flex-1 bg-surfaceContainer rounded-figma-12 px-3 py-2"
                          style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'Inter' }}
                          placeholder="Variant name (e.g. Size)"
                          placeholderTextColor={colors.textTertiary}
                          value={v.name}
                          onChangeText={(t) => updateVariantName(vi, t)}
                          maxLength={20}
                        />
                        <TouchableOpacity onPress={() => removeVariant(vi)} className="ml-2 w-8 h-8 items-center justify-center">
                          <Text style={{ fontSize: 16, lineHeight: 18, color: colors.textSecondary, fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                        {v.values.map((val, vi2) => (
                          <View
                            key={vi2}
                            className="flex-row items-center px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: colors.surfaceContainer }}
                          >
                            <TextInput
                              style={{ fontSize: 12, color: colors.textPrimary, fontFamily: 'Inter', minWidth: 36, padding: 0 }}
                              placeholder="Label"
                              placeholderTextColor={colors.textTertiary}
                              value={val.label}
                              onChangeText={(t) => updateVariantValue(vi, vi2, { label: t })}
                              maxLength={16}
                            />
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>₹</Text>
                            <TextInput
                              style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter', minWidth: 26, padding: 0, marginLeft: 2 }}
                              placeholder="0"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="numeric"
                              value={val.priceDelta != null && val.priceDelta > 0 ? String(val.priceDelta) : ''}
                              onChangeText={(t) =>
                                updateVariantValue(vi, vi2, {
                                  priceDelta: t === '' ? undefined : Number(t.replace(/[^0-9]/g, '')),
                                })
                              }
                              maxLength={5}
                            />
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>stk</Text>
                            <TextInput
                              style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter', minWidth: 26, padding: 0, marginLeft: 2 }}
                              placeholder="—"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="numeric"
                              value={val.stock != null ? String(val.stock) : ''}
                              onChangeText={(t) =>
                                updateVariantValue(vi, vi2, {
                                  stock: t === '' ? undefined : Number(t.replace(/[^0-9]/g, '')),
                                })
                              }
                              maxLength={5}
                            />
                            {vi2 > 0 && (
                              <TouchableOpacity onPress={() => removeVariantValue(vi, vi2)} className="ml-1.5">
                                <Text style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary, fontWeight: '700' }}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        {v.values.length < MAX_VALUES && (
                          <TouchableOpacity
                            onPress={() => addVariantValue(vi)}
                            className="px-3 py-1.5 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primaryBg }}
                          >
                            <Text style={{ fontSize: 12, lineHeight: 14, fontWeight: '600', color: colors.primary }}>+ Value</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                  {variants.length < MAX_VARIANTS && (
                    <TouchableOpacity
                      onPress={addVariant}
                      className="h-12 rounded-figma-16 items-center justify-center border border-dashed"
                      style={{ borderColor: colors.outlineVariant }}
                    >
                      <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.primary }}>+ Add variant</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                    Up to {MAX_VARIANTS} variants, {MAX_VALUES} options each — deltas are added to the base price.
                  </Text>
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View>
              <View style={{ gap: 10 }}>
                {DELIVERY_OPTIONS.map((opt) => {
                  const active = delivery === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      activeOpacity={0.8}
                      onPress={() => setDelivery(active ? null : opt.key)}
                      className="flex-row items-center px-5 py-4 rounded-figma-16"
                      style={{ backgroundColor: active ? colors.primaryBg : colors.surfaceContainerLow, borderWidth: 1, borderColor: active ? colors.primary : colors.surfaceContainer }}
                    >
                      {opt.icon === 'shop' ? (
                        <ShopIcon size={20} color={active ? colors.primary : colors.textSecondary} />
                      ) : opt.icon === 'truck' ? (
                        <TruckIcon size={20} color={active ? colors.primary : colors.textSecondary} />
                      ) : (
                        <MapPinIcon size={20} color={active ? colors.primary : colors.textSecondary} />
                      )}
                      <Text
                        style={{
                          fontSize: 15,
                          lineHeight: 20,
                          fontWeight: '600',
                          color: active ? colors.primary : colors.textPrimary,
                          marginLeft: 12,
                          flex: 1,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <View
                        className="w-5 h-5 rounded-full items-center justify-center"
                        style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                      >
                        {active && <CheckIcon size={11} color={colors.onPrimaryContainer} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {delivery === 'shipping' && (
                <View style={{ marginTop: 16 }}>
                  {/* The buyer is charged the PLATFORM delivery fee at checkout
                      (flat per order, server-authoritative) — a seller-typed
                      figure here never charges, so asking for one baits both
                      sides. Mode is kept; the fee input is retired. */}
                  <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textSecondary }}>
                    Buyers pay the platform delivery fee at checkout. You don't need to set shipping — the seller's dispatch is covered by the order.
                  </Text>
                </View>
              )}
            </View>
          )}

          {step === 5 && (
            <View>
              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Selling area (city / locality)
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CITIES.map((c) => {
                  const active = city === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      activeOpacity={0.8}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                      onPress={() => setCity(active ? '' : c)}
                    >
                      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: active ? colors.onPrimaryContainer : colors.textSecondary }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3 mt-3"
                style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
                placeholder="Or type your city, e.g. Chennai"
                placeholderTextColor={colors.textTertiary}
                value={city}
                onChangeText={setCity}
              />

              <Text style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginTop: 20, marginBottom: 4 }}>
                Exact selling spot on the map (optional)
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '400', color: colors.textTertiary, marginBottom: 10 }}>
                Defaults to your store location - move the pin if this item ships from somewhere else. Buyers see this area for delivery matching.
              </Text>
              <MapLocationPicker value={sellLoc} onChange={setSellLoc} height={240} />
            </View>
          )}

          {step === 6 && (
            <View>
              <View className="rounded-figma-24 overflow-hidden" style={{ backgroundColor: colors.surfaceContainerLowest, shadowColor: colors.inverseSurface, shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
                <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceContainer }}>
                  {selectedImages.length > 0 ? (
                    selectedImages.length > 1 ? (
                      <View className="w-full h-full">
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                            const page = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                            setPreviewPage(Math.max(0, Math.min(page, selectedImages.length - 1)));
                          }}
                        >
                          {selectedImages.map((uri) => (
                            <View key={uri} style={{ width: cardWidth }}>
                              <Image source={toSource(uri)} className="w-full h-full" resizeMode="cover" />
                            </View>
                          ))}
                        </ScrollView>
                        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center" style={{ gap: 6 }}>
                          {selectedImages.map((uri, i) => (
                            <View
                              key={uri}
                              className="rounded-full"
                              style={{
                                width: i === previewPage ? 18 : 6,
                                height: 6,
                                backgroundColor: i === previewPage ? colors.onPrimary : 'rgba(255,255,255,0.6)',
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    ) : (
                      <Image source={toSource(selectedImages[0])} className="w-full h-full" resizeMode="cover" />
                    )
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <CameraIcon size={32} color={colors.textTertiary} />
                      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textTertiary, marginTop: 8 }}>No image selected</Text>
                    </View>
                  )}
                  <View
                    className="absolute bottom-3 left-3 px-4 py-2 rounded-figma-16"
                    style={{ backgroundColor: colors.primaryContainer, shadowColor: colors.inverseSurface, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
                  >
                    <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.onPrimaryContainer }}>
                      {formatPrice(Math.max(0, Math.round(numericPrice)))}
                    </Text>
                  </View>
                </View>
                <View className="px-4 py-3">
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                      <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.primary }}>
                        {(user?.name || 'M').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.textPrimary }}>
                        {user?.businessName || user?.name || 'My Store'}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <MapPinIcon size={11} color={colors.textSecondary} />
                        <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary, marginLeft: 3 }}>
                          {user?.location || `${city}, India`}
                        </Text>
                      </View>
                    </View>
                    {negotiable && (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.primaryBg }}>
                        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.primary }}>Negotiable</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.textPrimary, marginTop: 12 }}>
                    {title || 'Your product title'}
                  </Text>
                  <Text numberOfLines={3} style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>
                    {description || 'Your description appears here.'}
                  </Text>
                  <View className="flex-row flex-wrap items-center mt-3" style={{ gap: 6 }}>
                    {category.length > 0 && (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: getCategoryColor(category) }}>
                        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.onPrimaryContainer }}>{category}</Text>
                      </View>
                    )}
                    {subCategories.length > 0 &&
                      subCategories.slice(0, 3).map((sub) => (
                        <View key={sub} className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow, maxWidth: 140 }}>
                          <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, fontWeight: '500', color: colors.textSecondary }}>{sub}</Text>
                        </View>
                      ))}
                    {condition.length > 0 && (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textSecondary }}>{condition}</Text>
                      </View>
                    )}
                    {delivery && (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
                        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textPrimary }}>
                          {DELIVERY_OPTIONS.find((d) => d.key === delivery)?.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  {cleanVariants.length > 0 && (
                    <View className="flex-row flex-wrap items-center mt-3" style={{ gap: 6 }}>
                      {cleanVariants.map((v) => (
                        <View key={v.name} className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerLow }}>
                          <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textPrimary }}>
                            {v.name}: {v.values.map((val) => (val.priceDelta ? `${val.label} +₹${val.priceDelta}` : val.label)).join(' · ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
              {flow.extraFields.length > 0 && (
                <View
                  className="mt-5 rounded-figma-16 px-4 py-4"
                  style={{ backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.surfaceContainer }}
                >
                  <Text
                    style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}
                  >
                    Details
                  </Text>
                  <View style={{ gap: 14 }}>
                    {flow.extraFields.map((key) => {
                      const label = EXTRA_FIELD_LABELS[key] ?? key;
                      const chips = EXTRA_CHIP_OPTIONS[key];
                      const placeholder = EXTRA_TEXT_PLACEHOLDERS[key];
                      const toggleLabel = EXTRA_TOGGLE_LABELS[key];
                      const value = extra[key];
                      if (chips) {
                        return (
                          <View key={key}>
                            <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                              {label}
                            </Text>
                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                              {chips.map((opt) => {
                                const active = value === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    activeOpacity={0.8}
                                    className="px-4 py-2 rounded-full"
                                    style={{ backgroundColor: active ? colors.primaryContainer : colors.surfaceContainer }}
                                    onPress={() => setExtraChip(key, opt)}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        lineHeight: 16,
                                        fontWeight: '500',
                                        color: active ? colors.onPrimaryContainer : colors.textSecondary,
                                      }}
                                    >
                                      {opt}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }
                      if (toggleLabel) {
                        const on = value === true;
                        return (
                          <TouchableOpacity
                            key={key}
                            activeOpacity={0.8}
                            onPress={() => setExtraToggle(key, !on)}
                            className="flex-row items-center justify-between"
                          >
                            <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.textPrimary }}>
                              {toggleLabel}
                            </Text>
                            <View
                              className="justify-center"
                              style={{
                                width: 44,
                                height: 26,
                                borderRadius: 13,
                                padding: 2,
                                backgroundColor: on ? colors.primaryContainer : colors.surfaceContainer,
                              }}
                            >
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: colors.surfaceContainerLowest,
                                  marginLeft: on ? 18 : 0,
                                }}
                              />
                            </View>
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <View key={key}>
                          <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                            {label}
                          </Text>
                          <TextInput
                            className="bg-surfaceContainer rounded-figma-12 px-3 py-2.5"
                            style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'Inter' }}
                            placeholder={placeholder ?? ''}
                            placeholderTextColor={colors.textTertiary}
                            value={typeof value === 'string' ? value : ''}
                            onChangeText={(t) => setExtra((prev) => ({ ...prev, [key]: t }))}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              <View className="flex-row items-center justify-center mt-5">
                <BagIcon size={16} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginLeft: 6 }}>
                  Will appear in the home feed after posting
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {renderFooter()}
    </View>
  );
}

// bump 2026-08-23T13:08:10.4339243+05:30
