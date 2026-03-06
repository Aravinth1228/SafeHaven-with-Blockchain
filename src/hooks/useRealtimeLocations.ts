import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface UserLocation {
  id?: string;
  user_id: string;
  tourist_id: string;
  lat: number;
  lng: number;
  status?: string;
  updated_at?: string;
}

interface UseRealtimeLocationsOptions {
  onLocationUpdate?: (location: UserLocation) => void;
  onLocationsLoaded?: (locations: UserLocation[]) => void;
  enabled?: boolean;
}

export function useRealtimeLocations({
  onLocationUpdate,
  onLocationsLoaded,
  enabled = true,
}: UseRealtimeLocationsOptions = {}) {
  const prevLocationsRef = useRef<Map<string, UserLocation>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialRef = useRef(false);

  const fetchLocations = useCallback(async () => {
    try {
      const { data } = await api.locations.getAll();
      
      // Initial load
      if (!hasLoadedInitialRef.current) {
        onLocationsLoaded?.(data);
        hasLoadedInitialRef.current = true;
        return;
      }

      // Check for updates
      const currentLocations = new Map<string, UserLocation>();
      data.forEach((location: UserLocation) => currentLocations.set(location.user_id, location));

      currentLocations.forEach((location, userId) => {
        const prevLocation = prevLocationsRef.current.get(userId);
        if (!prevLocation) {
          // New location
          onLocationUpdate?.(location);
        } else if (
          location.lat !== prevLocation.lat ||
          location.lng !== prevLocation.lng ||
          location.status !== prevLocation.status
        ) {
          // Updated location
          onLocationUpdate?.(location);
        }
      });

      prevLocationsRef.current = currentLocations;
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, [onLocationUpdate, onLocationsLoaded]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchLocations();

    // Poll every 2 seconds for real-time feel
    pollIntervalRef.current = setInterval(fetchLocations, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enabled, fetchLocations]);

  return {
    refresh: fetchLocations,
  };
}
