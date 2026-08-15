import { View, Text, TouchableOpacity } from 'react-native';

interface NotificationCardProps {
  type: 'order' | 'social' | 'alert' | 'follower' | 'payment';
  title: string;
  subtitle: string;
  time: string;
  image?: string;
  onPress: () => void;
}

const typeIcons: Record<string, string> = {
  order: '📦',
  social: '💬',
  alert: '🔔',
  follower: '👤',
  payment: '💰',
};

export function NotificationCard({ type, title, subtitle, time, onPress }: NotificationCardProps) {
  return (
    <TouchableOpacity className="flex-row bg-surfaceContainerLowest rounded-figma-12 p-4 mb-3"
      onPress={onPress}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
    >
      <View className="w-10 h-10 rounded-full bg-surfaceContainerLow items-center justify-center mr-3">
        <Text className="text-lg">{typeIcons[type] || '🔔'}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-figma-14 font-inter-600 text-textPrimary flex-1 mr-2">{title}</Text>
          <Text className="text-figma-11 font-inter-400 text-textSecondary">{time}</Text>
        </View>
        <Text className="text-figma-12 font-inter-400 text-textSecondary leading-5" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
