import { TouchableOpacity, Text } from 'react-native';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  className?: string;
}

export function Chip({ label, active = false, onPress, className = '' }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`
        px-4 py-2 rounded-figma-full
        ${active ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'}
        ${className}
      `}
    >
      <Text
        className={`
          text-figma-14 font-inter-500
          ${active ? 'text-white' : 'text-textSecondary'}
        `}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
