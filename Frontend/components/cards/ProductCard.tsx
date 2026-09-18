import { useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, MoreIcon, VerifiedIcon } from '../../utils/icons';
import { colors, formatPrice } from '../../utils/theme';
import { useBookmark } from '../../contexts/BookmarkContext';
import { useRecentlyViewed } from '../../contexts/RecentlyViewedContext';
import { usePosts } from '../../contexts/PostContext';
import { extractHashtags } from '../../contexts/HashtagContext';
import { CommentsSheet, LikersSheet, ShareSheet } from '../sheets/PostEngagementSheets';

interface ProductCardProps {
  id?: string;
  sellerAvatar?: string | number | { uri: string };
  sellerName: string;
  sellerUsername?: string;
  sellerLocation?: string;
  verified?: boolean;
  sponsored?: boolean;
  /** Chip text used when sponsored is true (defaults to 'Sponsored'). */
  sponsoredLabel?: string;
  productImage?: string | number | { uri: string };
  price: number;
  description: string;
  likes: number;
  comments: number;
  hashtags?: string[];
  liked?: boolean;
  className?: string;
}

// Helper to handle require() (number), uri strings, and { uri } objects
const imageSource = (img: string | number | { uri: string } | undefined | null): any => {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  if (typeof img === 'object' && 'uri' in img && img.uri) return img;
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
  sponsoredLabel = 'Sponsored',
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
  const [sheet, setSheet] = useState<null | 'comments' | 'likers' | 'share'>(null);
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { record } = useRecentlyViewed();
  const { posts, isLiked, toggleLike, hidePost, toggleMuteSeller, reportPost } = usePosts();
  const saved = isBookmarked(id);
  const liked = isLiked(id);
  const likeCount = useMemo(() => {
    const post = posts.find((p) => p.id === id);
    return post ? post.likes : likes;
  }, [posts, id, likes]);

  // Live comment count: follows the post record, bumps as the user comments.
  const liveCommentCount = useMemo(() => {
    const post = posts.find((p) => p.id === id);
    return post ? post.comments : comments;
  }, [posts, id, comments]);

  // Hashtags: explicit prop wins, otherwise parsed from description
  // (Unicode-aware shared parser — same tags the indexer sees).
  const tagList = useMemo(() => {
    if (hashtags && hashtags.length > 0) return hashtags.slice(0, 6);
    return extractHashtags(description).slice(0, 6);
  }, [hashtags, description]);

  // Description text without hashtags (hashtags render in their own row)
  const cleanDescription = useMemo(() => description.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim(), [description]);

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

  const handleReport = async (reason: string) => {
    const filed = await reportPost(id, reason);
    closeMenu();
    Alert.alert(
      filed ? 'Report sent' : 'Report not sent',
      filed
        ? `Thanks for reporting this listing as ${reason.toLowerCase()}. Our team will review it.`
        : 'Check your connection and try again — nothing was filed.'
    );
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
                  ? `${sellerLocation} • ${sponsoredLabel}`
                  : sponsoredLabel
                : sellerLocation || ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openMenu(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MoreIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Post image + price pill — pill only renders over a real image. Square 1:1 keeps the
          social feed scannable (industry commerce-card standard) instead of a dominating 4:5. */}
      <View>
        <View className="w-full bg-surfaceContainer" style={{ aspectRatio: 1 }} />
        {productImage ? (
          <Image source={imageSource(productImage)} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : null}
        {productImage ? (
          <View
            className="absolute top-4 right-4 h-11 px-4 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primaryContainer }}
          >
            <Text className="font-inter-600 text-white" style={{ fontSize: 16, lineHeight: 20 }}>{formatPrice(price)}</Text>
          </View>
        ) : null}
      </View>

      {/* Post actions — Instagram arrangement: engagement cluster left, Save trailing.
          Uniform 32px gaps give the cluster deliberate, predictable rhythm. */}
      <View className="flex-row items-center px-4 pt-4">
        <View className="flex-row items-center" style={{ gap: 32 }}>
          {/* One tap = like/unlike. LONG PRESS = who liked this (Instagram pattern). */}
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); handleToggleLike(); }}
            onLongPress={(e) => { e.stopPropagation(); setSheet('likers'); }}
            delayLongPress={280}
            className="flex-row items-center"
            style={{ gap: 8 }}
            accessibilityRole="button"
            accessibilityLabel={liked ? `Unlike ${sellerName}'s post` : `Like ${sellerName}'s post`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HeartIcon size={24} color={liked ? colors.primary : colors.textSecondary} />
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>{formatCount(likeCount)}</Text>
          </TouchableOpacity>
          {/* Comment opens the Instagram-style comments sheet — NOT the product view */}
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSheet('comments'); }} className="flex-row items-center" style={{ gap: 8 }} accessibilityRole="button" accessibilityLabel="View comments" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <CommentIcon size={24} color={colors.textSecondary} />
            <Text className="font-inter-400 text-textPrimary" style={{ fontSize: 13, lineHeight: 16 }}>{formatCount(liveCommentCount)}</Text>
          </TouchableOpacity>
          {/* Share: into DMs, communities and external apps (Instagram pattern) */}
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSheet('share'); }} accessibilityRole="button" accessibilityLabel="Share listing" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ShareIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1" />
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleBookmark({ productId: id, sellerName, sellerUsername, price, description, savedAt: Date.now() }); }} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BookmarkIcon size={22} color={saved ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Description — caption attribution bolded (IG pattern) so the seller name reads
          as a caption prefix, not a duplicate of the header */}
      <View className="px-4 pt-5 pb-4">
        <View className="flex-row flex-wrap">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 23 }}>{sellerName} </Text>
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

      {/* Engagement sheets (Instagram pattern): comments / likers / share */}
      <CommentsSheet
        visible={sheet === 'comments'}
        postId={id}
        onClose={() => setSheet(null)}
      />
      <LikersSheet
        visible={sheet === 'likers'}
        postId={id}
        onClose={() => setSheet(null)}
      />
      <ShareSheet
        visible={sheet === 'share'}
        post={{ id, sellerName, sellerUsername, price, description }}
        onClose={() => setSheet(null)}
      />

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
