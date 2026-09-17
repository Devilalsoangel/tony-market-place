import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ChevronLeftIcon } from '../utils/icons';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { serverApi, transportMessage } from '../utils/serverApi';

const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
];

const OTP_LENGTH = 6;

function ChevronDownIcon({ size = 12, color = '#5c5e63' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8" fill="none">
      <Path d="M0 2L4 6L8 2L7.2 1.2L4 4.4L0.8 1.2L0 2Z" fill={color} />
    </Svg>
  );
}

type AuthMode = 'phone' | 'email';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { serverLogin, serverEmailLogin, completeOnboarding } = useAuth();
  const [mode, setMode] = useState<AuthMode>('phone');
  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [needsSignup, setNeedsSignup] = useState(false);
  const [devHint, setDevHint] = useState('');
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailRegister, setEmailRegister] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const codeComplete = code.every((d) => d !== '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Industry standard (E.164): the selected country code is part of the
  // identity — never send bare national digits (see onboarding otp.tsx).
  // FIX Sep 15 (tony 911556848908 -> user8908 ghost): users paste the full
  // number including the country code. Strip a leading cc (+ optional trunk
  // 0 for +91) and validate — never silently slice a longer string, because
  // silent slicing is what masked the original double-country ghost.
  const nationalDigits = () => {
    const cc = countryCode.replace(/\D/g, '');
    let digits = phone.replace(/\D/g, '');
    // Single strip each: cc once, then one trunk 0 for +91. A second cc
    // (14-digit 91+911556848908) must NOT strip again — it warns instead.
    if (cc && digits.startsWith(cc) && digits.length > cc.length) digits = digits.slice(cc.length);
    if (cc === '91' && digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
    return digits;
  };
  // +91 needs exactly 10 national digits — longer/shorter warns instead of
  // sending (a >10 entry is a typo or double-cc paste, not a valid number).
  // Other country codes keep a permissive 6–12 window (server needs ≥10
  // total digits including the cc and rejects the rest with a clear 400).
  const isPhoneValid = () => {
    const national = nationalDigits();
    if (countryCode.replace(/\D/g, '') === '91') return national.length === 10;
    return national.length >= 6 && national.length <= 12;
  };
  const phoneWarn = () =>
    countryCode.replace(/\D/g, '') === '91'
      ? 'Enter a valid 10-digit mobile number'
      : 'Enter a valid mobile number';
  const fullPhone = () => countryCode.replace(/\D/g, '') + nationalDigits();

  const [devBypassing, setDevBypassing] = useState(false);

  const requestOtp = async () => {
    if (sending) return;
    // Length guard FIRST: >10 (or <10) national digits warns and never
    // sends — the typo can never reach OTP, let alone mint anything.
    if (!isPhoneValid()) {
      setError(phoneWarn());
      return;
    }
    setSending(true);
    setError('');
    try {
      const full = fullPhone();
      // Industry split: check the account BEFORE burning an OTP. Unknown
      // number → signup flow with the number prefilled (no OTP sent here,
      // nothing minted). Known → OTP boxes as usual.
      try {
        const check = await serverApi.checkPhone(full);
        if (check.ok && check.data && !check.data.exists) {
          router.push({ pathname: '/(onboarding)/otp', params: { phone: nationalDigits(), cc: countryCode } });
          return;
        }
        // Check unreachable/throttled → fail OPEN to send-OTP: verify still
        // guards creation (404 needsSignup), so this never mints ghosts.
      } catch {
        // Probe threw (shouldn't — request() catches) → same fail-open.
      }
      const res = await serverApi.sendOtp(full);
      if (res.ok) {
        setCode(Array(OTP_LENGTH).fill(''));
        setResendIn(45); // match server RESEND_COOLDOWN_MS (45s)
        setOtpSent(true);
        // Dev-mode convenience: the SERVER decides whether a hint may be
        // shown (AUTH_DEV_MODE=1). Each request gets its own random code —
        // the app displays exactly what the server returned for this phone.
        setDevHint(res.data?.devCode ? `Dev code: ${res.data.devCode}` : '');
      } else {
        setError(transportMessage(res.error, 'try again'));
      }
    } catch (e) {
      setError('Could not send the code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Dev bypass: send OTP + auto-verify in one tap (dev mode only)
  const devBypassLogin = async () => {
    if (devBypassing) return;
    if (!isPhoneValid()) {
      setError(phoneWarn());
      return;
    }
    setDevBypassing(true);
    setError('');
    try {
      const res = await serverApi.sendOtp(fullPhone());
      if (res.ok && res.data?.devCode) {
        const verifyRes = await serverLogin(fullPhone(), res.data.devCode);
        if (verifyRes.ok) {
          await completeOnboarding();
          router.replace('/(tabs)/feed');
        } else if (verifyRes.needsSignup) {
          // Unknown number even in dev → signup flow, same as requestOtp.
          router.push({ pathname: '/(onboarding)/otp', params: { phone: nationalDigits(), cc: countryCode } });
        } else {
          setError(transportMessage(verifyRes.error, 'Dev bypass failed'));
        }
      } else {
        setError('Dev bypass unavailable — no devCode returned');
      }
    } catch (e) {
      setError('Dev bypass failed. Check connection.');
    } finally {
      setDevBypassing(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    while (digits.length < OTP_LENGTH) digits.push('');
    setCode(digits);
    if (error) setError('');
    if (needsSignup) setNeedsSignup(false);
    // Auto-submit once all 6 digits are entered (industry standard). Pass the
    // fresh digits explicitly — state is stale inside this handler, so the
    // 6th digit never auto-submitted (only the manual button worked).
    if (text.replace(/\D/g, '').length === OTP_LENGTH) {
      const freshCode = digits.join('');
      setTimeout(() => { handleVerify(freshCode); }, 150);
    }
  };

  const otpCode = code.join('');

  // NOTE: the Sign in button calls this as () => handleVerify() (never bare
  // onPress={handleVerify}) — the press event must not land in codeOverride.
  const handleVerify = async (codeOverride?: string) => {
    const finalCode = typeof codeOverride === 'string' ? codeOverride : otpCode;
    if (finalCode.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError('');
    setNeedsSignup(false);
    try {
      // Sign-in only: no create flag, so an unknown/typo'd number gets 404
      // needsSignup — never a silently minted ghost account.
      const res = await serverLogin(fullPhone(), finalCode);
      if (res.ok) {
        await completeOnboarding();
        router.replace('/(tabs)/feed');
      } else if (res.error) {
        setError(transportMessage(res.error, 'try again'));
        if (res.needsSignup) setNeedsSignup(true);
      } else {
        Alert.alert('Sign-in unavailable', 'Sign-in is unavailable offline. Please try again once you are back online.');
      }
    } catch (e) {
      // Network abort/timeout must never crash to the root screen.
      setError('Sign-in is unavailable. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleEmailAuth = async () => {
    if (verifying) return;
    setVerifying(true);
    setError('');
    try {
      const res = await serverEmailLogin(emailRegister ? 'register' : 'login', email, password, name);
      if (res.ok) {
        await completeOnboarding();
        router.replace('/(tabs)/feed');
      } else if (res.error) {
        setError(res.error);
      } else {
        Alert.alert('Sign-in unavailable', 'Sign-in is unavailable offline. Please try again once you are back online.');
      }
    } catch (e) {
      // Network abort/timeout must never crash to the root screen.
      setError('Sign-in is unavailable. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-5" style={{ height: 52 }}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
            susej
          </Text>
          <View style={{ width: 18 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
          <View className="px-8 pt-4">
            <Text className="font-inter-700" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.56, color: colors.textPrimary }}>
              Welcome back
            </Text>
            <Text className="font-inter-400 mt-1 mb-5" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              Sign in to continue to the marketplace.
            </Text>

            {/* Phone / Email switch */}
            <View className="flex-row mb-6 rounded-figma-16 p-1" style={{ backgroundColor: colors.surfaceContainer }}>
              {(['phone', 'email'] as AuthMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  className="flex-1 h-10 items-center justify-center rounded-figma-12"
                  style={{ backgroundColor: mode === m ? colors.surfaceContainerLowest : 'transparent' }}
                  onPress={() => { setMode(m); setError(''); }}
                >
                  <Text className="font-inter-600 capitalize" style={{ fontSize: 13, lineHeight: 18, color: mode === m ? colors.textPrimary : colors.textSecondary }}>
                    {m === 'phone' ? 'Phone' : 'Email'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'phone' ? (
              !otpSent ? (
                <>
                    <View className="flex-row items-center mb-5" style={{ gap: 8 }}>
                    <TouchableOpacity className="h-14 px-4 rounded-figma-16 flex-row items-center" style={{ backgroundColor: colors.surfaceContainer }} onPress={() => setShowCountryPicker(true)}>
                      <Text className="font-inter-400" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                        {countryCode}
                      </Text>
                      <View style={{ marginLeft: 4 }}>
                        <ChevronDownIcon size={12} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                    <View className="flex-1 h-14 px-4 rounded-figma-16 justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
                      <TextInput
                        className="font-inter-400"
                        style={{ fontSize: 16, color: colors.textPrimary }}
                        placeholder="98765 43210"
                        placeholderTextColor="rgba(70,69,85,0.4)"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={(t) => { setPhone(t); if (error) setError(''); if (needsSignup) setNeedsSignup(false); }}
                      />
                    </View>
                  </View>
                  {error ? (
                    <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                      {error}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    className="w-full h-14 items-center justify-center rounded-figma-16 mb-2"
                    style={{ backgroundColor: isPhoneValid() && !sending ? colors.primary : 'rgba(93,95,239,0.2)' }}
                    onPress={requestOtp}
                    disabled={sending}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: isPhoneValid() && !sending ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}>
                      {sending ? 'Sending...' : 'Send code'}
                    </Text>
                  </TouchableOpacity>
                  <Text className="font-inter-400 text-center mb-2" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                    New here?{' '}
                    <Text className="font-inter-600" style={{ color: colors.primary }} onPress={() => router.replace('/(onboarding)/auth')}>
                      Create an account
                    </Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-inter-400 mb-5" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
                    We've sent a 6-digit code to {countryCode} {phone}.
                  </Text>
                  {devHint && !error ? (
                    <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.tertiary }}>
                      {devHint}
                    </Text>
                  ) : null}
                  {error ? (
                    <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                      {error}
                    </Text>
                  ) : null}
                  {needsSignup ? (
                    <TouchableOpacity className="mb-3 items-center" onPress={() => router.replace('/(onboarding)/auth')}>
                      <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: colors.primary }}>
                        No account yet? Create one
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <View className="flex-row mb-5" style={{ gap: 8 }}>
                    {code.map((d, i) => (
                      <View
                        key={i}
                        className="flex-1 h-14 rounded-figma-16 items-center justify-center"
                        style={{
                          backgroundColor: colors.surfaceContainer,
                          borderWidth: d ? 1.5 : 0,
                          borderColor: d ? colors.primaryContainer : 'transparent',
                        }}
                      >
                        <Text className="font-inter-600" style={{ fontSize: 20, lineHeight: 24, color: colors.textPrimary }}>
                          {d}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    value={otpCode}
                    onChangeText={handleOtpChange}
                    keyboardType="number-pad"
                    maxLength={6}
                    caretHidden
                    autoFocus={otpSent}
                    className="absolute opacity-0"
                    style={{ width: 1, height: 1, top: -9999 }}
                  />
                  <TouchableOpacity
                    className="w-full h-14 items-center justify-center rounded-figma-16 mb-2"
                    style={{ backgroundColor: codeComplete && !verifying ? colors.primary : 'rgba(93,95,239,0.2)' }}
                    disabled={!codeComplete || verifying}
                    onPress={() => handleVerify()}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: codeComplete && !verifying ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}>
                      {verifying ? 'Signing in...' : 'Sign in'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={resendIn > 0} onPress={requestOtp} className="items-center">
                    <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: resendIn > 0 ? colors.textSecondary : colors.primary }}>
                      {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                  {/* Dev bypass: one-tap login (dev builds only — the server
                      gate holds in prod regardless, but prod builds must not
                      render the dead button). */}
                  {__DEV__ ? (
                  <TouchableOpacity
                    className="w-full h-12 items-center justify-center rounded-figma-16 mt-4"
                    style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
                    onPress={devBypassLogin}
                    disabled={!isPhoneValid() || devBypassing}
                  >
                    <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: '#22c55e' }}>
                      {devBypassing ? 'Logging in...' : 'Dev: Login instantly'}
                    </Text>
                  </TouchableOpacity>
                  ) : null}
                </>
              )
            ) : (
              <>
                {emailRegister ? (
                  <TextInput
                    className="h-14 px-4 rounded-figma-16 font-inter-400 mb-3"
                    style={{ backgroundColor: colors.surfaceContainer, fontSize: 15, color: colors.textPrimary }}
                    placeholder="Full name"
                    placeholderTextColor="rgba(70,69,85,0.4)"
                    value={name}
                    onChangeText={(t) => { setName(t); if (error) setError(''); }}
                    autoCapitalize="words"
                  />
                ) : null}
                <TextInput
                  className="h-14 px-4 rounded-figma-16 font-inter-400 mb-3"
                  style={{ backgroundColor: colors.surfaceContainer, fontSize: 15, color: colors.textPrimary }}
                  placeholder="Email address"
                  placeholderTextColor="rgba(70,69,85,0.4)"
                  value={email}
                  onChangeText={(t) => { setEmail(t); if (error) setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  className="h-14 px-4 rounded-figma-16 font-inter-400 mb-2"
                  style={{ backgroundColor: colors.surfaceContainer, fontSize: 15, color: colors.textPrimary }}
                  placeholder={emailRegister ? 'Create a password (min 8 characters)' : 'Password'}
                  placeholderTextColor="rgba(70,69,85,0.4)"
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
                  secureTextEntry
                />
                {error ? (
                  <Text className="font-inter-500 mb-3 mt-2" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                    {error}
                  </Text>
                ) : null}
                <TouchableOpacity
                  className="w-full h-14 items-center justify-center rounded-figma-16 mb-3"
                  style={{
                    backgroundColor:
                      email.includes('@') && password.length >= 8 && (!emailRegister || name.trim().length >= 2) && !verifying
                        ? colors.primary
                        : 'rgba(93,95,239,0.2)',
                  }}
                  disabled={!email.includes('@') || password.length < 8 || (emailRegister && name.trim().length < 2) || verifying}
                  onPress={handleEmailAuth}
                >
                  <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: email.includes('@') && password.length >= 8 && (!emailRegister || name.trim().length >= 2) && !verifying ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}>
                    {verifying ? 'Please wait...' : emailRegister ? 'Create account' : 'Sign in'}
                  </Text>
                </TouchableOpacity>
                <Text className="font-inter-400 text-center" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                  {emailRegister ? 'Already have an account? ' : 'New here? '}
                  <Text className="font-inter-600" style={{ color: colors.primary }} onPress={() => { setEmailRegister(!emailRegister); setError(''); }}>
                    {emailRegister ? 'Sign in' : 'Create an account'}
                  </Text>
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 380, paddingTop: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant, alignSelf: 'center', marginBottom: 12 }} />
            <Text className="font-inter-600" style={{ fontSize: 16, textAlign: 'center', marginBottom: 12, color: colors.textPrimary }}>Select country</Text>
            <FlatList data={COUNTRIES} keyExtractor={(i) => i.code} renderItem={({ item }) => (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, backgroundColor: countryCode === item.code ? colors.surfaceContainer : 'transparent' }} onPress={() => { setCountryCode(item.code); setShowCountryPicker(false); }}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>{item.flag}</Text>
                <Text className="font-inter-400" style={{ flex: 1, fontSize: 15, color: colors.textPrimary }}>{item.name}</Text>
                <Text className="font-inter-600" style={{ fontSize: 15, color: colors.textPrimary }}>{item.code}</Text>
              </TouchableOpacity>
            )} />
            <View style={{ height: 24 }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

