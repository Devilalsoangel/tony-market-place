import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface FeaturedBannerProps {
  title: string;
  subtitle?: string;
  badge?: string;
  backgroundColor?: string;
  badgeColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function FeaturedBanner({
  title,
  subtitle,
  badge,
  backgroundColor = '#5d5fef',
  badgeColor = '#5d5fef',
  onPress,
  style,
}: FeaturedBannerProps) {
  return (
    <TouchableOpacity
      className="w-full rounded-figma-24 p-4 justify-end overflow-hidden"
      style={[{ backgroundColor, minHeight: 192 }, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {badge && (
        <View className="rounded-figma-8 px-3 py-1 self-start mb-2" style={{ backgroundColor: `${badgeColor}E6` }}>
          <Text className="text-figma-10 font-inter-600 text-white">{badge}</Text>
        </View>
      )}
      <Text className="text-figma-20 font-inter-700 text-white mb-1">{title}</Text>
      {subtitle && (
        <Text className="text-figma-14 font-inter-600 text-white/80">{subtitle}</Text>
      )}
    </TouchableOpacity>
  );
}
