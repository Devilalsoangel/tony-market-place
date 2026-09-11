import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';

const SECTIONS: Array<[string, string]> = [
  ['What we collect', 'Your phone number (account identity), profile details you enter, listings and orders you create, and messages you send. Location is used only to show nearby sellers when you allow it.'],
  ['What we never do', 'We never sell your data. Verification codes are stored as one-way hashes, expire in minutes, and are single-use. Passwords are salted hashes — nobody can read them back.'],
  ['Your control', 'Edit your name, bio and avatar any time from your profile. Your username is permanent because orders, chats and reviews reference it. To erase your account and data, contact support from the Help section.'],
  ['Security', 'Sessions expire automatically. Admin tools access only what support and safety require, and every admin action is audit-logged.'],
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 62 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: colors.primary, marginRight: 18 }}>
          Privacy Policy
        </Text>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {SECTIONS.map(([title, body]) => (
          <View key={title} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>{title}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
