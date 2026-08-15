// Web shim for react-native-maps (native-only module).
// Renders a stylized map surface with pseudo-positioned markers so the
// Map screen stays fully interactive for Playwright-driven UI audits.
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { View } from 'react-native';

export const PROVIDER_DEFAULT = 1;

const clamp = (n) => Math.max(0, Math.min(100, n));

// Deterministic pseudo-position from lat/lng within the initial region.
const posFor = (lat, lng, region) => {
  const dLat = region?.latitudeDelta ?? 0.12;
  const dLng = region?.longitudeDelta ?? 0.12;
  const lat0 = region?.latitude ?? 18.5204;
  const lng0 = region?.longitude ?? 73.8567;
  return {
    left: clamp(((lng - (lng0 - dLng / 2)) / dLng) * 100),
    top: clamp((((lat0 + dLat / 2) - lat) / dLat) * 100),
  };
};

const MapView = forwardRef((props, ref) => {
  const { children, initialRegion, onMapReady, style, ...rest } = props;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      if (onMapReady) onMapReady();
    }, 350);
    return () => clearTimeout(t);
  }, [onMapReady]);

  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    getCamera: () => Promise.resolve({ center: initialRegion }),
    animateCamera: () => {},
    fitToElements: () => {},
  }));

  return (
    <View
      {...rest}
      style={[
        { backgroundColor: '#e9e6f2', position: 'relative', overflow: 'hidden' },
        style,
      ]}
    >
      {/* faux map grid */}
      {[20, 40, 60, 80].map((p) => (
        <View
          key={`h${p}`}
          style={{ position: 'absolute', left: 0, right: 0, top: `${p}%`, height: 1, backgroundColor: 'rgba(90,85,120,0.14)' }}
        />
      ))}
      {[20, 40, 60, 80].map((p) => (
        <View
          key={`v${p}`}
          style={{ position: 'absolute', top: 0, bottom: 0, left: `${p}%`, width: 1, backgroundColor: 'rgba(90,85,120,0.14)' }}
        />
      ))}
      {/* faux roads */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: 8, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 4 }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: '30%', width: 6, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 3 }} />
      {/* route line + markers */}
      {ready ? children : null}
    </View>
  );
});
MapView.displayName = 'MapView';

const Marker = ({ children, coordinate, onPress, tracksViewChanges, ...rest }) => {
  const region = { latitudeDelta: 0.12, longitudeDelta: 0.12, latitude: 18.5204, longitude: 73.8567 };
  const pos = posFor(coordinate?.latitude ?? 18.52, coordinate?.longitude ?? 73.85, region);
  return (
    <View
      {...rest}
      onClick={onPress}
      style={{ position: 'absolute', left: `${pos.left}%`, top: `${pos.top}%`, zIndex: 5 }}
    >
      {children ?? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#5d5fef' }} />}
    </View>
  );
};

const Polyline = ({ strokeColor, strokeWidth = 2, lineDashPattern, coordinates }) => (
  <View
    style={{
      position: 'absolute',
      left: '8%',
      right: '8%',
      top: '50%',
      height: strokeWidth,
      backgroundColor: strokeColor ?? '#5d5fef',
      borderStyle: lineDashPattern ? 'dashed' : 'solid',
      borderRadius: strokeWidth / 2,
      zIndex: 3,
    }}
  />
);

export default MapView;
