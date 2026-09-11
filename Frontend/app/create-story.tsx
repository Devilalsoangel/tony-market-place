import { useState, useRef, useEffect } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Dimensions, ActivityIndicator, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { saveMyStory, clampStoryDuration, type MyStory } from '../utils/myStory';
import { serverApi } from '../utils/serverApi';
import { useAuth } from '../contexts/AuthContext';
import { isApprovedSeller, sellerPendingReview } from '../utils/marketplace';
import { usePosts } from '../contexts/PostContext';
import type { StoryOverlay, StoryProductRef } from '../utils/storyTray';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB = (SCREEN_WIDTH - 40 - 12) / 4; // 4 cols with 12px gap

// IG-style display-length choices (photos stay on screen this long).
const DURATION_CHOICES = [
  { label: '5s', ms: 5000 },
  { label: '10s', ms: 10000 },
  { label: '15s', ms: 15000 },
  { label: '30s', ms: 30000 },
  { label: '60s', ms: 60000 },
];

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



export default function CreateStoryScreen() {
  const insets = useSafeAreaInsets();
  // Camera shell hand-off: /creator lands here with a captured/picked image.
  const cameraParams = useLocalSearchParams<{ cameraImage?: string | string[] }>();
  const seededFromCamera: string | null = (() => {
    const raw = cameraParams.cameraImage;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  })();
  const [selected, setSelected] = useState<string | null>(seededFromCamera);
  // OLD-PATH KILL: this screen is a POST-CAPTURE editor only. Reaching it
  // without an image means an old entry point - bounce to the camera-first
  // shell in story mode instead of ever showing the legacy picker UI.
  useEffect(() => {
    if (!seededFromCamera) router.replace('/(tabs)/creator?mode=story');
  }, [seededFromCamera]);
  const [caption, setCaption] = useState('');
  const [durationMs, setDurationMs] = useState(5000);
  // Marketplace markup (GPT P1): text overlays on the image + attached own product.
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [textDraft, setTextDraft] = useState('');
  const [textZone, setTextZone] = useState<StoryOverlay['zone']>('middle');
  const [showTextForm, setShowTextForm] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [attachedProduct, setAttachedProduct] = useState<StoryProductRef | null>(null);
  // IG flow: edit -> full-screen preview -> post. Preview shows the story with
  // its real progress timing so the length choice is felt before posting.
  const [step, setStep] = useState<'edit' | 'preview'>('edit');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewProgress = useRef(new Animated.Value(0)).current;
  // Sample backgrounds appear ONLY when the device photo picker is unavailable.
  const [pickerFailed, setPickerFailed] = useState(false);
  const { user } = useAuth();
  const { posts } = usePosts();
  // Own live listings for the Attach-product picker (server re-validates ownership).
  const myListings = posts.filter((p) => p.sellerUsername === user?.username && !p.isSold);
  const canPost = !!selected && !posting;

  // ROLE-BASED GUARD: story creation needs an APPROVED seller (matches the
  // server). Logged-out users fail closed; pending applicants see status.
  if (!isApprovedSeller(user)) {
    const pending = sellerPendingReview(user);
    return (
      <View className="flex-1" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <CloseIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: 80 }}>
          <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 18, lineHeight: 26 }}>
            Stories are for sellers
          </Text>
          <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 14, lineHeight: 20 }}>
            {pending
              ? 'Your seller application is under review. Stories unlock the moment you are approved.'
              : 'Become a seller to post stories, list products and go live.'}
          </Text>
          {!pending && (
            <TouchableOpacity
              onPress={() => router.push('/become-seller')}
              className="mt-6 rounded-full px-6 h-11 items-center justify-center"
              style={{ backgroundColor: colors.primaryContainer }}
            >
              <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 18, color: colors.onPrimary }}>
                Become a Seller
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Preview progress bar loops at the chosen duration while previewing.
  useEffect(() => {
    if (step !== 'preview' || !selected) return;
    previewProgress.setValue(0);
    const anim = Animated.loop(
      Animated.timing(previewProgress, {
        toValue: 1,
        duration: clampStoryDuration(durationMs),
        useNativeDriver: false,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [step, selected, durationMs, previewProgress]);

  const pickFromGallery = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        setPickerFailed(true);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.length) {
        setSelected(result.assets[0].uri);
        setError(null);
      }
    } catch {
      setPickerFailed(true);
    }
  };

  const openPreview = () => {
    if (!canPost) return;
    setError(null);
    setStep('preview');
  };

  const addOverlay = () => {
    const text = textDraft.trim();
    if (!text || overlays.length >= 3) return;
    setOverlays((cur) => [...cur, { text, zone: textZone }]);
    setTextDraft('');
    setShowTextForm(false);
  };

  const handlePost = async () => {
    if (!selected) return;
    setPosting(true);
    setError(null);
    try {
      // Upload FIRST when the picked media is still a local device URI — the
      // server stores hosted http(s) URLs only (a file:// URI from this device
      // is invisible to every other viewer). The local mirror below keeps the
      // original URI so YOUR ring + viewer work even fully offline.
      let hosted = selected as string;
      if (!/^https?:\/\//i.test(hosted)) {
        const { uploadToServer } = require('../utils/mediaUpload');
        hosted = await uploadToServer(hosted);
      }
      // Server first (everyone sees it, 24h lifetime); local mirror always
      // saved so YOUR ring + viewer work even fully offline.
      await serverApi.createStory({
        image: hosted,
        caption: caption.trim() || undefined,
        durationMs: clampStoryDuration(durationMs),
        overlays: overlays.length ? overlays : undefined,
        productRef: attachedProduct ?? undefined,
      });
      const story: MyStory = {
        image: selected as string,
        caption: caption.trim(),
        time: Date.now(),
        duration: clampStoryDuration(durationMs),
        overlays: overlays.length ? overlays : undefined,
        productRef: attachedProduct ?? undefined,
      };
      await saveMyStory(story);
      router.back();
    } catch {
      // Offline-first: keep the local story; the server sync can happen later.
      try {
        const story: MyStory = {
          image: selected as string,
          caption: caption.trim(),
          time: Date.now(),
          duration: clampStoryDuration(durationMs),
          overlays: overlays.length ? overlays : undefined,
          productRef: attachedProduct ?? undefined,
        };
        await saveMyStory(story);
        router.back();
      } catch {
        setError('Could not save your story. Please try again.');
        setPosting(false);
      }
    }
  };

  // ── Full-screen PREVIEW (IG-style): story exactly as viewers will see it ──
  if (step === 'preview' && selected) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.inverseSurface }}>
        <Image source={{ uri: selected }} className="absolute inset-0 w-full h-full" resizeMode="cover" />

        {/* Progress bar at the REAL chosen duration */}
        <View className="absolute left-0 right-0 flex-row px-3" style={{ top: insets.top + 8, gap: 4 }}>
          <View className="flex-1 overflow-hidden rounded-full" style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.35)' }}>
            <Animated.View
              style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: '#ffffff',
                width: previewProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>
        </View>

        {/* Header: back to edit + length label */}
        <View className="absolute left-0 right-0 flex-row items-center justify-between px-5" style={{ top: insets.top + 22 }}>
          <TouchableOpacity
            onPress={() => setStep('edit')}
            accessibilityRole="button"
            accessibilityLabel="Back to editing"
          >
            <CloseIcon size={20} color="#ffffff" />
          </TouchableOpacity>
          <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text className="font-inter-600 text-white" style={{ fontSize: 12, lineHeight: 15 }}>
              Shows for {Math.round(clampStoryDuration(durationMs) / 1000)}s · lives 24h
            </Text>
          </View>
          <View style={{ width: 20 }} />
        </View>

        {/* Text overlays at their chosen zones (matches viewer rendering) */}
        {(['top', 'middle', 'bottom'] as const).map((zone) => {
          const items = overlays.filter((o) => o.zone === zone);
          if (!items.length) return null;
          return (
            <View
              key={zone}
              className="absolute left-0 right-0 items-center px-6"
              pointerEvents="none"
              style={
                zone === 'top'
                  ? { top: insets.top + 70 }
                  : zone === 'bottom'
                    ? { bottom: 190 }
                    : { top: '45%' }
              }
            >
              {items.map((o, i) => (
                <Text
                  key={`${i}-${o.zone}`}
                  className="text-white text-center font-inter-700"
                  style={{ fontSize: 22, lineHeight: 28, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}
                >
                  {o.text}
                </Text>
              ))}
            </View>
          );
        })}

        {/* Attached product chip (viewer renders the same affordance) */}
        {attachedProduct ? (
          <View className="absolute left-5 right-5" style={{ bottom: caption.trim() ? 205 : 150 }}>
            <TouchableOpacity
              className="flex-row items-center rounded-figma-16 overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.94)' }}
              activeOpacity={0.9}
            >
              {attachedProduct.image ? (
                <Image source={{ uri: attachedProduct.image }} style={{ width: 44, height: 44 }} resizeMode="cover" />
              ) : null}
              <View className="flex-1 px-3 py-2">
                <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textPrimary }} numberOfLines={1}>
                  {attachedProduct.title}
                </Text>
                {typeof attachedProduct.price === 'number' ? (
                  <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 16, color: colors.primary }}>
                    Rs {attachedProduct.price.toLocaleString('en-IN')}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Caption preview overlay */}
        {caption.trim() ? (
          <View className="absolute left-0 right-0 px-5" style={{ bottom: 150 }}>
            <Text className="text-white font-inter-500" style={{ fontSize: 14, lineHeight: 20 }}>
              {caption.trim()}
            </Text>
          </View>
        ) : null}

        {/* Bottom actions: Edit / Post */}
        <View className="absolute left-0 right-0 flex-row items-center px-5" style={{ bottom: insets.bottom + 28, gap: 12 }}>
          <TouchableOpacity
            className="h-12 flex-1 items-center justify-center rounded-figma-16"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            onPress={() => setStep('edit')}
            disabled={posting}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 18 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="h-12 flex-1 items-center justify-center rounded-figma-16 flex-row"
            style={{ backgroundColor: colors.primaryContainer }}
            onPress={handlePost}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <CheckIcon size={16} color="#ffffff" />
                <Text className="font-inter-700 text-white ml-2" style={{ fontSize: 14, lineHeight: 18 }}>Post</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5" style={{ height: 52 + insets.top, paddingTop: insets.top, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-700 text-textPrimary" style={{ letterSpacing: -0.5 }}>
          Create Story
        </Text>
        <TouchableOpacity onPress={openPreview} disabled={!canPost}>
          <Text
            className="font-inter-700"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: canPost ? colors.primary : colors.textTertiary }}
          >
            Preview
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" bounces={false} keyboardShouldPersistTaps="handled">
        {/* Large preview */}
        <View style={{ width: SCREEN_WIDTH, height: 320 }} className="bg-surfaceContainer">
          {selected ? (
            <Image source={{ uri: selected }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-figma-14 font-inter-400 text-textSecondary text-center">
                Pick an image from your phone gallery
              </Text>
              <Text className="text-figma-11 font-inter-400 text-textTertiary text-center mt-1">
                Gallery photos only — no demo images
              </Text>
            </View>
          )}
        </View>

        <View className="px-5 pt-5">
          {/* Real gallery picker — primary path */}
          <TouchableOpacity
            className="w-full h-12 rounded-figma-16 items-center justify-center flex-row"
            style={{ backgroundColor: colors.primaryContainer }}
            activeOpacity={0.85}
            onPress={pickFromGallery}
          >
            <Text className="text-figma-14 font-inter-600" style={{ color: colors.onPrimary }}>
              Choose image from gallery
            </Text>
          </TouchableOpacity>
          {error ? (
            <View className="bg-errorContainer rounded-figma-16 px-4 py-3 mb-3 mt-4">
              <Text className="text-figma-12 font-inter-500" style={{ color: colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          ) : null}
          {pickerFailed ? (
            <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3 mt-4">
              <Text className="text-figma-12 font-inter-500 text-textSecondary text-center">
                Gallery unavailable — please allow media permissions in system settings and try again. No demo images are included.
              </Text>
            </View>
          ) : null}

          {/* Marketplace markup tools (GPT P1): text overlays + product attach */}
          {selected ? (
            <>
              <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Markup</Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <TouchableOpacity
                  className="flex-1 h-10 rounded-figma-16 items-center justify-center bg-surfaceContainerLow"
                  onPress={() => setShowTextForm((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Add text overlay"
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.primary }}>
                    Aa Add text
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 h-10 rounded-figma-16 items-center justify-center bg-surfaceContainerLow"
                  onPress={() => setShowProductPicker((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Attach a product"
                >
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.primary }}>
                    Attach product
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Text overlay mini-form */}
              {showTextForm ? (
                <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3 mt-3">
                  <TextInput
                    style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
                    placeholder="Price, condition, 2 left..."
                    placeholderTextColor={colors.textTertiary}
                    value={textDraft}
                    onChangeText={setTextDraft}
                    maxLength={80}
                  />
                  <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                    {(['top', 'middle', 'bottom'] as const).map((z) => (
                      <TouchableOpacity
                        key={z}
                        className={`px-3 h-8 rounded-figma-full items-center justify-center ${textZone === z ? '' : 'bg-surfaceContainer'}`}
                        style={textZone === z ? { backgroundColor: colors.primaryContainer } : null}
                        onPress={() => setTextZone(z)}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: textZone === z ? colors.onPrimary : colors.textSecondary }}>
                          {z[0].toUpperCase() + z.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      className="ml-auto h-8 px-4 rounded-figma-full items-center justify-center"
                      style={{ backgroundColor: colors.primaryContainer }}
                      onPress={addOverlay}
                      disabled={!textDraft.trim()}
                    >
                      <Text className="font-inter-700" style={{ fontSize: 11, lineHeight: 14, color: textDraft.trim() ? colors.onPrimary : colors.textTertiary }}>
                        Add
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Added overlays as removable chips */}
              {overlays.length ? (
                <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
                  {overlays.map((o, i) => (
                    <TouchableOpacity
                      key={`${i}-${o.zone}`}
                      className="flex-row items-center rounded-figma-full px-3 h-8 bg-surfaceContainerLow"
                      onPress={() => setOverlays((cur) => cur.filter((_, j) => j !== i))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove overlay ${o.text}`}
                    >
                      <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }} numberOfLines={1}>
                        {o.text} · {o.zone}
                      </Text>
                      <CloseIcon size={10} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {/* Product picker (own live listings only; server re-validates) */}
              {showProductPicker ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
                  {myListings.length === 0 ? (
                    <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textTertiary }}>
                      No active listings to attach.
                    </Text>
                  ) : (
                    myListings.map((p) => {
                      const active = attachedProduct?.id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          className={`w-28 rounded-figma-16 overflow-hidden ${active ? '' : 'bg-surfaceContainerLow'}`}
                          style={active ? { borderWidth: 2, borderColor: colors.primary } : null}
                          onPress={() => setAttachedProduct(active ? null : { id: p.id, title: p.description.slice(0, 120), image: p.image || p.images?.[0], price: p.price })}
                        >
                          {p.image || p.images?.[0] ? (
                            <Image source={{ uri: String(p.image || p.images?.[0]) }} style={{ width: '100%', height: 72 }} resizeMode="cover" />
                          ) : (
                            <View style={{ width: '100%', height: 72, backgroundColor: colors.surfaceContainer }} />
                          )}
                          <View className="px-2 py-1.5">
                            <Text className="font-inter-600" style={{ fontSize: 10, lineHeight: 13, color: colors.textPrimary }} numberOfLines={1}>
                              {p.description || 'Listing'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              ) : null}

              {attachedProduct && !showProductPicker ? (
                <View className="flex-row items-center bg-surfaceContainerLow rounded-figma-16 px-3 py-2 mt-3">
                  <Text className="flex-1 font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }} numberOfLines={1}>
                    Attached: {attachedProduct.title}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachedProduct(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove attached product">
                    <CloseIcon size={12} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}

          {/* Caption */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Caption (optional)</Text>
          <TextInput
            className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3"
            style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'Inter' }}
            placeholder="Add a caption to your story..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={caption}
            onChangeText={setCaption}
          />

          {/* Display length (IG-style author choice, 5-60s) */}
          <Text className="text-figma-14 font-inter-600 text-textSecondary mt-5 mb-2">Story length</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {DURATION_CHOICES.map((d) => {
              const active = durationMs === d.ms;
              return (
                <TouchableOpacity
                  key={d.label}
                  className={`px-4 h-9 rounded-figma-full items-center justify-center ${active ? '' : 'bg-surfaceContainerLow'}`}
                  style={active ? { backgroundColor: colors.primaryContainer } : null}
                  onPress={() => setDurationMs(d.ms)}
                  accessibilityRole="button"
                  accessibilityLabel={`Story shows for ${d.label}`}
                >
                  <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 15, color: active ? colors.onPrimary : colors.textSecondary }}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Post button -> full-screen preview first (IG flow) */}
          <TouchableOpacity
            className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
            style={{ backgroundColor: canPost ? colors.primaryContainer : colors.surfaceContainer }}
            activeOpacity={0.85}
            onPress={openPreview}
            disabled={!canPost}
          >
            <Text className="text-figma-16 font-inter-600" style={{ color: canPost ? colors.surfaceContainerLowest : colors.textTertiary }}>
              Preview story
            </Text>
          </TouchableOpacity>
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  );
}
