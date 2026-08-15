import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primaryContainer rounded-figma-16',
    text: 'text-white font-inter-600',
  },
  outline: {
    container: 'bg-transparent border border-outlineVariant rounded-figma-16',
    text: 'text-textPrimary font-inter-600',
  },
  ghost: {
    container: 'bg-transparent rounded-figma-16',
    text: 'text-primary font-inter-600',
  },
  danger: {
    container: 'bg-errorContainer rounded-figma-16',
    text: 'text-error font-inter-500',
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  fullWidth = true,
}: ButtonProps) {
  const styles = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        h-14 items-center justify-center px-6
        ${fullWidth ? 'w-full' : ''}
        ${styles.container}
        ${disabled ? 'opacity-50' : ''}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : '#4343d5'}
          size="small"
        />
      ) : (
        <Text className={`text-figma-14 ${styles.text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
