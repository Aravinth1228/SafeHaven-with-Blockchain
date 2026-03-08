import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DangerZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: string;
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface NearestZone {
  zone: DangerZone;
  distance: number;
}

export const useDangerZoneDetection = (
  userLocation: UserLocation | null,
  touristId: string,
  username: string,
  userId?: string,
  dangerZones: DangerZone[] = []
) => {
  const { toast } = useToast();
  const notifiedZonesRef = useRef<Set<string>>(new Set());
  const adminNotifiedRef = useRef<Set<string>>(new Set());
  const [nearestZone, setNearestZone] = useState<NearestZone | null>(null);

  // Check proximity to danger zones
  useEffect(() => {
    if (!userLocation || dangerZones.length === 0) {
      setNearestZone(null);
      return;
    }

    let nearest: NearestZone | null = null;

    for (const zone of dangerZones) {
      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = userLocation.lat * Math.PI / 180;
      const φ2 = zone.lat * Math.PI / 180;
      const Δφ = (zone.lat - userLocation.lat) * Math.PI / 180;
      const Δλ = (zone.lng - userLocation.lng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // Find the nearest zone
      if (!nearest || distance < nearest.distance) {
        nearest = { zone, distance };
      }
    }

    setNearestZone(nearest);
  }, [userLocation, dangerZones]);

  return {
    nearestZone,
    clearNotifications: () => {
      notifiedZonesRef.current.clear();
      adminNotifiedRef.current.clear();
    },
  };
};
