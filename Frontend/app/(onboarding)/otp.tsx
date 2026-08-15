import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeftIcon, PhoneIcon, LockArrowIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';

const OTP_LENGTH = 6;

// Demo OTP — same fixed code as login.tsx and the admin panel 2FA.
const DEMO_OTP = '123456';

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const inputsRef = useRef<(TextInput | null)[]>([]);

  const codeComplete = code.every((d) => d !== '');

  useEffect(() => {
    if (!otpSent) return;
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 200);
    return () => clearTimeout(t);
  }, [otpSent]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSendOtp = () => {
    updateUser({ phone: phone.trim() });
    setCode(Array(OTP_LENGTH).fill(''));
    setError('');
    setResendIn(30);
    setOtpSent(true);
  };

  const handleChangeDigit = (i: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (error) setError('');
    if (digit && i < OTP_LENGTH - 1) {
      inputsRef.current[i + 1]?.focus();
    }
  };

  const handleKeyPress = (i: number, key: string) => {
    if (key === 'Backspace' && !code[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handleResend = () => {
    setCode(Array(OTP_LENGTH).fill(''));
    setError('');
    setResendIn(30);
    inputsRef.current[0]?.focus();
  };

  const handleVerify = async () => {
    if (!codeComplete || verifying) return;
    if (code.join('') !== DEMO_OTP) {
      setError(`Incorrect code. For this demo, use ${DEMO_OTP}.`);
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await login({ name: 'New User', username: 'user', phone: phone.trim() });
      router.push('/(onboarding)/location');
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
            ? `We've sent a verification code to\n+91 ${phone || 'your number'}.`
            : "We'll send a 6-digit verification code to\nsecure your account."}
        </Text>

        {!otpSent ? (
          <>
            {/* Phone Input Row */}
            <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
              {/* Country Code */}
              <View
                className="h-14 px-4 rounded-figma-16 flex-row items-center"
                style={{ backgroundColor: colors.surfaceContainer }}
              >
                <Text
                  className="font-inter-400"
                  style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}
                >
                  +91
                </Text>
                <Text style={{ fontSize: 10, marginLeft: 4, color: colors.textSecondary }}>▼</Text>
              </View>
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

            {/* Send OTP Button */}
            <TouchableOpacity
              className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-8"
              style={{ backgroundColor: colors.primary }}
              onPress={handleSendOtp}
            >
              <Text
                className="font-inter-600"
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
              >
                Send OTP
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
                <TextInput
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  className="flex-1 h-14 rounded-figma-16 font-inter-600"
                  style={{
                    backgroundColor: colors.surfaceContainer,
                    textAlign: 'center',
                    fontSize: 20,
                    lineHeight: 24,
                    color: colors.textPrimary,
                    borderWidth: d ? 1.5 : 0,
                    borderColor: d ? colors.primaryContainer : 'transparent',
                  }}
                  value={d}
                  onChangeText={(t) => handleChangeDigit(i, t)}
                  onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  caretHidden
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                />
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-5"
              style={{
                backgroundColor: codeComplete && !verifying ? colors.primary : 'rgba(93,95,239,0.2)',
              }}
              disabled={!codeComplete || verifying}
              onPress={handleVerify}
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
            <Text
              className="font-inter-400 text-center mt-3"
              style={{ fontSize: 11, lineHeight: 15, color: colors.textTertiary }}
            >
              Demo: the code is always {DEMO_OTP}
            </Text>
          </>
        )}

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
              SECURED BY AES-256 ENCRYPTION
            </Text>
          </View>
          {/* Pagination dots - step 3 of 6 */}
          <View className="flex-row gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: i < 3 ? colors.primaryContainer : 'rgba(26,26,46,0.08)' }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
