import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export function useSendLocation(
  userId: string,
  touristId: string,
  status: 'safe' | 'alert' | 'danger',
  username?: string
) {
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!userId || !touristId || userId.trim() === '' || touristId.trim() === '') return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        // Throttle: send at most once every 5 seconds
        const now = Date.now();
        if (now - lastSentRef.current < 5000) return;
        lastSentRef.current = now;

        const { latitude, longitude } = pos.coords;

        try {
          await api.locations.update({
            user_id: userId,
            tourist_id: touristId,
            lat: latitude,
            lng: longitude,
            username: username || touristId,
          });
          console.log('📍 Location sent:', { lat: latitude, lng: longitude, status });
        } catch (error) {
          console.error('Location send error:', error);
        }
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, touristId, status, username]);
}
