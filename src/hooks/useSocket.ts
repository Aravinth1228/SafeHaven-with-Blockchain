import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UserLocation {
  user_id: string;
  tourist_id: string;
  lat: number;
  lng: number;
  username: string;
  address?: string;  // Optional address field
  status: 'safe' | 'alert' | 'danger';
  updated_at?: string;
}

interface UseSocketOptions {
  onLocationUpdate?: (location: UserLocation) => void;
  onMyLocationUpdate?: (location: UserLocation) => void;
  enabled?: boolean;
  isAdmin?: boolean;
  touristId?: string;
}

// Socket.IO connects to root URL, not /api endpoint
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const SOCKET_URL = API_BASE_URL.replace(/\/api$/, ''); // Remove /api suffix for Socket.IO

export function useSocket({
  onLocationUpdate,
  onMyLocationUpdate,
  enabled = true,
  isAdmin = false,
  touristId,
}: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  // Connect to Socket.IO
  useEffect(() => {
    if (!enabled) return;

    console.log('🔌 Connecting to Socket.IO...', SOCKET_URL);
    
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket.IO connected:', socketRef.current?.id);
      isConnectedRef.current = true;

      // Join rooms
      if (isAdmin) {
        socketRef.current?.emit('join-admin');
        console.log('📊 Joined admin-room for real-time updates');
      }

      if (touristId) {
        socketRef.current?.emit('join-user', touristId);
        console.log(`👤 Joined user-${touristId} room`);
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
      isConnectedRef.current = false;
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('🔌 Socket.IO connection error:', error.message);
    });

    // Listen for location updates from other users (admin only)
    socketRef.current.on('location-update', (location: UserLocation) => {
      console.log('📍 Real-time location update received:', location.username);
      onLocationUpdate?.(location);
    });

    // Listen for own location updates (user only)
    socketRef.current.on('my-location-update', (location: UserLocation) => {
      console.log('📍 My location update received:', location);
      onMyLocationUpdate?.(location);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
        console.log('🔌 Socket.IO disconnected');
      }
    };
  }, [enabled, isAdmin, touristId, onLocationUpdate, onMyLocationUpdate]);

  // Check connection status
  const isConnected = useCallback(() => isConnectedRef.current, []);

  // Get socket instance
  const getSocket = useCallback(() => socketRef.current, []);

  return {
    isConnected,
    getSocket,
  };
}
