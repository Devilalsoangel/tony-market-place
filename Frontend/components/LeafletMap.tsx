import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, Dimensions, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Shared Leaflet map (WebView-based) for the whole app — ONE instance that
 * stays mounted at the root layout, so screens re-entering the map get it
 * INSTANTLY (no reload, no CDN re-fetch, tiles stay cached in the WebView).
 * Screens mount a <LeafletMapHost> at the exact frame the map should occupy;
 * the provider measures the host and positions the single WebView over it.
 * Live updates: markers update IN PLACE via setLatLng (no rebuild flicker).
 *
 * Why not react-native-maps: Google Maps SDK is dead in Expo Go SDK 52+ on
 * Android (blank map + watermark only, verified Aug 15). This is pure JS:
 * Leaflet 1.9.4 (CDN) + CARTO Positron light_all tiles — free, keyless.
 */
export type MapMarkerKind = 'pin' | 'user' | 'car' | 'bike' | 'person' | 'office' | 'garage';

export interface LeafletMarker {
  id: string;
  lat: number;
  lng: number;
  kind: MapMarkerKind;
  color?: string;
}

export interface LeafletMapHostProps {
  markers?: LeafletMarker[];
  route?: { latitude: number; longitude: number }[] | null;
  focus?: string | null;
  /** Re-center the map when this object changes identity. */
  center?: { lat: number; lng: number; zoom: number } | null;
  style?: ViewStyle;
  onMarkerPress?: (id: string) => void;
  onReady?: () => void;
  onError?: () => void;
}

const TILE_URL = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

const ICON_PATHS: Record<string, string> = {
  person:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  car: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
  bike: 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z',
  office:
    'M3 21h18v-2H3v2zM5 19h4v-4h6v4h4V9l-7-6-7 6v10zm5-8h4v2h-4v-2z',
  garage:
    'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
};

const MARK_HTML = (path: string) =>
  `<svg viewBox="0 0 24 24" width="17" height="17"><path fill="#ffffff" d="${path}"/></svg>`;

const PIN_HTML =
  '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="#ffffff" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>';

// Leaflet is inited while the WebView is hidden, so it must mount at a REAL
// size (the eventual map area ≈ full screen minus header) — mounting 1x1 makes
// Leaflet request no tiles and Android WebView does not reliably fire the
// page resize event, leaving a permanently blank map (verified Aug 15).
const DEFAULT_MAP_W = Dimensions.get('window').width;
const DEFAULT_MAP_H = Dimensions.get('window').height - 176;

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  // CDN fallback: if unpkg failed (offline CDN, DNS, etc.), retry via cdnjs.
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target.tagName === 'SCRIPT' && !window.L && !window.__susejFallback) {
      window.__susejFallback = true;
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      document.head.appendChild(s);
    }
  }, true);
</script>
<style>
  html, body, #map { height: 100%; margin: 0; }
  .leaflet-control-attribution { display: none; }
  .leaflet-bottom.leaflet-left { display: none; }
  .susej-pin {
    width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;
    border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(26, 26, 46, 0.35);
  }
  .susej-pin svg { transform: rotate(45deg); }
  .susej-dot {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(26, 26, 46, 0.3);
  }
  .susej-user {
    position: relative; width: 38px; height: 38px; border-radius: 50%;
    background: #4343d5; border: 3px solid #ffffff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(67, 67, 213, 0.45);
  }
  .susej-user::after {
    content: ''; position: absolute; inset: -10px; border-radius: 50%;
    border: 2px solid rgba(67, 67, 213, 0.5); animation: pulse 1.8s ease-out infinite;
  }
  @keyframes pulse { 0% { transform: scale(0.55); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
  .susej-attr {
    position: absolute; left: 8px; bottom: 8px; z-index: 1000;
    font: 10px/1.4 Arial, sans-serif; color: #464555;
    background: rgba(255, 255, 255, 0.9); padding: 2px 8px; border-radius: 10px;
    box-shadow: 0 1px 4px rgba(26, 26, 46, 0.15);
  }
</style>
</head>
<body>
<div id="map"></div>
<div class="susej-attr">Map © OpenStreetMap</div>
<script>
  var map = null;
  function startMap() {
    if (map) return;
    map = L.map('map', { attributionControl: false, zoomControl: false });
    L.tileLayer('${TILE_URL}', { maxZoom: 19, detectRetina: true }).addTo(map);
    map.setView([18.5204, 73.8567], 13);
    // Android WebView does not reliably fire window resize when the view
    // resizes — re-invalidate on any resize we DO get, and after every sync.
    window.addEventListener('resize', function () { if (map) setTimeout(function () { map.invalidateSize(); }, 60); });
  }
  // Leaflet may still be downloading (or retrying via cdnjs) — poll until it exists.
  (function boot() {
    if (window.L) { startMap(); } else { setTimeout(boot, 150); }
  })();
  var markers = {};
  var routeLine = null;
  var routeA = null;
  var routeB = null;
  var PATHS = {
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    car: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
    bike: 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z',
    office: 'M3 21h18v-2H3v2zM5 19h4v-4h6v4h4V9l-7-6-7 6v10zm5-8h4v2h-4v-2z',
    garage: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z'
  };
  function iconHtml(m) {
    if (m.kind === 'pin') {
      return '<div class="susej-pin" style="background:' + (m.color || '#4343d5') + '">' + '${PIN_HTML}' + '</div>';
    }
    if (m.kind === 'user') {
      return '<div class="susej-user">' + MARK_HTML(PATHS.person) + '</div>';
    }
    return '<div class="susej-dot" style="background:' + (m.color || '#4343d5') + '">' + MARK_HTML(PATHS[m.kind] || PATHS.person) + '</div>';
  }
  window.sync = function (data) {
    if (!map) { setTimeout(function () { window.sync(data); }, 200); return; }
    if (data.center) {
      map.setView([data.center.lat, data.center.lng], data.center.zoom || map.getZoom(), { animate: true });
    }
    map.invalidateSize();
    var next = {};
    (data.markers || []).forEach(function (m) {
      next[m.id] = true;
      var old = markers[m.id];
      if (old) {
        if (old.kind === m.kind && old.color === m.color) {
          old.setLatLng([m.lat, m.lng]);
          old.setZIndexOffset(m.id === data.focus ? 1000 : 0);
          return;
        }
        map.removeLayer(old);
        delete markers[m.id];
      }
      var mk = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ html: iconHtml(m), className: '', iconSize: [38, 38], iconAnchor: m.kind === 'pin' ? [19, 38] : [19, 19] }),
        zIndexOffset: m.id === data.focus ? 1000 : 0
      });
      mk.on('click', function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
      });
      mk.addTo(map);
      markers[m.id] = mk;
    });
    Object.keys(markers).forEach(function (k) {
      if (!next[k]) { map.removeLayer(markers[k]); delete markers[k]; }
    });
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (routeA) { map.removeLayer(routeA); routeA = null; }
    if (routeB) { map.removeLayer(routeB); routeB = null; }
    if (data.route && data.route.length >= 2) {
      routeLine = L.polyline(data.route, { color: '#4343d5', weight: 4, dashArray: '4 8', opacity: 1 }).addTo(map);
      routeA = L.circleMarker(data.route[0], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#4343d5', fillOpacity: 1 }).addTo(map);
      routeB = L.circleMarker(data.route[data.route.length - 1], { radius: 9, color: '#ffffff', weight: 2, fillColor: '#50519b', fillOpacity: 1 }).addTo(map);
    }
  };
</script>
</body>
</html>`;

interface MapFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MapPayload {
  markers: LeafletMarker[];
  route: [number, number][];
  focus: string | null;
}

interface LeafletMapContextValue {
  attach: (frame: MapFrame, radius: number) => void;
  detach: () => void;
  setPayload: (payload: MapPayload) => void;
  setCenter: (center: { lat: number; lng: number; zoom: number } | null) => void;
  loaded: boolean;
  onMarkerPressRef: React.MutableRefObject<(id: string) => void>;
  onReadyRef: React.MutableRefObject<() => void>;
  onErrorRef: React.MutableRefObject<() => void>;
}

const LeafletMapContext = createContext<LeafletMapContextValue | null>(null);

export function useLeafletMap(): LeafletMapContextValue {
  const ctx = useContext(LeafletMapContext);
  if (!ctx) {
    throw new Error('useLeafletMap must be used inside <LeafletMapProvider>');
  }
  return ctx;
}

export function LeafletMapProvider({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<MapFrame | null>(null);
  const [radius, setRadius] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const webRef = useRef<WebView>(null);
  const loadedRef = useRef(false);
  const payloadRef = useRef<MapPayload>({ markers: [], route: [], focus: null });
  const centerRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const onMarkerPressRef = useRef<(id: string) => void>(() => {});
  const onReadyRef = useRef<() => void>(() => {});
  const onErrorRef = useRef<() => void>(() => {});

  const syncNow = useCallback(() => {
    webRef.current?.injectJavaScript(
      `window.sync(${JSON.stringify({ markers: payloadRef.current.markers, route: payloadRef.current.route, focus: payloadRef.current.focus, center: centerRef.current })}); true`
    );
  }, []);

  useEffect(() => {
    if (loadedRef.current) syncNow();
  }, [syncTick, syncNow]);

  // Frame changes (screen enter/resize) must re-sync + invalidate so Leaflet
  // refetches tiles for the new viewport (Android WebView may skip resize events).
  useEffect(() => {
    if (loadedRef.current && frame) syncNow();
  }, [frame, syncNow]);

  const attach = useCallback((f: MapFrame, r: number) => {
    setFrame(f);
    setRadius(r);
    setVisible(true);
  }, []);

  const detach = useCallback(() => setVisible(false), []);

  const setPayload = useCallback((p: MapPayload) => {
    payloadRef.current = p;
    setSyncTick((t) => t + 1);
  }, []);

  const setCenter = useCallback((c: { lat: number; lng: number; zoom: number } | null) => {
    centerRef.current = c;
    setSyncTick((t) => t + 1);
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; id?: string };
      if (msg.type === 'marker' && msg.id) onMarkerPressRef.current(msg.id);
    } catch {
      // ignore malformed messages
    }
  };

  const value = useMemo<LeafletMapContextValue>(
    () => ({ attach, detach, setPayload, setCenter, loaded, onMarkerPressRef, onReadyRef, onErrorRef }),
    [attach, detach, setPayload, setCenter, loaded]
  );

  return (
    <LeafletMapContext.Provider value={value}>
      {/* WebView FIRST so screens (children) render above it; screens keep their
          map area transparent + pointerEvents="none" so the map shows + receives taps.
          The WebView sits inside an absolutely-positioned wrapper View: on Android the
          WebView component's own style handling can drop position:absolute and the
          view renders inline, pushing the whole app down (verified Aug 15). */}
      <View
        pointerEvents={visible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          left: visible && frame ? frame.x : -9999,
          top: visible && frame ? frame.y : 0,
          // Hidden: mount at the real map size (offscreen) so Leaflet initializes
          // with tiles instead of a 1x1 viewport (blank map, verified Aug 15).
          width: frame?.w ?? DEFAULT_MAP_W,
          height: frame?.h ?? DEFAULT_MAP_H,
          borderRadius: radius,
          overflow: 'hidden',
          opacity: visible ? 1 : 0,
          // NO zIndex here: on Android RN re-sorts siblings by zIndex and the
          // WebView wrapper would paint ABOVE the whole Stack, covering every
          // overlay (verified Aug 15). Sibling order (WebView first, children
          // after) already puts the app's screens above the map.
        }}
        collapsable={false}
      >
        <WebView
          ref={webRef}
          source={{ html: MAP_HTML }}
          style={{ flex: 1 }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          overScrollMode="never"
          setBuiltInZoomControls={false}
          cacheEnabled
          onLoadEnd={() => {
            loadedRef.current = true;
            setLoaded(true);
            syncNow();
            onReadyRef.current();
          }}
          onError={() => onErrorRef.current()}
          onMessage={onMessage}
        />
      </View>
      {children}
    </LeafletMapContext.Provider>
  );
}

export function LeafletMapHost({
  markers = [],
  route = null,
  focus = null,
  center = null,
  style,
  onMarkerPress,
  onReady,
  onError,
}: LeafletMapHostProps) {
  const map = useLeafletMap();
  const hostRef = useRef<View>(null);
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    map.onMarkerPressRef.current = onMarkerPress ?? (() => {});
  }, [onMarkerPress, map]);
  useEffect(() => {
    map.onReadyRef.current = onReady ?? (() => {});
  }, [onReady, map]);
  useEffect(() => {
    map.onErrorRef.current = onError ?? (() => {});
  }, [onError, map]);

  // The shared WebView may have finished loading BEFORE this host mounted
  // (it loads once at app start) — in that case onLoadEnd already fired and
  // the host must report ready itself, immediately.
  useEffect(() => {
    if (map.loaded && attached && onReady) onReady();
  }, [map.loaded, attached, onReady]);

  useEffect(() => {
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      hostRef.current?.measureInWindow((x, y, w, h) => {
        if (disposed || w <= 1 || h <= 1) return;
        const r = (style && typeof style.borderRadius === 'number' ? style.borderRadius : 0) as number;
        map.attach({ x, y, w, h }, r);
        setAttached(true);
      });
    };
    const t = setTimeout(measure, 80);
    const iv = setInterval(measure, 400);
    return () => {
      disposed = true;
      clearTimeout(t);
      clearInterval(iv);
      map.detach();
    };
  }, [map, style]);

  useEffect(() => {
    map.setPayload({
      markers,
      route: route ? route.map((p) => [p.latitude, p.longitude]) : [],
      focus,
    });
  }, [map, markers, route, focus]);

  useEffect(() => {
    if (center) map.setCenter(center);
  }, [map, center]);

  return <View ref={hostRef} style={[{ backgroundColor: 'transparent' }, style]} pointerEvents="none" collapsable={false} />;
}