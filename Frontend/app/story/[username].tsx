import { useState, useEffect, useRef, useMemo, type ReactElement } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Animated, StyleSheet, Share } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon, ShareIcon } from '../../utils/icons';
import { colors, shadows } from '../../utils/theme';
import { parseTrayParam, trayParam, storiesByUsername, type AppStory, type StoryOverlay, type StoryProductRef } from '../../utils/storyTray';
import { serverApi } from '../../utils/serverApi';
import { loadMyStory, storyAge, clampStoryDuration, type MyStory } from '../../utils/myStory';

const DEFAULT_SLIDE_MS = 5000;

const imgSource = (img: any): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
};

// ─── Inline SVG reaction glyphs (no emoji — project rule) ───
const HeartGlyph = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={color}
    />
  </Svg>
);

const ThumbGlyph = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 21h4V9H2v12zM22 9c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 0 7.89 6.28C7.54 6.63 7.33 7.1 7.33 7.62V19c0 1.1.9 2 2 2h9.09c.76 0 1.41-.43 1.75-1.05l3.54-6.26c.18-.34.29-.73.29-1.14V9z"
      fill={color}
    />
  </Svg>
);

const SurprisedGlyph = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
    <Circle cx="9" cy="10" r="1.4" fill={color} />
    <Circle cx="15" cy="10" r="1.4" fill={color} />
    <Ellipse cx="12" cy="15.5" rx="2.6" ry="3" fill={color} />
  </Svg>
);

const HeartEyesGlyph = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
    <Path d="M8.6 8.3c.4-.5 1.3-.2 1.3.6 0 .6-.9 1.5-1.3 1.9-.4-.4-1.3-1.3-1.3-1.9 0-.8.9-1.1 1.3-.6z" fill={color} />
    <Path d="M15.4 8.3c.4-.5 1.3-.2 1.3.6 0 .6-.9 1.5-1.3 1.9-.4-.4-1.3-1.3-1.3-1.9 0-.8.9-1.1 1.3-.6z" fill={color} />
    <Path d="M8.4 15.2c.6.7 2.2 1.3 3.6 1.3s3-.6 3.6-1.3c-.3.9-1.6 1.9-3.6 1.9s-3.3-1-3.6-1.9z" fill={color} />
  </Svg>
);

type GlyphProps = { color: string };
type ReactionDef = { id: string; label: string; glyph: (p: GlyphProps) => ReactElement };

const REACTIONS: ReactionDef[] = [
  { id: 'heart', label: 'Heart', glyph: HeartGlyph },
  { id: 'like', label: 'Like', glyph: ThumbGlyph },
  { id: 'wow', label: 'Wow', glyph: SurprisedGlyph },
  { id: 'love', label: 'Love', glyph: HeartEyesGlyph },
];

export default function StoryViewerScreen() {
  const { username, tray, idx, mine } = useLocalSearchParams<{ username: string; tray?: string; idx?: string; mine?: string }>();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [myStory, setMyStory] = useState<MyStory | null>(null);
  const [myStoryChecked, setMyStoryChecked] = useState(false);
  // REAL stories for the viewed author — first-class /api/app/stories rows.
  // Feed posts are never rendered as stories.
  const [authorStories, setAuthorStories] = useState<AppStory[] | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  // ── Own story (feed "Your Story" tile passes mine=1): render the SAVED image + caption
  const isMine = mine === '1' || username === 'me';
  useEffect(() => {
    if (isMine) {
      loadMyStory().then((s) => {
        setMyStory(s);
        setMyStoryChecked(true);
      });
    } else {
      setMyStoryChecked(true);
      serverApi.getStories().then((res) => {
        const all = res.ok && res.data?.stories ? (res.data.stories as AppStory[]) : [];
        setAuthorStories(storiesByUsername(all, String(username || '')));
      });
    }
  }, [isMine, username]);

  // ── Tray navigation (IG-style): viewer walks the whole story tray ──
  const trayIds = parseTrayParam(tray);
  // Current position: use the idx param if in the tray, else first entry
  let trayIndex = trayIds.indexOf(username || '');
  if (trayIndex < 0) trayIndex = Math.max(0, parseInt(String(idx ?? '0'), 10) || 0);
  // "Your Story" sits BEFORE the tray: no prev user
  if (isMine) trayIndex = -1;
  if (trayIndex >= trayIds.length) trayIndex = 0;
  const activeUsername = isMine ? '' : (trayIds.length ? trayIds[trayIndex] : username || '');
  // Slides = the author's real posted stories, newest first. Each slide keeps
  // its own display duration (author's choice at posting time).
  const slides = useMemo<string[]>(
    () =>
      isMine
        ? [myStory?.caption?.trim() || 'Your story']
        : (authorStories ?? []).map((s) => s.caption?.trim() || 'New story'),
    [isMine, myStory, authorStories]
  );
  const slideImages = useMemo(
    () => (isMine ? [myStory?.image ?? ''] : (authorStories ?? []).map((s) => s.image)),
    [isMine, myStory, authorStories]
  );
  const STORY_COUNT = slides.length;
  const currentStory = !isMine ? authorStories?.[index] : undefined;
  // Marketplace markup: overlays + attached product (mine from local post, others from server)
  const currentOverlays: StoryOverlay[] = (isMine ? myStory?.overlays : currentStory?.overlays) ?? [];
  const currentProduct = isMine ? myStory?.productRef : (currentStory?.productRef ?? null);
  const avatar = isMine ? undefined : slideImages[0] || undefined;
  const hasStory = isMine ? !!myStory : (authorStories?.length ?? 0) > 0;
  const safeName = isMine ? 'Your Story' : authorStories?.[0]?.creatorName || activeUsername || '';

  const imageSource = isMine ? (myStory ? { uri: myStory.image } : null) : imgSource(avatar);

  // Hop to another user in the tray (replace keeps the history clean, IG-style)
  const goToUser = (uidx: number) => {
    const next = trayIds[uidx];
    if (!next) return false;
    router.replace({
      pathname: `/story/${next}`,
      params: { tray: trayParam(trayIds), idx: String(uidx) },
    });
    return true;
  };
  const closeViewer = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  const isLast = index === STORY_COUNT - 1;
  const isFirst = index === 0;
  const hasNextUser = trayIndex + 1 < trayIds.length;
  const hasPrevUser = trayIndex > 0;
  const activeReaction = REACTIONS.find((r) => r.id === reaction) ?? null;

  useEffect(() => {
    if (isMine && myStoryChecked && !myStory) {
      // No saved story (stale deep link): fall back to the feed
      closeViewer();
      return;
    }
    // Non-mine views wait for the server stories fetch so an EMPTY result can
    // never flash the "No story available" state while still loading.
    if (!isMine && authorStories === null) return;
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMine, myStoryChecked, myStory, authorStories]);

  // Auto-advance per slide using the AUTHOR'S chosen display duration
  // (own story: duration picked in create-story; server stories: author's
  // stored durationMs). Advances slides; on the LAST slide of a user, the
  // separate effect below hops to the next user in the tray (IG behavior).
  useEffect(() => {
    if (!ready || (isMine && !myStory)) return;
    const dur = isMine
      ? clampStoryDuration(myStory?.duration ?? DEFAULT_SLIDE_MS)
      : clampStoryDuration(currentStory?.durationMs ?? DEFAULT_SLIDE_MS);
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: dur,
      useNativeDriver: false,
    });
    anim.start();
    const timer = setTimeout(() => {
      setIndex((i) => (i < STORY_COUNT - 1 ? i + 1 : i));
    }, dur);
    return () => {
      anim.stop();
      clearTimeout(timer);
    };
    // currentStory.id restarts the timer whenever the slide's source changes
  }, [ready, index, STORY_COUNT, isMine, myStory, currentStory?.id, progress]);

  // Last slide of a user: briefly pause, then walk to next user in the tray; close on final user
  useEffect(() => {
    if (!ready || !isLast) return;
    const t = setTimeout(() => {
      if (hasNextUser) goToUser(trayIndex + 1);
      else closeViewer();
    }, 1300);
    return () => clearTimeout(t);
  }, [ready, isLast, hasNextUser, trayIndex]);

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
    else if (hasPrevUser) goToUser(trayIndex - 1);
  };

  const goNext = () => {
    if (index < STORY_COUNT - 1) setIndex(index + 1);
    else if (hasNextUser) goToUser(trayIndex + 1);
    else closeViewer();
  };

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.inverseSurface }}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  // Honest empty state: this seller has no real posts to show as a story
  if (!isMine && !hasStory) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.inverseSurface, gap: 12 }}>
        <Text className="text-white font-inter-600" style={{ fontSize: 15, lineHeight: 20 }}>
          No story available
        </Text>
        <TouchableOpacity
          onPress={closeViewer}
          className="bg-primaryContainer rounded-full px-6 py-2.5"
          accessibilityRole="button"
          accessibilityLabel="Close story viewer"
        >
          <Text className="text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16 }}>
            Close
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.inverseSurface }}>
      {/* Story media: the seller's REAL post image for this slide */}
      <Image
        source={
          isMine
            ? { uri: myStory?.image ?? '' }
            : { uri: String(slideImages[index]) }
        }
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      {/* Tap zones: prev / next */}
      <TouchableOpacity className="absolute top-0 bottom-0" style={{ left: 0, width: '40%' }} onPress={goPrev} activeOpacity={0} />
      <TouchableOpacity className="absolute top-0 bottom-0" style={{ right: 0, width: '60%' }} onPress={goNext} activeOpacity={0} />

      {/* Top bar: avatar + username + close */}
      <View
        className="absolute top-0 left-0 right-0 flex-row items-center px-4"
        style={{ paddingTop: insets.top + 10, gap: 10, zIndex: 20 }}
      >
        <View className="w-8 h-8 rounded-full bg-surfaceContainer overflow-hidden">
          <Image source={imageSource} className="w-8 h-8 rounded-full" />
        </View>
        <Text className="flex-1 text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }} numberOfLines={1}>
          {safeName}
          {isMine && myStory ? ` · ${storyAge(myStory.time)}` : ''}
          {!isMine && currentStory ? ` · ${storyAge(currentStory.createdAt)}` : ''}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <CloseIcon size={22} color={colors.surfaceContainerLowest} />
        </TouchableOpacity>
      </View>

      {/* Progress bars */}
      <View
        className="absolute left-0 right-0 flex-row"
        style={{ top: insets.top + 8, paddingHorizontal: 10, gap: 4, zIndex: 21 }}
      >
        {Array.from({ length: STORY_COUNT }).map((_, i) => (
          <View
            key={i}
            className="flex-1 overflow-hidden"
            style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceContainerLowest, opacity: 0.3 }}
          >
            {i < index ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceContainerLowest }]} />
            ) : i === index ? (
              <Animated.View
                style={{
                  height: '100%',
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: colors.surfaceContainerLowest,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>

      {/* Marketplace text overlays at their zones */}
      {(['top', 'middle', 'bottom'] as const).map((zone) => {
        const items = currentOverlays.filter((o) => o.zone === zone);
        if (!items.length) return null;
        return (
          <View
            key={zone}
            className="absolute left-0 right-0 items-center px-8"
            pointerEvents="none"
            style={{ zIndex: 25, ...(zone === 'top' ? { top: insets.top + 70 } : zone === 'bottom' ? { bottom: 250 } : { top: '45%' }) }}
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

      {/* Caption + engagement stack */}
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: 48, zIndex: 30 }}>
        {/* Reactions rail */}
        <View className="flex-row items-end mb-3" style={{ gap: 8 }}>
          {REACTIONS.map((r) => {
            const active = reaction === r.id;
            const Glyph = r.glyph;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setReaction((cur) => (cur === r.id ? null : r.id))}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`React with ${r.label.toLowerCase()}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.primaryContainer : colors.overlay,
                }}
              >
                <Glyph color={active ? colors.onPrimary : colors.surfaceContainerLowest} />
              </TouchableOpacity>
            );
          })}
          {activeReaction && (
            <View
              className="flex-row items-center"
              style={{
                marginLeft: 2,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: colors.surfaceContainerLowest,
                gap: 4,
              }}
            >
              <CheckIcon size={12} color={colors.primary} />
              <Text className="font-inter-600" style={{ fontSize: 11, lineHeight: 14, color: colors.textPrimary }}>
                You reacted: {activeReaction.label}
              </Text>
            </View>
          )}
        </View>

        {/* Attached product chip -> product detail */}
        {currentProduct ? (
          <TouchableOpacity
            onPress={() => router.push(`/product/${currentProduct.id}`)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`View attached product ${currentProduct.title}`}
            className="flex-row items-center rounded-figma-16 overflow-hidden mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.94)' }}
          >
            {currentProduct.image ? (
              <Image source={{ uri: currentProduct.image }} style={{ width: 44, height: 44 }} resizeMode="cover" />
            ) : null}
            <View className="flex-1 px-3 py-2">
              <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textPrimary }} numberOfLines={1}>
                {currentProduct.title}
              </Text>
              {typeof currentProduct.price === 'number' ? (
                <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 16, color: colors.primary }}>
                  Rs {currentProduct.price.toLocaleString('en-IN')}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Caption */}
        <Text className="text-white font-inter-500" style={{ fontSize: 14, lineHeight: 20 }}>
          {slides[index]}
        </Text>

        {isLast && !isMine && activeUsername ? (
          <TouchableOpacity
            className="self-start bg-primaryContainer rounded-full px-6 py-2.5 mt-4"
            onPress={() => router.push(`/seller/${activeUsername}`)}
          >
            <Text className="text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
              View profile
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* IG-style reply bar — opens a REAL DM thread with this seller */}
        {!isMine && activeUsername ? (
          <View className="flex-row items-center mt-4" style={{ gap: 10 }}>
            <TouchableOpacity
              className="flex-1 h-11 justify-center px-4 rounded-full border"
              style={{ borderColor: 'rgba(255,255,255,0.6)', backgroundColor: colors.overlay }}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/chat',
                  params: {
                    to: activeUsername,
                    msg: `Replied to your story: "${slides[index] || ''}" - is it still available?`,
                  },
                })
              }
            >
              <Text className="text-white font-inter-400" style={{ fontSize: 13, lineHeight: 16 }}>
                Send message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Like story"
              onPress={() => setReaction((cur) => (cur === 'heart' ? null : 'heart'))}
              className="w-11 h-11 items-center justify-center rounded-full"
              style={{ backgroundColor: reaction === 'heart' ? colors.primaryContainer : colors.overlay }}
            >
              <HeartGlyph color={colors.surfaceContainerLowest} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Share story"
              onPress={() =>
                Share.share({ message: `Check out ${safeName}'s story on susej` }).catch(() => {})
              }
              className="w-11 h-11 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.overlay }}
            >
              <ShareIcon size={18} color={colors.surfaceContainerLowest} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}
