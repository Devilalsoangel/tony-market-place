import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Linking, Animated, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';

// ── Creator = CAMERA-FIRST creation shell (IG pattern, GPT-reviewed spec).
// One surface: fullscreen viewfinder + bottom mode rail (POST·STORY·REEL·LIVE).
// Shutter/gallery feed the EXISTING downstream editors (create wizard,
// create-story, create-reel); LIVE hands off to the real live setup screen.
// No launcher grid anymore. Buyers keep the honest "Sellers only" gate.

type CreationMode = 'post' | 'story' | 'reel' | 'live';

const MODES: { key: CreationMode; label: string }[] = [
  { key: 'post', label: 'Post' },
  { key: 'story', label: 'Story' },
  { key: 'reel', label: 'Reel' },
  { key: 'live', label: 'Live' },
];

// Lazy require pattern (Expo Go SDK builds can lack native modules).
// MUST run outside render: some modules validate their native side at
// module-eval time and throw synchronously (ExpoMediaLibraryNext lesson).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCamera(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-camera');
  } catch {
    return null;
  }
}

const CloseGlyph = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const FlashGlyph = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    {/* Bare line icon (no fill disk) so it reads as chrome, not a button chip */}
    <Path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none" />
  </Svg>
);

const FlipGlyph = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M4.5 10a8 8 0 0113.9-3.2M19.5 14a8 8 0 01-13.9 3.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M18.8 2.6v4.2h-4.2M5.2 21.4v-4.2h4.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const GalleryFallbackGlyph = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="16" rx="3" stroke={color} strokeWidth="1.8" />
    <Circle cx="8.6" cy="9.4" r="1.7" fill={color} />
    <Path d="M4 17l4.5-4.5a2 2 0 012.8 0L15 16m-2.5 2.5l3-3a2 2 0 012.8 0L20 17.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function CreatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isSeller = !!user?.isSeller;
  // Entry mode: /creator?mode=story|reel|live|post (Your Story tile, reels
  // buttons, etc. land straight in the right editor context like Instagram).
  const routeParams = useLocalSearchParams<{ mode?: string | string[] }>();
  const initialMode = (() => {
    const raw = Array.isArray(routeParams.mode) ? routeParams.mode[0] : routeParams.mode;
    return raw && MODES.some((m) => m.key === raw) ? (raw as CreationMode) : 'post';
  })();

  // Camera module loads in an EFFECT, never during render (native-module
  // eval can throw synchronously and must not run inside the render tree).
  // camState: loading -> ready (viewfinder) | missing (gallery-first fallback).
  const [camState, setCamState] = useState<'loading' | 'ready' | 'missing'>('loading');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cameraMod, setCameraMod] = useState<any>(null);
  // Honest reason the viewfinder is unavailable (dev-visible, no silent lies).
  const [unavailReason, setUnavailReason] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [perm, setPerm] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [mode, setMode] = useState<CreationMode>(initialMode);
  // Fullscreen immersive camera: hide the tab bar while this route is focused
  // (per-route options - the layout-level merge does not see focused children).
  const navigation = useNavigation() as unknown as {
    setOptions?: (opts: Record<string, unknown>) => void;
  };
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions?.({ tabBarStyle: { display: 'none' } } as never);
    }, [navigation])
  );
  const [capturing, setCapturing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  const [lastShot, setLastShot] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const CameraModule = getCamera();
    if (!CameraModule) {
      setUnavailReason('expo-camera module failed to load in this Expo Go build');
      setCamState('missing');
      setPerm('denied');
      return;
    }
    (async () => {
      try {
        // v57 API shape: permission fns live on the `Camera` namespace export.
        const Cam = CameraModule?.Camera ?? CameraModule;
        const req = Cam?.requestCameraPermissionsAsync;
        if (typeof req !== 'function') {
          setUnavailReason('expo-camera build exposes no permission API');
          setCamState('missing');
          setPerm('denied');
          return;
        }
        const cam = await req.call(Cam);
        if (!alive) return;
        setCanAskAgain(cam?.canAskAgain !== false);
        setPerm(cam?.granted ? 'granted' : 'denied');
        setCameraMod(CameraModule);
        setCamState('ready');
        if (!cam?.granted) setUnavailReason(`permission: granted=${cam?.granted} canAskAgain=${cam?.canAskAgain} status=${cam?.status}`);
      } catch (e) {
        if (alive) {
          setUnavailReason(`request threw: ${(e as Error)?.message ?? 'unknown'}`);
          setPerm('denied');
          setCamState('missing');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openGalleryForCurrentMode = async () => {
    if (capturing) return;
    const Picker = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('expo-image-picker');
      } catch {
        return null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })() as any | null;
    if (!Picker) return;
    try {
      const multi = mode === 'post';
      const res = await Picker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: multi,
        selectionLimit: multi ? 6 : 1,
        exif: false,
      });
      if (res.canceled) return;
      const uris: string[] = (res.assets ?? []).map((a: { uri: string }) => a.uri);
      if (!uris.length) return;
      if (mode === 'story') router.push({ pathname: '/create-story', params: { cameraImage: uris[0] } });
      else if (mode === 'reel') router.push({ pathname: '/create-reel', params: { cameraImage: uris[0] } });
      else router.push({ pathname: '/(tabs)/create', params: { cameraImages: uris.join('|') } });
    } catch {
      // Picker unavailable: stay on camera, no fake success.
    }
  };

  const capture = async () => {
    if (capturing) return;
    if (mode === 'live') {
      router.push('/start-live');
      return;
    }
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
        flash: flashOn ? 'on' : 'off',
      });
      const uri: string | undefined = shot?.uri;
      if (!uri) return;
      setLastShot(uri);
      if (mode === 'story') router.push({ pathname: '/create-story', params: { cameraImage: uri } });
      else if (mode === 'reel') router.push({ pathname: '/create-reel', params: { cameraImage: uri } });
      else router.push({ pathname: '/(tabs)/create', params: { cameraImages: uri } });
    } catch {
      // Capture failed silently is dishonest -> surface nothing fake, just reset.
    } finally {
      setCapturing(false);
    }
  };

  if (user && !isSeller) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.surface, paddingTop: 120, paddingHorizontal: 32 }]}>
        <Text className="font-inter-700 text-textPrimary text-center" style={{ fontSize: 20 }}>Sellers only</Text>
        <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 14, lineHeight: 20 }}>
          Posting, stories, reels and live rooms belong to seller accounts.
        </Text>
        <TouchableOpacity
          className="items-center justify-center mt-6"
          style={{ backgroundColor: colors.primaryContainer, borderRadius: 16, height: 50 }}
          onPress={() => router.push('/become-seller')}
        >
          <Text className="font-inter-700" style={{ color: colors.onPrimary, fontSize: 15 }}>Become a Seller</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Honest fallback: camera or its permissions unavailable. Creation stays
  // reachable through the gallery for every mode (no dead screen).
  if (perm === 'denied') {
    return (
      <View style={[styles.fill, { backgroundColor: colors.surface, paddingTop: 80 + insets.top, paddingHorizontal: 28 }]}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' }}>
            <GalleryFallbackGlyph color={colors.primary} />
          </View>
          <Text className="font-inter-700 text-textPrimary text-center mt-4" style={{ fontSize: 19 }}>Create from your gallery</Text>
          <Text className="font-inter-400 text-textSecondary text-center mt-2" style={{ fontSize: 13, lineHeight: 18 }}>
            The camera isn&apos;t available right now. Pick media from your device to keep creating.
          </Text>
          {unavailReason ? (
            <Text className="font-inter-400 text-center mt-2" style={{ fontSize: 11, color: colors.textSecondary, opacity: 0.7 }}>
              {unavailReason}
            </Text>
          ) : null}
        </View>
        {!canAskAgain ? (
          <TouchableOpacity
            className="items-center justify-center"
            style={{ backgroundColor: colors.primaryContainer, borderRadius: 16, height: 50, marginTop: 16 }}
            onPress={() => Linking.openSettings()}
          >
            <Text className="font-inter-700" style={{ color: colors.onPrimary, fontSize: 14 }}>Allow camera in Settings</Text>
          </TouchableOpacity>
        ) : null}
        {MODES.filter((m) => m.key !== 'live').map((m) => (
          <TouchableOpacity
            key={m.key}
            className="items-center justify-center"
            style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16, height: 50, marginTop: 12, flexDirection: 'row', gap: 8, ...shadows.card }}
            onPress={() => {
              setMode(m.key);
              setTimeout(openGalleryForCurrentMode, 60);
            }}
          >
            <Text className="font-inter-700" style={{ color: colors.textPrimary, fontSize: 14 }}>
              {m.key === 'post' ? 'New Post from gallery' : m.key === 'story' ? 'New Story from gallery' : 'New Reel from gallery'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          className="items-center justify-center"
          style={{ backgroundColor: colors.primaryContainer, borderRadius: 16, height: 50, marginTop: 12 }}
          onPress={() => router.push('/start-live')}
        >
          <Text className="font-inter-700" style={{ color: colors.onPrimary, fontSize: 14 }}>Start a Live room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Swipe-back-to-feed animation state (mirrors the feed reveal gesture).
  const winW = Dimensions.get('window').width;
  const exitX = useRef(new Animated.Value(0)).current;
  const backLock = useRef(false);
  const slideX = exitX.interpolate({ inputRange: [0, 1], outputRange: [0, -winW] });
  const onExitDrag = ({ nativeEvent }: { nativeEvent: { translationX: number } }) => {
    if (nativeEvent.translationX < 0) exitX.setValue(Math.min(1, -nativeEvent.translationX / winW));
  };
  const onExitEnd = ({ nativeEvent }: { nativeEvent: { state: number; translationX: number } }) => {
    const s = nativeEvent.state;
    if (s !== State.END && s !== State.CANCELLED) return;
    if (nativeEvent.translationX < -winW * 0.3 && !backLock.current) {
      backLock.current = true;
      Animated.timing(exitX, { toValue: 1, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) router.back();
        setTimeout(() => {
          exitX.setValue(0);
          backLock.current = false;
        }, 400);
      });
    } else {
      Animated.spring(exitX, { toValue: 0, speed: 24, bounciness: 5, useNativeDriver: true }).start();
    }
  };

  return (
    // IG pattern: swipe LEFT (right-to-left) slides the camera away and
    // returns to the feed with motion; short drags spring back.
    <PanGestureHandler
      activeOffsetX={-30}
      failOffsetY={[-12, 12]}
      onGestureEvent={onExitDrag}
      onHandlerStateChange={onExitEnd}
    >
    <Animated.View
      style={[
        styles.fill,
        { backgroundColor: '#000000' },
        { transform: [{ translateX: slideX }] },
      ]}
    >
      {/* Fullscreen viewfinder */}
      {perm === 'granted' && cameraMod?.CameraView ? (
        <cameraMod.CameraView
          ref={cameraRef}
          style={[styles.fill, { aspectRatio: undefined }]}
          facing={facing}
          flash={flashOn ? 'on' : 'off'}
          // Preview torch so the toggle is INSTANTLY visible (flash alone only
          // fires during capture, which reads as "not working").
          enableTorch={flashOn}
          mode="picture"
          mute
        />
      ) : (
        <View style={[styles.fill, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}

      {/* Top chrome */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity hitSlop={10} onPress={() => router.back()} style={styles.topBtn}>
          <CloseGlyph size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={10}
          onPress={() => setFlashOn((v) => !v)}
          style={[styles.topBtn, flashOn && { backgroundColor: '#FFFFFF33' }]}
        >
          <FlashGlyph color={flashOn ? '#FFD54A' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      {/* Bottom cluster */}
      <View style={[styles.bottomCluster, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.controlsRow}>
          {/* Gallery */}
          <TouchableOpacity onPress={openGalleryForCurrentMode} activeOpacity={0.8} style={styles.galleryBtn}>
            {lastShot ? (
              <Image source={{ uri: lastShot }} style={styles.galleryImg} resizeMode="cover" />
            ) : (
              <GalleryFallbackGlyph color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Shutter / Go Live */}
          {mode === 'live' ? (
            <TouchableOpacity onPress={capture} activeOpacity={0.85} style={styles.goLivePill}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' }} />
              <Text className="font-inter-700" style={{ color: '#FFFFFF', fontSize: 15 }}>Go Live</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={capture} activeOpacity={0.85} disabled={capturing} style={styles.shutterOuter}>
              <View style={shutterInnerStyle(capturing)} />
            </TouchableOpacity>
          )}

          {/* Flip camera */}
          {mode === 'live' ? (
            <View style={styles.flipSpacer} />
          ) : (
            <TouchableOpacity onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} activeOpacity={0.8} style={styles.flipBtn}>
              <FlipGlyph color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Mode rail - tappable, horizontally scrollable like IG's bottom nav */}
        <View style={styles.modeRailWrap}>
          {MODES.map((m) => {
            const active = m.key === mode;
            return (
              <TouchableOpacity key={m.key} onPress={() => setMode(m.key)} activeOpacity={0.8} hitSlop={8} style={styles.modeItem}>
                <Text className="font-inter-700" style={{ color: active ? '#FFFFFF' : '#939393', fontSize: 15, letterSpacing: 0.5 }}>
                  {m.label.toUpperCase()}
                </Text>
                <View style={[styles.modeUnderline, { opacity: active ? 1 : 0 }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
    </PanGestureHandler>
  );
}

const shutterInnerStyle = (busy: boolean): import('react-native').ViewStyle => ({
  width: busy ? 58 : 62,
  height: busy ? 58 : 62,
  borderRadius: 31,
  backgroundColor: '#FFFFFF',
  opacity: busy ? 0.6 : 1,
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF59',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF14',
  },
  galleryImg: { width: '100%', height: '100%' } as import('react-native').ImageStyle,
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLivePill: {
    minWidth: 150,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    alignSelf: 'center',
  },
  flipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF14',
  },
  flipSpacer: { width: 56, height: 56 },
  modeRailWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
  },
  modeItem: { alignItems: 'center', paddingBottom: 6 },
  modeUnderline: {
    marginTop: 6,
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
