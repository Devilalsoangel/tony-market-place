import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useState } from 'react';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export function Input({ label, error, leftIcon, className = '', ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="w-full">
      {label && (
        <Text className="text-figma-14 font-inter-500 text-textPrimary mb-figma-8">
          {label}
        </Text>
      )}
      <View
        className={`
          flex-row items-center h-12 px-4 rounded-figma-16 bg-surfaceContainer
          ${focused ? 'ring-2 ring-primaryContainer' : ''}
          ${error ? 'ring-2 ring-error' : ''}
        `}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className="flex-1 text-figma-16 font-inter-400 text-textPrimary h-full"
          placeholderTextColor="#5c5e63"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-figma-12 font-inter-400 text-error mt-figma-4">
          {error}
        </Text>
      )}
    </View>
  );
}
