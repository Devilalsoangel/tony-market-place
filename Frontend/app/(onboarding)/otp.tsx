import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeftIcon, PhoneIcon, LockArrowIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';
import { serverApi, transportMessage } from '../../utils/serverApi';

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

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser, login, serverLogin } = useAuth();
  // Prefill when sign-in redirects an unknown number here (params phone/cc).
  // Sanitized: digits only, cc must be a known picker code, else defaults.
  const entryParams = useLocalSearchParams<{ phone?: string | string[]; cc?: string | string[] }>();
  const prefillPhone = (() => {
    const raw = Array.isArray(entryParams.phone) ? entryParams.phone[0] : entryParams.phone;
    const digits = (raw ?? '').replace(/\D/g, '');
    return digits ? digits : '';
  })();
  const prefillCc = (() => {
    const raw = Array.isArray(entryParams.cc) ? entryParams.cc[0] : entryParams.cc;
    return raw && COUNTRIES.some((c) => c.code === raw) ? raw : '+91';
  })();
  const [phone, setPhone] = useState(prefillPhone);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [devHint, setDevHint] = useState('');
  const [countryCode, setCountryCode] = useState(prefillCc);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const codeComplete = code.every((d) => d !== '');
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Industry standard (E.164): the selected country code is part of the
  // identity. Sending bare national digits made the picker decorative and
  // let two countries' identical digits collide into one account.
  // FIX Sep 15 (user 911556848908 -> user8908 ghost): users paste the full
  // number including the country code (e.g. 911556848908 for +91). Without
  // stripping, fullPhone double-counts the country (91+911556848908 = 14
  // digits) and spawns a duplicate account. Strip a leading country code
  // (+ optional trunk 0 for +91) and validate — never silently slice a
  // longer string; >10 warns instead (same guard as login.tsx).
  const nationalDigits = () => {
    const cc = countryCode.replace(/\D/g, '');
    let digits = phone.replace(/\D/g, '');
    // Single strip each: cc once, then one trunk 0 for +91. A second cc
    // (14-digit 91+911556848908) must NOT strip again — it warns instead.
    if (cc && digits.startsWith(cc) && digits.length > cc.length) digits = digits.slice(cc.length);
    if (cc === '91' && digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
    return digits;
  };
  // +91 needs exactly 10 national digits; other codes keep a 6–12 window
  // (server needs ≥10 total digits including cc and 400s the rest).
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

  const handleSendOtp = async () => {
    // Length guard FIRST: >10 (or <10 for +91) warns and never sends.
    if (!isPhoneValid()) {
      setError(phoneWarn());
      return;
    }
    const full = fullPhone();
    updateUser({ phone: full });
    setError('');
    setSending(true);
    try {
      // Real server-side code issuance (hashed, expiring, single-use).
      const res = await serverApi.sendOtp(full);
      if (!res.ok) {
        setError(transportMessage(res.error, 'try again'));
        return;
      }
      // Dev-mode convenience: the SERVER decides whether a hint may be
      // shown (AUTH_DEV_MODE=1). Each request gets its own random code —
      // the app displays exactly what the server returned for this phone.
      setDevHint(res.data?.devCode ? `Dev code: ${res.data.devCode}` : '');
      setCode(Array(OTP_LENGTH).fill(''));
      setResendIn(45); // match server RESEND_COOLDOWN_MS (45s)
      setOtpSent(true);
    } catch (e) {
      setError('Could not send the code. Check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    while (digits.length < OTP_LENGTH) digits.push('');
    setCode(digits);
    if (error) setError('');
    // Auto-submit once all 6 digits are entered (industry standard). Pass the
    // fresh digits explicitly: handleVerify reads state, which is still the
    // previous render's value inside this handler (stale closure = the 6th
    // digit never auto-submitted, only the manual button worked).
    if (text.replace(/\D/g, '').length === OTP_LENGTH) {
      const freshCode = digits.join('');
      setTimeout(() => { handleVerify(freshCode); }, 150);
    }
  };

  const otpCode = code.join('');

  const handleResend = () => {
    handleSendOtp();
  };

  // Dev bypass: send OTP + auto-verify in one tap (dev mode only)
  const devBypassOtp = async () => {
    if (devBypassing) return;
    if (!isPhoneValid()) {
      setError(phoneWarn());
      return;
    }
    setDevBypassing(true);
    setError('');
    try {
      const full = fullPhone();
      const res = await serverApi.sendOtp(full);
      if (res.ok && res.data?.devCode) {
        // Signup screen: explicit creation consent.
        const verifyRes = await serverLogin(full, res.data.devCode, { create: true });
        if (verifyRes.ok) {
          router.push('/(onboarding)/location');
        } else {
          setError('Dev bypass failed');
        }
      } else {
        setError('Dev bypass unavailable — server did not return a code (needs AUTH_DEV_MODE=1)');
      }
    } catch (e) {
      setError('Dev bypass failed. Check connection.');
    } finally {
      setDevBypassing(false);
    }
  };

  // NOTE: the Verify button calls this as () => handleVerify() (never bare
  // onPress={handleVerify}) — the press event must not land in codeOverride.
  const handleVerify = async (codeOverride?: string) => {
    const finalCode = typeof codeOverride === 'string' ? codeOverride : otpCode;
    if (finalCode.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError('');
    try {
      // Server-first signup — explicit create:true (this is the signup
      // screen). Sign-in typos elsewhere get needsSignup, never ghosts.
      const res = await serverLogin(fullPhone(), finalCode, { create: true });
      if (res.ok) {
        router.push('/(onboarding)/location');
      } else {
        setError(transportMessage(res.error, 'try again'));
      }
    } catch (e) {
      setError('Sign-in is unavailable. Try again once you are back online.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header - Top Navigation */}
      <View className="flex-row items-center px-5" style={{ height: 72 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text
          className="flex-1 text-center font-inter-700"
          style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, marginRight: 18, color: colors.primary }}
        >
          susej
        </Text>
      </View>

      <View className="flex-1 px-8">
        {/* Icon Section - Phone */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(93,95,239,0.1)' }}>
            <PhoneIcon size={24} color={colors.primary} />
          </View>
        </View>

        {/* Heading */}
        <Text
          className="font-inter-700 mb-2"
          style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.64, color: colors.textPrimary }}
        >
          {otpSent ? 'Enter the 6-digit code' : 'Enter your phone\nnumber'}
        </Text>

        {/* Subtitle */}
        <Text
          className="font-inter-400 mb-8"
          style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}
        >
          {otpSent
            ? `We've sent a verification code to\n${countryCode} ${phone || 'your number'}.`
            : "We'll send a 6-digit verification code to\nsecure your account."}
        </Text>

        {!otpSent ? (
          <>
            {/* Phone Input Row */}
            <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
              {/* Country Code */}
              <TouchableOpacity
                className="h-14 px-4 rounded-figma-16 flex-row items-center"
                style={{ backgroundColor: colors.surfaceContainer }}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text
                  className="font-inter-400"
                  style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}
                >
                  {countryCode}
                </Text>
                <Text style={{ fontSize: 10, marginLeft: 4, color: colors.textSecondary }}>▼</Text>
              </TouchableOpacity>
              {/* Phone Input */}
              <View
                className="flex-1 h-14 px-4 rounded-figma-16 justify-center"
                style={{ backgroundColor: colors.surfaceContainer }}
              >
                <TextInput
                  className="font-inter-400"
                  style={{ fontSize: 16, color: colors.textPrimary }}
                  placeholder="98765 43210"
                  placeholderTextColor="rgba(70,69,85,0.4)"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {error && !otpSent ? (
              <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                {error}
              </Text>
            ) : null}
            {/* Send OTP Button */}
            <TouchableOpacity
              className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-8"
              style={{ backgroundColor: isPhoneValid() && !sending ? colors.primary : 'rgba(93,95,239,0.2)' }}
              onPress={handleSendOtp}
              disabled={sending}
            >
              <Text
                className="font-inter-600"
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: isPhoneValid() && !sending ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}
              >
                {sending ? 'Sending...' : 'Send OTP'}
              </Text>
            </TouchableOpacity>
            {/* Dev bypass: one-tap login (dev mode only) */}
            {__DEV__ && (
              <TouchableOpacity
                className="w-full h-12 items-center justify-center rounded-figma-16"
                style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
                onPress={devBypassOtp}
                disabled={!isPhoneValid() || devBypassing}
              >
                <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: '#22c55e' }}>
                  {devBypassing ? 'Logging in...' : 'Dev: Login instantly'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* OTP Code Boxes */}
            {error ? (
              <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                {error}
              </Text>
            ) : null}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => otpInputRef.current?.focus()}
              className="flex-row mb-6"
              style={{ gap: 8 }}
            >
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
            </TouchableOpacity>
            <TextInput
              ref={otpInputRef}
              value={otpCode}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              caretHidden
              autoFocus={otpSent}
              className="absolute opacity-0"
              style={{ width: 1, height: 1 }}
              textContentType="oneTimeCode"
            />

            {/* Verify Button */}
            <TouchableOpacity
              className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-5"
              style={{
                backgroundColor: codeComplete && !verifying ? colors.primary : 'rgba(93,95,239,0.2)',
              }}
              disabled={!codeComplete || verifying}
              onPress={() => handleVerify()}
            >
              <Text
                className="font-inter-600"
                style={{
                  fontSize: 14,
                  lineHeight: 16,
                  letterSpacing: 0.14,
                  color: codeComplete && !verifying ? '#FFFFFF' : 'rgba(70,69,85,0.4)',
                }}
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </Text>
            </TouchableOpacity>

            {/* Resend */}
            <View className="flex-row items-center justify-center">
              <Text
                className="font-inter-400"
                style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}
              >
                Didn't get the code?{' '}
              </Text>
              <TouchableOpacity disabled={resendIn > 0} onPress={handleResend}>
                <Text
                  className="font-inter-600"
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    color: resendIn > 0 ? colors.textSecondary : colors.primary,
                  }}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend'}
                </Text>
              </TouchableOpacity>
            </View>
            {devHint && !error ? (
              <Text
                className="font-inter-500 text-center mt-3"
                style={{ fontSize: 12, lineHeight: 16, color: colors.tertiary }}
              >
                {devHint}
              </Text>
            ) : null}
            {/* Dev bypass: one-tap verify (always visible for testing) */}
            <TouchableOpacity
              className="w-full h-12 items-center justify-center rounded-figma-16 mt-4"
              style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
              onPress={devBypassOtp}
              disabled={devBypassing}
            >
              <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: '#22c55e' }}>
                {devBypassing ? 'Logging in...' : 'Dev: Login instantly'}
              </Text>
            </TouchableOpacity>
          </>
        )}

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

        {/* Spacer */}
        <View className="flex-1" />

        {/* Footer - Security Notice + Dots */}
        <View className="items-center" style={{ paddingBottom: 32 + insets.bottom }}>
          <View className="flex-row items-center mb-3">
            <LockArrowIcon size={14} color="rgba(70,69,85,0.4)" />
            <Text
              className="font-inter-500 ml-2"
              style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.6, color: 'rgba(70,69,85,0.4)' }}
            >
              YOUR DATA IS ENCRYPTED IN TRANSIT
            </Text>
          </View>
            {/* Pagination dots - step 3 (phone) or 4 (OTP sent) of 7 */}
            <View className="flex-row gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <View
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: i < (otpSent ? 4 : 3) ? colors.primaryContainer : 'rgba(26,26,46,0.08)' }}
                />
              ))}
          </View>
        </View>
      </View>
    </View>
  );
}
