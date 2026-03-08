import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  address?: string;  // Optional address field
  status: 'safe' | 'alert' | 'danger';
}

interface Props {
  dangerZones?: DangerZone[];
  userLocations?: UserLocation[];
  currentUserLocation?: { lat: number; lng: number; status?: 'safe' | 'alert' | 'danger' } | null;
  showDangerZones?: boolean;
  showUserMarkers?: boolean;
  isAdmin?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
}

const STATUS_CONFIG = {
  safe: { color: '#22c55e', glow: '#22c55e80', label: 'SAFE', emoji: '✅', bg: '#052e16' },
  alert: { color: '#f59e0b', glow: '#f59e0b80', label: 'ALERT', emoji: '⚠️', bg: '#451a03' },
  danger: { color: '#ef4444', glow: '#ef444480', label: 'DANGER', emoji: '🚨', bg: '#450a0a' },
};

// Create custom marker element
function createMarkerElement(
  username: string,
  status: 'safe' | 'alert' | 'danger',
  isCurrentUser = false
): HTMLElement {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  const initials = username.slice(0, 2).toUpperCase();

  const el = document.createElement('div');
  el.className = 'maplibre-gl-marker';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s ease;
  `;

  el.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 4px 12px ${cfg.glow});
    ">
      <div style="
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(10,10,20,0.95);
        border: 2px solid ${cfg.color};
        border-radius: 20px;
        padding: 4px 10px 4px 4px;
        white-space: nowrap;
        backdrop-filter: blur(8px);
        max-width: 160px;
        transition: all 0.2s ease;
      " class="marker-label">
        <div style="
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
        ">${initials}</div>
        <span style="
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 110px;
        ">${username}</span>
      </div>
      <div style="
        width: 2px;
        height: 8px;
        background: ${cfg.color};
        opacity: 0.8;
      "></div>
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${cfg.color};
        border: 2.5px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 6px ${cfg.color};
        ${status === 'alert' || status === 'danger' ? 'animation: maplibre-pulse 1.4s ease-in-out infinite;' : ''}
      "></div>
    </div>
  `;

  // Add hover effect
  const label = el.querySelector('.marker-label') as HTMLElement;
  el.addEventListener('mouseenter', () => {
    label.style.transform = 'scale(1.1)';
  });
  el.addEventListener('mouseleave', () => {
    label.style.transform = 'scale(1)';
  });

  return el;
}

// Simple dot marker for current user
function createCurrentUserMarker(status: 'safe' | 'alert' | 'danger'): HTMLElement {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;

  const el = document.createElement('div');
  el.className = 'maplibre-gl-marker-current';
  el.style.cssText = `
    cursor: pointer;
    transition: transform 0.2s ease;
  `;
  el.innerHTML = `
    <div style="
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${cfg.color};
      border: 3px solid white;
      box-shadow: 0 0 0 6px ${cfg.glow};
      animation: maplibre-pulse 2s ease-in-out infinite;
    "></div>
  `;

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.2)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });

  return el;
}

const MapLibreMap: React.FC<Props> = ({
  dangerZones = [],
  userLocations = [],
  currentUserLocation,
  showDangerZones = true,
  showUserMarkers = true,
  isAdmin = false,
  onLocationSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const currentUserMarkerRef = useRef<Marker | null>(null);
  const [activePopup, setActivePopup] = useState<Popup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Don't initialize map without user location - wait for GPS
    if (!currentUserLocation) {
      console.log('⏳ Waiting for GPS location before initializing map...');
      return;
    }

    const defaultCenter = [currentUserLocation.lng, currentUserLocation.lat];
    const defaultZoom = 15; // High zoom for accuracy

    console.log('🗺️ Initializing map with GPS location:', currentUserLocation);

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: false,
      fadeDuration: 300,
    });

    // Add controls
    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right'
    );

    mapRef.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }),
      'bottom-left'
    );

    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    // Click handler for location selection (admin mode)
    if (onLocationSelect) {
      mapRef.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        onLocationSelect(lat, lng);
      });
    }

    // Cleanup
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Center map on current user location change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentUserLocation) return;

    map.flyTo({
      center: [currentUserLocation.lng, currentUserLocation.lat],
      zoom: 16,
      duration: 1500,
      essential: true,
    });
  }, [currentUserLocation?.lat, currentUserLocation?.lng]);

  // Render danger zones as circles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDangerZones) return;

    // Wait for map style to load
    const addDangerZones = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', addDangerZones);
        return;
      }

      // Clear existing sources and layers first
      const existingSources = map.getStyle().sources || {};
      Object.keys(existingSources).forEach(sourceId => {
        if (sourceId.startsWith('danger-zone-')) {
          const layerId = sourceId.replace('danger-zone-', 'danger-zone-fill-');
          const outlineLayerId = sourceId.replace('danger-zone-', 'danger-zone-outline-');
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      });

      // Add new danger zones
      dangerZones.forEach((zone) => {
        const sourceId = `danger-zone-${zone.id}`;
        const layerId = `danger-zone-fill-${zone.id}`;
        const outlineLayerId = `danger-zone-outline-${zone.id}`;

        // Zone color based on level
        const zoneConfig = {
          high: { color: '#ef4444', fillOpacity: 0.25 },
          medium: { color: '#f97316', fillOpacity: 0.2 },
          low: { color: '#eab308', fillOpacity: 0.15 },
        };
        const cfg = zoneConfig[zone.level] || zoneConfig.medium;

        // Create circle using GeoJSON
        const coordinates: [number, number][] = [];
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * 2 * Math.PI;
          const dx = Math.cos(angle) * zone.radius;
          const dy = Math.sin(angle) * zone.radius;
          // Simple approximation (works well for small radii)
          const lng = zone.lng + (dx / 111320) / Math.cos((zone.lat * Math.PI) / 180);
          const lat = zone.lat + dy / 110540;
          coordinates.push([lng, lat]);
        }

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
              },
              properties: { name: zone.name, level: zone.level, radius: zone.radius },
            },
          ],
        };

        try {
          map.addSource(sourceId, {
            type: 'geojson',
            data: geojson,
          });

          // Fill layer
          map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': cfg.color,
              'fill-opacity': cfg.fillOpacity,
            },
          });

          // Outline layer
          map.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': cfg.color,
              'line-width': 2,
              'line-dasharray': zone.level === 'high' ? [0, 0] : [5, 5],
            },
          });
        } catch (error) {
          console.warn('Error adding danger zone:', zone.name, error);
        }

        // Add label marker (this works even if style isn't fully loaded)
        const labelEl = document.createElement('div');
        labelEl.style.cssText = `
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid ${cfg.color};
          white-space: nowrap;
          cursor: pointer;
          backdrop-filter: blur(4px);
        `;
        labelEl.innerHTML = zone.name;

        const labelMarker = new Marker({ element: labelEl, anchor: 'center' })
          .setLngLat([zone.lng, zone.lat])
          .addTo(map);

        // Popup for danger zone
        labelMarker.getElement().addEventListener('click', () => {
          const popup = new Popup({ offset: 25, closeButton: true })
            .setLngLat([zone.lng, zone.lat])
            .setHTML(`
              <div style="font-family: 'Inter', sans-serif; padding: 8px; min-width: 200px;">
                <strong style="color: ${cfg.color}; font-size: 14px;">${zone.name}</strong><br/>
                <span style="color: #888; font-size: 12px;">Level: ${zone.level}</span><br/>
                <span style="color: #888; font-size: 12px;">Radius: ${zone.radius}m</span>
              </div>
            `)
            .addTo(map);
          setActivePopup(popup);
        });
      });
    };

    addDangerZones();
  }, [dangerZones, showDangerZones]);

  // Render user markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Show other users' markers
    if (showUserMarkers) {
      userLocations.forEach(user => {
        if (!user.lat || !user.lng) return;

        const element = createMarkerElement(user.username || user.touristId, user.status);
        const marker = new Marker({ element, anchor: 'bottom' })
          .setLngLat([user.lng, user.lat])
          .addTo(map);

        // Popup for user
        element.addEventListener('click', () => {
          const popup = new Popup({ offset: 30, closeButton: true, maxWidth: '300px' })
            .setLngLat([user.lng, user.lat])
            .setHTML(`
              <div style="font-family: 'Inter', sans-serif; padding: 8px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    background: ${STATUS_CONFIG[user.status]?.bg};
                    border: 2px solid ${STATUS_CONFIG[user.status]?.color};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 13px;
                    color: ${STATUS_CONFIG[user.status]?.color};
                  ">${(user.username || user.touristId).slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style="font-weight: 700; font-size: 14px; color: #fff;">${user.username || user.touristId}</div>
                    <div style="font-size: 10px; color: #888; font-family: monospace;">${user.touristId}</div>
                  </div>
                </div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  padding: 6px 10px;
                  border-radius: 10px;
                  background: ${STATUS_CONFIG[user.status]?.bg};
                  border: 1.5px solid ${STATUS_CONFIG[user.status]?.color}40;
                  margin-bottom: 8px;
                ">
                  <div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${STATUS_CONFIG[user.status]?.color};
                    box-shadow: 0 0 6px ${STATUS_CONFIG[user.status]?.color};
                  "></div>
                  <span style="
                    font-weight: 800;
                    font-size: 13px;
                    color: ${STATUS_CONFIG[user.status]?.color};
                    letter-spacing: 0.5px;
                  ">${STATUS_CONFIG[user.status]?.emoji} ${STATUS_CONFIG[user.status]?.label}</span>
                  <span style="margin-left: auto; font-size: 9px; color: ${STATUS_CONFIG[user.status]?.color}; opacity: 0.8;">LIVE</span>
                </div>
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">
                  <strong>📍 Location:</strong>
                </div>
                <div style="font-size: 9px; color: #aaa; margin-bottom: 4px; max-height: 60px; overflow-y: auto;">
                  ${user.address || 'Address unavailable'}
                </div>
                <div style="font-size: 9px; color: #666; font-family: monospace;">
                  ${user.lat.toFixed(5)}, ${user.lng.toFixed(5)}
                </div>
              </div>
            `)
            .addTo(map);
          setActivePopup(popup);
        });

        markersRef.current.push(marker);
      });
    }

    // Current user marker
    if (currentUserLocation) {
      if (currentUserMarkerRef.current) {
        currentUserMarkerRef.current.remove();
      }

      const userStatus = currentUserLocation.status || 'safe';
      const element = createCurrentUserMarker(userStatus);
      const marker = new Marker({ element, anchor: 'center' })
        .setLngLat([currentUserLocation.lng, currentUserLocation.lat])
        .addTo(map);

      // Popup for current user
      element.addEventListener('click', () => {
        const popup = new Popup({ offset: 20, closeButton: true, maxWidth: '300px' })
          .setLngLat([currentUserLocation.lng, currentUserLocation.lat])
          .setHTML(`
            <div style="font-family: 'Inter', sans-serif; padding: 12px; background: rgba(10,10,20,0.98); border-radius: 12px; border: 2px solid ${STATUS_CONFIG[userStatus]?.color}; min-width: 200px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: ${STATUS_CONFIG[userStatus]?.color};
                  box-shadow: 0 0 12px ${STATUS_CONFIG[userStatus]?.color};
                  animation: maplibre-pulse 1s ease-in-out infinite;
                "></div>
                <strong style="color: #fff; font-size: 14px; font-weight: 800;">${STATUS_CONFIG[userStatus]?.emoji} ${STATUS_CONFIG[userStatus]?.label}</strong>
                <span style="
                  font-size: 9px;
                  padding: 2px 6px;
                  border-radius: 4px;
                  background: ${STATUS_CONFIG[userStatus]?.color};
                  color: #fff;
                  font-weight: 700;
                  letter-spacing: 0.5px;
                ">LIVE</span>
              </div>
              <div style="
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 8px;
                margin-top: 8px;
              ">
                <div style="font-size: 10px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Your Location</div>
                <div style="font-size: 13px; color: ${STATUS_CONFIG[userStatus]?.color}; font-family: 'Courier New', monospace; font-weight: 700;">
                  📍 ${currentUserLocation.lat.toFixed(6)}, ${currentUserLocation.lng.toFixed(6)}
                </div>
                <div style="font-size: 9px; color: #666; margin-top: 4px;">
                  Accuracy: High (GPS)
                </div>
              </div>
            </div>
          `)
          .addTo(map);
        setActivePopup(popup);
      });

      currentUserMarkerRef.current = marker;
    }
  }, [userLocations, currentUserLocation, showUserMarkers]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Map Legend */}
      {isAdmin && (
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1.5 border border-white/10 z-[1000]">
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
        @keyframes maplibre-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.75; }
        }
        .maplibregl-marker:hover {
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  );
};

export default MapLibreMap;
