import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, ShareIcon, MapPinIcon, ShopIcon, PhoneIcon, GpsTargetIcon, CheckIcon, CarIcon, BikeIcon } from '../utils/icons';
import { colors, formatPrice } from '../utils/theme';
import { useOrders, STATUS_LABELS } from '../contexts/OrderContext';
import { productImages } from '../utils/productImages';
import { trackOrderImages } from '../utils/screenImages';
import { LeafletMapHost, type LeafletMarker } from '../components/LeafletMap';

const COURIER_NAMES = ['Delhivery', 'BlueDart', 'Shiprocket', 'DTDC', 'Ecom Express'];
const RIDER_NAMES = ['Rahul', 'Amit', 'Suresh', 'Vikram', 'Imran'];
const RIDER_RATING = '4.2';
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
  const order = rawId ? getOrder(String(rawId)) : orders[0];

  const isLiveOrder = !!order && ['placed', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status);
  const [transportMode, setTransportMode] = useState<'car' | 'bike' | 'person'>(() =>
    order?.kind === 'food' ? 'bike' : order?.kind === 'booking' ? 'person' : 'car'
  );
  const riderKind = transportMode;
  const [riderProgress, setRiderProgress] = useState(0.35);
  const scrollRef = useRef<ScrollView>(null);
  const [mapY, setMapY] = useState(0);

  useEffect(() => {
    if (!isLiveOrder) return;
    const iv = setInterval(() => setRiderProgress((p) => Math.min(0.92, p + 0.015)), 1500);
    return () => clearInterval(iv);
  }, [isLiveOrder]);

  const trackMarkers = useMemo<LeafletMarker[]>(() => {
    if (!order) return [];
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    const rider = {
      latitude: pickup.latitude + (delivery.latitude - pickup.latitude) * riderProgress,
      longitude: pickup.longitude + (delivery.longitude - pickup.longitude) * riderProgress,
    };
    return [
      { id: 'pickup', lat: pickup.latitude, lng: pickup.longitude, kind: 'office', color: '#0369a1' },
      { id: 'rider', lat: rider.latitude, lng: rider.longitude, kind: riderKind as LeafletMarker['kind'], color: '#4343d5' },
      { id: 'delivery', lat: delivery.latitude, lng: delivery.longitude, kind: 'pin', color: '#0e7a5f' },
    ];
  }, [order, riderProgress, riderKind]);

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

  const trackCenter = useMemo(() => {
    if (!order) return null;
    const pickup = positionFor(`pickup:${order.id}`);
    const delivery = positionFor(`delivery:${order.id}`);
    return {
      lat: (pickup.latitude + delivery.latitude) / 2,
      lng: (pickup.longitude + delivery.longitude) / 2,
      zoom: 13,
    };
  }, [order]);

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
  const activeIdx = steps.findIndex((s) => !s.done);

  const statusLabel = STATUS_LABELS[order.status];
  const orderNumber = order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`;
  const orderDate = new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const etaLine =
    order.status === 'delivered'
      ? `Delivered on ${orderDate}`
      : order.status === 'cancelled'
        ? 'Order cancelled'
        : order.kind === 'food'
          ? transportMode === 'car'
            ? 'Arriving in 15–25 min'
            : 'Arriving in 30–40 min'
          : 'Arriving soon';

  const courierName = COURIER_NAMES[hashId(order.id) % COURIER_NAMES.length];
  const riderName = `${RIDER_NAMES[hashId(order.id) % RIDER_NAMES.length]} · ${RIDER_RATING}★`;
  const scheduledDate = new Date(order.placedAt + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const product = order.items[0];
  const productName = product.name;
  const productPrice = formatPrice(product.price);
  const quantity = product.quantity;
  const productImage = productImages[product.listingId] ?? trackOrderImages.product;

  const isLive = ['placed', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status);

  const handleShare = () => {
    Share.share({
      title: `Order ${orderNumber}`,
      message: `Order ${orderNumber} (${statusLabel}) — ${productName} x ${quantity} at ${productPrice}. ${order.kind === 'food' ? 'Food delivery via susej.' : `Shipped by ${courierName}.`}`,
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
                <Text className="text-figma-14 font-inter-600 text-textPrimary">{riderName}</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">
                  {transportMode === 'car' ? 'Arriving in 15–25 min' : 'Arriving in 30–40 min'}
                </Text>
              </View>
              <View className="w-9 h-9 rounded-figma-full bg-primaryContainer items-center justify-center">
                <PhoneIcon size={16} color={colors.textInverse} />
              </View>
            </View>
            <TouchableOpacity
              className="mt-3 h-20 bg-surfaceContainer rounded-figma-12 flex-row items-center justify-center"
              onPress={() => scrollRef.current?.scrollTo({ y: mapY, animated: true })}
            >
              <MapPinIcon size={18} color={colors.primaryContainer} />
              <Text className="text-figma-13 font-inter-600 text-primaryContainer ml-2">Live Map</Text>
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
                <Text className="text-figma-14 font-inter-600 text-textPrimary">{courierName}</Text>
                <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">Standard Delivery · 2–4 days</Text>
              </View>
              <View className="px-3 py-1 bg-primaryContainer rounded-figma-full">
                <Text className="text-figma-10 font-inter-600 text-white">In Transit</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-surfaceContainer">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Tracking ID</Text>
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
                <Text className="text-figma-12 font-inter-400 text-textSecondary mt-1">{scheduledDate} · 10:30 AM</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-surfaceContainer">
              <Text className="text-figma-12 font-inter-400 text-textSecondary">Meetup</Text>
              <Text className="text-figma-12 font-inter-600 text-textPrimary">At location</Text>
            </View>
          </View>
        )}

        {isLive ? (
        <>
          <View className="px-4 py-6">
            <Text className="text-figma-16 font-inter-600 text-textPrimary mb-6">Live Tracking</Text>

            {order.kind !== 'booking' && (
              <View className="flex-row items-center gap-2 mb-4">
                <Text className="text-figma-12 font-inter-500 text-textSecondary">Delivery mode</Text>
                <View className="flex-row bg-surfaceContainerLow rounded-figma-full p-1">
                  {(
                    [
                      { key: 'car', label: 'Car', icon: <CarIcon size={14} color={colors.surfaceContainerLowest} /> },
                      { key: 'bike', label: 'Bike', icon: <BikeIcon size={14} color={colors.surfaceContainerLowest} /> },
                    ] as const
                  ).map((mode) => (
                    <TouchableOpacity
                      key={mode.key}
                      className={`flex-row items-center px-4 py-1.5 rounded-figma-full gap-1.5 ${transportMode === mode.key ? 'bg-primaryContainer' : ''}`}
                      onPress={() => setTransportMode(mode.key)}
                    >
                      {mode.icon}
                      <Text className={`text-figma-12 font-inter-600 ${transportMode === mode.key ? 'text-white' : 'text-textSecondary'}`}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View className="ml-2">
              {steps.map((step, i) => {
                const isActive = activeIdx === -1 ? i === steps.length - 1 : i === activeIdx;
                const isDone = activeIdx === -1 ? true : i < activeIdx;
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
                {order.kind === 'food' ? `${transportMode === 'car' ? 'Car' : 'Bike'} · ${riderName} · on the way` : order.kind === 'booking' ? 'Service partner on the way' : `${courierName} · in transit`}
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
              onPress={() => Alert.alert('Need help?', 'Our support team is available 9 AM - 9 PM. You can also reach us from the Chat tab.')}
            >
              <Text className="text-figma-13 font-inter-600 text-textPrimary">Help</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="mx-4 mt-4 mb-6 bg-surfaceContainerLow rounded-figma-16 p-4">
          <Text className="text-figma-16 font-inter-600 text-textPrimary mb-1">Order Cancelled</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary mb-4">
            This order was cancelled. Any amount paid will be refunded to your original payment method.
          </Text>
          <TouchableOpacity
            className="h-11 rounded-figma-12 bg-surfaceContainer items-center justify-center"
            onPress={() => Alert.alert('Need help?', 'Our support team is available 9 AM - 9 PM. You can also reach us from the Chat tab.')}
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
              <Text className="text-figma-12 font-inter-500 text-success">Paid</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
