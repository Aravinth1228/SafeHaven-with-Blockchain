import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useContract } from '@/hooks/useContract';

interface UseBlockchainLocationOptions {
  userId: string;
  touristId: string;
  status: 'safe' | 'alert' | 'danger';
  username?: string;
  isInitialized: boolean;
  initialize: () => Promise<void>;
}

/**
 * Hook to send location updates to blockchain
 * Throttles updates to save gas (every 30 seconds)
 */
export function useBlockchainLocationUpdate({
  userId,
  touristId,
  status,
  username,
  isInitialized,
  initialize,
}: UseBlockchainLocationOptions) {
  const { updateLocation: updateBlockchainLocation } = useContract();
  const lastBlockchainUpdateRef = useRef<number>(0);
  const lastBackendUpdateRef = useRef<number>(0);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!userId || !touristId) return;

    const now = Date.now();

    // Send to backend every 5 seconds
    if (now - lastBackendUpdateRef.current >= 5000) {
      try {
        await api.locations.update({
          user_id: userId,
          tourist_id: touristId,
          lat: lat,
          lng: lng,
          username: username || touristId,
        });
        lastBackendUpdateRef.current = now;
        console.log('📍 Location sent to backend:', { lat, lng, status });
      } catch (error) {
        console.error('Backend location update error:', error);
      }
    }

    // Send to blockchain every 30 seconds (to save gas)
    if (now - lastBlockchainUpdateRef.current >= 30000) {
      try {
        if (!isInitialized) {
          await initialize();
        }

        console.log('📍 Updating location on blockchain...', { lat, lng });
        const success = await updateBlockchainLocation(lat, lng);
        
        if (success) {
          lastBlockchainUpdateRef.current = now;
          console.log('✅ Blockchain location updated!');
        }
      } catch (error) {
        console.error('Blockchain location update error:', error);
        // Don't throw - blockchain update is optional
      }
    }
  }, [userId, touristId, status, username, isInitialized, initialize, updateBlockchainLocation]);

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
