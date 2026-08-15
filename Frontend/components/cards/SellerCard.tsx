import { View, Text, TouchableOpacity } from 'react-native';
import { VerifiedIcon } from '../../utils/icons';

interface SellerCardProps {
  name: string;
  username: string;
  avatar?: string;
  verified?: boolean;
  rating?: number;
  products?: number;
  onPress: () => void;
}

export function SellerCard({ name, username, verified, rating, products, onPress }: SellerCardProps) {
  return (
    <TouchableOpacity className="flex-row items-center bg-surfaceContainerLowest rounded-figma-16 p-4 mb-3"
      onPress={onPress}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
    >
      <View className="w-14 h-14 rounded-full bg-surfaceContainerLow items-center justify-center mr-4">
        <View className="w-10 h-10 rounded-full bg-surfaceContainer" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1">
          <Text className="text-figma-15 font-inter-600 text-textPrimary">{name}</Text>
          {verified && <VerifiedIcon size={14} />}
        </View>
        <Text className="text-figma-12 font-inter-400 text-textSecondary">@{username}</Text>
      </View>
      <View className="items-end">
        {rating && <Text className="text-figma-12 font-inter-600 text-textPrimary">★ {rating}</Text>}
        {products && <Text className="text-figma-11 font-inter-400 text-textSecondary">{products} items</Text>}
      </View>
    </TouchableOpacity>
  );
}
