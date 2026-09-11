import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
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

export default function AuthScreen() {
  const { serverGoogleLogin } = useAuth();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [devModalVisible, setDevModalVisible] = useState(false);
  const [devEmail, setDevEmail] = useState('');

  const googleClientId = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.googleClientId as string | undefined ?? '';
  const redirectUri = AuthSession.makeRedirectUri({ native: 'susej://auth/google' } as Parameters<typeof AuthSession.makeRedirectUri>[0]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId,
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' } as unknown as Parameters<typeof AuthSession.useAuthRequest>[1]
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = (response.params as Record<string, string | undefined>)?.id_token;
      if (!idToken) {
        setGoogleBusy(false);
        setGoogleError('Google sign-in failed. Try again.');
        return;
      }
      setGoogleBusy(true);
      setGoogleError('');
      serverGoogleLogin(idToken)
        .then((res) => {
          if (res.ok) {
            router.push('/(onboarding)/location');
          } else {
            setGoogleError(res.error ?? 'Google sign-in failed. Try again.');
          }
        })
        .finally(() => setGoogleBusy(false));
    } else if (response.type === 'error') {
      setGoogleBusy(false);
      setGoogleError((response.error as { message?: string } | undefined)?.message ?? 'Google sign-in failed. Try again.');
    } else if (response.type === 'dismiss') {
      setGoogleBusy(false);
    }
  }, [response, serverGoogleLogin]);

  const handleGoogleSignIn = async () => {
    // Google sign-in is COMING SOON — intentionally inert for now (per Tony).
    setGoogleError('Google sign-in is coming soon — use Phone for now.');
  };

  const handleDevBypass = async () => {
    const email = devEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGoogleError('Enter a valid email address');
      return;
    }
    setDevModalVisible(false);
    setGoogleBusy(true);
    setGoogleError('');
    const res = await serverGoogleLogin('', { email, name: email.split('@')[0] });
    setGoogleBusy(false);
    if (res.ok) {
      router.push('/(onboarding)/location');
    } else {
      setGoogleError(res.error ?? 'Dev Google sign-in failed.');
    }
  };

  // Dev bypass must never appear in user hands: __DEV__ is true in every
  // debug APK, so it additionally requires an explicit local opt-in that is
  // gitignored (.env.local) and never set for builds leaving this machine.
  const showDevBypass =
    __DEV__ && !googleClientId && process.env.EXPO_PUBLIC_DEV_BYPASS === '1';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.topBlur} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.headerSection}>
          <Text style={styles.logo}>susej</Text>
          <Text style={styles.welcomeTitle}>Welcome to susej</Text>
          <View style={styles.subtitleWrapper}>
            <Text style={styles.subtitle}>
              Discover and shop the most exclusive{'\n'}curated collections for you.
            </Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.abstractVisual} pointerEvents="none">
            <View style={styles.blurCircle} />
          </View>

          <View style={styles.bentoGrid}>
            <View style={styles.bentoLeft}>
              <Image source={authImages[0]} style={styles.bentoImage} resizeMode="cover" />
            </View>
            <View style={styles.bentoRightCol}>
              <View style={styles.bentoRightTop}>
                <Image source={authImages[1]} style={styles.bentoImage} resizeMode="cover" />
              </View>
              <View style={styles.bentoRightBottom}>
                <Image source={authImages[2]} style={styles.bentoImage} resizeMode="cover" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footerSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(onboarding)/otp')}
          >
            <PhoneIcon size={14} color="#FFFFFF" />
            <Text style={styles.buttonTextWhite}>Continue with Phone</Text>
          </TouchableOpacity>

          {/* Google is not wired yet: visibly marked Soon so the button
              never reads as a working sign-in (no dead taps). */}
          <TouchableOpacity
            style={[styles.secondaryButton, googleBusy && { opacity: 0.6 }, { opacity: googleBusy ? 0.6 : 0.75 }]}
            activeOpacity={0.8}
            onPress={handleGoogleSignIn}
            disabled={googleBusy}
          >
            <GoogleIcon size={20} />
            <Text style={styles.buttonTextDark}>{googleBusy ? 'Signing in...' : 'Continue with Google'}</Text>
            <View style={styles.soonChip}>
              <Text style={styles.soonText}>SOON</Text>
            </View>
          </TouchableOpacity>

          {googleError ? (
            <Text style={styles.errorText}>{googleError}</Text>
          ) : null}

          {showDevBypass ? (
            <TouchableOpacity onPress={() => setDevModalVisible(true)} activeOpacity={0.7} style={{ marginTop: 2 }}>
              <Text style={styles.devBypassText}>Dev: test Google (bypass)</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.termsText}>
            By continuing, you agree to susej's{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/terms')}>
              Terms of Service
            </Text>{' '}
            and {'\n'}
            <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>
              Privacy Policy
            </Text>.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.8}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>
              Already have an account? <Text style={{ fontWeight: '700', color: colors.primary }}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={devModalVisible} transparent animationType="fade" onRequestClose={() => { setDevModalVisible(false); setGoogleError(''); }}>
        <View style={styles.devModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setDevModalVisible(false); setGoogleError(''); }} />
          <View style={styles.devModalCard}>
            <Text style={styles.devModalTitle}>Dev Google bypass</Text>
            <Text style={styles.devModalSubtitle}>Enter an email to create or sign in as that Google user.</Text>
            <TextInput
              style={styles.devInput}
              placeholder="g.tester@susej.dev"
              placeholderTextColor="rgba(70,69,85,0.4)"
              value={devEmail}
              onChangeText={setDevEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.devModalRow}>
              <TouchableOpacity style={styles.devCancelBtn} onPress={() => { setDevModalVisible(false); setGoogleError(''); }}>
                <Text style={styles.devCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.devConfirmBtn} onPress={handleDevBypass}>
                <Text style={styles.devConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },

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

  blurCircle: {
    position: 'absolute',
    left: -55,
    top: 8,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: colors.primary,
  },

  bentoGrid: {
    flexDirection: 'row',
    gap: BENTO_GAP,
    width: Math.min(BENTO_W, SCREEN_WIDTH - 40),
  },

  bentoLeft: {
    width: Math.min(BENTO_LEFT_W, (SCREEN_WIDTH - 40 - BENTO_GAP) * (BENTO_LEFT_W / BENTO_W)),
    aspectRatio: 166 / 200,
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

  errorText: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 18,
    color: colors.error,
    textAlign: 'center',
  },

  devBypassText: {
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },

  termsText: {
    fontFamily: 'Inter',
    fontSize: 11,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '400',
  },

  termsLink: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  soonChip: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },

  soonText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },

  loginButton: {
    width: '100%',
    maxWidth: 350,
    height: 40,
    borderRadius: 8,
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

  devModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  devModalCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },

  devModalTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  devModalSubtitle: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  devInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 14,
    fontFamily: 'Inter',
    fontSize: 14,
    color: colors.textPrimary,
  },

  devModalRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 4,
  },

  devCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
  },

  devCancelText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  devConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
  },

  devConfirmText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
