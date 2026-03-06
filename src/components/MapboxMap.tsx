import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  status: 'safe' | 'alert' | 'danger';
}

interface Props {
  dangerZones?: DangerZone[];
  userLocations?: UserLocation[];
  currentUserLocation?: { lat: number; lng: number; status?: 'safe' | 'alert' | 'danger' } | null;
  showDangerZones?: boolean;
  showUserMarkers?: boolean;
  isAdmin?: boolean;
}

const STATUS_CONFIG = {
  safe: { color: '#22c55e', glow: '#22c55e80', label: 'SAFE', emoji: '✅', bg: '#052e16' },
  alert: { color: '#f59e0b', glow: '#f59e0b80', label: 'ALERT', emoji: '⚠️', bg: '#451a03' },
  danger: { color: '#ef4444', glow: '#ef444480', label: 'DANGER', emoji: '🚨', bg: '#450a0a' },
};

/** Creates a Snapchat-style floating name badge element */
function createSnapMarker(username: string, status: 'safe' | 'alert' | 'danger'): HTMLDivElement {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  const initials = username.slice(0, 2).toUpperCase();

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    filter: drop-shadow(0 4px 12px ${cfg.glow});
  `;

  // ── Name card (top) ──
  const card = document.createElement('div');
  card.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(10,10,20,0.92);
    border: 1.5px solid ${cfg.color};
    border-radius: 20px;
    padding: 4px 10px 4px 4px;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    transition: transform 0.15s ease;
    max-width: 160px;
  `;

  // Avatar circle with initials
  const avatar = document.createElement('div');
  avatar.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${cfg.color}, ${cfg.glow});
    border: 2px solid ${cfg.color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.5px;
  `;
  avatar.textContent = initials;

  // Name text
  const nameEl = document.createElement('span');
  nameEl.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 110px;
  `;
  nameEl.textContent = username;

  card.appendChild(avatar);
  card.appendChild(nameEl);

  // ── Connector line ──
  const line = document.createElement('div');
  line.style.cssText = `
    width: 2px;
    height: 8px;
    background: ${cfg.color};
    opacity: 0.8;
  `;

  // ── Status dot (bottom) ──
  const dot = document.createElement('div');
  dot.style.cssText = `
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${cfg.color};
    border: 2.5px solid rgba(255,255,255,0.9);
    box-shadow: 0 0 6px ${cfg.color};
  `;

  if (status === 'alert' || status === 'danger') {
    dot.style.animation = 'snap-pulse 1.4s ease-in-out infinite';
    card.style.animation = 'snap-card-pulse 1.4s ease-in-out infinite';
  }

  wrapper.appendChild(card);
  wrapper.appendChild(line);
  wrapper.appendChild(dot);

  return wrapper;
}

const MapboxMap: React.FC<Props> = ({
  dangerZones = [],
  userLocations = [],
  currentUserLocation,
  showDangerZones = true,
  showUserMarkers = true,
  isAdmin = false,
}) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const zoneIdsRef = useRef<string[]>([]);

  const envToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
  const [token, setToken] = useState(envToken || localStorage.getItem('mapboxToken') || '');
  const [ready, setReady] = useState(!!token);

  const saveToken = () => {
    if (!token.trim()) return;
    localStorage.setItem('mapboxToken', token.trim());
    setReady(true);
  };

  useEffect(() => {
    if (envToken && !ready) setReady(true);
  }, [envToken, ready]);

  // ── MAP INIT ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !ready || mapRef.current) return;

    mapboxgl.accessToken = token;
    
    // Center on current user location if available, otherwise default to India
    const defaultCenter = currentUserLocation
      ? [currentUserLocation.lng, currentUserLocation.lat]
      : [78.9629, 20.5937];
    const defaultZoom = currentUserLocation ? 15 : 4;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: defaultCenter,
      zoom: defaultZoom,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl());

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [ready]);

  // ── CENTER MAP ON CURRENT USER LOCATION CHANGE ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentUserLocation) return;

    // Smooth fly to user location when it changes
    map.flyTo({
      center: [currentUserLocation.lng, currentUserLocation.lat],
      zoom: 15,
      essential: true,
      duration: 2000,
    });
  }, [currentUserLocation]);

  // ── DANGER ZONES ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDangerZones) return;

    const onStyleLoad = () => {
      zoneIdsRef.current.forEach((id) => {
        ['fill', 'outline', 'buffer-fill', 'buffer-outline', 'label'].forEach((suffix) => {
          if (map.getLayer(`${id}-${suffix}`)) map.removeLayer(`${id}-${suffix}`);
        });
        if (map.getSource(id)) map.removeSource(id);
        if (map.getSource(`${id}-buffer`)) map.removeSource(`${id}-buffer`);
        if (map.getSource(`${id}-label`)) map.removeSource(`${id}-label`);
      });
      zoneIdsRef.current = [];

      dangerZones.forEach((zone) => {
        const id = `zone-${zone.id}`;
        zoneIdsRef.current.push(id);

        const zoneConfig = {
          high: { color: '#ef4444', opacity: 0.35, bufferColor: '#f87171' },
          medium: { color: '#f97316', opacity: 0.25, bufferColor: '#fb923c' },
          low: { color: '#eab308', opacity: 0.15, bufferColor: '#facc15' },
        };
        const cfg = zoneConfig[zone.level] || zoneConfig.medium;

        const generateCircle = (radiusKm: number): number[][] => {
          const coords: number[][] = [];
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const lat = zone.lat + (radiusKm * Math.sin(angle)) / 110.574;
            const lng = zone.lng + (radiusKm * Math.cos(angle)) / (111.32 * Math.cos((zone.lat * Math.PI) / 180));
            coords.push([lng, lat]);
          }
          return coords;
        };

        const rKm = zone.radius / 1000;
        const inner = generateCircle(rKm);
        const buffer = generateCircle(rKm * 1.5);

        map.addSource(id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [inner] } } });
        map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': cfg.color, 'fill-opacity': cfg.opacity } });
        map.addLayer({ id: `${id}-outline`, type: 'line', source: id, paint: { 'line-color': cfg.color, 'line-width': 2, 'line-opacity': 0.8 } });

        map.addSource(`${id}-buffer`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [buffer] } } });
        map.addLayer({ id: `${id}-buffer-fill`, type: 'fill', source: `${id}-buffer`, paint: { 'fill-color': cfg.bufferColor, 'fill-opacity': cfg.opacity * 0.3 } });
        map.addLayer({ id: `${id}-buffer-outline`, type: 'line', source: `${id}-buffer`, paint: { 'line-color': cfg.bufferColor, 'line-width': 1, 'line-dasharray': [4, 4], 'line-opacity': 0.5 } });

        map.addSource(`${id}-label`, { type: 'geojson', data: { type: 'Feature', properties: { name: zone.name }, geometry: { type: 'Point', coordinates: [zone.lng, zone.lat] } } });
        map.addLayer({ id: `${id}-label`, type: 'symbol', source: `${id}-label`, layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'] }, paint: { 'text-color': '#ffffff', 'text-halo-color': cfg.color, 'text-halo-width': 2 } });
      });
    };

    if (map.isStyleLoaded()) onStyleLoad();
    else map.on('load', onStyleLoad);
  }, [dangerZones, showDangerZones]);

  // ── USER MARKERS (Snapchat style) ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Show other users' markers only if showUserMarkers is true (for admin)
    if (showUserMarkers) {
      userLocations.forEach((user) => {
        if (!user.lat || !user.lng) return;

        const el = createSnapMarker(user.username || user.touristId, user.status);

        // Popup shown on click for more detail
        const popup = new mapboxgl.Popup({ offset: [0, -40], maxWidth: '240px', closeButton: false })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif; padding:8px 4px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <div style="width:34px; height:34px; border-radius:50%; background:${STATUS_CONFIG[user.status]?.bg}; border:2px solid ${STATUS_CONFIG[user.status]?.color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:${STATUS_CONFIG[user.status]?.color};">
                  ${(user.username || user.touristId).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight:700; font-size:14px; color:#fff;">${user.username || user.touristId}</div>
                  <div style="font-size:10px; color:#888; font-family:monospace;">${user.touristId}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:10px; background:${STATUS_CONFIG[user.status]?.bg}; border:1.5px solid ${STATUS_CONFIG[user.status]?.color}40; margin-bottom:6px;">
                <div style="width:8px; height:8px; border-radius:50%; background:${STATUS_CONFIG[user.status]?.color}; box-shadow:0 0 6px ${STATUS_CONFIG[user.status]?.color};"></div>
                <span style="font-weight:800; font-size:13px; color:${STATUS_CONFIG[user.status]?.color}; letter-spacing:0.5px;">
                  ${STATUS_CONFIG[user.status]?.emoji} ${STATUS_CONFIG[user.status]?.label}
                </span>
                <span style="margin-left:auto; font-size:9px; color:${STATUS_CONFIG[user.status]?.color}; opacity:0.8;">LIVE</span>
              </div>
              <div style="font-size:11px; color:#888; display:flex; align-items:center; gap:4px;">
                📍 ${user.lat.toFixed(5)}, ${user.lng.toFixed(5)}
              </div>
            </div>
          `);

        // Anchor at bottom (so the dot lands on the coordinate)
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([user.lng, user.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // Current user marker (colored ring based on status) - ALWAYS show for user dashboard
    if (currentUserLocation) {
      const userStatus = currentUserLocation.status || 'safe';
      const statusConfig = STATUS_CONFIG[userStatus];
      
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px; height: 24px; border-radius: 50%;
        background: ${statusConfig.color};
        border: 3px solid white;
        box-shadow: 0 0 0 6px ${statusConfig.glow};
        animation: snap-pulse 2s ease-in-out infinite;
        cursor: pointer;
      `;
      
      const popup = new mapboxgl.Popup({ offset: [0, -30], closeButton: false }).setHTML(
        `<div style="font-family:'Inter',sans-serif; padding:6px 8px; background:rgba(10,10,20,0.95); border-radius:12px; border:1.5px solid ${statusConfig.color};">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:12px; height:12px; border-radius:50%; background:${statusConfig.color}; box-shadow:0 0 8px ${statusConfig.color}; animation: snap-pulse 1s ease-in-out infinite;"></div>
            <strong style="color:#fff; font-size:13px;">${statusConfig.emoji} ${statusConfig.label}</strong>
          </div>
          <div style="font-size:11px; color:#888; margin-top:4px; font-family:monospace;">
            ${currentUserLocation.lat.toFixed(5)}, ${currentUserLocation.lng.toFixed(5)}
          </div>
        </div>`
      );
      
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentUserLocation.lng, currentUserLocation.lat])
        .setPopup(popup)
        .addTo(map);
      
      markersRef.current.push(marker);
    }
  }, [userLocations, currentUserLocation, showUserMarkers]);

  // ── TOKEN INPUT ───────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <input
          placeholder="Enter Mapbox Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="p-2 border rounded"
        />
        <button onClick={saveToken} className="p-2 bg-blue-500 text-white rounded">
          Save Token
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Map Legend */}
      {isAdmin && (
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1.5 border border-white/10 z-10">
          <div className="font-semibold text-white/90 mb-2 text-[11px] uppercase tracking-wider">Legend</div>
          {[
            { color: '#ef4444', label: 'Danger Zone (High)' },
            { color: '#f97316', label: 'Caution Zone (Medium)' },
            { color: '#eab308', label: 'Low Risk Zone' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{ background: color }} className="w-3 h-3 rounded-full border border-white/30 inline-block" />
              <span className="text-white/80">{label}</span>
            </div>
          ))}
          <div className="border-t border-white/10 my-1.5" />
          {[
            { color: '#22c55e', label: 'Tourist (Safe)' },
            { color: '#f59e0b', label: 'Tourist (Alert)' },
            { color: '#ef4444', label: 'Tourist (Danger)' },
            { color: '#3b82f6', label: 'Your Location' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{ background: color }} className="w-3 h-3 rounded-full border border-white/30 inline-block" />
              <span className="text-white/80">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes snap-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.25); opacity: 0.75; }
        }
        @keyframes snap-card-pulse {
          0%, 100% { box-shadow: none; }
          50%       { box-shadow: 0 0 0 3px rgba(239,68,68,0.35); }
        }
      `}</style>
    </div>
  );
};

export default MapboxMap;
