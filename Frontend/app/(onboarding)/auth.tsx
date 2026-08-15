import { View, Text, TouchableOpacity, Image, Dimensions, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GoogleIcon, PhoneIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { authImages } from '../../utils/screenImages';
import { useAuth } from '../../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BENTO_GAP = 12;
const BENTO_LEFT_W = 166;
const BENTO_RIGHT_W = 170;
const BENTO_W = BENTO_LEFT_W + BENTO_GAP + BENTO_RIGHT_W; // 348
const BENTO_H = 251; // portrait height from Figma
const BENTO_ASPECT = BENTO_W / BENTO_H;
const CONTENT_H_PAD = 120; // space for header + footer padding

export default function AuthScreen() {
  const { login, completeOnboarding } = useAuth();

  // Google sign-in (demo): instant login as a buyer, same pattern as login.tsx demo POV
  const handleGoogleSignIn = async () => {
    await login({ name: 'Aarav Mehta', username: 'user', phone: '9876543210', role: 'buyer' });
    await completeOnboarding();
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {/* Overlay+Blur decoration — absolute behind everything */}
      <View style={styles.topBlur} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* HEADER — auto-height */}
        <View style={styles.headerSection}>
          <Text style={styles.logo}>susej</Text>
          <Text style={styles.welcomeTitle}>Welcome to susej</Text>
          <View style={styles.subtitleWrapper}>
            <Text style={styles.subtitle}>
              Discover and shop the most exclusive{'\n'}curated collections for you.
            </Text>
          </View>
        </View>

        {/* HERO — fills remaining space with blur + scaled bento */}
        <View style={styles.heroSection}>
          <View style={styles.abstractVisual} pointerEvents="none">
            <View style={styles.blurCircle} />
          </View>

          {/* Bento Grid — scaled to fit available width */}
          <View style={styles.bentoGrid}>
            {/* Left — portrait */}
            <View style={styles.bentoLeft}>
              <Image
                source={authImages[0]}
                style={styles.bentoImage}
                resizeMode="cover"
              />
            </View>
            {/* Right column — 2 landscape */}
            <View style={styles.bentoRightCol}>
              <View style={styles.bentoRightTop}>
                <Image
                  source={authImages[1]}
                  style={styles.bentoImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.bentoRightBottom}>
                <Image
                  source={authImages[2]}
                  style={styles.bentoImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER — auto-height */}
        <View style={styles.footerSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(onboarding)/otp')}
          >
            <PhoneIcon size={14} color="#FFFFFF" />
            <Text style={styles.buttonTextWhite}>Continue with Phone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={handleGoogleSignIn}
          >
            <GoogleIcon size={20} />
            <Text style={styles.buttonTextDark}>Continue with Google</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By continuing, you agree to susej's Terms of Service and {'\n'}Privacy Policy.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.8}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },

  // ─── TOP-LEFT DECORATIVE BLUR ───
  topBlur: {
    position: 'absolute',
    left: -64,
    top: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: colors.primaryFixedDim,
    opacity: 0.3,
    zIndex: -1,
  },

  safeArea: {
    flex: 1,
  },

  // ─── HEADER ───
  headerSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  logo: {
    fontFamily: 'Inter',
    fontSize: 40,
    lineHeight: 48,
    color: colors.primary,
    fontWeight: '400',
    textAlign: 'center',
  },

  welcomeTitle: {
    fontFamily: 'Inter',
    fontSize: 20,
    lineHeight: 28,
    color: colors.textPrimary,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 12,
  },

  subtitleWrapper: {
    width: 280,
    marginTop: 12,
  },

  subtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '400',
  },

  // ─── HERO — flex:1 fills remaining space ───
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  abstractVisual: {
    ...StyleSheet.absoluteFill,
    opacity: 0.1,
    overflow: 'hidden',
  },

  // 500×500 circle at (-55, 8) — scale to still look good on smaller screens
  blurCircle: {
    position: 'absolute',
    left: -55,
    top: 8,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: colors.primary,
  },

  // Bento grid — Figma proportions with responsive scaling
  bentoGrid: {
    flexDirection: 'row',
    gap: BENTO_GAP,
    // Scale width to screen, cap at Figma's 348
    width: Math.min(BENTO_W, SCREEN_WIDTH - 40),
  },

  bentoLeft: {
    width: Math.min(BENTO_LEFT_W, (SCREEN_WIDTH - 40 - BENTO_GAP) * (BENTO_LEFT_W / BENTO_W)),
    aspectRatio: 166 / 251,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },

  bentoRightCol: {
    flex: 1,
    gap: BENTO_GAP,
  },

  bentoRightTop: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },

  bentoRightBottom: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
  },

  bentoImage: {
    width: '100%',
    height: '100%',
  },

  // ─── FOOTER ───
  footerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },

  primaryButton: {
    width: '100%',
    maxWidth: 350,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  buttonTextWhite: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.14,
    color: colors.onPrimary,
  },

  secondaryButton: {
    width: '100%',
    maxWidth: 350,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  buttonTextDark: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.14,
    color: colors.textPrimary,
  },

  termsText: {
    fontFamily: 'Inter',
    fontSize: 11,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '400',
  },

  loginButton: {
    width: '100%',
    maxWidth: 350,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
