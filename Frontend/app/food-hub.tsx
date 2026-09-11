import { useMemo, useState } from 'react';
import { View, Text, Image, FlatList, ScrollView, TouchableOpacity, Modal, Alert, Share, type GestureResponderEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { BackIcon, BellIcon, SearchIcon, HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, MoreIcon, VerifiedIcon, StarIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { PriceTag } from '../components/ui/PriceTag';
import { usePosts, type Post } from '../contexts/PostContext';
import { useCart } from '../contexts/CartContext';
import { useBookmark } from '../contexts/BookmarkContext';
import { resolveAvatar, resolveListingImage } from '../utils/productImages';

function ClockMini({ size = 12, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

interface MenuSeller {
  name: string;
  username: string;
  items: FoodPost[];
}

interface FoodPost {
  id: string;
  name: string;
  desc: string;
  price: number;
  time: string;
  rating: number;
  veg?: boolean;
  sellerName: string;
  sellerUsername: string;
  sellerLocation: string;
  verified: boolean;
  likes: number;
  comments: number;
  image?: string | number;
  postId?: string; // present → deep-link to /product/{postId}
}

function foodImage(item: { id: string; image?: string | number }) {
  if (item.image) {
    return typeof item.image === 'string' ? { uri: item.image } : item.image;
  }
  return resolveListingImage(item, item.id);
}

function FoodPostCard({ item, onOpenSeller, onHide }: { item: FoodPost; onOpenSeller: (v: MenuSeller) => void; onHide: (id: string) => void }) {
  const [localLike, setLocalLike] = useState({ liked: false, likes: item.likes });
  const [adding, setAdding] = useState(false);
  const { addToCart } = useCart();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { posts, isLiked, toggleLike: contextToggleLike, reportPost, hidePost } = usePosts();
  const saved = isBookmarked(item.id);

  const postId = item.postId;
  const liked = postId ? isLiked(postId) : localLike.liked;
  const likeCount = postId ? (posts.find((p) => p.id === postId)?.likes ?? item.likes) : localLike.likes;

  const toggleLike = () => {
    if (postId) {
      contextToggleLike(postId);
      return;
    }
    setLocalLike((prev) => ({ liked: !prev.liked, likes: prev.liked ? prev.likes - 1 : prev.likes + 1 }));
  };

  const openItem = () => {
    if (item.postId) router.push(`/product/${item.postId}`);
  };

  const handleShare = (e?: GestureResponderEvent) => {
    e?.stopPropagation();
    Share.share({
      title: item.name,
      message: `${item.name} — ${formatPrice(item.price)} on susej. ${item.desc}`,
    }).catch(() => {});
  };

  const handleMore = (e: GestureResponderEvent) => {
    e.stopPropagation();
    Alert.alert(item.name, 'What would you like to do with this post?', [
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          if (!postId) return;
          const filed = await reportPost(postId, 'Misleading or inappropriate listing');
          Alert.alert(
            filed ? 'Reported' : 'Report not sent',
            filed
              ? 'Thanks — our team will review this post.'
              : 'Check your connection and try again — nothing was filed.'
          );
        },
      },
      {
        text: 'Hide',
        onPress: () => {
          if (postId) hidePost(postId);
          onHide(item.id);
          Alert.alert('Hidden', "This post won't appear in your feed anymore.");
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBuy = () => {
    if (adding) return;
    setAdding(true);
    addToCart({
      listingId: item.id,
      type: 'food_item',
      name: item.name,
      price: item.price,
      seller: item.sellerName,
      sellerUsername: item.sellerUsername,
    });
    router.push('/cart');
  };

  const imageSource = useMemo(() => {
    if (item.image === undefined || item.image === null) return null;
    return typeof item.image === 'number' ? item.image : { uri: item.image };
  }, [item.image]);

  return (
    <TouchableOpacity onPress={openItem} activeOpacity={0.95}
      className="bg-surface rounded-figma-24 overflow-hidden"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4 }}
    >
      {/* Seller row — matches Home Feed ProductCard */}
      <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (item.postId) router.push(`/seller/${item.sellerUsername}`); }} className="flex-row items-center px-4 h-[72px]">
        <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center mr-3 overflow-hidden">
          {imageSource ? (
            <Image source={imageSource} className="w-10 h-10 rounded-full" />
          ) : (
            <View className="w-8 h-8 rounded-full bg-surfaceContainerLow items-center justify-center">
              <Text className="text-figma-12 font-inter-700 text-primaryContainer">{item.sellerName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-figma-14 font-inter-700 text-textPrimary" style={{ lineHeight: 16, letterSpacing: 0.14 }}>{item.sellerName}</Text>
            {item.verified && <VerifiedIcon size={14} />}
          </View>
          <View className="flex-row items-center gap-1">
            <ClockMini size={10} color={colors.textSecondary} />
            <Text className="text-figma-12 font-inter-500 text-textSecondary" style={{ lineHeight: 14, letterSpacing: 0.24 }}>
              {item.sellerLocation}
              {item.time ? ` • ${item.time} delivery` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleMore}>
          <MoreIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Image + price tag — matches Home Feed ProductCard */}
      <View className="relative">
        <View className="w-full aspect-[4/5] bg-surfaceContainer" />
        {imageSource ? (
          <Image source={imageSource} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : null}
        <View className="absolute top-3 right-3">
          <PriceTag price={item.price} />
        </View>
        {item.veg ? (
          <View className="absolute top-3 left-3 w-5 h-5 rounded-sm items-center justify-center" style={{ backgroundColor: 'rgba(252,248,255,0.9)' }}>
            <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.categories.food }} />
          </View>
        ) : null}
      </View>

      {/* Actions — matches Home Feed ProductCard */}
      <View className="px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleLike(); }} className="flex-row items-center gap-1">
              <HeartIcon size={20} color={liked ? colors.primary : colors.textSecondary} />
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>{likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); openItem(); }} className="flex-row items-center gap-1">
              <CommentIcon size={20} color={colors.textSecondary} />
              <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>{item.comments}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare}>
              <ShareIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleBookmark({ productId: item.id, sellerName: item.sellerName, sellerUsername: item.sellerUsername, price: item.price, description: item.name, savedAt: Date.now() }); }}>
            <BookmarkIcon size={18} color={saved ? colors.primaryContainer : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View className="mb-1">
          <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>{item.name}</Text>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.24 }} numberOfLines={1}>{item.desc}</Text>
        </View>

        {item.rating > 0 ? (
          <View className="flex-row items-center gap-1.5 mb-3">
            <StarIcon size={12} color="#f59e0b" />
            <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 12, lineHeight: 14 }}>{item.rating.toFixed(1)}</Text>
            <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
              • {formatPrice(item.price)}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1.5 mb-3">
            <StarIcon size={12} color="#d5d0e0" />
            <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
              No ratings yet • {formatPrice(item.price)}
            </Text>
          </View>
        )}

        <View className="flex-row gap-3">
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleBuy(); }} className="flex-1 h-[41px] bg-primaryContainer rounded-figma-12 items-center justify-center">
            <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>Buy Now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); router.push(`/(tabs)/chat?seller=${item.sellerUsername}`); }} className="flex-1 h-[41px] border border-outlineVariant rounded-figma-12 items-center justify-center">
            <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SellerMenuSheet({ seller, onClose }: { seller: MenuSeller; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { cart, addToCart } = useCart();
  const [selected, setSelected] = useState<FoodPost | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const inCart = (id: string) => cart.some((i) => i.listingId === id);

  const handleAdd = (item: FoodPost) => {
    addToCart({
      listingId: item.id,
      type: 'food_item',
      name: item.name,
      price: item.price,
      seller: seller.name,
      sellerUsername: seller.username,
    });
    setAddedId(item.id);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.overlay }}>
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' }}>
          {/* Drag handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.surfaceContainerHigh }} />
          </View>

          {selected ? (
            <View>
              {/* Item detail header */}
              <View className="flex-row items-center px-5 pt-3 pb-3">
                <TouchableOpacity onPress={() => setSelected(null)}>
                  <BackIcon size={16} color={colors.primaryContainer} />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-[16px] mr-4" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 24, color: colors.textPrimary }}>
                  {seller.name}
                </Text>
              </View>
              <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                <View className="w-full h-52" style={{ backgroundColor: colors.surfaceContainer }}>
                  <Image source={foodImage(selected)} className="w-full h-full" resizeMode="cover" />
                </View>
                <View className="px-5 pt-4">
                  <Text className="text-[20px]" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 28, color: colors.textPrimary }}>
                    {selected.name}
                  </Text>
                  <Text className="text-[14px] mt-1" style={{ fontFamily: 'Inter_400Regular', lineHeight: 20, color: colors.textSecondary }}>
                    {selected.desc}
                  </Text>
                  <View className="flex-row items-center gap-4 mt-3">
                    {selected.rating > 0 ? (
                      <View className="flex-row items-center gap-1">
                        <StarIcon size={14} color="#f59e0b" />
                        <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textPrimary }}>
                          {selected.rating}
                        </Text>
                      </View>
                    ) : null}
                    {selected.time ? (
                      <View className="flex-row items-center gap-1">
                        <ClockMini size={12} />
                        <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textSecondary }}>
                          {selected.time}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[24px] mt-4" style={{ fontFamily: 'Inter_700Bold', lineHeight: 32, color: colors.primaryContainer }}>
                    {formatPrice(selected.price)}
                  </Text>

                  {addedId === selected.id || inCart(selected.id) ? (
                    <TouchableOpacity
                      className="mt-5 h-14 items-center justify-center"
                      style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                      onPress={() => router.push('/cart')}
                    >
                      <Text className="text-[16px] text-white" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 24 }}>
                        View Cart
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="mt-5 h-14 items-center justify-center"
                      style={{ borderRadius: 16, backgroundColor: colors.primaryContainer }}
                      onPress={() => handleAdd(selected)}
                    >
                      <Text className="text-[16px] text-white" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 24 }}>
                        Add to Cart
                      </Text>
                    </TouchableOpacity>
                  )}
                  {addedId === selected.id ? (
                    <Text className="text-center mt-3 text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.success }}>
                      Added to cart — check out when ready
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={{ maxHeight: '85%' }}>
              {/* Seller header — real identity only */}
              <View className="px-5 pt-2 pb-4">
                <Text className="text-[20px]" style={{ fontFamily: 'Inter_700Bold', lineHeight: 28, color: colors.textPrimary }}>
                  {seller.name}
                </Text>
                <Text className="text-[12px] mt-1" numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', lineHeight: 14, color: colors.textSecondary }}>
                  @{seller.username} · {seller.items.length} item{seller.items.length === 1 ? '' : 's'} on the menu
                </Text>
              </View>
              <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                {seller.items.length === 0 ? (
                  <View className="px-5 py-10 items-center">
                    <Text className="text-[14px]" style={{ fontFamily: 'Inter_400Regular', lineHeight: 20, color: colors.textSecondary }}>
                      No items on this menu yet.
                    </Text>
                  </View>
                ) : (
                  seller.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      className="flex-row items-center px-5 py-3"
                      onPress={() => {
                        setSelected(item);
                        setAddedId(null);
                      }}
                    >
                      <View className="w-[72px] h-[72px] rounded-[16px] overflow-hidden mr-3" style={{ backgroundColor: colors.surfaceContainer }}>
                        <Image source={foodImage(item)} className="w-full h-full" resizeMode="cover" />
                      </View>
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-1.5">
                          {item.veg ? <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.categories.food }} /> : null}
                          <Text className="text-[14px]" numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 16, color: colors.textPrimary }}>
                            {item.name}
                          </Text>
                        </View>
                        <Text className="text-[12px] mt-0.5" numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', lineHeight: 14, color: colors.textSecondary }}>
                          {item.desc}
                        </Text>
                        <Text className="text-[14px] mt-0.5" style={{ fontFamily: 'Inter_700Bold', lineHeight: 16, color: colors.primaryContainer }}>
                          {formatPrice(item.price)}
                        </Text>
                      </View>
                      <View className="items-end gap-1.5">
                        {item.time ? (
                          <Text className="text-[10px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 12, color: colors.textSecondary }}>
                            {item.time}
                          </Text>
                        ) : null}
                        {inCart(item.id) ? (
                          <TouchableOpacity className="px-4 py-1.5 rounded-full" style={{ backgroundColor: colors.surfaceContainer }} onPress={() => router.push('/cart')}>
                            <Text className="text-[12px]" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 14, color: colors.textSecondary }}>
                              In Cart
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity className="px-4 py-1.5 rounded-full" style={{ backgroundColor: colors.primaryContainer }} onPress={() => handleAdd(item)}>
                            <Text className="text-[12px] text-white" style={{ fontFamily: 'Inter_600SemiBold', lineHeight: 14 }}>
                              Add
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function FoodHubScreen() {
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();
  const [menuSeller, setMenuSeller] = useState<MenuSeller | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const openSeller = (v: MenuSeller) => setMenuSeller(v);

  // REAL food listings: every card comes from an actual food_item post.
  // No seeded vendor menus, no invented ratings or delivery times.
  const foodPosts = useMemo<FoodPost[]>(
    () =>
      posts
        .filter((p) => p.type === 'food_item')
        .map((p: Post) => ({
          id: p.id,
          name: p.description.split('\n')[0],
          desc: p.description.replace(/\n/g, ' '),
          price: p.price,
          time: '',
          rating: 0,
          sellerName: p.sellerName,
          sellerUsername: p.sellerUsername,
          sellerLocation: p.sellerLocation,
          verified: p.verified,
          likes: p.likes,
          comments: p.comments,
          image: p.image ?? resolveListingImage(p, p.id).uri,
          postId: p.id,
        })),
    [posts]
  );

  // Vendor rail = real sellers who actually have food listings.
  const menuSellers = useMemo<MenuSeller[]>(() => {
    const map = new Map<string, MenuSeller>();
    for (const item of foodPosts) {
      const existing = map.get(item.sellerUsername);
      if (existing) existing.items.push(item);
      else
        map.set(item.sellerUsername, {
          name: item.sellerName,
          username: item.sellerUsername,
          items: [item],
        });
    }
    return [...map.values()];
  }, [foodPosts]);

  const visiblePosts = useMemo(() => foodPosts.filter((p) => !hiddenIds.includes(p.id)), [foodPosts, hiddenIds]);

  return (
    <View className="flex-1 bg-surface">
      {/* Header — matches Home Feed */}
      <View className="flex-row items-center justify-between px-5 bg-surface" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text className="text-figma-20 font-inter-600 text-textPrimary" style={{ letterSpacing: -0.5 }}>susej</Text>
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <TouchableOpacity onPress={() => router.push('/notifications')}>
            <BellIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/search')}>
            <SearchIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View className="py-3 bg-surface">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5"
              contentContainerStyle={{ gap: 16 }}
            >
              {menuSellers.map((seller) => {
                const avatar = resolveAvatar(seller.username);
                return (
                  <TouchableOpacity
                    key={seller.username}
                    className="items-center"
                    style={{ width: 74 }}
                    onPress={() => openSeller(seller)}
                  >
                    <View className="w-[74px] h-[74px] rounded-full items-center justify-center" style={{ backgroundColor: colors.primaryContainer }}>
                      <View className="w-[68px] h-[68px] rounded-full bg-surface items-center justify-center overflow-hidden">
                        <Image source={avatar} className="w-[68px] h-[68px] rounded-full" />
                      </View>
                    </View>
                    <Text
                      className="text-figma-12 font-inter-500 text-textSecondary mt-2 text-center"
                      style={{ letterSpacing: 0.24 }}
                      numberOfLines={1}
                    >
                      {seller.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-5 py-3">
            <FoodPostCard item={item} onOpenSeller={openSeller} onHide={(id) => setHiddenIds((prev) => [...prev, id])} />
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 py-16">
            <Text className="text-figma-18 font-inter-700 text-textPrimary">No food near you yet</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary mt-2 text-center">
              When sellers list food items, they will show up here.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      />

      {menuSeller ? <SellerMenuSheet seller={menuSeller} onClose={() => setMenuSeller(null)} /> : null}
    </View>
  );
}
