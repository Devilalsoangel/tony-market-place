import { View, Text } from 'react-native';

interface BadgeProps {
  count: number;
  className?: string;
}

export function Badge({ count, className = '' }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <View
      className={`
        min-w-[24px] h-6 px-1.5 rounded-figma-8 bg-primaryContainer items-center justify-center
        ${className}
      `}
    >
      <Text className="text-figma-12 font-inter-600 text-white">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
