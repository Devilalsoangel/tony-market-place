import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';
import { usePosts } from '../../contexts/PostContext';
import { serverApi } from '../../utils/serverApi';
import { isApprovedSeller } from '../../utils/marketplace';
import SellerGate from '../../components/SellerGate';

/**
 * Edit listing (seller-owned). Industry parity with OLX / Amazon Seller:
 * title, price, stock, description, negotiable and visibility stay editable
 * after posting. The server PATCH is owner-only (403 otherwise) and mirrors
 * title/price/category/images into the admin Product row.
 *
 * Photos ARE editable here (gallery pick → hosted upload → images array),
 * category and variants still need delete-and-repost — the form says so.
 */
export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { posts, updatePost } = usePosts();

  const post = useMemo(
    () => posts.find((p) => p.id === listingId),
    [posts, listingId]
  );

  const me = (user?.username ?? '').trim().toLowerCase();
  const isOwner = !!post && (post.sellerUsername ?? '').toLowerCase() === me;

  const splitTitleBody = (desc: string) => {
    const lines = (desc ?? '').split('\n');
    return { title: lines[0] ?? '', body: lines.slice(1).join('\n') };
  };

  const initial = useMemo(() => {
    if (!post) return null;
    const { title: bodyTitle, body } = splitTitleBody(post.description ?? '');
    return {
      // Server title is truth (indexed); legacy rows fall back to the first
      // description line, matching the create-wizard contract.
      title: post.title?.trim() || bodyTitle,
      body,
      price: String(post.price ?? ''),
      stock: typeof post.stockLeft === 'number' ? String(post.stockLeft) : '',
      negotiable: post.negotiable === true,
      hidden: (post.status ?? 'published') === 'hidden',
    };
  }, [post]);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [stock, setStock] = useState(initial?.stock ?? '');
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? false);
  const [hidden, setHidden] = useState(initial?.hidden ?? false);
  const [photos, setPhotos] = useState<string[]>(() => {
    const p = posts.find((x) => x.id === listingId);
    if (!p) return [];
    if (Array.isArray(p.images) && p.images.length) return p.images.filter((u): u is string => typeof u === 'string');
    return typeof p.image === 'string' && p.image ? [p.image] : [];
  });
  const [saving, setSaving] = useState(false);
  const [seededId, setSeededId] = useState<string | null>(null);

  // Seed once per listing from the cached post (the manager always has it —
  // Edit is reached from there). useState initializers above run before the
  // cache hydrates, so backfill on first post arrival. Keyed by listing id so
  // reusing this screen for another listing never shows stale values. Effect,
  // not render-phase setState (StrictMode-safe, loop-proof by the key).
  useEffect(() => {
    if (!post || !initial || seededId === listingId) return;
    setSeededId(listingId ?? null);
    setTitle(initial.title);
    setBody(initial.body);
    setPrice(initial.price);
    setStock(initial.stock);
    setNegotiable(initial.negotiable);
    setHidden(initial.hidden);
    const imgs = Array.isArray(post.images) && post.images.length
      ? post.images.filter((u): u is string => typeof u === 'string')
      : typeof post.image === 'string' && post.image
        ? [post.image]
        : [];
    setPhotos(imgs);
  }, [post, initial, seededId, listingId]);

  const pickPhotos = async () => {
    try {
      const ImagePicker: any = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to add listing photos.');
        return;
      }
      const remaining = 10 - photos.length;
      if (remaining <= 0) {
        Alert.alert('Photo limit', 'Listings hold at most 10 photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        mediaTypes: ['images'],
        quality: 0.82,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets?.length) {
        const fresh: string[] = [];
        for (const a of res.assets as any[]) {
          const u = typeof a?.uri === 'string' ? a.uri.trim() : '';
          if (!u || photos.includes(u) || fresh.includes(u)) continue;
          fresh.push(u);
        }
        if (fresh.length) setPhotos((prev) => [...prev, ...fresh].slice(0, 10));
      }
    } catch {
      Alert.alert('Could not open gallery', 'Try again.');
    }
  };

  if (!isApprovedSeller(user)) return <SellerGate title="Edit listing" user={user} />;

  if (!listingId || !post) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <Text className="font-inter-700 text-center" style={{ fontSize: 18, color: colors.textPrimary }}>
          Listing not found
        </Text>
        <Text className="font-inter-400 text-center mt-2" style={{ fontSize: 13, color: colors.textSecondary }}>
          It may have been deleted. Pull to refresh on My listings and try again.
        </Text>
        <TouchableOpacity
          className="mt-6 px-6 py-3 rounded-figma-full"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => router.back()}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, color: colors.onPrimary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <Text className="font-inter-700 text-center" style={{ fontSize: 18, color: colors.textPrimary }}>
          Not your listing
        </Text>
        <Text className="font-inter-400 text-center mt-2" style={{ fontSize: 13, color: colors.textSecondary }}>
          Only the seller who posted this can edit it.
        </Text>
        <TouchableOpacity
          className="mt-6 px-6 py-3 rounded-figma-full"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => router.back()}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, color: colors.onPrimary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trimmedTitle = title.trim();
  const numericPrice = Number(price);
  const trimmedStock = stock.trim();
  const numericStock = trimmedStock === '' ? null : Math.floor(Number(trimmedStock));
  const priceValid = Number.isFinite(numericPrice) && numericPrice >= 1 && numericPrice <= 10000000;
  const stockValid =
    numericStock === null || (Number.isFinite(numericStock) && numericStock >= 0 && numericStock <= 100000);
  const canSave =
    !saving && trimmedTitle.length >= 3 && trimmedTitle.length <= 200 && priceValid && stockValid;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const fullDescription = trimmedTitle + (body.trim() ? `\n${body.trim()}` : '');
    // Visibility is the only state-machine field here: only send it when the
    // seller actually flipped it, so a save never stomps a status set
    // elsewhere (e.g. moderation) back to published.
    const nextStatus = hidden ? 'hidden' : 'published';
    const statusChanged = (post.status ?? 'published') !== nextStatus;
    const prev = {
      description: post.description,
      price: post.price,
      stockLeft: post.stockLeft,
      negotiable: post.negotiable,
      status: post.status,
      images: post.images,
      image: post.image,
    };
    // Photos upload FIRST (hosted URLs only — file:// URIs are unviewable on
    // other devices and the server rejects them). A picked-but-unuploaded
    // photo blocks the save honestly instead of silently dropping.
    let hostedPhotos: string[];
    try {
      const { uploadAllToServer } = require('../../utils/mediaUpload');
      hostedPhotos = await uploadAllToServer(photos);
    } catch {
      hostedPhotos = photos.every((u) => /^https?:\/\//i.test(u)) ? [...photos] : [];
    }
    if (photos.length > 0 && hostedPhotos.length === 0) {
      setSaving(false);
      Alert.alert('Photos not uploaded', 'Your photo changes could not be uploaded. Check your connection and try again — nothing was saved.');
      return;
    }
    const currentUrls: string[] =
      Array.isArray(post.images) && post.images.length
        ? post.images.filter((u): u is string => typeof u === 'string')
        : typeof post.image === 'string' && post.image
          ? [post.image]
          : [];
    const photosChanged =
      hostedPhotos.length !== currentUrls.length ||
      hostedPhotos.some((u, i) => u !== currentUrls[i]);
    if (photosChanged && hostedPhotos.length === 0) {
      setSaving(false);
      Alert.alert('Photos required', 'A listing needs at least one photo — add one before saving.');
      return;
    }
    const patch = {
      title: trimmedTitle.slice(0, 200),
      description: fullDescription,
      price: Math.round(numericPrice),
      ...(numericStock !== null ? { stockLeft: numericStock } : {}),
      negotiable,
      ...(statusChanged ? { status: nextStatus } : {}),
      ...(photosChanged ? { images: hostedPhotos, ...(hostedPhotos[0] ? { image: hostedPhotos[0] } : {}) } : {}),
    };
    // SINGLE writer: optimistic paint via context (local-only), one awaited
    // server PATCH. The old code also fired the context's own PATCH — two
    // PATCHes per save with dueling reverts.
    updatePost(post.id, patch, { localOnly: true });
    try {
      const sp: Record<string, unknown> = {
        title: trimmedTitle.slice(0, 200),
        description: fullDescription,
        price: Math.round(numericPrice),
        negotiable,
        ...(statusChanged ? { status: nextStatus } : {}),
      };
      if (numericStock !== null) sp.stockLeft = numericStock;
      if (photosChanged) sp.images = hostedPhotos;
      const res = await serverApi.updatePost(post.id, sp);
      if (!res.ok) throw new Error(res.error || 'Could not save. Check your connection and try again.');
      Alert.alert('Saved', 'Your listing is updated everywhere.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      updatePost(post.id, prev, { localOnly: true });
      Alert.alert('Not saved', e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'bg-surfaceContainerLow rounded-figma-12 px-4 py-3 font-inter-500';

  return (
    <View className="flex-1 bg-surface">
      <View
        className="flex-row items-center px-5"
        style={{ height: 54 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeftIcon size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text className="flex-1 font-inter-700" style={{ fontSize: 18, color: colors.textPrimary }}>
          Edit listing
        </Text>
        <TouchableOpacity
          onPress={save}
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.4 }}
          accessibilityRole="button"
          accessibilityLabel="Save listing changes"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text className="font-inter-700" style={{ fontSize: 15, color: colors.primary }}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-inter-600 mb-1.5" style={{ fontSize: 13, color: colors.textPrimary }}>Title</Text>
        <TextInput
          className={field}
          style={{ fontSize: 14, color: colors.textPrimary }}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          placeholder="What are you selling?"
          placeholderTextColor={colors.textTertiary}
        />
        {trimmedTitle.length > 0 && trimmedTitle.length < 3 && (
          <Text className="font-inter-400 mt-1" style={{ fontSize: 12, color: colors.error }}>
            Title needs at least 3 characters.
          </Text>
        )}

        <Text className="font-inter-600 mt-5 mb-1.5" style={{ fontSize: 13, color: colors.textPrimary }}>Price (₹)</Text>
        <TextInput
          className={field}
          style={{ fontSize: 14, color: colors.textPrimary }}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
        />
        {!priceValid && price.length > 0 && (
          <Text className="font-inter-400 mt-1" style={{ fontSize: 12, color: colors.error }}>
            Price must be between ₹1 and ₹1,00,00,000.
          </Text>
        )}

        <Text className="font-inter-600 mt-5 mb-1.5" style={{ fontSize: 13, color: colors.textPrimary }}>
          Stock left <Text style={{ color: colors.textTertiary }}>(optional — blank keeps current)</Text>
        </Text>
        <TextInput
          className={field}
          style={{ fontSize: 14, color: colors.textPrimary }}
          value={stock}
          onChangeText={setStock}
          keyboardType="numeric"
          placeholder={typeof post.stockLeft === 'number' ? String(post.stockLeft) : 'No limit set'}
          placeholderTextColor={colors.textTertiary}
        />
        {!stockValid && (
          <Text className="font-inter-400 mt-1" style={{ fontSize: 12, color: colors.error }}>
            Stock must be a whole number between 0 and 100000.
          </Text>
        )}

        <Text className="font-inter-600 mt-5 mb-1.5" style={{ fontSize: 13, color: colors.textPrimary }}>Description</Text>
        <TextInput
          className={field}
          style={{ fontSize: 14, color: colors.textPrimary, minHeight: 110, textAlignVertical: 'top' }}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={5000}
          placeholder="Condition, details, what's included…"
          placeholderTextColor={colors.textTertiary}
        />

        <View className="flex-row items-center justify-between mt-5 mb-1.5">
          <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textPrimary }}>
            Photos ({photos.length}/10)
          </Text>
          {photos.length < 10 && (
            <TouchableOpacity onPress={pickPhotos} hitSlop={8}>
              <Text className="font-inter-600" style={{ fontSize: 13, color: colors.primary }}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {photos.length === 0 ? (
          <View className="p-4 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainerLow }}>
            <Text className="font-inter-400" style={{ fontSize: 12, color: colors.textSecondary }}>
              No photos — listings without a real photo don't sell. Add at least one.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {photos.map((u) => (
              <View key={u} style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceContainer }}>
                <Image source={{ uri: u }} style={{ width: 72, height: 72 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setPhotos((prev) => prev.filter((x) => x !== u))}
                  hitSlop={8}
                  style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Text style={{ fontSize: 12, lineHeight: 14, color: '#fff' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row items-center justify-between mt-5">
          <View className="flex-1 mr-3">
            <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textPrimary }}>Negotiable</Text>
            <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, color: colors.textSecondary }}>
              Buyers can make offers on this listing.
            </Text>
          </View>
          <Switch value={negotiable} onValueChange={setNegotiable} />
        </View>

        <View className="flex-row items-center justify-between mt-5">
          <View className="flex-1 mr-3">
            <Text className="font-inter-600" style={{ fontSize: 13, color: colors.textPrimary }}>Hidden from buyers</Text>
            <Text className="font-inter-400 mt-0.5" style={{ fontSize: 12, color: colors.textSecondary }}>
              Hide this listing without deleting it. Unhide anytime.
            </Text>
          </View>
          <Switch value={hidden} onValueChange={setHidden} />
        </View>

        <View className="mt-6 p-4 rounded-figma-12" style={{ backgroundColor: colors.surfaceContainerLow }}>
          <Text className="font-inter-500" style={{ fontSize: 12, color: colors.textSecondary }}>
            Listed in {post.category || 'your store category'}.
            Category and variants can't be changed after posting yet — delete and repost to change those.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
