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
import { productImages } from '../utils/productImages';
import { foodHubImages } from '../utils/screenImages';

interface FoodMenuItem {
  id: string;
  name: string;
  price: number;
  desc: string;
  time: string;
  rating: number;
  veg?: boolean;
}

interface VendorMenu {
  name: string;
  username: string;
  rating: number;
  time: string;
  tags: string;
  items: FoodMenuItem[];
}

const VENDOR_MENUS: VendorMenu[] = [
  {
    name: 'Artisan Burger Loft',
    username: 'artisan_burger_loft',
    rating: 4.8,
    time: '25 min',
    tags: 'Gourmet • Burgers • $$$',
    items: [
      { id: 'food_001', name: 'Classic Smash Burger', price: 349, desc: 'Double patty, cheddar, house sauce', time: '20-25 min', rating: 4.8 },
      { id: 'food_002', name: 'Veggie Garden Burger', price: 249, desc: 'Grilled veg patty, avocado, aioli', time: '20-25 min', rating: 4.6, veg: true },
      { id: 'food_003', name: 'Truffle Parmesan Fries', price: 199, desc: 'Crispy fries, truffle oil, parmesan', time: '10 min', rating: 4.7, veg: true },
      { id: 'food_004', name: 'BBQ Chicken Wings (6pc)', price: 299, desc: 'Sticky BBQ glaze, sesame seeds', time: '15-20 min', rating: 4.5 },
    ],
  },
  {
    name: 'Sakura Sushi Bar',
    username: 'sakura_sushi',
    rating: 4.9,
    time: '32 min',
    tags: 'Japanese • Fresh • $$$$',
    items: [
      { id: 'food_005', name: 'Salmon Nigiri (6pc)', price: 549, desc: 'Fresh salmon over seasoned rice', time: '25-30 min', rating: 4.9 },
      { id: 'food_006', name: 'California Roll (8pc)', price: 429, desc: 'Crab stick, avocado, cucumber', time: '25-30 min', rating: 4.8 },
      { id: 'food_007', name: 'Spicy Tuna Roll (8pc)', price: 469, desc: 'Tuna, spicy mayo, chili crisp', time: '25-30 min', rating: 4.7 },
      { id: 'food_008', name: 'Miso Soup', price: 149, desc: 'Tofu, wakame, spring onion', time: '10 min', rating: 4.6, veg: true },
    ],
  },
  {
    name: 'Green Bowl Kitchen',
    username: 'green_bowl',
    rating: 4.7,
    time: '15-20 min',
    tags: 'Healthy • Salads • $$',
    items: [
      { id: 'food_009', name: 'Quinoa Buddha Bowl', price: 329, desc: 'Quinoa, chickpeas, roasted veg, tahini', time: '15-20 min', rating: 4.7, veg: true },
      { id: 'food_010', name: 'Grilled Chicken Salad', price: 349, desc: 'Charred chicken, greens, citrus dressing', time: '15-20 min', rating: 4.6 },
      { id: 'food_011', name: 'Avocado Toast', price: 249, desc: 'Sourdough, smashed avocado, chili flakes', time: '10 min', rating: 4.8, veg: true },
      { id: 'food_012', name: 'Detox Green Juice', price: 179, desc: 'Kale, apple, ginger, lemon', time: '5 min', rating: 4.5, veg: true },
    ],
  },
  {
    name: 'Fire & Dough',
    username: 'fire_dough',
    rating: 4.6,
    time: '25-30 min',
    tags: 'Wood-fired • Pizza • $$$',
    items: [
      { id: 'food_013', name: 'Margherita Pizza', price: 399, desc: 'San Marzano tomato, fresh basil, mozzarella', time: '20-25 min', rating: 4.6, veg: true },
      { id: 'food_014', name: 'Pepperoni Pizza', price: 449, desc: 'Double pepperoni, smoked mozzarella', time: '20-25 min', rating: 4.7 },
      { id: 'food_015', name: 'Garlic Breadsticks', price: 149, desc: 'Garlic butter, parmesan, oregano', time: '10-15 min', rating: 4.5, veg: true },
      { id: 'food_016', name: 'Tiramisu Cup', price: 199, desc: 'Espresso-soaked ladyfingers, mascarpone', time: '5 min', rating: 4.8, veg: true },
    ],
  },
  {
    name: 'The Boulangerie',
    username: 'boulangerie',
    rating: 4.9,
    time: '10 min',
    tags: 'Bakery • Fresh daily • $$',
    items: [
      { id: 'food_017', name: 'Sourdough Loaf', price: 220, desc: '48h fermented, crusty outside, soft crumb', time: '10 min', rating: 4.9, veg: true },
      { id: 'food_018', name: 'Butter Croissant', price: 120, desc: 'Flaky, golden, French butter', time: '10 min', rating: 4.8, veg: true },
      { id: 'food_019', name: 'Blueberry Muffin', price: 95, desc: 'Bursting blueberries, streusel top', time: '10 min', rating: 4.6, veg: true },
      { id: 'food_020', name: 'Almond Pain au Chocolat', price: 150, desc: 'Dark chocolate, toasted almonds', time: '10 min', rating: 4.7, veg: true },
    ],
  },
  {
    name: 'Frost & Bean',
    username: 'frost_bean',
    rating: 4.5,
    time: '20 min',
    tags: 'Cafe • Coffee • Desserts',
    items: [
      { id: 'food_021', name: 'Vanilla Latte', price: 210, desc: 'Double shot, steamed milk, vanilla', time: '10-15 min', rating: 4.6, veg: true },
      { id: 'food_022', name: 'Cold Brew', price: 180, desc: '18h slow-steeped, served over ice', time: '10 min', rating: 4.5, veg: true },
      { id: 'food_023', name: 'Iced Mocha', price: 230, desc: 'Espresso, dark chocolate, whipped cream', time: '10-15 min', rating: 4.4, veg: true },
      { id: 'food_024', name: 'Chocolate Fudge Brownie', price: 140, desc: 'Warm, fudgy, served with cream', time: '5 min', rating: 4.7, veg: true },
    ],
  },
];

function foodImage(item: FoodMenuItem) {
  const n = parseInt(item.id.replace(/\D+/g, ''), 10);
  const idx = (Number.isNaN(n) ? 1 : n) - 1;
  return productImages[item.id] ?? foodHubImages.popular[idx % foodHubImages.popular.length];
}

// Deterministic engagement numbers so every card looks alive but stable across renders
function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h;
}

function ClockMini({ size = 12, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
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
  vendor?: VendorMenu; // present → open vendor menu sheet on tap
  postId?: string; // present → deep-link to /product/{postId}
}

function FoodPostCard({ item, onOpenVendor, onHide }: { item: FoodPost; onOpenVendor: (v: VendorMenu) => void; onHide: (id: string) => void }) {
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
    if (item.vendor) onOpenVendor(item.vendor);
    else if (item.postId) router.push(`/product/${item.postId}`);
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
        onPress: () => {
          if (postId) reportPost(postId, 'Misleading or inappropriate listing');
          Alert.alert('Reported', 'Thanks — our team will review this post.');
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
      <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (item.vendor) onOpenVendor(item.vendor); else if (item.postId) router.push(`/seller/${item.sellerUsername}`); }} className="flex-row items-center px-4 h-[72px]">
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
              {item.sellerLocation} • {item.time} delivery
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

        <View className="flex-row items-center gap-1.5 mb-3">
          <StarIcon size={12} color="#f59e0b" />
          <Text className="font-inter-700 text-textPrimary" style={{ fontSize: 12, lineHeight: 14 }}>{item.rating.toFixed(1)}</Text>
          <Text className="font-inter-500 text-textSecondary" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.24 }}>
            • {formatPrice(item.price)} • {item.time}
          </Text>
        </View>

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

function VendorMenuSheet({ vendor, onClose }: { vendor: VendorMenu; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { cart, addToCart } = useCart();
  const [selected, setSelected] = useState<FoodMenuItem | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const inCart = (id: string) => cart.some((i) => i.listingId === id);

  const handleAdd = (item: FoodMenuItem) => {
    addToCart({
      listingId: item.id,
      type: 'food_item',
      name: item.name,
      price: item.price,
      seller: vendor.name,
      sellerUsername: vendor.username,
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
                  {vendor.name}
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
                    <View className="flex-row items-center gap-1">
                      <StarIcon size={14} color="#f59e0b" />
                      <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textPrimary }}>
                        {selected.rating}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <ClockMini size={12} />
                      <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textSecondary }}>
                        {selected.time}
                      </Text>
                    </View>
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
              {/* Vendor header */}
              <View className="px-5 pt-2 pb-4">
                <Text className="text-[20px]" style={{ fontFamily: 'Inter_700Bold', lineHeight: 28, color: colors.textPrimary }}>
                  {vendor.name}
                </Text>
                <View className="flex-row items-center gap-3 mt-1">
                  <View className="flex-row items-center gap-1">
                    <StarIcon size={12} color="#f59e0b" />
                    <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textPrimary }}>
                      {vendor.rating}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <ClockMini size={12} />
                    <Text className="text-[12px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 14, color: colors.textSecondary }}>
                      {vendor.time}
                    </Text>
                  </View>
                  <Text className="text-[12px]" numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', lineHeight: 14, color: colors.textSecondary, flexShrink: 1 }}>
                    {vendor.tags}
                  </Text>
                </View>
              </View>
              <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                {vendor.items.length === 0 ? (
                  <View className="px-5 py-10 items-center">
                    <Text className="text-[14px]" style={{ fontFamily: 'Inter_400Regular', lineHeight: 20, color: colors.textSecondary }}>
                      No items on this menu yet.
                    </Text>
                  </View>
                ) : (
                  vendor.items.map((item) => (
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
                        <Text className="text-[10px]" style={{ fontFamily: 'Inter_500Medium', lineHeight: 12, color: colors.textSecondary }}>
                          {item.time}
                        </Text>
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
  const [menuVendor, setMenuVendor] = useState<VendorMenu | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const openVendor = (v: VendorMenu) => setMenuVendor(v);

  // Food "posts" — real food_item posts from the feed (e.g. post_005) + vendor menu items
  const foodPosts = useMemo<FoodPost[]>(() => {
    const fromPosts: FoodPost[] = posts
      .filter((p) => p.type === 'food_item')
      .map((p: Post) => ({
        id: p.id,
        name: p.description.split('\n')[0],
        desc: p.description.replace(/\n/g, ' '),
        price: p.price,
        time: '30-40 min',
        rating: 4.6,
        sellerName: p.sellerName,
        sellerUsername: p.sellerUsername,
        sellerLocation: p.sellerLocation,
        verified: p.verified,
        likes: p.likes,
        comments: p.comments,
        image: p.image ?? productImages[p.id],
        postId: p.id,
      }));

    const fromMenus: FoodPost[] = VENDOR_MENUS.flatMap((v) =>
      v.items.map((item) => {
        const seed = hashSeed(item.id);
        const likes = 120 + seed;
        return {
          id: item.id,
          name: item.name,
          desc: item.desc,
          price: item.price,
          time: item.time,
          rating: item.rating,
          veg: item.veg,
          sellerName: v.name,
          sellerUsername: v.username,
          sellerLocation: 'Pune',
          verified: true,
          likes,
          comments: Math.max(12, Math.round(likes / 8)),
          image: foodImage(item),
          vendor: v,
        };
      })
    );

    return [...fromPosts, ...fromMenus];
  }, [posts]);

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
              {VENDOR_MENUS.map((vendor, i) => {
                const avatar = productImages[vendor.items[0].id] ?? foodHubImages.featured[i % foodHubImages.featured.length];
                return (
                  <TouchableOpacity
                    key={vendor.username}
                    className="items-center"
                    style={{ width: 74 }}
                    onPress={() => openVendor(vendor)}
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
                      {vendor.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-5 py-3">
            <FoodPostCard item={item} onOpenVendor={openVendor} onHide={(id) => setHiddenIds((prev) => [...prev, id])} />
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 py-16">
            <Text className="text-figma-18 font-inter-700 text-textPrimary">No food near you yet</Text>
            <Text className="text-figma-14 font-inter-400 text-textSecondary mt-2 text-center">
              Check back soon — new vendors are joining every day.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      />

      {menuVendor ? <VendorMenuSheet vendor={menuVendor} onClose={() => setMenuVendor(null)} /> : null}
    </View>
  );
}
