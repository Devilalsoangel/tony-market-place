import { View, Text } from 'react-native';
import { colors, formatPrice } from '../../utils/theme';

interface PriceTagProps {
  price: number;
  className?: string;
}

export function PriceTag({ price, className = '' }: PriceTagProps) {
  const formatted = formatPrice(price);

  return (
    <View
      className={`
        bg-primaryContainer rounded-full px-4 py-2
        ${className}
      `}
    >
      <Text className="text-white font-inter-700" style={{ fontSize: 20, lineHeight: 28 }}>{formatted}</Text>
    </View>
  );
}
