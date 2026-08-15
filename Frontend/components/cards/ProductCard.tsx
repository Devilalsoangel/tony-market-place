import { useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, MoreIcon, VerifiedIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useBookmark } from '../../contexts/BookmarkContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { usePosts } from '../../contexts/PostContext';

interface ProductCardProps {
  id?: string;
  sellerAvatar?: string | number;
  sellerName: string;
  sellerUsername?: string;
  sellerLocation?: string;
  verified?: boolean;
  sponsored?: boolean;
  productImage?: string | number;
  price: number;
  description: string;
  likes: number;
  comments: number;
  hashtags?: string[];
  liked?: boolean;
  className?: string;
}

// Helper to handle both require() (number) and uri string images
const imageSource = (img: string | number | undefined): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
};

// Compact count formatting (12.4k / 432)
const formatCount = (n: number): string => {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export function ProductCard({
  id = `product_${Math.random().toString(36).slice(2, 9)}`,
  sellerAvatar,
  sellerName,
  sellerUsername,
  sellerLocation,
  verified = false,
  sponsored = false,
  productImage,
  price,
  description,
  likes,
  comments,
  hashtags,
  className = '',
}: ProductCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuSection, setMenuSection] = useState<'main' | 'report'>('main');
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { record } = useRecentlyViewed();
  const { posts, isLiked, toggleLike, hidePost, toggleMuteSeller, reportPost } = usePosts();
  const saved = isBookmarked(id);
  const liked = isLiked(id);
  const likeCount = useMemo(() => {
    const post = posts.find((p) => p.id === id);
    return post ? post.likes : likes;
  }, [posts, id, likes]);

  // Hashtags: explicit prop wins, otherwise parsed from description
  const tagList = useMemo(() => {
    if (hashtags && hashtags.length > 0) return hashtags.slice(0, 6);
    const found = description.match(/#\w+/g);
    return found ? found.slice(0, 6) : [];
  }, [hashtags, description]);

  // Description text without hashtags (hashtags render in their own row)
  const cleanDescription = useMemo(() => description.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim(), [description]);

  const handleToggleLike = () => {
    toggleLike(id);
  };

  const handleHashtagPress = (tag: string) => {
    router.push(`/hashtag/${tag.replace('#', '')}`);
  };

  const handleSellerPress = () => {
    const username = sellerUsername || sellerName.toLowerCase().replace(/\s+/g, '');
    router.push(`/seller/${username}`);
  };

  const handleCardPress = () => {
    record(id);
    router.push(`/product/${id}`);
  };

  const openMenu = () => {
    setMenuSection('main');
    setMenuVisible(true);
  };

  const closeMenu = () => setMenuVisible(false);

  const handleReport = (reason: string) => {
    reportPost(id, reason);
    closeMenu();
    Alert.alert('Report sent', `Thanks for reporting this listing as ${reason.toLowerCase()}. Our team will review it.`);
  };

  const handleHide = () => {
    hidePost(id);
    closeMenu();
    Alert.alert('Post hidden', 'This post will no longer appear in your feed.');
  };

  const handleMute = () => {
    toggleMuteSeller(sellerUsername || sellerName.toLowerCase().replace(/\s+/g, ''));
    closeMenu();
    Alert.alert('Seller muted', `${sellerName}'s posts will no longer appear in your feed.`);
  };

  const menuItems: { label: string; onPress: () => void; destructive?: boolean }[] =
    menuSection === 'main'
      ? [
          { label: 'Report listing', onPress: () => setMenuSection('report'), destructive: true },
          { label: 'Hide this post', onPress: handleHide },
          { label: 'Mute seller', onPress: handleMute },
          { label: 'Cancel', onPress: closeMenu },
        ]
      : [
          ...(['Spam', 'Misleading', 'Inappropriate'] as const).map((reason) => ({
            label: reason,
            onPress: () => handleReport(reason),
            destructive: true,
          })),
          { label: 'Cancel', onPress: () => setMenuSection('main') },
        ];

  return (
    <TouchableOpacity onPress={handleCardPress} activeOpacity={0.95} className={`bg-surfaceContainerLowest ${className}`}>
      {/* Post header — 72px */}
      <View className="flex-row items-center px-4" style={{ height: 72 }}>
        <TouchableOpacity onPress={handleSellerPress} className="flex-1 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center overflow-hidden">
            {sellerAvatar ? (
              <Image source={imageSource(sellerAvatar)} className="w-10 h-10 rounded-full" />
            ) : (
              <View className="w-8 h-8 rounded-full bg-surfaceContainerLow" />
            )}
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Text className="text-figma-14 font-inter-600 text-textPrimary" numberOfLines={1}>
                {sellerName}
              </Text>
              {verified && <VerifiedIcon size={13} />}
            </View>
            <Text className="text-secondary font-inter-400" style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={1}>
              {sponsored
                ? sellerLocation
                  ? `${sellerLocation} • Sponsored`
                  : 'Sponsored'
                : sellerLocation || ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMenu(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MoreIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Post image + price pill — pill only renders over a real image */}
      <View>
        <View className="w-full bg-surfaceContainer" style={{ aspectRatio: 390 / 488 }} />
        {productImage ? (
          <Image source={imageSource(productImage)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : null}
        {productImage ? (
          <View
            className="absolute top-6 right-6 h-14 px-5 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primaryContainer }}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 22, lineHeight: 28 }}>{formatPrice(price)}</Text>
          </View>
        ) : null}
      </View>

      {/* Post actions */}
      <View className="flex-row items-center px-4 pt-4">
        <View className="flex-row items-center" style={{ gap: 24 }}>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleToggleLike(); }} className="flex-row items-center" style={{ gap: 8 }}>
            <HeartIcon size={24} color={liked ? colors.primary : colors.textSecondary} />
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>{formatCount(likeCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); router.push(`/product/${id}`); }} className="flex-row items-center" style={{ gap: 8 }}>
            <CommentIcon size={24} color={colors.textSecondary} />
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>{formatCount(comments)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => e.stopPropagation()}>
            <ShareIcon size={23} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1" />
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleBookmark({ productId: id, sellerName, sellerUsername, price, description, savedAt: Date.now() }); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BookmarkIcon size={18} color={saved ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View className="px-4 pt-5 pb-4">
        <View className="flex-row flex-wrap">
          <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 14, lineHeight: 23 }}>{sellerName} </Text>
          <Text className="font-inter-400 text-textSecondary" style={{ fontSize: 14, lineHeight: 23 }} numberOfLines={2}>
            {cleanDescription}
          </Text>
        </View>
        {tagList.length > 0 && (
          <View className="flex-row flex-wrap mt-1" style={{ gap: 12 }}>
            {tagList.map((tag) => (
              <TouchableOpacity key={tag} onPress={(e) => { e.stopPropagation(); handleHashtagPress(tag); }}>
                <Text className="font-inter-400 text-primary" style={{ fontSize: 12, lineHeight: 14 }}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal transparent animationType="fade" visible={menuVisible} onRequestClose={closeMenu} statusBarTranslucent>
        <TouchableOpacity activeOpacity={1} onPress={closeMenu} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View className="bg-surfaceContainerLowest rounded-t-figma-24 overflow-hidden" style={{ paddingBottom: 8 }}>
            <Text className="text-figma-14 font-inter-600 text-textSecondary text-center" style={{ paddingVertical: 14, letterSpacing: 0.14 }}>
              {menuSection === 'report' ? 'Why are you reporting this listing?' : 'Listing options'}
            </Text>
            {menuItems.map((item, i) => (
              <TouchableOpacity key={item.label} onPress={item.onPress} className={`px-5 py-4 ${i > 0 ? 'border-t border-outlineVariant' : ''}`}>
                <Text className={`font-inter-600 ${item.destructive ? 'text-error' : 'text-textPrimary'}`} style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}
