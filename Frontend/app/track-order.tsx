import { View, Text, ScrollView, TouchableOpacity, Image, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, ShareIcon, MapPinIcon, ShopIcon, PhoneIcon, GpsTargetIcon, CheckIcon, CarIcon, BikeIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders, STATUS_LABELS } from '../contexts/OrderContext';
import { resolveListingImage } from '../utils/productImages';
import { trackOrderImages } from '../utils/screenImages';
import { LeafletMapHost, type LeafletMarker } from '../components/LeafletMap';

const CENTER = { latitude: 18.5204, longitude: 73.8567 };

const pillShadow = {
  shadowColor: '#1a1a2e',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
};

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const positionFor = (key: string) => {
  const h = hashId(key);
  return {
    latitude: CENTER.latitude + ((h % 1000) / 1000 - 0.5) * 0.06,
    longitude: CENTER.longitude + (((h >> 10) % 1000) / 1000 - 0.5) * 0.06,
  };
};

export default function TrackOrderScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { orders, getOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  // No id must not leak another user's order — show empty state instead.
  const order = rawId ? getOrder(String(rawId)) : undefined;

  const isLiveOrder = !!order && ['placed', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status);
  const scrollRef = useRef<ScrollView>(null);
  const [mapY, setMapY] = useState(0);

  // No simulated rider movement — the map shows the honest pickup → delivery
  // overview; live rider GPS arrives with a real logistics integration.

  const trackMarkers = useMemo<LeafletMarker[]>(() => {
    if (!order) return [];
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    return [
      { id: 'pickup', lat: pickup.latitude, lng: pickup.longitude, kind: 'office', color: '#0369a1' },
      { id: 'delivery', lat: delivery.latitude, lng: delivery.longitude, kind: 'pin', color: '#0e7a5f' },
    ];
  }, [order]);

  const trackRoute = useMemo(() => {
    if (!order) return null;
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    return [
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: (pickup.latitude + delivery.latitude) / 2, longitude: (pickup.longitude + delivery.longitude) / 2 },
      { latitude: delivery.latitude, longitude: delivery.longitude },
    ];
  }, [order]);

  const tickRef = useRef(0);
  const progressRef = useRef(0.35);

  const [trackCenter, setTrackCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(() => {
    if (!order) return null;
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    return {
      lat: (pickup.latitude + delivery.latitude) / 2,
      lng: (pickup.longitude + delivery.longitude) / 2,
      zoom: 13,
    };
  });

  // Reset the map frame when a different order is opened.
  useEffect(() => {
    if (!order) return;
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    setTrackCenter({
      lat: (pickup.latitude + delivery.latitude) / 2,
      lng: (pickup.longitude + delivery.longitude) / 2,
      zoom: 13,
    });
  }, [order?.id]);

  if (!order) {
    return (
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between px-4 border-b border-surfaceContainer" style={{ height: 64 + insets.top, paddingTop: insets.top }}>
          <TouchableOpacity onPress={() => router.back()}>
            <BackIcon size={20} color={colors.primaryContainer} />
          </TouchableOpacity>
          <Text className="text-figma-18 font-inter-700 text-textPrimary">Track Order</Text>
          <ShareIcon size={20} color={colors.textSecondary} />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-figma-18 font-inter-700 text-textPrimary">Order not found</Text>
          <Text className="text-figma-14 font-inter-400 text-textSecondary mt-2 text-center">
            We couldn't find this order. It may have been removed or is no longer available.
          </Text>
          <TouchableOpacity className="mt-6 px-6 py-3 bg-primaryContainer rounded-figma-full" onPress={() => router.back()}>
            <Text className="text-figma-14 font-inter-600 text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const steps = order.tracking.map((s) => ({ label: s.label, date: s.time, done: s.done }));
  // The CURRENT step is the last COMPLETED one (real server state), not the next upcoming step - otherwise the timeline always runs one step ahead of the header.
  const currentIdx = steps.reduce((acc, s, i) => (s.done ? i : acc), 0);

  const statusLabel = STATUS_LABELS[order.status];
  const orderNumber = order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderDate = new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const etaLine =
    order.status === 'delivered'
      ? `Delivered on ${orderDate}`
      : order.status === 'cancelled'
        ? 'Order cancelled'
        : statusLabel;

  // Real booking slot when the order carries one — no invented dates.
  const appointmentLine = order.bookingDate
    ? `${order.bookingDate}${order.bookingTime ? ` · ${order.bookingTime}` : ''}`
    : null;

  const product = order.items[0];
  const productName = product.name;
  const productPrice = formatPrice(product.price);
  const quantity = product.quantity;
  const _firstItem = (order as any)?.items?.[0] as any;
  const productImage = _firstItem?.imageUrl ? { uri: _firstItem.imageUrl } : resolveListingImage(null, _firstItem?.listingId ?? (order as any)?.id);

  const isLive = ['placed', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status);

  const handleShare = () => {
    Share.share({
      title: `Order ${orderNumber}`,
      message: `Order ${orderNumber} (${statusLabel}) — ${productName} x ${quantity} at ${productPrice}.`,
    }).catch(() => {});
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 border-b border-surfaceContainer bg-surface" style={{ height: 64 + insets.top, paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()}>
          <BackIcon size={20} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-textPrimary">Track Order</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={8}>
          <ShareIcon size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 128 }}
      >
        <View className="px-4 pt-4 pb-6 border-b border-surfaceContainer">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-figma-18 font-inter-700 text-textPrimary">Order {orderNumber}</Text>
            <View className="px-3 py-1 bg-primaryContainer rounded-figma-full">
              <Text className="text-figma-10 font-inter-600 text-white">{statusLabel}</Text>
            </View>
          </View>
          <Text className="text-figma-16 font-inter-500 text-success">{etaLine}</Text>
        </View>

        {isLive && order.kind === 'food' && (
          <View className="mx-4 mt-4 bg-surfaceContainerLow rounded-figma-16 p-4">
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-figma-full bg-surfaceContainer items-center justify-center mr-3">
                <GpsTargetIcon size={20} color={colors.primaryContainer} />
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary">Delivery partner on the way</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">
                  Live rider tracking arrives with real logistics
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="mt-3 h-20 bg-surfaceContainer rounded-figma-12 flex-row items-center justify-center"
              onPress={() => scrollRef.current?.scrollTo({ y: mapY, animated: true })}
            >
              <MapPinIcon size={18} color={colors.primaryContainer} />
              <Text className="text-figma-13 font-inter-600 text-primaryContainer ml-2">Route Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLive && order.kind === 'order' && (
          <View className="mx-4 mt-4 bg-surfaceContainerLow rounded-figma-16 p-4">
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-figma-full bg-surfaceContainer items-center justify-center mr-3">
                <ShopIcon size={18} color={colors.primaryContainer} />
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary">{order.sellerName || 'Seller'}</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">Sold by this seller · updates below</Text>
              </View>
              <View className="px-3 py-1 bg-primaryContainer rounded-figma-full">
                <Text className="text-figma-10 font-inter-600 text-white">{statusLabel}</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-surfaceContainer">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Order</Text>
              <Text className="text-figma-12 font-inter-600 text-primaryContainer">{orderNumber}</Text>
            </View>
          </View>
        )}

        {isLive && order.kind === 'booking' && (
          <View className="mx-4 mt-4 bg-surfaceContainerLow rounded-figma-16 p-4">
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-figma-full bg-surfaceContainer items-center justify-center mr-3">
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="4.5" width="18" height="17" rx="2.5" stroke={colors.primaryContainer} strokeWidth="2" />
                  <Path d="M3 9H21" stroke={colors.primaryContainer} strokeWidth="2" />
                  <Path d="M8 2.5V6.5M16 2.5V6.5" stroke={colors.primaryContainer} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
              <View className="flex-1">
                <Text className="text-figma-14 font-inter-600 text-textPrimary">Appointment Scheduled</Text>
                {appointmentLine ? (
                  <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">{appointmentLine}</Text>
                ) : null}
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-surfaceContainer">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Meetup</Text>
              <Text className="text-figma-12 font-inter-600 text-textPrimary">
                {order.address ? `Deliver to ${order.address}` : 'Arranged with seller in chat'}
              </Text>
            </View>
          </View>
        )}

        {isLive ? (
        <>
          <View className="px-4 py-6">
            <Text className="text-figma-16 font-inter-600 text-textPrimary mb-6">Order Progress</Text>

            <View className="ml-2">
              {steps.map((step, i) => {
                const isActive = i === currentIdx;
                const isDone = i < currentIdx;
                return (
                  <View key={step.label} className="flex-row mb-2">
                    <View className="items-center mr-4">
                      <View className={`w-4 h-4 rounded-full ${isActive ? 'bg-primaryContainer' : isDone ? 'bg-primaryContainer/50' : 'bg-surfaceContainer'} border-2 ${isActive ? 'border-primaryContainer' : 'border-surfaceContainer'}`} />
                      {i < steps.length - 1 && (
                        <View className={`w-0.5 flex-1 my-1 ${isDone ? 'bg-primaryContainer/50' : 'bg-surfaceContainer'}`} />
                      )}
                    </View>
                    <View className="flex-1 pb-4">
                      <Text className={`text-figma-14 font-inter-600 ${isActive ? 'text-primaryContainer' : 'text-textPrimary'}`}>
                        {step.label}
                      </Text>
                      <Text className="text-figma-12 font-inter-400 text-textSecondary">{step.date}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className="mx-4 h-52 mb-6 rounded-figma-16 overflow-hidden"
            style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}
            onLayout={(e) => setMapY(e.nativeEvent.layout.y)}
          >
            <LeafletMapHost
              style={{ flex: 1, borderRadius: 16 }}
              markers={trackMarkers}
              route={trackRoute}
              center={trackCenter}
            />
            <View className="absolute left-3 bottom-2 px-2.5 py-1 rounded-figma-full bg-surfaceContainerLowest" style={pillShadow}>
              <Text className="text-figma-10 font-inter-500 text-textSecondary">
                Approximate route preview - exact addresses hidden until pickup is confirmed
              </Text>
            </View>
          </View>
        </>
      ) : order.status === 'delivered' ? (
        <View className="mx-4 mt-4 mb-6 bg-surfaceContainerLow rounded-figma-16 p-4">
          <View className="flex-row items-center mb-4">
            <View className="w-11 h-11 rounded-figma-full bg-surfaceContainer items-center justify-center mr-3">
              <CheckIcon size={20} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text className="text-figma-14 font-inter-600 text-textPrimary">Delivered</Text>
              <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">Delivered on {orderDate}</Text>
            </View>
          </View>
          {!order.reviewed && (
            <TouchableOpacity
              className="h-11 rounded-figma-12 bg-primaryContainer items-center justify-center mb-3"
              onPress={() => router.push(`/rate-review?id=${order.id}`)}
            >
              <Text className="text-figma-14 font-inter-600 text-white">Rate & Review</Text>
            </TouchableOpacity>
          )}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 h-11 rounded-figma-12 bg-surfaceContainer items-center justify-center"
              onPress={() => router.push(`/refund/${order.id}`)}
            >
              <Text className="text-figma-13 font-inter-600 text-textPrimary">Return</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 h-11 rounded-figma-12 bg-surfaceContainer items-center justify-center"
              onPress={() => router.push('/support')}
            >
              <Text className="text-figma-13 font-inter-600 text-textPrimary">Help</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="mx-4 mt-4 mb-6 bg-surfaceContainerLow rounded-figma-16 p-4">
          <Text className="text-figma-16 font-inter-600 text-textPrimary mb-1">Order Cancelled</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary mb-4">
            {String(order.paymentMethod ?? '').toLowerCase() === 'cod'
              ? 'This order was cancelled. No advance was paid (cash on delivery) — nothing to refund.'
              : order.refund
                ? `This order was cancelled. Refund ${order.refund.status === 'refunded' ? 'issued to your wallet' : `status: ${order.refund.status}`}.`
                : 'This order was cancelled. Any amount paid will be refunded to your wallet.'}
          </Text>
          <TouchableOpacity
            className="h-11 rounded-figma-12 bg-surfaceContainer items-center justify-center"
            onPress={() => router.push('/support')}
          >
            <Text className="text-figma-13 font-inter-600 text-textPrimary">Contact support</Text>
          </TouchableOpacity>
        </View>
      )}

        <View className="mx-4 bg-surfaceContainerLow rounded-figma-16 p-4">
          <View className="flex-row items-center mb-4 pb-4 border-b border-surfaceContainer">
            <View className="w-16 h-16 rounded-figma-8 bg-surfaceContainer mr-3 overflow-hidden">
              {productImage ? <Image source={productImage} className="w-full h-full" style={{ resizeMode: 'cover' }} /> : null}
            </View>
            <View className="flex-1">
              <Text className="text-figma-16 font-inter-600 text-textPrimary mb-1">{productName}</Text>
              <Text className="text-figma-14 font-inter-700 text-primaryContainer">{productPrice}</Text>
            </View>
          </View>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Order Date</Text>
              <Text className="text-figma-12 font-inter-500 text-textPrimary">{orderDate}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Quantity</Text>
              <Text className="text-figma-12 font-inter-500 text-textPrimary">{quantity}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Payment</Text>
              {/cash|cod/i.test(order.paymentMethod ?? '') ? (
                <Text className="text-figma-12 font-inter-500 text-textSecondary">Pay on delivery</Text>
              ) : (
                <Text className="text-figma-12 font-inter-500 text-success">Paid</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
