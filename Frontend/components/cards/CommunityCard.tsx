import { View, Text, TouchableOpacity } from 'react-native';

interface CommunityCardProps {
  name: string;
  members: string;
  online: number;
  category: string;
  active?: boolean;
  onPress: () => void;
}

export function CommunityCard({ name, members, online, category, active, onPress }: CommunityCardProps) {
  return (
    <TouchableOpacity className="bg-surfaceContainerLowest rounded-figma-16 p-4 mb-3"
      onPress={onPress}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-center mb-3">
        <View className="w-16 h-16 rounded-full bg-surfaceContainerLow items-center justify-center mr-3">
          <View className="w-12 h-12 rounded-full bg-surfaceContainer" />
        </View>
        <View className="flex-1">
          <Text className="text-figma-14 font-inter-600 text-textPrimary">{name}</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary mt-0.5">
            {members} members • {online} online
          </Text>
        </View>
        {active && (
          <View className="px-2 py-0.5 rounded-figma-full bg-success/10">
            <Text className="text-figma-10 font-inter-600 text-success">ACTIVE</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <View className="px-3 py-1 bg-surfaceContainerLow rounded-figma-full">
          <Text className="text-figma-11 font-inter-500 text-secondary">{category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
