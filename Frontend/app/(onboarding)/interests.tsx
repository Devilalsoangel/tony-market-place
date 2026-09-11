import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, ArrowRightIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { interestImages } from '../../utils/screenImages';
import { useAuth } from '../../contexts/AuthContext';
import { serverApi } from '../../utils/serverApi';

const FALLBACK_INTERESTS = [
  'Fashion', 'Electronics', 'Real Estate', 'Food',
  'Beauty', 'Fitness', 'Travel', 'Automotive',
];

export default function InterestsScreen() {
  const { updateUser, completeOnboarding } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>(FALLBACK_INTERESTS);
  const hasMin = selected.length >= 3;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    serverApi.getCategories().then((r) => {
      if (!alive || !r.ok || !r.data?.categories?.length) return;
      const names = r.data.categories.map((c: any) => c.name).filter(Boolean);
      if (names.length >= 8) setAllInterests(names.slice(0, 12));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const toggle = (interest: string) => {
    setSelected((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5"
        style={{ height: 72 + insets.top, paddingTop: insets.top, backgroundColor: 'rgba(252,248,255,0.8)' }}
      >
        {/* Back button circle */}
        <TouchableOpacity
          className="items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 20 }}
          onPress={() => router.back()}
        >
          <ChevronLeftIcon size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Step counter */}
        <View className="flex-row items-center" style={{ gap: 2 }}>
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
          >
            Step 07
          </Text>
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.2)' }}
          >
            /
          </Text>
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
          >
            10
          </Text>
        </View>

        {/* Skip */}
        <TouchableOpacity
          onPress={() => {
            if (selected.length > 0) updateUser({ interests: selected });
            router.push('/(onboarding)/first-feed');
          }}
        >
          <Text
            className="font-inter-600"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.primary }}
          >
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false}>
        {/* Heading Section */}
        <View className="px-5 pt-4 pb-6">
          <Text
            className="font-inter-700 mb-2"
            style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.64, color: colors.textPrimary }}
          >
            What interests you?
          </Text>
          <Text
            className="font-inter-400"
            style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary }}
          >
            Pick at least 3 categories to personalize your{'\n'}feed and discover exclusive offers.
          </Text>
        </View>

        {/* Bento Grid - 2 columns, 169×160 each */}
        <View className="px-5">
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {allInterests.map((interest, i) => {
              const active = selected.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  className="rounded-figma-24 overflow-hidden"
                  style={{
                    width: 169,
                    height: 160,
                    backgroundColor: active ? 'rgba(93,95,239,0.08)' : '#efecff',
                    borderWidth: active ? 1.5 : 0,
                    borderColor: active ? colors.primaryContainer : 'transparent',
                  }}
                  onPress={() => toggle(interest)}
                >
                  {/* Visual zone (Figma category photo) */}
                  <View
                    className="w-full"
                    style={{ height: 114, backgroundColor: active ? colors.primaryContainer : '#e3dfff' }}
                  >
                    <Image source={interestImages[i]} className="w-full h-full" resizeMode="cover" />
                  </View>
                  {/* Label row */}
                  <View className="flex-row items-center px-3" style={{ height: 46 }}>
                    <View
                      className="w-5 h-5 rounded-full items-center justify-center mr-2"
                      style={{ backgroundColor: active ? colors.primaryContainer : '#dcdae0' }}
                    >
                      {active && (
                        <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}>✓</Text>
                      )}
                    </View>
                    <Text
                      className="font-inter-600 flex-1"
                      style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {interest}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="px-5 pt-4"
        style={{ paddingBottom: 32 + insets.bottom, backgroundColor: 'rgba(252,248,255,0.9)' }}
      >
        {/* Counter row */}
        <View className="flex-row items-center justify-between mb-3" style={{ height: 14 }}>
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textSecondary }}
          >
            {selected.length} selected
          </Text>
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.primary }}
          >
            {!hasMin ? `Select ${3 - selected.length} more` : 'Great choices!'}
          </Text>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          className="w-full flex-row items-center justify-center rounded-full"
          style={{
            height: 48,
            backgroundColor: hasMin ? colors.primaryContainer : 'rgba(93,95,239,0.2)',
          }}
          disabled={!hasMin}
          onPress={() => {
            updateUser({ interests: selected });
            completeOnboarding();
            router.push('/(onboarding)/first-feed');
          }}
        >
          <Text
            className="font-inter-600 mr-2"
            style={{
              fontSize: 14,
              lineHeight: 16,
              letterSpacing: 0.14,
              color: hasMin ? '#FFFFFF' : 'rgba(70,69,85,0.4)',
            }}
          >
            Continue
          </Text>
          <ArrowRightIcon
            size={10}
            color={hasMin ? '#FFFFFF' : 'rgba(70,69,85,0.4)'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
