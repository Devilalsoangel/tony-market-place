import { View, Text, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

// Exact Figma path from splash-screen.svg (node 1:1872, viewBox matches canvas coords)
const ShoppingBagIcon = () => (
  <Svg width={46} height={58} viewBox="177 424 32 40" fill="none">
    <Path
      d="M181.05 464.08C179.95 464.08 179.008 463.688 178.225 462.905C177.441 462.122 177.05 461.18 177.05 460.08V436.08C177.05 434.98 177.441 434.038 178.225 433.255C179.008 432.472 179.95 432.08 181.05 432.08H185.05C185.05 429.88 185.833 427.997 187.4 426.43C188.966 424.863 190.85 424.08 193.05 424.08C195.25 424.08 197.133 424.863 198.7 426.43C200.266 427.997 201.05 429.88 201.05 432.08H205.05C206.15 432.08 207.091 432.472 207.875 433.255C208.658 434.038 209.05 434.98 209.05 436.08V460.08C209.05 461.18 208.658 462.122 207.875 462.905C207.091 463.688 206.15 464.08 205.05 464.08H181.05ZM189.05 432.08H197.05C197.05 430.98 196.658 430.038 195.875 429.255C195.091 428.472 194.15 428.08 193.05 428.08C191.95 428.08 191.008 428.472 190.225 429.255C189.441 430.038 189.05 430.98 189.05 432.08ZM199.05 442.08C199.616 442.08 200.091 441.888 200.475 441.505C200.858 441.122 201.05 440.647 201.05 440.08V436.08H197.05V440.08C197.05 440.647 197.241 441.122 197.625 441.505C198.008 441.888 198.483 442.08 199.05 442.08ZM187.05 442.08C187.616 442.08 188.091 441.888 188.475 441.505C188.858 441.122 189.05 440.647 189.05 440.08V436.08H185.05V440.08C185.05 440.647 185.241 441.122 185.625 441.505C186.008 441.888 186.483 442.08 187.05 442.08Z"
      fill={colors.onPrimaryContainer}
    />
  </Svg>
);

export default function SplashScreen() {
  const { hasOnboarded, isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (hasOnboarded && isLoggedIn) {
        router.replace('/(tabs)/feed');
      } else {
        router.replace('/(onboarding)/welcome');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isLoading, hasOnboarded, isLoggedIn]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Background: solid primaryContainer (#5D5FEF) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryContainer }]} />

      {/* Decorative Ambient Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Pill 1: Soft Tactility Overlay */}
        <View style={styles.pillTop} />
        {/* Pill 2: Background+Blur */}
        <View style={styles.pillBottom} />
        {/* Radial gradient — white center vignette (Figma: paint0_radial_1_1862) */}
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
            locations={[0, 0.7]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      {/* Center Content: Brand Logo & Identity */}
      <View style={styles.centerSection}>
        {/* Icon Container with glass effect */}
        <View style={styles.iconOuterWrapper}>
          <View style={styles.iconShadow} />
          <BlurView intensity={24} tint="light" style={styles.iconGlass}>
            <ShoppingBagIcon />
          </BlurView>
        </View>

        {/* Brand Text */}
        <Text style={styles.brandText}>susej</Text>
      </View>

      {/* Bottom Content */}
      <View style={styles.bottomSection}>
        {/* Tagline */}
        <Text style={styles.taglineText}>BUY. SELL. CONNECT.</Text>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={styles.progressBarFill} />
        </View>

        {/* Social Proof Card */}
        <View style={styles.cardWrapper}>
          <BlurView intensity={12} tint="light" style={styles.socialCard}>
            {/* Thumbnail */}
            <View style={styles.thumbnailWrapper}>
              <Image
                source={require('../assets/images/splash-thumbnail.png')}
                style={styles.thumbnailImage}
              />
            </View>
            {/* Text */}
            <View style={styles.cardTextArea}>
              <Text style={styles.cardFeaturedLabel}>Featured Item</Text>
              <Text style={styles.cardProductName}>Luxe Runner v2</Text>
            </View>
            {/* Arrow - exact Figma path */}
            <View style={styles.cardArrow}>
              <Svg width={12} height={12} viewBox="228 989 14 14" fill="none">
                <Path
                  d="M237.986 996.833H227.84V995.167H237.986L233.319 990.5L234.507 989.333L241.173 996L234.507 1002.67L233.319 1001.5L237.986 996.833Z"
                  fill={colors.onPrimaryContainer}
                />
              </Svg>
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // ─── Decorative Pills ───
  pillTop: {
    position: 'absolute',
    left: -39,
    top: -212,
    width: 234,
    height: 637,
    borderRadius: 117,
    backgroundColor: '#4343D5',
    opacity: 0.04,
  },
  pillBottom: {
    position: 'absolute',
    left: 195,
    top: 637,
    width: 234,
    height: 637,
    borderRadius: 117,
    backgroundColor: '#696AB5',
    opacity: 0.04,
  },

  // ─── Center Section (Figma: icon at y=396, brand at y=539, shifted above center) ───
  centerSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -56 }],
  },
  iconOuterWrapper: {
    width: 96,
    height: 96,
    borderRadius: 32,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
  },
  iconShadow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 32,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 12.5,
    elevation: 12,
  },
  iconGlass: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  brandText: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: colors.onPrimaryContainer,
    fontFamily: 'Inter',
    fontWeight: '700',
  },

  // ─── Bottom Section (Figma: tagline y~924, progress y=945, card y=971 → card bottom=1029, gap=32px) ───
  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: 'center',
  },
  taglineText: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 5,
    color: colors.onPrimaryContainer,
    fontFamily: 'Inter',
    fontWeight: '400',
    marginBottom: 3,
  },

  // Progress bar (Figma: 48w x 2h, rx=1, y=945)
  progressBarTrack: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.onPrimaryContainer,
  },

  // Social proof card (from Figma: 320w x 58h, rx=12, at y=971)
  cardWrapper: {
    width: 320,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  socialCard: {
    width: 320,
    height: 58,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingLeft: 12,
    paddingRight: 12,
    overflow: 'hidden',
  },
  thumbnailWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  cardTextArea: {
    flex: 1,
    paddingLeft: 12,
  },
  cardFeaturedLabel: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: colors.onPrimaryContainer,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  cardProductName: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.onPrimaryContainer,
    fontFamily: 'Inter',
    fontWeight: '700',
    marginTop: 2,
  },
  cardArrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});