import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [devHint, setDevHint] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const codeComplete = code.every((d) => d !== '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Industry standard (E.164): the selected country code is part of the
  // identity. Sending bare national digits made the picker decorative and
  // let two countries' identical digits collide into one account.
  const fullPhone = () => countryCode.replace(/\D/g, '') + phone.replace(/\D/g, '');

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid 10-digit phone number');
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

  // NOTE: the Verify button calls this as () => handleVerify() (never bare
  // onPress={handleVerify}) — the press event must not land in codeOverride.
  const handleVerify = async (codeOverride?: string) => {
    const finalCode = typeof codeOverride === 'string' ? codeOverride : otpCode;
    if (finalCode.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError('');
    try {
      // Server-first login — real user row on the shared backend.
      const res = await serverLogin(fullPhone(), finalCode);
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
              style={{ backgroundColor: phone.replace(/\D/g, '').length >= 10 && !sending ? colors.primary : 'rgba(93,95,239,0.2)' }}
              onPress={handleSendOtp}
              disabled={sending}
            >
              <Text
                className="font-inter-600"
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: phone.replace(/\D/g, '').length >= 10 && !sending ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}
              >
                {sending ? 'Sending...' : 'Send OTP'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* OTP Code Boxes */}
            {error ? (
              <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                {error}
              </Text>
            ) : null}
            <View className="flex-row mb-6" style={{ gap: 8 }}>
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
