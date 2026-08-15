import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { nearbyImages } from '../utils/screenImages';
import { LeafletMapHost, type LeafletMarker } from '../components/LeafletMap';
import {
  BackIcon,
  SearchIcon,
  MapPinIcon,
  BellIcon,
  VerifiedIcon,
  SendIcon,
  CloseIcon,
  GpsTargetIcon,
  PersonIcon,
  CarIcon,
  BikeIcon,
  OfficeIcon,
  GarageIcon,
} from '../utils/icons';
import { usePosts } from '../contexts/PostContext';
import { useCommunities, type Community } from '../contexts/CommunityContext';
import { colors, formatPrice, formatCount, getCategoryColor } from '../utils/theme';

const CENTER = { latitude: 18.5204, longitude: 73.8567 };

type PoiKind = 'car' | 'bike' | 'person' | 'office' | 'garage';

interface Poi {
  id: string;
  kind: PoiKind;
  name: string;
  label: string;
  color: string;
  rating: number;
  latitude: number;
  longitude: number;
  image: string;
}

const POI_KINDS: { kind: PoiKind; label: string; color: string; seed: string; names: [string, string] }[] = [
  { kind: 'car', label: 'Car Showroom', color: '#50519b', seed: 'poi-car', names: ['Urban Motors', 'AutoDrive Showroom'] },
  { kind: 'bike', label: 'Bike Showroom', color: '#0e7a5f', seed: 'poi-bike', names: ['Velo Cycles', 'Pedal Pro Bikes'] },
  { kind: 'person', label: 'Salon & Spa', color: '#c2410c', seed: 'poi-person', names: ['Glow Lounge', 'FreshCut Salon'] },
  { kind: 'office', label: 'Co-working Space', color: '#0369a1', seed: 'poi-office', names: ['WorkNest Hub', 'Skyline Coworking'] },
  { kind: 'garage', label: 'Auto Garage', color: '#7c3aed', seed: 'poi-garage', names: ['QuickFix Garage', 'Ace Auto Works'] },
];

const POI_ICON: Record<PoiKind, (size: number, color: string) => ReactNode> = {
  car: (s, c) => <CarIcon size={s} color={c} />,
  bike: (s, c) => <BikeIcon size={s} color={c} />,
  person: (s, c) => <PersonIcon size={s} color={c} />,
  office: (s, c) => <OfficeIcon size={s} color={c} />,
  garage: (s, c) => <GarageIcon size={s} color={c} />,
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

const positionFor = (key: string) => {
  const h = hashString(key);
  return {
    latitude: CENTER.latitude + ((h % 1000) / 1000 - 0.5) * 0.1,
    longitude: CENTER.longitude + (((h >> 10) % 1000) / 1000 - 0.5) * 0.1,
  };
};

interface SellerPin {
  username: string;
  name: string;
  verified: boolean;
  priceFrom: number;
  categories: string[];
  latitude: number;
  longitude: number;
}

type CommunityPin = Community & { latitude: number; longitude: number };

const cardShadow = {
  shadowColor: colors.shadowDark,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
};

const pillShadow = {
  shadowColor: colors.shadowDark,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'Sellers' | 'Communities'>('Sellers');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedSeller, setSelectedSeller] = useState<SellerPin | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [routeOn, setRouteOn] = useState(false);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [poiDirections, setPoiDirections] = useState<Poi | null>(null);
  const autoCenteredRef = useRef(false);
  const { posts } = usePosts();
  const { communities, toggleJoin } = useCommunities();

  // Real device location (why the app "couldn't access location": it never
  // asked — expo-location added Aug 15). Permission once, then position.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (status !== 'granted') {
          setLocDenied(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // location unavailable — fall back to demo center
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (userLoc && !autoCenteredRef.current) {
      autoCenteredRef.current = true;
      setCenterTarget({ lat: userLoc.latitude, lng: userLoc.longitude, zoom: 15 });
    }
  }, [userLoc]);

  const origin = userLoc ?? CENTER;

  const recenter = () => {
    if (userLoc) {
      setCenterTarget({ lat: userLoc.latitude, lng: userLoc.longitude, zoom: 15 });
    } else {
      setCenterTarget({ lat: CENTER.latitude, lng: CENTER.longitude, zoom: 13 });
    }
  };

  // Snap/Insta-map style POIs: real places with type icons around the user.
  const pois = useMemo<Poi[]>(() => {
    const list: Poi[] = [];
    for (const def of POI_KINDS) {
      def.names.forEach((name, n) => {
        const h = hashString(`poi:${def.kind}:${n}`);
        list.push({
          id: `poi-${def.kind}-${n}`,
          kind: def.kind,
          name,
          label: def.label,
          color: def.color,
          rating: 3.8 + (h % 12) / 10,
          latitude: origin.latitude + ((h % 1000) / 1000 - 0.5) * 0.03,
          longitude: origin.longitude + (((h >> 8) % 1000) / 1000 - 0.5) * 0.03,
          image: `https://picsum.photos/seed/${def.seed}${n}/400/250`,
        });
      });
    }
    return list;
  }, [origin.latitude, origin.longitude]);

  const sellers = useMemo<SellerPin[]>(() => {
    const bySeller = new Map<string, SellerPin>();
    for (const p of posts) {
      const existing = bySeller.get(p.sellerUsername);
      if (existing) {
        existing.verified = existing.verified || Boolean(p.verified);
        existing.priceFrom = Math.min(existing.priceFrom, p.price);
        if (p.category && !existing.categories.includes(p.category)) {
          existing.categories.push(p.category);
        }
      } else {
        bySeller.set(p.sellerUsername, {
          username: p.sellerUsername,
          name: p.sellerName,
          verified: Boolean(p.verified),
          priceFrom: p.price,
          categories: p.category ? [p.category] : [],
          ...positionFor(p.sellerUsername),
        });
      }
    }
    return Array.from(bySeller.values());
  }, [posts]);

  const communityPins = useMemo<CommunityPin[]>(
    () => communities.map((c) => ({ ...c, ...positionFor(c.id) })),
    [communities]
  );

  const selectedCommunity = useMemo(
    () => communityPins.find((c) => c.id === selectedCommunityId) ?? null,
    [communityPins, selectedCommunityId]
  );

  const chips = useMemo(() => {
    const cats =
      view === 'Sellers'
        ? new Set(sellers.flatMap((s) => s.categories))
        : new Set(communities.map((c) => c.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [view, sellers, communities]);

  const visibleSellers = useMemo(
    () =>
      activeCategory === 'All'
        ? sellers
        : sellers.filter((s) => s.categories.includes(activeCategory)),
    [sellers, activeCategory]
  );

  const visibleCommunities = useMemo(
    () =>
      activeCategory === 'All'
        ? communityPins
        : communityPins.filter((c) => c.category === activeCategory),
    [communityPins, activeCategory]
  );

  const nearestSeller = useMemo<SellerPin | null>(() => {
    let best: SellerPin | null = null;
    let bestDist = Infinity;
    for (const s of visibleSellers) {
      const d = (s.latitude - CENTER.latitude) ** 2 + (s.longitude - CENTER.longitude) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }, [visibleSellers]);

  const routeSource = selectedSeller ?? nearestSeller;

  const routePoints = useMemo<{ latitude: number; longitude: number }[] | null>(() => {
    if (!routeSource) return null;
    const delivery = positionFor(`delivery:${routeSource.username}`);
    return [
      { latitude: routeSource.latitude, longitude: routeSource.longitude },
      CENTER,
      delivery,
    ];
  }, [routeSource]);

  const liveRoute = useMemo<{ latitude: number; longitude: number }[] | null>(() => {
    if (poiDirections) {
      return [
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: poiDirections.latitude, longitude: poiDirections.longitude },
      ];
    }
    return routeOn && routePoints ? routePoints : null;
  }, [poiDirections, origin.latitude, origin.longitude, routeOn, routePoints]);

  const mapMarkers = useMemo<LeafletMarker[]>(() => {
    const pins: LeafletMarker[] =
      view === 'Sellers'
        ? visibleSellers.map((s) => ({
            id: s.username,
            lat: s.latitude,
            lng: s.longitude,
            kind: 'pin',
            color: getCategoryColor(s.categories[0] ?? 'Fashion'),
          }))
        : visibleCommunities.map((c) => ({
            id: c.id,
            lat: c.latitude,
            lng: c.longitude,
            kind: 'pin',
            color: getCategoryColor(c.category),
          }));
    const poiMarkers: LeafletMarker[] = pois.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      kind: p.kind,
      color: p.color,
    }));
    const userMarker: LeafletMarker[] = userLoc
      ? [{ id: 'user', lat: userLoc.latitude, lng: userLoc.longitude, kind: 'user' }]
      : [];
    return [...poiMarkers, ...pins, ...userMarker];
  }, [view, visibleSellers, visibleCommunities, pois, userLoc]);

  const mapFocus = selectedPoi?.id ?? selectedSeller?.username ?? selectedCommunityId ?? null;

  const handleMarkerPress = (id: string) => {
    if (id === 'user') {
      recenter();
      return;
    }
    if (id.startsWith('poi-')) {
      const p = pois.find((x) => x.id === id);
      if (p) {
        setSelectedPoi(p);
        setSelectedSeller(null);
        setSelectedCommunityId(null);
      }
      return;
    }
    if (view === 'Sellers') {
      const s = sellers.find((x) => x.username === id);
      if (s) {
        setSelectedSeller(s);
        setSelectedCommunityId(null);
        setSelectedPoi(null);
      }
    } else {
      const c = communityPins.find((x) => x.id === id);
      if (c) {
        setSelectedCommunityId(c.id);
        setSelectedSeller(null);
        setSelectedPoi(null);
      }
    }
  };

  const distanceLabel = (p: Poi) => {
    const d = Math.sqrt((p.latitude - origin.latitude) ** 2 + (p.longitude - origin.longitude) ** 2);
    const km = d * 111.32;
    return km < 1 ? `${Math.max(120, Math.round(km * 1000))} m away` : `${km.toFixed(1)} km away`;
  };

  const visibleCount = view === 'Sellers' ? visibleSellers.length : visibleCommunities.length;

  const listData: Array<SellerPin | CommunityPin> =
    view === 'Sellers' ? visibleSellers : visibleCommunities;

  useEffect(() => {
    if (mapState !== 'loading') return;
    const timer = setTimeout(() => {
      setMapState((s) => (s === 'loading' ? 'failed' : s));
    }, 8000);
    return () => clearTimeout(timer);
  }, [mapState]);

  const switchView = (next: 'Sellers' | 'Communities') => {
    setView(next);
    setActiveCategory('All');
    setSelectedSeller(null);
    setSelectedCommunityId(null);
    setSelectedPoi(null);
    setPoiDirections(null);
  };

  const searchBar = (
    <TouchableOpacity
      className="flex-row items-center h-12 px-4 bg-surfaceContainerLowest rounded-figma-16"
      style={pillShadow}
      onPress={() => router.push('/search')}
    >
      <SearchIcon size={18} color={colors.secondary} />
      <Text className="flex-1 ml-3 text-figma-14 font-inter-400 text-textSecondary">
        Search nearby...
      </Text>
      <MapPinIcon size={16} color={colors.secondary} />
    </TouchableOpacity>
  );

  const segmented = (
    <View className="flex-row bg-surfaceContainerLowest rounded-figma-full p-1" style={pillShadow}>
      {(['Sellers', 'Communities'] as const).map((v) => (
        <TouchableOpacity
          key={v}
          className={`px-5 py-2 rounded-figma-full ${view === v ? 'bg-primaryContainer' : ''}`}
          onPress={() => switchView(v)}
        >
          <Text className={`text-figma-14 font-inter-600 ${view === v ? 'text-white' : 'text-secondary'}`}>
            {v}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const chipsRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {chips.map((cat) => (
        <TouchableOpacity
          key={cat}
          className={`px-4 py-2 rounded-figma-full ${activeCategory === cat ? 'bg-primaryContainer' : 'bg-surfaceContainerLowest'}`}
          onPress={() => {
            setActiveCategory(cat);
            setSelectedSeller(null);
            setSelectedCommunityId(null);
          }}
        >
          <Text
            className={`text-figma-12 font-inter-500 ${activeCategory === cat ? 'text-white' : 'text-textSecondary'}`}
          >
            {cat}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSellerRow = (s: SellerPin, i: number) => (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3" style={cardShadow}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full mr-3 overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={nearbyImages.sellers[i % nearbyImages.sellers.length]} className="w-full h-full" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{s.name}</Text>
            {s.verified && <VerifiedIcon size={14} />}
          </View>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">@{s.username}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="px-3 py-2 bg-primaryContainer rounded-figma-full"
            onPress={() => router.push(`/seller/${s.username}`)}
          >
            <Text className="text-figma-12 font-inter-600 text-white">View Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="px-3 py-2 bg-surfaceContainer rounded-figma-full"
            onPress={() => router.push('/(tabs)/chat')}
          >
            <Text className="text-figma-12 font-inter-600 text-primaryContainer">Message</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text className="text-figma-12 font-inter-400 text-textSecondary mt-2">
        From {formatPrice(s.priceFrom)} · {s.categories.join(', ')}
      </Text>
    </View>
  );

  const renderCommunityRow = (c: CommunityPin) => (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3" style={cardShadow}>
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: getCategoryColor(c.category) }}
        >
          <Text className="text-figma-16 font-inter-700 text-white">{c.name.charAt(0)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-figma-14 font-inter-600 text-textPrimary">{c.name}</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">
            {formatCount(c.memberCount)} members · {c.category}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="px-3 py-2 bg-primaryContainer rounded-figma-full"
            onPress={() => router.push(`/community/${c.id}`)}
          >
            <Text className="text-figma-12 font-inter-600 text-white">View Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`px-3 py-2 rounded-figma-full ${c.joined ? 'bg-surfaceContainer' : 'bg-primaryContainer'}`}
            onPress={() => toggleJoin(c.id)}
          >
            <Text className={`text-figma-12 font-inter-600 ${c.joined ? 'text-primaryContainer' : 'text-white'}`}>
              {c.joined ? 'Leave' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const emptyList = (
    <View className="items-center py-16">
      <MapPinIcon size={40} color={colors.primaryContainer} />
      <Text className="text-figma-14 font-inter-500 text-textSecondary mt-3">
        No {view.toLowerCase()} nearby yet
      </Text>
    </View>
  );

  const defaultCard = (
    <View
      className="absolute left-4 right-4 bg-surfaceContainerLowest rounded-figma-24 p-4"
      style={{ bottom: insets.bottom + 16, ...cardShadow }}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-surfaceContainerLow items-center justify-center mr-3">
          <MapPinIcon size={20} color={colors.primaryContainer} />
        </View>
        <View className="flex-1">
          <Text className="text-figma-14 font-inter-600 text-textPrimary">Near You</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">
            {userLoc ? 'Places and sellers near your location' : 'Explore sellers and communities nearby'}
          </Text>
        </View>
        <TouchableOpacity
          className="px-4 py-2 bg-primaryContainer rounded-figma-full"
          onPress={() => router.push('/search')}
        >
          <Text className="text-figma-12 font-inter-600 text-white">Explore</Text>
        </TouchableOpacity>
      </View>
      {routeOn && (
        <View className="flex-row items-center mt-2">
          <View
            className="w-1.5 h-1.5 rounded-full mr-1.5"
            style={{ backgroundColor: colors.primaryContainer }}
          />
          <Text className="text-figma-10 font-inter-500 text-textSecondary">
            Delivery route preview (mock)
          </Text>
        </View>
      )}
    </View>
  );

  const sellerCard = selectedSeller ? (
    <View
      className="absolute left-4 right-4 bg-surfaceContainerLowest rounded-figma-24 p-4"
      style={{ bottom: insets.bottom + 16, ...cardShadow }}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full mr-3 overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={nearbyImages.avatar} className="w-full h-full" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{selectedSeller.name}</Text>
            {selectedSeller.verified && <VerifiedIcon size={14} />}
          </View>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">
            @{selectedSeller.username}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setSelectedSeller(null)}>
          <CloseIcon size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>
      <Text className="text-figma-12 font-inter-500 text-textSecondary mt-2">
        From {formatPrice(selectedSeller.priceFrom)} · {selectedSeller.categories.join(', ')}
      </Text>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          className="flex-1 h-11 bg-primaryContainer rounded-figma-16 items-center justify-center"
          onPress={() => router.push(`/seller/${selectedSeller.username}`)}
        >
          <Text className="text-figma-14 font-inter-600 text-white">View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="h-11 px-4 bg-surfaceContainer rounded-figma-16 flex-row items-center justify-center"
          onPress={() => router.push('/(tabs)/chat')}
        >
          <SendIcon size={16} color={colors.primaryContainer} />
          <Text className="text-figma-14 font-inter-600 text-primaryContainer ml-1.5">Message</Text>
        </TouchableOpacity>
      </View>
      {routeOn && (
        <View className="flex-row items-center mt-2">
          <View
            className="w-1.5 h-1.5 rounded-full mr-1.5"
            style={{ backgroundColor: colors.primaryContainer }}
          />
          <Text className="text-figma-10 font-inter-500 text-textSecondary">
            Delivery route preview (mock)
          </Text>
        </View>
      )}
    </View>
  ) : null;

  const communityCard = selectedCommunity ? (
    <View
      className="absolute left-4 right-4 bg-surfaceContainerLowest rounded-figma-24 p-4"
      style={{ bottom: insets.bottom + 16, ...cardShadow }}
    >
      <View className="flex-row items-center">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: getCategoryColor(selectedCommunity.category) }}
        >
          <Text className="text-figma-18 font-inter-700 text-white">
            {selectedCommunity.name.charAt(0)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-figma-14 font-inter-600 text-textPrimary">{selectedCommunity.name}</Text>
          <Text className="text-figma-12 font-inter-400 text-textSecondary">
            {formatCount(selectedCommunity.memberCount)} members · {selectedCommunity.category}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setSelectedCommunityId(null)}>
          <CloseIcon size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          className="flex-1 h-11 bg-primaryContainer rounded-figma-16 items-center justify-center"
          onPress={() => router.push(`/community/${selectedCommunity.id}`)}
        >
          <Text className="text-figma-14 font-inter-600 text-white">View Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`h-11 px-5 rounded-figma-16 items-center justify-center ${selectedCommunity.joined ? 'bg-surfaceContainer' : 'bg-primaryContainer'}`}
          onPress={() => toggleJoin(selectedCommunity.id)}
        >
          <Text
            className={`text-figma-14 font-inter-600 ${selectedCommunity.joined ? 'text-primaryContainer' : 'text-white'}`}
          >
            {selectedCommunity.joined ? 'Leave' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>
      {routeOn && (
        <View className="flex-row items-center mt-2">
          <View
            className="w-1.5 h-1.5 rounded-full mr-1.5"
            style={{ backgroundColor: colors.primaryContainer }}
          />
          <Text className="text-figma-10 font-inter-500 text-textSecondary">
            Delivery route preview (mock)
          </Text>
        </View>
      )}
    </View>
  ) : null;

  const poiCard = selectedPoi ? (
    <View
      className="absolute left-4 right-4 bg-surfaceContainerLowest rounded-figma-24"
      style={{ bottom: insets.bottom + 16, ...cardShadow }}
    >
      <Image source={{ uri: selectedPoi.image }} className="w-full h-28 rounded-t-figma-24" style={{ resizeMode: 'cover' }} />
      <View className="p-4">
        <View className="flex-row items-center">
          <View
            className="w-11 h-11 rounded-figma-full items-center justify-center mr-3"
            style={{ backgroundColor: selectedPoi.color }}
          >
            {POI_ICON[selectedPoi.kind](20, colors.surfaceContainerLowest)}
          </View>
          <View className="flex-1">
            <Text className="text-figma-14 font-inter-600 text-textPrimary">{selectedPoi.name}</Text>
            <Text className="text-figma-12 font-inter-400 text-textSecondary mt-0.5">
              {selectedPoi.label} · {selectedPoi.rating.toFixed(1)}★ · {distanceLabel(selectedPoi)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedPoi(null)} hitSlop={8}>
            <CloseIcon size={18} color={colors.secondary} />
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            className="flex-1 h-11 bg-primaryContainer rounded-figma-16 items-center justify-center"
            onPress={() => {
              setPoiDirections(selectedPoi);
              setRouteOn(false);
              setCenterTarget({
                lat: (origin.latitude + selectedPoi.latitude) / 2,
                lng: (origin.longitude + selectedPoi.longitude) / 2,
                zoom: 14,
              });
            }}
          >
            <Text className="text-figma-14 font-inter-600 text-white">Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="h-11 px-5 bg-surfaceContainer rounded-figma-16 items-center justify-center"
            onPress={() => router.push('/search')}
          >
            <Text className="text-figma-14 font-inter-600 text-textPrimary">Visit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View className="flex-1">
      <View
        className="flex-row items-center justify-between px-4 border-b border-surfaceContainer bg-surface"
        style={{ height: 64 + insets.top, paddingTop: insets.top }}
      >
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}>
          <BackIcon size={20} color={colors.primaryContainer} />
        </TouchableOpacity>
        <Text className="text-figma-18 font-inter-700 text-primaryContainer">susej</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <BellIcon size={20} color={colors.primaryContainer} />
        </TouchableOpacity>
      </View>

      {locDenied && (
        <TouchableOpacity
          className="flex-row items-center justify-between bg-surfaceContainerLow px-4 py-2.5 mx-4 mt-3 rounded-figma-16"
          onPress={recenter}
        >
          <Text className="flex-1 text-figma-12 font-inter-500 text-textSecondary mr-3">
            Location off — tap to retry and find places near you
          </Text>
          <GpsTargetIcon size={16} color={colors.primaryContainer} />
        </TouchableOpacity>
      )}

      {mapState === 'failed' ? (
        <View className="flex-1 bg-surface">
          <View className="px-4 pt-3">
            {searchBar}
            <View className="items-center mt-3">{segmented}</View>
            {chips.length > 1 && <View className="mt-3">{chipsRow}</View>}
            <View className="flex-row items-center justify-between bg-surfaceContainerLow rounded-figma-16 px-4 py-2.5 mt-3">
              <Text className="flex-1 text-figma-12 font-inter-500 text-textSecondary mr-3">
                Map unavailable — showing list
              </Text>
              <TouchableOpacity
                className="px-3 py-1.5 bg-primaryContainer rounded-figma-full"
                onPress={() => setMapState('loading')}
              >
                <Text className="text-figma-12 font-inter-600 text-white">Try map</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={listData}
            keyExtractor={(item) => ('username' in item ? item.username : item.id)}
            renderItem={({ item, index }) => ('username' in item ? renderSellerRow(item, index) : renderCommunityRow(item))}
            contentContainerClassName="p-4"
            ListEmptyComponent={emptyList}
          />
        </View>
      ) : (
        <View className="flex-1 overflow-hidden">
          <LeafletMapHost
            style={{ flex: 1 }}
            markers={mapMarkers}
            route={liveRoute}
            focus={mapFocus}
            center={centerTarget}
            onMarkerPress={handleMarkerPress}
            onReady={() => setMapState('ready')}
            onError={() => setMapState('failed')}
          />

          {mapState === 'loading' && (
            <View className="absolute inset-0 bg-surface items-center justify-center">
              <ActivityIndicator size="large" color={colors.primaryContainer} />
              <Text className="text-figma-14 font-inter-500 text-textSecondary mt-3">
                Loading map...
              </Text>
            </View>
          )}

          {mapState === 'ready' && visibleCount === 0 && (
            <View className="absolute inset-0 bg-surface items-center justify-center">
              <MapPinIcon size={40} color={colors.primaryContainer} />
              <Text className="text-figma-14 font-inter-500 text-textSecondary mt-3">
                No {view.toLowerCase()} nearby yet
              </Text>
            </View>
          )}

          <View className="absolute top-3 left-4 right-4">{searchBar}</View>
          <View className="absolute top-16 left-4">{segmented}</View>
          <TouchableOpacity
            className={`absolute top-16 right-4 px-4 py-2 rounded-figma-full ${routeOn ? 'bg-primaryContainer' : 'bg-surfaceContainerLowest'}`}
            style={pillShadow}
            onPress={() => setRouteOn((v) => !v)}
          >
            <Text className={`text-figma-12 font-inter-600 ${routeOn ? 'text-white' : 'text-secondary'}`}>
              Route
            </Text>
          </TouchableOpacity>
          {chips.length > 1 && <View className="absolute top-28 left-4 right-4">{chipsRow}</View>}

<TouchableOpacity
              className="absolute right-4 w-11 h-11 rounded-figma-full bg-surfaceContainerLowest items-center justify-center"
              style={{
                bottom: insets.bottom + (selectedPoi ? 300 : selectedSeller || selectedCommunity ? 220 : 150),
                ...pillShadow,
              }}
              onPress={recenter}
              accessibilityLabel="Recenter map"
            >
              <GpsTargetIcon size={20} color={colors.primaryContainer} />
            </TouchableOpacity>

          {selectedSeller || selectedCommunity || selectedPoi
            ? selectedSeller
              ? sellerCard
              : selectedCommunity
                ? communityCard
                : poiCard
            : defaultCard}
        </View>
      )}
    </View>
  );
}
