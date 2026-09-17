import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { nearbyImages } from '../utils/screenImages';
import { resolveAvatar } from '../utils/productImages';
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

/** Zoomed out below this, nearby pins merge into count badges (GMap-style). */
const CLUSTER_ZOOM = 12;

interface ClusterCell {
  key: string;
  count: number;
  lat: number;
  lng: number;
}
const compactPrice = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
};

const positionFor = (key: string, lat?: number | null, lng?: number | null) => {
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  // No precise coordinates: NO pin. IG/FB hide imprecise sellers instead of
  // rendering plausible-but-fake locations. The seller still appears in the
  // list below with a "Location not shared" label. Null = unmapped.
  void key;
  return null;
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

/**
 * Sellers with listings but no precise coordinates. They get NO pin (a pin
 * would be a fabricated location) but DO appear in the list below with their
 * self-declared area — OLX/Amazon show city-level proximity as fallback, and
 * an empty Nearby screen on real prod data is a dead end.
 */
interface UnmappedSeller {
  username: string;
  name: string;
  verified: boolean;
  priceFrom: number;
  categories: string[];
  locationLabel: string;
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
  // Live viewport zoom from the WebView (moveend). Drives GMap-style clustering.
  const [mapZoom, setMapZoom] = useState(13);
  const clusterRef = useRef(new Map<string, ClusterCell>());
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

  const sellers = useMemo<SellerPin[]>(() => {
    const bySeller = new Map<string, SellerPin>();
    for (const p of posts) {
      const pos = positionFor(p.sellerUsername, (p as any).listingLat ?? (p as any).lat, (p as any).listingLng ?? (p as any).lng);
      // Unmapped sellers are excluded from pins AND from this array (nearness
      // cannot be claimed without coordinates, and a jittered fake pin is a
      // production-integrity violation). They appear in the unmapped list
      // below instead — discoverable here, not only via search/explore.
      const existing = bySeller.get(p.sellerUsername);
      if (existing) {
        existing.verified = existing.verified || Boolean(p.verified);
        existing.priceFrom = Math.min(existing.priceFrom, p.price);
        if (p.category && !existing.categories.includes(p.category)) {
          existing.categories.push(p.category);
        }
        continue;
      }
      if (!pos) continue;
      bySeller.set(p.sellerUsername, {
        username: p.sellerUsername,
        name: p.sellerName,
        verified: Boolean(p.verified),
        priceFrom: p.price,
        categories: p.category ? [p.category] : [],
        ...pos,
      });
    }
    return Array.from(bySeller.values());
  }, [posts]);

  const unmappedSellers = useMemo<UnmappedSeller[]>(() => {
    const mapped = new Set(sellers.map((s) => s.username));
    const bySeller = new Map<string, UnmappedSeller>();
    for (const p of posts) {
      if (mapped.has(p.sellerUsername)) continue;
      const pos = positionFor(p.sellerUsername, (p as any).listingLat ?? (p as any).lat, (p as any).listingLng ?? (p as any).lng);
      if (pos) continue;
      const existing = bySeller.get(p.sellerUsername);
      if (existing) {
        existing.verified = existing.verified || Boolean(p.verified);
        existing.priceFrom = Math.min(existing.priceFrom, p.price);
        if (p.category && !existing.categories.includes(p.category)) {
          existing.categories.push(p.category);
        }
        continue;
      }
      const area = String((p as any).sellerLocation ?? (p as any).listingLocation ?? "").trim();
      bySeller.set(p.sellerUsername, {
        username: p.sellerUsername,
        name: p.sellerName,
        verified: Boolean(p.verified),
        priceFrom: p.price,
        categories: p.category ? [p.category] : [],
        locationLabel: area || "Location not shared",
      });
    }
    return Array.from(bySeller.values());
  }, [posts, sellers]);

  const communityPins = useMemo<CommunityPin[]>(
    () => communities.flatMap((c) => {
      const pos = positionFor(c.id, (c as any)?.listingLat ?? (c as any)?.lat, (c as any)?.listingLng ?? (c as any)?.lng);
      return pos ? [{ ...c, ...pos }] : [];
    }),
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

  // Unmapped sellers sort AFTER pinned ones (no nearness claim) and respect
  // the same category filter.
  const visibleUnmapped = useMemo(
    () =>
      activeCategory === 'All'
        ? unmappedSellers
        : unmappedSellers.filter((s) => s.categories.includes(activeCategory)),
    [unmappedSellers, activeCategory]
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
    const ref = userLoc ?? CENTER;
    for (const s of visibleSellers) {
      const d = (s.latitude - ref.latitude) ** 2 + (s.longitude - ref.longitude) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }, [visibleSellers, userLoc]);

  const routeSource = selectedSeller ?? nearestSeller;

  const routePoints = useMemo<{ latitude: number; longitude: number }[] | null>(() => {
    if (!routeSource) return null;
    const rLat = (routeSource as any)?.listingLat;
    const rLng = (routeSource as any)?.listingLng;
    const delivery = positionFor(`delivery:${routeSource.username}`, typeof rLat === 'number' ? rLat : null, typeof rLng === 'number' ? rLng : null);
    // Honest delivery preview: seller pin -> user location -> listing location (if set)
    const mid = userLoc ?? CENTER;
    if (!delivery) {
      return [{ latitude: routeSource.latitude, longitude: routeSource.longitude }, mid];
    }
    return [
      { latitude: routeSource.latitude, longitude: routeSource.longitude },
      mid,
      delivery,
    ];
  }, [routeSource, userLoc]);

  const liveRoute = useMemo<{ latitude: number; longitude: number }[] | null>(() => {
    return routeOn && routePoints ? routePoints : null;
  }, [routeOn, routePoints]);

  const mapMarkers = useMemo<LeafletMarker[]>(() => {
    const sellerPins: LeafletMarker[] = visibleSellers.map((s) => ({
      id: s.username,
      lat: s.latitude,
      lng: s.longitude,
      kind: 'pin',
      color: getCategoryColor(s.categories[0] ?? 'Fashion'),
      label: compactPrice(s.priceFrom),
    }));
    const communityPinsOnMap: LeafletMarker[] = visibleCommunities.map((c) => ({
      id: c.id,
      lat: c.latitude,
      lng: c.longitude,
      kind: 'pin',
      color: getCategoryColor(c.category),
    }));
    // Zoomed in: every shop shows. Zoomed out: merge neighbours into badges.
    const places = [...sellerPins, ...communityPinsOnMap];
    let clustered: LeafletMarker[] = places;
    if (mapZoom < CLUSTER_ZOOM && places.length > 0) {
      const cellDeg = (90 / 256) * (360 / Math.pow(2, Math.max(1, Math.floor(mapZoom))));
      const groups = new Map<string, LeafletMarker[]>();
      for (const p of places) {
        const k = `${Math.floor(p.lat / cellDeg)}:${Math.floor(p.lng / cellDeg)}`;
        const g = groups.get(k);
        if (g) g.push(p);
        else groups.set(k, [p]);
      }
      const out: LeafletMarker[] = [];
      const cells = new Map<string, ClusterCell>();
      for (const [k, g] of groups) {
        if (g.length < 2) {
          out.push(g[0]);
          continue;
        }
        const lat = g.reduce((a, p) => a + p.lat, 0) / g.length;
        const lng = g.reduce((a, p) => a + p.lng, 0) / g.length;
        cells.set(k, { key: k, count: g.length, lat, lng });
        out.push({ id: `cluster:${k}`, lat, lng, kind: 'cluster', label: String(g.length) });
      }
      clusterRef.current = cells;
      clustered = out;
    } else {
      clusterRef.current = new Map();
    }
    const userMarker: LeafletMarker[] = userLoc
      ? [{ id: 'user', lat: userLoc.latitude, lng: userLoc.longitude, kind: 'user' }]
      : [];
    return [...clustered, ...userMarker];
  }, [visibleSellers, visibleCommunities, userLoc, mapZoom]);

  const mapFocus = selectedSeller?.username ?? selectedCommunityId ?? null;

  const handleMarkerPress = (id: string) => {
    if (id === 'user') {
      recenter();
      return;
    }
    // Cluster badge tapped → zoom into its cell, like GMap.
    if (id.startsWith('cluster:')) {
      const cell = clusterRef.current.get(id.slice(8));
      if (cell) {
        setCenterTarget({ lat: cell.lat, lng: cell.lng, zoom: Math.min(18, Math.floor(mapZoom) + 2) });
      }
      return;
    }
    // One map, both worlds: sellers and communities share the canvas, no filter UI.
    const s = sellers.find((x) => x.username === id);
    if (s) {
      setSelectedSeller(s);
      setSelectedCommunityId(null);
      return;
    }
    const c = communityPins.find((x) => x.id === id);
    if (c) {
      setSelectedCommunityId(c.id);
      setSelectedSeller(null);
    }
  };

  const clearSelection = () => {
    setSelectedSeller(null);
    setSelectedCommunityId(null);
  };

  const listData: Array<SellerPin | UnmappedSeller | CommunityPin> =
    view === 'Sellers' ? [...visibleSellers, ...visibleUnmapped] : visibleCommunities;

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

  const renderSellerRow = (s: SellerPin) => (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3" style={cardShadow}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full mr-3 overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={resolveAvatar(s.username)} className="w-full h-full" />
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
            onPress={() => router.push(`/(tabs)/chat?to=${encodeURIComponent(s.username)}`)}
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

  const renderUnmappedRow = (s: UnmappedSeller) => (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mb-3" style={cardShadow}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full mr-3 overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={resolveAvatar(s.username)} className="w-full h-full" />
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
            onPress={() => router.push(`/(tabs)/chat?to=${encodeURIComponent(s.username)}`)}
          >
            <Text className="text-figma-12 font-inter-600 text-primaryContainer">Message</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text className="text-figma-12 font-inter-400 text-textSecondary mt-2">
        From {formatPrice(s.priceFrom)} · {s.categories.join(', ')}{s.categories.length > 0 ? ' · ' : ''}{s.locationLabel} (area, not a pin)
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

  const sellerCard = selectedSeller ? (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mx-4 mt-3" style={cardShadow}>
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full mr-3 overflow-hidden" style={{ backgroundColor: colors.surfaceContainer }}>
          <Image source={resolveAvatar(selectedSeller.username)} className="w-full h-full" />
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
      <View className="flex-row items-center justify-between mt-2">
        <Text
          className="flex-1 text-figma-12 font-inter-500 text-textSecondary mr-2"
          numberOfLines={1}
        >
          From {formatPrice(selectedSeller.priceFrom)} · {selectedSeller.categories.join(', ')}
        </Text>
        <TouchableOpacity
          className={`px-3 py-1.5 rounded-figma-full ${routeOn ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}
          onPress={() => setRouteOn((v) => !v)}
        >
          <Text
            className={`text-figma-12 font-inter-600 ${routeOn ? 'text-white' : 'text-primaryContainer'}`}
          >
            Route
          </Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          className="flex-1 h-11 bg-primaryContainer rounded-figma-16 items-center justify-center"
          onPress={() => router.push(`/seller/${selectedSeller.username}`)}
        >
          <Text className="text-figma-14 font-inter-600 text-white">View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="h-11 px-4 bg-surfaceContainer rounded-figma-16 flex-row items-center justify-center"
          onPress={() => router.push(`/(tabs)/chat?to=${encodeURIComponent(selectedSeller.username)}`)}
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
            Approximate route preview
          </Text>
        </View>
      )}
    </View>
  ) : null;

  const communityCard = selectedCommunity ? (
    <View className="bg-surfaceContainerLowest rounded-figma-24 p-4 mx-4 mt-3" style={cardShadow}>
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
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-figma-12 font-inter-400 text-textSecondary mr-2" numberOfLines={1}>
              {formatCount(selectedCommunity.memberCount)} members · {selectedCommunity.category}
            </Text>
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-figma-full ${routeOn ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}
              onPress={() => setRouteOn((v) => !v)}
            >
              <Text
                className={`text-figma-12 font-inter-600 ${routeOn ? 'text-white' : 'text-primaryContainer'}`}
              >
                Route
              </Text>
            </TouchableOpacity>
          </View>
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
            Approximate route preview
          </Text>
        </View>
      )}
    </View>
  ) : null;

  const placeCard = selectedSeller ? sellerCard : selectedCommunity ? communityCard : null;

  return (
    <View className="flex-1 bg-surface">
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
            renderItem={({ item }) => {
              if (!('username' in item)) return renderCommunityRow(item);
              return 'latitude' in item ? renderSellerRow(item) : renderUnmappedRow(item);
            }}
            contentContainerClassName="p-4"
            ListEmptyComponent={emptyList}
          />
        </View>
      ) : (
        <View className="flex-1">
          <LeafletMapHost
            style={{ flex: 1 }}
            markers={mapMarkers}
            route={liveRoute}
            focus={mapFocus}
            center={centerTarget}
            onMarkerPress={handleMarkerPress}
            onMapPress={clearSelection}
            onView={({ zoom }) => setMapZoom((z) => (Math.abs(z - zoom) < 0.01 ? z : zoom))}
            onReady={() => setMapState('ready')}
            onError={() => setMapState('failed')}
          />

          {/* Floating search — back + field + alerts, Google-Maps style */}
          <View className="absolute left-4 right-4" style={{ top: insets.top + 8 }}>
            <View
              className="flex-row items-center h-12 pl-1 pr-1 bg-surfaceContainerLowest rounded-figma-16"
              style={pillShadow}
            >
              <TouchableOpacity
                className="w-10 h-10 items-center justify-center"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}
                accessibilityLabel="Go back"
              >
                <BackIcon size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 flex-row items-center h-full"
                onPress={() => router.push('/search')}
              >
                <SearchIcon size={18} color={colors.secondary} />
                <Text className="flex-1 ml-2 text-figma-14 font-inter-400 text-textSecondary">
                  Search nearby...
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-10 h-10 items-center justify-center"
                onPress={() => router.push('/notifications')}
                accessibilityLabel="Notifications"
              >
                <BellIcon size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {locDenied && (
              <TouchableOpacity
                className="flex-row items-center justify-between bg-surfaceContainerLowest px-4 py-2.5 mt-2 rounded-figma-16"
                style={pillShadow}
                onPress={recenter}
              >
                <Text className="flex-1 text-figma-12 font-inter-500 text-textSecondary mr-3">
                  Location off — tap to retry and find places near you
                </Text>
                <GpsTargetIcon size={16} color={colors.primaryContainer} />
              </TouchableOpacity>
            )}
          </View>

          {/* Loader chip floats over the live map — never covers it */}
          {mapState === 'loading' && (
            <View
              className="absolute left-0 right-0 items-center"
              style={{ top: insets.top + 132 }}
              pointerEvents="none"
            >
              <View
                className="flex-row items-center bg-surfaceContainerLowest rounded-figma-full px-4 py-2"
                style={pillShadow}
              >
                <ActivityIndicator size="small" color={colors.primaryContainer} />
                <Text className="text-figma-12 font-inter-500 text-textSecondary ml-2">Loading map…</Text>
              </View>
            </View>
          )}

          {/* Location button — the map canvas stays clean otherwise */}
          <TouchableOpacity
            className="absolute right-4 w-12 h-12 rounded-figma-full bg-surfaceContainerLowest items-center justify-center"
            style={{ bottom: placeCard ? 268 : 32, ...pillShadow }}
            onPress={recenter}
            accessibilityLabel="Recenter map"
          >
            <GpsTargetIcon size={22} color={colors.primaryContainer} />
          </TouchableOpacity>

          {/* Place card — appears only when a pin is tapped, like Google Maps */}
          {placeCard && (
            <View className="absolute left-0 right-0" style={{ bottom: 24 }}>
              {placeCard}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
