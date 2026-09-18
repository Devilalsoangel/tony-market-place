import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Image, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, StarIcon, CheckIcon } from '../utils/icons';
import { colors } from '../utils/theme';
import { useOrders } from '../contexts/OrderContext';
import { useAuth } from '../contexts/AuthContext';
import { resolveListingImage } from '../utils/productImages';

export default function RateReviewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { getOrder, markReviewed } = useOrders();
  const { user } = useAuth();
  const order = params.id ? getOrder(String(params.id)) : undefined;
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const insets = useSafeAreaInsets();

  const firstItem = order?.items?.[0];
  const productName = firstItem ? firstItem.name : 'Your order';
  const sellerName = order ? `Seller: ${order.sellerName}` : '';
  // Real ordered-item photo — never a static stock tile.
  const productImage = firstItem
    ? firstItem?.imageUrl
      ? { uri: firstItem.imageUrl }
      : resolveListingImage(null, firstItem?.listingId ?? order.id)
    : null;
  // Reviews are delivery-gated AND buyer-gated: only delivered, unreviewed
  // orders qualify, and only the buyer can review (a seller deep-linking
  // /rate-review?id=<own-sale-id> gets a closed door here; the server 400s
  // non-buyers as the second lock, so self-5-stars can't inflate ratings).
  const me = (user?.username ?? '').trim().toLowerCase();
  const isBuyer = !!order && me !== '' && (order.buyerUsername ?? '').toLowerCase() === me;
  const reviewable = !!order && order.status === 'delivered' && !order.reviewed && isBuyer;

  if (!order) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-figma-18 font-inter-700 text-textPrimary">Write Review</Text>
          <View className="w-5" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-figma-18 font-inter-700 text-textPrimary">Order not found</Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary mt-2 text-center">
            We couldn't find an order to review. Open one from your order history to rate it.
          </Text>
          <TouchableOpacity className="mt-6 px-6 py-3 bg-primaryContainer rounded-figma-full" onPress={() => router.back()}>
            <Text className="text-figma-14 font-inter-600 text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!reviewable && !submitted) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-figma-18 font-inter-700 text-textPrimary">Write Review</Text>
          <View className="w-5" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-figma-18 font-inter-700 text-textPrimary">
            {order.reviewed ? 'Already reviewed' : !isBuyer ? 'Not your order' : 'Not deliverable yet'}
          </Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary mt-2 text-center">
            {order.reviewed
              ? 'You already shared feedback for this order.'
              : !isBuyer
                ? 'Only the buyer who received this order can rate it.'
                : 'You can rate this order once it is delivered.'}
          </Text>
          <TouchableOpacity className="mt-6 px-6 py-3 bg-primaryContainer rounded-figma-full" onPress={() => router.back()}>
            <Text className="text-figma-14 font-inter-600 text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const submit = async () => {
    if (!order || rating === 0 || submitting || !reviewable) return;
    setSubmitting(true);
    try {
      // Success renders ONLY after the server acks — a refusal (offline /
      // already-reviewed / not-delivered) rolls back underneath, so an early
      // success screen would lie and then lose the review on reopen.
      const ok = await markReviewed(order.id, rating, review, anonymous);
      if (ok) setSubmitted(true);
      else Alert.alert('Review not saved', 'Could not save your review. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-5"
            style={{ backgroundColor: colors.primaryContainer }}
          >
            <CheckIcon size={32} color={colors.onPrimaryContainer} />
          </View>
          <Text className="text-figma-18 font-inter-700 text-textPrimary mb-1">Review Submitted</Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary text-center mb-8">
            Thank you for sharing your feedback!
          </Text>

          <View
            className="w-full bg-surfaceContainerLowest rounded-figma-16 p-4 mb-4"
            style={{ shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-14 h-14 rounded-figma-8 bg-surfaceContainerLow mr-3 overflow-hidden">
                {productImage ? <Image source={productImage} className="w-full h-full" style={{ resizeMode: 'cover' }} /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary mb-0.5" numberOfLines={1}>{productName}</Text>
                <Text className="text-figma-12 font-inter-400 text-secondary">{sellerName}</Text>
              </View>
            </View>
            <View className="flex-row gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon key={star} size={18} color={star <= rating ? '#f59e0b' : '#d1d5db'} />
              ))}
            </View>
            {review.trim().length > 0 && (
              <Text className="text-figma-14 font-inter-400 text-textPrimary mb-3">{review}</Text>
            )}
            {anonymous && (
              <Text className="text-figma-12 font-inter-400 text-textTertiary mt-3">Posted anonymously</Text>
            )}
          </View>
        </View>

        <View className="px-4 pt-3" style={{ paddingBottom: insets.bottom + 32 }}>
          <TouchableOpacity
            className="w-full h-14 rounded-figma-16 bg-primaryContainer items-center justify-center"
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Text className="text-figma-16 font-inter-600 text-white">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-4" style={{ height: 52 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">Write Review</Text>
        <View className="w-5" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 128 }}>
        <View className="flex-row items-center bg-surfaceContainerLowest rounded-figma-12 p-4 mb-6"
          style={{ shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        >
          <View className="w-16 h-16 rounded-figma-8 bg-surfaceContainerLow mr-4 overflow-hidden">
            {productImage ? <Image source={productImage} className="w-full h-full" style={{ resizeMode: 'cover' }} /> : null}
          </View>
          <View>
            <Text className="text-figma-16 font-inter-600 text-textPrimary mb-1">{productName}</Text>
            <Text className="text-figma-14 font-inter-400 text-secondary">{sellerName}</Text>
          </View>
        </View>

        <Text className="text-figma-16 font-inter-600 text-textPrimary text-center mb-2">
          How was your experience?
        </Text>
        <Text className="text-figma-14 font-inter-400 text-textSecondary text-center mb-6">
          Tap a star to rate
        </Text>

        <View className="flex-row justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <StarIcon size={36} color={star <= rating ? '#f59e0b' : '#d1d5db'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-figma-16 font-inter-500 text-textSecondary mb-2">Share your thoughts</Text>
        <View className="bg-surfaceContainerLow rounded-figma-16 px-4 py-3 mb-6 min-h-[120px]">
          <TextInput
            className="text-figma-16 font-inter-400 text-textPrimary"
            placeholder="Tell us what you liked or disliked..."
            placeholderTextColor={colors.textTertiary}
            value={review}
            onChangeText={setReview}
            multiline
          />
        </View>

        <View className="flex-row items-center justify-between bg-surfaceContainerLowest rounded-figma-12 px-4 py-4 mb-6">
          <View>
            <Text className="text-figma-16 font-inter-500 text-textPrimary">Post Anonymously</Text>
            <Text className="text-figma-12 font-inter-400 text-textSecondary">Your name won't be shown</Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: colors.surfaceContainer, true: colors.primaryContainer }}
            thumbColor={colors.surfaceContainerLowest}
          />
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-surface px-4 pt-3 border-t border-surfaceContainer" style={{ paddingBottom: insets.bottom + 32 }}>
        <TouchableOpacity
          className={`w-full h-14 rounded-figma-16 items-center justify-center ${rating > 0 ? 'bg-primaryContainer' : 'bg-surfaceContainerLow'}`}
          disabled={rating === 0 || submitting}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimaryContainer} />
          ) : (
            <Text className={`text-figma-16 font-inter-600 ${rating > 0 ? 'text-white' : 'text-textSecondary'}`}>
              Submit Review
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
