import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ChevronLeftIcon, PhoneIcon, VerifiedIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';
import { DEMO_ACCOUNTS } from '../utils/demoAccounts';

const OTP_LENGTH = 6;

// Demo OTP: the onboarding + login flows accept this fixed code (the admin
// panel 2FA uses the same code, so reviewers never get stuck).
const DEMO_OTP = '123456';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, completeOnboarding } = useAuth();
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

  const sendOtp = () => {
    if (phone.trim().length < 10) return;
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

  const handleVerify = async () => {
    if (!codeComplete || verifying) return;
    if (code.join('') !== DEMO_OTP) {
      setError(`Incorrect code. For this demo, use ${DEMO_OTP}.`);
      return;
    }
    setVerifying(true);
    setError('');
    try {
      // Resolve the identity from the phone number: demo accounts match their
      // registered phone; anything else becomes a fresh buyer account.
      const digits = phone.replace(/\D/g, '');
      const demo = DEMO_ACCOUNTS.find((a) => a.user.phone?.replace(/\D/g, '') === digits);
      await login(
        demo
          ? demo.user
          : { name: 'New User', username: `user${digits.slice(-4)}`, phone: phone.trim(), role: 'buyer' }
      );
      await completeOnboarding();
      router.replace('/(tabs)/feed');
    } finally {
      setVerifying(false);
    }
  };

  const enterDemo = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    await login(account.user);
    await completeOnboarding();
    router.replace('/(tabs)/feed');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-5" style={{ height: 52 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text className="flex-1 text-center font-inter-700" style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.primary }}>
            susej
          </Text>
          <View style={{ width: 18 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
          {/* Phone sign-in */}
          <View className="px-8 pt-4">
            <Text className="font-inter-700" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.56, color: colors.textPrimary }}>
              Welcome back
            </Text>
            <Text className="font-inter-400 mt-1 mb-6" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>
              Sign in with your phone number to continue.
            </Text>

            {!otpSent ? (
              <>
                <View className="flex-row items-center mb-5" style={{ gap: 8 }}>
                  <View className="h-14 px-4 rounded-figma-16 flex-row items-center" style={{ backgroundColor: colors.surfaceContainer }}>
                    <Text className="font-inter-400" style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
                      +91
                    </Text>
                    <Text style={{ fontSize: 10, marginLeft: 4, color: colors.textSecondary }}>▼</Text>
                  </View>
                  <View className="flex-1 h-14 px-4 rounded-figma-16 justify-center" style={{ backgroundColor: colors.surfaceContainer }}>
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
                <TouchableOpacity
                  className="w-full h-14 items-center justify-center rounded-figma-16 mb-2"
                  style={{ backgroundColor: phone.trim().length >= 10 ? colors.primary : 'rgba(93,95,239,0.2)' }}
                  disabled={phone.trim().length < 10}
                  onPress={sendOtp}
                >
                  <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: phone.trim().length >= 10 ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}>
                    Send OTP
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
                  We've sent a 6-digit code to +91 {phone}.
                </Text>
                {error ? (
                  <Text className="font-inter-500 mb-3" style={{ fontSize: 13, lineHeight: 18, color: colors.error }}>
                    {error}
                  </Text>
                ) : null}
                <View className="flex-row mb-5" style={{ gap: 8 }}>
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
                      keyboardType="number-pad"
                      maxLength={1}
                      caretHidden
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <TouchableOpacity
                  className="w-full h-14 items-center justify-center rounded-figma-16 mb-2"
                  style={{ backgroundColor: codeComplete && !verifying ? colors.primary : 'rgba(93,95,239,0.2)' }}
                  disabled={!codeComplete || verifying}
                  onPress={handleVerify}
                >
                  <Text className="font-inter-600" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: codeComplete && !verifying ? '#FFFFFF' : 'rgba(70,69,85,0.4)' }}>
                    {verifying ? 'Signing in...' : 'Sign in'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={resendIn > 0} onPress={sendOtp} className="items-center">
                  <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 18, color: resendIn > 0 ? colors.textSecondary : colors.primary }}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
                <Text className="font-inter-400 text-center mt-3" style={{ fontSize: 11, lineHeight: 15, color: colors.textTertiary }}>
                  Demo: any 10-digit number works — the code is always {DEMO_OTP}
                </Text>
              </>
            )}
          </View>

          {/* Demo POV switcher */}
          <View className="mt-8 px-5">
            <View className="flex-row items-center mb-1">
              <Text className="flex-1 font-inter-700" style={{ fontSize: 18, lineHeight: 26, color: colors.textPrimary }}>
                View as demo
              </Text>
              <Text className="font-inter-400" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                Tap any profile
              </Text>
            </View>
            <Text className="font-inter-400 mb-4" style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>
              Jump straight into any POV — one buyer and one seller per storefront category.
            </Text>

            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  activeOpacity={0.85}
                  onPress={() => enterDemo(acc)}
                  className="overflow-hidden"
                  style={{
                    width: (392 - 40 - 12) / 2,
                    borderRadius: 20,
                    backgroundColor: colors.surfaceContainerLowest,
                    shadowColor: colors.textPrimary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center px-3 pt-3" style={{ gap: 10 }}>
                    <Image
                      source={{ uri: `https://picsum.photos/seed/${acc.avatarSeed}/120/120` }}
                      style={{ width: 44, height: 44, borderRadius: 9999, backgroundColor: colors.surfaceContainer }}
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13, lineHeight: 16, flexShrink: 1 }} numberOfLines={1}>
                          {acc.label}
                        </Text>
                        {acc.user.isSeller ? <VerifiedIcon size={12} /> : null}
                      </View>
                      <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11, lineHeight: 14 }}>
                        {acc.categoryLabel}
                      </Text>
                    </View>
                  </View>
                  <View className="px-3 pb-3">
                    <View className="mt-2.5 self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }}>
                      <Text className="font-inter-500" style={{ fontSize: 10, lineHeight: 13, color: colors.primary }}>
                        {acc.user.isSeller ? 'Seller POV' : 'Buyer POV'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}