import { View } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const roundedMap = {
  sm: 'rounded-figma-4',
  md: 'rounded-figma-8',
  lg: 'rounded-figma-12',
  full: 'rounded-figma-full',
};

export function Skeleton({ width = '100%', height = 20, rounded = 'md', className = '' }: SkeletonProps) {
  return (
    <View
      className={`bg-surfaceDim/50 animate-pulse ${roundedMap[rounded]} ${className}`}
      style={{ width: width as any, height }}
    />
  );
}

export function PostSkeleton() {
  return (
    <View className="w-full bg-surfaceContainerLowest rounded-figma-24 p-4 gap-3">
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} rounded="full" />
        <View className="gap-2 flex-1">
          <Skeleton width="60%" height={12} rounded="sm" />
          <Skeleton width="40%" height={10} rounded="sm" />
        </View>
      </View>
      <Skeleton width="100%" height={300} rounded="lg" />
      <View className="gap-2">
        <Skeleton width="90%" height={12} rounded="sm" />
        <Skeleton width="70%" height={12} rounded="sm" />
        <Skeleton width="40%" height={12} rounded="sm" />
      </View>
    </View>
  );
}
