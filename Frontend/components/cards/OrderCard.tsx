import { View, Text, Image, TouchableOpacity } from 'react-native';

interface OrderCardProps {
  image?: string;
  title: string;
  price: number;
  status: string;
  date: string;
  onViewDetails: () => void;
}

export function OrderCard({ image, title, price, status, date, onViewDetails }: OrderCardProps) {
  return (
    <View className="flex-row bg-surfaceContainerLowest rounded-figma-16 p-3 mb-3">
      <View className="w-20 h-20 rounded-figma-12 bg-surfaceContainer mr-3" />
      <View className="flex-1 justify-between">
        <View>
          <Text className="text-figma-14 font-inter-600 text-textPrimary mb-1">{title}</Text>
          <Text className="text-figma-14 font-inter-700 text-primaryContainer">
            ${price.toLocaleString()}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-figma-11 font-inter-400 text-textSecondary">{date}</Text>
          <View className={`px-2 py-0.5 rounded-figma-full ${
            status === 'Delivered' ? 'bg-success/10' : 'bg-warning/10'
          }`}>
            <Text className={`text-figma-10 font-inter-600 ${
              status === 'Delivered' ? 'text-success' : 'text-warning'
            }`}>{status}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity className="ml-2 justify-center" onPress={onViewDetails}>
        <Text className="text-figma-12 font-inter-600 text-primaryContainer">View</Text>
      </TouchableOpacity>
    </View>
  );
}
