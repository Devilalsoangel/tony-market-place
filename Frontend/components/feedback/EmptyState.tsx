import { View, Text } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export function EmptyState({ icon = '📦', title, subtitle, className = '' }: EmptyStateProps) {
  return (
    <View className={`items-center justify-center py-16 px-8 ${className}`}>
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-figma-18 font-inter-600 text-textPrimary text-center mb-2">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-figma-14 font-inter-400 text-textSecondary text-center">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
