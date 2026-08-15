import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowRightIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function FirstFeedScreen() {
  const { setHasSeenFeedWelcome, completeOnboarding } = useAuth();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Simple header — just susej branding, no home feed icons */}
      <View className="items-center pt-16 pb-4">
        <Text
          className="font-inter-700"
          style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.7, color: colors.primary }}
        >
          susej
        </Text>
      </View>

      {/* Welcome content */}
      <View className="flex-1 justify-center px-8" style={{ gap: 16 }}>
        <Text
          className="font-inter-700 text-center"
          style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.56, color: colors.textPrimary }}
        >
          You're all set!
        </Text>
        <Text
          className="font-inter-400 text-center"
          style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}
        >
          Your feed is ready. Start exploring products from sellers near you.
        </Text>
      </View>

      {/* Start Exploring button */}
      <View className="px-8 pb-12">
        <TouchableOpacity
          className="w-full h-14 flex-row items-center justify-center rounded-figma-16"
          style={{ backgroundColor: colors.primaryContainer }}
          onPress={() => {
            completeOnboarding();
            setHasSeenFeedWelcome();
            router.replace('/(tabs)/feed');
          }}
        >
          <Text
            className="font-inter-600 mr-2"
            style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: '#FFFFFF' }}
          >
            Start Exploring
          </Text>
          <ArrowRightIcon size={10} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
