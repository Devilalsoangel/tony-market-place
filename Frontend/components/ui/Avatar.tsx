import { View, Image } from 'react-native';

interface AvatarProps {
  uri?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function Avatar({ uri, size = 40, ring = false, className = '' }: AvatarProps) {
  return (
    <View
      className={`
        rounded-full items-center justify-center overflow-hidden
        ${ring ? 'p-[3px] bg-gradient-to-br from-primaryContainer to-primaryLight' : ''}
        ${className}
      `}
      style={{ width: ring ? size + 6 : size, height: ring ? size + 6 : size }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          className="rounded-full"
          style={{ width: ring ? size : size, height: ring ? size : size }}
        />
      ) : (
        <View
          className="rounded-full bg-primaryLight items-center justify-center"
          style={{ width: size, height: size }}
        >
          <View
            className="rounded-full bg-primaryContainer opacity-30"
            style={{ width: size * 0.6, height: size * 0.6 }}
          />
        </View>
      )}
    </View>
  );
}
