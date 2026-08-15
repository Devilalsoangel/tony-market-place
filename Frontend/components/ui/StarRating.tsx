import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  className?: string;
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? '#f59e0b' : '#d1d5db'}
      />
    </Svg>
  );
}

export function StarRating({ rating, maxStars = 5, size = 16, className = '' }: StarRatingProps) {
  return (
    <View className={`flex-row gap-0.5 ${className}`}>
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star key={i} filled={i < Math.round(rating)} size={size} />
      ))}
    </View>
  );
}
