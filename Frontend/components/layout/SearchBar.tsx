import { View, TextInput } from 'react-native';
import { SearchIcon } from '../../utils/icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  className = '',
}: SearchBarProps) {
  return (
    <View className={`flex-row items-center h-12 px-4 rounded-figma-16 bg-surfaceContainerLow ${className}`}>
      <SearchIcon size={18} color="#5c5e63" />
      <TextInput
        className="flex-1 ml-3 text-figma-14 font-inter-400 text-textPrimary"
        placeholder={placeholder}
        placeholderTextColor="#5c5e63"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}
