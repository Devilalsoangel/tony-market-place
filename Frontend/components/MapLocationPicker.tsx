import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LeafletMapHost } from './LeafletMap';
import * as Location from 'expo-location';
import { colors } from '../utils/theme';

/**
 * Live-map location picker (store address at Become-a-Seller, optional
 * selling location per listing). Tap the map to drop a pin - the label is
 * reverse-geocoded from OpenStreetMap Nominatim so it is a REAL place name,
 * never a fabricated one. Search + GPS are secondary entry points.
 */
export interface PickedLocation {
  lat: number;
  lng: number;
  label: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'susej-marketplace-demo/1.0';

interface SearchResult {
  label: string;
  lat: number;
  lng: number;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      { headers: { 'User-Agent': UA } }
    );
    const j: any = await r.json();
    const a = j?.address ?? {};
    const primary = j?.name || a.house_number || a.road || a.suburb || a.neighbourhood;
    const area = a.city || a.town || a.village || a.county || a.state_district || a.state;
    if (primary && area && String(primary) !== String(area)) return `${primary}, ${area}`;
    return String(primary || area || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

interface Props {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
  height?: number;
}

export function MapLocationPicker({ value, onChange, height = 290 }: Props) {
  // Center only moves when the user picks/searches/GPS - never per render,
  // otherwise LeafletMapHost would re-center the map on every keystroke.
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number }>(
    value ? { lat: value.lat, lng: value.lng, zoom: 15 } : { lat: 26.9124, lng: 75.7873, zoom: 11 }
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `${NOMINATIM}/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&countrycodes=in&addressdetails=1`,
          { headers: { 'User-Agent': UA } }
        );
        const j: any[] = await r.json();
        setResults(
          (j || []).map((it) => ({
            label: String(it.display_name ?? '').split(',').slice(0, 3).join(', '),
            lat: Number(it.lat),
            lng: Number(it.lon),
          })).filter((it) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pick = async (lat: number, lng: number) => {
    setCenter((c) => ({ lat, lng, zoom: c.zoom < 14 ? 15 : c.zoom }));
    setResults([]);
    setQuery('');
    setResolving(true);
    onChange({ lat, lng, label: 'Resolving address…' });
    const label = await reverseGeocode(lat, lng);
    setResolving(false);
    onChange({ lat, lng, label });
  };

  const useMyLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      setResolving(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await pick(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setResolving(false);
    }
  };

  return (
    <View>
      {/* Live search over OSM data */}
      <View className="flex-row items-center px-4 mb-2" style={{ height: 48, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
        <TextInput
          className="flex-1 font-inter-400 text-textPrimary"
          style={{ fontSize: 14 }}
          placeholder="Search an area or landmark"
          placeholderTextColor={colors.secondary}
          value={query}
          onChangeText={setQuery}
        />
        {searching && <ActivityIndicator size="small" color={colors.primaryContainer} />}
      </View>
      {results.length > 0 && (
        <View className="mb-2" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}>
          {results.map((r, i) => (
            <TouchableOpacity
              key={`${r.lat},${r.lng},${i}`}
              className="px-4 py-3"
              style={{ borderBottomWidth: i < results.length - 1 ? 1 : 0, borderBottomColor: colors.outlineVariant }}
              onPress={() => pick(r.lat, r.lng)}
            >
              <Text className="font-inter-500 text-textPrimary" style={{ fontSize: 13 }} numberOfLines={1}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* The live map - tap anywhere to move the store pin, or drag the pin and release to set it */}
      <LeafletMapHost
        style={{ height, borderRadius: 20 }}
        markers={value ? [{ id: '__pick', lat: value.lat, lng: value.lng, kind: 'pin', draggable: true }] : []}
        center={center}
        onMapPress={pick}
      />

      {/* Selected place card */}
      <View className="flex-row items-center mt-3 p-3" style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerLow }}>
        <View className="items-center justify-center mr-3" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceContainerLowest }}>
          <Text style={{ fontSize: 18, color: colors.primaryContainer }}>📍</Text>
        </View>
        <View className="flex-1">
          <Text className="font-inter-600 text-textPrimary" style={{ fontSize: 13 }} numberOfLines={2}>
            {value ? (resolving ? 'Resolving address…' : value.label) : 'Tap the map or drag the pin'}
          </Text>
          {!value && (
            <Text className="font-inter-400 text-textSecondary mt-0.5" style={{ fontSize: 11 }}>
              Or search above / use your current location
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={useMyLocation} disabled={resolving} className="px-3 py-2" style={{ borderRadius: 12, backgroundColor: colors.primaryContainer }}>
          <Text className="font-inter-600" style={{ fontSize: 11, color: colors.onPrimary }}>Use GPS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
