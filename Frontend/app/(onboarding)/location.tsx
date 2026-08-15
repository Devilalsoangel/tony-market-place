import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, SearchIcon, GpsTargetIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';
import { locationMapImage } from '../../utils/screenImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const cities = [
  { name: 'Bangalore' },
  { name: 'Mumbai' },
  { name: 'Delhi' },
  { name: 'Goa' },
];

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { updateUser } = useAuth();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between h-[62px] px-5"
        style={{ backgroundColor: colors.surface, height: 62 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <ChevronLeftIcon size={18} color={colors.primary} />
        </TouchableOpacity>
        {/* Step indicators - 4 of 6 */}
        <View className="flex-row gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: i < 4 ? colors.primaryContainer : 'rgba(26,26,46,0.08)' }}
            />
          ))}
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" bounces={false} showsVerticalScrollIndicator={false}>
        {/* Map / Hero Section */}
        <View className="w-full h-[240px] items-center justify-center" style={{ backgroundColor: '#efecff' }}>
          {/* Figma map image */}
          <Image source={locationMapImage} className="absolute w-full h-full" resizeMode="cover" />
          {/* Map Pin Icon */}
          <View className="items-center">
            <View
              className="w-[56px] h-[56px] rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <GpsTargetIcon size={24} color="#FFFFFF" />
            </View>
            {/* Pin point below */}
            <View
              className="w-2 h-2 rounded-full mt-2"
              style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
            />
          </View>
        </View>

        {/* Content Area */}
        <View className="px-5 pt-8">
          {/* Heading */}
          <Text
            className="font-inter-700 text-center mb-2"
            style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.48, color: colors.textPrimary }}
          >
            Where are you?
          </Text>
          <Text
            className="font-inter-400 text-center mb-8"
            style={{ fontSize: 14, lineHeight: 20, color: '#767586' }}
          >
            Discover items and friends in your{'\n'}neighborhood. We only use your location{'\n'}to show local feeds.
          </Text>

          {/* Allow Location Access Button */}
          <TouchableOpacity
            className="w-full h-14 flex-row items-center justify-center rounded-figma-16 mb-8"
            style={{ backgroundColor: colors.primary }}
            onPress={() => router.push('/(onboarding)/profile-setup')}
          >
            <GpsTargetIcon size={18} color="#FFFFFF" />
            <Text
              className="font-inter-600 ml-2"
              style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
            >
              Allow Location Access
            </Text>
          </TouchableOpacity>

          {/* Divider with OR */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-[1px]" style={{ backgroundColor: '#dcdae0' }} />
            <Text
              className="font-inter-500 mx-4"
              style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: '#c7c4d7' }}
            >
              OR
            </Text>
            <View className="flex-1 h-[1px]" style={{ backgroundColor: '#dcdae0' }} />
          </View>

          {/* Search Bar */}
          <View
            className="flex-row items-center h-14 px-4 rounded-figma-16 mb-6"
            style={{ backgroundColor: colors.surfaceContainer }}
          >
            <SearchIcon size={16} color="#767586" />
            <TextInput
              className="flex-1 ml-3 font-inter-400 h-full"
              style={{ fontSize: 16, color: colors.textPrimary }}
              placeholder="Select City Manually"
              placeholderTextColor="rgba(118,117,134,0.6)"
            />
          </View>

          {/* Popular Cities */}
          <Text
            className="font-inter-500 mb-3"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: colors.textSecondary }}
          >
            Popular Cities
          </Text>

          <View className="gap-3 pb-4">
            {cities.map((city) => (
              <TouchableOpacity
                key={city.name}
                className="flex-row items-center h-14 px-4 rounded-figma-16"
                style={{
                  backgroundColor: selectedCity === city.name ? 'rgba(93,95,239,0.08)' : colors.surfaceContainerLowest,
                  borderWidth: 1,
                  borderColor: selectedCity === city.name ? 'transparent' : '#dcdae0',
                }}
                onPress={() => setSelectedCity(city.name)}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: '#efecff' }}
                >
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: '#5d5fef' }}>
                    <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '600' }}>
                      {city.name[0]}
                    </Text>
                  </View>
                </View>
                <Text
                  className="flex-1 font-inter-400"
                  style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}
                >
                  {city.name}
                </Text>
                {selectedCity === city.name && (
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="px-5 pt-4 pb-8" style={{ backgroundColor: colors.surface, paddingBottom: insets.bottom + 32 }}>
        <TouchableOpacity
          className="w-full h-14 items-center justify-center rounded-figma-16 mb-3"
          style={{ backgroundColor: colors.primary }}
          onPress={() => {
            updateUser({ location: selectedCity ?? 'Bangalore' });
            router.push('/(onboarding)/profile-setup');
          }}
        >
          <Text
            className="font-inter-600"
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14, color: '#FFFFFF' }}
          >
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center"
          onPress={() => router.push('/(onboarding)/profile-setup')}
        >
          <Text
            className="font-inter-500"
            style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24, color: 'rgba(70,69,85,0.6)' }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
