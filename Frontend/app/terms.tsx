import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon } from '../utils/icons';
import { colors } from '../utils/theme';

const SECTIONS: Array<[string, string]> = [
  ['Marketplace', 'susej connects buyers with independent sellers. Every listing is posted by its seller, who is solely responsible for the item description, price, availability and fulfilment.'],
  ['Orders & payments', 'Pay by wallet or cash on delivery where offered. Wallet debits happen only when an order is placed; refunds return to the wallet and are recorded as ledger transactions you can inspect any time.'],
  ['Selling', 'Anyone may apply to sell. Selling tools unlock only after our team verifies your documents (KYC). A flat commission applies per delivered sale — no subscriptions, ever.'],
  ['Fair use', 'No counterfeit, prohibited or misrepresented items. Listings that break the rules are hidden and repeat offenders lose their store.'],
  ['Changes', 'We may update these terms as the marketplace grows. Material changes are announced in the app before they take effect.'],
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 62 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: colors.primary, marginRight: 18 }}>
          Terms of Service
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
