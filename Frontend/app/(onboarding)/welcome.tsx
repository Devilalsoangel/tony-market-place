import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet, Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { router } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../utils/theme';
import { welcomeImages } from '../../utils/screenImages';

const { width } = Dimensions.get('window');

const slides = [
  {
    title: 'Post Products like Instagram',
    subtitle: 'Turn your beautiful belongings into\nshoppable stories with ease.',
  },
  {
    // Stitch ref 186:72 — Buy & Sell variant
    title: 'Buy & Sell near you',
    subtitle: 'Trusted Sellers · Verified neighborhood\nprofiles — discover unique finds and\nsellers right in your neighborhood.',
  },
  {
    // Stitch ref 186:30 — Communities variant
    title: 'Join the Pulse',
    subtitle: '500+ Active Hubs — join communities,\nbuild connections and trade with people\nwho share your passions.',
  },
];

const HeartIcon = () => (
  <Svg width={28} height={26} viewBox="312 477 20 19" fill="none">
      <Path
        d="M322 495.675L320.55 494.375C318.867 492.858 317.475 491.55 316.375 490.45C315.275 489.35 314.4 488.363 313.75 487.488C313.1 486.613 312.646 485.808 312.387 485.075C312.129 484.342 312 483.592 312 482.825C312 481.258 312.525 479.95 313.575 478.9C314.625 477.85 315.933 477.325 317.5 477.325C318.367 477.325 319.192 477.508 319.975 477.875C320.758 478.242 321.433 478.758 322 479.425C322.567 478.758 323.242 478.242 324.025 477.875C324.808 477.508 325.633 477.325 326.5 477.325C328.067 477.325 329.375 477.85 330.425 478.9C331.475 479.95 332 481.258 332 482.825C332 483.592 331.871 484.342 331.612 485.075C331.354 485.808 330.9 486.613 330.25 487.488C329.6 488.363 328.725 489.35 327.625 490.45C326.525 491.55 325.133 492.858 323.45 494.375L322 495.675Z"
        stroke={colors.textSecondary}
        strokeWidth={1.5}
      />
  </Svg>
);

const ArrowIcon = () => (
  <Svg width={20} height={20} viewBox="233 766 16 16" fill="none">
    <Path
      d="M245.08 775H232.905V773H245.08L239.48 767.4L240.905 766L248.905 774L240.905 782L239.48 780.6L245.08 775Z"
      fill={colors.surface}
    />
  </Svg>
);

function SlideContent({ title, subtitle, imageIndex }: { title: string; subtitle: string; imageIndex: number }) {
  const img = welcomeImages[imageIndex % welcomeImages.length];

  return (
    <View style={styles.slide}>
      {/* Card with subtle shadow */}
      <View style={styles.cardShadow}>
        <View style={styles.card}>
          {/* Product Image */}
          <View style={styles.cardImage}>
            <Image
              source={img}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>

          {/* Bottom overlay with blur */}
          <View style={styles.cardOverlay}>
            <BlurView intensity={24} tint="light" style={styles.overlayBlur}>
              {/* Avatar */}
              <View style={styles.overlayAvatar} />
              {/* Text lines */}
              <View style={styles.overlayText}>
                <View style={styles.overlayTitleLine} />
                <View style={styles.overlaySubLine} />
              </View>
              {/* Heart icon */}
              <View style={styles.overlayHeart}>
                <HeartIcon />
              </View>
            </BlurView>
          </View>
        </View>
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export default function WelcomeCarouselScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Brand Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>susej</Text>
      </View>

      {/* Carousel */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e: any) => setActiveIndex(e.nativeEvent.position)}
      >
        {slides.map((slide, i) => (
          <SlideContent key={i} title={slide.title} subtitle={slide.subtitle} imageIndex={i} />
        ))}
      </PagerView>

      {/* Bottom Controls */}
      <View
        style={[styles.bottomControls, { height: 180 + insets.bottom, paddingBottom: 28 + insets.bottom }]}
      >
        {/* Page Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => router.push('/(onboarding)/auth')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <View style={styles.buttonArrow}>
            <ArrowIcon />
          </View>
        </TouchableOpacity>

        {/* Sign In Link - goes to the dedicated Login page, NOT the signup onboarding */}
        <TouchableOpacity
          style={styles.linkWrapper}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={styles.linkBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CARD_W = width * 0.93;
const CARD_H = CARD_W * 1.16;
const CARD_TOP = 12;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingTop: 32,
    height: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  brand: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.primary,
    fontFamily: 'Inter',
    fontWeight: '700',
  },
  pager: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
  },

  // ─── Card (Figma: ~93% width, softer shadow) ───
  cardShadow: {
    marginTop: CARD_TOP,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLowest,
  },
  cardImage: {
    width: CARD_W,
    height: CARD_H,
  },

  // ─── Bottom Overlay (Figma: ~104px, glass blur) ───
  cardOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    height: 104,
    borderRadius: 14,
    overflow: 'hidden',
  },
  overlayBlur: {
    flex: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 16,
  },
  overlayAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  overlayText: {
    flex: 1,
    paddingLeft: 14,
    gap: 6,
  },
  overlayTitleLine: {
    width: 92,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
  },
  overlaySubLine: {
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
    opacity: 0.6,
  },
  overlayHeart: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Title & Subtitle (Figma: ~28px bold 700, ~15px gray) ───
  title: {
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
    fontFamily: 'Inter',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 48,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.secondary,
    fontFamily: 'Inter',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
  },

  // ─── Bottom Controls (Figma: h180, pb28, ph20) ───
  bottomControls: {
    height: 180,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
    justifyContent: 'flex-start',
  },

  // Page Dots (Figma: spacing 8, height 8)
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  dotActive: {
    backgroundColor: colors.secondary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Button - #5D5FEF, 64px tall, 24px radius (Figma)
  button: {
    width: width - 40,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 28,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryContainer,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  buttonText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors.surface,
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  buttonArrow: {
    marginLeft: 10,
  },

  // Sign In Link
  linkWrapper: {
    marginTop: 32,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  linkBold: {
    fontWeight: '600',
    color: colors.primary,
  },
});
