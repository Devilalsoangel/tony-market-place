import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { BackIcon, HeartIcon, ShopIcon, SearchIcon } from '../../utils/icons';
import { colors } from '../../utils/theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showHeart?: boolean;
  showShop?: boolean;
  showSearch?: boolean;
  onBack?: () => void;
  className?: string;
}

export function Header({
  title,
  showBack = false,
  showHeart = false,
  showShop = false,
  showSearch = false,
  onBack,
  className = '',
}: HeaderProps) {
  return (
    <View className={`flex-row items-center justify-between h-14 px-4 bg-surface ${className}`}>
      <View className="flex-row items-center gap-3">
        {showBack && (
          <TouchableOpacity onPress={onBack || (() => router.back())}>
            <BackIcon size={20} color="#4343d5" />
          </TouchableOpacity>
        )}
        {title ? (
          <Text className="text-figma-20 font-inter-700 text-textPrimary">{title}</Text>
        ) : (
          <Text className="text-figma-24 font-inter-700 text-textPrimary">susej</Text>
        )}
      </View>
      <View className="flex-row items-center gap-4">
        {showSearch && (
          <TouchableOpacity onPress={() => router.push('/search')} hitSlop={8}>
            <SearchIcon size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {showHeart && (
          <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={8}>
            <HeartIcon size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {showShop && (
          <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={8}>
            <ShopIcon size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
