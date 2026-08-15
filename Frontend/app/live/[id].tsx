import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, TextInput, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CloseIcon, SendIcon, StarIcon, HeartIcon } from '../../utils/icons';
import { colors, formatPrice, formatCount, radii } from '../../utils/theme';
import { usePosts, Post } from '../../contexts/PostContext';
import { useCart } from '../../contexts/CartContext';
import { productImages } from '../../utils/productImages';
import { LIVE_ROOMS, LiveRoom } from '../live';

function EyeIcon({ size = 12, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

function GiftIcon({ size = 22, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 7h20v5H2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7v14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7C9.5 7 7 5.5 7 3c0 0 5 .5 5 4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7c2.5 0 5-1.5 5-4 0 0-5 .5-5 4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CrownIcon({ size = 22, color = '#f59e0b' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 17.5L4.5 8l5 4.5L12 4l2.5 8.5 5-4.5 2 9.5H2.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 21h16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function RocketIcon({ size = 22, color = '#60a5fa' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c2.5 1.2 4.5 3.8 4.5 8.5 0 2-.8 3.8-1.8 5.1L12 18.5l-2.7-2.9C8.3 14.3 7.5 12.5 7.5 10.5 7.5 5.8 9.5 3.2 12 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="9.5" r="1.8" stroke={color} strokeWidth="2" />
      <Path d="M9.2 17.5l-1.7 4M14.8 17.5l1.7 4M12 15.8v4.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

const roomImage = (id: string): any => productImages[id] ?? { uri: `https://picsum.photos/seed/${id}/400/700` };

function imgSource(img: string | number | undefined | null): any {
  if (img === undefined || img === null) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string' && img) return { uri: img };
  return null;
}

interface ChatMessage {
  author: string;
  text: string;
}

interface GiftDef {
  id: string;
  label: string;
  price: number;
  icon: (size: number) => ReactNode;
}

interface ActiveGift {
  id: number;
  gift: GiftDef;
  sender?: string;
}

const GIFT_OPTIONS: GiftDef[] = [
  { id: 'star', label: 'Star', price: 10, icon: (size: number) => <StarIcon size={size} color={colors.categories.kids} /> },
  { id: 'heart', label: 'Heart', price: 25, icon: (size: number) => <HeartIcon size={size} color={colors.categories.beauty} /> },
  { id: 'crown', label: 'Crown', price: 99, icon: (size: number) => <CrownIcon size={size} color={colors.categories.fashion} /> },
  { id: 'rocket', label: 'Rocket', price: 199, icon: (size: number) => <RocketIcon size={size} color={colors.categories.electronics} /> },
];

const RECEIVED_SENDERS = ['Ananya', 'Rohit', 'Priya', 'Karan'];

function FloatingGift({ gift, sender, onDone }: { gift: GiftDef; sender?: string; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -28, duration: 1100, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => anim.stop();
  }, [opacity, scale, translateY]);

  return (
    <View className="absolute left-0 right-0 items-center" style={{ top: '38%' }} pointerEvents="none">
      <Animated.View className="items-center" style={{ opacity, transform: [{ scale }, { translateY }] }}>
        <View className="w-20 h-20 items-center justify-center rounded-full" style={{ backgroundColor: colors.overlay }}>
          {gift.icon(44)}
        </View>
        {sender ? (
          <Text className="font-inter-700 mt-2" style={{ fontSize: 12, lineHeight: 14, color: colors.surfaceContainerLowest, letterSpacing: 0.12 }}>
            {sender}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

export default function LiveRoomScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const room: LiveRoom = LIVE_ROOMS.find((r) => r.id === id) ?? LIVE_ROOMS[0];
  const insets = useSafeAreaInsets();
  const { posts } = usePosts();
  const { addToCart } = useCart();

  const [comments, setComments] = useState<ChatMessage[]>([
    { author: '@sarah', text: 'how much is shipping?' },
    { author: '@rahul', text: 'nice!' },
    { author: '@priya', text: 'can you hold one for me?' },
  ]);
  const [draft, setDraft] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);
  const [activeGifts, setActiveGifts] = useState<ActiveGift[]>([]);
  const giftSeqRef = useRef(0);
  const receivedIdxRef = useRef(0);

  // Pulsing LIVE dot
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const imageSource = imgSource(roomImage(room.id)) ?? { uri: `https://picsum.photos/seed/${room.id}/400/700` };

  const sendComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => [...prev, { author: '@you', text }]);
    setDraft('');
  };

  const spawnGift = (gift: GiftDef, sender?: string) => {
    const id = giftSeqRef.current;
    giftSeqRef.current += 1;
    setActiveGifts((prev) => [...prev, { id, gift, sender }]);
  };

  const removeGift = (id: number) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== id));
  };

  const sendGift = (gift: GiftDef) => {
    // No wallet deduction — mock balance not wired up (noted: real top-up pending)
    setComments((prev) => [...prev, { author: 'You', text: `sent a ${gift.label} gift` }]);
    spawnGift(gift);
    setTrayOpen(false);
  };

  // Received gifts mock — one every ~20s
  useEffect(() => {
    const timer = setInterval(() => {
      const sender = RECEIVED_SENDERS[receivedIdxRef.current % RECEIVED_SENDERS.length];
      receivedIdxRef.current += 1;
      const gift = GIFT_OPTIONS[Math.floor(Math.random() * GIFT_OPTIONS.length)];
      setComments((prev) => [...prev, { author: sender, text: `sent a ${gift.label} gift` }]);
      spawnGift(gift, sender);
    }, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = (post: Post) => {
    addToCart({
      listingId: post.id,
      type: 'product',
      name: post.description.split('#')[0].trim(),
      price: post.price,
      seller: post.sellerName,
      sellerUsername: post.sellerUsername,
    });
    router.push('/cart');
  };

  const railPosts = posts.slice(0, 6);

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: colors.inverseSurface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1">
        {/* Video area */}
        <View className="flex-1">
          <Image source={imageSource} className="absolute inset-0 w-full h-full" resizeMode="cover" />
          <LinearGradient colors={['transparent', colors.inverseSurface]} className="absolute left-0 right-0 bottom-0" style={{ height: 140 }} />

          {/* Top bar */}
          <View className="absolute top-0 left-0 right-0 flex-row items-center px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-9 h-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.overlay }}>
              <CloseIcon size={18} color={colors.surfaceContainerLowest} />
            </TouchableOpacity>
            <View className="flex-1 flex-row items-center ml-3" style={{ gap: 8 }}>
              <View className="w-8 h-8 rounded-full overflow-hidden bg-surfaceContainer">
                <Image source={{ uri: `https://picsum.photos/seed/${room.sellerUsername}/80/80` }} className="w-full h-full" resizeMode="cover" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Text className="font-inter-700 text-white" style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.14 }} numberOfLines={1}>
                    {room.sellerName}
                  </Text>
                  <View className="px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: colors.error }}>
                    <Text className="font-inter-700" style={{ fontSize: 10, lineHeight: 12, color: colors.onError, letterSpacing: 0.4 }}>LIVE</Text>
                  </View>
                </View>
                <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                  <EyeIcon size={11} color={colors.surfaceContainerLowest} />
                  <Text className="font-inter-500" style={{ fontSize: 11, lineHeight: 13, color: colors.surfaceContainerLowest }}>
                    {formatCount(room.viewers)} watching
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pulsing LIVE dot overlay */}
          <View className="absolute top-0 left-0 right-0 items-center" style={{ marginTop: 64 + insets.top }}>
            <View className="flex-row items-center px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.overlay, gap: 6 }}>
              <Animated.View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.error, opacity: pulse }} />
              <Text className="font-inter-700" style={{ fontSize: 12, lineHeight: 14, color: colors.surfaceContainerLowest, letterSpacing: 0.5 }}>
                LIVE
              </Text>
            </View>
          </View>

          {/* Room title at bottom of video */}
          <View className="absolute left-4 right-4" style={{ bottom: 12 }}>
            <Text className="font-inter-700 text-white" style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16 }}>
              {room.title}
            </Text>
          </View>

          {/* Floating gift animations */}
          {activeGifts.map((g) => (
            <FloatingGift key={g.id} gift={g.gift} sender={g.sender} onDone={() => removeGift(g.id)} />
          ))}
        </View>

        {/* Bottom panel — product rail + chat */}
        <View style={{ paddingBottom: insets.bottom + 8 }}>
          {/* Product rail */}
          <View className="py-3">
            <Text className="font-inter-700 text-white px-4 mb-2" style={{ fontSize: 14, lineHeight: 18, letterSpacing: 0.14 }}>
              Shop this live
            </Text>
            {railPosts.length === 0 ? (
              <View className="flex-row items-center px-4" style={{ gap: 10 }}>
                <ActivityIndicator size="small" color={colors.primaryContainer} />
                <Text className="font-inter-400" style={{ fontSize: 13, lineHeight: 18, color: colors.inverseOnSurface }}>
                  Loading products...
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={railPosts}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-4"
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="w-28 rounded-figma-16 overflow-hidden"
                    style={{ backgroundColor: colors.surfaceContainer }}
                    onPress={() => router.push(`/product/${item.id}`)}
                  >
                    <View className="w-full aspect-square bg-surfaceContainer">
                      <Image
                        source={imgSource(productImages[item.id]) ?? { uri: `https://picsum.photos/seed/${item.id}/200/200` }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    </View>
                    <View className="p-2">
                      <Text className="font-inter-600 text-white" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
                        {formatPrice(item.price)}
                      </Text>
                      <Text className="font-inter-400" style={{ fontSize: 11, lineHeight: 14, color: colors.inverseOnSurface }} numberOfLines={1}>
                        {item.sellerName}
                      </Text>
                      <TouchableOpacity className="self-start mt-1.5 px-3 py-1.5 rounded-full bg-primaryContainer" onPress={() => handleBuy(item)}>
                        <Text className="text-white font-inter-700" style={{ fontSize: 11, lineHeight: 13, letterSpacing: 0.14 }}>
                          Buy Now
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Chat */}
          <View className="px-4">
            <ScrollView style={{ maxHeight: 104 }} showsVerticalScrollIndicator={false}>
              {comments.map((c, i) => (
                <View key={`${c.author}-${i}`} className="mb-1.5 flex-row" style={{ gap: 6 }}>
                  <Text className="font-inter-700" style={{ fontSize: 13, lineHeight: 18, color: colors.primaryFixedDim }}>
                    {c.author}
                  </Text>
                  <Text className="font-inter-400 flex-1" style={{ fontSize: 13, lineHeight: 18, color: colors.inverseOnSurface }}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View className="flex-row items-center rounded-full px-3 py-1 my-2" style={{ backgroundColor: colors.surfaceContainer, gap: 8 }}>
              <TouchableOpacity onPress={() => setTrayOpen(true)} hitSlop={8} className="w-9 h-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.primaryContainer }}>
                <GiftIcon size={17} color={colors.onPrimary} />
              </TouchableOpacity>
              <TextInput
                className="flex-1 font-inter-400 h-9 text-white"
                style={{ fontSize: 14 }}
                placeholder="Say something..."
                placeholderTextColor={colors.inverseOnSurface}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendComment}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={sendComment} hitSlop={8}>
                <SendIcon size={18} color={draft.trim() ? colors.primaryFixedDim : colors.inverseOnSurface} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Gift tray bottom sheet */}
        {trayOpen && (
          <View className="absolute inset-0" style={{ zIndex: 20 }}>
            <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={() => setTrayOpen(false)} style={{ backgroundColor: colors.overlay }} />
            <View
              className="absolute left-0 right-0"
              style={{
                bottom: 0,
                paddingTop: 20,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 20,
                backgroundColor: colors.surfaceContainerLowest,
                borderTopLeftRadius: radii.xxl,
                borderTopRightRadius: radii.xxl,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-inter-700" style={{ fontSize: 16, lineHeight: 20, color: colors.textPrimary, letterSpacing: 0.16 }}>
                  Send a gift
                </Text>
                <TouchableOpacity onPress={() => setTrayOpen(false)} hitSlop={8}>
                  <CloseIcon size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                {GIFT_OPTIONS.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    className="flex-1 items-center"
                    style={{ paddingVertical: 14, borderRadius: radii.lg, backgroundColor: colors.surfaceContainerLow }}
                    onPress={() => sendGift(g)}
                  >
                    <View className="w-12 h-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.primaryBg }}>
                      {g.icon(26)}
                    </View>
                    <Text className="font-inter-600 mt-2" style={{ fontSize: 13, lineHeight: 16, color: colors.textPrimary }}>
                      {g.label}
                    </Text>
                    <Text className="font-inter-500 mt-0.5" style={{ fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
                      {formatPrice(g.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
