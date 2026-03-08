import React, { useEffect, useRef, useState } from 'react';
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

// Custom marker icon factory
function createCustomIcon(username: string, status: 'safe' | 'alert' | 'danger', isCurrentUser = false) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  const initials = username.slice(0, 2).toUpperCase();
  
  const html = `
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
      ">
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
        ${status === 'alert' || status === 'danger' ? 'animation: leaflet-pulse 1.4s ease-in-out infinite;' : ''}
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 60],
    iconAnchor: [12, 60],
    popupAnchor: [0, -60],
  });
}

// Simple dot marker for current user
function createDotIcon(status: 'safe' | 'alert' | 'danger') {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  
  const html = `
    <div style="
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${cfg.color};
      border: 3px solid white;
      box-shadow: 0 0 0 6px ${cfg.glow};
      animation: leaflet-pulse 2s ease-in-out infinite;
      cursor: pointer;
    "></div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

const LeafletMap: React.FC<Props> = ({
  dangerZones = [],
  userLocations = [],
  currentUserLocation,
  showDangerZones = true,
  showUserMarkers = true,
  isAdmin = false,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map with user's location if available
    const defaultCenter = currentUserLocation
      ? [currentUserLocation.lat, currentUserLocation.lng]
      : [20.5937, 78.9629]; // India center
    const defaultZoom = currentUserLocation ? 16 : 5; // Higher zoom for accuracy

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      zoomAnimation: true,
      fadeAnimation: true,
    }).setView(defaultCenter, defaultZoom);

    // Add OpenStreetMap tiles (dark theme alternative using CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      minZoom: 3,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Center map on current user location change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentUserLocation) return;

    // Smooth fly to user location with higher zoom for accuracy
    map.flyTo([currentUserLocation.lat, currentUserLocation.lng], 16, {
      duration: 1.5,
      animate: true,
    });
  }, [currentUserLocation]);

  // Render danger zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDangerZones) return;

    // Clear existing circles
    circlesRef.current.forEach(circle => circle.remove());
    circlesRef.current = [];

    dangerZones.forEach(zone => {
      const zoneConfig = {
        high: { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25 },
        medium: { color: '#f97316', fillColor: '#f97316', fillOpacity: 0.2 },
        low: { color: '#eab308', fillColor: '#eab308', fillOpacity: 0.15 },
      };
      const cfg = zoneConfig[zone.level] || zoneConfig.medium;

      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radius,
        color: cfg.color,
        fillColor: cfg.fillColor,
        fillOpacity: cfg.fillOpacity,
        weight: 2,
        dashArray: zone.level === 'high' ? '0' : '5, 5',
      }).addTo(map);

      // Add label
      const label = L.marker([zone.lat, zone.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid ${cfg.color};
            white-space: nowrap;
          ">${zone.name}</div>`,
          className: '',
          iconSize: [100, 30],
          iconAnchor: [50, 15],
        }),
      }).addTo(map);

      circle.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; padding: 8px;">
          <strong style="color: ${cfg.color}; font-size: 14px;">${zone.name}</strong><br/>
          <span style="color: #888; font-size: 12px;">Level: ${zone.level}</span><br/>
          <span style="color: #888; font-size: 12px;">Radius: ${zone.radius}m</span>
        </div>
      `);

      circlesRef.current.push(circle, label as L.Marker as L.Circle);
    });
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

        const icon = createCustomIcon(user.username || user.touristId, user.status);
        const marker = L.marker([user.lat, user.lng], { icon }).addTo(map);

        marker.bindPopup(`
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
            <div style="font-size: 11px; color: #888; display: flex; align-items: center; gap: 4px;">
              📍 ${user.lat.toFixed(5)}, ${user.lng.toFixed(5)}
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    // Current user marker with high accuracy indicator
    if (currentUserLocation) {
      const userStatus = currentUserLocation.status || 'safe';
      const icon = createDotIcon(userStatus);
      const marker = L.marker([currentUserLocation.lat, currentUserLocation.lng], { 
        icon,
        zIndexOffset: 1000 // Ensure user marker is always on top
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; padding: 12px; background: rgba(10,10,20,0.98); border-radius: 12px; border: 2px solid ${STATUS_CONFIG[userStatus]?.color}; min-width: 200px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${STATUS_CONFIG[userStatus]?.color};
              box-shadow: 0 0 12px ${STATUS_CONFIG[userStatus]?.color};
              animation: leaflet-pulse 1s ease-in-out infinite;
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
      `);

      // Auto-open popup on first load
      setTimeout(() => {
        marker.openPopup();
      }, 500);

      markersRef.current.push(marker);
    }
  }, [userLocations, currentUserLocation, showUserMarkers]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ zIndex: 1 }}
      />

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
        @keyframes leaflet-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
};

export default LeafletMap;
