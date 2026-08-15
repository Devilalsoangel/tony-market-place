import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useAuth } from '../contexts/AuthContext';

function RowIcon({ path }: { path: string }) {
  return (
    <View
      className="w-10 h-10 rounded-full items-center justify-center"
      style={{ backgroundColor: 'rgba(67, 67, 213, 0.1)' }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.primaryContainer}>
        <Path d={path} />
      </Svg>
    </View>
  );
}

function PasswordInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      className="rounded-[12px] px-4 mb-3"
      style={{ height: 52, backgroundColor: colors.inputBg, fontFamily: 'Inter_400Regular', fontSize: 16, color: colors.textPrimary }}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

export default function PasswordSecurityScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  const savePassword = () => {
    if (!current.trim()) {
      setError('Enter your current password');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match');
      return;
    }
    setError('');
    setUpdated(true);
    Alert.alert('Password updated ✓', 'Your password has been changed successfully.');
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const signOutOthers = () => {
    Alert.alert(
      'Sign out other sessions?',
      'All other active sessions will be signed out. You will stay signed in on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => Alert.alert('Done', 'Other sessions signed out.') },
      ],
    );
  };

  const downloadData = () => {
    Alert.alert('Data export started', 'We are preparing your data. A download link will be emailed to you within 24 hours.');
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account, listings, and chat history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View className="flex-row items-center px-5" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-700 text-primary" style={{ fontSize: 20, lineHeight: 28 }}>
          Password &amp; Security
        </Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}>
        {/* Change Password */}
        <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
          CHANGE PASSWORD
        </Text>
        <View
          className="rounded-[16px] p-4 mb-8"
          style={{
            backgroundColor: colors.surface,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 3,
          }}
        >
          <PasswordInput placeholder="Current password" value={current} onChangeText={setCurrent} />
          <PasswordInput placeholder="New password (min 6 characters)" value={next} onChangeText={setNext} />
          <PasswordInput placeholder="Confirm new password" value={confirm} onChangeText={setConfirm} />
          {error !== '' && (
            <Text className="font-inter-400 mb-3" style={{ fontSize: 12, lineHeight: 18, color: colors.error }}>
              {error}
            </Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            className="items-center justify-center rounded-[12px]"
            style={{ height: 48, backgroundColor: colors.primaryContainer }}
            onPress={savePassword}
          >
            <Text className="font-inter-500" style={{ fontSize: 15, lineHeight: 20, color: colors.onPrimary }}>
              {updated ? 'Save another' : 'Save Password'}
            </Text>
          </TouchableOpacity>
          {updated && (
            <Text className="font-inter-500 text-center mt-3" style={{ fontSize: 12, lineHeight: 18, color: colors.success }}>
              Password updated ✓
            </Text>
          )}
        </View>

        {/* Two-Factor Authentication */}
        <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
          TWO-FACTOR AUTHENTICATION
        </Text>
        <View
          className="rounded-[16px] px-4 py-4 mb-8"
          style={{
            backgroundColor: colors.surface,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-4">
              <RowIcon path="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              <View className="ml-4 flex-1">
                <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                  SMS 2FA
                </Text>
                <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                  Send OTP to your phone
                </Text>
              </View>
            </View>
            <Switch
              value={twoFA}
              onValueChange={setTwoFA}
              trackColor={{ false: colors.secondaryContainer, true: colors.primaryContainer }}
              thumbColor={colors.surfaceContainerLowest}
            />
          </View>
        </View>

        {/* Login Security */}
        <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
          LOGIN SECURITY
        </Text>
        <View
          className="rounded-[16px] overflow-hidden mb-8"
          style={{
            backgroundColor: colors.surface,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center px-4" style={{ height: 72 }}>
            <RowIcon path="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM12 10h8v2h-8v-2zm0 4h8v2h-8v-2zm-4-6c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            <View className="ml-4 flex-1">
              <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                Last login
              </Text>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                2h ago · Pune
              </Text>
            </View>
          </View>
          <View className="mx-4" style={{ height: 1, backgroundColor: colors.surfaceContainerHigh, opacity: 0.3 }} />
          <TouchableOpacity className="flex-row items-center px-4" style={{ height: 72 }} onPress={signOutOthers}>
            <RowIcon path="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14.5c-.74-.77-1.8-1.27-3-1.27-2.21 0-4 1.79-4 4h-2c0-2.76 2.24-5 5-5 .92 0 1.79.26 2.56.7l-1.4 1.4-1.16-1.16c.44.55.7 1.22.7 1.96 0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm1-3.5c.21 0 .41.02.61.05C17.03 8.98 14.77 7 12 7c-1.38 0-2.5 1.12-2.5 2.5S10.62 12 12 12c.27 0 .53-.05.78-.12L10.7 13.95c.4.03.82.05 1.24.05 3.16 0 5.86-1.68 7.47-4.12.16.31.26.67.26 1.06 0 1.38-1.12 2.5-2.5 2.5z" />
            <View className="ml-4 flex-1">
              <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                Active sessions
              </Text>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                2 devices
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={signOutOthers}
              className="items-center justify-center rounded-[12px]"
              style={{ paddingHorizontal: 14, height: 36, backgroundColor: colors.primaryBg }}
            >
              <Text className="font-inter-500" style={{ fontSize: 13, lineHeight: 16, color: colors.primary }}>
                Sign out of others
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Data & Privacy */}
        <Text className="font-inter-500 text-textSecondary mb-3" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
          DATA &amp; PRIVACY
        </Text>
        <View
          className="rounded-[16px] overflow-hidden mb-8"
          style={{
            backgroundColor: colors.surface,
            shadowColor: colors.textPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 3,
          }}
        >
          <TouchableOpacity className="flex-row items-center px-4" style={{ height: 72 }} onPress={downloadData}>
            <RowIcon path="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
            <View className="ml-4 flex-1">
              <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 16, lineHeight: 24 }}>
                Download my data
              </Text>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                Export your posts, chats &amp; orders
              </Text>
            </View>
          </TouchableOpacity>
          <View className="mx-4" style={{ height: 1, backgroundColor: colors.surfaceContainerHigh, opacity: 0.3 }} />
          <TouchableOpacity className="flex-row items-center px-4" style={{ height: 72 }} onPress={deleteAccount}>
            <RowIcon path="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            <View className="ml-4 flex-1">
              <Text className="font-inter-500" style={{ fontSize: 16, lineHeight: 24, color: colors.error }}>
                Delete account
              </Text>
              <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>
                Permanently remove your account
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
