import { View, Text } from 'react-native';
import { Button } from '../ui/Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <View className={`items-center justify-center py-16 px-8 ${className}`}>
      <Text className="text-5xl mb-4">⚠️</Text>
      <Text className="text-figma-18 font-inter-600 text-textPrimary text-center mb-2">
        {message}
      </Text>
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} variant="outline" className="mt-4 max-w-[200px]" />
      )}
    </View>
  );
}
