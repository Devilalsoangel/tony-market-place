import { View, Text, TouchableOpacity } from 'react-native';
import { StarIcon } from '../../utils/icons';

interface ServiceCardProps {
  name: string;
  category: string;
  rating: number;
  price: string;
  distance: string;
  time: string;
  onPress: () => void;
}

export function ServiceCard({ name, category, rating, price, distance, time, onPress }: ServiceCardProps) {
  return (
    <TouchableOpacity className="bg-surfaceContainerLowest rounded-figma-16 overflow-hidden mb-4"
      onPress={onPress}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="w-full h-32 bg-surfaceContainer" />
      <View className="p-4">
        <View className="flex-row items-center gap-1 mb-1">
          <StarIcon size={14} />
          <Text className="text-figma-12 font-inter-600 text-textPrimary">{rating}</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary ml-1">{category}</Text>
        </View>
        <Text className="text-figma-16 font-inter-600 text-textPrimary mb-1">{name}</Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-figma-12 font-inter-500 text-primaryContainer">{price}</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">{distance}</Text>
          <Text className="text-figma-12 font-inter-500 text-success">{time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
