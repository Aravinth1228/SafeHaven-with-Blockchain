import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

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

// Calculate distance between two points in meters (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useDangerZoneDetection = (
  userLocation: UserLocation | null,
  touristId: string,
  username: string,
  userId?: string
) => {
  const { toast } = useToast();
  const notifiedZonesRef = useRef<Set<string>>(new Set());
  const adminNotifiedRef = useRef<Set<string>>(new Set());
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [nearestZone, setNearestZone] = useState<{ zone: DangerZone; distance: number } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch danger zones
  const fetchZones = useCallback(async () => {
    try {
      const { data } = await api.dangerZones.getAll();
      setDangerZones(data || []);
    } catch (error) {
      console.error('Error fetching danger zones:', error);
    }
  }, []);

  useEffect(() => {
    fetchZones();
    
    // Poll for danger zone updates every 10 seconds
    pollIntervalRef.current = setInterval(fetchZones, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Check proximity to danger zones
  useEffect(() => {
    if (!userLocation || dangerZones.length === 0) return;

    let closestZone: { zone: DangerZone; distance: number } | null = null;

    dangerZones.forEach((zone) => {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        zone.lat,
        zone.lng
      );

      // Track closest zone
      if (!closestZone || distance < closestZone.distance) {
        closestZone = { zone, distance };
      }

      const isInZone = distance <= zone.radius;
      const isNearZone = distance <= zone.radius * 1.5;
      const zoneKey = `${touristId}-${zone.id}`;

      if (isInZone && !notifiedZonesRef.current.has(zoneKey)) {
        notifiedZonesRef.current.add(zoneKey);

        // Notify tourist
        toast({
          title: `🚨 Danger Zone Alert!`,
          description: `You have entered ${zone.name} (${(zone.level || 'medium').toUpperCase()} risk area). Stay alert and follow safety guidelines.`,
          variant: 'destructive',
        });

        // Create alert in backend for admin dashboard
        if (!adminNotifiedRef.current.has(zoneKey)) {
          adminNotifiedRef.current.add(zoneKey);

          // The backend automatically creates alerts when location is sent
          // No need to manually insert here
        }
      } else if (isNearZone && !isInZone && !notifiedZonesRef.current.has(`near-${zoneKey}`)) {
        notifiedZonesRef.current.add(`near-${zoneKey}`);

        toast({
          title: `⚠️ Approaching Danger Zone`,
          description: `You are near ${zone.name}. Proceed with caution.`,
        });
      } else if (!isInZone && notifiedZonesRef.current.has(zoneKey)) {
        // User left the zone
        notifiedZonesRef.current.delete(zoneKey);
        notifiedZonesRef.current.delete(`near-${zoneKey}`);

        toast({
          title: '✅ Left Danger Zone',
          description: `You have left ${zone.name}`,
        });
      }
    });

    setNearestZone(closestZone);
  }, [userLocation, dangerZones, touristId, username, userId, toast]);

  return {
    nearestZone,
    dangerZones,
    clearNotifications: () => {
      notifiedZonesRef.current.clear();
      adminNotifiedRef.current.clear();
    },
  };
};
