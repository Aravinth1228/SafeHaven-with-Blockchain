import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DangerZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: 'low' | 'medium' | 'high';
}

interface UserLocation {
  touristId: string;
  username: string;
  lat: number;
  lng: number;
  address?: string;
  status: 'safe' | 'alert' | 'danger';
}

interface Props {
  dangerZones?: DangerZone[];
  userLocations?: UserLocation[];
  currentUserLocation?: { lat: number; lng: number; status?: 'safe' | 'alert' | 'danger'; accuracy?: number } | null;
  showDangerZones?: boolean;
  showUserMarkers?: boolean;
  isAdmin?: boolean;
  focusUserId?: string | null;
  onLocationSelect?: (lat: number, lng: number) => void;
}

const STATUS_CONFIG = {
  safe:   { color: '#22c55e', glow: '#16a34a', label: 'SAFE',   emoji: '✅', pulse: '#4ade80' },
  alert:  { color: '#f59e0b', glow: '#d97706', label: 'ALERT',  emoji: '⚠️', pulse: '#fbbf24' },
  danger: { color: '#ef4444', glow: '#dc2626', label: 'DANGER', emoji: '🚨', pulse: '#f87171' },
};

// Map tile layers
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    label: '🗺 Street',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    label: '🛰 Satellite',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors',
    label: '🏔 Terrain',
  },
};

const LeafletMap: React.FC<Props> = ({
  dangerZones = [],
  userLocations = [],
  currentUserLocation,
  showDangerZones = true,
  showUserMarkers = true,
  isAdmin = false,
  focusUserId = null,
  onLocationSelect,
}) => {
  const [map, setMap] = useState<L.Map | null>(null);
  const [tileLayer, setTileLayer] = useState<'street' | 'satellite' | 'terrain'>('street');
  const [isFollowing, setIsFollowing] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapId = useRef(`leaflet-map-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);

  const markersRef         = useRef<L.Marker[]>([]);
  const circlesRef         = useRef<(L.Circle | L.CircleMarker)[]>([]);
  const currentUserMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef  = useRef<L.Circle | null>(null);
  const trailPolylineRef   = useRef<L.Polyline | null>(null);
  const tileLayerRef       = useRef<L.TileLayer | null>(null);
  const trailPointsRef     = useRef<[number, number][]>([]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const center: [number, number] = [
      currentUserLocation?.lat ?? 20.5937,
      currentUserLocation?.lng ?? 78.9629,
    ];

    const mapInstance = L.map(mapId.current, {
      center,
      zoom: currentUserLocation ? 16 : 5,
      zoomControl: false,
      attributionControl: true,
    });

    // Custom zoom control — top right
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // Tile layer
    const tile = L.tileLayer(TILE_LAYERS.street.url, {
      attribution: TILE_LAYERS.street.attribution,
      maxZoom: 20,
    }).addTo(mapInstance);
    tileLayerRef.current = tile;

    // Scale bar
    L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(mapInstance);

    setMap(mapInstance);
    return () => { mapInstance.remove(); };
  }, []);

  // ── Switch tile layer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !tileLayerRef.current) return;
    tileLayerRef.current.remove();
    const cfg = TILE_LAYERS[tileLayer];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);
  }, [map, tileLayer]);

  // ── Current user marker + accuracy ring + trail ───────────────────────────
  useEffect(() => {
    if (!map || !currentUserLocation) return;

    const { lat, lng, status = 'safe', accuracy } = currentUserLocation;
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe;
    const pos: [number, number] = [lat, lng];

    // --- accuracy circle ---
    if (accuracyCircleRef.current) accuracyCircleRef.current.remove();
    if (accuracy && accuracy > 0 && accuracy < 500) {
      accuracyCircleRef.current = L.circle(pos, {
        radius: accuracy,
        color: cfg.color,
        fillColor: cfg.color,
        fillOpacity: 0.07,
        weight: 1,
        dashArray: '4 4',
      }).addTo(map);
    }

    // --- trail ---
    const trail = trailPointsRef.current;
    const last = trail[trail.length - 1];
    const moved = !last || Math.abs(last[0] - lat) > 0.00005 || Math.abs(last[1] - lng) > 0.00005;
    if (moved) {
      trail.push(pos);
      if (trail.length > 120) trail.shift(); // keep last ~120 points
    }
    if (trailPolylineRef.current) trailPolylineRef.current.remove();
    if (trail.length > 1) {
      trailPolylineRef.current = L.polyline(trail, {
        color: cfg.color,
        weight: 3,
        opacity: 0.55,
        dashArray: '6 4',
        lineJoin: 'round',
      }).addTo(map);
    }

    // --- marker ---
    if (currentUserMarkerRef.current) currentUserMarkerRef.current.remove();

    const icon = L.divIcon({
      className: '',
      html: `
        <div class="cu-wrapper" style="--c:${cfg.color};--g:${cfg.glow};--p:${cfg.pulse};">
          <div class="cu-ring cu-ring1"></div>
          <div class="cu-ring cu-ring2"></div>
          <div class="cu-dot">${cfg.emoji}</div>
          <div class="cu-beam"></div>
        </div>`,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      popupAnchor: [0, -32],
    });

    const marker = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map);
    marker.bindPopup(`
      <div style="font-family:'Segoe UI',sans-serif;padding:12px;min-width:230px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${cfg.color};box-shadow:0 0 6px ${cfg.glow};"></div>
          <strong style="color:${cfg.color};font-size:14px;">${cfg.emoji} YOUR LOCATION · ${cfg.label}</strong>
        </div>
        <div style="background:#f8f8f8;border-radius:8px;padding:10px;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">📍 GPS Coordinates</div>
          <div style="font-size:13px;color:${cfg.color};font-family:monospace;font-weight:700;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          ${accuracy ? `<div style="font-size:10px;color:#999;margin-top:4px;">Accuracy: ±${Math.round(accuracy)}m</div>` : ''}
          <div style="font-size:10px;color:#aaa;margin-top:2px;">🛰 Real-time GPS tracking active</div>
        </div>
      </div>`);
    currentUserMarkerRef.current = marker;

    // Auto-follow
    if (isFollowing) map.setView(pos, map.getZoom(), { animate: true });
  }, [map, currentUserLocation, isFollowing]);

  // ── Danger zones ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !showDangerZones) return;
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    const cfg: Record<string, { fill: string; stroke: string }> = {
      low:    { fill: '#eab308', stroke: '#ca8a04' },
      medium: { fill: '#f97316', stroke: '#ea580c' },
      high:   { fill: '#ef4444', stroke: '#dc2626' },
    };

    dangerZones.forEach(zone => {
      const c = cfg[zone.level] ?? cfg.high;

      // Outer glow ring
      const glowCircle = L.circle([zone.lat, zone.lng], {
        radius: zone.radius * 1.15,
        color: c.stroke,
        fillColor: c.fill,
        fillOpacity: 0.06,
        weight: 1,
        dashArray: '6 4',
      }).addTo(map);

      // Main zone
      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radius,
        color: c.stroke,
        fillColor: c.fill,
        fillOpacity: 0.22,
        weight: 2.5,
      }).addTo(map);

      // Center pin
      const pin = L.circleMarker([zone.lat, zone.lng], {
        radius: 7,
        color: '#fff',
        fillColor: c.fill,
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);

      const popupHtml = `
        <div style="font-family:'Segoe UI',sans-serif;padding:10px;min-width:200px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:18px;">🚫</span>
            <strong style="color:${c.fill};font-size:14px;">${zone.name}</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:#555;">
            <div>⚠️ Level: <strong style="color:${c.fill}">${zone.level.toUpperCase()}</strong></div>
            <div>📏 Radius: <strong>${zone.radius}m</strong></div>
            <div style="font-size:10px;color:#999;font-family:monospace;">${zone.lat.toFixed(5)}, ${zone.lng.toFixed(5)}</div>
          </div>
        </div>`;
      circle.bindPopup(popupHtml);
      pin.bindPopup(popupHtml);

      circlesRef.current.push(glowCircle, circle, pin as unknown as L.Circle);
    });
  }, [map, dangerZones, showDangerZones]);

  // ── Other user markers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !showUserMarkers) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    userLocations.forEach(user => {
      const status = user.status ?? 'safe';
      const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe;

      const isFocused = focusUserId === user.touristId;
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            display:flex;align-items:center;gap:6px;
            background:rgba(10,12,24,0.92);
            border:${isFocused ? '3px' : '2px'} solid ${cfg.color};
            border-radius:22px;
            padding:4px 10px 4px 4px;
            white-space:nowrap;
            backdrop-filter:blur(10px);
            box-shadow:0 2px 16px ${cfg.color}60,0 0 0 ${isFocused ? '4px' : '1px'} ${cfg.color}${isFocused ? '80' : '30'};
            transform:${isFocused ? 'scale(1.15)' : 'scale(1)'};
            transition:all .2s;
          ">
            <div style="
              width:${isFocused ? '30px' : '26px'};height:${isFocused ? '30px' : '26px'};border-radius:50%;
              background:linear-gradient(135deg,${cfg.color},${cfg.glow});
              border:2px solid rgba(255,255,255,0.9);
              display:flex;align-items:center;justify-content:center;
              font-size:${isFocused ? '12px' : '10px'};font-weight:800;color:#fff;flex-shrink:0;
              box-shadow:0 0 ${isFocused ? '14px' : '8px'} ${cfg.color}80;
            ">${user.username.slice(0, 2).toUpperCase()}</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
              <span style="font-size:${isFocused ? '12px' : '11px'};font-weight:700;color:#fff;">${user.username}</span>
              <span style="font-size:9px;color:${cfg.color};font-weight:600;">${cfg.label}${isFocused ? ' 📍' : ''}</span>
            </div>
          </div>`,
        iconSize: [160, 38],
        iconAnchor: [80, 19],
        popupAnchor: [0, -22],
      });

      const marker = L.marker([user.lat, user.lng], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Segoe UI',sans-serif;padding:10px;min-width:210px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${cfg.color};box-shadow:0 0 6px ${cfg.glow};"></div>
            <strong style="color:${cfg.color};font-size:14px;">${cfg.emoji} ${cfg.label}</strong>
          </div>
          <div style="font-size:12px;color:#444;margin-bottom:3px;"><strong>👤</strong> ${user.username}</div>
          <div style="font-size:11px;color:#888;margin-bottom:3px;"><strong>🆔</strong> ${user.touristId}</div>
          ${user.address ? `<div style="font-size:10px;color:#999;margin-bottom:3px;"><strong>📍</strong> ${user.address}</div>` : ''}
          <div style="font-size:10px;color:#aaa;font-family:monospace;">${user.lat.toFixed(5)}, ${user.lng.toFixed(5)}</div>
        </div>`);

      markersRef.current.push(marker);
    });
  }, [map, userLocations, showUserMarkers]);

  // ── Focus on selected user ───────────────────────────────────────────────
  useEffect(() => {
    if (!map || !focusUserId) return;
    const user = userLocations.find(u => u.touristId === focusUserId);
    if (!user) return;
    map.setView([user.lat, user.lng], 17, { animate: true });
    // Open popup for this marker
    markersRef.current.forEach(m => {
      const pos = m.getLatLng();
      if (Math.abs(pos.lat - user.lat) < 0.0001 && Math.abs(pos.lng - user.lng) < 0.0001) {
        m.openPopup();
      }
    });
  }, [map, focusUserId, userLocations]);

  // ── Map click ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !onLocationSelect) return;
    const fn = (e: L.LeafletMouseEvent) => onLocationSelect(e.latlng.lat, e.latlng.lng);
    map.on('click', fn);
    return () => { map.off('click', fn); };
  }, [map, onLocationSelect]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    setTimeout(() => map.invalidateSize(), 100);
  }, [isFullscreen, map]);

  // ── Locate (snap to user) ─────────────────────────────────────────────────
  const handleLocate = useCallback(() => {
    if (!map || !currentUserLocation) return;
    map.setView([currentUserLocation.lat, currentUserLocation.lng], 17, { animate: true });
    setIsFollowing(true);
  }, [map, currentUserLocation]);

  // Disable follow when user manually pans
  useEffect(() => {
    if (!map) return;
    const onDrag = () => setIsFollowing(false);
    map.on('dragstart', onDrag);
    return () => { map.off('dragstart', onDrag); };
  }, [map]);

  return (
    <>
      {/* ── Injected CSS ── */}
      <style>{`
        /* Current user pulsing marker */
        .cu-wrapper {
          position: relative;
          width: 56px; height: 56px;
          display: flex; align-items: center; justify-content: center;
        }
        .cu-ring {
          position: absolute;
          border-radius: 50%;
          border: 2.5px solid var(--c);
          animation: cuRing 2s ease-out infinite;
        }
        .cu-ring1 { width: 56px; height: 56px; animation-delay: 0s; }
        .cu-ring2 { width: 56px; height: 56px; animation-delay: 0.8s; }
        @keyframes cuRing {
          0%   { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .cu-dot {
          position: relative; z-index: 2;
          width: 38px; height: 38px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, var(--p), var(--c));
          border: 3px solid #fff;
          box-shadow: 0 0 0 3px var(--c), 0 4px 20px var(--g);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }
        .cu-beam {
          position: absolute;
          bottom: -14px; left: 50%;
          transform: translateX(-50%);
          width: 2px; height: 14px;
          background: linear-gradient(to bottom, var(--c), transparent);
          border-radius: 2px;
        }

        /* Map control buttons */
        .lmap-ctrl-btn {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px;
          background: rgba(255,255,255,0.97);
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: background .15s, box-shadow .15s;
          box-shadow: 0 1px 5px rgba(0,0,0,.15);
        }
        .lmap-ctrl-btn:hover {
          background: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,.2);
        }
        .lmap-ctrl-btn.active {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #fff;
        }

        /* Tile switcher */
        .tile-switcher {
          display: flex; flex-direction: column; gap: 4px;
        }
        .tile-switcher button {
          font-size: 11px; font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #ddd;
          background: #fff;
          cursor: pointer;
          transition: all .15s;
          white-space: nowrap;
        }
        .tile-switcher button.active {
          background: #2563eb; color: #fff; border-color: #1d4ed8;
        }

        /* Legend */
        .map-legend {
          font-family: 'Segoe UI', sans-serif;
          font-size: 11px;
          min-width: 160px;
        }
        .map-legend-row {
          display: flex; align-items: center; gap: 7px;
          padding: 2px 0;
          color: #333;
        }
        .legend-dot {
          width: 11px; height: 11px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1.5px solid rgba(0,0,0,.2);
        }

        /* Leaflet popup tweaks */
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,.18) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip-container { margin-top: -1px; }
      `}</style>

      <div
        ref={containerRef}
        className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : 'h-full'}`}
        style={isFullscreen ? {} : { height: '100%' }}
      >
        {/* Map */}
        <div id={mapId.current} className="w-full h-full" style={{ zIndex: 1 }} />

        {/* ── Top-left controls ── */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
          {/* Tile layer switcher */}
          <div className="bg-white/97 rounded-xl shadow-md border border-gray-200 p-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Map Type</div>
            <div className="tile-switcher">
              {(Object.entries(TILE_LAYERS) as [typeof tileLayer, typeof TILE_LAYERS[keyof typeof TILE_LAYERS]][]).map(([key, val]) => (
                <button
                  key={key}
                  className={tileLayer === key ? 'active' : ''}
                  onClick={() => setTileLayer(key)}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Top-right extra controls ── */}
        <div className="absolute top-3 right-12 z-[1000] flex flex-col gap-2">
          {/* Locate / Follow */}
          {currentUserLocation && (
            <button
              className={`lmap-ctrl-btn ${isFollowing ? 'active' : ''}`}
              onClick={handleLocate}
              title={isFollowing ? 'Following your location' : 'Snap to my location'}
            >
              {isFollowing ? '🎯' : '📍'}
            </button>
          )}

          {/* Fullscreen */}
          <button
            className={`lmap-ctrl-btn ${isFullscreen ? 'active' : ''}`}
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>

          {/* Legend toggle */}
          <button
            className={`lmap-ctrl-btn ${showLegend ? 'active' : ''}`}
            onClick={() => setShowLegend(s => !s)}
            title="Toggle legend"
          >
            ℹ️
          </button>
        </div>

        {/* ── Legend ── */}
        {showLegend && (
          <div className="absolute bottom-10 left-3 z-[1000] bg-white/97 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-200 map-legend">
            <div className="font-bold text-gray-600 mb-2 text-[11px] uppercase tracking-wider">Legend</div>

            <div className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Danger Zones</div>
            {[['high','#ef4444','High Risk'],['medium','#f97316','Medium Risk'],['low','#eab308','Low Risk']].map(([,color,label])=>(
              <div className="map-legend-row" key={label}>
                <span className="legend-dot" style={{background:color}}/>
                <span>{label}</span>
              </div>
            ))}

            <div className="text-[10px] text-gray-400 font-semibold uppercase mt-2 mb-1">Users</div>
            {[['#22c55e','Safe'],['#f59e0b','Alert'],['#ef4444','Danger']].map(([color,label])=>(
              <div className="map-legend-row" key={label}>
                <span className="legend-dot" style={{background:color}}/>
                <span>{label}</span>
              </div>
            ))}

            <div className="text-[10px] text-gray-400 font-semibold uppercase mt-2 mb-1">Other</div>
            <div className="map-legend-row">
              <span style={{fontSize:12}}>〰️</span>
              <span>Movement trail</span>
            </div>
            <div className="map-legend-row">
              <span style={{fontSize:12}}>⭕</span>
              <span>GPS accuracy ring</span>
            </div>
          </div>
        )}

        {/* ── Live badge ── */}
        {currentUserLocation && (
          <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 bg-black/75 backdrop-blur text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg border border-white/10">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
        )}

        {/* ── Fullscreen ESC hint ── */}
        {isFullscreen && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
            Press <kbd className="bg-white/20 px-1.5 rounded">✕</kbd> to exit fullscreen
          </div>
        )}
      </div>
    </>
  );
};

export default LeafletMap;