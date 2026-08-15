import { View, Text } from 'react-native';

interface StatItem {
  label: string;
  value: number | string;
}

interface StatsRowProps {
  stats: StatItem[];
  className?: string;
}

export function StatsRow({ stats, className = '' }: StatsRowProps) {
  return (
    <View className={`flex-row items-center justify-center gap-6 ${className}`}>
      {stats.map((stat, i) => (
        <View key={i} className="items-center">
          <Text className="text-figma-18 font-inter-700 text-textPrimary">
            {typeof stat.value === 'number' && stat.value > 999
              ? `${(stat.value / 1000).toFixed(1)}K`
              : String(stat.value)}
          </Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}
