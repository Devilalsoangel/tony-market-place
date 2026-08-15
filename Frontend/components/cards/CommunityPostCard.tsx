import { View, Text, TouchableOpacity } from 'react-native';
import { HeartIcon, CommentIcon } from '../../utils/icons';

interface CommunityPostCardProps {
  authorName: string;
  authorAvatar?: string;
  content: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  isLarge?: boolean;
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
}

export function CommunityPostCard({
  authorName,
  content,
  likeCount,
  commentCount,
  isLarge = false,
  onPress,
  onLike,
  onComment,
}: CommunityPostCardProps) {
  return (
    <TouchableOpacity
      className={`bg-surfaceContainerLowest rounded-figma-24 overflow-hidden`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 20,
        elevation: 3,
      }}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <View className="w-8 h-8 rounded-full bg-surfaceContainerLow items-center justify-center mr-2">
          <View className="w-7 h-7 rounded-full bg-surfaceContainer" />
        </View>
        <Text className="text-figma-14 font-inter-600 text-textPrimary flex-1">{authorName}</Text>
      </View>

      <View
        className={`bg-surfaceContainer mx-4 ${isLarge ? 'h-40' : 'h-24'} rounded-figma-12 mb-3`}
      />

        <Text className="text-figma-12 font-inter-400 text-textSecondary px-4 mb-3 leading-5" numberOfLines={3}>
        {content}
      </Text>

      <View className="flex-row items-center gap-4 px-4 pb-4">
        <TouchableOpacity className="flex-row items-center gap-1" onPress={onLike}>
          <HeartIcon size={16} color="#5c5e63" />
          <Text className="text-figma-11 font-inter-500 text-textSecondary">{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center gap-1" onPress={onComment}>
          <CommentIcon size={16} color="#5c5e63" />
          <Text className="text-figma-11 font-inter-500 text-textSecondary">{commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
