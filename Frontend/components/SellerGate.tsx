import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../utils/theme';
import { sellerPendingReview, type PublishIdentity } from '../utils/marketplace';

// Shared seller gate (SELLER-C1): every seller tool screen renders this when
// the viewer is not an APPROVED seller — buyers/pending sellers can deep-link
// all they want, they get status + a path, never tools. Matches server 403s.
// Same copy contract as the create.tsx gate.
export default function SellerGate({ title, user }: { title: string; user: PublishIdentity | null | undefined }) {
  const pending = sellerPendingReview(user);
  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.surface, paddingBottom: 80 }}>
      <Text className="font-inter-700" style={{ fontSize: 18, lineHeight: 24, letterSpacing: 0.18, color: colors.textPrimary, textAlign: 'center' }}>
        {pending ? 'Verification under review' : title}
      </Text>
      <Text className="font-inter-400" style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
        {pending
          ? 'Our team is reviewing your documents. Seller tools unlock the moment you are approved.'
          : 'Create your seller profile to unlock this tool.'}
      </Text>
      {!pending && (
        <TouchableOpacity
          className="w-full h-14 rounded-figma-16 items-center justify-center mt-6"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => router.push('/become-seller')}
        >
          <Text className="font-inter-600" style={{ fontSize: 14, color: '#FFFFFF' }}>
            Become a seller
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
