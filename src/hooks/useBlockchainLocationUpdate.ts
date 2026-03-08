import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface UseLocationOptions {
  userId: string;
  touristId: string;
  status: 'safe' | 'alert' | 'danger';
  username?: string;
}

/**
 * Hook to send location updates to MongoDB ONLY (no blockchain)
 * Updates every 5 seconds to backend
 */
export function useLocationUpdate({
  userId,
  touristId,
  status,
  username,
}: UseLocationOptions) {
  const lastUpdateRef = useRef<number>(0);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!userId || !touristId) return;

    const now = Date.now();

    // Send to backend every 5 seconds (MongoDB only)
    if (now - lastUpdateRef.current >= 5000) {
      try {
        await api.locations.update({
          user_id: userId,
          tourist_id: touristId,
          lat: lat,
          lng: lng,
          username: username || touristId,
          status: status,
        });
        lastUpdateRef.current = now;
        console.log('📍 Location sent to MongoDB:', { lat, lng, status });
      } catch (error) {
        console.error('MongoDB location update error:', error);
      }
    }
  }, [userId, touristId, status, username]);

  useEffect(() => {
    if (!userId || !touristId || userId.trim() === '' || touristId.trim() === '') return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await updateLocation(latitude, longitude);
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, touristId, updateLocation]);
}
