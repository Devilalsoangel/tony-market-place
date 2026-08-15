import { useState, useEffect, useRef, type ReactElement } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, CheckIcon } from '../../utils/icons';
import { colors, shadows } from '../../utils/theme';
import { STORY_TRAY, storyById, storyByRoute, storySlides } from '../../utils/storyTray';
import { loadMyStory, storyAge, type MyStory } from '../../utils/myStory';

const STORY_DURATION = 4000;

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

const EyeGlyph = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
    <Circle cx="12" cy="12" r="3" fill={color} />
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

// ─── Poll (slide 2) ──────────────────────────────────────────
const POLL_OPTIONS = ['Yes', 'Maybe'];
const POLL_SEED: Record<string, number> = { Yes: 60, Maybe: 40 };

// ─── Viewers (last slide) ────────────────────────────────────
const VIEWERS = [
  { name: 'priya.shop', time: '2m ago' },
  { name: 'rahul.designs', time: '4m ago' },
  { name: 'mina_threads', time: '6m ago' },
  { name: 'dev.crafts', time: '9m ago' },
  { name: 'aisha.vintage', time: '12m ago' },
  { name: 'karan_studio', time: '15m ago' },
  { name: 'neha.picks', time: '18m ago' },
  { name: 'tariq.goods', time: '22m ago' },
];

const avatarUri = (seed: string) => ({ uri: `https://picsum.photos/seed/${seed}/100/100` });

export default function StoryViewerScreen() {
  const { username, tray, idx, mine } = useLocalSearchParams<{ username: string; tray?: string; idx?: string; mine?: string }>();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [myStory, setMyStory] = useState<MyStory | null>(null);
  const [myStoryChecked, setMyStoryChecked] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({ ...POLL_SEED });
  const [pollChoice, setPollChoice] = useState<string | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
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
    }
  }, [isMine]);

  // ── Tray navigation (IG-style): viewer walks the whole story tray ──
  const trayIdsRaw = Array.isArray(tray) ? tray[0] : tray;
  const trayIds = (trayIdsRaw || '').split(',').filter(Boolean);
  // Current position: use the tid param if in the tray, else by route, else first unviewed
  let trayIndex = trayIds.indexOf(username || '');
  if (trayIndex < 0) trayIndex = Math.max(0, parseInt(String(idx ?? '0'), 10) || 0);
  // "Your Story" sits BEFORE the tray: next user is tray[0] (Aarav), no prev user
  if (isMine) trayIndex = -1;
  if (trayIndex >= trayIds.length) trayIndex = 0;
  const routeUser = storyByRoute(username || '');
  const currentUser = (trayIds.length ? storyById(trayIds[trayIndex]) : undefined) ?? routeUser ?? STORY_TRAY[0];
  const safeName = isMine ? 'Your Story' : currentUser.route;
  const slides = isMine ? [myStory?.caption?.trim() || 'Your story'] : storySlides(currentUser);
  const STORY_COUNT = slides.length;
  const avatar = isMine ? undefined : currentUser.avatar;

  const imageSource = isMine ? (myStory ? { uri: myStory.image } : null) : imgSource(avatar);

  // Hop to another user in the tray (replace keeps the history clean, IG-style)
  const goToUser = (uidx: number) => {
    const next = trayIds[uidx];
    if (!next) return false;
    const u = storyById(next);
    if (!u) return false;
    router.replace({
      pathname: `/story/${u.route}`,
      params: { tray: trayIdsRaw || '', idx: String(uidx) },
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
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMine, myStoryChecked, myStory]);

  // Auto-advance every 4s. Advance slides; on the LAST slide of a user,
  // hop to the NEXT USER in the tray (IG behavior). No wrap on final user.
  useEffect(() => {
    if (!ready || (isMine && !myStory)) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    anim.start();
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i < STORY_COUNT - 1) return i + 1;
        return i;
      });
    }, STORY_DURATION);
    return () => {
      anim.stop();
      clearInterval(timer);
    };
  }, [ready, index, progress, trayIndex, trayIdsRaw, STORY_COUNT]);

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

  const castVote = (option: string) => {
    if (pollChoice) return;
    setPollChoice(option);
    setPollVotes((v) => ({ ...v, [option]: (v[option] ?? 0) + 1 }));
  };

  const totalVotes = POLL_OPTIONS.reduce((sum, o) => sum + (pollVotes[o] ?? 0), 0);
  const pollPct = (option: string) => (totalVotes > 0 ? Math.round(((pollVotes[option] ?? 0) / totalVotes) * 100) : 0);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.inverseSurface }}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.inverseSurface }}>
      {/* Story media */}
      <Image
        source={isMine ? { uri: myStory?.image ?? '' } : { uri: `https://picsum.photos/seed/${safeName}-${index}/400/700` }}
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
        <Text className="flex-1 text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
          {safeName}
          {isMine && myStory ? ` · ${storyAge(myStory.time)}` : ''}
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

      {/* Viewers panel (last slide) */}
      {isLast && viewersOpen && (
        <View
          className="absolute left-4 right-4"
          style={{ bottom: 170, zIndex: 40, backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 14, ...shadows.card }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-inter-700" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
              Viewers
            </Text>
            <TouchableOpacity onPress={() => setViewersOpen(false)} hitSlop={8}>
              <CloseIcon size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            {VIEWERS.map((v) => (
              <View key={v.name} className="flex-row items-center" style={{ gap: 10 }}>
                <View className="w-9 h-9 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Image source={avatarUri(v.name)} className="w-9 h-9 rounded-full" />
                </View>
                <Text className="flex-1 font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                  {v.name}
                </Text>
                <Text style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>{v.time}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

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

        {/* Poll (slide 2) */}
        {index === 1 && (
          <View
            style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, padding: 14, marginBottom: 12 }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-700" style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}>
                Quick poll
              </Text>
              {pollChoice && (
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <CheckIcon size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>You voted</Text>
                </View>
              )}
            </View>
            <Text className="font-inter-500 mt-1 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              Do you like the sneak peek?
            </Text>
            <View style={{ gap: 8 }}>
              {POLL_OPTIONS.map((opt) => {
                const selected = pollChoice === opt;
                const pct = pollPct(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => castVote(opt)}
                    activeOpacity={0.8}
                    style={{
                      borderRadius: 12,
                      borderWidth: 1.5,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderColor: selected ? colors.primaryContainer : colors.outlineVariant,
                      backgroundColor: selected ? colors.primaryBg : colors.surfaceContainerLow,
                    }}
                  >
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Text className="flex-1 font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                        {opt}
                      </Text>
                      {pollChoice && (
                        <Text className="font-inter-700" style={{ fontSize: 13, lineHeight: 16, color: colors.textSecondary }}>
                          {pct}%
                        </Text>
                      )}
                      {selected && <CheckIcon size={16} color={colors.primaryContainer} />}
                    </View>
                    {pollChoice && (
                      <View className="mt-2" style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainer }}>
                        <View
                          style={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: selected ? colors.primaryContainer : colors.primaryFixedDim,
                            width: `${pct}%`,
                          }}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Caption */}
        <Text className="text-white font-inter-500" style={{ fontSize: 14, lineHeight: 20 }}>
          {slides[index]}
        </Text>

        {/* Viewers row (last slide) */}
        {isLast && (
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setViewersOpen((o) => !o)}
              className="flex-row items-center"
              activeOpacity={0.7}
              style={{
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.overlay,
                gap: 6,
                alignSelf: 'flex-start',
              }}
            >
              <EyeGlyph color={colors.surfaceContainerLowest} />
              <Text className="text-white font-inter-600" style={{ fontSize: 13, lineHeight: 16 }}>
                Viewers 24
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLast && !isMine && (
          <TouchableOpacity
            className="self-start bg-primaryContainer rounded-full px-6 py-2.5 mt-4"
            onPress={() => router.push(`/seller/${safeName}`)}
          >
            <Text className="text-white font-inter-700" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
              View profile
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
