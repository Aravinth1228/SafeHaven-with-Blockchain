import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UserLocation {
  user_id: string;
  tourist_id: string;
  lat: number;
  lng: number;
  username: string;
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
  const reconnectAttemptsRef = useRef(0);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Connect to Socket.IO
  useEffect(() => {
    if (!enabled) return;

    console.log('🔌 Connecting to Socket.IO...', SOCKET_URL);

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      randomizationFactor: 0.5,
      forceNew: false, // Reuse existing connection
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket.IO connected:', socketRef.current?.id);
      isConnectedRef.current = true;
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;

      // Join rooms
      if (isAdmin) {
        socketRef.current?.emit('join-admin');
        console.log('📊 Joined admin-room for real-time updates');
      }

      if (touristId) {
        socketRef.current?.emit('join-user', touristId);
        console.log(`👤 Joined user-${touristId} room`);
      }

      // Users also join admin-room to receive other users' locations (for map display)
      if (!isAdmin && touristId) {
        socketRef.current?.emit('join-admin');
        console.log('📍 User joined admin-room for other users location updates');
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      isConnectedRef.current = false;
      setConnectionState('disconnected');
    });

    socketRef.current.on('reconnect_attempt', (attemptNum: number) => {
      reconnectAttemptsRef.current = attemptNum;
      setConnectionState('reconnecting');
      console.log(`🔄 Reconnecting to Socket.IO (attempt ${attemptNum}/10)...`);
    });

    socketRef.current.on('reconnect', () => {
      console.log('✅ Socket.IO reconnected successfully');
      setConnectionState('connected');
      
      // Re-join rooms after reconnect
      if (isAdmin) {
        socketRef.current?.emit('join-admin');
      }
      if (touristId) {
        socketRef.current?.emit('join-user', touristId);
        socketRef.current?.emit('join-admin');
      }
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('🔌 Socket.IO reconnection error:', error.message);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('🔌 Socket.IO connection error:', error.message);
      setConnectionState('disconnected');
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
      // Cleanup: Don't disconnect on unmount, just remove listeners
      // Socket.IO will handle reconnection automatically
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        // Keep connection alive for faster reconnection
        console.log('🔌 Socket.IO listeners removed (connection kept alive)');
      }
    };
  }, [enabled, isAdmin, touristId]);

  // Check connection status
  const isConnected = useCallback(() => isConnectedRef.current, []);

  // Get socket instance
  const getSocket = useCallback(() => socketRef.current, []);

  return {
    isConnected,
    getSocket,
    connectionState,
  };
}
